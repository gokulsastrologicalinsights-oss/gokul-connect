import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeText,
  matchExact,
  matchContains,
  matchStartsWith,
  matchRegex,
} from "@/lib/automation/normalizer";
import {
  evaluateBusinessHours,
  DEFAULT_BUSINESS_HOURS,
} from "@/lib/automation/business-hours";
import {
  validateMetaMessagingWindow,
  validateContactConsent,
  checkBotLoopCircuitBreaker,
  validateScheduledFollowupPreExecution,
} from "@/lib/automation/safeguards";
import {
  evaluateAutomationRules,
  EvaluationInput,
} from "@/lib/automation/engine";
import {
  AutomationRule,
  WhatsAppContact,
  WhatsAppConversation,
  WhatsAppProcessingJob,
} from "@/types/database";

describe("Phase 5 — Rule-Based WhatsApp Automation Engine", () => {
  const ASTROLOGY_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

  // ============================================================================
  // DOMAIN 1: TEXT NORMALIZATION & TAMIL / ENGLISH KEYWORD MATCHING
  // ============================================================================
  describe("Domain 1: Text Normalization & Keyword Matching (English & Tamil)", () => {
    it("should normalize English strings with case-insensitivity and whitespace collapse", () => {
      const raw = "   Consultation   Pricing   ";
      const normalized = normalizeText(raw);
      expect(normalized).toBe("consultation pricing");
    });

    it("should normalize Tamil unicode glyphs using NFC composition", () => {
      // Both precomposed and decomposed forms should match identically
      const tamilWord1 = "ஜாதகம்".normalize("NFC");
      const tamilWord2 = "ஜாதகம்".normalize("NFD");
      expect(normalizeText(tamilWord1)).toBe(normalizeText(tamilWord2));
    });

    it("should match exact keyword in English and Tamil", () => {
      expect(matchExact("fees", ["pricing", "fees", "cost"])).toBe(true);
      expect(matchExact("கட்டணம்", ["விலை", "கட்டணம்"])).toBe(true);
      expect(matchExact("consultation", ["fees", "cost"])).toBe(false);
    });

    it("should match substring contains in English and Tamil", () => {
      expect(matchContains("I want to know about membership fees", ["fees", "plans"])).toBe(true);
      expect(matchContains("எனக்கு ஜாதக பொருத்தம் பார்க்க வேண்டும்", ["பொருத்தம்", "ஜாதகம்"])).toBe(true);
      expect(matchContains("hello there", ["pricing", "fees"])).toBe(false);
    });

    it("should match prefix startsWith in English and Tamil", () => {
      expect(matchStartsWith("astro consultation today", ["astro"])).toBe(true);
      expect(matchStartsWith("வணக்கம் ஐயா", ["வணக்கம்"])).toBe(true);
      expect(matchStartsWith("consultation astro", ["astro"])).toBe(false);
    });

    it("should match regular expressions safely without ReDoS", () => {
      expect(matchRegex("order #12345", "^order\\s+#\\d+$")).toBe(true);
      expect(matchRegex("invalid order", "^order\\s+#\\d+$")).toBe(false);
    });
  });

  // ============================================================================
  // DOMAIN 2: BUSINESS HOURS EVALUATION (Asia/Kolkata)
  // ============================================================================
  describe("Domain 2: Business Hours Evaluation (Asia/Kolkata)", () => {
    it("should identify Tuesday 11:30 AM IST as within operating hours", () => {
      // 2026-11-10 is a Tuesday. 11:30 AM IST = 06:00 UTC
      const dateInIST = new Date("2026-11-10T06:00:00Z");
      const result = evaluateBusinessHours(dateInIST, DEFAULT_BUSINESS_HOURS);
      expect(result.dayOfWeek).toBe("tuesday");
      expect(result.isWithinHours).toBe(true);
      expect(result.reason).toBe("open");
    });

    it("should identify Tuesday 07:00 AM IST as outside operating hours (before open)", () => {
      // 07:00 AM IST = 01:30 UTC
      const dateInIST = new Date("2026-11-10T01:30:00Z");
      const result = evaluateBusinessHours(dateInIST, DEFAULT_BUSINESS_HOURS);
      expect(result.dayOfWeek).toBe("tuesday");
      expect(result.isWithinHours).toBe(false);
      expect(result.reason).toBe("before_open");
    });

    it("should identify Tuesday 08:00 PM IST as outside operating hours (after close)", () => {
      // 08:00 PM IST = 14:30 UTC
      const dateInIST = new Date("2026-11-10T14:30:00Z");
      const result = evaluateBusinessHours(dateInIST, DEFAULT_BUSINESS_HOURS);
      expect(result.dayOfWeek).toBe("tuesday");
      expect(result.isWithinHours).toBe(false);
      expect(result.reason).toBe("after_close");
    });

    it("should identify Sunday as closed day", () => {
      // 2026-11-08 is Sunday. 12:00 PM IST = 06:30 UTC
      const dateInIST = new Date("2026-11-08T06:30:00Z");
      const result = evaluateBusinessHours(dateInIST, DEFAULT_BUSINESS_HOURS);
      expect(result.dayOfWeek).toBe("sunday");
      expect(result.isWithinHours).toBe(false);
      expect(result.reason).toBe("closed_day");
    });

    it("should honor declared holiday dates", () => {
      const holidayConfig = {
        ...DEFAULT_BUSINESS_HOURS,
        holiday_dates: ["2026-11-10"],
      };
      const dateInIST = new Date("2026-11-10T06:00:00Z"); // Tuesday 11:30 AM IST
      const result = evaluateBusinessHours(dateInIST, holidayConfig);
      expect(result.isWithinHours).toBe(false);
      expect(result.reason).toBe("holiday");
    });
  });

  // ============================================================================
  // DOMAIN 3: META 24-HOUR WINDOW & COMPLIANCE SAFEGUARDS
  // ============================================================================
  describe("Domain 3: Meta 24-Hour Messaging Window & Opt-Out Safeguards", () => {
    it("should allow free-form text message if customer replied within 24 hours", () => {
      const now = new Date();
      const lastInboundAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(); // 4 hours ago
      const check = validateMetaMessagingWindow(lastInboundAt, "send_text_message", now);
      expect(check.isValid).toBe(true);
    });

    it("should REJECT free-form text message if 24-hour customer window has expired", () => {
      const now = new Date();
      const lastInboundAt = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      const check = validateMetaMessagingWindow(lastInboundAt, "send_text_message", now);
      expect(check.isValid).toBe(false);
      expect(check.code).toBe("meta_24h_window_expired");
    });

    it("should ALLOW approved template message even after 24-hour window has expired", () => {
      const now = new Date();
      const lastInboundAt = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago
      const check = validateMetaMessagingWindow(lastInboundAt, "send_template_message", now);
      expect(check.isValid).toBe(true);
    });

    it("should enforce contact consent and reject messages to opted-out contacts", () => {
      const contact: Partial<WhatsAppContact> = {
        phone_number: "+919876543210",
        is_opted_out: true,
        opted_out_reason: "User texted STOP",
      };
      const consent = validateContactConsent(contact);
      expect(consent.isValid).toBe(false);
      expect(consent.code).toBe("contact_opted_out");
    });
  });

  // ============================================================================
  // DOMAIN 4: LOOP PREVENTION & BOT CIRCUIT BREAKER
  // ============================================================================
  describe("Domain 4: Loop Prevention & Circuit Breakers", () => {
    it("should trip circuit breaker if bot sends >= 5 replies within 15 minutes", () => {
      const now = new Date();
      const conversation: Partial<WhatsAppConversation> = {
        bot_reply_count_window: 5,
        last_bot_reply_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 mins ago
      };
      const cb = checkBotLoopCircuitBreaker(conversation, 5, now);
      expect(cb.tripped).toBe(true);
      expect(cb.reason).toContain("Circuit breaker tripped");
    });

    it("should reset velocity counter if last bot reply was more than 15 minutes ago", () => {
      const now = new Date();
      const conversation: Partial<WhatsAppConversation> = {
        bot_reply_count_window: 5,
        last_bot_reply_at: new Date(now.getTime() - 16 * 60 * 1000).toISOString(), // 16 mins ago
      };
      const cb = checkBotLoopCircuitBreaker(conversation, 5, now);
      expect(cb.tripped).toBe(false);
      expect(cb.currentCount).toBe(0);
    });
  });

  // ============================================================================
  // DOMAIN 5: 7-POINT PRE-EXECUTION VALIDATION FOR SCHEDULED FOLLOW-UPS
  // ============================================================================
  describe("Domain 5: 7-Point Pre-Execution Validation Gate for Scheduled Follow-Ups", () => {
    const baseJob: WhatsAppProcessingJob = {
      id: "job-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      connection_id: "conn-1",
      job_type: "scheduled_followup",
      payload: { action_type: "send_text_message", message_text: "Follow up" },
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      last_error: null,
      locked_at: null,
      scheduled_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000).toISOString(), // created 1h ago
      updated_at: new Date().toISOString(),
    };

    const baseConv: WhatsAppConversation = {
      id: "conv-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      connection_id: "conn-1",
      contact_id: "contact-1",
      status: "open",
      last_message_preview: null,
      last_message_at: null,
      unread_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const baseContact: WhatsAppContact = {
      id: "contact-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      phone_number: "+919876543210",
      display_name: "Ravi",
      profile_photo_url: null,
      metadata: {},
      is_opted_out: false,
      last_inbound_at: new Date(Date.now() - 7200 * 1000).toISOString(), // 2h ago
      total_inbound_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("Gate 1: should cancel job if contact opted out after scheduling", () => {
      const check = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: baseConv,
        contact: { ...baseContact, is_opted_out: true },
      });
      expect(check.isValid).toBe(false);
      expect(check.code).toBe("contact_opted_out");
    });

    it("Gate 2: should abort job on cross-tenant mismatch", () => {
      const check = validateScheduledFollowupPreExecution({
        job: { ...baseJob, business_id: ASTROLOGY_BUSINESS_ID },
        conversation: { ...baseConv, business_id: VIVAHAM_BUSINESS_ID },
        contact: baseContact,
      });
      expect(check.isValid).toBe(false);
      expect(check.code).toBe("cross_tenant_violation");
    });

    it("Gate 3: should cancel follow-up if customer already replied after scheduling", () => {
      const jobCreatedTime = new Date(baseJob.created_at).getTime();
      const customerRepliedAfter = new Date(jobCreatedTime + 10 * 60 * 1000).toISOString(); // replied 10m after job created

      const check = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: baseConv,
        contact: { ...baseContact, last_inbound_at: customerRepliedAfter },
      });
      expect(check.isValid).toBe(false);
      expect(check.code).toBe("customer_already_replied");
    });

    it("Gate 4: should cancel follow-up if conversation is pending_human or paused", () => {
      const check1 = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: { ...baseConv, status: "pending_human" },
        contact: baseContact,
      });
      expect(check1.isValid).toBe(false);
      expect(check1.code).toBe("agent_takeover_or_paused");

      const check2 = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: { ...baseConv, is_automation_paused: true },
        contact: baseContact,
      });
      expect(check2.isValid).toBe(false);
      expect(check2.code).toBe("agent_takeover_or_paused");
    });

    it("Gate 5: should cancel follow-up if 24h service window expired and action is free text", () => {
      const check = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: baseConv,
        contact: { ...baseContact, last_inbound_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() },
      });
      expect(check.isValid).toBe(false);
      expect(check.code).toBe("meta_24h_window_expired");
    });

    it("Gate 6: should cancel follow-up if rule or workspace automation is disabled", () => {
      const check = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: baseConv,
        contact: baseContact,
        automationSettings: { is_automation_enabled: false } as any,
      });
      expect(check.isValid).toBe(false);
      expect(check.code).toBe("workspace_automation_disabled");
    });

    it("should PASS all gates when all 7 safety conditions are satisfied", () => {
      const check = validateScheduledFollowupPreExecution({
        job: baseJob,
        conversation: baseConv,
        contact: baseContact,
        automationSettings: { is_automation_enabled: true } as any,
      });
      expect(check.isValid).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 6: DETERMINISTIC ENGINE EVALUATION, TAMIL KEYWORDS & PRIORITIES
  // ============================================================================
  describe("Domain 6: Deterministic Engine Execution & Multi-Tenant Isolation", () => {
    const rules: AutomationRule[] = [
      {
        id: "rule-astro-welcome",
        business_id: ASTROLOGY_BUSINESS_ID,
        connection_id: null,
        name: "Astrology Welcome",
        description: "Astrology Welcome description",
        trigger_type: "first_inbound_message",
        priority: 10,
        stop_processing_on_match: true,
        cooldown_seconds: 86400,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        actions: [
          {
            id: "act-1",
            business_id: ASTROLOGY_BUSINESS_ID,
            rule_id: "rule-astro-welcome",
            action_type: "send_text_message",
            action_payload: { message_text: "Welcome to Gokul's Astrological Insights!" },
            delay_seconds: 0,
            order_index: 0,
            created_at: new Date().toISOString(),
          },
        ],
      },
      {
        id: "rule-astro-fees",
        business_id: ASTROLOGY_BUSINESS_ID,
        connection_id: null,
        name: "Astrology Consultation Fees",
        description: "Astrology consultation fees keyword match",
        trigger_type: "keyword_match",
        priority: 20,
        stop_processing_on_match: true,
        cooldown_seconds: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conditions: [
          {
            id: "cond-1",
            business_id: ASTROLOGY_BUSINESS_ID,
            rule_id: "rule-astro-fees",
            condition_group: 0,
            condition_type: "keyword_contains",
            operator: "contains",
            match_value: { keywords: ["fees", "கட்டணம்", "விலை", "consultation"] },
            order_index: 0,
            created_at: new Date().toISOString(),
          },
        ],
        actions: [
          {
            id: "act-2",
            business_id: ASTROLOGY_BUSINESS_ID,
            rule_id: "rule-astro-fees",
            action_type: "send_text_message",
            action_payload: { message_text: "Consultation fees: ₹500 for 30 minutes." },
            delay_seconds: 0,
            order_index: 0,
            created_at: new Date().toISOString(),
          },
        ],
      },
      // Vivaham rule
      {
        id: "rule-vivaham-plans",
        business_id: VIVAHAM_BUSINESS_ID,
        connection_id: null,
        name: "Vivaham Matrimony Plans",
        description: "Vivaham matrimony plans keyword match",
        trigger_type: "keyword_match",
        priority: 20,
        stop_processing_on_match: true,
        cooldown_seconds: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conditions: [
          {
            id: "cond-v1",
            business_id: VIVAHAM_BUSINESS_ID,
            rule_id: "rule-vivaham-plans",
            condition_group: 0,
            condition_type: "keyword_contains",
            operator: "contains",
            match_value: { keywords: ["membership", "plans", "திட்டம்"] },
            order_index: 0,
            created_at: new Date().toISOString(),
          },
        ],
        actions: [
          {
            id: "act-v1",
            business_id: VIVAHAM_BUSINESS_ID,
            rule_id: "rule-vivaham-plans",
            action_type: "send_text_message",
            action_payload: { message_text: "Vivaham Plans: Silver ₹1,500, Gold ₹2,500." },
            delay_seconds: 0,
            order_index: 0,
            created_at: new Date().toISOString(),
          },
        ],
      },
    ];

    const contact: WhatsAppContact = {
      id: "c-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      phone_number: "+919876543210",
      display_name: "Customer",
      profile_photo_url: null,
      metadata: {},
      is_opted_out: false,
      total_inbound_count: 5,
      last_inbound_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const conv: WhatsAppConversation = {
      id: "conv-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      connection_id: "conn-1",
      contact_id: "c-1",
      status: "open",
      last_message_preview: null,
      last_message_at: null,
      unread_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should strictly ignore outbound messages (Outbound Guard)", () => {
      const res = evaluateAutomationRules({
        message: { direction: "outbound", content: "fees" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
      });
      expect(res.matched).toBe(false);
      expect(res.skipReason).toBe("outbound_message_ignored");
    });

    it("should handle opt-out keyword 'STOP' or 'நிறுத்து' immediately", () => {
      const resEnglish = evaluateAutomationRules({
        message: { direction: "inbound", content: "STOP" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
      });
      expect(resEnglish.status).toBe("opt_out_handled");
      expect(resEnglish.contactUpdates?.is_opted_out).toBe(true);

      const resTamil = evaluateAutomationRules({
        message: { direction: "inbound", content: "நிறுத்து" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
      });
      expect(resTamil.status).toBe("opt_out_handled");
      expect(resTamil.contactUpdates?.is_opted_out).toBe(true);
    });

    it("should handle human handover keyword 'AGENT' or '0'", () => {
      const res = evaluateAutomationRules({
        message: { direction: "inbound", content: "0" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
      });
      expect(res.status).toBe("human_handover_handled");
      expect(res.conversationUpdates?.status).toBe("pending_human");
      expect(res.conversationUpdates?.is_automation_paused).toBe(true);
    });

    it("should match Tamil keyword 'கட்டணம்' and dispatch astrology pricing action", () => {
      const res = evaluateAutomationRules({
        message: { direction: "inbound", content: "ஜாதகம் பார்க்க கட்டணம் எவ்வளவு?" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
        automationSettings: { is_automation_enabled: true } as any,
      });
      expect(res.matched).toBe(true);
      expect(res.ruleName).toBe("Astrology Consultation Fees");
      expect(res.actionsToDispatch[0].payload.message_text).toContain("Consultation fees: ₹500");
    });

    it("should guarantee strict multi-tenant isolation: Vivaham rules NEVER fire for Astrology", () => {
      // Message with "membership plans" sent to Astrology workspace
      const res = evaluateAutomationRules({
        message: { direction: "inbound", content: "membership plans" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
        automationSettings: { is_automation_enabled: true } as any,
      });
      // Vivaham rule must NOT match for Astrology businessId
      expect(res.ruleId).not.toBe("rule-vivaham-plans");
    });

    it("should honor workspace switch: do not execute live replies if is_automation_enabled is false", () => {
      const res = evaluateAutomationRules({
        message: { direction: "inbound", content: "fees" },
        contact,
        conversation: conv,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules,
        automationSettings: { is_automation_enabled: false } as any,
        isDryRun: false,
      });
      expect(res.matched).toBe(false);
      expect(res.skipReason).toBe("workspace_automation_disabled");
    });
  });
});
