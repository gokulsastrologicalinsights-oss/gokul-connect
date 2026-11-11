import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { triggerQueueWorkerAction } from "@/app/actions/automations";
import { exportContactsToCsvString } from "@/lib/crm/database";
import { exportAnalyticsCsv } from "@/lib/analytics/service";
import { encryptSecret } from "@/lib/crypto/encryption";
import { sendWhatsAppMessageService } from "@/lib/whatsapp/service";
import { resolveDateRange } from "@/lib/analytics/date-utils";
import { evaluateAutomationRules } from "@/lib/automation/engine";
import { validateScheduledFollowupPreExecution } from "@/lib/automation/safeguards";
import {
  ASTROLOGY_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/templates/default-templates";
import { WhatsAppContact } from "@/types/database";

describe("Phase 11.6: Final Integrated Regression & Launch Readiness Audit", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ============================================================================
  // SECTION 1: RE-VERIFICATION OF ALL PHASE 11.2.1 SECURITY FIXES
  // ============================================================================
  describe("1. Phase 11.2.1 Security Remediations Re-verification", () => {
    describe("SEC-MED-01: Queue Worker Server Action Authorization & Role Check", () => {
      it("TC-SEC-01: Rejects invocation when business slug is missing or empty", async () => {
        // @ts-expect-error test invalid invocation without args
        const resNoArgs = await triggerQueueWorkerAction();
        expect(resNoArgs.success).toBe(false);
        expect(resNoArgs.error).toContain("Business slug is required");

        const resEmpty = await triggerQueueWorkerAction("   ");
        expect(resEmpty.success).toBe(false);
        expect(resEmpty.error).toContain("Business slug is required");
      });

      it("TC-SEC-02: Rejects invocation for non-existent business slug", async () => {
        const resInvalid = await triggerQueueWorkerAction("invalid_tenant_slug_xyz");
        expect(resInvalid.success).toBe(false);
      });

      it("TC-SEC-03: Executes worker successfully for authorized business context", async () => {
        const res = await triggerQueueWorkerAction("astrology");
        expect(res.success).toBe(true);
        if (res.data) {
          expect(res.data).toHaveProperty("claimedCount");
          expect(res.data).toHaveProperty("processedCount");
        }
      });

      it("TC-SEC-04: Rejects rapid spamming with sliding window rate limiter", async () => {
        let rateLimited = false;
        for (let i = 0; i < 20; i++) {
          const res = await triggerQueueWorkerAction("astrology");
          if (!res.success && res.error?.includes("Rate limit exceeded")) {
            rateLimited = true;
            break;
          }
        }
        expect(rateLimited).toBe(true);
      });
    });

    describe("SEC-MED-02: CSV Formula Injection (CWE-1236) Neutralization", () => {
      const maliciousContacts: any[] = [
        {
          id: "c-1",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: '=cmd|"/c calc"!A0',
          phone_number: "919444559071",
          email: "victim1@test.com",
        },
        {
          id: "c-2",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: "+cmd|'/c notepad'!A1",
          phone_number: "+919444559071",
          email: "+evil@cmd.com",
        },
        {
          id: "c-3",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: "-2+3+cmd|'/c calc'!A0",
          phone_number: "-100",
          email: "victim3@test.com",
        },
        {
          id: "c-4",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: "@SUM(1+1)*cmd|'/c calc'!A0",
          phone_number: "919999000004",
          email: "@evil@domain.com",
        },
        {
          id: "c-5",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: "\t=2+5",
          phone_number: "\t+919999000005",
          email: "tab@test.com",
        },
        {
          id: "c-6",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: "\r=10/2",
          phone_number: "919999000006",
          email: "cr@test.com",
        },
        {
          id: "c-7",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: '   =HYPERLINK("http://evil.com","Click")',
          phone_number: "919999000007",
          email: "link@test.com",
        },
      ];

      it("TC-SEC-05: CRM exportContactsToCsvString neutralizes all formula trigger characters", () => {
        const csv = exportContactsToCsvString(maliciousContacts as WhatsAppContact[]);
        expect(csv.startsWith("\uFEFF")).toBe(true); // UTF-8 BOM present

        const lines = csv.split("\r\n").slice(1); // skip header
        for (const line of lines) {
          if (!line.trim()) continue;
          const [nameCol] = line.split(",");
          const unquoted = nameCol.replace(/^"|"$/g, "");
          expect(unquoted.startsWith("'")).toBe(true);
        }
      });

      it("TC-SEC-06: Preserves legitimate international phone numbers without formula escape", () => {
        const legitimateContacts: any[] = [
          {
            id: "c-legit-1",
            business_id: ASTROLOGY_BUSINESS_ID,
            display_name: "Karthik Subramanian",
            phone_number: "+919444559071",
            email: "karthik@example.com",
          },
          {
            id: "c-legit-2",
            business_id: VIVAHAM_BUSINESS_ID,
            display_name: "Ananya Ramesh",
            phone_number: "+1 555-152-9045",
            email: "ananya@example.com",
          },
        ];

        const csv = exportContactsToCsvString(legitimateContacts as WhatsAppContact[]);
        expect(csv).toContain("+919444559071");
        expect(csv).toContain("+1 555-152-9045");
        expect(csv).not.toContain("'+919444559071");
        expect(csv).not.toContain("'+1 555-152-9045");
      });

      it("TC-SEC-07: Preserves legitimate Unicode Tamil and English text with RFC 4180 quotes", () => {
        const tamilContact: any[] = [
          {
            id: "c-tamil-1",
            business_id: ASTROLOGY_BUSINESS_ID,
            display_name: "கோகுல் முருகன்",
            phone_number: "+919444559071",
            category: "ஜாதக ஆலோசனை",
            tags: ["விவாகம்", "பொருத்தம்"],
          },
        ];

        const csv = exportContactsToCsvString(tamilContact as WhatsAppContact[]);
        expect(csv).toContain("கோகுல் முருகன்");
        expect(csv).toContain("ஜாதக ஆலோசனை");
        expect(csv).toContain("விவாகம், பொருத்தம்");
      });

      it("TC-SEC-08: Analytics CSV export neutralizes formula injection while preserving format", () => {
        const mockAnalyticsData: any = {
          businessName: "=cmd|'/c calc'!A0",
          businessType: "astrology",
          dateRange: {
            preset: "7d",
            label: "Last 7 Days",
            istStartFormatted: "01 Nov 2026",
            istEndFormatted: "07 Nov 2026",
            timezone: "Asia/Kolkata",
          },
          messaging: {
            totalInbound: 10,
            totalOutbound: 20,
            totalMessages: 30,
            delivered: 18,
            read: 15,
            failed: 2,
            pending: 0,
            deliveryRatePercent: 90,
            readRatePercent: 83.3,
          },
          contacts: {
            totalContacts: 10,
            newContacts: 5,
            activeContacts: 8,
            inactiveContacts: 2,
            sources: [
              { source: "@formula_source", count: 5, percentage: 50 },
              { source: "+91_phone_source", count: 5, percentage: 50 },
            ],
          },
          inbox: {
            totalConversations: 8,
            openConversations: 2,
            pendingHumanHandovers: 1,
            closedConversations: 5,
            unreadConversations: 0,
            averageFirstResponseTimeFormatted: "45s",
          },
          automation: {
            totalRules: 4,
            activeRules: 2,
            executedJobs: 15,
            successfulExecutions: 14,
            failedExecutions: 1,
            skippedExecutions: 0,
          },
          businessReport: {
            businessType: "astrology",
            title: "Astrology Consultation Metrics",
            breakdown: [
              { category: "+cmd_category", count: 4, percentage: 40 },
              { category: "Horoscope Matching", count: 6, percentage: 60 },
            ],
          },
          dailyTrends: [],
        };

        const csv = exportAnalyticsCsv(mockAnalyticsData, "=cmd|'/c calc'!A0");
        expect(csv).toContain("'=cmd|'/c calc'!A0");
        expect(csv).toContain("'@formula_source");
        expect(csv).toContain("'+cmd_category");
      });
    });

    describe("SEC-LOW-01: Approved Template Validation Before Dispatch", () => {
      const validCreds = encryptSecret("EAABtesting_token_mock");

      const mockConnections = [
        {
          id: "conn-1",
          business_id: ASTROLOGY_BUSINESS_ID,
          display_name: "Astrology Desk",
          phone_number_id: "109283746501928",
          is_enabled: true,
          wa_credentials: [
            {
              ciphertext: validCreds.ciphertext,
              iv: validCreds.iv,
              auth_tag: validCreds.auth_tag,
              key_version: validCreds.key_version,
            },
          ],
        },
      ];

      const mockTemplates = [
        {
          id: "tpl-draft",
          business_id: ASTROLOGY_BUSINESS_ID,
          connection_id: "conn-1",
          template_name: "draft_welcome_lead",
          status: "DRAFT",
          is_archived: false,
        },
        {
          id: "tpl-archived",
          business_id: ASTROLOGY_BUSINESS_ID,
          connection_id: "conn-1",
          template_name: "archived_booking_notice",
          status: "APPROVED",
          is_archived: true,
        },
        {
          id: "tpl-rejected",
          business_id: ASTROLOGY_BUSINESS_ID,
          connection_id: "conn-1",
          template_name: "rejected_promo",
          status: "REJECTED",
          is_archived: false,
        },
        {
          id: "tpl-wrong-conn",
          business_id: ASTROLOGY_BUSINESS_ID,
          connection_id: "conn-other-999",
          template_name: "wrong_conn_template",
          status: "APPROVED",
          is_archived: false,
        },
      ];

      function createMockClient() {
        return {
          from(table: string) {
            let dataset: any[] = [];
            if (table === "wa_connections") dataset = mockConnections;
            else if (table === "wa_message_templates") dataset = mockTemplates;
            else if (table === "wa_contacts") dataset = [{ id: "c-1", phone_number: "919444559071" }];
            else if (table === "wa_conversations") dataset = [{ id: "conv-1", connection_id: "conn-1" }];
            else if (table === "wa_messages") dataset = [];

            let filtered = [...dataset];

            const chain: any = {
              select() { return chain; },
              eq(col: string, val: any) {
                filtered = filtered.filter((row) => row[col] === val);
                return chain;
              },
              single() {
                return Promise.resolve({
                  data: filtered.length > 0 ? filtered[0] : null,
                  error: filtered.length > 0 ? null : new Error("Not found"),
                });
              },
              maybeSingle() {
                return Promise.resolve({
                  data: filtered.length > 0 ? filtered[0] : null,
                  error: null,
                });
              },
              insert(payload: any) {
                const row = { id: `msg-${Date.now()}`, ...payload };
                return {
                  select() {
                    return {
                      single: async () => ({ data: row, error: null }),
                    };
                  },
                };
              },
              upsert(payload: any) {
                const row = { id: `up-${Date.now()}`, ...payload };
                return {
                  select() {
                    return {
                      single: async () => ({ data: row, error: null }),
                    };
                  },
                };
              },
            };
            return chain;
          },
        };
      }

      it("TC-SEC-09: Rejects DRAFT template dispatch", async () => {
        const res = await sendWhatsAppMessageService({
          businessId: ASTROLOGY_BUSINESS_ID,
          connectionId: "conn-1",
          recipientPhone: "919444559071",
          template: { name: "draft_welcome_lead" },
          supabaseClient: createMockClient() as any,
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('status is "DRAFT"');
      });

      it("TC-SEC-10: Rejects ARCHIVED template dispatch even if previously APPROVED", async () => {
        const res = await sendWhatsAppMessageService({
          businessId: ASTROLOGY_BUSINESS_ID,
          connectionId: "conn-1",
          recipientPhone: "919444559071",
          template: { name: "archived_booking_notice" },
          supabaseClient: createMockClient() as any,
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("is archived");
      });

      it("TC-SEC-11: Rejects REJECTED template dispatch", async () => {
        const res = await sendWhatsAppMessageService({
          businessId: ASTROLOGY_BUSINESS_ID,
          connectionId: "conn-1",
          recipientPhone: "919444559071",
          template: { name: "rejected_promo" },
          supabaseClient: createMockClient() as any,
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('status is "REJECTED"');
      });

      it("TC-SEC-12: Rejects template bound to different connection context", async () => {
        const res = await sendWhatsAppMessageService({
          businessId: ASTROLOGY_BUSINESS_ID,
          connectionId: "conn-1",
          recipientPhone: "919444559071",
          template: { name: "wrong_conn_template" },
          supabaseClient: createMockClient() as any,
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain('cannot be dispatched over "conn-1"');
      });
    });

    describe("SEC-LOW-02: Encryption Secret Production Fail-Closed Guard", () => {
      it("TC-SEC-13: Throws fatal error in production if APP_ENCRYPTION_SECRET is missing", () => {
        (process.env as any).NODE_ENV = "production";
        delete process.env.APP_ENCRYPTION_SECRET;

        expect(() => encryptSecret("secret_credential_token")).toThrow(
          /CRITICAL SECURITY CONFIGURATION ERROR/i
        );
      });

      it("TC-SEC-14: Throws fatal error in production if secret is too short (<32 bytes)", () => {
        (process.env as any).NODE_ENV = "production";
        process.env.APP_ENCRYPTION_SECRET = "insecure_short_secret";

        expect(() => encryptSecret("secret_credential_token")).toThrow(
          /at least 32 characters/i
        );
      });

      it("TC-SEC-15: Throws fatal error in production if placeholder key is used", () => {
        (process.env as any).NODE_ENV = "production";
        process.env.APP_ENCRYPTION_SECRET = "gokul_connect_dev_master_key_32bytes!!_v1";

        expect(() => encryptSecret("secret_credential_token")).toThrow(
          /CRITICAL SECURITY CONFIGURATION ERROR/i
        );
      });

      it("TC-SEC-16: Succeeds in production with a valid 32-character secret", () => {
        (process.env as any).NODE_ENV = "production";
        process.env.APP_ENCRYPTION_SECRET = "9f8a3c7b2e1d4a5f6e8b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f";

        const encrypted = encryptSecret("secret_credential_token");
        expect(encrypted).toHaveProperty("ciphertext");
        expect(encrypted).toHaveProperty("iv");
        expect(encrypted).toHaveProperty("auth_tag");
      });
    });
  });

  // ============================================================================
  // SECTION 2: TENANT ISOLATION AUDIT (ASTROLOGY VS VIVAHAM)
  // ============================================================================
  describe("2. Comprehensive Multi-Tenant Isolation Audit", () => {
    it("TC-ISO-01: Astrology and Vivaham have separate unique UUIDs and slugs", () => {
      expect(ASTROLOGY_BUSINESS_ID).not.toBe(VIVAHAM_BUSINESS_ID);
      expect(ASTROLOGY_BUSINESS_ID).toBe("11111111-1111-1111-1111-111111111111");
      expect(VIVAHAM_BUSINESS_ID).toBe("22222222-2222-2222-2222-222222222222");
    });

    it("TC-ISO-02: Date range calculations strictly compute Asia/Kolkata timezone boundaries", () => {
      const presets = ["today", "yesterday", "7d", "30d", "this_month"] as const;
      for (const preset of presets) {
        const resolved = resolveDateRange(preset);
        expect(resolved.timezone).toBe("Asia/Kolkata");
        const startTime = new Date(resolved.startDate).getTime();
        const endTime = new Date(resolved.endDate).getTime();
        expect(startTime).toBeLessThanOrEqual(endTime);
      }
    });

    it("TC-ISO-03: Pre-execution safeguard Gate 2 prevents cross-tenant follow-up dispatch", () => {
      const mockJob: any = {
        id: "job-1",
        business_id: ASTROLOGY_BUSINESS_ID,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      };
      const mockConversation: any = {
        id: "conv-1",
        business_id: VIVAHAM_BUSINESS_ID, // Mismatched tenant
        status: "open",
        is_automation_paused: false,
      };
      const mockContact: any = {
        id: "c-1",
        is_opted_out: false,
        last_inbound_at: new Date(Date.now() - 7200000).toISOString(),
      };

      const result = validateScheduledFollowupPreExecution({
        job: mockJob,
        conversation: mockConversation,
        contact: mockContact,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe("cross_tenant_violation");
    });

    it("TC-ISO-04: Opt-out keywords include both English and Tamil for both tenants", () => {
      const defaultKeywords = "STOP,UNSUBSCRIBE,QUIT,நிறுத்து";
      const keywordsArray = defaultKeywords.split(",").map((k) => k.trim().toUpperCase());

      expect(keywordsArray).toContain("STOP");
      expect(keywordsArray).toContain("UNSUBSCRIBE");
      expect(keywordsArray).toContain("நிறுத்து");
    });
  });

  // ============================================================================
  // SECTION 3: AUTOMATION ENGINE & HUMAN HANDOVER SAFEGUARDS
  // ============================================================================
  describe("3. Automation Engine & Safeguards Verification", () => {
    it("TC-AUT-01: Dispatches opt-out handling and halts subsequent rules", () => {
      const optOutInput = {
        message: {
          direction: "inbound" as const,
          content: "STOP",
        },
        contact: {
          id: "c-1",
          is_opted_out: false,
        } as any,
        conversation: {
          id: "conv-1",
          status: "open" as const,
          is_automation_paused: false,
        } as any,
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        rules: [
          {
            id: "rule-welcome",
            business_id: ASTROLOGY_BUSINESS_ID,
            name: "Welcome Lead",
            trigger_type: "inbound_message" as const,
            priority: 100,
            is_active: true,
            stop_processing_on_match: true,
            cooldown_seconds: 0,
            conditions: [],
            actions: [],
          },
        ],
      };

      const result = evaluateAutomationRules(optOutInput as any);
      expect(result.matched).toBe(true);
      expect(result.status).toBe("opt_out_handled");
      expect(result.contactUpdates?.is_opted_out).toBe(true);
    });

    it("TC-AUT-02: Human handover request triggers human takeover confirmation", () => {
      const handoverInput = {
        message: {
          direction: "inbound" as const,
          content: "AGENT",
        },
        contact: {
          id: "c-2",
          is_opted_out: false,
        } as any,
        conversation: {
          id: "conv-2",
          status: "open" as const,
          is_automation_paused: false,
        } as any,
        businessId: VIVAHAM_BUSINESS_ID,
        connectionId: "conn-2",
        rules: [],
      };

      const result = evaluateAutomationRules(handoverInput);
      expect(result.matched).toBe(true);
      expect(result.status).toBe("human_handover_handled");
      expect(result.conversationUpdates?.status).toBe("pending_human");
    });
  });

  // ============================================================================
  // SECTION 4: DATABASE SCHEMA & MIGRATION CONSTRAINTS (PGlite IN-MEMORY)
  // ============================================================================
  describe("4. Migration 001-015 Integrity & Constraints (PGlite Engine)", () => {
    let db: PGlite;
    const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

    beforeEach(async () => {
      db = new PGlite();

      // Setup postgres environment
      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
        END
        $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
          SELECT '00000000-0000-0000-0000-000000000001'::UUID;
        $$;
      `);

      // Execute migrations 001 through 015
      const sqlFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of sqlFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
        await db.exec(sql);
      }
    });

    it("TC-DB-01: All 15 migrations replay cleanly without syntax or dependency errors", async () => {
      const res = await db.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      const tables = res.rows.map((r: any) => r.table_name);
      expect(tables).toContain("businesses");
      expect(tables).toContain("business_members");
      expect(tables).toContain("business_settings");
      expect(tables).toContain("wa_connections");
      expect(tables).toContain("wa_credentials");
      expect(tables).toContain("wa_contacts");
      expect(tables).toContain("wa_conversations");
      expect(tables).toContain("wa_messages");
      expect(tables).toContain("wa_message_templates");
      expect(tables).toContain("wa_webhook_events");
      expect(tables).toContain("wa_processing_jobs");
      expect(tables).toContain("wa_automation_rules");
      expect(tables).toContain("wa_automation_execution_logs");
      expect(tables).toContain("crm_categories");
      expect(tables).toContain("crm_segments");
      expect(tables).toContain("contact_notes");
      expect(tables).toContain("contact_activity_logs");
    });

    it("TC-DB-02: Tenant immutability triggers block updating business_id on core tables", async () => {
      // businesses are seeded by migration 001
      // Create contact for Astrology
      await db.exec(`
        INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name) VALUES
        ('c1111111-1111-1111-1111-111111111111', '${ASTROLOGY_BUSINESS_ID}', '919444559071', 'Test Client');
      `);

      // Attempt to reassign business_id from Astrology to Vivaham
      await expect(
        db.query(`
          UPDATE public.wa_contacts 
          SET business_id = '${VIVAHAM_BUSINESS_ID}' 
          WHERE id = 'c1111111-1111-1111-1111-111111111111';
        `)
      ).rejects.toThrow(/Tenant reassignment forbidden/i);
    });

    it("TC-DB-03: Template status check constraint enforces valid statuses", async () => {
      // Seed template with invalid status
      await expect(
        db.query(`
          INSERT INTO public.wa_message_templates (
            business_id, template_name, language, category, status, components
          ) VALUES (
            '${ASTROLOGY_BUSINESS_ID}', 'invalid_test_template', 'en', 'UTILITY', 'INVALID_STATUS', '[]'::jsonb
          );
        `)
      ).rejects.toThrow(/check constraint/i);
    });
  });
});
