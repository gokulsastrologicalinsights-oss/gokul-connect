import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { triggerQueueWorkerAction } from "@/app/actions/automations";
import { exportContactsToCsvString } from "@/lib/crm/database";
import { exportAnalyticsCsv } from "@/lib/analytics/service";
import { encryptSecret, decryptSecret } from "@/lib/crypto/encryption";
import { sendWhatsAppMessageService } from "@/lib/whatsapp/service";
import {
  ASTROLOGY_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/templates/default-templates";

describe("Phase 11.2.1 — Security Findings Remediation Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // DOMAIN 1: SEC-MED-01 — QUEUE WORKER AUTHORIZATION
  // =========================================================================
  describe("SEC-MED-01: Queue Worker Server Action Authorization Guard", () => {
    it("1.1 should reject invocation when business slug is missing or empty", async () => {
      // @ts-expect-error test invalid invocation without args
      const resNoArgs = await triggerQueueWorkerAction();
      expect(resNoArgs.success).toBe(false);
      expect(resNoArgs.error).toContain("Business slug is required");

      const resEmpty = await triggerQueueWorkerAction("   ");
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error).toContain("Business slug is required");
    });

    it("1.2 should reject invocation when business slug is invalid", async () => {
      const resInvalid = await triggerQueueWorkerAction("non_existent_tenant_slug");
      expect(resInvalid.success).toBe(false);
    });

    it("1.3 should execute worker successfully for authorized business", async () => {
      const res = await triggerQueueWorkerAction("astrology");
      expect(res.success).toBe(true);
      if (res.data) {
        expect(res.data).toHaveProperty("claimedCount");
        expect(res.data).toHaveProperty("processedCount");
      }
    });

    it("1.4 should apply rate limiting to prevent rapid manual worker spamming", async () => {
      // Trigger multiple rapid requests to check rate limiting
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

  // =========================================================================
  // DOMAIN 2: SEC-MED-02 — CSV FORMULA INJECTION NEUTRALIZATION
  // =========================================================================
  describe("SEC-MED-02: CSV Formula Injection (CWE-1236) Neutralization", () => {
    it("2.1 should neutralize formula injection payloads with leading '=', '@', tabs, carriage returns", () => {
      const maliciousContacts: any[] = [
        {
          display_name: "=cmd|' /C calc'!A0",
          phone_number: "919999000001",
          email: "victim1@example.com",
        },
        {
          display_name: "@SUM(1+1)*cmd|' /C notepad'!A0",
          phone_number: "919999000002",
          email: "@evil@domain.com",
        },
        {
          display_name: "   =HYPERLINK(\"http://evil.com\",\"Click\")",
          phone_number: "919999000003",
          email: "victim3@example.com",
        },
        {
          display_name: "\t=cmd",
          phone_number: "919999000004",
          email: "victim4@example.com",
        },
        {
          display_name: "\r+calc",
          phone_number: "919999000005",
          email: "victim5@example.com",
        },
        {
          display_name: "-2+3*cmd|' /C calc'!A0",
          phone_number: "919999000006",
          email: "victim6@example.com",
        },
      ];

      const csv = exportContactsToCsvString(maliciousContacts);

      // Verify each malicious value is safely neutralized with a leading single quote
      expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
      expect(csv).toContain("\"'@SUM(1+1)*cmd|' /C notepad'!A0\"");
      expect(csv).toContain("\"'@evil@domain.com\"");
      expect(csv).toContain("\"'   =HYPERLINK(\"\"http://evil.com\"\",\"\"Click\"\")\"");
      expect(csv).toContain("\"'\t=cmd\"");
      expect(csv).toContain("\"'\r+calc\"");
      expect(csv).toContain("\"'-2+3*cmd|' /C calc'!A0\"");
    });

    it("2.2 should preserve ordinary phone numbers and negative numbers without unnecessary quoting", () => {
      const legitimateContacts: any[] = [
        {
          display_name: "Normal Contact",
          phone_number: "+919876543210",
          category: "Regular Client",
        },
        {
          display_name: "International Contact",
          phone_number: "+1 (555) 019-2834",
          category: "VIP",
        },
      ];

      const csv = exportContactsToCsvString(legitimateContacts);

      // Standard international phone format must not be corrupted with a leading quote
      expect(csv).toContain('"+919876543210"');
      expect(csv).toContain('"+1 (555) 019-2834"');
    });

    it("2.3 should preserve Tamil and English text with UTF-8 BOM", () => {
      const bilingualContacts: any[] = [
        {
          display_name: "கார்த்திக் சுப்பிரமணியன் (Karthik Subramanian)",
          phone_number: "919988776655",
          category: "ஜோதிட ஆலோசனை (Horoscope Consultation)",
        },
        {
          display_name: "பிரியா ராமச்சந்திரன் (Priya Ramachandran)",
          phone_number: "919988776644",
          category: "வரன் விவரங்கள் (Vivaham Profile)",
        },
      ];

      const csv = exportContactsToCsvString(bilingualContacts);

      // Must start with UTF-8 BOM
      expect(csv.startsWith("\uFEFF")).toBe(true);

      // Tamil text preserved exactly
      expect(csv).toContain("கார்த்திக் சுப்பிரமணியன் (Karthik Subramanian)");
      expect(csv).toContain("ஜோதிட ஆலோசனை (Horoscope Consultation)");
      expect(csv).toContain("பிரியா ராமச்சந்திரன் (Priya Ramachandran)");
      expect(csv).toContain("வரன் விவரங்கள் (Vivaham Profile)");
    });

    it("2.4 should neutralize formula injection in Analytics CSV export", () => {
      const mockAnalyticsData: any = {
        businessSlug: "=cmd|' /C calc'!A0",
        dateRange: {
          label: "7d",
          istStartFormatted: "2026-11-01",
          istEndFormatted: "2026-11-07",
        },
        generatedAtIst: "2026-11-07 19:00:00",
        messaging: {
          totalInbound: 10,
          totalOutbound: 15,
          totalMessages: 25,
          delivered: 14,
          read: 12,
          failed: 1,
          pending: 0,
          deliveryRatePercent: 93.3,
          readRatePercent: 85.7,
        },
        contacts: {
          totalContacts: 50,
          newContacts: 5,
          activeContacts: 20,
          inactiveContacts: 30,
          sources: [],
        },
        inbox: {
          totalConversations: 20,
          openConversations: 5,
          pendingHumanHandovers: 1,
          closedConversations: 14,
          unreadConversations: 0,
          averageFirstResponseTimeFormatted: "2m 15s",
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
          summaryText: "Test Summary",
          breakdown: [],
        },
        dailyTrends: [],
      };

      const csv = exportAnalyticsCsv(mockAnalyticsData, "@InjectedBusinessName");
      expect(csv).toContain("\"'@InjectedBusinessName\"");
      expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
    });
  });

  // =========================================================================
  // DOMAIN 3: SEC-LOW-01 — APPROVED TEMPLATE OUTBOUND VALIDATION
  // =========================================================================
  describe("SEC-LOW-01: Outbound Template Status & Connection Validation", () => {
    const validCreds = encryptSecret("EAAX_valid_mock_meta_token_12345");

    const mockConnections = [
      {
        id: "conn-1",
        business_id: ASTROLOGY_BUSINESS_ID,
        display_name: "Astro Official",
        phone_number_id: "100000000000001",
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
        template_name: "draft_template",
        status: "DRAFT",
        is_archived: false,
      },
      {
        id: "tpl-archived",
        business_id: ASTROLOGY_BUSINESS_ID,
        connection_id: "conn-1",
        template_name: "archived_template",
        status: "APPROVED",
        is_archived: true,
      },
      {
        id: "tpl-rejected",
        business_id: ASTROLOGY_BUSINESS_ID,
        connection_id: "conn-1",
        template_name: "rejected_template",
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
      {
        id: "tpl-approved",
        business_id: ASTROLOGY_BUSINESS_ID,
        connection_id: null,
        template_name: "consultation_confirmation",
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
          else if (table === "wa_contacts") dataset = [{ id: "c-1", phone_number: "919999000001" }];
          else if (table === "wa_conversations") dataset = [{ id: "conv-1", connection_id: "conn-1" }];
          else if (table === "wa_messages") dataset = [];

          let filtered = [...dataset];

          const chain: any = {
            select() { return chain; },
            eq(col: string, val: any) {
              filtered = filtered.filter((r) => r[col] === val);
              return chain;
            },
            single: async () => ({
              data: filtered[0] || null,
              error: filtered.length === 0 ? new Error("Row not found") : null,
            }),
            maybeSingle: async () => ({
              data: filtered[0] || null,
              error: null,
            }),
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
            update() {
              return {
                eq() {
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
          };
          return chain;
        },
      };
    }

    it("3.1 should reject template dispatch when template is in DRAFT status", async () => {
      const res = await sendWhatsAppMessageService({
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        recipientPhone: "919999000001",
        template: { name: "draft_template" },
        supabaseClient: createMockClient(),
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("status is \"DRAFT\"");
    });

    it("3.2 should reject template dispatch when template is archived", async () => {
      const res = await sendWhatsAppMessageService({
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        recipientPhone: "919999000001",
        template: { name: "archived_template" },
        supabaseClient: createMockClient(),
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("is archived");
    });

    it("3.3 should reject template dispatch when template is REJECTED", async () => {
      const res = await sendWhatsAppMessageService({
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        recipientPhone: "919999000001",
        template: { name: "rejected_template" },
        supabaseClient: createMockClient(),
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("status is \"REJECTED\"");
    });

    it("3.4 should reject template dispatch when template belongs to a different connection", async () => {
      const res = await sendWhatsAppMessageService({
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        recipientPhone: "919999000001",
        template: { name: "wrong_conn_template" },
        supabaseClient: createMockClient(),
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("cannot be dispatched over \"conn-1\"");
    });

    it("3.5 should reject template dispatch when template does not exist for the business", async () => {
      const res = await sendWhatsAppMessageService({
        businessId: ASTROLOGY_BUSINESS_ID,
        connectionId: "conn-1",
        recipientPhone: "919999000001",
        template: { name: "non_existent_random_template" },
        supabaseClient: createMockClient(),
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("not found for this business workspace");
    });
  });

  // =========================================================================
  // DOMAIN 4: SEC-LOW-02 — ENCRYPTION SECRET PRODUCTION GUARD
  // =========================================================================
  describe("SEC-LOW-02: Encryption Secret Production Fail-Closed Guard", () => {
    it("4.1 should fail closed in production when APP_ENCRYPTION_SECRET is missing", () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.APP_ENCRYPTION_SECRET;

      expect(() => encryptSecret("sensitive_token")).toThrow(
        /CRITICAL SECURITY CONFIGURATION ERROR/
      );
    });

    it("4.2 should fail closed in production when APP_ENCRYPTION_SECRET is empty or whitespace", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.APP_ENCRYPTION_SECRET = "    ";

      expect(() => encryptSecret("sensitive_token")).toThrow(
        /CRITICAL SECURITY CONFIGURATION ERROR/
      );
    });

    it("4.3 should fail closed in production when APP_ENCRYPTION_SECRET is insecure placeholder", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.APP_ENCRYPTION_SECRET = "your_dedicated_app_encryption_secret_placeholder";

      expect(() => encryptSecret("sensitive_token")).toThrow(
        /CRITICAL SECURITY CONFIGURATION ERROR/
      );
    });

    it("4.4 should fail closed in production when secret is shorter than 32 characters", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.APP_ENCRYPTION_SECRET = "too_short_key_12345";

      expect(() => encryptSecret("sensitive_token")).toThrow(
        /CRITICAL SECURITY CONFIGURATION ERROR/
      );
    });

    it("4.5 should succeed in production when strong 32+ character key is provided", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.APP_ENCRYPTION_SECRET = "a_very_strong_production_master_encryption_key_32bytes!!";

      const enc = encryptSecret("test_production_token");
      expect(enc).toHaveProperty("ciphertext");
      expect(decryptSecret(enc)).toBe("test_production_token");
    });

    it("4.6 should preserve development fallback in development and test environments", () => {
      (process.env as any).NODE_ENV = "test";
      delete process.env.APP_ENCRYPTION_SECRET;

      const enc = encryptSecret("test_dev_token");
      expect(enc).toHaveProperty("ciphertext");
      expect(decryptSecret(enc)).toBe("test_dev_token");
    });
  });
});
