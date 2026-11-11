import { createAdminClient } from "@/lib/supabase/admin";
import {
  WhatsAppProcessingJob,
  WhatsAppConversation,
  WhatsAppContact,
  AutomationRule,
  BusinessHoursConfig,
  AutomationSettingsConfig,
} from "@/types/database";
import { validateScheduledFollowupPreExecution } from "./safeguards";
import { sendWhatsAppTextMessage, sendWhatsAppTemplateMessage } from "@/lib/whatsapp/service";
import { processInboundAutomation } from "./dispatcher";

export interface ProcessQueueResult {
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Calculates exponential backoff with random jitter:
 * delay = (2^attempts * 30s) + (random * 5s)
 */
export function calculateBackoffDelaySeconds(attempts: number): number {
  const base = Math.pow(2, attempts) * 30;
  const jitter = Math.floor(Math.random() * 5);
  return Math.min(base + jitter, 1800); // Max 30 minutes
}

/**
 * Executes a single queue worker run.
 * Safe for serverless cron or background task execution.
 */
export async function processQueueBatch(
  batchSize: number = 10,
  workerId: string = `worker_${Date.now()}`
): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = {
    claimedCount: 0,
    processedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch (err: any) {
    result.errors.push(`Failed to initialize Supabase admin client: ${err.message}`);
    return result;
  }

  // 1. Reclaim stuck jobs locked > 5 minutes ago
  try {
    await supabase.rpc("reclaim_stuck_wa_jobs", { p_timeout_minutes: 5 });
  } catch (err: any) {
    // Non-fatal if procedure is not present
  }

  // 2. Claim pending jobs via FOR UPDATE SKIP LOCKED
  const { data: claimedJobs, error: claimErr } = await supabase.rpc("claim_next_wa_jobs", {
    p_batch_size: batchSize,
    p_worker_id: workerId,
  });

  if (claimErr) {
    result.errors.push(`Error claiming queue jobs: ${claimErr.message}`);
    return result;
  }

  if (!claimedJobs || claimedJobs.length === 0) {
    return result;
  }

  result.claimedCount = claimedJobs.length;

  for (const rawJob of claimedJobs) {
    const job = rawJob as WhatsAppProcessingJob;
    result.processedCount++;

    try {
      const outcome = await processSingleJob(supabase, job);
      if (outcome.status === "success") {
        result.succeededCount++;
        await supabase
          .from("wa_processing_jobs")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } else if (outcome.status === "skipped") {
        result.skippedCount++;
        await supabase
          .from("wa_processing_jobs")
          .update({
            status: "completed",
            last_error: `Skipped: ${outcome.reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } else {
        // Retryable failure
        result.failedCount++;
        const nextAttempts = job.attempts + 1;
        if (nextAttempts >= job.max_attempts) {
          await supabase
            .from("wa_processing_jobs")
            .update({
              status: "failed",
              attempts: nextAttempts,
              last_error: outcome.reason || "Max retry attempts exhausted",
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        } else {
          const delaySec = calculateBackoffDelaySeconds(nextAttempts);
          const nextScheduledAt = new Date(Date.now() + delaySec * 1000).toISOString();
          await supabase
            .from("wa_processing_jobs")
            .update({
              status: "pending",
              attempts: nextAttempts,
              scheduled_at: nextScheduledAt,
              locked_at: null,
              locked_by: null,
              last_error: outcome.reason,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }
      }
    } catch (err: any) {
      result.failedCount++;
      result.errors.push(`Job ${job.id} exception: ${err.message}`);
      await supabase
        .from("wa_processing_jobs")
        .update({
          status: job.attempts + 1 >= job.max_attempts ? "failed" : "pending",
          attempts: job.attempts + 1,
          last_error: err.message,
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  return result;
}

/**
 * Processes a single claimed job.
 */
async function processSingleJob(
  supabase: any,
  job: WhatsAppProcessingJob
): Promise<{ status: "success" | "skipped" | "failed"; reason?: string }> {
  const payload = job.payload || {};

  // Handle Inbound Webhook Automation Rule Evaluation (Decoupled Phase 7.5)
  if (
    job.job_type === "evaluate_automation_rules" ||
    job.job_type === "evaluate_rules" ||
    job.job_type === "process_webhook_event"
  ) {
    const conversationId = (payload.conversation_id as string) || "";
    const contactId = (payload.contact_id as string) || "";
    const messageId = (payload.message_id as string) || "";
    const messageContent = (payload.message_content as string) || "";
    const messageType = (payload.message_type as string) || "text";

    if (!conversationId || !contactId) {
      return { status: "skipped", reason: "Missing conversation_id or contact_id in job payload" };
    }

    // Strict Tenant Ownership Check before running dispatcher
    const [{ data: conv }, { data: contact }] = await Promise.all([
      supabase.from("wa_conversations").select("id, business_id").eq("id", conversationId).single(),
      supabase.from("wa_contacts").select("id, business_id").eq("id", contactId).single(),
    ]);

    if (!conv || !contact) {
      return { status: "skipped", reason: "Conversation or contact not found in database" };
    }

    if (conv.business_id !== job.business_id || contact.business_id !== job.business_id) {
      return { status: "failed", reason: "Security violation: Cross-tenant ID mismatch in job evaluation" };
    }

    try {
      // If incoming message contains media, retrieve and persist to private storage
      if (["image", "document", "audio", "video"].includes(messageType) && messageId) {
        try {
          const { retrieveAndPersistInboundMedia } = await import("@/lib/whatsapp/media-fetcher");
          await retrieveAndPersistInboundMedia(job.business_id, messageId, {
            supabaseClient: supabase,
          });
        } catch (mediaErr: any) {
          console.warn("[Inbound Media Auto-Retrieval]:", mediaErr?.message || mediaErr);
        }
      }

      await processInboundAutomation(supabase, {
        businessId: job.business_id,
        connectionId: job.connection_id || "",
        conversationId,
        contactId,
        messageId,
        messageContent,
        messageType,
      });
      return { status: "success" };
    } catch (err: any) {
      return { status: "failed", reason: err?.message || "Error evaluating automation rules" };
    }
  }

  // Dedicated Incoming Media Download Job
  if (job.job_type === "download_inbound_media") {
    const messageId = (payload.message_id as string) || "";
    if (!messageId) {
      return { status: "skipped", reason: "Missing message_id in download_inbound_media payload" };
    }
    const { retrieveAndPersistInboundMedia } = await import("@/lib/whatsapp/media-fetcher");
    const mediaRes = await retrieveAndPersistInboundMedia(job.business_id, messageId, {
      supabaseClient: supabase,
    });
    if (!mediaRes.success && !mediaRes.alreadyDownloaded) {
      return { status: "failed", reason: mediaRes.error };
    }
    return { status: "success" };
  }

  // Durable Campaign Processing Job
  if (job.job_type === "process_campaign") {
    const { processCampaignsBatch } = await import("@/lib/campaigns/worker");
    const campRes = await processCampaignsBatch({
      workerId: `queue_${job.id}`,
      supabaseClient: supabase,
    });
    if (campRes.errors.length > 0 && campRes.processedCount === 0) {
      return { status: "failed", reason: campRes.errors.join("; ") };
    }
    return { status: "success" };
  }

  if (job.job_type === "scheduled_followup") {
    const conversationId = payload.conversation_id as string;
    const contactId = payload.contact_id as string;
    const ruleId = payload.rule_id as string;

    // Fetch live state for 7-Point Pre-Execution Validation Gate
    const [{ data: conversation }, { data: contact }, { data: rule }, { data: settingsRow }] = await Promise.all([
      supabase.from("wa_conversations").select("*").eq("id", conversationId).single(),
      supabase.from("wa_contacts").select("*").eq("id", contactId).single(),
      ruleId ? supabase.from("wa_automation_rules").select("*").eq("id", ruleId).single() : { data: null },
      supabase.from("business_settings").select("automation_settings, business_hours").eq("business_id", job.business_id).single(),
    ]);

    if (!conversation || !contact) {
      return { status: "skipped", reason: "Conversation or contact record not found" };
    }

    const validation = validateScheduledFollowupPreExecution({
      job,
      conversation,
      contact,
      rule,
      automationSettings: settingsRow?.automation_settings,
    });

    if (!validation.isValid) {
      // Record skip in execution logs
      await supabase.from("wa_automation_execution_logs").insert({
        business_id: job.business_id,
        rule_id: ruleId || null,
        connection_id: conversation.connection_id,
        conversation_id: conversation.id,
        contact_id: contact.id,
        trigger_matched: "scheduled_followup",
        status: "skipped",
        skip_reason: validation.reason,
      });

      return { status: "skipped", reason: validation.reason };
    }

    // Dispatch scheduled message
    const actionType = (payload.action_type as string) || "send_text_message";
    const textBody = (payload.message_text as string) || (payload.content as string) || "";
    const templateName = payload.template_name as string;

    if (actionType === "send_text_message") {
      const sendRes = await sendWhatsAppTextMessage(
        conversation.connection_id,
        contact.phone_number,
        textBody,
        job.business_id
      );

      if (!sendRes.success) {
        return { status: "failed", reason: sendRes.error };
      }
    } else if (actionType === "send_template_message" && templateName) {
      const templateLang = (payload.template_language as string) || "en";
      const sendRes = await sendWhatsAppTemplateMessage(
        conversation.connection_id,
        contact.phone_number,
        templateName,
        templateLang,
        [],
        job.business_id
      );

      if (!sendRes.success) {
        return { status: "failed", reason: sendRes.error };
      }
    }

    // Record success in execution logs
    await supabase.from("wa_automation_execution_logs").insert({
      business_id: job.business_id,
      rule_id: ruleId || null,
      connection_id: conversation.connection_id,
      conversation_id: conversation.id,
      contact_id: contact.id,
      trigger_matched: "scheduled_followup",
      actions_executed: [payload],
      status: "success",
    });

    return { status: "success" };
  }

  // Handle send_outbound_message or send_message
  if (job.job_type === "send_outbound_message" || job.job_type === "send_message") {
    const connectionId = (payload.connection_id as string) || job.connection_id;
    const recipientPhone = payload.recipient_phone as string;
    const content = payload.content as string;
    const templateName = payload.template_name as string;

    if (!connectionId || !recipientPhone) {
      return { status: "skipped", reason: "Missing connection_id or recipient_phone in payload" };
    }

    if (templateName) {
      const sendRes = await sendWhatsAppTemplateMessage(
        connectionId,
        recipientPhone,
        templateName,
        (payload.template_language as string) || "en",
        [],
        job.business_id
      );
      if (!sendRes.success) {
        return { status: "failed", reason: sendRes.error };
      }
    } else {
      const sendRes = await sendWhatsAppTextMessage(
        connectionId,
        recipientPhone,
        content,
        job.business_id
      );
      if (!sendRes.success) {
        return { status: "failed", reason: sendRes.error };
      }
    }

    return { status: "success" };
  }

  return { status: "skipped", reason: `Unsupported job_type: ${job.job_type}` };
}
