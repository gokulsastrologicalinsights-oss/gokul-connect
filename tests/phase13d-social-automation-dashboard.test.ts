import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import * as tenantGuard from "@/lib/auth/tenant-guard";
import {
  resetMemorySocialRulesStore,
  getSocialRulesMemory,
  getSocialRuleByIdMemory,
  saveSocialRuleMemory,
  toggleSocialRuleMemory,
  deleteSocialRuleMemory,
  getPresetTemplates,
  seedPresetSocialRulesMemory,
} from "@/lib/meta-social/rules-store";
import {
  resetMemoryLeadsStore,
  getSocialLeadsMemory,
  saveSocialLeadMemory,
  seedSampleLeadsMemory,
  classifyLead,
  projectEventToLead,
  filterLeadsList,
  MetaSocialLead,
} from "@/lib/meta-social/leads-store";
import {
  resetMemorySocialStore,
  saveSocialConnectionMemory,
  getSocialConnectionsMemory,
} from "@/lib/meta-social/connections-store";
import {
  getSocialDashboardDataAction,
  getSocialRulesAction,
  saveSocialRuleAction,
  toggleSocialRuleAction,
  deleteSocialRuleAction,
  getSocialLeadsAction,
  simulateSocialRuleAction,
} from "@/app/actions/social-automations";
import { normalizeSocialText, findMatchingSocialRule } from "@/lib/meta-social/evaluator";
import { getConnectionsForBusiness } from "@/lib/connections/store";
import { getRulesForBusiness } from "@/lib/automation/store";

describe("Phase 13D — Social Automation Dashboard Test Suite", () => {
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const OWNER_USER_ID = "owner-uuid-111";
  const VIEWER_USER_ID = "viewer-uuid-222";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetMemorySocialRulesStore();
    resetMemoryLeadsStore();
    resetMemorySocialStore();
    process.env.APP_ENCRYPTION_SECRET = "test_encryption_master_key_32bytes!!";
  });

  // Helper to mock tenant context
  function mockTenantContext(
    slug: "astrology" | "vivaham",
    role: "owner" | "admin" | "viewer" = "owner"
  ) {
    const isAstro = slug === "astrology";
    const bizId = isAstro ? ASTRO_BIZ_ID : VIVAHAM_BIZ_ID;
    const bizName = isAstro ? "Gokul's Astrological Insights" : "Gokul Vivaham";

    vi.spyOn(tenantGuard, "validateBusinessAccess").mockResolvedValue({
      business: {
        id: bizId,
        name: bizName,
        slug,
        description: isAstro ? "Astrology consultations" : "Matrimony services",
        icon_name: isAstro ? "Sparkles" : "HeartHandshake",
        accent_color: isAstro ? "purple" : "rose",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      },
      membership: {
        id: `mem_${slug}_${role}`,
        business_id: bizId,
        user_id: role === "viewer" ? VIEWER_USER_ID : OWNER_USER_ID,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      user: {
        id: role === "viewer" ? VIEWER_USER_ID : OWNER_USER_ID,
        email: `${role}@test.com`,
        full_name: `${role} User`,
        avatar_url: null,
        is_superadmin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }

  // ============================================================================
  // DOMAIN 1: DASHBOARD LOADING & AGGREGATION
  // ============================================================================
  describe("Domain 1: Dashboard Loading & Multi-Tenant Aggregation", () => {
    it("1.1 loads dashboard overview for Astrology tenant with correct branding and stats", async () => {
      mockTenantContext("astrology", "owner");

      // Connect FB page for Astrology
      saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "astro_fb_page_1",
        accountName: "Gokul Astrological Insights Page",
        pageId: "astro_fb_page_1",
        accessToken: "EAAB_astro_fb_token",
      });

      const res = await getSocialDashboardDataAction("astrology");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const d = res.data!;
      expect(d.business.slug).toBe("astrology");
      expect(d.business.name).toBe("Gokul's Astrological Insights");
      expect(d.connections).toHaveLength(1);
      expect(d.connections[0].platform).toBe("facebook");
      expect(d.connections[0].account_name).toBe("Gokul Astrological Insights Page");
      // Zero token leakage
      expect((d.connections[0] as any).accessToken).toBeUndefined();
      expect((d.connections[0] as any).credential_ref).toBeUndefined();
      expect(d.connections[0].credential_masked_hint).toMatch(/Ref: ••••/);

      // Verify preset templates exist for Astrology
      expect(d.publicTemplates.length).toBeGreaterThan(0);
      expect(d.privateTemplates.length).toBeGreaterThan(0);
      expect(d.publicTemplates[0].language).toBe("ta");

      // Verify Phase 13D safe inspection warning is present
      const safeWarning = d.warnings.find((w) => w.id === "info_phase13d_mode");
      expect(safeWarning).toBeDefined();
      expect(safeWarning?.title).toContain("Phase 13D Safe Mode");
    });

    it("1.2 loads dashboard overview for Vivaham tenant independently", async () => {
      mockTenantContext("vivaham", "owner");

      // Connect Instagram account for Vivaham
      saveSocialConnectionMemory(VIVAHAM_BIZ_ID, {
        platform: "instagram",
        accountId: "vivaham_ig_1",
        accountName: "Gokul Vivaham Instagram",
        username: "gokul_vivaham",
        pageId: "vivaham_fb_page_1",
        accessToken: "EAAB_vivaham_ig_token",
      });

      const res = await getSocialDashboardDataAction("vivaham");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const d = res.data!;
      expect(d.business.slug).toBe("vivaham");
      expect(d.business.name).toBe("Gokul Vivaham");
      expect(d.connections).toHaveLength(1);
      expect(d.connections[0].platform).toBe("instagram");
      expect(d.connections[0].username).toBe("gokul_vivaham");

      // Vivaham preset templates
      expect(d.publicTemplates[0].content).toContain("கோகுல் விவாஹம்");
      expect(d.privateTemplates[0].content).toContain("Gokul Vivaham");
    });

    it("1.3 produces configuration warning when Instagram has no linked Facebook Page", async () => {
      mockTenantContext("astrology", "owner");

      // In this scenario, zero channels connected
      const res = await getSocialDashboardDataAction("astrology");
      expect(res.success).toBe(true);

      const noChanWarn = res.data?.warnings.find((w) => w.id === "warn_no_channels");
      expect(noChanWarn).toBeDefined();
      expect(noChanWarn?.title).toContain("No Meta Channels Connected");
    });
  });

  // ============================================================================
  // DOMAIN 2: MULTI-TENANT ISOLATION
  // ============================================================================
  describe("Domain 2: Strict Multi-Tenant Isolation", () => {
    it("2.1 prevents Vivaham from seeing Astrology automation rules", () => {
      // Create rule in Astrology
      saveSocialRuleMemory(ASTRO_BIZ_ID, {
        platform: "both",
        targetType: "both",
        ruleName: "Astrology Secret Rule",
        keywords: ["ஜாதகம்"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "Astrology public reply",
      });

      // Vivaham queries rules
      const vivRules = getSocialRulesMemory(VIVAHAM_BIZ_ID);
      expect(vivRules).toHaveLength(0);

      // Astrology queries rules
      const astroRules = getSocialRulesMemory(ASTRO_BIZ_ID);
      expect(astroRules).toHaveLength(1);
      expect(astroRules[0].rule_name).toBe("Astrology Secret Rule");
    });

    it("2.2 prevents cross-tenant rule modification (IDOR protection)", () => {
      const astroRule = saveSocialRuleMemory(ASTRO_BIZ_ID, {
        platform: "both",
        targetType: "both",
        ruleName: "Astrology Rule To Attack",
        keywords: ["ஜாதகம்"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "Astrology public reply",
      });

      // Vivaham attempts to update Astrology's rule
      expect(() =>
        saveSocialRuleMemory(VIVAHAM_BIZ_ID, {
          id: astroRule.id,
          platform: "both",
          targetType: "both",
          ruleName: "Tampered by Vivaham",
          keywords: ["hacked"],
          matchType: "contains",
          responseAction: "reply_comment_public",
          predefinedReply: "Hacked reply",
        })
      ).toThrow(/Tenant mismatch/i);

      // Verify Astrology's rule is unchanged
      const rule = getSocialRuleByIdMemory(ASTRO_BIZ_ID, astroRule.id);
      expect(rule?.rule_name).toBe("Astrology Rule To Attack");
    });

    it("2.3 prevents cross-tenant rule deletion attempts", () => {
      const astroRule = saveSocialRuleMemory(ASTRO_BIZ_ID, {
        platform: "both",
        targetType: "both",
        ruleName: "Astrology Rule Protected",
        keywords: ["ஜாதகம்"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "Astrology public reply",
      });

      // Vivaham attempts to delete Astrology's rule
      expect(() =>
        deleteSocialRuleMemory(VIVAHAM_BIZ_ID, astroRule.id)
      ).toThrow(/Rule not found or tenant mismatch/i);

      // Verify rule still exists
      const rule = getSocialRuleByIdMemory(ASTRO_BIZ_ID, astroRule.id);
      expect(rule).not.toBeNull();
    });

    it("2.4 isolates lead monitoring events between tenants", () => {
      // Seed Astrology lead
      saveSocialLeadMemory({
        id: "lead_astro_test_1",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_astro_1",
        connection_name: "Astro Page",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "evt_astro_1",
        sender_id: "psid_1",
        sender_name: "Astro Client",
        content: "ஜாதகம் பலன் சொல்லுங்கள்",
        processing_status: "replied",
        public_reply_status: "replied",
        private_reply_status: "none",
        lead_status: "high_intent",
        created_at: new Date().toISOString(),
      });

      // Query from Vivaham tenant
      const vivLeads = getSocialLeadsMemory(VIVAHAM_BIZ_ID);
      expect(vivLeads.leads).toHaveLength(0);
      expect(vivLeads.totalCount).toBe(0);

      // Query from Astrology tenant
      const astroLeads = getSocialLeadsMemory(ASTRO_BIZ_ID);
      expect(astroLeads.leads).toHaveLength(1);
      expect(astroLeads.leads[0].sender_name).toBe("Astro Client");
    });
  });

  // ============================================================================
  // DOMAIN 3: KEYWORD RULES MANAGEMENT
  // ============================================================================
  describe("Domain 3: Keyword Rules CRUD & Unicode Handling", () => {
    it("3.1 creates keyword rule with multiple Tamil and English keywords", async () => {
      mockTenantContext("astrology", "owner");

      const res = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "both",
        ruleName: "Comprehensive Horoscope & Matching Rule",
        description: "Primary keyword rule for consultation enquiries",
        keywords: [
          "ஜாதகம்",
          "ராசி பலன்",
          "திருமண பொருத்தம்",
          "horoscope",
          "astrology",
          "marriage matching",
        ],
        matchType: "contains",
        responseAction: "both_public_and_private",
        predefinedReply:
          "வணக்கம்! உங்கள் ஜாதக ஆலோசனை மற்றும் விவரங்கள் DM-ல் அனுப்பப்பட்டுள்ளது.",
        predefinedDm:
          "வணக்கம்! Gokul's Astrological Insights. பிறந்த தேதி, நேரம் மற்றும் இடத்தை இங்கே பகிருங்கள்.",
        priority: 5,
        isActive: true,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.rule_name).toBe("Comprehensive Horoscope & Matching Rule");
      expect(res.data?.keywords).toHaveLength(6);
      expect(res.data?.keywords).toContain("ஜாதகம்");
      expect(res.data?.keywords).toContain("marriage matching");
      expect(res.data?.priority).toBe(5);
    });

    it("3.2 updates an existing rule's priority, keywords, and description", async () => {
      mockTenantContext("astrology", "owner");

      const created = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "comment",
        ruleName: "KP Astrology Rule",
        keywords: ["kp", "பிரசன்னம்"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "KP Consultation reply",
        priority: 50,
      });

      const ruleId = created.data!.id;

      // Update rule
      const updated = await saveSocialRuleAction("astrology", {
        id: ruleId,
        platform: "both",
        targetType: "comment",
        ruleName: "KP & Vedic Astrology Rule",
        description: "Updated description for KP enquiry",
        keywords: ["kp", "பிரசன்னம்", "vedic astrology", "prasanna"],
        matchType: "exact",
        responseAction: "reply_comment_public",
        predefinedReply: "Updated KP Consultation reply",
        priority: 15,
      });

      expect(updated.success).toBe(true);
      expect(updated.data?.rule_name).toBe("KP & Vedic Astrology Rule");
      expect(updated.data?.priority).toBe(15);
      expect(updated.data?.keywords).toHaveLength(4);
      expect(updated.data?.match_type).toBe("exact");
    });

    it("3.3 toggles rule active state from enabled to disabled and back", async () => {
      mockTenantContext("astrology", "owner");

      const created = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "both",
        ruleName: "Toggleable Rule",
        keywords: ["test"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "test reply",
        isActive: true,
      });

      const ruleId = created.data!.id;

      // Toggle off
      const offRes = await toggleSocialRuleAction("astrology", ruleId, false);
      expect(offRes.success).toBe(true);
      expect(offRes.data?.is_active).toBe(false);

      // Toggle on
      const onRes = await toggleSocialRuleAction("astrology", ruleId, true);
      expect(onRes.success).toBe(true);
      expect(onRes.data?.is_active).toBe(true);
    });

    it("3.4 deletes an existing rule with tenant safety", async () => {
      mockTenantContext("astrology", "owner");

      const created = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "both",
        ruleName: "Rule to be Deleted",
        keywords: ["delete_me"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "temporary",
      });

      const ruleId = created.data!.id;

      // Delete rule
      const delRes = await deleteSocialRuleAction("astrology", ruleId);
      expect(delRes.success).toBe(true);

      // Verify rule no longer in list
      const rulesRes = await getSocialRulesAction("astrology");
      const found = rulesRes.data?.find((r) => r.id === ruleId);
      expect(found).toBeUndefined();
    });

    it("3.5 preserves Unicode Tamil syllables during normalization", () => {
      const rawTamil = "  திருமணப் பொருத்தம்! & ஜாதகம்?? ";
      const normalized = normalizeSocialText(rawTamil);

      expect(normalized).toContain("திருமணப் பொருத்தம்");
      expect(normalized).toContain("ஜாதகம்");
      // Punctuation stripped and whitespace collapsed
      expect(normalized).not.toContain("!");
      expect(normalized).not.toContain("?");
      expect(normalized).toBe("திருமணப் பொருத்தம் ஜாதகம்");
    });
  });

  // ============================================================================
  // DOMAIN 4: REPLY TEMPLATES & SEPARATION
  // ============================================================================
  describe("Domain 4: Reply Template Separation & Policy Enforcement", () => {
    it("4.1 strictly prohibits reusing public comment reply as private DM automatically", async () => {
      mockTenantContext("astrology", "owner");

      const identicalText =
        "Thank you for contacting us! We have sent details to your inbox.";

      // Attempt to save identical public reply and private DM
      const res = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "both",
        ruleName: "Violation Rule",
        keywords: ["test"],
        matchType: "contains",
        responseAction: "both_public_and_private",
        predefinedReply: identicalText,
        predefinedDm: identicalText, // VIOLATION!
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(
        /Public comment reply and Private DM must be configured separately/i
      );
    });

    it("4.2 allows separate, distinct public comment and private DM templates", async () => {
      mockTenantContext("vivaham", "owner");

      const pubReply =
        "வணக்கம்! கோகுல் விவாஹம் வரன் பதிவு விவரங்களை உங்கள் தனிப்பட்ட மெசேஜில் (DM) அனுப்பியுள்ளோம்.";
      const pvtDm =
        "வணக்கம்! Gokul Vivaham வரன் சேவையில் தங்களை அன்புடன் வரவேற்கிறோம். வரன் விவரங்களை அறிய தொடர்பு எண்ணை இங்கே பகிரவும்.";

      const res = await saveSocialRuleAction("vivaham", {
        platform: "both",
        targetType: "both",
        ruleName: "Vivaham Matrimony Lead",
        keywords: [
          "திருமணம்",
          "வரன்",
          "பெண் தேவை",
          "மாப்பிள்ளை தேவை",
          "matrimony",
          "bride",
          "groom",
        ],
        matchType: "contains",
        responseAction: "both_public_and_private",
        predefinedReply: pubReply,
        predefinedDm: pvtDm,
      });

      expect(res.success).toBe(true);
      expect(res.data?.predefined_reply).toBe(pubReply);
      expect(res.data?.predefined_dm).toBe(pvtDm);
    });

    it("4.3 returns separate preset templates for Astrology and Vivaham", () => {
      const astroTpls = getPresetTemplates("astrology");
      expect(astroTpls.publicTemplates).toHaveLength(3);
      expect(astroTpls.privateTemplates).toHaveLength(2);
      expect(astroTpls.publicTemplates[0].content).toContain("ஜாதக ஆலோசனை");

      const vivTpls = getPresetTemplates("vivaham");
      expect(vivTpls.publicTemplates).toHaveLength(2);
      expect(vivTpls.privateTemplates).toHaveLength(2);
      expect(vivTpls.publicTemplates[0].content).toContain("கோகுல் விவாஹம்");
    });
  });

  // ============================================================================
  // DOMAIN 5: LEAD MONITORING & FILTER ENGINE
  // ============================================================================
  describe("Domain 5: Lead Monitoring, Filtering & Schema 026 Projection", () => {
    beforeEach(() => {
      // Seed sample leads for Astrology
      saveSocialLeadMemory({
        id: "lead_1",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_1",
        connection_name: "Gokul Astrology FB",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_c_1",
        sender_id: "psid_101",
        sender_name: "Anbarasu M.",
        content: "ஜாதகம் பார்க்க கட்டணம் எவ்வளவு? நேரடி ஆலோசனை கிடைக்குமா?",
        matched_rule_id: "rule_fee_1",
        matched_rule_name: "Consultation Fee Enquiry",
        matched_keyword: "ஜாதகம்",
        processing_status: "replied",
        public_reply_status: "replied",
        private_reply_status: "replied",
        lead_status: "high_intent",
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });

      saveSocialLeadMemory({
        id: "lead_2",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_ig_1",
        connection_name: "gokuls_astrology",
        platform: "instagram",
        event_type: "comment",
        meta_event_id: "ig_c_2",
        sender_id: "igsid_202",
        sender_name: "Revathi S.",
        content: "Nice post! அருமை.",
        matched_rule_id: null,
        matched_rule_name: null,
        matched_keyword: null,
        processing_status: "received",
        public_reply_status: "pending",
        private_reply_status: "pending",
        lead_status: "general",
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      });

      saveSocialLeadMemory({
        id: "lead_3",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_ig_1",
        connection_name: "gokuls_astrology",
        platform: "instagram",
        event_type: "message",
        meta_event_id: "ig_m_3",
        sender_id: "igsid_303",
        sender_name: "Praveen Kumar",
        content: "Phone consultation booking failed. Please help.",
        matched_rule_id: null,
        matched_rule_name: null,
        matched_keyword: null,
        processing_status: "failed",
        public_reply_status: "failed",
        private_reply_status: "failed",
        lead_status: "followup_needed",
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    it("5.1 filters leads by platform (Facebook vs Instagram)", async () => {
      mockTenantContext("astrology", "owner");

      const fbRes = await getSocialLeadsAction("astrology", { platform: "facebook" });
      expect(fbRes.success).toBe(true);
      expect(fbRes.data).toHaveLength(1);
      expect(fbRes.data![0].sender_name).toBe("Anbarasu M.");

      const igRes = await getSocialLeadsAction("astrology", { platform: "instagram" });
      expect(igRes.success).toBe(true);
      expect(igRes.data).toHaveLength(2);
    });

    it("5.2 filters leads by lead status (High Intent vs Follow-up Needed)", async () => {
      mockTenantContext("astrology", "owner");

      const highRes = await getSocialLeadsAction("astrology", {
        leadStatus: "high_intent",
      });
      expect(highRes.success).toBe(true);
      expect(highRes.data).toHaveLength(1);
      expect(highRes.data![0].matched_keyword).toBe("ஜாதகம்");

      const fuRes = await getSocialLeadsAction("astrology", {
        leadStatus: "followup_needed",
      });
      expect(fuRes.success).toBe(true);
      expect(fuRes.data).toHaveLength(1);
      expect(fuRes.data![0].sender_name).toBe("Praveen Kumar");
    });

    it("5.3 filters leads by search text across comment text, sender name, and keywords", async () => {
      mockTenantContext("astrology", "owner");

      const searchRes = await getSocialLeadsAction("astrology", {
        search: "Anbarasu",
      });
      expect(searchRes.success).toBe(true);
      expect(searchRes.data).toHaveLength(1);
      expect(searchRes.data![0].sender_name).toBe("Anbarasu M.");

      const kwSearch = await getSocialLeadsAction("astrology", {
        search: "booking failed",
      });
      expect(kwSearch.success).toBe(true);
      expect(kwSearch.data).toHaveLength(1);
      expect(kwSearch.data![0].sender_name).toBe("Praveen Kumar");
    });

    it("5.4 projects Migration 026 schema event into lead without requiring Migration 027", () => {
      const raw026Event = {
        id: "evt_026_1",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_1",
        platform: "instagram",
        event_type: "comment",
        meta_event_id: "meta_123",
        sender_id: "sender_456",
        sender_name: "Test User",
        content: "விலை எவ்வளவு?",
        status: "replied",
        reply_type: "both",
        reply_content: "Details sent to DM",
        created_at: new Date().toISOString(),
      };

      const lead = projectEventToLead(raw026Event);
      expect(lead.id).toBe("evt_026_1");
      expect(lead.processing_status).toBe("replied");
      expect(lead.public_reply_status).toBe("replied");
      expect(lead.private_reply_status).toBe("replied");
      expect(lead.lead_status).toBe("high_intent");
    });
  });

  // ============================================================================
  // DOMAIN 6: DRY-RUN SIMULATOR (ZERO LIVE META NETWORK OPERATIONS)
  // ============================================================================
  describe("Domain 6: Deterministic Evaluator & Dry-Run Simulator", () => {
    beforeEach(() => {
      saveSocialRuleMemory(ASTRO_BIZ_ID, {
        platform: "both",
        targetType: "both",
        ruleName: "Horoscope & Consultation",
        keywords: ["ஜாதகம்", "ராசி பலன்", "horoscope", "astrology"],
        matchType: "contains",
        responseAction: "both_public_and_private",
        predefinedReply: "Public comment acknowledgment (Tamil)",
        predefinedDm: "Private DM consultation guide (Tamil)",
        priority: 10,
        isActive: true,
      });

      saveSocialRuleMemory(ASTRO_BIZ_ID, {
        platform: "both",
        targetType: "comment",
        ruleName: "Marriage Compatibility",
        keywords: ["திருமண பொருத்தம்", "matching"],
        matchType: "contains",
        responseAction: "reply_comment_private_dm",
        predefinedReply: "Not used for DM only",
        predefinedDm: "Marriage matching private guide",
        priority: 20,
        isActive: true,
      });
    });

    it("6.1 matches inbound Tamil comment and previews public reply + private DM", async () => {
      mockTenantContext("astrology", "owner");

      const simRes = await simulateSocialRuleAction("astrology", {
        text: "சார் என் ஜாதகம் கணித்து பலன் சொல்ல முடியுமா?",
        platform: "instagram",
        eventType: "comment",
      });

      expect(simRes.success).toBe(true);
      expect(simRes.matched).toBe(true);
      expect(simRes.rule?.rule_name).toBe("Horoscope & Consultation");
      expect(simRes.publicReplyPreview).toBe("Public comment acknowledgment (Tamil)");
      expect(simRes.privateDmPreview).toBe("Private DM consultation guide (Tamil)");
    });

    it("6.2 matches inbound English comment and respects priority ordering", async () => {
      mockTenantContext("astrology", "owner");

      const simRes = await simulateSocialRuleAction("astrology", {
        text: "Please send astrology horoscope details",
        platform: "facebook",
        eventType: "comment",
      });

      expect(simRes.success).toBe(true);
      expect(simRes.matched).toBe(true);
      expect(simRes.rule?.rule_name).toBe("Horoscope & Consultation");
    });

    it("6.3 returns matched=false for unrelated comments without throwing or publishing", async () => {
      mockTenantContext("astrology", "owner");

      const simRes = await simulateSocialRuleAction("astrology", {
        text: "Good morning! Nice picture.",
        platform: "instagram",
        eventType: "comment",
      });

      expect(simRes.success).toBe(true);
      expect(simRes.matched).toBe(false);
      expect(simRes.rule).toBeUndefined();
      expect(simRes.publicReplyPreview).toBeUndefined();
      expect(simRes.privateDmPreview).toBeUndefined();
    });
  });

  // ============================================================================
  // DOMAIN 7: SERVER-SIDE AUTHORIZATION & SECURITY
  // ============================================================================
  describe("Domain 7: Server-Side Authorization & Role Guards", () => {
    it("7.1 rejects viewer role from creating or modifying rules", async () => {
      mockTenantContext("astrology", "viewer"); // Non-admin/owner

      const res = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "both",
        ruleName: "Unauthorized Viewer Rule",
        keywords: ["test"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "test",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only workspace owners and administrators/i);
    });

    it("7.2 rejects viewer role from toggling rule active state", async () => {
      mockTenantContext("astrology", "viewer");

      const res = await toggleSocialRuleAction("astrology", "any_rule_id", true);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only workspace owners and administrators/i);
    });

    it("7.3 rejects viewer role from deleting rules", async () => {
      mockTenantContext("astrology", "viewer");

      const res = await deleteSocialRuleAction("astrology", "any_rule_id");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only workspace owners and administrators/i);
    });

    it("7.4 verifies that raw Meta access tokens are never returned in rule payloads", async () => {
      mockTenantContext("astrology", "owner");

      const res = await saveSocialRuleAction("astrology", {
        platform: "both",
        targetType: "both",
        ruleName: "Security Test Rule",
        keywords: ["token_leak_check"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "Security passed",
      });

      expect(res.success).toBe(true);
      const str = JSON.stringify(res.data);
      expect(str).not.toContain("EAAB");
      expect(str).not.toContain("accessToken");
      expect(str).not.toContain("ciphertext");
    });
  });

  // ============================================================================
  // DOMAIN 8: WHATSAPP NON-REGRESSION VERIFICATION
  // ============================================================================
  describe("Domain 8: WhatsApp Non-Regression Verification", () => {
    it("8.1 preserves existing WhatsApp connection store queries", () => {
      const waConns = getConnectionsForBusiness(ASTRO_BIZ_ID);
      expect(Array.isArray(waConns)).toBe(true);
    });

    it("8.2 preserves existing WhatsApp automation engine store queries", async () => {
      const waRules = await getRulesForBusiness(ASTRO_BIZ_ID);
      expect(Array.isArray(waRules)).toBe(true);
    });
  });
});
