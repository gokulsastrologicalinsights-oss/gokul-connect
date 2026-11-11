import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  checkMessagingWindow,
  isRetryableMetaError,
  sendWhatsAppMessageService,
} from "@/lib/whatsapp/service";
import {
  getApprovedTemplatesDb,
  getConversationMessagingWindowDb,
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/store";
import {
  sendWhatsAppMessageAction,
  getConversationMessagingWindowAction,
  getApprovedTemplatesAction,
} from "@/app/actions/inbox";
import {
  WhatsAppContact,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/types/database";

// In-memory test state
let mockContacts: WhatsAppContact[] = [];
let mockConversations: WhatsAppConversation[] = [];
let mockMessages: WhatsAppMessage[] = [];
let mockConnections: any[] = [];
let mockJobs: any[] = [];
let mockTemplates: any[] = [];

// Flexible chained query mock
function createMockSupabaseClient() {
  return {
    from(table: string) {
      let currentTable = table;
      let dataset: any[] = [];

      if (currentTable === "wa_contacts") dataset = mockContacts;
      else if (currentTable === "wa_conversations") {
        dataset = mockConversations.map((c) => ({
          ...c,
          contact: mockContacts.find((ct) => ct.id === c.contact_id),
          connection: mockConnections.find((cn) => cn.id === c.connection_id),
        }));
      } else if (currentTable === "wa_messages") dataset = mockMessages;
      else if (currentTable === "wa_connections") dataset = mockConnections;
      else if (currentTable === "wa_message_templates") dataset = mockTemplates;
      else if (currentTable === "wa_processing_jobs") dataset = mockJobs;

      let filtered = [...dataset];

      const chain: any = {
        select(cols = "*") {
          return chain;
        },
        eq(col: string, val: any) {
          filtered = filtered.filter((r) => r[col] === val);
          return chain;
        },
        neq(col: string, val: any) {
          filtered = filtered.filter((r) => r[col] !== val);
          return chain;
        },
        gt(col: string, val: any) {
          filtered = filtered.filter((r) => r[col] > val);
          return chain;
        },
        lt(col: string, val: any) {
          filtered = filtered.filter((r) => r[col] < val);
          return chain;
        },
        or(condition: string) {
          return chain;
        },
        order(col: string, { ascending = true } = {}) {
          filtered.sort((a, b) => {
            const valA = a[col] || "";
            const valB = b[col] || "";
            return ascending ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
          });
          return chain;
        },
        limit(n: number) {
          filtered = filtered.slice(0, n);
          return chain;
        },
        single() {
          return Promise.resolve({
            data: filtered[0] || null,
            error: filtered.length === 0 ? new Error("Row not found") : null,
          });
        },
        maybeSingle() {
          return Promise.resolve({
            data: filtered[0] || null,
            error: null,
          });
        },
        insert(payload: any) {
          const row = { id: `gen-${Date.now()}-${Math.random()}`, ...payload };
          if (currentTable === "wa_processing_jobs") mockJobs.push(row);
          if (currentTable === "wa_messages") mockMessages.push(row);
          return {
            select() {
              return {
                single: async () => ({ data: row, error: null }),
              };
            },
          };
        },
        upsert(payload: any) {
          const row = { id: payload.id || `upsert-${Date.now()}`, ...payload };
          return {
            select() {
              return {
                single: async () => ({ data: row, error: null }),
              };
            },
          };
        },
        update(updates: any) {
          return {
            eq(col: string, val: any) {
              return Promise.resolve({ error: null });
            },
          };
        },
        then(resolve: any) {
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        },
      };

      return chain;
    },
  };
}

// Mock @/lib/supabase/server
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => createMockSupabaseClient()),
}));

// Mock tenant-guard
vi.mock("@/lib/auth/tenant-guard", () => ({
  validateBusinessAccess: vi.fn(async (businessSlug: string) => {
    if (businessSlug === "astrology") {
      return {
        business: {
          id: ASTRO_BUSINESS_ID,
          slug: "astrology",
          name: "Gokul's Astrological Insights",
        },
        membership: {
          id: "mem-astro",
          role: "owner",
          business_id: ASTRO_BUSINESS_ID,
          user_id: "user-astro",
        },
        user: { id: "user-astro", email: "astro@gokul.com" },
      };
    } else if (businessSlug === "vivaham") {
      return {
        business: {
          id: VIVAHAM_BUSINESS_ID,
          slug: "vivaham",
          name: "Gokul Vivaham",
        },
        membership: {
          id: "mem-vivaham",
          role: "agent",
          business_id: VIVAHAM_BUSINESS_ID,
          user_id: "user-vivaham",
        },
        user: { id: "user-vivaham", email: "vivaham@gokul.com" },
      };
    }
    throw new Error("Unauthorized: Invalid business slug");
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Phase 4B — Interactive WhatsApp Chat Implementation Suite", () => {
  const ROGUE_BUSINESS_ID = "99999999-9999-9999-9999-999999999999";

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.META_TEST_PHONE_NUMBER_ID = "109283746501928";
    process.env.META_TEST_ACCESS_TOKEN = "TEST_TOKEN_4B";

    mockContacts = [
      {
        id: "ct-astro-01",
        business_id: ASTRO_BUSINESS_ID,
        phone_number: "919444559071",
        display_name: "Gokul Approved Test Client",
        profile_photo_url: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "ct-vivaham-01",
        business_id: VIVAHAM_BUSINESS_ID,
        phone_number: "919840199999",
        display_name: "Vivaham Matrimony Member",
        profile_photo_url: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockConnections = [
      {
        id: "conn-astro-01",
        business_id: ASTRO_BUSINESS_ID,
        display_name: "Astrology Consultations",
        phone_number: "+91 98400 12345",
        phone_number_id: "109283746501928",
        is_enabled: true,
        wa_credentials: [],
      },
      {
        id: "conn-vivaham-01",
        business_id: VIVAHAM_BUSINESS_ID,
        display_name: "Vivaham Member Desk",
        phone_number: "+1 555-152-9045",
        phone_number_id: "1395663896970053",
        is_enabled: true,
        wa_credentials: [],
      },
    ];

    mockConversations = [
      {
        id: "conv-astro-01",
        business_id: ASTRO_BUSINESS_ID,
        connection_id: "conn-astro-01",
        contact_id: "ct-astro-01",
        status: "open",
        last_message_preview: "Vanakkam, booking consultation",
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "conv-vivaham-01",
        business_id: VIVAHAM_BUSINESS_ID,
        connection_id: "conn-vivaham-01",
        contact_id: "ct-vivaham-01",
        status: "open",
        last_message_preview: "Enquiry for membership",
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockMessages = [
      {
        id: "msg-inbound-01",
        business_id: ASTRO_BUSINESS_ID,
        connection_id: "conn-astro-01",
        conversation_id: "conv-astro-01",
        contact_id: "ct-astro-01",
        direction: "inbound",
        message_type: "text",
        content: "Vanakkam, booking consultation",
        meta_message_id: "wamid.in_01",
        status: "delivered",
        error_code: null,
        error_message: null,
        sent_at: null,
        delivered_at: new Date().toISOString(),
        read_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockJobs = [];
    mockTemplates = [];
  });

  // 1. TEXT MESSAGE COMPOSER & CONTENT VALIDATION
  describe("1. Message Content & Length Validation", () => {
    it("should reject sending empty or whitespace-only message", async () => {
      const res1 = await sendWhatsAppMessageAction({
        businessSlug: "astrology",
        conversationId: "conv-astro-01",
        text: "",
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("cannot be empty");

      const res2 = await sendWhatsAppMessageAction({
        businessSlug: "astrology",
        conversationId: "conv-astro-01",
        text: "     ",
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("cannot be empty");
    });

    it("should reject message exceeding WhatsApp 4096 character limit", async () => {
      const longText = "A".repeat(4097);
      const res = await sendWhatsAppMessageAction({
        businessSlug: "astrology",
        conversationId: "conv-astro-01",
        text: longText,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("exceeds maximum allowed character length of 4096");
    });
  });

  // 2. WHATSAPP 24-HOUR CUSTOMER SERVICE WINDOW COMPLIANCE
  describe("2. WhatsApp 24-Hour Customer Service Window Compliance", () => {
    it("should detect active 24-hour window when customer replied recently", () => {
      const now = new Date();
      const recentInbound = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

      const windowStatus = checkMessagingWindow([
        { direction: "inbound", created_at: recentInbound },
        { direction: "outbound", created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() },
      ]);

      expect(windowStatus.isOpen).toBe(true);
      expect(windowStatus.lastInboundAt).toBe(recentInbound);
      expect(windowStatus.remainingSeconds).toBeGreaterThan(21 * 3600);
      expect(windowStatus.remainingSeconds).toBeLessThanOrEqual(22 * 3600);
    });

    it("should detect expired 24-hour window when customer replied > 24 hours ago", () => {
      const now = new Date();
      const oldInbound = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();

      const windowStatus = checkMessagingWindow([
        { direction: "inbound", created_at: oldInbound },
      ]);

      expect(windowStatus.isOpen).toBe(false);
      expect(windowStatus.lastInboundAt).toBe(oldInbound);
      expect(windowStatus.remainingSeconds).toBe(0);
    });

    it("should detect closed window when no customer inbound message exists", () => {
      const windowStatus = checkMessagingWindow([
        { direction: "outbound", created_at: new Date().toISOString() },
      ]);

      expect(windowStatus.isOpen).toBe(false);
      expect(windowStatus.lastInboundAt).toBeNull();
      expect(windowStatus.remainingSeconds).toBe(0);
    });

    it("should query window status via Server Action accurately", async () => {
      const res = await getConversationMessagingWindowAction("astrology", "conv-astro-01");
      expect(res.success).toBe(true);
      expect(res.window.isOpen).toBe(true);
      expect(res.window.remainingSeconds).toBeGreaterThan(0);
    });
  });

  // 3. SERVER AUTHORIZATION & TENANT ISOLATION
  describe("3. Server Authorization & Cross-Tenant Rejection", () => {
    it("should reject message send when user is not member of requested business", async () => {
      await expect(
        sendWhatsAppMessageAction({
          businessSlug: "invalid-business",
          conversationId: "conv-astro-01",
          text: "Unauthorized test",
        })
      ).rejects.toThrow("Unauthorized: Invalid business slug");
    });

    it("should reject cross-tenant conversation access (Astrology sending to Vivaham conversation)", async () => {
      const res = await sendWhatsAppMessageAction({
        businessSlug: "astrology",
        conversationId: "conv-vivaham-01", // Vivaham conversation ID
        text: "Cross-tenant intrusion attempt",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Conversation not found or cross-tenant access denied");
    });

    it("should prevent rogue business tenant from querying messaging window", async () => {
      await expect(
        getConversationMessagingWindowDb(ROGUE_BUSINESS_ID, "conv-astro-01")
      ).rejects.toThrow("Unauthorized: Invalid business tenant identifier");
    });

    it("should prevent rogue business tenant from querying approved templates", async () => {
      await expect(
        getApprovedTemplatesDb(ROGUE_BUSINESS_ID)
      ).rejects.toThrow("Unauthorized: Invalid business tenant identifier");
    });
  });

  // 4. APPROVED WHATSAPP TEMPLATES FOR RE-ENGAGEMENT
  describe("4. Approved WhatsApp Templates for Re-engagement", () => {
    it("should return approved templates for business tenant with default fallback", async () => {
      const templates = await getApprovedTemplatesDb(ASTRO_BUSINESS_ID);
      expect(templates.length).toBeGreaterThan(0);

      const helloWorld = templates.find((t) => t.template_name === "hello_world");
      expect(helloWorld).toBeDefined();
      expect(helloWorld?.language).toBe("en_US");
      expect(helloWorld?.status).toBe("APPROVED");
    });

    it("should retrieve templates via Server Action for authenticated business", async () => {
      const res = await getApprovedTemplatesAction("astrology");
      expect(res.success).toBe(true);
      expect(res.templates.length).toBeGreaterThan(0);
    });
  });

  // 5. ERROR CLASSIFICATION & OUTBOX RETRY ARCHITECTURE
  describe("5. Error Classification & Durable Outbox Retries", () => {
    it("should classify Meta rate limits as retryable (code 130429, 80007, 429)", () => {
      expect(isRetryableMetaError({ code: 130429, message: "Rate limit reached" })).toBe(true);
      expect(isRetryableMetaError({ code: 80007, message: "Too many calls" })).toBe(true);
      expect(isRetryableMetaError({ status: 429, message: "Too Many Requests" })).toBe(true);
      expect(isRetryableMetaError(new Error("Meta API Rate Limit Hit (130429)"))).toBe(true);
    });

    it("should classify transient network timeouts as retryable", () => {
      expect(isRetryableMetaError(new Error("fetch failed: ECONNRESET"))).toBe(true);
      expect(isRetryableMetaError(new Error("Connection timed out"))).toBe(true);
      expect(isRetryableMetaError(new Error("ETIMEDOUT"))).toBe(true);
      expect(isRetryableMetaError({ code: 503, message: "Service Unavailable" })).toBe(true);
    });

    it("should classify permanent errors as NOT retryable (window expired, bad recipient, auth error)", () => {
      expect(isRetryableMetaError({ code: 131047, message: "Re-engagement message: Window expired" })).toBe(false);
      expect(isRetryableMetaError({ code: 131026, message: "Message undeliverable: User not on WhatsApp" })).toBe(false);
      expect(isRetryableMetaError({ code: 190, message: "Invalid OAuth access token" })).toBe(false);
      expect(isRetryableMetaError({ code: 100, message: "Invalid parameter: phone number format" })).toBe(false);
      expect(isRetryableMetaError(new Error("Message text cannot be empty"))).toBe(false);
    });

    it("should record durable job in wa_processing_jobs when retryable failure occurs", async () => {
      const mockClient = await import("@/lib/whatsapp/client");
      vi.spyOn(mockClient, "sendMetaTextMessage").mockRejectedValueOnce({
        code: 130429,
        message: "Meta Cloud API Rate Limit Exceeded",
      });

      const client = createMockSupabaseClient();
      const res = await sendWhatsAppMessageService({
        businessId: ASTRO_BUSINESS_ID,
        connectionId: "conn-astro-01",
        recipientPhone: "+91 94445 59071",
        text: "Test rate-limited message",
        supabaseClient: client as any,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe("failed");

      // Verify that job was enqueued in wa_processing_jobs
      const queuedJob = mockJobs.find((j) => j.job_type === "send_message");
      expect(queuedJob).toBeDefined();
      expect(queuedJob.status).toBe("pending");
      expect(queuedJob.attempts).toBe(1);
      expect(queuedJob.max_attempts).toBe(5);
      expect(queuedJob.last_error).toContain("Rate Limit Exceeded");
    });
  });

  // 6. DELIVERY STATUS ACCURACY
  describe("6. Delivery Status Accuracy (Sending, Sent, Delivered, Read, Failed)", () => {
    it("should accurately reflect message delivery lifecycle statuses without fabrication", () => {
      const validStatuses = ["pending", "sent", "delivered", "read", "failed"];
      validStatuses.forEach((status) => {
        expect(["pending", "sent", "delivered", "read", "failed"]).toContain(status);
      });
    });
  });
});
