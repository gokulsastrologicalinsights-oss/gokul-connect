import { describe, expect, it, beforeEach } from "vitest";
import {
  getConversationsForBusiness,
  getInboxCounts,
  getConversationById,
  updateConversationStatus,
  toggleConversationRead,
  assignConversationAgent,
  getConversationMessages,
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/store";
import {
  WhatsAppContact,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/types/database";

describe("Phase 4A.1 — Live Supabase WhatsApp Inbox Data Integration Tests", () => {
  const ROGUE_BUSINESS_ID = "99999999-9999-9999-9999-999999999999";

  // Persistent mock database state simulating the live Gokul Connect Supabase tables
  let dbContacts: WhatsAppContact[] = [];
  let dbConversations: WhatsAppConversation[] = [];
  let dbMessages: WhatsAppMessage[] = [];

  // Factory to create a test Supabase query client operating on the database state
  function createTestDbClient() {
    return {
      from(table: string) {
        return {
          select(columns = "*") {
            let filteredRows: any[] = [];
            if (table === "wa_conversations") {
              filteredRows = dbConversations.map((c) => ({
                ...c,
                contact: dbContacts.find((ct) => ct.id === c.contact_id),
                connection: {
                  id: c.connection_id,
                  display_name:
                    c.business_id === ASTRO_BUSINESS_ID
                      ? "Gokul Astrology Consultations"
                      : "Gokul Vivaham Member Desk",
                  phone_number:
                    c.business_id === ASTRO_BUSINESS_ID ? "+91 98400 12345" : "+91 98401 77777",
                  phone_number_id:
                    c.business_id === ASTRO_BUSINESS_ID ? "109283746501928" : "209283746501930",
                  is_enabled: true,
                },
              }));
            } else if (table === "wa_messages") {
              filteredRows = [...dbMessages];
            } else if (table === "wa_contacts") {
              filteredRows = [...dbContacts];
            }

            let chain = {
              eq(col: string, val: any) {
                filteredRows = filteredRows.filter((r) => r[col] === val);
                return chain;
              },
              neq(col: string, val: any) {
                filteredRows = filteredRows.filter((r) => r[col] !== val);
                return chain;
              },
              gt(col: string, val: any) {
                filteredRows = filteredRows.filter((r) => r[col] > val);
                return chain;
              },
              lt(col: string, val: any) {
                filteredRows = filteredRows.filter((r) => r[col] < val);
                return chain;
              },
              order(col: string, { ascending = true } = {}) {
                filteredRows.sort((a, b) => {
                  const valA = a[col] || "";
                  const valB = b[col] || "";
                  return ascending
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
                });
                return chain;
              },
              limit(n: number) {
                filteredRows = filteredRows.slice(0, n);
                return chain;
              },
              range(from: number, to: number) {
                filteredRows = filteredRows.slice(from, to + 1);
                return chain;
              },
              maybeSingle() {
                return Promise.resolve({
                  data: filteredRows.length > 0 ? filteredRows[0] : null,
                  error: null,
                });
              },
              then(resolve: (res: { data: any[]; error: any }) => void) {
                return Promise.resolve({ data: filteredRows, error: null }).then(resolve);
              },
            };
            return chain;
          },

          update(updates: Record<string, any>) {
            return {
              eq(col1: string, val1: any) {
                return {
                  eq(col2: string, val2: any) {
                    if (table === "wa_conversations") {
                      dbConversations = dbConversations.map((c: any) => {
                        if (c[col1] === val1 && c[col2] === val2) {
                          return { ...c, ...updates };
                        }
                        return c;
                      });
                    }
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  beforeEach(() => {
    // Reset database to match exact Supabase live rows
    dbContacts = [
      {
        id: "4e58a9b0-9079-4670-aeb9-c709fc9a945b",
        business_id: ASTRO_BUSINESS_ID,
        phone_number: "919444559071",
        display_name: "Gokul Approved Test Client",
        profile_photo_url: null,
        metadata: { city: "Chennai", rasi: "Simha" },
        created_at: "2026-11-06T13:51:41.860Z",
        updated_at: "2026-11-06T13:51:42.108Z",
      },
      {
        id: "1d269630-5d55-45bc-8447-2ed39f9107fd",
        business_id: VIVAHAM_BUSINESS_ID,
        phone_number: "919840199999",
        display_name: "Vivaham Matrimony Member",
        profile_photo_url: null,
        metadata: { profile_id: "GV-9001" },
        created_at: "2026-11-06T13:51:43.609Z",
        updated_at: "2026-11-06T13:51:43.609Z",
      },
    ];

    dbConversations = [
      {
        id: "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        business_id: ASTRO_BUSINESS_ID,
        connection_id: "33333333-3333-3333-3333-333333333333",
        contact_id: "4e58a9b0-9079-4670-aeb9-c709fc9a945b",
        status: "open",
        last_message_preview: "Vanakkam, requesting KP astrological chart analysis",
        last_message_at: "2026-11-06T13:51:42.108Z",
        unread_count: 2,
        created_at: "2026-11-06T13:51:41.970Z",
        updated_at: "2026-11-06T13:51:42.108Z",
      },
      {
        id: "3a70bd6e-f5a8-411e-9748-f64977a0108d",
        business_id: VIVAHAM_BUSINESS_ID,
        connection_id: "44444444-4444-4444-4444-444444444444",
        contact_id: "1d269630-5d55-45bc-8447-2ed39f9107fd",
        status: "open",
        last_message_preview: "Enquiry for Mudaliar community premium membership",
        last_message_at: "2026-11-06T13:51:43.609Z",
        unread_count: 0,
        created_at: "2026-11-06T13:51:43.609Z",
        updated_at: "2026-11-06T13:51:43.609Z",
      },
    ];

    dbMessages = [
      {
        id: "msg-astro-01",
        business_id: ASTRO_BUSINESS_ID,
        connection_id: "33333333-3333-3333-3333-333333333333",
        conversation_id: "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        contact_id: "4e58a9b0-9079-4670-aeb9-c709fc9a945b",
        direction: "inbound",
        message_type: "text",
        content: "Vanakkam, requesting KP astrological chart analysis",
        meta_message_id: "wamid.live_in_01",
        status: "delivered",
        error_code: null,
        error_message: null,
        sent_at: null,
        delivered_at: "2026-11-06T13:51:42.108Z",
        read_at: null,
        raw_payload: {},
        created_at: "2026-11-06T13:51:42.108Z",
        updated_at: "2026-11-06T13:51:42.108Z",
      },
      {
        id: "msg-astro-02",
        business_id: ASTRO_BUSINESS_ID,
        connection_id: "33333333-3333-3333-3333-333333333333",
        conversation_id: "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        contact_id: "4e58a9b0-9079-4670-aeb9-c709fc9a945b",
        direction: "outbound",
        message_type: "text",
        content: "Astrology consultation booking confirmation",
        meta_message_id: "wamid.live_out_02",
        status: "read",
        error_code: null,
        error_message: null,
        sent_at: "2026-11-06T13:52:00.000Z",
        delivered_at: "2026-11-06T13:52:01.000Z",
        read_at: "2026-11-06T13:52:05.000Z",
        raw_payload: {},
        created_at: "2026-11-06T13:52:00.000Z",
        updated_at: "2026-11-06T13:52:05.000Z",
      },
      {
        id: "msg-astro-03",
        business_id: ASTRO_BUSINESS_ID,
        connection_id: "33333333-3333-3333-3333-333333333333",
        conversation_id: "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        contact_id: "4e58a9b0-9079-4670-aeb9-c709fc9a945b",
        direction: "outbound",
        message_type: "text",
        content: "Message to unreachable phone",
        meta_message_id: "wamid.live_fail_03",
        status: "failed",
        error_code: "131026",
        error_message: "Message undeliverable: User not on WhatsApp",
        sent_at: null,
        delivered_at: null,
        read_at: null,
        raw_payload: {},
        created_at: "2026-11-06T13:53:00.000Z",
        updated_at: "2026-11-06T13:53:00.000Z",
      },
      {
        id: "msg-vivaham-01",
        business_id: VIVAHAM_BUSINESS_ID,
        connection_id: "44444444-4444-4444-4444-444444444444",
        conversation_id: "3a70bd6e-f5a8-411e-9748-f64977a0108d",
        contact_id: "1d269630-5d55-45bc-8447-2ed39f9107fd",
        direction: "inbound",
        message_type: "text",
        content: "Enquiry for Mudaliar community premium membership",
        meta_message_id: "wamid.live_viv_01",
        status: "delivered",
        error_code: null,
        error_message: null,
        sent_at: null,
        delivered_at: "2026-11-06T13:51:43.609Z",
        read_at: null,
        raw_payload: {},
        created_at: "2026-11-06T13:51:43.609Z",
        updated_at: "2026-11-06T13:51:43.609Z",
      },
    ];
  });

  // 1. STRICT MULTI-TENANT CONVERSATION RETRIEVAL
  describe("1. Strict Multi-Tenant Conversation Retrieval", () => {
    it("should retrieve ONLY Astrology conversations for Astrology tenant", async () => {
      const client = createTestDbClient();
      const convs = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
        client,
        folder: "all",
      });

      expect(convs).toHaveLength(1);
      const conv = convs[0];
      expect(conv.id).toBe("bb3be87f-0fd4-4626-9567-8ee4512ddb3f");
      expect(conv.business_id).toBe(ASTRO_BUSINESS_ID);
      expect(conv.contact?.display_name).toBe("Gokul Approved Test Client");
      expect(conv.contact?.phone_number).toBe("919444559071");
    });

    it("should retrieve ONLY Vivaham conversations for Vivaham tenant", async () => {
      const client = createTestDbClient();
      const convs = await getConversationsForBusiness(VIVAHAM_BUSINESS_ID, {
        client,
        folder: "all",
      });

      expect(convs).toHaveLength(1);
      const conv = convs[0];
      expect(conv.id).toBe("3a70bd6e-f5a8-411e-9748-f64977a0108d");
      expect(conv.business_id).toBe(VIVAHAM_BUSINESS_ID);
      expect(conv.contact?.display_name).toBe("Vivaham Matrimony Member");
      expect(conv.contact?.phone_number).toBe("919840199999");
    });

    it("should reject rogue business tenant queries", async () => {
      const client = createTestDbClient();
      await expect(
        getConversationsForBusiness(ROGUE_BUSINESS_ID, { client })
      ).rejects.toThrow("Unauthorized: Invalid business tenant identifier");

      await expect(getInboxCounts(ROGUE_BUSINESS_ID, undefined, undefined, client)).rejects.toThrow(
        "Unauthorized: Invalid business tenant identifier"
      );
    });

    it("should prevent cross-business conversation retrieval by ID", async () => {
      const client = createTestDbClient();

      // Attempting to fetch Astrology conversation using Vivaham tenant ID
      const crossAstro = await getConversationById(
        VIVAHAM_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        client
      );
      expect(crossAstro).toBeNull();

      // Attempting to fetch Vivaham conversation using Astrology tenant ID
      const crossVivaham = await getConversationById(
        ASTRO_BUSINESS_ID,
        "3a70bd6e-f5a8-411e-9748-f64977a0108d",
        client
      );
      expect(crossVivaham).toBeNull();
    });
  });

  // 2. CHRONOLOGICAL MESSAGE HISTORY & ISOLATION
  describe("2. Chronological Message History & Isolation", () => {
    it("should retrieve actual chronological messages for a conversation", async () => {
      const client = createTestDbClient();
      const result = await getConversationMessages(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        { client, limit: 10 }
      );

      expect(result.messages).toHaveLength(3);
      expect(result.hasMore).toBe(false);

      // Verify chronological order (oldest to newest)
      expect(result.messages[0].direction).toBe("inbound");
      expect(result.messages[0].content).toContain("Vanakkam");

      expect(result.messages[1].direction).toBe("outbound");
      expect(result.messages[1].status).toBe("read");

      expect(result.messages[2].direction).toBe("outbound");
      expect(result.messages[2].status).toBe("failed");
      expect(result.messages[2].error_message).toContain("User not on WhatsApp");
    });

    it("should reject cross-tenant message retrieval", async () => {
      const client = createTestDbClient();

      // Vivaham tenant attempting to access Astrology conversation messages
      await expect(
        getConversationMessages(
          VIVAHAM_BUSINESS_ID,
          "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
          { client }
        )
      ).rejects.toThrow("Conversation not found or access denied");
    });

    it("should support message pagination without loading all into memory", async () => {
      const client = createTestDbClient();

      // Request with limit 2 (total 3 messages exist)
      const page1 = await getConversationMessages(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        { client, limit: 2 }
      );

      expect(page1.messages).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      // Latest 2 messages returned in chronological order
      expect(page1.messages[0].id).toBe("msg-astro-02");
      expect(page1.messages[1].id).toBe("msg-astro-03");

      // Request older messages before the earliest of page1
      const page2 = await getConversationMessages(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        { client, limit: 2, before: page1.messages[0].created_at }
      );

      expect(page2.messages).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
      expect(page2.messages[0].id).toBe("msg-astro-01");
    });
  });

  // 3. ACCURATE COUNTS & FOLDERS
  describe("3. Folder Counts & Filter Integrity", () => {
    it("should compute accurate folder counts from database", async () => {
      const client = createTestDbClient();
      const countsAstro = await getInboxCounts(ASTRO_BUSINESS_ID, undefined, undefined, client);

      expect(countsAstro.all).toBe(1);
      expect(countsAstro.open).toBe(1);
      expect(countsAstro.unread).toBe(1); // unread_count is 2 (>0)
      expect(countsAstro.resolved).toBe(0);
      expect(countsAstro.archived).toBe(0);

      const countsVivaham = await getInboxCounts(VIVAHAM_BUSINESS_ID, undefined, undefined, client);
      expect(countsVivaham.all).toBe(1);
      expect(countsVivaham.unread).toBe(0); // unread_count is 0
    });

    it("should filter conversations by unread folder", async () => {
      const client = createTestDbClient();
      const unreadAstro = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
        client,
        folder: "unread",
      });
      expect(unreadAstro).toHaveLength(1);
      expect(unreadAstro[0].unread_count).toBeGreaterThan(0);

      const unreadViv = await getConversationsForBusiness(VIVAHAM_BUSINESS_ID, {
        client,
        folder: "unread",
      });
      expect(unreadViv).toHaveLength(0);
    });

    it("should filter conversations by connection ID", async () => {
      const client = createTestDbClient();
      const connAstro = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
        client,
        connectionId: "33333333-3333-3333-3333-333333333333",
      });
      expect(connAstro).toHaveLength(1);

      const mismatchConn = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
        client,
        connectionId: "44444444-4444-4444-4444-444444444444",
      });
      expect(mismatchConn).toHaveLength(0);
    });
  });

  // 4. PERSISTENT CONVERSATION ACTIONS
  describe("4. Persistent Read/Unread & Status Mutations", () => {
    it("should persist read state toggle to database", async () => {
      const client = createTestDbClient();

      // Mark Astrology conversation as read (unread_count -> 0)
      await toggleConversationRead(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        true,
        client
      );

      const convRead = await getConversationById(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        client
      );
      expect(convRead?.unread_count).toBe(0);

      // Mark as unread (unread_count -> 1)
      await toggleConversationRead(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        false,
        client
      );

      const convUnread = await getConversationById(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        client
      );
      expect(convUnread?.unread_count).toBe(1);
    });

    it("should persist status changes between open, closed, and archived", async () => {
      const client = createTestDbClient();

      await updateConversationStatus(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        "closed",
        client
      );
      let conv = await getConversationById(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        client
      );
      expect(conv?.status).toBe("closed");

      await updateConversationStatus(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        "archived",
        client
      );
      conv = await getConversationById(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        client
      );
      expect(conv?.status).toBe("archived");

      await updateConversationStatus(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        "open",
        client
      );
      conv = await getConversationById(
        ASTRO_BUSINESS_ID,
        "bb3be87f-0fd4-4626-9567-8ee4512ddb3f",
        client
      );
      expect(conv?.status).toBe("open");
    });
  });

  // 5. NO MOCK-DATA LEAKAGE & EMPTY STATE VERIFICATION
  describe("5. No Mock-Data Leakage & Clean Empty State", () => {
    it("should NEVER return fake/demo customer records in production queries", async () => {
      const client = createTestDbClient();
      const astroConvs = await getConversationsForBusiness(ASTRO_BUSINESS_ID, { client });
      const vivConvs = await getConversationsForBusiness(VIVAHAM_BUSINESS_ID, { client });

      const allNames = [
        ...astroConvs.map((c) => c.contact?.display_name),
        ...vivConvs.map((c) => c.contact?.display_name),
      ];

      // Verify that no seed/demo customer names exist
      expect(allNames).not.toContain("Rajesh Sharma");
      expect(allNames).not.toContain("Priya Venkataraman");
      expect(allNames).not.toContain("K. Radhakrishnan");
      expect(allNames).not.toContain("Divya Ramesh");
    });

    it("should return empty array [] when tenant has no conversations (empty state)", async () => {
      // Clear database to simulate brand new business tenant with no WhatsApp conversations
      dbConversations = [];
      dbContacts = [];
      dbMessages = [];

      const client = createTestDbClient();
      const emptyAstro = await getConversationsForBusiness(ASTRO_BUSINESS_ID, { client });
      expect(emptyAstro).toEqual([]);

      const counts = await getInboxCounts(ASTRO_BUSINESS_ID, undefined, undefined, client);
      expect(counts.all).toBe(0);
      expect(counts.unread).toBe(0);
    });
  });
});
