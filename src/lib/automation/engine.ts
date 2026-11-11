import {
  AutomationRule,
  RuleCondition,
  RuleAction,
  WhatsAppContact,
  WhatsAppConversation,
  WhatsAppMessage,
  BusinessHoursConfig,
  AutomationSettingsConfig,
  AutomationExecutionLog,
} from "@/types/database";
import {
  normalizeText,
  matchExact,
  matchContains,
  matchStartsWith,
  matchRegex,
} from "./normalizer";
import { evaluateBusinessHours } from "./business-hours";
import {
  validateMetaMessagingWindow,
  validateContactConsent,
  checkBotLoopCircuitBreaker,
} from "./safeguards";

export interface EvaluationInput {
  message: {
    id?: string;
    direction: "inbound" | "outbound";
    content: string;
    message_type?: string;
    created_at?: string;
  };
  contact: WhatsAppContact;
  conversation: WhatsAppConversation;
  businessId: string;
  connectionId: string;
  rules: AutomationRule[];
  businessHours?: BusinessHoursConfig;
  automationSettings?: AutomationSettingsConfig;
  now?: Date;
  isDryRun?: boolean;
}

export interface DispatchedAction {
  action_type: string;
  payload: Record<string, unknown>;
  delay_seconds: number;
  scheduled_at?: string;
}

export interface EvaluationResult {
  matched: boolean;
  ruleId?: string;
  ruleName?: string;
  triggerType?: string;
  status: "success" | "skipped" | "delayed" | "circuit_breaker_tripped" | "opt_out_handled" | "human_handover_handled" | "no_match";
  skipReason?: string;
  actionsToDispatch: DispatchedAction[];
  conditionsSnapshot: Array<{
    condition_id?: string;
    condition_group: number;
    type: string;
    matched: boolean;
  }>;
  conversationUpdates?: Partial<WhatsAppConversation>;
  contactUpdates?: Partial<WhatsAppContact>;
  executionLog?: Partial<AutomationExecutionLog>;
  latencyMs: number;
}

const DEFAULT_OPT_OUT_KEYWORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "நிறுத்து"];
const DEFAULT_OPT_IN_KEYWORDS = ["START", "UNSTOP", "JOIN", "தொடங்கு"];
const DEFAULT_HANDOVER_KEYWORDS = ["AGENT", "HUMAN", "REPRESENTATIVE", "0", "உதவி", "மனிதர்"];

const OPT_OUT_CONFIRMATION_TEXT = "You have successfully unsubscribed from Gokul Connect messages. Reply START to resubscribe.";
const OPT_IN_CONFIRMATION_TEXT = "Welcome back! You have successfully resubscribed to Gokul Connect messages.";
const HANDOVER_CONFIRMATION_TEXT = "Our coordinator will join this chat shortly. Office hours: 9 AM - 6 PM IST.";

/**
 * 100% Deterministic Rule Evaluation Engine (Zero AI model dependencies).
 */
export function evaluateAutomationRules(input: EvaluationInput): EvaluationResult {
  const startTime = Date.now();
  const now = input.now || new Date();
  const text = input.message.content || "";
  const optOutKeywords = input.automationSettings?.opt_out_keywords || DEFAULT_OPT_OUT_KEYWORDS;
  const optInKeywords = input.automationSettings?.opt_in_keywords || DEFAULT_OPT_IN_KEYWORDS;
  const handoverKeywords = input.automationSettings?.human_handover_keywords || DEFAULT_HANDOVER_KEYWORDS;

  // SAFEGUARD 1: Outbound Direction Guard
  // Automated rules NEVER trigger from outbound messages.
  if (input.message.direction !== "inbound") {
    return {
      matched: false,
      status: "skipped",
      skipReason: "outbound_message_ignored",
      actionsToDispatch: [],
      conditionsSnapshot: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // SAFEGUARD 2: Opt-In Handling (Resubscribe)
  if (input.contact.is_opted_out) {
    const isOptIn = matchExact(text, optInKeywords, { caseSensitive: false });
    if (isOptIn) {
      return {
        matched: true,
        status: "opt_out_handled",
        actionsToDispatch: [
          {
            action_type: "send_text_message",
            payload: { message_text: OPT_IN_CONFIRMATION_TEXT },
            delay_seconds: 0,
          },
        ],
        contactUpdates: {
          is_opted_out: false,
          opted_out_at: null,
          opted_out_reason: null,
        },
        conditionsSnapshot: [],
        latencyMs: Date.now() - startTime,
      };
    }

    // Contact is opted out and message is NOT an opt-in keyword -> Halt completely.
    return {
      matched: false,
      status: "skipped",
      skipReason: "contact_opted_out",
      actionsToDispatch: [],
      conditionsSnapshot: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // SAFEGUARD 3: Opt-Out Handling (Unsubscribe)
  const isOptOut = matchExact(text, optOutKeywords, { caseSensitive: false });
  if (isOptOut) {
    return {
      matched: true,
      status: "opt_out_handled",
      actionsToDispatch: [
        {
          action_type: "send_text_message",
          payload: { message_text: OPT_OUT_CONFIRMATION_TEXT },
          delay_seconds: 0,
        },
      ],
      contactUpdates: {
        is_opted_out: true,
        consent_status: "opted_out",
        opted_out_at: now.toISOString(),
        opted_out_reason: `User sent opt-out keyword: ${text.trim()}`,
      },
      conditionsSnapshot: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // SAFEGUARD 4: Human Agent Handover Request
  const isHandover = matchExact(text, handoverKeywords, { caseSensitive: false });
  if (isHandover) {
    return {
      matched: true,
      status: "human_handover_handled",
      actionsToDispatch: [
        {
          action_type: "send_text_message",
          payload: { message_text: HANDOVER_CONFIRMATION_TEXT },
          delay_seconds: 0,
        },
      ],
      conversationUpdates: {
        status: "pending_human",
        is_automation_paused: true,
      },
      conditionsSnapshot: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // SAFEGUARD 5: Active Agent Takeover / Pause Guard
  // If thread is already in 'pending_human' or paused, suppress bot replies
  if (input.conversation.status === "pending_human" || input.conversation.is_automation_paused) {
    return {
      matched: false,
      status: "skipped",
      skipReason: "human_agent_active_or_paused",
      actionsToDispatch: [],
      conditionsSnapshot: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // SAFEGUARD 6: Bot-to-Bot Loop Velocity Circuit Breaker
  const maxCircuitBreakerReplies = input.automationSettings?.circuit_breaker_max_replies_15m || 5;
  const circuitBreaker = checkBotLoopCircuitBreaker(input.conversation, maxCircuitBreakerReplies, now);
  if (circuitBreaker.tripped) {
    return {
      matched: false,
      status: "circuit_breaker_tripped",
      skipReason: circuitBreaker.reason,
      actionsToDispatch: [],
      conditionsSnapshot: [],
      conversationUpdates: {
        is_automation_paused: true,
        status: "pending_human",
      },
      latencyMs: Date.now() - startTime,
    };
  }

  // SAFEGUARD 7: Global Workspace Automation Switch
  // Mandated: "Do not activate live automations until separately approved"
  if (!input.isDryRun && input.automationSettings?.is_automation_enabled === false) {
    return {
      matched: false,
      status: "skipped",
      skipReason: "workspace_automation_disabled",
      actionsToDispatch: [],
      conditionsSnapshot: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // Evaluate Business Hours
  const hoursEval = evaluateBusinessHours(now, input.businessHours);

  // Filter and sort eligible rules
  // Strict tenant isolation: rules must match input.businessId
  // Also filter connection: rule.connection_id null OR matches input.connectionId
  const eligibleRules = (input.rules || [])
    .filter((r) => r.business_id === input.businessId)
    .filter((r) => input.isDryRun ? true : r.is_active)
    .filter((r) => !r.connection_id || r.connection_id === input.connectionId)
    .sort((a, b) => a.priority - b.priority);

  // Evaluate rules in ascending priority order
  for (const rule of eligibleRules) {
    // Check Rule Cooldown
    // (If contact received welcome within 30 days, or cooldown_seconds > 0)
    if (rule.trigger_type === "first_inbound_message") {
      const lastWelcome = input.contact.last_welcome_sent_at ? new Date(input.contact.last_welcome_sent_at).getTime() : 0;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (lastWelcome > 0 && now.getTime() - lastWelcome < thirtyDaysMs) {
        continue; // Welcome cooldown active
      }
    }

    // Check Trigger Compatibility
    let triggerMatches = false;
    switch (rule.trigger_type) {
      case "inbound_message":
        triggerMatches = true;
        break;
      case "first_inbound_message":
        triggerMatches = (input.contact.total_inbound_count || 1) <= 1;
        break;
      case "keyword_match":
        triggerMatches = true; // Detailed evaluation via conditions
        break;
      case "inside_business_hours":
        triggerMatches = hoursEval.isWithinHours;
        break;
      case "outside_business_hours":
        triggerMatches = !hoursEval.isWithinHours;
        break;
      case "customer_enquiry":
        triggerMatches = true;
        break;
      default:
        triggerMatches = true;
    }

    if (!triggerMatches) {
      continue;
    }

    // Evaluate Condition Groups (AND within group, OR across groups)
    const conditions = rule.conditions || [];
    const conditionSnapshots: Array<{ condition_id?: string; condition_group: number; type: string; matched: boolean }> = [];

    let ruleMatches = false;

    if (conditions.length === 0) {
      // Rule with no specific conditions matches if trigger matched
      ruleMatches = true;
    } else {
      // Group conditions by condition_group
      const groupsMap = new Map<number, RuleCondition[]>();
      for (const cond of conditions) {
        const group = cond.condition_group ?? 0;
        if (!groupsMap.has(group)) {
          groupsMap.set(group, []);
        }
        groupsMap.get(group)!.push(cond);
      }

      // Check if ANY group evaluates to TRUE
      for (const [groupNum, condList] of groupsMap.entries()) {
        let groupPassed = true;

        for (const cond of condList) {
          const condMatched = evaluateSingleCondition(cond, text, hoursEval.isWithinHours, input);
          conditionSnapshots.push({
            condition_id: cond.id,
            condition_group: groupNum,
            type: cond.condition_type,
            matched: condMatched,
          });

          if (!condMatched) {
            groupPassed = false;
          }
        }

        if (groupPassed) {
          ruleMatches = true;
          break; // OR across groups: once any group matches, rule matches
        }
      }
    }

    if (ruleMatches) {
      // Prepare Actions
      const actionsToDispatch: DispatchedAction[] = [];
      const rawActions = (rule.actions || []).sort((a, b) => a.order_index - b.order_index);

      let contactUpdates: Partial<WhatsAppContact> | undefined;
      let conversationUpdates: Partial<WhatsAppConversation> | undefined;

      if (rule.trigger_type === "first_inbound_message") {
        contactUpdates = {
          last_welcome_sent_at: now.toISOString(),
        };
      }

      // Increment bot reply count for velocity limiter
      const nextBotCount = (input.conversation.bot_reply_count_window || 0) + 1;
      conversationUpdates = {
        ...conversationUpdates,
        bot_reply_count_window: nextBotCount,
        last_bot_reply_at: now.toISOString(),
      };

      for (const action of rawActions) {
        // Enforce 24-hour service window for immediate text messages
        if (action.delay_seconds === 0 && action.action_type === "send_text_message") {
          const windowCheck = validateMetaMessagingWindow(input.contact.last_inbound_at, action.action_type, now);
          if (!windowCheck.isValid) {
            // Cannot send free-form text outside 24h window
            continue;
          }
        }

        const scheduledAt = action.delay_seconds > 0
          ? new Date(now.getTime() + action.delay_seconds * 1000).toISOString()
          : undefined;

        actionsToDispatch.push({
          action_type: action.action_type,
          payload: action.action_payload,
          delay_seconds: action.delay_seconds || 0,
          scheduled_at: scheduledAt,
        });

        // Handle in-memory conversation updates from actions
        if (action.action_type === "update_conversation_status") {
          const newStatus = action.action_payload?.status as string;
          if (newStatus) {
            conversationUpdates = {
              ...conversationUpdates,
              status: newStatus as any,
              is_automation_paused: newStatus === "pending_human",
            };
          }
        }
      }

      const hasDelayed = actionsToDispatch.some((a) => a.delay_seconds > 0);

      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
        triggerType: rule.trigger_type,
        status: hasDelayed ? "delayed" : "success",
        actionsToDispatch,
        conditionsSnapshot: conditionSnapshots,
        conversationUpdates,
        contactUpdates,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // No rule matched
  return {
    matched: false,
    status: "no_match",
    skipReason: "no_matching_rules",
    actionsToDispatch: [],
    conditionsSnapshot: [],
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Evaluates a single rule condition deterministically.
 */
function evaluateSingleCondition(
  cond: RuleCondition,
  text: string,
  isWithinHours: boolean,
  input: EvaluationInput
): boolean {
  const matchValue = cond.match_value || {};
  const keywords = (matchValue.keywords as string[]) || (matchValue.text ? [matchValue.text as string] : []);
  const caseSensitive = Boolean(matchValue.case_sensitive);

  switch (cond.condition_type) {
    case "keyword_exact":
      return matchExact(text, keywords, { caseSensitive });

    case "keyword_contains":
      return matchContains(text, keywords, { caseSensitive });

    case "keyword_starts_with":
      return matchStartsWith(text, keywords, { caseSensitive });

    case "keyword_regex": {
      const pattern = (matchValue.pattern as string) || (keywords[0] ?? "");
      return matchRegex(text, pattern, { caseSensitive });
    }

    case "business_hours":
      return isWithinHours;

    case "outside_hours":
      return !isWithinHours;

    case "conversation_status": {
      const targetStatus = matchValue.status || "open";
      return input.conversation.status === targetStatus;
    }

    case "contact_opt_in":
      return !input.contact.is_opted_out;

    case "first_time_contact":
      return (input.contact.total_inbound_count || 1) <= 1;

    default:
      return false;
  }
}
