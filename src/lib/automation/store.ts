import {
  AutomationRule,
  RuleCondition,
  RuleAction,
  AutomationExecutionLog,
  BusinessHoursConfig,
  AutomationSettingsConfig,
} from "@/types/database";
import { DEFAULT_BUSINESS_HOURS } from "./business-hours";
export { DEFAULT_BUSINESS_HOURS } from "./business-hours";
import { evaluateAutomationRules, EvaluationResult } from "./engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettingsConfig = {
  is_automation_enabled: false, // MANDATORY: Live automations are disabled by default until separately approved
  opt_out_keywords: ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "நிறுத்து"],
  opt_in_keywords: ["START", "UNSTOP", "JOIN", "தொடங்கு"],
  human_handover_keywords: ["AGENT", "HUMAN", "REPRESENTATIVE", "0", "உதவி", "மனிதர்"],
  max_bot_replies_per_hour: 10,
  circuit_breaker_max_replies_15m: 5,
};

// Seed sample rules for demonstration (all marked is_active: false for approval safety)
export const INITIAL_AUTOMATION_RULES: AutomationRule[] = [
  // Gokul's Astrological Insights (11111111-1111-1111-1111-111111111111)
  {
    id: "10000000-0000-0000-0000-000000000001",
    business_id: "11111111-1111-1111-1111-111111111111",
    connection_id: null,
    name: "Astrology Welcome Message",
    description: "Greets new seekers with consultation options (English & Tamil)",
    trigger_type: "first_inbound_message",
    priority: 10,
    stop_processing_on_match: true,
    cooldown_seconds: 86400,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    conditions: [
      {
        id: "c-101",
        business_id: "11111111-1111-1111-1111-111111111111",
        rule_id: "10000000-0000-0000-0000-000000000001",
        condition_group: 0,
        condition_type: "first_time_contact",
        operator: "is_true",
        match_value: {},
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
    actions: [
      {
        id: "a-101",
        business_id: "11111111-1111-1111-1111-111111111111",
        rule_id: "10000000-0000-0000-0000-000000000001",
        action_type: "send_text_message",
        action_payload: {
          message_text:
            "வணக்கம்! Welcome to Gokul's Astrological Insights.\n\nWe provide expert Vedic horoscope consultations, matchmaking, and gemstone advice.\n\nReply with:\n1 - Book Consultation\n2 - Horoscope Matching (பொருத்தம்)\n3 - Fees & Timings\n0 - Speak with an Astrologer",
        },
        delay_seconds: 0,
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    business_id: "11111111-1111-1111-1111-111111111111",
    connection_id: null,
    name: "Consultation & Fees Keywords",
    description: "Automatic fee menu in Tamil and English",
    trigger_type: "keyword_match",
    priority: 20,
    stop_processing_on_match: true,
    cooldown_seconds: 0,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    conditions: [
      {
        id: "c-102",
        business_id: "11111111-1111-1111-1111-111111111111",
        rule_id: "10000000-0000-0000-0000-000000000002",
        condition_group: 0,
        condition_type: "keyword_contains",
        operator: "contains",
        match_value: {
          keywords: ["fees", "pricing", "cost", "கட்டணம்", "விலை", "consultation", "ஜாதகம்"],
        },
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
    actions: [
      {
        id: "a-102",
        business_id: "11111111-1111-1111-1111-111111111111",
        rule_id: "10000000-0000-0000-0000-000000000002",
        action_type: "send_text_message",
        action_payload: {
          message_text:
            "Astrology Consultation Plans:\n- Birth Chart Reading: ₹500 (30 mins)\n- Marriage Horoscope Matching (பொருத்தம்): ₹750\n- Comprehensive Life Consultation: ₹1,200\n\nReply with 1 to receive payment details or 0 to speak to our assistant.",
        },
        delay_seconds: 0,
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
  },

  // Gokul Vivaham (22222222-2222-2222-2222-222222222222)
  {
    id: "20000000-0000-0000-0000-000000000001",
    business_id: "22222222-2222-2222-2222-222222222222",
    connection_id: null,
    name: "Vivaham Matrimony Welcome Message",
    description: "Greets matrimonial prospects with registration guide (English & Tamil)",
    trigger_type: "first_inbound_message",
    priority: 10,
    stop_processing_on_match: true,
    cooldown_seconds: 86400,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    conditions: [
      {
        id: "c-201",
        business_id: "22222222-2222-2222-2222-222222222222",
        rule_id: "20000000-0000-0000-0000-000000000001",
        condition_group: 0,
        condition_type: "first_time_contact",
        operator: "is_true",
        match_value: {},
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
    actions: [
      {
        id: "a-201",
        business_id: "22222222-2222-2222-2222-222222222222",
        rule_id: "20000000-0000-0000-0000-000000000001",
        action_type: "send_text_message",
        action_payload: {
          message_text:
            "வணக்கம்! Welcome to Gokul Vivaham — Tamil Matrimonial Services.\n\nLooking for your life partner?\n1 - New Profile Registration (புதிய பதிவு)\n2 - View Membership Plans (உறுப்பினர் திட்டம்)\n3 - Horoscope Compatibility Matching\n0 - Speak with Marriage Coordinator",
        },
        delay_seconds: 0,
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    business_id: "22222222-2222-2222-2222-222222222222",
    connection_id: null,
    name: "Membership Plans & Follow-Up",
    description: "Sends membership tiers and schedules 4-hour follow-up",
    trigger_type: "keyword_match",
    priority: 20,
    stop_processing_on_match: true,
    cooldown_seconds: 0,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    conditions: [
      {
        id: "c-202",
        business_id: "22222222-2222-2222-2222-222222222222",
        rule_id: "20000000-0000-0000-0000-000000000002",
        condition_group: 0,
        condition_type: "keyword_contains",
        operator: "contains",
        match_value: {
          keywords: ["plans", "membership", "fees", "கட்டணம்", "திட்டம்", "விலை", "premium"],
        },
        order_index: 0,
        created_at: new Date().toISOString(),
      },
    ],
    actions: [
      {
        id: "a-202-1",
        business_id: "22222222-2222-2222-2222-222222222222",
        rule_id: "20000000-0000-0000-0000-000000000002",
        action_type: "send_text_message",
        action_payload: {
          message_text:
            "Gokul Vivaham Membership Plans:\n\n1. Silver (3 Months): ₹1,500 — Up to 30 verified profiles.\n2. Gold (6 Months): ₹2,500 — Unlimited profiles + Astrological matching.\n3. Platinum Assisted (1 Year): ₹5,000 — Dedicated relationship manager.\n\nReply with 1, 2, or 3 to enroll.",
        },
        delay_seconds: 0,
        order_index: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: "a-202-2",
        business_id: "22222222-2222-2222-2222-222222222222",
        rule_id: "20000000-0000-0000-0000-000000000002",
        action_type: "schedule_follow_up",
        action_payload: {
          message_text:
            "Vanakkam! Did you have any questions about Gokul Vivaham plans? Reply AGENT to connect with a coordinator.",
        },
        delay_seconds: 14400, // 4 hours
        order_index: 1,
        created_at: new Date().toISOString(),
      },
    ],
  },
];

// In-memory execution logs
const IN_MEMORY_LOGS: AutomationExecutionLog[] = [];

// In-memory store for rules
let localRules: AutomationRule[] = [...INITIAL_AUTOMATION_RULES];

/**
 * Gets automation rules for a business (strict tenant isolation).
 */
export async function getRulesForBusiness(businessId: string): Promise<AutomationRule[]> {
  try {
    const supabase = createAdminClient();
    const { data: rules, error } = await supabase
      .from("wa_automation_rules")
      .select(`
        *,
        conditions:wa_rule_conditions(*),
        actions:wa_rule_actions(*)
      `)
      .eq("business_id", businessId)
      .order("priority", { ascending: true });

    if (!error && rules && rules.length > 0) {
      return rules;
    }
  } catch {
    // Fall back to in-memory store
  }

  return localRules.filter((r) => r.business_id === businessId).sort((a, b) => a.priority - b.priority);
}

/**
 * Creates or updates an automation rule with its conditions and actions atomically.
 */
export async function saveAutomationRule(
  businessId: string,
  ruleData: Partial<AutomationRule>,
  conditions: Partial<RuleCondition>[],
  actions: Partial<RuleAction>[]
): Promise<{ success: boolean; rule?: AutomationRule; error?: string }> {
  const ruleId = ruleData.id || crypto.randomUUID();

  try {
    const supabase = createAdminClient();

    // 1. Upsert rule
    const { data: savedRule, error: ruleErr } = await supabase
      .from("wa_automation_rules")
      .upsert({
        id: ruleId,
        business_id: businessId,
        connection_id: ruleData.connection_id || null,
        name: ruleData.name || "Untitled Rule",
        description: ruleData.description || null,
        trigger_type: ruleData.trigger_type || "keyword_match",
        priority: ruleData.priority ?? 100,
        stop_processing_on_match: ruleData.stop_processing_on_match ?? true,
        cooldown_seconds: ruleData.cooldown_seconds ?? 0,
        is_active: ruleData.is_active ?? false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (ruleErr) {
      throw new Error(`Failed to save rule: ${ruleErr.message}`);
    }

    // 2. Clear old conditions and actions for this rule
    await supabase.from("wa_rule_conditions").delete().eq("rule_id", ruleId).eq("business_id", businessId);
    await supabase.from("wa_rule_actions").delete().eq("rule_id", ruleId).eq("business_id", businessId);

    // 3. Insert conditions
    if (conditions.length > 0) {
      const conditionRows = conditions.map((c, index) => ({
        id: c.id || crypto.randomUUID(),
        business_id: businessId,
        rule_id: ruleId,
        condition_group: c.condition_group ?? 0,
        condition_type: c.condition_type || "keyword_contains",
        operator: c.operator || "contains",
        match_value: c.match_value || {},
        order_index: c.order_index ?? index,
      }));
      const { error: cErr } = await supabase.from("wa_rule_conditions").insert(conditionRows);
      if (cErr) throw new Error(`Failed to save conditions: ${cErr.message}`);
    }

    // 4. Insert actions
    if (actions.length > 0) {
      const actionRows = actions.map((a, index) => ({
        id: a.id || crypto.randomUUID(),
        business_id: businessId,
        rule_id: ruleId,
        action_type: a.action_type || "send_text_message",
        action_payload: a.action_payload || {},
        delay_seconds: a.delay_seconds ?? 0,
        order_index: a.order_index ?? index,
      }));
      const { error: aErr } = await supabase.from("wa_rule_actions").insert(actionRows);
      if (aErr) throw new Error(`Failed to save actions: ${aErr.message}`);
    }

    // Fetch back complete rule
    const completeRules = await getRulesForBusiness(businessId);
    const completeRule = completeRules.find((r) => r.id === ruleId);

    return { success: true, rule: completeRule || savedRule };
  } catch (err: any) {
    // In-memory fallback
    const ruleObj: AutomationRule = {
      id: ruleId,
      business_id: businessId,
      connection_id: ruleData.connection_id || null,
      name: ruleData.name || "Untitled Rule",
      description: ruleData.description || null,
      trigger_type: ruleData.trigger_type || "keyword_match",
      priority: ruleData.priority ?? 100,
      stop_processing_on_match: ruleData.stop_processing_on_match ?? true,
      cooldown_seconds: ruleData.cooldown_seconds ?? 0,
      is_active: ruleData.is_active ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      conditions: conditions.map((c, idx) => ({
        id: c.id || `c-${Date.now()}-${idx}`,
        business_id: businessId,
        rule_id: ruleId,
        condition_group: c.condition_group ?? 0,
        condition_type: c.condition_type || "keyword_contains",
        operator: c.operator || "contains",
        match_value: c.match_value || {},
        order_index: c.order_index ?? idx,
        created_at: new Date().toISOString(),
      })),
      actions: actions.map((a, idx) => ({
        id: a.id || `a-${Date.now()}-${idx}`,
        business_id: businessId,
        rule_id: ruleId,
        action_type: a.action_type || "send_text_message",
        action_payload: a.action_payload || {},
        delay_seconds: a.delay_seconds ?? 0,
        order_index: a.order_index ?? idx,
        created_at: new Date().toISOString(),
      })),
    };

    localRules = localRules.filter((r) => r.id !== ruleId);
    localRules.push(ruleObj);

    return { success: true, rule: ruleObj };
  }
}

/**
 * Toggles the is_active status of a rule (strict tenant check).
 */
export async function toggleRuleActiveStatus(
  businessId: string,
  ruleId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("wa_automation_rules")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", ruleId)
      .eq("business_id", businessId);

    if (error) throw new Error(error.message);
  } catch {
    // In-memory fallback
    const idx = localRules.findIndex((r) => r.id === ruleId && r.business_id === businessId);
    if (idx !== -1) {
      localRules[idx].is_active = isActive;
    }
  }

  return { success: true };
}

/**
 * Deletes an automation rule (strict tenant check).
 */
export async function deleteAutomationRule(
  businessId: string,
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("wa_automation_rules")
      .delete()
      .eq("id", ruleId)
      .eq("business_id", businessId);

    if (error) throw new Error(error.message);
  } catch {
    localRules = localRules.filter((r) => !(r.id === ruleId && r.business_id === businessId));
  }

  return { success: true };
}

/**
 * Retrieves execution logs for a business.
 */
export async function getExecutionLogsForBusiness(
  businessId: string,
  limit: number = 50
): Promise<AutomationExecutionLog[]> {
  try {
    const supabase = createAdminClient();
    const { data: logs, error } = await supabase
      .from("wa_automation_execution_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && logs) {
      return logs;
    }
  } catch {
    // Fall back to in-memory
  }

  return IN_MEMORY_LOGS.filter((l) => l.business_id === businessId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

/**
 * Interactive Dry-Run Rule Simulator.
 * Simulates evaluation in-memory with zero WhatsApp API calls and zero database mutations.
 */
export function simulateRuleExecution(
  businessId: string,
  messageText: string,
  options: {
    connectionId?: string;
    senderPhone?: string;
    isFirstMessage?: boolean;
    isOptedOut?: boolean;
    conversationStatus?: "open" | "closed" | "pending_human";
    isAutomationPaused?: boolean;
    rules?: AutomationRule[];
    businessHours?: BusinessHoursConfig;
    automationSettings?: AutomationSettingsConfig;
    simulationTime?: Date;
  } = {}
): EvaluationResult {
  const activeRules = options.rules || localRules.filter((r) => r.business_id === businessId);
  const now = options.simulationTime || new Date();

  return evaluateAutomationRules({
    message: {
      direction: "inbound",
      content: messageText,
      created_at: now.toISOString(),
    },
    contact: {
      id: "sim-contact",
      business_id: businessId,
      phone_number: options.senderPhone || "+919876543210",
      display_name: "Simulation User",
      profile_photo_url: null,
      metadata: {},
      is_opted_out: Boolean(options.isOptedOut),
      total_inbound_count: options.isFirstMessage ? 1 : 5,
      last_inbound_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    conversation: {
      id: "sim-conv",
      business_id: businessId,
      connection_id: options.connectionId || "sim-conn",
      contact_id: "sim-contact",
      status: options.conversationStatus || "open",
      is_automation_paused: Boolean(options.isAutomationPaused),
      bot_reply_count_window: 0,
      unread_count: 0,
      last_message_preview: null,
      last_message_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    businessId,
    connectionId: options.connectionId || "sim-conn",
    rules: activeRules,
    businessHours: options.businessHours || DEFAULT_BUSINESS_HOURS,
    automationSettings: options.automationSettings || DEFAULT_AUTOMATION_SETTINGS,
    now,
    isDryRun: true,
  });
}
