import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  getConversationsForBusinessDb,
  updateConversationLabelsDb,
} from "@/lib/inbox/database";
import {
  getLabelStyle,
  getSuggestedLabelsForBusiness,
  normalizeConversationLabels,
} from "@/lib/inbox/labels";
import {
  applySlashCommandReplacement,
  extractSlashCommandQuery,
  filterCannedResponses,
  normalizeShortcut,
} from "@/lib/inbox/slash-commands";
import {
  createCannedResponseDb,
  deleteCannedResponseDb,
  listCannedResponsesDb,
  resetMockCannedResponsesStore,
  updateCannedResponseDb,
} from "@/lib/inbox/canned-responses";
import {
  clearInMemoryMediaStore,
  deleteBusinessLogoFile,
  getStoredMediaFile,
  storeBusinessLogoFile,
  validateBusinessLogoFile,
  verifyTenantStoragePath,
} from "@/lib/media/storage";
import {
  getBusinessSettings,
  resetStoreForTests as resetConnectionsStore,
} from "@/lib/connections/store";
import { resetMockCrmStore } from "@/lib/crm/database";
import {
  createCannedResponseAction,
  deleteCannedResponseAction,
  startNewConversationAction,
  updateCannedResponseAction,
  updateConversationLabelsAction,
} from "@/app/actions/inbox";
import {
  removeBusinessLogoAction,
  uploadBusinessLogoAction,
} from "@/app/actions/connections";
import { GET as downloadMediaGet } from "@/app/api/media/download/route";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockAuthRole: "owner" | "admin" | "agent" | "viewer" = "owner";
let mockAuthSlug: string = "astrology";

vi.mock("@/lib/auth/tenant-guard", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    validateBusinessAccess: vi.fn(async (businessSlug: string) => {
      if (businessSlug === "astrology") {
        return {
          business: {
            id: ASTRO_BUSINESS_ID,
            slug: "astrology",
            name: "Gokul's Astrological Insights",
            accent_color: "purple",
            is_active: true,
          },
          membership: {
            id: "mem-astro-test",
            business_id: ASTRO_BUSINESS_ID,
            user_id: "owner-user-00000000-0000-0000-0000-000000000001",
            role: mockAuthSlug === "astrology" ? mockAuthRole : "owner",
            is_active: true,
          },
          user: {
            id: "owner-user-00000000-0000-0000-0000-000000000001",
            email: "owner@astrology.test",
            full_name: "Astro Owner",
          },
        };
      }
      if (businessSlug === "vivaham") {
        return {
          business: {
            id: VIVAHAM_BUSINESS_ID,
            slug: "vivaham",
            name: "Gokul Vivaham",
            accent_color: "rose",
            is_active: true,
          },
          membership: {
            id: "mem-vivaham-test",
            business_id: VIVAHAM_BUSINESS_ID,
            user_id: "owner-user-00000000-0000-0000-0000-000000000001",
            role: mockAuthSlug === "vivaham" ? mockAuthRole : "owner",
            is_active: true,
          },
          user: {
            id: "owner-user-00000000-0000-0000-0000-000000000001",
            email: "owner@vivaham.test",
            full_name: "Vivaham Owner",
          },
        };
      }
      throw new Error(`Unauthorized business access: ${businessSlug}`);
    }),
  };
});

// Valid minimal 1x1 PNG buffer
const VALID_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

const VALID_SVG_BUFFER = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4f46e5"/></svg>`,
  "utf8"
);

describe("Optional UI Enhancements — Comprehensive Verification Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    mockAuthRole = "owner";
    mockAuthSlug = "astrology";
    resetMockCannedResponsesStore();
    resetMockCrmStore();
    resetConnectionsStore();
    clearInMemoryMediaStore();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. DATABASE MIGRATION 025 PGLITE REPLAY, TRIGGERS & REALTIME PUBLICATION
  // ============================================================================
  describe("1. Migration 025 (wa_canned_responses, business_settings.logo_url, Realtime)", () => {
    let db: PGlite;

    beforeAll(async () => {
      db = new PGlite();
      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
        END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
          SELECT '${TEST_USER_ID}'::UUID;
        $$;
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
          SELECT jsonb_build_object('sub', '${TEST_USER_ID}', 'role', 'service_role');
        $$;
      `);

      const migrationFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      expect(migrationFiles.some((f) => f.includes("025_optional_ui_enhancements"))).toBe(true);

      for (const file of migrationFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
        await db.exec(sql);
      }
    });

    it("1.1 Creates public.wa_canned_responses with tenant immutability trigger, unique shortcut & RLS", async () => {
      const tableCheck = await db.query<any>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wa_canned_responses';`
      );
      expect(tableCheck.rows.length).toBe(1);

      const triggerCheck = await db.query<any>(
        `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'wa_canned_responses';`
      );
      expect(triggerCheck.rows.map((r) => r.trigger_name)).toContain(
        "trg_wa_canned_responses_immutable_business_id"
      );

      // Verify seeded business-specific canned responses
      const astroRows = await db.query<any>(
        `SELECT shortcut FROM public.wa_canned_responses WHERE business_id = $1 ORDER BY shortcut;`,
        [ASTRO_BUSINESS_ID]
      );
      expect(astroRows.rows.map((r) => r.shortcut)).toContain("pricing");
      expect(astroRows.rows.map((r) => r.shortcut)).toContain("birthdetails");

      const vivahamRows = await db.query<any>(
        `SELECT shortcut FROM public.wa_canned_responses WHERE business_id = $1 ORDER BY shortcut;`,
        [VIVAHAM_BUSINESS_ID]
      );
      expect(vivahamRows.rows.map((r) => r.shortcut)).toContain("plans");
      expect(vivahamRows.rows.map((r) => r.shortcut)).toContain("register");

      // Tenant immutability trigger prevents reassigning business_id
      await expect(
        db.query(
          `UPDATE public.wa_canned_responses SET business_id = $1 WHERE business_id = $2;`,
          [VIVAHAM_BUSINESS_ID, ASTRO_BUSINESS_ID]
        )
      ).rejects.toThrow(/Tenant reassignment forbidden/i);
    });

    it("1.2 Adds nullable logo_url column to public.business_settings without breaking existing rows", async () => {
      const colCheck = await db.query<any>(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_settings'
          AND column_name = 'logo_url';
      `);
      expect(colCheck.rows.length).toBe(1);
      expect(colCheck.rows[0].data_type).toBe("text");
      expect(colCheck.rows[0].is_nullable).toBe("YES");

      const settingsRows = await db.query<any>(
        `SELECT business_id, logo_placeholder, logo_url FROM public.business_settings ORDER BY business_id;`
      );
      expect(settingsRows.rows.length).toBe(2);
      expect(settingsRows.rows[0].logo_url).toBeNull();
    });
  });

  // ============================================================================
  // 2. CONVERSATION LABELS PICKER & SIDEBAR FILTERING
  // ============================================================================
  describe("2. Conversation Labels Picker & Sidebar Label Filtering", () => {
    it("2.1 Normalizes labels cleanly (trims, caps length, deduplicates case-insensitively)", () => {
      const normalized = normalizeConversationLabels([
        "  VIP ",
        "vip",
        "Follow-up Required",
        "",
        "   ",
        "Consultation Booked",
      ]);
      expect(normalized).toEqual(["VIP", "Follow-up Required", "Consultation Booked"]);
    });

    it("2.2 Provides distinct business-specific label suggestions and consistent pill styling", () => {
      const astroLabels = getSuggestedLabelsForBusiness("astrology");
      const vivahamLabels = getSuggestedLabelsForBusiness("vivaham");

      expect(astroLabels).toContain("Consultation Booked");
      expect(astroLabels).not.toContain("Profile Verified");

      expect(vivahamLabels).toContain("Profile Verified");
      expect(vivahamLabels).not.toContain("Consultation Booked");

      const vipStyle = getLabelStyle("VIP");
      expect(vipStyle.bg).toContain("amber");
      const customStyle = getLabelStyle("Custom Tag");
      expect(customStyle.dot).toBeTruthy();
    });

    it("2.3 Blocks viewer role from updating conversation labels and throws on DB failure", async () => {
      mockAuthRole = "viewer";
      const res = await updateConversationLabelsAction({
        businessSlug: "astrology",
        conversationId: "conv-1",
        labels: ["VIP"],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");

      // DB error propagation (not silently swallowed)
      const failingClient = {
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: { message: "RLS policy rejected update" } }),
            }),
          }),
        }),
      };

      await expect(
        updateConversationLabelsDb(ASTRO_BUSINESS_ID, "conv-1", ["VIP"], failingClient)
      ).rejects.toThrow(/Failed to update conversation labels/i);
    });

    it("2.4 Filters conversations by label in getConversationsForBusinessDb", async () => {
      const mockConvs = [
        {
          id: "conv-1",
          business_id: ASTRO_BUSINESS_ID,
          connection_id: "conn-1",
          status: "open",
          labels: ["VIP", "Consultation Booked"],
          last_message_at: new Date().toISOString(),
        },
        {
          id: "conv-2",
          business_id: ASTRO_BUSINESS_ID,
          connection_id: "conn-1",
          status: "open",
          labels: ["Payment Pending"],
          last_message_at: new Date().toISOString(),
        },
      ];

      const mockClient: any = {
        from: () => {
          let rows = [...mockConvs];
          const chain: any = {
            select: () => chain,
            eq: (col: string, val: any) => {
              rows = rows.filter((r: any) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              rows = rows.filter((r: any) => r[col] !== val);
              return chain;
            },
            contains: (col: string, val: string[]) => {
              rows = rows.filter((r: any) => val.every((v) => (r[col] || []).includes(v)));
              return chain;
            },
            order: () => chain,
            range: () => Promise.resolve({ data: rows, error: null }),
          };
          return chain;
        },
      };

      const vipOnly = await getConversationsForBusinessDb(ASTRO_BUSINESS_ID, {
        label: "VIP",
        client: mockClient,
      });
      expect(vipOnly.map((c) => c.id)).toEqual(["conv-1"]);
    });

    it("2.5 Verifies label picker UI & sidebar label filter wiring in inbox components", () => {
      const chatSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/inbox/ChatWindowPanel.tsx"),
        "utf8"
      );
      const navSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/inbox/ConversationNavPanel.tsx"),
        "utf8"
      );
      const inboxSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/inbox/InboxClient.tsx"),
        "utf8"
      );

      expect(chatSrc).toContain("Conversation labels picker");
      expect(chatSrc).toContain("onUpdateLabels");
      expect(navSrc).toContain("onSelectLabel");
      expect(inboxSrc).toContain("updateConversationLabelsAction");
    });
  });

  // ============================================================================
  // 3. START NEW CHAT MODAL & CONVERSATION INITIATION ACTION
  // ============================================================================
  describe("3. Start New Chat Modal & Conversation Initiation", () => {
    it("3.1 Blocks viewer role, invalid E.164 numbers, and cross-business connections", async () => {
      mockAuthRole = "viewer";
      const viewerRes = await startNewConversationAction({
        businessSlug: "astrology",
        phoneNumber: "+919840012345",
        displayName: "New Lead",
        templateName: "hello_world",
      });
      expect(viewerRes.success).toBe(false);
      expect(viewerRes.error).toContain("Viewers cannot initiate");

      mockAuthRole = "owner";
      const badPhoneRes = await startNewConversationAction({
        businessSlug: "astrology",
        phoneNumber: "123",
        displayName: "Short Phone",
        templateName: "hello_world",
      });
      expect(badPhoneRes.success).toBe(false);

      const crossConnRes = await startNewConversationAction({
        businessSlug: "astrology",
        phoneNumber: "+919840012345",
        displayName: "Cross Line",
        connectionId: "conn-vivaham-01",
        templateName: "hello_world",
      });
      expect(crossConnRes.success).toBe(false);
      expect(crossConnRes.error).toContain("does not belong to this business");
    });

    it("3.2 Rejects missing template variables before attempting dispatch", async () => {
      const missingVarsRes = await startNewConversationAction({
        businessSlug: "astrology",
        phoneNumber: "+91 98400 12345",
        displayName: "Arjun",
        connectionId: "conn-astro-01",
        templateName: "consultation_confirmation",
        templateVariables: { "1": "Arjun" }, // missing {{2}} and {{3}}
      });

      expect(missingVarsRes.success).toBe(false);
      expect(missingVarsRes.error).toContain("Missing required template variable");
    });

    it("3.2b Initiates new conversation with arbitrary phone number and approved template", async () => {
      const whatsappClient = await import("@/lib/whatsapp/client");
      const metaSpy = vi
        .spyOn(whatsappClient, "sendMetaTemplateMessage")
        .mockResolvedValueOnce({
          messaging_product: "whatsapp",
          contacts: [{ input: "919840099111", wa_id: "919840099111" }],
          messages: [{ id: "wamid.start_chat_test_01" }],
        });

      const serverMod = await import("@/lib/supabase/server");
      const crmContacts: any[] = [];
      const waConvs: any[] = [];
      const waMsgs: any[] = [];

      const mockSb: any = {
        from(table: string) {
          let rows: any[] = [];
          if (table === "wa_contacts") rows = crmContacts;
          else if (table === "wa_conversations") rows = waConvs;
          else if (table === "wa_messages") rows = waMsgs;
          else if (table === "wa_connections") {
            rows = [
              {
                id: "conn-astro-01",
                business_id: ASTRO_BUSINESS_ID,
                display_name: "Astrology Consultations",
                phone_number: "+91 98400 12345",
                phone_number_id: "109283746501928",
                is_enabled: true,
                wa_credentials: [],
              },
            ];
          }

          let filtered = [...rows];
          const chain: any = {
            select: () => chain,
            eq: (col: string, val: any) => {
              filtered = filtered.filter((r) => r[col] === val);
              return chain;
            },
            in: (col: string, vals: any[]) => {
              filtered = filtered.filter((r) => vals.includes(r[col]));
              return chain;
            },
            or: () => chain,
            order: () => chain,
            limit: (n: number) => {
              filtered = filtered.slice(0, n);
              return chain;
            },
            maybeSingle: async () => ({ data: filtered[0] || null, error: null }),
            single: async () => ({ data: filtered[0] || null, error: filtered[0] ? null : new Error("Not found") }),
            insert: (payload: any) => {
              const items = Array.isArray(payload) ? payload : [payload];
              const created = items.map((p) => ({
                id: p.id || `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ...p,
              }));
              rows.push(...created);
              return {
                select: () => ({
                  single: async () => ({ data: created[0], error: null }),
                }),
                then: (resolve: any) => resolve({ data: created, error: null }),
              };
            },
            upsert: (payload: any) => {
              let existing = rows.find(
                (r) =>
                  (table === "wa_contacts" &&
                    r.business_id === payload.business_id &&
                    r.phone_number === payload.phone_number) ||
                  (table === "wa_conversations" &&
                    r.connection_id === payload.connection_id &&
                    r.contact_id === payload.contact_id)
              );
              if (existing) {
                Object.assign(existing, payload);
              } else {
                existing = {
                  id: payload.id || `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  ...payload,
                };
                rows.push(existing);
              }
              return {
                select: () => ({
                  single: async () => ({ data: existing, error: null }),
                }),
              };
            },
            update: (patch: any) => ({
              eq: (col: string, val: any) => {
                rows.forEach((r) => {
                  if (r[col] === val) Object.assign(r, patch);
                });
                return Promise.resolve({ error: null });
              },
            }),
            then: (resolve: any) => resolve({ data: filtered, error: null }),
          };
          return chain;
        },
      };

      vi.spyOn(serverMod, "createServerSupabaseClient").mockResolvedValue(mockSb);
      process.env.META_TEST_PHONE_NUMBER_ID = "109283746501928";
      process.env.META_TEST_ACCESS_TOKEN = "TEST_TOKEN_START_CHAT";

      const res = await startNewConversationAction({
        businessSlug: "astrology",
        phoneNumber: "+91 98400 99111",
        displayName: "Meera Krishnan",
        category: "Astrology Consultation",
        connectionId: "conn-astro-01",
        templateName: "consultation_confirmation",
        templateLanguage: "en_US",
        templateVariables: {
          "1": "Meera Krishnan",
          "2": "Friday, Nov 14",
          "3": "10:30 AM",
        },
      });

      // Either succeeds via mock client or mock store fallback
      expect(res.success).toBe(true);
      expect(res.conversationId).toBeTruthy();
      expect(res.message?.message_type).toBe("template");
      expect(metaSpy).toHaveBeenCalledTimes(1);
    });

    it("3.3 Verifies StartConversationModal and + New Chat button exist in Inbox UI", () => {
      const modalPath = path.join(process.cwd(), "src/components/inbox/StartConversationModal.tsx");
      expect(fs.existsSync(modalPath)).toBe(true);

      const listSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/inbox/ConversationListPanel.tsx"),
        "utf8"
      );
      const inboxSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/inbox/InboxClient.tsx"),
        "utf8"
      );

      expect(listSrc).toContain("onOpenStartChat");
      expect(listSrc).toContain("New Chat");
      expect(inboxSrc).toContain("StartConversationModal");
    });
  });

  // ============================================================================
  // 4. QUICK REPLIES / CANNED RESPONSES (/shortcut)
  // ============================================================================
  describe("4. Quick Replies / Canned Responses (/shortcut)", () => {
    it("4.1 Extracts slash command queries accurately and ignores mid-word/URL slashes", () => {
      expect(extractSlashCommandQuery("/", 1)).toEqual({
        query: "",
        startIndex: 0,
        endIndex: 1,
      });
      expect(extractSlashCommandQuery("Namaste /pri", 12)).toEqual({
        query: "pri",
        startIndex: 8,
        endIndex: 12,
      });
      expect(extractSlashCommandQuery("https://example.com/pricing", 27)).toBeNull();
      expect(extractSlashCommandQuery("hello/world", 11)).toBeNull();
    });

    it("4.2 Replaces active /shortcut cleanly while preserving surrounding message text", () => {
      const text = "Vanakkam! /pri please confirm";
      const match = extractSlashCommandQuery(text, 14)!;
      expect(match).not.toBeNull();

      const replaced = applySlashCommandReplacement(
        text,
        match,
        "Consultation fee is Rs. 1,500."
      );
      expect(replaced.nextText).toBe("Vanakkam! Consultation fee is Rs. 1,500. please confirm");
    });

    it("4.3 Supports full tenant-isolated CRUD on canned responses and enforces role/uniqueness", async () => {
      const astroList = await listCannedResponsesDb(ASTRO_BUSINESS_ID, {
        businessSlug: "astrology",
      });
      const vivahamList = await listCannedResponsesDb(VIVAHAM_BUSINESS_ID, {
        businessSlug: "vivaham",
      });

      expect(astroList.some((r) => r.shortcut === "pricing")).toBe(true);
      expect(vivahamList.some((r) => r.shortcut === "plans")).toBe(true);
      expect(astroList.some((r) => r.shortcut === "plans")).toBe(false);

      // Create custom response in Astrology
      const created = await createCannedResponseDb(ASTRO_BUSINESS_ID, {
        shortcut: "/Temple Timing ",
        title: "Pariharam Timing",
        content: "Auspicious timing is 10:30 AM IST.",
        category: "info",
        businessSlug: "astrology",
      });
      expect(created.shortcut).toBe("temple-timing");

      // Duplicate shortcut rejected in same business
      await expect(
        createCannedResponseDb(ASTRO_BUSINESS_ID, {
          shortcut: "temple-timing",
          title: "Duplicate",
          content: "Duplicate content",
        })
      ).rejects.toThrow(/already exists/i);

      // Same shortcut allowed in Vivaham (strictly separate tenant namespace)
      const vivahamSameShortcut = await createCannedResponseDb(VIVAHAM_BUSINESS_ID, {
        shortcut: "temple-timing",
        title: "Vivaham Timing",
        content: "Vivaham desk timing.",
        businessSlug: "vivaham",
      });
      expect(vivahamSameShortcut.business_id).toBe(VIVAHAM_BUSINESS_ID);

      // Cross-tenant update/delete rejected
      await expect(
        updateCannedResponseDb(VIVAHAM_BUSINESS_ID, created.id, { title: "Hijack" })
      ).rejects.toThrow(/not found or access denied/i);

      await expect(
        deleteCannedResponseDb(VIVAHAM_BUSINESS_ID, created.id)
      ).rejects.toThrow(/not found or access denied/i);

      // Viewer role blocked on server actions
      mockAuthRole = "viewer";
      const viewerCreate = await createCannedResponseAction({
        businessSlug: "astrology",
        shortcut: "blocked",
        title: "Blocked",
        content: "Viewers cannot create",
      });
      expect(viewerCreate.success).toBe(false);
      expect(viewerCreate.error).toContain("Unauthorized");

      // Owner can update and delete via actions
      mockAuthRole = "owner";
      const actionCreated = await createCannedResponseAction({
        businessSlug: "astrology",
        shortcut: "remedy",
        title: "Remedy Kit",
        content: "Courier tracking will be shared.",
        category: "general",
      });
      expect(actionCreated.success).toBe(true);

      const actionUpdated = await updateCannedResponseAction({
        businessSlug: "astrology",
        responseId: actionCreated.response!.id,
        title: "Updated Remedy Kit",
      });
      expect(actionUpdated.success).toBe(true);
      expect(actionUpdated.response?.title).toBe("Updated Remedy Kit");

      const actionDeleted = await deleteCannedResponseAction({
        businessSlug: "astrology",
        responseId: actionCreated.response!.id,
      });
      expect(actionDeleted.success).toBe(true);

      // Filter check
      const filtered = filterCannedResponses(astroList, "bank");
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered[0].shortcut).toBe("bank");
      expect(normalizeShortcut("/My Shortcut!!")).toBe("my-shortcut");
    });
  });

  // ============================================================================
  // 5. REALTIME PUSH ON NOTIFICATION BELL
  // ============================================================================
  describe("5. Realtime Push on NotificationBell", () => {
    it("5.1 Subscribes NotificationBell and NotificationsClient to crm_follow_up_reminders via Supabase Realtime", () => {
      const bellSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/notifications/NotificationBell.tsx"),
        "utf8"
      );
      const pageSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/notifications/NotificationsClient.tsx"),
        "utf8"
      );
      const headerSrc = fs.readFileSync(
        path.join(process.cwd(), "src/components/workspace/WorkspaceHeader.tsx"),
        "utf8"
      );

      expect(bellSrc).toContain(".channel(`notifications:${business.id}`)");
      expect(bellSrc).toContain('table: "crm_follow_up_reminders"');
      expect(bellSrc).toContain("business_id=eq.${business.id}");
      expect(bellSrc).toContain("removeChannel");
      expect(bellSrc).toContain("workspace:notifications-sync");

      expect(pageSrc).toContain('table: "crm_follow_up_reminders"');
      expect(pageSrc).toContain("removeChannel");

      expect(headerSrc).toContain("<NotificationBell business={business} userId={user.id} />");
    });
  });

  // ============================================================================
  // 6. CUSTOM BUSINESS LOGO FILE UPLOAD & TENANT-SCOPED SERVING
  // ============================================================================
  describe("6. Custom Business Logo File Upload & Security", () => {
    it("6.1 Validates PNG/SVG magic bytes and blocks malicious SVGs or invalid formats", () => {
      expect(validateBusinessLogoFile("image/png", VALID_PNG_BUFFER, "logo.png").valid).toBe(true);
      expect(validateBusinessLogoFile("image/svg+xml", VALID_SVG_BUFFER, "logo.svg").valid).toBe(
        true
      );

      // Spoofed PNG bytes
      expect(
        validateBusinessLogoFile("image/png", Buffer.from("not-a-png"), "fake.png").valid
      ).toBe(false);

      // Malicious SVG with <script> or onload=
      const xssSvg = Buffer.from(`<svg onload="alert(1)"><script>alert(1)</script></svg>`, "utf8");
      const xssCheck = validateBusinessLogoFile("image/svg+xml", xssSvg, "evil.svg");
      expect(xssCheck.valid).toBe(false);
      expect(xssCheck.error).toContain("prohibited active scripting");

      // Disallowed MIME
      expect(
        validateBusinessLogoFile("text/html", Buffer.from("<h1>hi</h1>"), "index.html").valid
      ).toBe(false);
    });

    it("6.2 Stores logos strictly in tenant-scoped paths and blocks cross-tenant access", async () => {
      const stored = await storeBusinessLogoFile({
        businessId: ASTRO_BUSINESS_ID,
        fileBuffer: VALID_PNG_BUFFER,
        mimeType: "image/png",
        originalFilename: "../../etc/astro-logo.png",
      });

      expect(stored.storagePath.startsWith(`businesses/${ASTRO_BUSINESS_ID}/branding/`)).toBe(
        true
      );
      expect(verifyTenantStoragePath(ASTRO_BUSINESS_ID, stored.storagePath)).toBe(true);
      expect(verifyTenantStoragePath(VIVAHAM_BUSINESS_ID, stored.storagePath)).toBe(false);

      const retrieved = await getStoredMediaFile(ASTRO_BUSINESS_ID, stored.storagePath);
      expect(retrieved.size).toBe(VALID_PNG_BUFFER.length);

      await expect(
        getStoredMediaFile(VIVAHAM_BUSINESS_ID, stored.storagePath)
      ).rejects.toThrow(/Cross-tenant media access violation/i);

      await deleteBusinessLogoFile(ASTRO_BUSINESS_ID, stored.logoUrl);
      await expect(
        getStoredMediaFile(ASTRO_BUSINESS_ID, stored.storagePath)
      ).rejects.toThrow(/Media file not found/i);
    });

    it("6.3 Enforces owner/admin role on uploadBusinessLogoAction & serves SVG with CSP sandbox", async () => {
      // Agents and Viewers cannot upload/remove business branding
      mockAuthRole = "agent";
      const agentUpload = await uploadBusinessLogoAction({
        businessSlug: "astrology",
        filename: "logo.png",
        mimeType: "image/png",
        fileSize: VALID_PNG_BUFFER.length,
        base64Data: VALID_PNG_BUFFER.toString("base64"),
      });
      expect(agentUpload.success).toBe(false);
      expect(agentUpload.error).toContain("owners and administrators");

      // Owner uploads clean SVG logo
      mockAuthRole = "owner";
      const ownerUpload = await uploadBusinessLogoAction({
        businessSlug: "astrology",
        filename: "astro-brand.svg",
        mimeType: "image/svg+xml",
        fileSize: VALID_SVG_BUFFER.length,
        base64Data: VALID_SVG_BUFFER.toString("base64"),
      });
      expect(ownerUpload.success).toBe(true);
      expect(ownerUpload.logoUrl).toContain("/api/media/download");
      expect(getBusinessSettings(ASTRO_BUSINESS_ID).logo_url).toBe(ownerUpload.logoUrl);
      expect(getBusinessSettings(VIVAHAM_BUSINESS_ID).logo_url).toBeNull();

      // Verify /api/media/download serves SVG with sandbox CSP header and rejects cross-tenant biz
      const urlObj = new URL(`http://localhost:3000${ownerUpload.logoUrl}`);
      const okRes = await downloadMediaGet(new NextRequest(urlObj));
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get("Content-Type")).toBe("image/svg+xml");
      expect(okRes.headers.get("Content-Security-Policy")).toContain("sandbox");

      const crossUrl = new URL(urlObj.toString());
      crossUrl.searchParams.set("biz", VIVAHAM_BUSINESS_ID);
      const crossRes = await downloadMediaGet(new NextRequest(crossUrl));
      expect(crossRes.status).toBe(403);

      // Owner removes logo cleanly
      const removed = await removeBusinessLogoAction("astrology");
      expect(removed.success).toBe(true);
      expect(getBusinessSettings(ASTRO_BUSINESS_ID).logo_url).toBeNull();
    });
  });
});
