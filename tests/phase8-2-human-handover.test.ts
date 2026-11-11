import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateAutomationRules, EvaluationInput } from "@/lib/automation/engine";
import { processInboundAutomation } from "@/lib/automation/dispatcher";
import { processQueueBatch } from "@/lib/automation/worker";
import { validateScheduledFollowupPreExecution } from "@/lib/automation/safeguards";
import {
  INITIAL_AUTOMATION_RULES,
  DEFAULT_AUTOMATION_SETTINGS,
  DEFAULT_BUSINESS_HOURS,
} from "@/lib/automation/store";
import {
  updateConversationStatus,
  resumeConversationAutomation,
  getConversationById,
} from "@/lib/inbox/store";
import {
  WhatsAppContact,
  WhatsAppConversation,
  WhatsAppProcessingJob,
  AutomationRule,
} from "@/types/database";

describe("Phase 8.2 — Human Handover Persistence Verification (Gokul Vivaham)", () => {
  const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";
  const VIVAHAM_CONNECTION_ID = "conn-vivaham-01";
  const ROGUE_BUSINESS_ID = "99999999-9999-9999-9999-999999999999";
  const EVAL_TIMESTAMP = new Date("2026-11-07T12:00:00.000Z");

  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create synthetic conversation
  function createSyntheticConversation(
    contactId: string = "contact-vivaham-01",
    overrides: Partial<WhatsAppConversation> = {}
  ): WhatsAppConversation {
    return {
      id: "conv-vivaham-01",
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
      ...overrides,
    };
  }

  // Helper to create synthetic contact
  function createSyntheticContact(overrides: Partial<WhatsAppContact> = {}): WhatsAppContact {
    return {
      id: "contact-vivaham-01",
      business_id: VIVAHAM_BUSINESS_ID,
      phone_number: "+919840199999",
      display_name: "Vivaham Matrimony Seeker",
      profile_photo_url: null,
      metadata: { service: "vivaham" },
      is_opted_out: false,
      total_inbound_count: 2,
      last_inbound_at: EVAL_TIMESTAMP.toISOString(),
      last_welcome_sent_at: EVAL_TIMESTAMP.toISOString(),
      created_at: EVAL_TIMESTAMP.toISOString(),
      updated_at: EVAL_TIMESTAMP.toISOString(),
      ...overrides,
    };
  }

  // Helper to get active Vivaham rules
  function getVivahamRules(): AutomationRule[] {
    return INITIAL_AUTOMATION_RULES.filter((r) => r.business_id === VIVAHAM_BUSINESS_ID);
  }

  // Helper to create evaluation input
  function createEvaluationInput(
    text: string,
    conversationOverrides: Partial<WhatsAppConversation> = {},
    contactOverrides: Partial<WhatsAppContact> = {}
  ): EvaluationInput {
    const contact = createSyntheticContact(contactOverrides);
    const conversation = createSyntheticConversation(contact.id, conversationOverrides);
    return {
      message: {
        id: "msg-inbound-handover-01",
        direction: "inbound",
        content: text,
        message_type: "text",
        created_at: EVAL_TIMESTAMP.toISOString(),
      },
      contact,
      conversation,
      businessId: VIVAHAM_BUSINESS_ID,
      connectionId: VIVAHAM_CONNECTION_ID,
      rules: getVivahamRules(),
      businessHours: DEFAULT_BUSINESS_HOURS,
      automationSettings: DEFAULT_AUTOMATION_SETTINGS,
      now: EVAL_TIMESTAMP,
      isDryRun: true,
    };
  }

  // ============================================================================
  // DOMAIN 1: TRACE AGENT / HUMAN-HANDOVER FROM RULE EVALUATION (ENGINE)
  // ============================================================================
  describe("Domain 1: Rule Evaluation Trace for Gokul Vivaham Handover Keywords", () => {
    it("1.1 should match keyword 'AGENT' (case-insensitive) and return handover state", () => {
      const input = createEvaluationInput("AGENT");
      const res = evaluateAutomationRules(input);

      expect(res.matched).toBe(true);
      expect(res.status).toBe("human_handover_handled");
      expect(res.conversationUpdates?.status).toBe("pending_human");
      expect(res.conversationUpdates?.is_automation_paused).toBe(true);
      expect(res.actionsToDispatch).toHaveLength(1);
      expect(res.actionsToDispatch[0].action_type).toBe("send_text_message");
      expect(res.actionsToDispatch[0].payload.message_text).toContain(
        "Our coordinator will join this chat shortly"
      );
      expect(res.actionsToDispatch[0].delay_seconds).toBe(0);
    });

    it("1.2 should match Gokul Vivaham menu prompt '0' (Speak with Marriage Coordinator)", () => {
      // Gokul Vivaham Welcome message specifically prompts: '0 - Speak with Marriage Coordinator'
      const input = createEvaluationInput("0");
      const res = evaluateAutomationRules(input);

      expect(res.matched).toBe(true);
      expect(res.status).toBe("human_handover_handled");
      expect(res.conversationUpdates?.status).toBe("pending_human");
      expect(res.conversationUpdates?.is_automation_paused).toBe(true);
      expect(res.actionsToDispatch[0].payload.message_text).toContain(
        "Office hours: 9 AM - 6 PM IST"
      );
    });

    it("1.3 should match Tamil handover keywords 'உதவி' and 'மனிதர்'", () => {
      const resTamil1 = evaluateAutomationRules(createEvaluationInput("உதவி"));
      expect(resTamil1.matched).toBe(true);
      expect(resTamil1.status).toBe("human_handover_handled");
      expect(resTamil1.conversationUpdates?.status).toBe("pending_human");
      expect(resTamil1.conversationUpdates?.is_automation_paused).toBe(true);

      const resTamil2 = evaluateAutomationRules(createEvaluationInput("மனிதர்"));
      expect(resTamil2.matched).toBe(true);
      expect(resTamil2.status).toBe("human_handover_handled");
      expect(resTamil2.conversationUpdates?.status).toBe("pending_human");
    });

    it("1.4 should match standard synonyms 'HUMAN' and 'REPRESENTATIVE'", () => {
      const resHuman = evaluateAutomationRules(createEvaluationInput("human"));
      expect(resHuman.status).toBe("human_handover_handled");

      const resRep = evaluateAutomationRules(createEvaluationInput("Representative"));
      expect(resRep.status).toBe("human_handover_handled");
    });

    it("1.5 should support custom tenant-configured handover keywords", () => {
      const customInput = createEvaluationInput("COORDINATOR");
      customInput.automationSettings = {
        ...DEFAULT_AUTOMATION_SETTINGS,
        human_handover_keywords: ["COORDINATOR", "ADMIN", "HELP"],
      };

      const res = evaluateAutomationRules(customInput);
      expect(res.matched).toBe(true);
      expect(res.status).toBe("human_handover_handled");
      expect(res.conversationUpdates?.status).toBe("pending_human");
      expect(res.conversationUpdates?.is_automation_paused).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 2: PERSISTENCE LAYER TRACE (DISPATCHER & WORKER)
  // ============================================================================
  describe("Domain 2: Worker & Persistence Layer Trace", () => {
    it("2.1 should persist status='pending_human' and is_automation_paused=true via processInboundAutomation", async () => {
      const contact = createSyntheticContact({ last_inbound_at: new Date().toISOString() });
      const conversation = createSyntheticConversation(contact.id);

      const mockConvUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockJobInsert = vi.fn().mockResolvedValue({ error: null });
      const mockLogInsert = vi.fn().mockResolvedValue({ error: null });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "wa_contacts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: contact }),
                }),
              }),
            };
          }
          if (table === "wa_conversations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: conversation }),
                }),
              }),
              update: mockConvUpdate,
            };
          }
          if (table === "business_settings") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      business_hours: DEFAULT_BUSINESS_HOURS,
                      automation_settings: DEFAULT_AUTOMATION_SETTINGS,
                    },
                  }),
                }),
              }),
            };
          }
          if (table === "wa_processing_jobs") {
            return { insert: mockJobInsert };
          }
          if (table === "wa_automation_execution_logs") {
            return { insert: mockLogInsert };
          }
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        }),
      };

      await processInboundAutomation(mockSupabase, {
        businessId: VIVAHAM_BUSINESS_ID,
        connectionId: VIVAHAM_CONNECTION_ID,
        conversationId: conversation.id,
        contactId: contact.id,
        messageId: "msg-handover-persist-01",
        messageContent: "0",
        messageType: "text",
      });

      // 1. Verify conversation persistence mutation
      expect(mockConvUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending_human",
          is_automation_paused: true,
          updated_at: expect.any(String),
        })
      );

      // 2. Verify coordinator acknowledgement outbound job was enqueued
      expect(mockJobInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: VIVAHAM_BUSINESS_ID,
          connection_id: VIVAHAM_CONNECTION_ID,
          job_type: "send_outbound_message",
          payload: expect.objectContaining({
            conversation_id: conversation.id,
            contact_id: contact.id,
            content: expect.stringContaining("coordinator will join this chat shortly"),
          }),
        })
      );
    });

    it("2.2 should execute evaluate_automation_rules job within worker batch and reject cross-tenant execution", async () => {
      const mockRpcClaim = vi.fn().mockResolvedValue({
        data: [
          {
            id: "job-cross-tenant-01",
            business_id: VIVAHAM_BUSINESS_ID,
            job_type: "evaluate_automation_rules",
            payload: {
              conversation_id: "conv-rogue",
              contact_id: "contact-rogue",
              message_id: "msg-01",
              message_content: "AGENT",
            },
            attempts: 0,
            max_attempts: 5,
          },
        ],
        error: null,
      });

      const mockJobUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Rogue conversation belongs to another tenant
      const mockSupabase = {
        rpc: mockRpcClaim,
        from: vi.fn((table: string) => {
          if (table === "wa_conversations") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "conv-rogue", business_id: ROGUE_BUSINESS_ID },
                  }),
                }),
              }),
            };
          }
          if (table === "wa_contacts") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "contact-rogue", business_id: ROGUE_BUSINESS_ID },
                  }),
                }),
              }),
            };
          }
          if (table === "wa_processing_jobs") {
            return { update: mockJobUpdate };
          }
          return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
        }),
      };

      // Spy on createAdminClient in worker
      const adminModule = await import("@/lib/supabase/admin");
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const workerRes = await processQueueBatch(1, "worker-test");
      expect(workerRes.claimedCount).toBe(1);
      expect(workerRes.failedCount).toBe(1);
      expect(mockJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          last_error: expect.stringContaining("Security violation: Cross-tenant ID mismatch"),
        })
      );
    });
  });

  // ============================================================================
  // DOMAIN 3: SUBSEQUENT INBOUND SUPPRESSION WHILE HANDOVER IS ACTIVE
  // ============================================================================
  describe("Domain 3: Suppression of Automated Replies during Human Handover", () => {
    it("3.1 should suppress bot replies when conversation.status is 'pending_human'", () => {
      // Inbound message matches the 'Membership Plans & Follow-Up' keyword rule
      const input = createEvaluationInput("Tell me about your membership plans", {
        status: "pending_human",
        is_automation_paused: false,
      });

      const res = evaluateAutomationRules(input);

      expect(res.matched).toBe(false);
      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("human_agent_active_or_paused");
      expect(res.actionsToDispatch).toHaveLength(0);
    });

    it("3.2 should suppress bot replies when conversation.is_automation_paused is true", () => {
      // Inbound message matches Tamil keyword 'கட்டணம்' (fees)
      const input = createEvaluationInput("கட்டணம் எவ்வளவு?", {
        status: "open",
        is_automation_paused: true,
      });

      const res = evaluateAutomationRules(input);

      expect(res.matched).toBe(false);
      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("human_agent_active_or_paused");
      expect(res.actionsToDispatch).toHaveLength(0);
    });

    it("3.3 should suppress scheduled follow-up execution when thread is in pending_human or paused (Gate 4)", () => {
      const contact = createSyntheticContact({
        last_inbound_at: "2026-11-07T11:00:00.000Z",
      });
      const conversation = createSyntheticConversation(contact.id, {
        status: "pending_human",
        is_automation_paused: true,
      });

      const scheduledJob: WhatsAppProcessingJob = {
        id: "job-followup-01",
        business_id: VIVAHAM_BUSINESS_ID,
        connection_id: VIVAHAM_CONNECTION_ID,
        job_type: "scheduled_followup",
        payload: {
          conversation_id: conversation.id,
          contact_id: contact.id,
          rule_id: "20000000-0000-0000-0000-000000000002",
          action_type: "send_text_message",
          content: "Follow-up regarding membership plans",
        },
        idempotency_key: "followup-01",
        status: "pending",
        scheduled_at: "2026-11-07T12:00:00.000Z",
        attempts: 0,
        max_attempts: 5,
        last_error: null,
        locked_at: null,
        created_at: "2026-11-07T11:30:00.000Z",
        updated_at: "2026-11-07T11:30:00.000Z",
      };

      const validation = validateScheduledFollowupPreExecution({
        job: scheduledJob,
        conversation,
        contact,
        rule: getVivahamRules()[1],
        automationSettings: DEFAULT_AUTOMATION_SETTINGS,
        now: EVAL_TIMESTAMP,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe("agent_takeover_or_paused");
      expect(validation.reason).toContain("Conversation is in 'pending_human' or automation is paused");
    });
  });

  // ============================================================================
  // DOMAIN 4: HUMAN COORDINATOR RESUME BOT AUTOMATION
  // ============================================================================
  describe("Domain 4: Resuming Bot Automation by Human Coordinator", () => {
    // In-memory test database fixture
    let mockConversations: WhatsAppConversation[] = [];

    function createTestClient() {
      return {
        from: (table: string) => {
          if (table === "wa_conversations") {
            return {
              select: () => ({
                eq: (col1: string, val1: any) => ({
                  eq: (col2: string, val2: any) => ({
                    maybeSingle: async () => ({
                      data: mockConversations.find(
                        (c: any) => c[col1] === val1 && c[col2] === val2
                      ) || null,
                      error: null,
                    }),
                  }),
                }),
              }),
              update: (updates: Record<string, any>) => ({
                eq: (col1: string, val1: any) => ({
                  eq: (col2: string, val2: any) => {
                    mockConversations = mockConversations.map((c: any) => {
                      if (c[col1] === val1 && c[col2] === val2) {
                        return { ...c, ...updates };
                      }
                      return c;
                    });
                    return Promise.resolve({ error: null });
                  },
                }),
              }),
            };
          }
          return { select: vi.fn(), update: vi.fn() };
        },
      };
    }

    beforeEach(() => {
      // Seed a paused pending_human conversation for Gokul Vivaham
      mockConversations = [
        {
          id: "conv-handover-test-01",
          business_id: VIVAHAM_BUSINESS_ID,
          connection_id: VIVAHAM_CONNECTION_ID,
          contact_id: "contact-vivaham-01",
          status: "pending_human",
          is_automation_paused: true,
          automation_paused_until: null,
          unread_count: 0,
          last_message_preview: "AGENT",
          last_message_at: EVAL_TIMESTAMP.toISOString(),
          created_at: EVAL_TIMESTAMP.toISOString(),
          updated_at: EVAL_TIMESTAMP.toISOString(),
        },
      ];
    });

    it("4.1 updateConversationStatus to 'open' resets is_automation_paused to false", async () => {
      const client = createTestClient();

      // Coordinator changes status back to 'open'
      await updateConversationStatus(
        VIVAHAM_BUSINESS_ID,
        "conv-handover-test-01",
        "open",
        client
      );

      const conv = await getConversationById(
        VIVAHAM_BUSINESS_ID,
        "conv-handover-test-01",
        client
      );

      expect(conv?.status).toBe("open");
      expect(conv?.is_automation_paused).toBe(false);
      expect(conv?.automation_paused_until).toBeNull();
    });

    it("4.2 resumeConversationAutomation explicitly clears paused state and sets status to open", async () => {
      const client = createTestClient();

      await resumeConversationAutomation(
        VIVAHAM_BUSINESS_ID,
        "conv-handover-test-01",
        client
      );

      const conv = await getConversationById(
        VIVAHAM_BUSINESS_ID,
        "conv-handover-test-01",
        client
      );

      expect(conv?.status).toBe("open");
      expect(conv?.is_automation_paused).toBe(false);
    });

    it("4.3 after coordinator resumes automation, subsequent inbound keyword messages match normally", () => {
      // Resumed conversation state
      const resumedConv = createSyntheticConversation("contact-vivaham-01", {
        status: "open",
        is_automation_paused: false,
      });

      // Customer sends membership plans inquiry after coordinator has resolved inquiry
      const input = createEvaluationInput("Tell me about your membership plans", {
        status: resumedConv.status,
        is_automation_paused: resumedConv.is_automation_paused,
      });

      const res = evaluateAutomationRules(input);

      // Verify that Safeguard 5 does NOT trip and rule matches
      expect(res.status).not.toBe("skipped");
      expect(res.skipReason).toBeUndefined();
      expect(res.matched).toBe(true);
      expect(res.ruleName).toBe("Membership Plans & Follow-Up");
      expect(res.actionsToDispatch.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // DOMAIN 5: STRICT ISOLATION & ZERO SIDE-EFFECT GUARANTEE
  // ============================================================================
  describe("Domain 5: Strict Zero Side-Effect & Production Safety Guarantee", () => {
    it("5.1 should NEVER make external WhatsApp API HTTP calls during evaluation or handover", () => {
      const input = createEvaluationInput("AGENT");
      evaluateAutomationRules(input);

      // Verify zero network calls were dispatched
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("5.2 should confirm workspace automation master switch defaults to false for approval safety", () => {
      // In production, is_automation_enabled must be false until separately approved
      expect(DEFAULT_AUTOMATION_SETTINGS.is_automation_enabled).toBe(false);

      // Evaluating without dry-run when automation is disabled returns safe skip
      const liveInput = createEvaluationInput("Tell me about your membership plans");
      liveInput.isDryRun = false;

      const res = evaluateAutomationRules(liveInput);
      expect(res.matched).toBe(false);
      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("workspace_automation_disabled");
      expect(res.actionsToDispatch).toHaveLength(0);
    });

    it("5.3 should reject cross-tenant operations in conversation status update", async () => {
      const client = {
        from: vi.fn(),
      };

      await expect(
        updateConversationStatus(
          ROGUE_BUSINESS_ID,
          "conv-01",
          "open",
          client
        )
      ).rejects.toThrow("Unauthorized: Invalid business tenant identifier");
    });
  });
});
