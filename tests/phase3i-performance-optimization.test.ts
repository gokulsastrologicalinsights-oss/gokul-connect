import { describe, expect, it } from "vitest";
import {
  getConversationsForBusiness,
  getInboxCounts,
  getConversationMessages,
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/store";
import { WhatsAppContact, WhatsAppConversation, WhatsAppMessage } from "@/types/database";

describe("Phase 3I: Supabase Database Performance & Query Optimization Tests", () => {
  // Realistic multi-page test dataset
  const astroContacts: WhatsAppContact[] = Array.from({ length: 60 }, (_, i) => ({
    id: `contact-astro-${i + 1}`,
    business_id: ASTRO_BUSINESS_ID,
    phone_number: `9198400${String(i + 1).padStart(5, "0")}`,
    display_name: i === 55 ? "Target Special Customer Gokul" : `Astro Client ${i + 1}`,
    profile_photo_url: null,
    metadata: {},
    created_at: new Date(Date.now() - (60 - i) * 60000).toISOString(),
    updated_at: new Date(Date.now() - (60 - i) * 60000).toISOString(),
  }));

  const astroConversations: WhatsAppConversation[] = astroContacts.map((contact, i) => ({
    id: `conv-astro-${i + 1}`,
    business_id: ASTRO_BUSINESS_ID,
    connection_id: "conn-astro-01",
    contact_id: contact.id,
    status: i % 5 === 0 ? "pending_human" : i % 3 === 0 ? "closed" : "open",
    last_message_preview: `Inquiry message ${i + 1}`,
    last_message_at: new Date(Date.now() - (60 - i) * 60000).toISOString(),
    unread_count: i % 4 === 0 ? 2 : 0,
    created_at: new Date(Date.now() - (60 - i) * 60000).toISOString(),
    updated_at: new Date(Date.now() - (60 - i) * 60000).toISOString(),
  }));

  const vivahamContacts: WhatsAppContact[] = Array.from({ length: 20 }, (_, i) => ({
    id: `contact-viv-${i + 1}`,
    business_id: VIVAHAM_BUSINESS_ID,
    phone_number: `9198409${String(i + 1).padStart(5, "0")}`,
    display_name: `Vivaham Bride/Groom ${i + 1}`,
    profile_photo_url: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const vivahamConversations: WhatsAppConversation[] = vivahamContacts.map((contact, i) => ({
    id: `conv-viv-${i + 1}`,
    business_id: VIVAHAM_BUSINESS_ID,
    connection_id: "conn-viv-01",
    contact_id: contact.id,
    status: "open",
    last_message_preview: `Vivaham inquiry ${i + 1}`,
    last_message_at: new Date().toISOString(),
    unread_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const astroMessages: WhatsAppMessage[] = [
    {
      id: "msg-01",
      business_id: ASTRO_BUSINESS_ID,
      connection_id: "conn-astro-01",
      conversation_id: "conv-astro-1",
      contact_id: "contact-astro-1",
      direction: "inbound",
      message_type: "text",
      content: "Hello from Astro Client 1",
      meta_message_id: "wamid.01",
      status: "delivered",
      error_code: null,
      error_message: null,
      sent_at: null,
      delivered_at: new Date().toISOString(),
      read_at: null,
      created_at: new Date(Date.now() - 50000).toISOString(),
      updated_at: new Date(Date.now() - 50000).toISOString(),
    },
    {
      id: "msg-02",
      business_id: ASTRO_BUSINESS_ID,
      connection_id: "conn-astro-01",
      conversation_id: "conv-astro-1",
      contact_id: "contact-astro-1",
      direction: "outbound",
      message_type: "text",
      content: "Welcome to Gokul Astrology",
      meta_message_id: "wamid.02",
      status: "sent",
      error_code: null,
      error_message: null,
      sent_at: new Date().toISOString(),
      delivered_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  function createInstrumentedMockClient() {
    let rpcCallCount = 0;
    let queryCallCount = 0;
    let totalRowsFetched = 0;

    return {
      getStats() {
        return { rpcCallCount, queryCallCount, totalRowsFetched };
      },

      rpc(fn: string, args: Record<string, any>) {
        rpcCallCount++;
        if (fn === "get_inbox_counts") {
          const bId = args.p_business_id;
          const convs = bId === ASTRO_BUSINESS_ID ? astroConversations : vivahamConversations;
          return Promise.resolve({
            data: {
              all: convs.filter((c) => c.status !== "archived").length,
              unread: convs.filter((c) => c.unread_count > 0 && c.status !== "archived").length,
              unassigned: convs.filter((c) => c.status !== "archived").length,
              assigned_to_me: convs.filter((c) => c.status !== "archived").length,
              open: convs.filter((c) => c.status === "open").length,
              pending: convs.filter((c) => c.status === "pending_human").length,
              resolved: convs.filter((c) => c.status === "closed").length,
              archived: convs.filter((c) => c.status === "archived").length,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: new Error(`Unknown RPC ${fn}`) });
      },

      from(table: string) {
        queryCallCount++;
        let rows: any[] = [];
        if (table === "wa_conversations") {
          rows = [...astroConversations, ...vivahamConversations].map((c) => {
            const allContacts = [...astroContacts, ...vivahamContacts];
            return {
              ...c,
              contact: allContacts.find((ct) => ct.id === c.contact_id),
              connection: { id: c.connection_id, display_name: "Mock Line" },
            };
          });
        } else if (table === "wa_messages") {
          rows = [...astroMessages];
        }

        let chain = {
          eq(col: string, val: any) {
            rows = rows.filter((r) => r[col] === val);
            return chain;
          },
          neq(col: string, val: any) {
            rows = rows.filter((r) => r[col] !== val);
            return chain;
          },
          gt(col: string, val: any) {
            rows = rows.filter((r) => r[col] > val);
            return chain;
          },
          lt(col: string, val: any) {
            rows = rows.filter((r) => r[col] < val);
            return chain;
          },
          or(expression: string, options?: { referencedTable?: string }) {
            // Simulate PostgREST referencedTable or filter
            if (options?.referencedTable === "contact") {
              const terms = expression.split(",").map((t) => {
                const parts = t.split(".ilike.");
                return { col: parts[0].trim(), pattern: parts[1].replace(/%/g, "").toLowerCase() };
              });
              rows = rows.filter((r) => {
                const contact = r.contact;
                if (!contact) return false;
                return terms.some((t) => {
                  const val = String(contact[t.col] || "").toLowerCase();
                  return val.includes(t.pattern);
                });
              });
            }
            return chain;
          },
          order(col: string, { ascending = true } = {}) {
            rows.sort((a, b) => {
              const valA = a[col] || "";
              const valB = b[col] || "";
              return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
            });
            return chain;
          },
          range(from: number, to: number) {
            rows = rows.slice(from, to + 1);
            return chain;
          },
          limit(n: number) {
            rows = rows.slice(0, n);
            return chain;
          },
          maybeSingle() {
            totalRowsFetched += rows.length > 0 ? 1 : 0;
            return Promise.resolve({ data: rows.length > 0 ? rows[0] : null, error: null });
          },
          then(resolve: (res: { data: any[]; error: any }) => void) {
            totalRowsFetched += rows.length;
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          },
        };

        return {
          select(cols = "*") {
            return chain;
          },
        };
      },
    };
  }

  // 1. INBOX COUNT AGGREGATION VIA ATOMIC RPC
  it("TC-PERF-01: getInboxCounts calls get_inbox_counts RPC with zero bulk conversation fetches", async () => {
    const client = createInstrumentedMockClient();
    const counts = await getInboxCounts(ASTRO_BUSINESS_ID, undefined, undefined, client);

    const stats = client.getStats();
    expect(stats.rpcCallCount).toBe(1);
    expect(stats.queryCallCount).toBe(0); // Did not fetch raw table rows
    expect(stats.totalRowsFetched).toBe(0); // Zero conversation records transferred

    expect(counts.all).toBe(60);
    expect(counts.open).toBeGreaterThan(0);
    expect(counts.pending).toBeGreaterThan(0);
  });

  // 2. SEARCH PAGINATION CORRECTION (DATABASE-DRIVEN FILTERING)
  it("TC-PERF-02: Search occurs before pagination, finding contacts located on later pages", async () => {
    const client = createInstrumentedMockClient();

    // "Target Special Customer Gokul" is contact index 55 (page 2 in a 50-item page size)
    const results = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
      client,
      searchQuery: "Target Special",
      limit: 10,
      offset: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].contact?.display_name).toContain("Target Special Customer Gokul");
  });

  it("TC-PERF-03: Searches partial customer name accurately", async () => {
    const client = createInstrumentedMockClient();
    const results = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
      client,
      searchQuery: "Client 10",
    });

    expect(results).toHaveLength(1);
    expect(results[0].contact?.display_name).toBe("Astro Client 10");
  });

  it("TC-PERF-04: Searches full phone number accurately", async () => {
    const client = createInstrumentedMockClient();
    const results = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
      client,
      searchQuery: "919840000005",
    });

    expect(results).toHaveLength(1);
    expect(results[0].contact?.phone_number).toBe("919840000005");
  });

  it("TC-PERF-05: Strict business isolation during search queries", async () => {
    const client = createInstrumentedMockClient();

    // Vivaham searching for Astro client name returns 0
    const vivResults = await getConversationsForBusiness(VIVAHAM_BUSINESS_ID, {
      client,
      searchQuery: "Astro Client",
    });
    expect(vivResults).toHaveLength(0);

    // Astro searching for Vivaham client name returns 0
    const astroResults = await getConversationsForBusiness(ASTRO_BUSINESS_ID, {
      client,
      searchQuery: "Vivaham Bride",
    });
    expect(astroResults).toHaveLength(0);
  });

  // 3. REDUNDANT DATABASE ROUND-TRIP REMOVAL
  it("TC-PERF-06: getConversationMessages fetches messages in a single query when messages exist", async () => {
    const client = createInstrumentedMockClient();
    const result = await getConversationMessages(ASTRO_BUSINESS_ID, "conv-astro-1", {
      client,
      limit: 10,
    });

    const stats = client.getStats();
    expect(stats.queryCallCount).toBe(1); // Exactly 1 round-trip! No wa_conversations check
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe("Hello from Astro Client 1");
  });

  it("TC-PERF-07: getConversationMessages still strictly enforces tenant authorization on cross-tenant requests", async () => {
    const client = createInstrumentedMockClient();

    // Vivaham tenant attempting to access Astro conversation
    await expect(
      getConversationMessages(VIVAHAM_BUSINESS_ID, "conv-astro-1", { client })
    ).rejects.toThrow("Conversation not found or access denied");
  });
});
