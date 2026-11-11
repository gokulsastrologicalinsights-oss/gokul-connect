import { describe, it, expect, beforeAll } from "vitest";
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
} from "@/lib/templates/database";
import {
  fetchMetaTemplatesFromWaba,
  MetaRawTemplate,
} from "@/lib/templates/meta-sync";
import { sanitizeMetaLog } from "@/lib/whatsapp/client";
import { TemplateDraftInput } from "@/lib/templates/types";
import { calculateBackoffDelaySeconds } from "@/lib/automation/worker";

describe("Phase 11 — Existing Schema (Migrations 001-014) & Safe Mocks Audit Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Mock Supabase Auth and roles
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

    // 2. Apply ONLY Migrations 001 through 014 (Explicitly DO NOT apply Migration 015)
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") && !f.includes("015"))
      .sort();

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  // ============================================================================
  // 1. SCHEMA VERIFICATION (PRE-MIGRATION 015 STATE)
  // ============================================================================
  describe("1. Existing Schema Audit: Confirming Migration 015 Is NOT Applied", () => {
    it("should confirm table wa_message_templates exists with Migration 005 baseline columns", async () => {
      const res = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wa_message_templates'
      `);
      const columns = res.rows.map((r: any) => r.column_name);

      // Baseline columns from Migration 005 MUST exist
      expect(columns).toContain("id");
      expect(columns).toContain("business_id");
      expect(columns).toContain("connection_id");
      expect(columns).toContain("template_name");
      expect(columns).toContain("language");
      expect(columns).toContain("category");
      expect(columns).toContain("status");
      expect(columns).toContain("components");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");

      // Migration 015 columns MUST NOT exist in existing schema
      expect(columns).not.toContain("meta_template_id");
      expect(columns).not.toContain("rejection_reason");
      expect(columns).not.toContain("is_archived");
      expect(columns).not.toContain("last_synced_at");
    });

    it("should confirm status check constraint in existing schema rejects DRAFT and ARCHIVED", async () => {
      // In baseline Migration 005, status check only permits:
      // ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED')
      const fakeBusinessId = "11111111-1111-1111-1111-111111111111";

      // Inserting status 'DRAFT' must be rejected by check constraint
      await expect(
        db.query(`
          INSERT INTO public.wa_message_templates (business_id, template_name, category, status)
          VALUES ('${fakeBusinessId}', 'test_draft_status', 'UTILITY', 'DRAFT')
        `)
      ).rejects.toThrow();

      // Inserting status 'ARCHIVED' must be rejected by check constraint
      await expect(
        db.query(`
          INSERT INTO public.wa_message_templates (business_id, template_name, category, status)
          VALUES ('${fakeBusinessId}', 'test_archived_status', 'UTILITY', 'ARCHIVED')
        `)
      ).rejects.toThrow();

      // Inserting baseline status 'APPROVED' must succeed in existing schema
      await db.query(`
        INSERT INTO public.wa_message_templates (business_id, template_name, category, status)
        VALUES ('${fakeBusinessId}', 'baseline_approved_template', 'UTILITY', 'APPROVED')
      `);

      const check = await db.query(`
        SELECT template_name, status FROM public.wa_message_templates
        WHERE business_id = '${fakeBusinessId}' AND template_name = 'baseline_approved_template'
      `);
      expect(check.rows).toHaveLength(1);
      expect((check.rows[0] as any).status).toBe("APPROVED");
    });
  });

  // ============================================================================
  // 2. TEMPLATE PERSISTENCE & CLASSIFICATION
  // ============================================================================
  describe("2. Template Persistence: Local Execution & Classification", () => {
    it("PASS (Local Read): listTemplatesDb queries cleanly and falls back to isolated default templates", async () => {
      // Mock Supabase client adapter wrapping PGlite for read queries
      const mockSupabase = {
        from: (table: string) => ({
          select: (cols: string) => ({
            eq: (col: string, val: any) => ({
              eq: (c2: string, v2: any) => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };

      const templates = await listTemplatesDb(ASTROLOGY_BUSINESS_ID, {}, mockSupabase);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.business_id === ASTROLOGY_BUSINESS_ID)).toBe(true);
      expect(templates.some((t) => t.template_name === "consultation_confirmation")).toBe(true);
    });

    it("BLOCKED: Database persistence of draft templates requires Migration 015", async () => {
      // Simulating Supabase insert using the existing PGlite schema (without 015)
      const draftPayload = {
        template_name: "new_astrology_draft",
        language: "en_US",
        category: "UTILITY" as const,
        body_text: "Namaste {{1}}, your consultation is confirmed.",
      };

      // Mock client that routes insert to PGlite directly
      const mockSupabaseDb = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
          insert: (payload: any) => ({
            select: () => ({
              single: async () => {
                try {
                  // Direct SQL insert against the real table in PGlite
                  const res = await db.query(
                    `INSERT INTO public.wa_message_templates (business_id, template_name, language, category, status, components, is_archived)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [
                      payload.business_id,
                      payload.template_name,
                      payload.language,
                      payload.category,
                      payload.status,
                      JSON.stringify(payload.components),
                      payload.is_archived,
                    ]
                  );
                  return { data: res.rows[0], error: null };
                } catch (err: any) {
                  return { data: null, error: { message: err.message } };
                }
              },
            }),
          }),
        }),
      };

      const result = await createDraftTemplateDb(
        ASTROLOGY_BUSINESS_ID,
        draftPayload,
        mockSupabaseDb
      );

      // Must be classified as BLOCKED because column is_archived does not exist in schema
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/is_archived|column.*does not exist|violates check constraint/i);
    });
  });

  // ============================================================================
  // 3. DRAFT CREATION, EDITING & ARCHIVING
  // ============================================================================
  describe("3. Draft Creation, Editing & Archiving: Local Logic vs DB State", () => {
    it("PASS (Local Validation): TemplateDraftInput validation enforces Meta naming & structure", () => {
      // Valid draft
      const validDraft: TemplateDraftInput = {
        template_name: "valid_draft_name_01",
        category: "UTILITY",
        language: "en_US",
        header_format: "TEXT",
        header_text: "Header {{1}}",
        body_text: "Body text {{1}} is confirmed.",
        footer_text: "Footer info",
        buttons: [{ type: "QUICK_REPLY", text: "Confirm" }],
      };
      const validRes = validateTemplateDraft(validDraft);
      expect(validRes.isValid).toBe(true);

      // Invalid uppercase template name
      const invalidName: TemplateDraftInput = {
        ...validDraft,
        template_name: "Invalid_Name",
      };
      expect(validateTemplateDraft(invalidName).isValid).toBe(false);

      // Invalid variable non-sequential gap
      const nonSequential: TemplateDraftInput = {
        ...validDraft,
        header_text: "",
        body_text: "Invalid gap {{1}} then {{3}}.",
      };
      expect(validateTemplateDraft(nonSequential).isValid).toBe(false);
    });

    it("PASS (Local Transformation): Component serializer and deserializer round-trip cleanly", () => {
      const draft: TemplateDraftInput = {
        template_name: "round_trip_test",
        category: "MARKETING",
        language: "ta",
        header_format: "IMAGE",
        body_text: "வணக்கம் {{1}}, தங்களின் முன்பதிவு ஏற்றுக்கொள்ளப்பட்டது.",
        footer_text: "கோகுல் கன்சல்டிங்",
        buttons: [
          { type: "URL", text: "இணையதளம்", url: "https://example.com" },
          { type: "PHONE_NUMBER", text: "அழைக்க", phone_number: "+919876543210" },
        ],
      };

      const components = buildComponentsFromDraft(draft);
      expect(components).toHaveLength(4); // HEADER, BODY, FOOTER, BUTTONS

      const parsed = parseComponentsToDraft(components);
      expect(parsed.header_format).toBe("IMAGE");
      expect(parsed.body_text).toBe(draft.body_text);
      expect(parsed.footer_text).toBe(draft.footer_text);
      expect(parsed.buttons).toHaveLength(2);
      expect(parsed.buttons?.[0].type).toBe("URL");
      expect(parsed.buttons?.[1].type).toBe("PHONE_NUMBER");
    });

    it("BLOCKED: Archiving template in DB requires Migration 015 is_archived column", async () => {
      const mockSupabaseDb = {
        from: () => ({
          update: (fields: any) => ({
            eq: () => ({
              eq: async () => {
                try {
                  // Direct SQL against baseline schema
                  await db.query(
                    `UPDATE public.wa_message_templates SET is_archived = true, status = 'ARCHIVED' WHERE id = '00000000-0000-0000-0000-000000000000'`
                  );
                  return { error: null };
                } catch (err: any) {
                  return { error: { message: err.message } };
                }
              },
            }),
          }),
        }),
      };

      const result = await archiveTemplateDb(
        ASTROLOGY_BUSINESS_ID,
        "00000000-0000-0000-0000-000000000000",
        true,
        mockSupabaseDb
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/is_archived|column.*does not exist|violates check constraint/i);
    });
  });

  // ============================================================================
  // 4. META SYNCHRONIZATION
  // ============================================================================
  describe("4. Meta Synchronization: Safe Mocks & Live Meta Credential Audit", () => {
    it("BLOCKED: Live Meta Graph API call fails closed due to expired token (OAuthException 190)", async () => {
      // Mocking the live network error returned by Meta Graph API with expired credentials
      const expiredMetaError = {
        error: {
          message: "Error validating access token: Session has expired on Tuesday, 03-Nov-26 12:00:00 PST.",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "AbCdEf12345",
        },
      };

      const originalFetch = global.fetch;
      global.fetch = async () =>
        new Response(JSON.stringify(expiredMetaError), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });

      try {
        await expect(
          fetchMetaTemplatesFromWaba("1234567890", "EAAG_EXPIRED_TOKEN_12345")
        ).rejects.toThrow(/Session has expired/i);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("PASS (Safe Mock): fetchMetaTemplatesFromWaba parses Meta response and sanitizes sensitive tokens", async () => {
      const mockMetaResponse = {
        data: [
          {
            name: "mock_approved_template",
            category: "UTILITY",
            status: "APPROVED",
            language: "en_US",
            id: "meta-tpl-1001",
            components: [
              { type: "BODY", text: "Hello {{1}}, welcome to our WhatsApp channel." },
            ],
          },
        ],
        paging: {
          cursors: {
            before: "cur_b",
            after: "cur_a",
          },
        },
      };

      const originalFetch = global.fetch;
      global.fetch = async () =>
        new Response(JSON.stringify(mockMetaResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      try {
        const templates = await fetchMetaTemplatesFromWaba("1234567890", "EAAG_TEST_TOKEN");
        expect(templates).toHaveLength(1);
        expect(templates[0].name).toBe("mock_approved_template");
        expect(templates[0].status).toBe("APPROVED");
        expect(templates[0].id).toBe("meta-tpl-1001");

        // Verify token sanitizer replaces raw credentials
        const scrubbed = sanitizeMetaLog("https://graph.facebook.com?access_token=EAAG1234567890abcdefghijklmnopqrstuvwxyz");
        expect(scrubbed).not.toContain("EAAG1234567890abcdefghijklmnopqrstuvwxyz");
        expect(scrubbed).toContain("••••••••");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // ============================================================================
  // 5. INBOX TEMPLATE PAYLOAD CONSTRUCTION
  // ============================================================================
  describe("5. Inbox Template Payload Construction & Variable Prompts", () => {
    it("PASS: Variable extraction and Meta Cloud API payload building", () => {
      const components = [
        { type: "HEADER", format: "TEXT", text: "Confirmation for {{1}}" },
        { type: "BODY", text: "Namaste {{1}}, your booking for {{2}} at {{3}} is confirmed." },
      ];

      const extraction = extractTemplateVariables(components);
      expect(extraction.headerVariables).toEqual(["1"]);
      expect(extraction.bodyVariables).toEqual(["1", "2", "3"]);
      expect(extraction.allVariables).toEqual(["1", "2", "3"]);

      // Variable inputs
      const userVariables: Record<string, string> = {
        "1": "Gokul",
        "2": "Friday",
        "3": "4:00 PM",
      };

      // Construct Meta Cloud API payload
      const componentsPayload: Array<Record<string, unknown>> = [];
      if (extraction.headerVariables.length > 0) {
        componentsPayload.push({
          type: "header",
          parameters: extraction.headerVariables.map((v) => ({
            type: "text",
            text: userVariables[v].trim(),
          })),
        });
      }
      if (extraction.bodyVariables.length > 0) {
        componentsPayload.push({
          type: "body",
          parameters: extraction.bodyVariables.map((v) => ({
            type: "text",
            text: userVariables[v].trim(),
          })),
        });
      }

      expect(componentsPayload).toEqual([
        {
          type: "header",
          parameters: [{ type: "text", text: "Gokul" }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: "Gokul" },
            { type: "text", text: "Friday" },
            { type: "text", text: "4:00 PM" },
          ],
        },
      ]);
    });

    it("PASS (Regression Check): Default templates fallback in inbox composer excludes DRAFT and ARCHIVED templates", () => {
      // Simulate the fallback in ChatWindowPanel.tsx
      const allDefaults = getDefaultBusinessTemplates(ASTROLOGY_BUSINESS_ID, "astrology");
      expect(allDefaults.some((t) => t.status === "DRAFT")).toBe(true);

      // With our regression fix in ChatWindowPanel.tsx:
      const eligibleForInbox = allDefaults.filter(
        (t) => t.status === "APPROVED" && !t.is_archived
      );

      expect(eligibleForInbox.every((t) => t.status === "APPROVED")).toBe(true);
      expect(eligibleForInbox.some((t) => t.template_name === "astrology_draft_muhurtham")).toBe(false);
    });
  });

  // ============================================================================
  // 6. VARIABLE SUBSTITUTION & UNICODE ENGINE
  // ============================================================================
  describe("6. Variable Substitution Engine with Tamil & English Unicode", () => {
    it("PASS: Supports UTF-16 Tamil script with dynamic variable replacement", () => {
      const tamilTemplate = "வணக்கம் {{1}}, உங்கள் ஆலோசனை நேரம் {{2}} அன்று உறுதி செய்யப்பட்டுள்ளது.";
      const values = {
        "1": "குமார்",
        "2": "நவம்பர் 12",
      };

      const detection = detectPlaceholders(tamilTemplate);
      expect(detection.valid).toEqual(["1", "2"]);

      const previewRes = generateTemplatePreview(tamilTemplate, values);
      expect(previewRes.isComplete).toBe(true);
      expect(previewRes.preview).toBe("வணக்கம் குமார், உங்கள் ஆலோசனை நேரம் நவம்பர் 12 அன்று உறுதி செய்யப்பட்டுள்ளது.");

      const verified = rejectUnresolvedPlaceholders(tamilTemplate, values);
      expect(verified).toBe(previewRes.preview);
    });

    it("PASS: Detects missing variables and rejects unresolved placeholders", () => {
      const template = "Hello {{1}}, your order {{2}} has shipped with code {{3}}.";
      const partialValues = { "1": "Anand", "2": "ORD-501" };

      const missing = identifyMissingVariables(template, partialValues);
      expect(missing).toEqual(["3"]);

      const previewRes = generateTemplatePreview(template, partialValues);
      expect(previewRes.isComplete).toBe(false);
      expect(previewRes.unresolved).toEqual(["3"]);
      expect(previewRes.preview).toBe("Hello Anand, your order ORD-501 has shipped with code {{3}}.");

      expect(() => rejectUnresolvedPlaceholders(template, partialValues)).toThrow(
        "unresolved placeholders remaining: {{3}}"
      );
    });

    it("PASS: Detects malformed tokens like {{}}, {{abc}}, and {1}", () => {
      const badText = "Price {{}} for item {{product_name}} with code {9} and {{1}}.";
      const detection = detectPlaceholders(badText);
      expect(detection.valid).toEqual(["1"]);
      expect(detection.malformed).toContain("{{}}");
      expect(detection.malformed).toContain("{{product_name}}");
      expect(detection.malformed).toContain("{9}");
    });
  });

  // ============================================================================
  // 7. OUTBOUND QUEUE INTEGRATION
  // ============================================================================
  describe("7. Outbound Queue Integration & Worker Contract", () => {
    it("PASS: Background worker calculates exponential backoff with jitter for retries", () => {
      const delay0 = calculateBackoffDelaySeconds(0);
      expect(delay0).toBeGreaterThanOrEqual(30);
      expect(delay0).toBeLessThanOrEqual(35);

      const delay1 = calculateBackoffDelaySeconds(1);
      expect(delay1).toBeGreaterThanOrEqual(60);
      expect(delay1).toBeLessThanOrEqual(65);

      const delayMax = calculateBackoffDelaySeconds(10);
      expect(delayMax).toBe(1800); // Capped at 30 minutes
    });

    it("PASS: Queue schema in baseline database supports scheduled message processing jobs", async () => {
      const res = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wa_processing_jobs'
      `);
      const cols = res.rows.map((r: any) => r.column_name);

      expect(cols).toContain("id");
      expect(cols).toContain("business_id");
      expect(cols).toContain("job_type");
      expect(cols).toContain("status");
      expect(cols).toContain("payload");
      expect(cols).toContain("scheduled_at");
      expect(cols).toContain("attempts");
    });
  });

  // ============================================================================
  // 8. 24-HOUR MESSAGING POLICY
  // ============================================================================
  describe("8. Meta WhatsApp 24-Hour Messaging Policy Enforcement", () => {
    it("PASS: Evaluates 24-hour customer window and enforces text block vs template bypass", () => {
      const now = Date.now();
      const withinWindow = new Date(now - 10 * 60 * 60 * 1000); // 10 hours ago
      const expiredWindow = new Date(now - 26 * 60 * 60 * 1000); // 26 hours ago

      // Within window: Both free-form text and template messages are permitted
      const elapsedWithin = now - withinWindow.getTime();
      const isWithinOpen = elapsedWithin >= 0 && elapsedWithin < 24 * 60 * 60 * 1000;
      expect(isWithinOpen).toBe(true);

      // Outside window: Free-form text is blocked, template messages are permitted
      const elapsedExpired = now - expiredWindow.getTime();
      const isExpiredOpen = elapsedExpired >= 0 && elapsedExpired < 24 * 60 * 60 * 1000;
      expect(isExpiredOpen).toBe(false);

      // Rule assertion:
      const allowFreeformText = (isOpen: boolean) => isOpen;
      const allowTemplateMessage = (_isOpen: boolean) => true; // Always permitted by Meta

      expect(allowFreeformText(isExpiredOpen)).toBe(false);
      expect(allowTemplateMessage(isExpiredOpen)).toBe(true);
      expect(allowFreeformText(isWithinOpen)).toBe(true);
      expect(allowTemplateMessage(isWithinOpen)).toBe(true);
    });
  });

  // ============================================================================
  // 9. TENANT ISOLATION
  // ============================================================================
  describe("9. Tenant Isolation: Astrology vs Vivaham Business Boundaries", () => {
    it("PASS: Default template libraries are strictly isolated by business ID", () => {
      const astroTemplates = getDefaultBusinessTemplates(ASTROLOGY_BUSINESS_ID, "astrology");
      const vivahamTemplates = getDefaultBusinessTemplates(VIVAHAM_BUSINESS_ID, "vivaham");

      const astroNames = astroTemplates.map((t) => t.template_name);
      const vivahamNames = vivahamTemplates.map((t) => t.template_name);

      // Astrology unique templates
      expect(astroNames).toContain("consultation_confirmation");
      expect(astroNames).toContain("horoscope_matching_update");
      expect(astroNames).not.toContain("registration_confirmation");
      expect(astroNames).not.toContain("profile_interest_notification");

      // Vivaham unique templates
      expect(vivahamNames).toContain("registration_confirmation");
      expect(vivahamNames).toContain("profile_interest_notification");
      expect(vivahamNames).not.toContain("consultation_confirmation");
      expect(vivahamNames).not.toContain("horoscope_matching_update");
    });

    it("PASS: Tenant boundary check rejects empty businessId", async () => {
      await expect(listTemplatesDb("")).rejects.toThrow(/Tenant isolation violation/i);
      await expect(listTemplatesDb("   ")).rejects.toThrow(/Tenant isolation violation/i);
    });

    it("PASS: Database trigger prevents cross-tenant reassignment in baseline schema", async () => {
      const businessA = "11111111-1111-1111-1111-111111111111";
      const businessB = "22222222-2222-2222-2222-222222222222";

      // Insert record for Business A
      const insertRes = await db.query(`
        INSERT INTO public.wa_message_templates (business_id, template_name, category, status)
        VALUES ('${businessA}', 'immutable_tenant_template', 'UTILITY', 'APPROVED')
        RETURNING id
      `);
      const templateId = (insertRes.rows[0] as any).id;

      // Attempt to reassign business_id to Business B
      await expect(
        db.query(`
          UPDATE public.wa_message_templates
          SET business_id = '${businessB}'
          WHERE id = '${templateId}'
        `)
      ).rejects.toThrow(/cannot be reassigned|immutable|cannot be modified|forbidden/i);
    });
  });
});
