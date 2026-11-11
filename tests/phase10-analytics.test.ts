import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  getNowInKolkata,
  kolkataToUtc,
  formatKolkataDate,
  toKolkataDateString,
  resolveDateRange,
  generateDateBuckets,
  formatDuration,
} from "@/lib/analytics/date-utils";
import {
  getBusinessAnalytics,
  buildEmptyAnalyticsData,
  exportAnalyticsCsv,
} from "@/lib/analytics/service";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/database";

/**
 * Helper to build a chainable mock Supabase query client for testing table-level queries.
 */
function createMockClient(tableDataMap: Record<string, any[]>) {
  return {
    from: (table: string) => {
      const data = tableDataMap[table] || [];
      const queryBuilder: any = {
        data,
        error: null,
        select: () => queryBuilder,
        eq: () => queryBuilder,
        gte: () => queryBuilder,
        lte: () => queryBuilder,
        in: () => queryBuilder,
        order: () => queryBuilder,
        limit: () => queryBuilder,
        then: (resolve: any) => resolve({ data, error: null }),
      };
      return queryBuilder;
    },
    rpc: async () => ({ data: null, error: { message: "Simulated offline RPC" } }),
  };
}

describe("Phase 10 — Analytics & Business Reporting Test Suite", () => {
  const FIXED_DATE = new Date("2026-11-07T11:00:00.000Z"); // 16:30 IST

  // ============================================================================
  // DOMAIN 1: TIMEZONE & DATE-RANGE BOUNDARY CALCULATIONS (Asia/Kolkata)
  // ============================================================================
  describe("Domain 1: Timezone & Date Range Calculation (Asia/Kolkata)", () => {
    it("Test 1.1: getNowInKolkata accurately derives IST calendar components", () => {
      const ist = getNowInKolkata(FIXED_DATE);
      expect(ist.year).toBe(2026);
      expect(ist.month).toBe(10); // November (0-indexed: 10)
      expect(ist.date).toBe(7);
      expect(ist.hours).toBe(16);
      expect(ist.minutes).toBe(30);
    });

    it("Test 1.2: kolkataToUtc accurately converts IST boundary to UTC", () => {
      // 2026-11-07 00:00:00 IST -> 2026-11-06 18:30:00 UTC
      const startUtc = kolkataToUtc(2026, 10, 7, 0, 0, 0, 0);
      expect(startUtc.toISOString()).toBe("2026-11-06T18:30:00.000Z");

      // 2026-11-07 23:59:59.999 IST -> 2026-11-07 18:29:59.999 UTC
      const endUtc = kolkataToUtc(2026, 10, 7, 23, 59, 59, 999);
      expect(endUtc.toISOString()).toBe("2026-11-07T18:29:59.999Z");
    });

    it("Test 1.3: resolveDateRange resolves 'today' preset in IST", () => {
      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      expect(range.preset).toBe("today");
      expect(range.timezone).toBe("Asia/Kolkata");
      expect(range.startDate).toBe("2026-11-06T18:30:00.000Z");
      expect(range.endDate).toBe("2026-11-07T18:29:59.999Z");
    });

    it("Test 1.4: resolveDateRange resolves 'yesterday' preset in IST", () => {
      const range = resolveDateRange("yesterday", undefined, undefined, FIXED_DATE);
      expect(range.preset).toBe("yesterday");
      expect(range.startDate).toBe("2026-11-05T18:30:00.000Z");
      expect(range.endDate).toBe("2026-11-06T18:29:59.999Z");
    });

    it("Test 1.5: resolveDateRange resolves '7d' preset with 7 calendar day boundaries", () => {
      const range = resolveDateRange("7d", undefined, undefined, FIXED_DATE);
      expect(range.preset).toBe("7d");
      expect(range.startDate).toBe("2026-10-31T18:30:00.000Z"); // 2026-11-01 00:00 IST
      expect(range.endDate).toBe("2026-11-07T18:29:59.999Z");
    });

    it("Test 1.6: resolveDateRange resolves 'this_month' starting on the 1st in IST", () => {
      const range = resolveDateRange("this_month", undefined, undefined, FIXED_DATE);
      expect(range.preset).toBe("this_month");
      expect(range.startDate).toBe("2026-10-31T18:30:00.000Z"); // 2026-11-01 00:00 IST
      expect(range.endDate).toBe("2026-11-07T18:29:59.999Z");
    });

    it("Test 1.7: resolveDateRange resolves 'previous_month' cleanly", () => {
      const range = resolveDateRange("previous_month", undefined, undefined, FIXED_DATE);
      expect(range.preset).toBe("previous_month");
      expect(range.startDate).toBe("2026-09-30T18:30:00.000Z");
      expect(range.endDate).toBe("2026-10-31T18:29:59.999Z");
    });

    it("Test 1.8: resolveDateRange supports custom date boundaries", () => {
      const range = resolveDateRange("custom", "2026-11-02", "2026-11-05");
      expect(range.preset).toBe("custom");
      expect(range.startDate).toBe("2026-11-01T18:30:00.000Z");
      expect(range.endDate).toBe("2026-11-05T18:29:59.999Z");
    });

    it("Test 1.9: formatDuration converts seconds accurately", () => {
      expect(formatDuration(null)).toBe("N/A");
      expect(formatDuration(undefined)).toBe("N/A");
      expect(formatDuration(45)).toBe("45s");
      expect(formatDuration(120)).toBe("2m");
      expect(formatDuration(195)).toBe("3m 15s");
      expect(formatDuration(3660)).toBe("1h 1m");
    });

    it("Test 1.10: generateDateBuckets returns continuous ordered daily buckets", () => {
      const buckets = generateDateBuckets("2026-11-01T18:30:00.000Z", "2026-11-04T18:29:59.999Z");
      expect(buckets).toContain("2026-11-02");
      expect(buckets).toContain("2026-11-03");
      expect(buckets).toContain("2026-11-04");
      expect(buckets.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // DOMAIN 2: MESSAGING AGGREGATION & DELIVERY/READ RATES
  // ============================================================================
  describe("Domain 2: Messaging Analytics Aggregation & Performance Rates", () => {
    it("Test 2.1: Calculates delivery and read rates accurately with zero division guard", async () => {
      const mockMessages = [
        { id: "m1", direction: "inbound", status: "delivered", created_at: "2026-11-07T05:00:00Z" },
        { id: "m2", direction: "inbound", status: "delivered", created_at: "2026-11-07T06:00:00Z" },
        { id: "m3", direction: "outbound", status: "delivered", created_at: "2026-11-07T06:05:00Z" },
        { id: "m4", direction: "outbound", status: "read", created_at: "2026-11-07T06:10:00Z" },
        { id: "m5", direction: "outbound", status: "failed", created_at: "2026-11-07T07:00:00Z" },
        { id: "m6", direction: "outbound", status: "pending", created_at: "2026-11-07T07:30:00Z" },
      ];

      const mockClient = createMockClient({
        wa_messages: mockMessages,
        wa_contacts: [],
        wa_conversations: [],
        wa_automation_rules: [],
        wa_automation_execution_logs: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
        client: mockClient,
      });

      expect(analytics.messaging.totalInbound).toBe(2);
      expect(analytics.messaging.totalOutbound).toBe(4);
      expect(analytics.messaging.totalMessages).toBe(6);
      expect(analytics.messaging.read).toBe(1);
      // Delivered includes delivered and read
      expect(analytics.messaging.delivered).toBe(2);
      expect(analytics.messaging.failed).toBe(1);
      expect(analytics.messaging.pending).toBe(1);

      // Delivery rate = 2 / 4 = 50%
      expect(analytics.messaging.deliveryRatePercent).toBe(50);
      // Read rate = 1 / 2 = 50%
      expect(analytics.messaging.readRatePercent).toBe(50);
    });

    it("Test 2.2: Empty message records return 0% rates without NaN", async () => {
      const mockClient = createMockClient({
        wa_messages: [],
        wa_contacts: [],
        wa_conversations: [],
        wa_automation_rules: [],
        wa_automation_execution_logs: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
        client: mockClient,
      });

      expect(analytics.messaging.totalMessages).toBe(0);
      expect(analytics.messaging.deliveryRatePercent).toBe(0);
      expect(analytics.messaging.readRatePercent).toBe(0);
      expect(Number.isNaN(analytics.messaging.deliveryRatePercent)).toBe(false);
      expect(Number.isNaN(analytics.messaging.readRatePercent)).toBe(false);
    });
  });

  // ============================================================================
  // DOMAIN 3: CONTACT & INBOX ANALYTICS AGGREGATION
  // ============================================================================
  describe("Domain 3: Contact & Inbox Analytics Aggregation", () => {
    it("Test 3.1: Contacts and acquisition sources are classified accurately", async () => {
      const mockContacts = [
        {
          id: "c1",
          created_at: "2026-11-07T02:00:00Z",
          total_inbound_count: 5,
          is_opted_out: false,
          metadata: { source: "Website Lead Form", status: "lead" },
        },
        {
          id: "c2",
          created_at: "2026-11-07T03:00:00Z",
          total_inbound_count: 0,
          is_opted_out: false,
          metadata: { source: "Referral", status: "lead" },
        },
        {
          id: "c3",
          created_at: "2026-10-01T00:00:00Z",
          total_inbound_count: 2,
          is_opted_out: true,
          metadata: { source: "Website Lead Form", is_customer: true },
        },
      ];

      const mockClient = createMockClient({
        wa_contacts: mockContacts,
        wa_messages: [],
        wa_conversations: [],
        wa_automation_rules: [],
        wa_automation_execution_logs: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
        client: mockClient,
      });

      expect(analytics.contacts.totalContacts).toBe(3);
      expect(analytics.contacts.newContacts).toBe(2); // c1 & c2 created today
      expect(analytics.contacts.activeContacts).toBe(2); // c1 & c3 have total_inbound_count > 0
      expect(analytics.contacts.inactiveContacts).toBe(1); // c2 has 0 inbound count
      expect(analytics.contacts.optedOutContacts).toBe(1);
      expect(analytics.contacts.convertedLeadsCount).toBe(1); // c3 has is_customer: true
      expect(analytics.contacts.hasRecordedConversionData).toBe(true);

      const webSource = analytics.contacts.sources.find((s) => s.source === "Website Lead Form");
      expect(webSource).toBeDefined();
      expect(webSource?.count).toBe(2);
    });

    it("Test 3.2: First-response time computes accurate mathematical duration", async () => {
      const mockMessages = [
        // Conversation 1: Inbound at 10:00, Outbound response at 10:04 (4 minutes = 240s)
        {
          id: "m1",
          conversation_id: "conv-1",
          direction: "inbound",
          status: "delivered",
          created_at: "2026-11-07T10:00:00Z",
        },
        {
          id: "m2",
          conversation_id: "conv-1",
          direction: "outbound",
          status: "delivered",
          created_at: "2026-11-07T10:04:00Z",
        },
        // Conversation 2: Inbound at 11:00, Outbound response at 11:02 (2 minutes = 120s)
        {
          id: "m3",
          conversation_id: "conv-2",
          direction: "inbound",
          status: "delivered",
          created_at: "2026-11-07T11:00:00Z",
        },
        {
          id: "m4",
          conversation_id: "conv-2",
          direction: "outbound",
          status: "delivered",
          created_at: "2026-11-07T11:02:00Z",
        },
      ];

      const mockClient = createMockClient({
        wa_messages: mockMessages,
        wa_contacts: [],
        wa_conversations: [
          { id: "conv-1", status: "open", unread_count: 0 },
          { id: "conv-2", status: "open", unread_count: 0 },
        ],
        wa_automation_rules: [],
        wa_automation_execution_logs: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
        client: mockClient,
      });

      // Average duration = (240 + 120) / 2 = 180 seconds (3m)
      expect(analytics.inbox.averageFirstResponseTimeSeconds).toBe(180);
      expect(analytics.inbox.averageFirstResponseTimeFormatted).toBe("3m");
    });
  });

  // ============================================================================
  // DOMAIN 4: AUTOMATION ANALYTICS & INACTIVE DEFAULT ENFORCEMENT
  // ============================================================================
  describe("Domain 4: Automation Analytics Aggregation & Rule Safeguards", () => {
    it("Test 4.1: Aggregates rule executions and classifies failure reasons", async () => {
      const mockRules = [
        { id: "r1", name: "Welcome Greeting", trigger_type: "inbound_message", is_active: false },
        { id: "r2", name: "Out of Hours Auto-Reply", trigger_type: "outside_business_hours", is_active: false },
      ];

      const mockLogs = [
        { id: "l1", rule_id: "r1", status: "success", error_message: null, skip_reason: null, created_at: "2026-11-07T05:00:00Z" },
        { id: "l2", rule_id: "r1", status: "success", error_message: null, skip_reason: null, created_at: "2026-11-07T05:30:00Z" },
        { id: "l3", rule_id: "r1", status: "failed", error_message: "Rate limit reached", skip_reason: null, created_at: "2026-11-07T06:00:00Z" },
        { id: "l4", rule_id: "r2", status: "skipped", error_message: null, skip_reason: "Inside business hours", created_at: "2026-11-07T07:00:00Z" },
      ];

      const mockClient = createMockClient({
        wa_automation_rules: mockRules,
        wa_automation_execution_logs: mockLogs,
        wa_messages: [],
        wa_contacts: [],
        wa_conversations: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
        client: mockClient,
      });

      expect(analytics.automation.totalRules).toBe(2);
      expect(analytics.automation.activeRules).toBe(0); // Rules remain inactive unless approved
      expect(analytics.automation.inactiveRules).toBe(2);
      expect(analytics.automation.executedJobs).toBe(4);
      expect(analytics.automation.successfulExecutions).toBe(2);
      expect(analytics.automation.failedExecutions).toBe(1);
      expect(analytics.automation.skippedExecutions).toBe(1);
      expect(analytics.automation.successRatePercent).toBe(50); // 2/4 = 50%

      expect(analytics.automation.failureReasons.length).toBeGreaterThanOrEqual(1);
      const rateLimitReason = analytics.automation.failureReasons.find((r) => r.reason === "Rate limit reached");
      expect(rateLimitReason).toBeDefined();
    });
  });

  // ============================================================================
  // DOMAIN 5: BUSINESS-SPECIFIC ENQUIRY CATEGORIZATION
  // ============================================================================
  describe("Domain 5: Business-Specific Enquiry Categorization & Zero Data Invention", () => {
    it("Test 5.1: Astrology enquiries are categorized into KP, Vedic, Consultation, and Matching", async () => {
      const mockMessages = [
        { id: "m1", direction: "inbound", content: "Namaste, need KP astrology horoscope consultation", created_at: "2026-11-07T05:00:00Z" },
        { id: "m2", direction: "inbound", content: "Birth chart jathagam compatibility matching for marriage", created_at: "2026-11-07T06:00:00Z" },
        { id: "m3", direction: "inbound", content: "Inquiry about baby name numerology number", created_at: "2026-11-07T07:00:00Z" },
      ];

      const mockClient = createMockClient({
        wa_messages: mockMessages,
        wa_contacts: [],
        wa_conversations: [],
        wa_automation_rules: [],
        wa_automation_execution_logs: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
        client: mockClient,
      });

      expect(analytics.businessReport.businessType).toBe("astrology");
      if (analytics.businessReport.businessType === "astrology") {
        expect(analytics.businessReport.astrologyEnquiries).toBeGreaterThanOrEqual(1);
        expect(analytics.businessReport.horoscopeMatchingEnquiries).toBeGreaterThanOrEqual(1);
        expect(analytics.businessReport.numerologyEnquiries).toBeGreaterThanOrEqual(1);
        // Explicit check: Does not invent revenue
        expect(analytics.businessReport.customerConversion.hasRecordedData).toBe(false);
        expect(analytics.businessReport.customerConversion.recordedCustomers).toBe(0);
        expect(analytics.businessReport.customerConversion.note).toContain("No consultation fee or revenue records");
      }
    });

    it("Test 5.2: Vivaham enquiries are categorized into Matrimony, Groom, Bride, and Plans", async () => {
      const mockMessages = [
        { id: "m1", direction: "inbound", content: "Mudaliar community groom profile registration details", created_at: "2026-11-07T05:00:00Z" },
        { id: "m2", direction: "inbound", content: "Seeking suitable bride horoscope match for engineer boy", created_at: "2026-11-07T06:00:00Z" },
        { id: "m3", direction: "inbound", content: "What is the fee for 6 month premium membership plan?", created_at: "2026-11-07T07:00:00Z" },
      ];

      const mockClient = createMockClient({
        wa_messages: mockMessages,
        wa_contacts: [],
        wa_conversations: [],
        wa_automation_rules: [],
        wa_automation_execution_logs: [],
        wa_processing_jobs: [],
      });

      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      const analytics = await getBusinessAnalytics(VIVAHAM_BUSINESS_ID, "vivaham", range, {
        client: mockClient,
      });

      expect(analytics.businessReport.businessType).toBe("vivaham");
      if (analytics.businessReport.businessType === "vivaham") {
        expect(analytics.businessReport.groomEnquiries).toBeGreaterThanOrEqual(1);
        expect(analytics.businessReport.brideEnquiries).toBeGreaterThanOrEqual(1);
        expect(analytics.businessReport.membershipPlanEnquiries).toBeGreaterThanOrEqual(1);
        // Explicit check: Does not assume paid memberships
        expect(analytics.businessReport.leadConversion.hasRecordedData).toBe(false);
        expect(analytics.businessReport.leadConversion.recordedMembers).toBe(0);
        expect(analytics.businessReport.leadConversion.note).toContain("No paid membership transaction data");
      }
    });
  });

  // ============================================================================
  // DOMAIN 6: STRICT MULTI-TENANT ISOLATION & PRIVILEGE GUARDS
  // ============================================================================
  describe("Domain 6: Multi-Tenant Isolation & Security Privilege Guards", () => {
    it("Test 6.1: Reject unauthenticated or invalid business tenant identifier", async () => {
      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      await expect(
        getBusinessAnalytics("invalid-uuid-123", "astrology", range)
      ).rejects.toThrow(/Invalid business tenant identifier/i);
    });

    it("Test 6.2: Vivaham agent cannot access Astrology analytics data", async () => {
      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      // User 'user-vivaham-agent' has membership ONLY in Vivaham
      await expect(
        getBusinessAnalytics(ASTRO_BUSINESS_ID, "astrology", range, {
          userId: "user-vivaham-agent",
        })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("Test 6.3: Astrology agent cannot access Vivaham analytics data", async () => {
      const range = resolveDateRange("today", undefined, undefined, FIXED_DATE);
      // User 'user-astro-agent' has membership ONLY in Astrology
      await expect(
        getBusinessAnalytics(VIVAHAM_BUSINESS_ID, "vivaham", range, {
          userId: "user-astro-agent",
        })
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  // ============================================================================
  // DOMAIN 7: CSV EXPORT FORMATTING & TIMEZONE METADATA
  // ============================================================================
  describe("Domain 7: CSV Export RFC 4180 Integrity & Timezone Indicators", () => {
    it("Test 7.1: exportAnalyticsCsv outputs RFC 4180 escaped CSV with Asia/Kolkata timezone", () => {
      const range = resolveDateRange("7d", undefined, undefined, FIXED_DATE);
      const emptyData = buildEmptyAnalyticsData(
        ASTRO_BUSINESS_ID,
        "astrology",
        "Gokul's Astrological Insights",
        range
      );

      const csv = exportAnalyticsCsv(emptyData, "Gokul's Astrological Insights");

      expect(csv).toContain('"GOKUL CONNECT — BUSINESS ANALYTICS REPORT"');
      expect(csv).toContain('"Gokul\'s Astrological Insights"');
      expect(csv).toContain('"Asia/Kolkata (IST, UTC+05:30)"');
      expect(csv).toContain('"EXECUTIVE SUMMARY METRICS"');
      expect(csv).toContain('"DAILY MESSAGE & CONTACT TRENDS (Asia/Kolkata)"');
      expect(csv).toContain('"BUSINESS ENQUIRY CATEGORIZATION"');
      expect(csv).toContain('"CONTACT ACQUISITION SOURCES"');
    });
  });

  // ============================================================================
  // DOMAIN 8: MIGRATION 013 STATIC INTEGRITY & SECURITY DEFINER PARITY
  // ============================================================================
  describe("Domain 8: Migration 014 Static Integrity & Privilege Guards", () => {
    const mig014Path = path.resolve(
      process.cwd(),
      "supabase/migrations/20261107_014_phase10_analytics_rpcs.sql"
    );

    it("Test 8.1: Migration 014 file exists and follows naming conventions", () => {
      expect(fs.existsSync(mig014Path)).toBe(true);
    });

    it("Test 8.2: Migration 014 contains covering indexes for wa_messages and wa_contacts", () => {
      const sql = fs.readFileSync(mig014Path, "utf-8");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_wa_messages_analytics");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_wa_contacts_analytics");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_wa_conversations_analytics");
    });

    it("Test 8.3: Migration 014 implements get_business_analytics_summary and daily trends", () => {
      const sql = fs.readFileSync(mig014Path, "utf-8");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_business_analytics_summary");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_business_analytics_daily_trends");
      expect(sql).toContain("SET search_path = public, pg_temp");
      expect(sql).toContain("SECURITY INVOKER");
    });

    it("Test 8.4: Migration 014 strictly enforces REVOKE from PUBLIC and GRANTS to authenticated", () => {
      const sql = fs.readFileSync(mig014Path, "utf-8");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.get_business_analytics_summary");
      expect(sql).toContain("FROM PUBLIC;");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_business_analytics_summary");
      expect(sql).toContain("TO authenticated, service_role;");
    });
  });
});
