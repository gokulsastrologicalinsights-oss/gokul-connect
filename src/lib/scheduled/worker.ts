import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  WhatsAppScheduledMessage,
  WhatsAppContact,
  WhatsAppConnection,
  WhatsAppMessageTemplate,
} from "@/types/database";
import {
  getStoredMediaFile,
} from "@/lib/media/storage";
import {
  isRetryableMetaError,
  sendWhatsAppMessageService,
} from "@/lib/whatsapp/service";
import { logTeamActivity } from "@/lib/team/store";
import {
  getInMemoryScheduledMessages,
  listScheduledMessagesDb,
  updateScheduledMessageDb,
} from "./database";

export interface ProcessScheduledResult {
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  reclaimedCount: number;
  errors: string[];
}

/**
 * Calculates exponential backoff with random jitter:
 * delay = (2^attempts * 30s) + (random * 5s)
 * Max 1800s (30 minutes)
 */
export function calculateScheduledBackoffDelay(attempts: number): number {
  const base = Math.pow(2, attempts) * 30;
  const jitter = Math.floor(Math.random() * 5);
  return Math.min(base + jitter, 1800);
}

/**
 * Check if the 24-hour customer service window is open for a conversation/contact.
 */
export async function verifyCustomerServiceWindow(
  supabase: any,
  businessId: string,
  recipientPhone: string,
  conversationId?: string | null
): Promise<{ isOpen: boolean; lastInboundAt: string | null }> {
  try {
    let query = supabase
      .from("wa_messages")
      .select("created_at")
      .eq("business_id", businessId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1);

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    const { data: lastInbound, error } = await query.maybeSingle();

    if (error || !lastInbound || !lastInbound.created_at) {
      return { isOpen: false, lastInboundAt: null };
    }

    const lastInboundTime = new Date(lastInbound.created_at).getTime();
    const elapsed = Date.now() - lastInboundTime;
    const isOpen = elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;

    return { isOpen, lastInboundAt: lastInbound.created_at };
  } catch {
    return { isOpen: false, lastInboundAt: null };
  }
}

/**
 * Check if a contact is opted out of WhatsApp messages
 */
export async function checkContactOptOut(
  supabase: any,
  businessId: string,
  recipientPhone: string
): Promise<{ isOptedOut: boolean; reason?: string | null }> {
  try {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");
    const { data: contact, error } = await supabase
      .from("wa_contacts")
      .select("is_opted_out, opted_out_reason")
      .eq("business_id", businessId)
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (!error && contact) {
      return {
        isOptedOut: Boolean(contact.is_opted_out),
        reason: contact.opted_out_reason,
      };
    }
  } catch {
    // If table unreachable, fail-closed only on explicit opt-out records
  }
  return { isOptedOut: false };
}

/**
 * Dispatches a single claimed scheduled message with full pre-flight validation.
 */
export async function dispatchSingleScheduledMessage(
  supabase: any,
  message: WhatsAppScheduledMessage
): Promise<{
  status: "success" | "failed" | "retry";
  error?: string;
  messageId?: string;
  metaMessageId?: string;
}> {
  const { business_id: businessId, connection_id: connectionId, recipient_phone: recipientPhone } = message;

  // 1. REVALIDATE CONNECTION AND TENANT STATUS
  const { data: connection, error: connErr } = await supabase
    .from("wa_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (connErr || !connection) {
    return {
      status: "failed",
      error: `WhatsApp connection ${connectionId} does not belong to business ${businessId} or was removed.`,
    };
  }

  if (!connection.is_enabled) {
    return {
      status: "failed",
      error: `WhatsApp connection "${connection.display_name}" is currently disabled. Message dispatch rejected.`,
    };
  }

  // 2. REVALIDATE OPT-OUT STATUS (STRICT CONSENT CHECK)
  const optOutCheck = await checkContactOptOut(supabase, businessId, recipientPhone);
  if (optOutCheck.isOptedOut) {
    return {
      status: "failed",
      error: `Recipient ${recipientPhone} has opted out of automated WhatsApp messages (${optOutCheck.reason || "user_request"}). Dispatch strictly blocked.`,
    };
  }

  // 3. REVALIDATE 24-HOUR MESSAGING WINDOW FOR TEXT AND MEDIA
  const isTemplate = message.message_type === "template";
  if (!isTemplate) {
    const windowStatus = await verifyCustomerServiceWindow(
      supabase,
      businessId,
      recipientPhone,
      message.conversation_id
    );

    if (!windowStatus.isOpen) {
      return {
        status: "failed",
        error: `Meta 24-hour customer service window is closed (no customer message in past 24h). Free-form ${message.message_type} messages cannot be sent. An approved template message is required.`,
      };
    }
  }

  // 4. REVALIDATE TEMPLATE ELIGIBILITY IF TEMPLATE MESSAGE
  if (isTemplate) {
    if (!message.template_name) {
      return {
        status: "failed",
        error: "Template message requires a valid template_name.",
      };
    }

    const { data: templateRecord, error: tplErr } = await supabase
      .from("wa_message_templates")
      .select("*")
      .eq("business_id", businessId)
      .eq("template_name", message.template_name)
      .maybeSingle();

    if (tplErr || !templateRecord) {
      // Allow fallback if it is a default business template
      const isDefault = ["welcome_inquiry", "consultation_reminder", "horoscope_ready", "match_update", "order_confirmation"].includes(
        message.template_name
      );
      if (!isDefault) {
        return {
          status: "failed",
          error: `Template "${message.template_name}" was not found for this business tenant.`,
        };
      }
    } else {
      if (templateRecord.status !== "APPROVED") {
        return {
          status: "failed",
          error: `Template "${message.template_name}" is not approved by Meta (current status: ${templateRecord.status}). Dispatch rejected.`,
        };
      }
      if (templateRecord.is_archived) {
        return {
          status: "failed",
          error: `Template "${message.template_name}" is archived and cannot be dispatched.`,
        };
      }
    }
  }

  // 5. PREPARE MEDIA BUFFER IF MEDIA MESSAGE
  let mediaPayload: any = undefined;
  if (["image", "document", "audio", "video"].includes(message.message_type)) {
    if (message.media_storage_path) {
      try {
        const stored = await getStoredMediaFile(businessId, message.media_storage_path);
        mediaPayload = {
          type: message.media_type || message.message_type,
          filename: message.media_filename || "media_file",
          mimeType: message.media_mime_type || stored.mimeType,
          fileSize: message.media_file_size || stored.size,
          fileBuffer: stored.buffer,
          storagePath: message.media_storage_path,
          caption: message.media_caption || undefined,
          metaMediaId: message.media_meta_id || undefined,
        };
      } catch (mediaErr: any) {
        return {
          status: "failed",
          error: `Failed to retrieve scheduled media attachment: ${mediaErr.message}`,
        };
      }
    } else if (message.content) {
      // Content has media URL or caption
      mediaPayload = {
        type: message.media_type || message.message_type,
        filename: message.media_filename || "media_file",
        mimeType: message.media_mime_type || "application/octet-stream",
        fileSize: message.media_file_size || 1024,
        caption: message.media_caption || message.content,
        metaMediaId: message.media_meta_id || undefined,
      };
    }
  }

  // 6. DISPATCH VIA EXISTING CENTRAL MESSAGING SERVICE
  try {
    const templatePayload = isTemplate
      ? {
          name: message.template_name!,
          languageCode: message.template_language || "en_US",
          components: message.template_variables
            ? [
                {
                  type: "body",
                  parameters: Object.entries(message.template_variables).map(([_, val]) => ({
                    type: "text",
                    text: val,
                  })),
                },
              ]
            : undefined,
        }
      : undefined;

    const result = await sendWhatsAppMessageService({
      businessId,
      connectionId,
      recipientPhone,
      recipientName: message.recipient_name || undefined,
      conversationId: message.conversation_id || undefined,
      text: message.message_type === "text" ? message.content || "" : undefined,
      template: templatePayload,
      media: mediaPayload,
      supabaseClient: supabase,
      enforceWindow: !isTemplate,
    });

    if (result.success) {
      return {
        status: "success",
        messageId: result.messageId,
        metaMessageId: result.metaMessageId,
      };
    } else {
      const isRetryable = isRetryableMetaError(result.error);
      return {
        status: isRetryable ? "retry" : "failed",
        error: result.error || "Message dispatch failed.",
      };
    }
  } catch (err: any) {
    const isRetryable = isRetryableMetaError(err);
    return {
      status: isRetryable ? "retry" : "failed",
      error: err.message || "Unexpected dispatch error.",
    };
  }
}

/**
 * Execute a batch run of due scheduled messages with atomic row locking and recovery.
 */
export async function processScheduledMessagesBatch(
  batchSize: number = 10,
  workerId: string = `worker_${Date.now()}`
): Promise<ProcessScheduledResult> {
  const result: ProcessScheduledResult = {
    claimedCount: 0,
    processedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    reclaimedCount: 0,
    errors: [],
  };

  let supabase: any;
  const isConfigured = isSupabaseConfigured();

  if (isConfigured) {
    try {
      supabase = createAdminClient();
    } catch (err: any) {
      result.errors.push(`Failed to initialize Supabase admin client: ${err.message}`);
    }
  }

  // Step 1: Reclaim stuck jobs locked > 5 minutes ago
  if (supabase) {
    try {
      const { data: reclaimed } = await supabase.rpc("reclaim_stuck_scheduled_messages", {
        p_timeout_minutes: 5,
      });
      if (typeof reclaimed === "number") {
        result.reclaimedCount = reclaimed;
      }
    } catch {
      // Procedure may be missing or failed
    }
  }

  // Step 2: Atomic Claim
  let claimedMessages: WhatsAppScheduledMessage[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("claim_next_scheduled_messages", {
        p_batch_size: batchSize,
        p_worker_id: workerId,
      });

      if (!error && Array.isArray(data)) {
        claimedMessages = data as WhatsAppScheduledMessage[];
      }
    } catch (err: any) {
      result.errors.push(`RPC claim error: ${err.message}`);
    }
  }

  // If offline or in-memory fallback
  if (!supabase || claimedMessages.length === 0) {
    const all = getInMemoryScheduledMessages();
    const nowMs = Date.now();
    const eligible = all.filter(
      (m) => m.status === "scheduled" && new Date(m.scheduled_at).getTime() <= nowMs
    );

    for (const m of eligible.slice(0, batchSize)) {
      m.status = "processing";
      m.locked_at = new Date().toISOString();
      m.locked_by = workerId;
      claimedMessages.push(m);
    }
  }

  if (claimedMessages.length === 0) {
    return result;
  }

  result.claimedCount = claimedMessages.length;

  // Step 3: Process Claimed Messages
  for (const message of claimedMessages) {
    result.processedCount++;
    const now = new Date().toISOString();

    try {
      const outcome = await dispatchSingleScheduledMessage(supabase || {}, message);

      if (outcome.status === "success") {
        result.succeededCount++;

        if (supabase) {
          await supabase
            .from("wa_scheduled_messages")
            .update({
              status: "sent",
              sent_at: now,
              message_id: outcome.messageId || null,
              meta_message_id: outcome.metaMessageId || null,
              locked_at: null,
              locked_by: null,
              updated_at: now,
            })
            .eq("id", message.id);
        } else {
          message.status = "sent";
          message.sent_at = now;
          message.message_id = outcome.messageId || null;
          message.meta_message_id = outcome.metaMessageId || null;
          message.locked_at = null;
          message.locked_by = null;
          message.updated_at = now;
        }

        // Log Team Activity
        await logTeamActivity(message.business_id, {
          actor_id: null,
          actor_name: "Scheduled Message Dispatcher",
          activity_type: "scheduled_message_dispatched",
          description: `Successfully dispatched scheduled ${message.message_type} message to ${message.recipient_phone}`,
          metadata: {
            scheduled_message_id: message.id,
            meta_message_id: outcome.metaMessageId,
            message_id: outcome.messageId,
          },
        }).catch(() => {});
      } else if (outcome.status === "retry") {
        const nextRetry = (message.retry_count || 0) + 1;
        if (nextRetry < (message.max_retries || 3)) {
          const delaySec = calculateScheduledBackoffDelay(nextRetry);
          const nextScheduledAt = new Date(Date.now() + delaySec * 1000).toISOString();

          if (supabase) {
            await supabase
              .from("wa_scheduled_messages")
              .update({
                status: "scheduled",
                scheduled_at: nextScheduledAt,
                retry_count: nextRetry,
                last_error: outcome.error || "Transient dispatch failure",
                locked_at: null,
                locked_by: null,
                updated_at: now,
              })
              .eq("id", message.id);
          } else {
            message.status = "scheduled";
            message.scheduled_at = nextScheduledAt;
            message.retry_count = nextRetry;
            message.last_error = outcome.error || "Transient dispatch failure";
            message.locked_at = null;
            message.locked_by = null;
            message.updated_at = now;
          }

          result.skippedCount++;
        } else {
          // Exceeded retries -> fail permanently
          result.failedCount++;

          if (supabase) {
            await supabase
              .from("wa_scheduled_messages")
              .update({
                status: "failed",
                retry_count: nextRetry,
                last_error: outcome.error || "Exceeded maximum retry attempts",
                locked_at: null,
                locked_by: null,
                updated_at: now,
              })
              .eq("id", message.id);
          } else {
            message.status = "failed";
            message.retry_count = nextRetry;
            message.last_error = outcome.error || "Exceeded maximum retry attempts";
            message.locked_at = null;
            message.locked_by = null;
            message.updated_at = now;
          }

          await logTeamActivity(message.business_id, {
            actor_id: null,
            actor_name: "Scheduled Message Dispatcher",
            activity_type: "scheduled_message_failed",
            description: `Scheduled message ${message.id} failed after ${nextRetry} retries: ${outcome.error}`,
            metadata: { scheduled_message_id: message.id, error: outcome.error },
          }).catch(() => {});
        }
      } else {
        // Permanent failure (e.g. opt-out, window closed, unapproved template)
        result.failedCount++;

        if (supabase) {
          await supabase
            .from("wa_scheduled_messages")
            .update({
              status: "failed",
              last_error: outcome.error || "Permanent dispatch rejection",
              locked_at: null,
              locked_by: null,
              updated_at: now,
            })
            .eq("id", message.id);
        } else {
          message.status = "failed";
          message.last_error = outcome.error || "Permanent dispatch rejection";
          message.locked_at = null;
          message.locked_by = null;
          message.updated_at = now;
        }

        await logTeamActivity(message.business_id, {
          actor_id: null,
          actor_name: "Scheduled Message Dispatcher",
          activity_type: "scheduled_message_failed",
          description: `Scheduled message ${message.id} failed: ${outcome.error}`,
          metadata: { scheduled_message_id: message.id, error: outcome.error },
        }).catch(() => {});
      }
    } catch (err: any) {
      result.failedCount++;
      const errMsg = err.message || "Unknown execution exception";
      result.errors.push(`Error processing message ${message.id}: ${errMsg}`);

      if (supabase) {
        await supabase
          .from("wa_scheduled_messages")
          .update({
            status: "failed",
            last_error: errMsg,
            locked_at: null,
            locked_by: null,
            updated_at: now,
          })
          .eq("id", message.id);
      } else {
        message.status = "failed";
        message.last_error = errMsg;
        message.locked_at = null;
        message.locked_by = null;
        message.updated_at = now;
      }
    }
  }

  return result;
}
