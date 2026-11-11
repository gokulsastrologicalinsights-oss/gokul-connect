import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateAutomationRules, EvaluationInput } from "@/lib/automation/engine";
import { INITIAL_AUTOMATION_RULES, DEFAULT_AUTOMATION_SETTINGS, DEFAULT_BUSINESS_HOURS } from "@/lib/automation/store";
import { WhatsAppContact, WhatsAppConversation, AutomationRule } from "@/types/database";

describe("Phase 8.2 — Welcome Cooldown Unit Test (Gokul Vivaham 30-Day Cooldown)", () => {
  const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";
  const VIVAHAM_CONNECTION_ID = "conn-vivaham-01";
  const EVAL_TIMESTAMP = new Date("2026-11-07T12:00:00.000Z");
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 2,592,000,000 ms

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create synthetic conversation
  function createSyntheticConversation(contactId: string): WhatsAppConversation {
    return {
      id: "conv-synthetic-01",
      business_id: VIVAHAM_BUSINESS_ID,
      connection_id: VIVAHAM_CONNECTION_ID,
      contact_id: contactId,
      status: "open",
      is_automation_paused: false,
      bot_reply_count_window: 0,
      unread_count: 0,
      last_message_preview: null,
      last_message_at: null,
      created_at: EVAL_TIMESTAMP.toISOString(),
      updated_at: EVAL_TIMESTAMP.toISOString(),
    };
  }

  // Helper to create synthetic contact
  function createSyntheticContact(overrides: Partial<WhatsAppContact> = {}): WhatsAppContact {
    return {
      id: "contact-synthetic-01",
      business_id: VIVAHAM_BUSINESS_ID,
      phone_number: "+919876543210",
      display_name: "Synthetic Prospect",
      profile_photo_url: null,
      metadata: {},
      is_opted_out: false,
      total_inbound_count: 1,
      last_inbound_at: EVAL_TIMESTAMP.toISOString(),
      last_welcome_sent_at: null,
      created_at: EVAL_TIMESTAMP.toISOString(),
      updated_at: EVAL_TIMESTAMP.toISOString(),
      ...overrides,
    };
  }

  // Helper to create evaluation input
  function createEvaluationInput(
    contact: WhatsAppContact,
    rule: AutomationRule,
    overrides: Partial<EvaluationInput> = {}
  ): EvaluationInput {
    return {
      message: {
        id: "msg-inbound-01",
        direction: "inbound",
        content: "வணக்கம்! Looking for matrimonial details",
        message_type: "text",
        created_at: EVAL_TIMESTAMP.toISOString(),
      },
      contact,
      conversation: createSyntheticConversation(contact.id),
      businessId: VIVAHAM_BUSINESS_ID,
      connectionId: VIVAHAM_CONNECTION_ID,
      rules: [rule],
      businessHours: DEFAULT_BUSINESS_HOURS,
      automationSettings: DEFAULT_AUTOMATION_SETTINGS,
      now: EVAL_TIMESTAMP,
      isDryRun: true,
      ...overrides,
    };
  }

  // ============================================================================
  // REQUIREMENT 1: Actual Gokul Vivaham Welcome Rule Verification
  // ============================================================================
  it("Requirement 1: should load the actual Gokul Vivaham welcome rule without mutating production configuration", () => {
    const vivahamWelcomeRule = INITIAL_AUTOMATION_RULES.find(
      (r) => r.business_id === VIVAHAM_BUSINESS_ID && r.trigger_type === "first_inbound_message"
    );

    expect(vivahamWelcomeRule).toBeDefined();
    expect(vivahamWelcomeRule?.id).toBe("20000000-0000-0000-0000-000000000001");
    expect(vivahamWelcomeRule?.name).toBe("Vivaham Matrimony Welcome Message");
    expect(vivahamWelcomeRule?.trigger_type).toBe("first_inbound_message");
    expect(vivahamWelcomeRule?.business_id).toBe(VIVAHAM_BUSINESS_ID);
    // Inactive by default in production store for approval safety — dry run handles this safely
    expect(vivahamWelcomeRule?.is_active).toBe(false);

    // Verify conditions and actions structure
    expect(vivahamWelcomeRule?.conditions).toBeDefined();
    expect(vivahamWelcomeRule?.conditions?.length).toBeGreaterThan(0);
    expect(vivahamWelcomeRule?.conditions?.[0].condition_type).toBe("first_time_contact");

    expect(vivahamWelcomeRule?.actions).toBeDefined();
    expect(vivahamWelcomeRule?.actions?.length).toBeGreaterThan(0);
    expect(vivahamWelcomeRule?.actions?.[0].action_type).toBe("send_text_message");
    expect((vivahamWelcomeRule?.actions?.[0].action_payload as any)?.message_text).toContain("Gokul Vivaham");
  });

  // ============================================================================
  // REQUIREMENTS 2 & 3: Synthetic Contact with Welcome Sent 30 Minutes Ago (Suppressed)
  // ============================================================================
  it("Requirements 2 & 3: should suppress welcome rule when contact received welcome 30 minutes before evaluation", () => {
    const vivahamWelcomeRule = INITIAL_AUTOMATION_RULES.find(
      (r) => r.business_id === VIVAHAM_BUSINESS_ID && r.trigger_type === "first_inbound_message"
    )!;

    // Contact received welcome 30 minutes prior to EVAL_TIMESTAMP
    const thirtyMinutesAgo = new Date(EVAL_TIMESTAMP.getTime() - 30 * 60 * 1000).toISOString();
    const contact = createSyntheticContact({
      id: "contact-welcome-30m-ago",
      last_welcome_sent_at: thirtyMinutesAgo,
      total_inbound_count: 1,
    });

    const input = createEvaluationInput(contact, vivahamWelcomeRule, { isDryRun: true });
    const result = evaluateAutomationRules(input);

    // Assert that the welcome rule is completely suppressed by the 30-day cooldown
    expect(result.matched).toBe(false);
    expect(result.status).toBe("no_match");
    expect(result.skipReason).toBe("no_matching_rules");
    expect(result.actionsToDispatch).toHaveLength(0);
    expect(result.ruleId).toBeUndefined();
    expect(result.ruleName).toBeUndefined();
    expect(result.contactUpdates?.last_welcome_sent_at).toBeUndefined();
  });

  // ============================================================================
  // REQUIREMENTS 4 & 5: Synthetic Contact with Welcome Sent > 30 Days Ago (Permitted)
  // ============================================================================
  it("Requirements 4 & 5: should allow welcome rule when last welcome is older than 30 days (e.g., 31 days)", () => {
    const vivahamWelcomeRule = INITIAL_AUTOMATION_RULES.find(
      (r) => r.business_id === VIVAHAM_BUSINESS_ID && r.trigger_type === "first_inbound_message"
    )!;

    // Contact received welcome 31 days prior to EVAL_TIMESTAMP
    const thirtyOneDaysAgo = new Date(EVAL_TIMESTAMP.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const contact = createSyntheticContact({
      id: "contact-welcome-31d-ago",
      last_welcome_sent_at: thirtyOneDaysAgo,
      total_inbound_count: 1,
    });

    const input = createEvaluationInput(contact, vivahamWelcomeRule, { isDryRun: true });
    const result = evaluateAutomationRules(input);

    // Verify that the cooldown no longer suppresses the welcome rule
    expect(result.matched).toBe(true);
    expect(result.status).toBe("success");
    expect(result.ruleId).toBe(vivahamWelcomeRule.id);
    expect(result.ruleName).toBe("Vivaham Matrimony Welcome Message");
    expect(result.actionsToDispatch).toHaveLength(1);
    expect(result.actionsToDispatch[0].action_type).toBe("send_text_message");
    expect((result.actionsToDispatch[0].payload as any).message_text).toContain(
      "வணக்கம்! Welcome to Gokul Vivaham — Tamil Matrimonial Services."
    );

    // Verify that contact updates propose advancing last_welcome_sent_at to current timestamp
    expect(result.contactUpdates?.last_welcome_sent_at).toBe(EVAL_TIMESTAMP.toISOString());
  });

  // ============================================================================
  // REQUIREMENT 6: Exact 30-Day Boundary Behavior & Documentation
  // ============================================================================
  describe("Requirement 6: Exact 30-Day Boundary Behavior", () => {
    const vivahamWelcomeRule = INITIAL_AUTOMATION_RULES.find(
      (r) => r.business_id === VIVAHAM_BUSINESS_ID && r.trigger_type === "first_inbound_message"
    )!;

    /**
     * Engine implementation:
     *   const lastWelcome = input.contact.last_welcome_sent_at ? new Date(...).getTime() : 0;
     *   const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
     *   if (lastWelcome > 0 && now.getTime() - lastWelcome < thirtyDaysMs) {
     *     continue; // Welcome cooldown active
     *   }
     *
     * Analysis:
     * - The condition uses strict inequality `< thirtyDaysMs`.
     * - If elapsed < 30 days: cooldown is active -> SUPPRESSED.
     * - If elapsed == 30 days: `thirtyDaysMs < thirtyDaysMs` evaluates to FALSE -> cooldown EXPIRED -> FIRES.
     * - If elapsed > 30 days: `elapsed < thirtyDaysMs` evaluates to FALSE -> cooldown EXPIRED -> FIRES.
     */

    it("6.1 Boundary - 1 ms (29 days, 23h, 59m, 59s, 999ms): cooldown is active and suppresses the welcome rule", () => {
      const boundaryMinusOneMs = new Date(EVAL_TIMESTAMP.getTime() - (THIRTY_DAYS_MS - 1)).toISOString();
      const contact = createSyntheticContact({
        id: "contact-boundary-minus-1ms",
        last_welcome_sent_at: boundaryMinusOneMs,
        total_inbound_count: 1,
      });

      const input = createEvaluationInput(contact, vivahamWelcomeRule, { isDryRun: true });
      const result = evaluateAutomationRules(input);

      // Exactly 1ms before 30 days -> Still inside cooldown window -> suppressed
      expect(result.matched).toBe(false);
      expect(result.status).toBe("no_match");
      expect(result.actionsToDispatch).toHaveLength(0);
    });

    it("6.2 Exact Boundary (30 days, 0ms margin): cooldown expires at exactly 30 days and permits the welcome rule", () => {
      // Exactly 30 days (2,592,000,000 ms) elapsed
      const exactBoundary = new Date(EVAL_TIMESTAMP.getTime() - THIRTY_DAYS_MS).toISOString();
      const contact = createSyntheticContact({
        id: "contact-exact-boundary",
        last_welcome_sent_at: exactBoundary,
        total_inbound_count: 1,
      });

      const input = createEvaluationInput(contact, vivahamWelcomeRule, { isDryRun: true });
      const result = evaluateAutomationRules(input);

      // (now - lastWelcome < thirtyDaysMs) is (THIRTY_DAYS_MS < THIRTY_DAYS_MS) => FALSE
      // Therefore cooldown is NO LONGER active at exact 30-day boundary
      expect(result.matched).toBe(true);
      expect(result.status).toBe("success");
      expect(result.ruleId).toBe(vivahamWelcomeRule.id);
      expect(result.actionsToDispatch).toHaveLength(1);
    });

    it("6.3 Boundary + 1 ms (30 days, 0h, 0m, 0s, 1ms): cooldown has expired and permits the welcome rule", () => {
      const boundaryPlusOneMs = new Date(EVAL_TIMESTAMP.getTime() - (THIRTY_DAYS_MS + 1)).toISOString();
      const contact = createSyntheticContact({
        id: "contact-boundary-plus-1ms",
        last_welcome_sent_at: boundaryPlusOneMs,
        total_inbound_count: 1,
      });

      const input = createEvaluationInput(contact, vivahamWelcomeRule, { isDryRun: true });
      const result = evaluateAutomationRules(input);

      // 1ms past 30 days -> Cooldown expired -> fires
      expect(result.matched).toBe(true);
      expect(result.status).toBe("success");
      expect(result.ruleId).toBe(vivahamWelcomeRule.id);
      expect(result.actionsToDispatch).toHaveLength(1);
    });
  });

  // ============================================================================
  // REQUIREMENT 7: isDryRun: true & Zero Side-Effects Verification
  // ============================================================================
  describe("Requirement 7: isDryRun: true, Zero External Calls, Zero Database Mutations", () => {
    const vivahamWelcomeRule = INITIAL_AUTOMATION_RULES.find(
      (r) => r.business_id === VIVAHAM_BUSINESS_ID && r.trigger_type === "first_inbound_message"
    )!;

    it("should guarantee zero network requests (fetch) and pure in-memory dry-run evaluation", () => {
      const contact = createSyntheticContact({
        id: "contact-dry-run-verify",
        last_welcome_sent_at: null, // First time ever
        total_inbound_count: 1,
      });

      const input = createEvaluationInput(contact, vivahamWelcomeRule, { isDryRun: true });
      const result = evaluateAutomationRules(input);

      // Evaluation succeeds in-memory
      expect(result.matched).toBe(true);
      expect(result.status).toBe("success");

      // Verify zero external network calls occurred
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should prove isDryRun: true evaluates rules safely while isDryRun: false respects rule.is_active = false", () => {
      const contact = createSyntheticContact({
        id: "contact-dry-run-active-check",
        last_welcome_sent_at: null,
        total_inbound_count: 1,
      });

      // When isDryRun: false, inactive rules (is_active: false) are filtered out to prevent unintended live execution
      const liveRunInput = createEvaluationInput(contact, vivahamWelcomeRule, {
        isDryRun: false,
        automationSettings: { ...DEFAULT_AUTOMATION_SETTINGS, is_automation_enabled: true },
      });
      const liveResult = evaluateAutomationRules(liveRunInput);
      expect(liveResult.matched).toBe(false);
      expect(liveResult.skipReason).toBe("no_matching_rules");

      // When isDryRun: true, the engine allows simulation without modifying production activation state
      const dryRunInput = createEvaluationInput(contact, vivahamWelcomeRule, {
        isDryRun: true,
      });
      const dryRunResult = evaluateAutomationRules(dryRunInput);
      expect(dryRunResult.matched).toBe(true);
      expect(dryRunResult.status).toBe("success");
    });
  });
});
