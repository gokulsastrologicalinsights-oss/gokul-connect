import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  WhatsAppCampaign,
  WhatsAppCampaignRecipient,
  WhatsAppConnection,
  WhatsAppMessageTemplate,
} from "@/types/database";
import { isRetryableMetaError, sendWhatsAppMessageService } from "@/lib/whatsapp/service";
import { revalidateRecipientAtDispatch } from "./eligibility";
import {
  getCampaignByIdDb,
  getInMemoryCampaigns,
  getInMemoryRecipients,
} from "./database";
import { verifyCustomerServiceWindow } from "@/lib/scheduled/worker";

export interface ProcessCampaignsResult {
  claimedCount: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  reclaimedCount: number;
  errors: string[];
}

/**
 * Calculates exponential backoff with jitter for campaign retries:
 * delay = (2^attempts * 15s) + (random * 5s)
 * Max 600s (10 minutes)
 */
export function calculateCampaignBackoffDelay(attempts: number): number {
  const base = Math.pow(2, attempts) * 15;
  const jitter = Math.floor(Math.random() * 5);
  return Math.min(base + jitter, 600);
}

/**
 * Dispatches a single campaign recipient with strict compliance safeguards:
 * - Gate 1: Campaign active state verification (pause/cancel safety)
 * - Gate 2: Connection health verification
 * - Gate 3: Real-time opt-out & block revalidation immediately before dispatch
 * - Gate 4: Approved template verification (for template campaigns)
 * - Gate 5: 24-hour customer service window check (for non-template campaigns)
 */
export async function dispatchSingleCampaignRecipient(
  supabase: any,
  campaign: WhatsAppCampaign,
  recipient: WhatsAppCampaignRecipient,
  workerId: string = "campaign_worker"
): Promise<{
  success: boolean;
  status: "sent" | "failed" | "skipped";
  error?: string;
  metaMessageId?: string;
  messageId?: string;
  isRetryable?: boolean;
}> {
  const businessId = campaign.business_id;

  // Gate 1: Campaign active state verification
  if (["paused", "cancelled", "failed", "completed"].includes(campaign.status)) {
    return {
      success: false,
      status: "skipped",
      error: `Campaign was ${campaign.status} before recipient dispatch`,
    };
  }

  // Gate 2: Connection health verification
  let connection: WhatsAppConnection | null = null;
  if (supabase) {
    try {
      const { data: connData, error: connErr } = await supabase
        .from("wa_connections")
        .select("*")
        .eq("id", campaign.connection_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!connErr && connData) {
        connection = connData as WhatsAppConnection;
      }
    } catch {
      // Ignore
    }
  }

  if (connection && (connection.connection_status === "disconnected" || !connection.is_enabled)) {
    return {
      success: false,
      status: "failed",
      error: `WhatsApp connection ${connection.phone_number_id} is disconnected.`,
      isRetryable: true,
    };
  }

  // Gate 3: Real-time opt-out & consent revalidation immediately prior to dispatch
  const reval = await revalidateRecipientAtDispatch(
    supabase,
    businessId,
    { phone_number: recipient.phone_number, contact_id: recipient.contact_id },
    campaign.message_type
  );

  if (!reval.isEligible) {
    return {
      success: false,
      status: "skipped",
      error: reval.exclusionReason || "Contact is not eligible at dispatch time.",
      isRetryable: false,
    };
  }

  // Gate 4: Approved template verification (for template campaigns)
  if (campaign.message_type === "template" && campaign.template_name) {
    let template: WhatsAppMessageTemplate | null = null;
    if (supabase) {
      try {
        const { data: tData } = await supabase
          .from("wa_message_templates")
          .select("*")
          .eq("business_id", businessId)
          .eq("name", campaign.template_name)
          .maybeSingle();

        if (tData) {
          template = tData as WhatsAppMessageTemplate;
        }
      } catch {
        // Fallback
      }
    }

    if (template) {
      if (template.status !== "APPROVED" || template.is_archived) {
        return {
          success: false,
          status: "failed",
          error: `Template "${campaign.template_name}" is not approved or is archived (Status: ${template.status}).`,
          isRetryable: false,
        };
      }
    }
  }

  // Gate 5: 24-hour service window check for non-template campaigns
  if (campaign.message_type !== "template") {
    const windowStatus = await verifyCustomerServiceWindow(
      supabase,
      businessId,
      recipient.phone_number,
      null
    );

    if (!windowStatus.isOpen) {
      return {
        success: false,
        status: "failed",
        error: "WhatsApp 24-hour customer service window is closed for non-template campaign message.",
        isRetryable: false,
      };
    }
  }

  // Gate 6: WhatsApp Cloud API Dispatch
  try {
    let templateComponents: Array<Record<string, unknown>> | undefined;
    if (campaign.message_type === "template" && campaign.template_variables) {
      const parameters = Object.entries(campaign.template_variables).map(([k, v]) => ({
        type: "text",
        text: v,
      }));
      if (parameters.length > 0) {
        templateComponents = [
          {
            type: "body",
            parameters,
          },
        ];
      }
    }

    const sendRes = await sendWhatsAppMessageService({
      businessId,
      connectionId: campaign.connection_id,
      recipientPhone: recipient.phone_number,
      recipientName: recipient.recipient_name || undefined,
      text: campaign.message_type === "text" ? campaign.message_content || undefined : undefined,
      template:
        campaign.message_type === "template" && campaign.template_name
          ? {
              name: campaign.template_name,
              languageCode: campaign.template_language || "en_US",
              components: templateComponents,
            }
          : undefined,
      media:
        ["image", "document", "audio", "video"].includes(campaign.message_type) && campaign.media_type
          ? {
              type: campaign.media_type,
              filename: campaign.media_filename || "attachment",
              mimeType: campaign.media_mime_type || "application/octet-stream",
              fileSize: campaign.media_file_size || 1024,
              storagePath: campaign.media_storage_path || undefined,
              caption: campaign.media_caption || undefined,
              metaMediaId: campaign.media_meta_id || undefined,
            }
          : undefined,
      supabaseClient: supabase,
      enforceWindow: campaign.message_type !== "template",
    });

    if (sendRes.success) {
      return {
        success: true,
        status: "sent",
        metaMessageId: sendRes.metaMessageId || `meta-camp-${Date.now()}`,
        messageId: sendRes.messageId,
      };
    } else {
      const isRetry = isRetryableMetaError(sendRes.error);
      return {
        success: false,
        status: "failed",
        error: sendRes.error || "Meta WhatsApp Cloud API dispatch failed",
        isRetryable: isRetry,
      };
    }
  } catch (err: any) {
    const isRetry = isRetryableMetaError(err);
    return {
      success: false,
      status: "failed",
      error: err?.message || "Unknown error during campaign message dispatch",
      isRetryable: isRetry,
    };
  }
}

/**
 * Main batch worker for processing campaign recipients across all active campaigns.
 * Reclaims stuck jobs, atomically claims batches, and dispatches messages.
 */
export async function processCampaignsBatch(options: {
  batchSize?: number;
  workerId?: string;
  supabaseClient?: any;
} = {}): Promise<ProcessCampaignsResult> {
  const batchSize = options.batchSize || 50;
  const workerId = options.workerId || `worker-${Math.random().toString(36).substring(2, 7)}`;
  const errors: string[] = [];

  let claimedCount = 0;
  let processedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let reclaimedCount = 0;

  let supabase = options.supabaseClient;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = createAdminClient();
    } catch {
      // Fallback
    }
  }

  // 1. Reclaim stuck recipients (locked > 5 minutes)
  if (supabase) {
    try {
      const { data: recData } = await supabase.rpc("reclaim_stuck_campaign_recipients", {
        p_timeout_minutes: 5,
      });
      if (typeof recData === "number") {
        reclaimedCount = recData;
      }
    } catch {
      // Fallback
    }
  } else {
    // In-memory stuck reclaim
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recs = getInMemoryRecipients();
    for (const r of recs) {
      if (r.status === "processing" && r.locked_at && new Date(r.locked_at).getTime() < fiveMinAgo) {
        if (r.retry_count < r.max_retries) {
          r.status = "pending";
          r.locked_at = null;
          r.locked_by = null;
          r.retry_count++;
          reclaimedCount++;
        } else {
          r.status = "failed";
          r.locked_at = null;
          r.locked_by = null;
          r.last_error = "[Stuck recipient exceeded max retry limit]";
        }
      }
    }
  }

  // 2. Claim next pending recipients atomically
  let claimedRecipients: WhatsAppCampaignRecipient[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("claim_next_campaign_recipients", {
        p_batch_size: batchSize,
        p_worker_id: workerId,
      });

      if (!error && Array.isArray(data)) {
        claimedRecipients = data as WhatsAppCampaignRecipient[];
      }
    } catch (err: any) {
      errors.push(`Claim RPC error: ${err?.message || "Unknown RPC error"}`);
    }
  }

  // Fallback to in-memory store if DB RPC returned 0 or in test mode
  if (claimedRecipients.length === 0) {
    const activeCampaigns = getInMemoryCampaigns().filter(
      (c) =>
        ["queued", "sending"].includes(c.status) &&
        (!c.scheduled_at || new Date(c.scheduled_at).getTime() <= Date.now())
    );

    const activeCampIds = new Set(activeCampaigns.map((c) => c.id));
    const allRecs = getInMemoryRecipients();

    for (const r of allRecs) {
      if (
        r.status === "pending" &&
        r.eligibility_status === "eligible" &&
        activeCampIds.has(r.campaign_id)
      ) {
        r.status = "processing";
        r.locked_at = new Date().toISOString();
        r.locked_by = workerId;
        claimedRecipients.push(r);
        if (claimedRecipients.length >= batchSize) break;
      }
    }
  }

  claimedCount = claimedRecipients.length;
  if (claimedCount === 0) {
    return {
      claimedCount: 0,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      reclaimedCount,
      errors,
    };
  }

  // 3. Process each claimed recipient
  // Cache campaigns to avoid repeated lookups
  const campaignCache = new Map<string, WhatsAppCampaign | null>();

  for (const recipient of claimedRecipients) {
    let campaign = campaignCache.get(recipient.campaign_id);
    if (campaign === undefined) {
      campaign = await getCampaignByIdDb(recipient.business_id, recipient.campaign_id, supabase);
      campaignCache.set(recipient.campaign_id, campaign);
    }

    if (!campaign) {
      errors.push(`Campaign ${recipient.campaign_id} not found for recipient ${recipient.id}`);
      continue;
    }

    // Set campaign status to 'sending' if it was 'queued'
    if (campaign.status === "queued") {
      campaign.status = "sending";
      if (supabase) {
        try {
          await supabase
            .from("wa_campaigns")
            .update({ status: "sending", started_at: new Date().toISOString() })
            .eq("id", campaign.id);
        } catch {
          // Ignore
        }
      }
    }

    processedCount++;

    const dispatchResult = await dispatchSingleCampaignRecipient(
      supabase,
      campaign,
      recipient,
      workerId
    );

    const nowIso = new Date().toISOString();

    if (dispatchResult.success) {
      sentCount++;
      recipient.status = "sent";
      recipient.dispatched_at = nowIso;
      recipient.meta_message_id = dispatchResult.metaMessageId || null;
      recipient.message_id = dispatchResult.messageId || null;
      recipient.locked_at = null;
      recipient.locked_by = null;
      recipient.last_error = null;

      // Update in DB
      if (supabase) {
        try {
          await supabase
            .from("wa_campaign_recipients")
            .update({
              status: "sent",
              dispatched_at: nowIso,
              meta_message_id: recipient.meta_message_id,
              message_id: recipient.message_id,
              locked_at: null,
              locked_by: null,
              updated_at: nowIso,
            })
            .eq("id", recipient.id);

          await supabase.rpc("increment_campaign_sent_count", { p_campaign_id: campaign.id }).catch(() => {
            // direct update fallback
            supabase
              .from("wa_campaigns")
              .update({ sent_count: (campaign?.sent_count || 0) + 1, updated_at: nowIso })
              .eq("id", campaign?.id);
          });
        } catch {
          // Ignore
        }
      }

      campaign.sent_count = (campaign.sent_count || 0) + 1;
    } else if (dispatchResult.status === "skipped") {
      skippedCount++;
      recipient.status = "skipped";
      recipient.last_error = dispatchResult.error || "Skipped";
      recipient.locked_at = null;
      recipient.locked_by = null;

      if (supabase) {
        try {
          await supabase
            .from("wa_campaign_recipients")
            .update({
              status: "skipped",
              last_error: recipient.last_error,
              locked_at: null,
              locked_by: null,
              updated_at: nowIso,
            })
            .eq("id", recipient.id);
        } catch {
          // Ignore
        }
      }
    } else {
      // Failed
      failedCount++;
      const canRetry = dispatchResult.isRetryable && recipient.retry_count < recipient.max_retries;

      if (canRetry) {
        recipient.status = "pending";
        recipient.retry_count = (recipient.retry_count || 0) + 1;
        recipient.last_error = dispatchResult.error || "Transient dispatch failure";
        recipient.locked_at = null;
        recipient.locked_by = null;

        if (supabase) {
          try {
            await supabase
              .from("wa_campaign_recipients")
              .update({
                status: "pending",
                retry_count: recipient.retry_count,
                last_error: recipient.last_error,
                locked_at: null,
                locked_by: null,
                updated_at: nowIso,
              })
              .eq("id", recipient.id);
          } catch {
            // Ignore
          }
        }
      } else {
        // Permanent failure
        recipient.status = "failed";
        recipient.last_error = dispatchResult.error || "Permanent dispatch failure";
        recipient.locked_at = null;
        recipient.locked_by = null;

        if (supabase) {
          try {
            await supabase
              .from("wa_campaign_recipients")
              .update({
                status: "failed",
                last_error: recipient.last_error,
                locked_at: null,
                locked_by: null,
                updated_at: nowIso,
              })
              .eq("id", recipient.id);

            await supabase
              .from("wa_campaigns")
              .update({ failed_count: (campaign?.failed_count || 0) + 1, updated_at: nowIso })
              .eq("id", campaign?.id);
          } catch {
            // Ignore
          }
        }

        campaign.failed_count = (campaign.failed_count || 0) + 1;
      }
    }
  }

  // 4. Check completion for each active campaign in this batch
  for (const [, campaign] of campaignCache) {
    if (!campaign || !["queued", "sending"].includes(campaign.status)) continue;

    let remainingPending = 0;
    if (supabase) {
      try {
        const { count } = await supabase
          .from("wa_campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .in("status", ["pending", "processing"]);

        remainingPending = count || 0;
      } catch {
        // Fallback
      }
    } else {
      remainingPending = getInMemoryRecipients().filter(
        (r) => r.campaign_id === campaign.id && ["pending", "processing"].includes(r.status)
      ).length;
    }

    if (remainingPending === 0) {
      campaign.status = "completed";
      campaign.completed_at = new Date().toISOString();
      campaign.updated_at = new Date().toISOString();

      if (supabase) {
        try {
          await supabase
            .from("wa_campaigns")
            .update({
              status: "completed",
              completed_at: campaign.completed_at,
              updated_at: campaign.updated_at,
            })
            .eq("id", campaign.id);
        } catch {
          // Ignore
        }
      }
    }
  }

  return {
    claimedCount,
    processedCount,
    sentCount,
    failedCount,
    skippedCount,
    reclaimedCount,
    errors,
  };
}
