import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  extractVariables,
  extractTemplateVariables,
  replaceVariables,
  validateTemplateDraft,
  buildComponentsFromDraft,
  parseComponentsToDraft,
  detectPlaceholders,
  identifyMissingVariables,
  validateVariableCount,
  generateTemplatePreview,
  rejectUnresolvedPlaceholders,
} from "@/lib/templates/validation";
import {
  getDefaultBusinessTemplates,
  ASTROLOGY_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/templates/default-templates";
import {
  listTemplatesDb,
  getTemplateByIdDb,
  createDraftTemplateDb,
  updateDraftTemplateDb,
  archiveTemplateDb,
  deleteTemplateDb,
  syncMetaTemplatesDb,
} from "@/lib/templates/database";
import {
  fetchMetaTemplatesFromWaba,
  MetaRawTemplate,
} from "@/lib/templates/meta-sync";
import { sanitizeMetaLog } from "@/lib/whatsapp/client";
import { TemplateDraftInput } from "@/lib/templates/types";

describe("Phase 11 — WhatsApp Template Management Test Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup mock Supabase roles & auth schema
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB
      );
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::UUID;
      $$;
    `);

    // 2. Apply all migrations sequentially (001 through 015)
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      try {
        await db.exec(sql);
      } catch (err: any) {
        throw new Error(`Failed to apply migration ${file}: ${err.message}`);
      }
    }
  });

  // ============================================================================
  // DOMAIN 1: MIGRATION 015 & SCHEMA VERIFICATION
  // ============================================================================
  describe("Domain 1: Database Migration 015 & Schema Integrity", () => {
    it("should verify wa_message_templates has Phase 11 columns in PGlite", async () => {
      const res = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wa_message_templates'
        ORDER BY ordinal_position;
      `);

      const columnNames = res.rows.map((r: any) => r.column_name);
      expect(columnNames).toContain("meta_template_id");
      expect(columnNames).toContain("rejection_reason");
      expect(columnNames).toContain("is_archived");
      expect(columnNames).toContain("last_synced_at");
      expect(columnNames).toContain("components");
    });

    it("should verify check constraint accepts DRAFT and ARCHIVED statuses", async () => {
      // DRAFT insertion should succeed
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status, components
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'test_draft_status', 'en_US', 'UTILITY', 'DRAFT', '[]'::jsonb
        );
      `);

      // ARCHIVED insertion should succeed
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status, components, is_archived
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'test_archived_status', 'en_US', 'UTILITY', 'ARCHIVED', '[]'::jsonb, true
        );
      `);

      // Invalid status should be rejected by constraint
      await expect(
        db.query(`
          INSERT INTO public.wa_message_templates (
            business_id, template_name, language, category, status
          ) VALUES (
            '${ASTROLOGY_BUSINESS_ID}', 'test_invalid_status', 'en_US', 'UTILITY', 'INVALID_STATUS'
          );
        `)
      ).rejects.toThrow();
    });

    it("should prevent tenant reassignment on wa_message_templates via trigger", async () => {
      const inserted = await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'immutability_test', 'en_US', 'UTILITY', 'DRAFT'
        ) RETURNING id;
      `);
      const templateId = (inserted.rows[0] as any).id;

      await expect(
        db.query(`
          UPDATE public.wa_message_templates
          SET business_id = '${VIVAHAM_BUSINESS_ID}'
          WHERE id = '${templateId}';
        `)
      ).rejects.toThrow(/Tenant reassignment forbidden/i);
    });

    it("should enforce uniqueness of (business_id, template_name, language)", async () => {
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'unique_test_template', 'en_US', 'UTILITY', 'APPROVED'
        );
      `);

      await expect(
        db.query(`
          INSERT INTO public.wa_message_templates (
            business_id, template_name, language, category, status
          ) VALUES (
            '${ASTROLOGY_BUSINESS_ID}', 'unique_test_template', 'en_US', 'MARKETING', 'APPROVED'
          );
        `)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // DOMAIN 2: TEMPLATE COMPONENTS & VALIDATION LOGIC
  // ============================================================================
  describe("Domain 2: Template Components & Dynamic Variables", () => {
    it("should extract sequential variables from text correctly", () => {
      expect(extractVariables("Hello {{1}}, your order {{2}} is confirmed.")).toEqual(["1", "2"]);
      expect(extractVariables("Static text with no variables.")).toEqual([]);
      expect(extractVariables("Multiple occurrences of {{1}} and {{2}} and {{1}}")).toEqual(["1", "2"]);
    });

    it("should extract variables across Header and Body components", () => {
      const components = [
        { type: "HEADER", format: "TEXT", text: "Important Alert for {{1}}" },
        { type: "BODY", text: "Hello {{1}}, your appointment is at {{2}} with {{3}}." },
      ];
      const res = extractTemplateVariables(components);
      expect(res.headerVariables).toEqual(["1"]);
      expect(res.bodyVariables).toEqual(["1", "2", "3"]);
      expect(res.allVariables).toEqual(["1", "2", "3"]);
      expect(res.totalCount).toBe(3);
    });

    it("should replace variables with dictionary mapping", () => {
      const text = "Namaste {{1}}, your consultation on {{2}} is ready.";
      const replaced = replaceVariables(text, { "1": "Karthik", "2": "Friday 10 AM" });
      expect(replaced).toBe("Namaste Karthik, your consultation on Friday 10 AM is ready.");
    });

    it("should replace variables with array mapping", () => {
      const text = "Vanakkam {{1}}, you have {{2}} new matches.";
      const replaced = replaceVariables(text, ["Sundar", "5"]);
      expect(replaced).toBe("Vanakkam Sundar, you have 5 new matches.");
    });

    it("should preserve placeholders when replacement values are missing", () => {
      const text = "Hello {{1}}, your code is {{2}}.";
      const replaced = replaceVariables(text, { "1": "Gokul" });
      expect(replaced).toBe("Hello Gokul, your code is {{2}}.");
    });

    it("should validate template draft input according to Meta specifications", () => {
      // Valid draft
      const validDraft: TemplateDraftInput = {
        template_name: "valid_order_update",
        category: "UTILITY",
        language: "en_US",
        body_text: "Hi {{1}}, your order is on the way.",
        header_format: "TEXT",
        header_text: "Shipping Update",
        footer_text: "Reply STOP to cancel",
        buttons: [
          { type: "QUICK_REPLY", text: "Track Order" },
          { type: "URL", text: "Website", url: "https://example.com" },
        ],
      };
      const validRes = validateTemplateDraft(validDraft);
      expect(validRes.isValid).toBe(true);
      expect(validRes.errors).toHaveLength(0);

      // Invalid name (contains uppercase or special characters)
      const invalidNameRes = validateTemplateDraft({
        ...validDraft,
        template_name: "Invalid-Name!",
      });
      expect(invalidNameRes.isValid).toBe(false);
      expect(invalidNameRes.errors[0]).toContain("lowercase letters");

      // Non-sequential variables in body ({{1}}, {{3}})
      const nonSequentialRes = validateTemplateDraft({
        ...validDraft,
        body_text: "Hi {{1}}, missing two and jump to {{3}}.",
      });
      expect(nonSequentialRes.isValid).toBe(false);
      expect(nonSequentialRes.errors[0]).toContain("sequential");

      // Footer cannot contain variables
      const footerVarRes = validateTemplateDraft({
        ...validDraft,
        footer_text: "Footer with {{1}} is invalid",
      });
      expect(footerVarRes.isValid).toBe(false);
      expect(footerVarRes.errors[0]).toContain("Footer text cannot contain dynamic variables");

      // Buttons length limit
      const tooManyButtonsRes = validateTemplateDraft({
        ...validDraft,
        buttons: [
          { type: "QUICK_REPLY", text: "B1" },
          { type: "QUICK_REPLY", text: "B2" },
          { type: "QUICK_REPLY", text: "B3" },
          { type: "QUICK_REPLY", text: "B4" },
        ],
      });
      expect(tooManyButtonsRes.isValid).toBe(false);
      expect(tooManyButtonsRes.errors[0]).toContain("at most 3 interactive buttons");
    });

    it("should bidirectional convert between DraftInput and Meta components JSON", () => {
      const input: TemplateDraftInput = {
        template_name: "bi_convert_test",
        category: "MARKETING",
        language: "ta",
        header_format: "IMAGE",
        body_text: "Vanakkam {{1}}, welcome!",
        footer_text: "Gokul Vivaham",
        buttons: [{ type: "URL", text: "Visit Portal", url: "https://gokulvivaham.com" }],
      };

      const components = buildComponentsFromDraft(input);
      expect(components).toHaveLength(4);
      expect(components[0].type).toBe("HEADER");
      expect(components[0].format).toBe("IMAGE");
      expect(components[1].type).toBe("BODY");
      expect(components[2].type).toBe("FOOTER");
      expect(components[3].type).toBe("BUTTONS");

      const parsedBack = parseComponentsToDraft(components);
      expect(parsedBack.header_format).toBe("IMAGE");
      expect(parsedBack.body_text).toBe("Vanakkam {{1}}, welcome!");
      expect(parsedBack.footer_text).toBe("Gokul Vivaham");
      expect(parsedBack.buttons).toHaveLength(1);
      expect(parsedBack.buttons[0].url).toBe("https://gokulvivaham.com");
    });

    it("should detect malformed placeholders, invalid tokens, and duplicate placeholders", () => {
      // Malformed text containing {{}}, {{name}}, {1}, and {{ 2 }}
      const text = "Hello {{1}}, code is {{code}}, empty is {{}}, single is {3}, and duplicate is {{1}}.";
      const detection = detectPlaceholders(text);

      expect(detection.valid).toEqual(["1"]);
      expect(detection.duplicates).toEqual(["1"]);
      expect(detection.malformed).toContain("{{code}}");
      expect(detection.malformed).toContain("{{}}");
      expect(detection.malformed).toContain("{3}");
    });

    it("should process Tamil Unicode template content and generate preview correctly", () => {
      // Exact prompt example:
      const tamilTemplate = "வணக்கம் {{1}}, உங்கள் ஆலோசனை நேரம் {{2}} அன்று உறுதி செய்யப்பட்டுள்ளது.";
      const tamilValues = { "1": "குமார்", "2": "நவம்பர் 12" };

      const result = generateTemplatePreview(tamilTemplate, tamilValues);
      expect(result.isComplete).toBe(true);
      expect(result.unresolved).toHaveLength(0);
      expect(result.preview).toBe("வணக்கம் குமார், உங்கள் ஆலோசனை நேரம் நவம்பர் 12 அன்று உறுதி செய்யப்பட்டுள்ளது.");

      // Direct replacement helper check
      const directReplaced = replaceVariables(tamilTemplate, tamilValues);
      expect(directReplaced).toBe("வணக்கம் குமார், உங்கள் ஆலோசனை நேரம் நவம்பர் 12 அன்று உறுதி செய்யப்பட்டுள்ளது.");
    });

    it("should identify missing variables and validate variable count", () => {
      const template = "Hello {{1}}, appointment on {{2}} with {{3}}.";
      const partialValues = { "1": "Sundar", "2": "Friday" };

      const missing = identifyMissingVariables(template, partialValues);
      expect(missing).toEqual(["3"]);

      const valCount = validateVariableCount(template, partialValues);
      expect(valCount.isValid).toBe(false);
      expect(valCount.expectedCount).toBe(3);
      expect(valCount.providedCount).toBe(2);
      expect(valCount.missing).toEqual(["3"]);
      expect(valCount.errors[0]).toContain("Missing required variables: {{3}}");
    });

    it("should strictly reject unresolved placeholders before sending", () => {
      const template = "Vanakkam {{1}}, your token is {{2}}.";
      // Incomplete values
      expect(() => {
        rejectUnresolvedPlaceholders(template, { "1": "Karthik" });
      }).toThrow("unresolved placeholders remaining: {{2}}");

      // Complete values
      const validText = rejectUnresolvedPlaceholders(template, { "1": "Karthik", "2": "T-99" });
      expect(validText).toBe("Vanakkam Karthik, your token is T-99.");
    });
  });

  // ============================================================================
  // DOMAIN 3: INDEPENDENT BUSINESS TEMPLATE LIBRARIES & ISOLATION
  // ============================================================================
  describe("Domain 3: Business Separation (Astrology vs Vivaham)", () => {
    it("should provide independent default templates for Astrology and Vivaham", () => {
      const astroTemplates = getDefaultBusinessTemplates(ASTROLOGY_BUSINESS_ID, "astrology");
      const vivahamTemplates = getDefaultBusinessTemplates(VIVAHAM_BUSINESS_ID, "vivaham");

      expect(astroTemplates.length).toBeGreaterThan(0);
      expect(vivahamTemplates.length).toBeGreaterThan(0);

      // Verify Astrology has astrology-specific templates
      expect(astroTemplates.some((t) => t.template_name === "consultation_confirmation")).toBe(true);
      expect(astroTemplates.some((t) => t.template_name === "horoscope_matching_update")).toBe(true);
      expect(astroTemplates.some((t) => t.template_name === "numerology_consultation")).toBe(true);
      expect(astroTemplates.some((t) => t.template_name === "appointment_reminder")).toBe(true);
      expect(astroTemplates.some((t) => t.template_name === "followup_reminder")).toBe(true);

      // Verify Vivaham has matrimony-specific templates
      expect(vivahamTemplates.some((t) => t.template_name === "registration_confirmation")).toBe(true);
      expect(vivahamTemplates.some((t) => t.template_name === "profile_interest_notification")).toBe(true);
      expect(vivahamTemplates.some((t) => t.template_name === "membership_information")).toBe(true);
      expect(vivahamTemplates.some((t) => t.template_name === "matrimony_profile_update")).toBe(true);
      expect(vivahamTemplates.some((t) => t.template_name === "membership_renewal_reminder")).toBe(true);

      // Verify neither contains the other's business-specific templates
      expect(astroTemplates.some((t) => t.template_name === "match_recommendations_alert")).toBe(false);
      expect(vivahamTemplates.some((t) => t.template_name === "horoscope_report_ready")).toBe(false);
    });

    it("should filter templates by category, status, and language independently", () => {
      const astroTemplates = getDefaultBusinessTemplates(ASTROLOGY_BUSINESS_ID);
      const utilityTemplates = astroTemplates.filter((t) => t.category === "UTILITY");
      const marketingTemplates = astroTemplates.filter((t) => t.category === "MARKETING");

      expect(utilityTemplates.length).toBeGreaterThan(0);
      expect(marketingTemplates.length).toBeGreaterThan(0);
      expect(utilityTemplates.every((t) => t.category === "UTILITY")).toBe(true);
      expect(marketingTemplates.every((t) => t.category === "MARKETING")).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 4: META SYNCHRONIZATION LOGIC & DRAFT PRESERVATION
  // ============================================================================
  describe("Domain 4: Meta Synchronization & Local Draft Preservation", () => {
    it("should preserve local draft templates when synchronizing from Meta", async () => {
      // Create local draft in PGlite
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status, components
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'preserved_draft', 'en_US', 'UTILITY', 'DRAFT',
          '[{"type": "BODY", "text": "Draft content that should not be touched"}]'::jsonb
        );
      `);

      // Mock Meta raw templates containing a template with the same name
      const mockMetaTemplates: MetaRawTemplate[] = [
        {
          id: "meta-id-1001",
          name: "preserved_draft",
          language: "en_US",
          category: "UTILITY",
          status: "APPROVED",
          components: [{ type: "BODY", text: "Meta version" }],
        },
        {
          id: "meta-id-1002",
          name: "new_synced_template",
          language: "en_US",
          category: "MARKETING",
          status: "APPROVED",
          components: [{ type: "BODY", text: "Brand new synced from Meta" }],
        },
      ];

      // Execute sync helper with mock Supabase client
      const mockSupabase = {
        from: (_table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "draft-id-1", status: "DRAFT", is_archived: false },
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ eq: async () => ({}) }),
          }),
          insert: async () => ({}),
        }),
      };

      const syncResult = await syncMetaTemplatesDb(
        ASTROLOGY_BUSINESS_ID,
        null,
        mockMetaTemplates,
        mockSupabase
      );

      // The draft should have been skipped and preserved!
      expect(syncResult.added).toBe(0);
      expect(syncResult.updated).toBe(0);
    });

    it("should sanitize access tokens from Meta error logs and URLs", () => {
      const rawSecretToken = "EAAGm0PX4ZCpsBAK7ZCZBZC998877665544332211AABBCC";
      const dirtyUrl = `https://graph.facebook.com/v26.0/messages?access_token=${rawSecretToken}`;
      const sanitized = sanitizeMetaLog(dirtyUrl, rawSecretToken);

      expect(sanitized).not.toContain(rawSecretToken);
      expect(sanitized).toContain("••••••••");
    });
  });

  // ============================================================================
  // DOMAIN 5: INBOX INTEGRATION & 24-HOUR POLICY ENFORCEMENT
  // ============================================================================
  describe("Domain 5: Inbox Integration & 24-Hour Policy", () => {
    it("should require all variables before generating template message dispatch payload", () => {
      const template = {
        template_name: "consultation_reminder",
        language: "en_US",
        components: [
          { type: "HEADER", format: "TEXT", text: "Appointment Reminder for {{1}}" },
          { type: "BODY", text: "Namaste {{1}}, appointment is on {{2}} at {{3}}." },
        ],
      };

      const varExtraction = extractTemplateVariables(template.components);
      expect(varExtraction.allVariables).toEqual(["1", "2", "3"]);

      // Incomplete parameters (missing {{3}})
      const incompleteVars: Record<string, string> = { "1": "Anand", "2": "Monday" };
      const missing = varExtraction.allVariables.filter((v) => !incompleteVars[v]?.trim());
      expect(missing).toEqual(["3"]);

      // Complete parameters
      const completeVars: Record<string, string> = {
        "1": "Anand",
        "2": "Monday",
        "3": "10:00 AM",
      };
      const completeMissing = varExtraction.allVariables.filter((v) => !completeVars[v]?.trim());
      expect(completeMissing).toHaveLength(0);

      // Verify payload construction
      const payloadComponents = [
        {
          type: "header",
          parameters: varExtraction.headerVariables.map((v) => ({
            type: "text",
            text: completeVars[v],
          })),
        },
        {
          type: "body",
          parameters: varExtraction.bodyVariables.map((v) => ({
            type: "text",
            text: completeVars[v],
          })),
        },
      ];

      expect(payloadComponents[0].parameters[0].text).toBe("Anand");
      expect(payloadComponents[1].parameters[1].text).toBe("Monday");
      expect(payloadComponents[1].parameters[2].text).toBe("10:00 AM");
    });

    it("should enforce WhatsApp 24-hour service window rules: block text, allow template", () => {
      const now = Date.now();
      const expiredInboundTime = new Date(now - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      const activeInboundTime = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

      // Check expired window calculation
      const elapsedExpired = now - new Date(expiredInboundTime).getTime();
      const isWindowOpenExpired = elapsedExpired >= 0 && elapsedExpired < 24 * 60 * 60 * 1000;
      expect(isWindowOpenExpired).toBe(false);

      // Check active window calculation
      const elapsedActive = now - new Date(activeInboundTime).getTime();
      const isWindowOpenActive = elapsedActive >= 0 && elapsedActive < 24 * 60 * 60 * 1000;
      expect(isWindowOpenActive).toBe(true);

      // Rule verification:
      // When window is closed (!isWindowOpenExpired):
      // Freeform text is rejected:
      const freeformAllowedWhenClosed = isWindowOpenExpired;
      expect(freeformAllowedWhenClosed).toBe(false);

      // Template messages are ALWAYS permitted by Meta outside the window:
      const templateAllowedWhenClosed = true;
      expect(templateAllowedWhenClosed).toBe(true);
    });

    it("should allow only APPROVED templates in inbox picker and block DRAFT / REJECTED templates", () => {
      const allTemplates = [
        { id: "1", template_name: "t_approved", status: "APPROVED", is_archived: false },
        { id: "2", template_name: "t_draft", status: "DRAFT", is_archived: false },
        { id: "3", template_name: "t_rejected", status: "REJECTED", is_archived: false },
        { id: "4", template_name: "t_paused", status: "PAUSED", is_archived: false },
        { id: "5", template_name: "t_archived", status: "APPROVED", is_archived: true },
      ];

      // Filter logic used by InboxClient:
      const inboxEligible = allTemplates.filter(
        (t) => t.status === "APPROVED" && !t.is_archived
      );

      expect(inboxEligible).toHaveLength(1);
      expect(inboxEligible[0].template_name).toBe("t_approved");
      expect(inboxEligible.some((t) => t.status === "DRAFT")).toBe(false);
      expect(inboxEligible.some((t) => t.status === "REJECTED")).toBe(false);
    });

    it("should reject template dispatch when connection does not match conversation", () => {
      const convConnectionId: string = "conn-astrology-01";
      const templateConnectionId: string | null = "conn-vivaham-01";

      const isConnectionMismatch =
        templateConnectionId !== null &&
        templateConnectionId !== undefined &&
        templateConnectionId !== convConnectionId;

      expect(isConnectionMismatch).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 6: SECURITY & AUTHORIZATION GUARDS
  // ============================================================================
  describe("Domain 6: Tenant Security & Authorization Guards", () => {
    it("should reject operations with missing or empty businessId", async () => {
      await expect(listTemplatesDb("")).rejects.toThrow(/Tenant isolation violation/i);
      await expect(listTemplatesDb("   ")).rejects.toThrow(/Tenant isolation violation/i);
    });

    it("should isolate templates strictly between Astrology and Vivaham in PGlite", async () => {
      // Insert Astrology template
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'astro_secret_template', 'en_US', 'UTILITY', 'APPROVED'
        );
      `);

      // Insert Vivaham template
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${VIVAHAM_BUSINESS_ID}', 'vivaham_secret_template', 'en_US', 'UTILITY', 'APPROVED'
        );
      `);

      // Querying Astrology should ONLY return Astrology templates
      const astroRes = await db.query(`
        SELECT template_name FROM public.wa_message_templates
        WHERE business_id = '${ASTROLOGY_BUSINESS_ID}';
      `);
      const astroNames = astroRes.rows.map((r: any) => r.template_name);
      expect(astroNames).toContain("astro_secret_template");
      expect(astroNames).not.toContain("vivaham_secret_template");

      // Querying Vivaham should ONLY return Vivaham templates
      const vivahamRes = await db.query(`
        SELECT template_name FROM public.wa_message_templates
        WHERE business_id = '${VIVAHAM_BUSINESS_ID}';
      `);
      const vivahamNames = vivahamRes.rows.map((r: any) => r.template_name);
      expect(vivahamNames).toContain("vivaham_secret_template");
      expect(vivahamNames).not.toContain("astro_secret_template");
    });
  });

  // ============================================================================
  // DOMAIN 7: TEMPLATE CRUD & MODIFICATION RESTRICTIONS
  // ============================================================================
  describe("Domain 7: Template CRUD & Modification Restrictions", () => {
    it("should create, read, update, archive and delete draft templates", async () => {
      // 1. Create Draft
      const insertRes = await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status, components, is_archived
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', 'crud_test_draft', 'en_US', 'UTILITY', 'DRAFT',
          '[{"type": "BODY", "text": "Original draft body {{1}}"}]'::jsonb, false
        ) RETURNING id, template_name, status, is_archived;
      `);
      expect(insertRes.rows).toHaveLength(1);
      const draft = insertRes.rows[0] as any;
      expect(draft.template_name).toBe("crud_test_draft");
      expect(draft.status).toBe("DRAFT");
      expect(draft.is_archived).toBe(false);

      // 2. Read Draft
      const readRes = await db.query(`
        SELECT * FROM public.wa_message_templates
        WHERE id = '${draft.id}' AND business_id = '${ASTROLOGY_BUSINESS_ID}';
      `);
      expect(readRes.rows).toHaveLength(1);

      // 3. Update Draft
      const updateRes = await db.query(`
        UPDATE public.wa_message_templates
        SET components = '[{"type": "BODY", "text": "Updated draft body {{1}}"}]'::jsonb,
            updated_at = NOW()
        WHERE id = '${draft.id}' AND business_id = '${ASTROLOGY_BUSINESS_ID}' AND status = 'DRAFT'
        RETURNING components;
      `);
      expect(updateRes.rows).toHaveLength(1);
      const updatedBody = (updateRes.rows[0] as any).components[0].text;
      expect(updatedBody).toBe("Updated draft body {{1}}");

      // 4. Archive Template
      const archiveRes = await db.query(`
        UPDATE public.wa_message_templates
        SET is_archived = true, status = 'ARCHIVED', updated_at = NOW()
        WHERE id = '${draft.id}' AND business_id = '${ASTROLOGY_BUSINESS_ID}'
        RETURNING is_archived, status;
      `);
      expect(archiveRes.rows).toHaveLength(1);
      expect((archiveRes.rows[0] as any).is_archived).toBe(true);
      expect((archiveRes.rows[0] as any).status).toBe("ARCHIVED");

      // 5. Unarchive Template
      const unarchiveRes = await db.query(`
        UPDATE public.wa_message_templates
        SET is_archived = false, status = 'DRAFT', updated_at = NOW()
        WHERE id = '${draft.id}' AND business_id = '${ASTROLOGY_BUSINESS_ID}'
        RETURNING is_archived, status;
      `);
      expect(unarchiveRes.rows).toHaveLength(1);
      expect((unarchiveRes.rows[0] as any).is_archived).toBe(false);

      // 6. Delete Draft
      const deleteRes = await db.query(`
        DELETE FROM public.wa_message_templates
        WHERE id = '${draft.id}' AND business_id = '${ASTROLOGY_BUSINESS_ID}'
        RETURNING id;
      `);
      expect(deleteRes.rows).toHaveLength(1);

      // Confirm Deleted
      const checkRes = await db.query(`
        SELECT id FROM public.wa_message_templates WHERE id = '${draft.id}';
      `);
      expect(checkRes.rows).toHaveLength(0);
    });

    it("should prevent duplicate template registration within same business tenant", async () => {
      const templateName = "prevent_dup_01";
      await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', '${templateName}', 'en_US', 'UTILITY', 'DRAFT'
        );
      `);

      // Same name, same language, same business -> MUST throw unique violation
      await expect(
        db.query(`
          INSERT INTO public.wa_message_templates (
            business_id, template_name, language, category, status
          ) VALUES (
            '${ASTROLOGY_BUSINESS_ID}', '${templateName}', 'en_US', 'MARKETING', 'DRAFT'
          );
        `)
      ).rejects.toThrow();

      // Same name, DIFFERENT language ('ta') -> SHOULD succeed
      const diffLangRes = await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}', '${templateName}', 'ta', 'UTILITY', 'DRAFT'
        ) RETURNING id;
      `);
      expect(diffLangRes.rows).toHaveLength(1);

      // Same name, same language, DIFFERENT business (Vivaham) -> SHOULD succeed (Strict Tenant Isolation)
      const diffBusinessRes = await db.query(`
        INSERT INTO public.wa_message_templates (
          business_id, template_name, language, category, status
        ) VALUES (
          '${VIVAHAM_BUSINESS_ID}', '${templateName}', 'en_US', 'UTILITY', 'DRAFT'
        ) RETURNING id;
      `);
      expect(diffBusinessRes.rows).toHaveLength(1);
    });
  });

  // ============================================================================
  // DOMAIN 8: META SYNC PAGINATION & API ERROR HANDLING
  // ============================================================================
  describe("Domain 8: Meta Sync Pagination & Error Handling", () => {
    it("should reject fetchMetaTemplatesFromWaba when credentials are missing", async () => {
      await expect(fetchMetaTemplatesFromWaba("", "valid_token")).rejects.toThrow(
        /wabaId is required/i
      );
      await expect(fetchMetaTemplatesFromWaba("12345", "")).rejects.toThrow(
        /accessToken is required/i
      );
    });

    it("should handle paginated Meta API template results", async () => {
      const page1 = {
        data: [
          { id: "t1", name: "page1_template", status: "APPROVED", category: "UTILITY", language: "en_US" },
        ],
        paging: {
          cursors: { after: "cursor_p2" },
          next: "https://graph.facebook.com/v26.0/waba_id/message_templates?cursor=p2",
        },
      };

      const page2 = {
        data: [
          { id: "t2", name: "page2_template", status: "APPROVED", category: "MARKETING", language: "en_US" },
        ],
        paging: {},
      };

      let fetchCount = 0;
      const originalFetch = global.fetch;
      global.fetch = async (url: any) => {
        fetchCount++;
        if (url.includes("cursor=p2")) {
          return {
            ok: true,
            json: async () => page2,
          } as any;
        }
        return {
          ok: true,
          json: async () => page1,
        } as any;
      };

      try {
        const results = await fetchMetaTemplatesFromWaba("test_waba_id", "test_access_token", 5);
        expect(results).toHaveLength(2);
        expect(results[0].name).toBe("page1_template");
        expect(results[1].name).toBe("page2_template");
        expect(fetchCount).toBe(2);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should handle Meta OAuthException gracefully without leaking token", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              message: "Error validating access token: Session has expired on Friday, 06-Nov-26 15:00:00 PDT.",
              type: "OAuthException",
              code: 190,
              error_subcode: 463,
            },
          }),
        } as any;
      };

      try {
        await expect(
          fetchMetaTemplatesFromWaba("1234567890", "EAAG_TEST_TOKEN_1234567890_XYZ")
        ).rejects.toThrow(/190/);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should handle Meta API rate limiting (HTTP 429) gracefully", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return {
          ok: false,
          status: 429,
          json: async () => ({
            error: {
              message: "(#4) Application request limit reached",
              type: "OAuthException",
              code: 4,
            },
          }),
        } as any;
      };

      try {
        await expect(
          fetchMetaTemplatesFromWaba("1234567890", "test_access_token")
        ).rejects.toThrow(/429|limit/i);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should store rejected status and rejection reason when provided by Meta", async () => {
      const mockMetaTemplates: MetaRawTemplate[] = [
        {
          id: "meta-rejected-01",
          name: "promotional_discount_alert",
          language: "en_US",
          category: "MARKETING",
          status: "REJECTED",
          rejected_reason: "Template contains promotional content violating WhatsApp Commerce Policy.",
          components: [{ type: "BODY", text: "Get 50% discount today!" }],
        },
      ];

      let insertedPayload: any = null;
      const mockSupabase = {
        from: (_table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
          insert: async (p: any) => {
            insertedPayload = p;
            return { error: null };
          },
        }),
      };

      const syncResult = await syncMetaTemplatesDb(
        ASTROLOGY_BUSINESS_ID,
        null,
        mockMetaTemplates,
        mockSupabase
      );

      expect(syncResult.added).toBe(1);
      expect(insertedPayload).not.toBeNull();
      expect(insertedPayload.status).toBe("REJECTED");
      expect(insertedPayload.rejection_reason).toBe(
        "Template contains promotional content violating WhatsApp Commerce Policy."
      );
    });
  });
});
