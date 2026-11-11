import {
  WhatsAppContact,
  WhatsAppConversation,
  AutomationRule,
  RuleAction,
  WhatsAppProcessingJob,
  AutomationSettingsConfig,
} from "@/types/database";

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  code?: string;
}

export const META_WINDOW_HOURS = 24;
export const CIRCUIT_BREAKER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_MAX_REPLIES_IN_WINDOW = 5;

/**
 * 1. Meta 24-Hour Messaging Window Validator
 * Free-form text and interactive buttons are strictly restricted to within 24h of last customer inbound message.
 * Outside 24h, only approved WhatsApp Templates can be sent.
 */
export function validateMetaMessagingWindow(
  lastInboundAt: string | null | undefined,
  actionType: string,
  now: Date = new Date()
): ValidationResult {
  if (!lastInboundAt) {
    // If contact has never messaged, free-form text cannot be sent unless it's a template
    if (actionType === "send_text_message" || actionType === "send_interactive_buttons" || actionType === "send_interactive_list") {
      return {
        isValid: false,
        code: "meta_24h_window_expired_no_inbound",
        reason: "Cannot send free-form text without prior inbound message. An approved template is required.",
      };
    }
    return { isValid: true };
  }

  const lastInboundTime = new Date(lastInboundAt).getTime();
  const elapsedMs = now.getTime() - lastInboundTime;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours >= META_WINDOW_HOURS) {
    if (actionType === "send_text_message" || actionType === "send_interactive_buttons" || actionType === "send_interactive_list") {
      return {
        isValid: false,
        code: "meta_24h_window_expired",
        reason: `Meta 24-hour customer service window expired (${elapsedHours.toFixed(1)}h elapsed). Free-form text rejected. Pre-approved WhatsApp template required.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * 2. Contact Consent / Opt-Out Validator
 * Outbound automation cannot message opted-out contacts unless explicitly resubscribed.
 */
export function validateContactConsent(contact: Partial<WhatsAppContact>): ValidationResult {
  if (contact.is_opted_out) {
    return {
      isValid: false,
      code: "contact_opted_out",
      reason: `Contact ${contact.phone_number || "unknown"} has opted out of automated messaging (${contact.opted_out_reason || "user_request"}).`,
    };
  }
  return { isValid: true };
}

/**
 * 3. Bot-to-Bot Loop Velocity Limiter (Circuit Breaker)
 * Checks if the number of automated bot replies to the same conversation exceeds limit in a 15-minute rolling window.
 */
export function checkBotLoopCircuitBreaker(
  conversation: Partial<WhatsAppConversation>,
  maxReplies: number = DEFAULT_MAX_REPLIES_IN_WINDOW,
  now: Date = new Date()
): { tripped: boolean; currentCount: number; reason?: string } {
  const lastReplyAt = conversation.last_bot_reply_at ? new Date(conversation.last_bot_reply_at).getTime() : 0;
  const elapsedMs = now.getTime() - lastReplyAt;

  let currentCount = conversation.bot_reply_count_window || 0;

  // Reset window if more than 15 minutes have passed since last bot reply
  if (elapsedMs > CIRCUIT_BREAKER_WINDOW_MS) {
    currentCount = 0;
  }

  if (currentCount >= maxReplies) {
    return {
      tripped: true,
      currentCount,
      reason: `Circuit breaker tripped: automated loop detected (${currentCount} replies within 15 minutes). Pausing bot.`,
    };
  }

  return {
    tripped: false,
    currentCount,
  };
}

/**
 * 4. Seven-Point Pre-Execution Validation Gate for Scheduled Follow-Ups
 * Executed right before an enqueued scheduled follow-up is dispatched to Meta API.
 */
export interface PreExecutionValidationContext {
  job: WhatsAppProcessingJob;
  conversation: WhatsAppConversation;
  contact: WhatsAppContact;
  rule?: AutomationRule | null;
  automationSettings?: AutomationSettingsConfig | null;
  templateStatus?: string | null;
  now?: Date;
}

export function validateScheduledFollowupPreExecution(
  ctx: PreExecutionValidationContext
): ValidationResult {
  const now = ctx.now || new Date();

  // Gate 1: Opt-Out Status Check
  if (ctx.contact.is_opted_out) {
    return {
      isValid: false,
      code: "contact_opted_out",
      reason: "Customer has opted out of messages since this follow-up was scheduled.",
    };
  }

  // Gate 2: Strict Tenant Ownership Isolation
  if (ctx.job.business_id !== ctx.conversation.business_id) {
    return {
      isValid: false,
      code: "cross_tenant_violation",
      reason: "Security exception: Job business_id does not match conversation business_id.",
    };
  }

  // Gate 3: Customer Inbound Activity Check
  // If customer replied after this job was scheduled, cancel obsolete follow-up
  const jobCreatedAt = new Date(ctx.job.created_at).getTime();
  const contactLastInbound = ctx.contact.last_inbound_at ? new Date(ctx.contact.last_inbound_at).getTime() : 0;
  if (contactLastInbound > jobCreatedAt) {
    return {
      isValid: false,
      code: "customer_already_replied",
      reason: "Customer sent an inbound message after this follow-up was scheduled. Follow-up is obsolete.",
    };
  }

  // Gate 4: Conversation Status & Human Handover Check
  if (
    ctx.conversation.status === "pending_human" ||
    ctx.conversation.status === "closed" ||
    ctx.conversation.is_automation_paused
  ) {
    return {
      isValid: false,
      code: "agent_takeover_or_paused",
      reason: `Conversation is in '${ctx.conversation.status}' or automation is paused. Suppressed automated send.`,
    };
  }

  // Gate 5: 24-Hour Service Window Compliance
  const actionType = (ctx.job.payload?.action_type as string) || "send_text_message";
  const windowCheck = validateMetaMessagingWindow(ctx.contact.last_inbound_at, actionType, now);
  if (!windowCheck.isValid) {
    return windowCheck;
  }

  // Gate 6: Workspace & Rule Active Status Check
  if (ctx.automationSettings && ctx.automationSettings.is_automation_enabled === false) {
    return {
      isValid: false,
      code: "workspace_automation_disabled",
      reason: "Workspace automations are disabled or awaiting approval.",
    };
  }

  if (ctx.rule && ctx.rule.is_active === false) {
    return {
      isValid: false,
      code: "rule_inactive",
      reason: "The automation rule that spawned this follow-up has been deactivated.",
    };
  }

  // Gate 7: Approved Template Status Check (if action is template)
  if (actionType === "send_template_message") {
    if (ctx.templateStatus && ctx.templateStatus !== "APPROVED") {
      return {
        isValid: false,
        code: "template_not_approved",
        reason: `Template is not in APPROVED status (current: ${ctx.templateStatus}).`,
      };
    }
  }

  return { isValid: true };
}
