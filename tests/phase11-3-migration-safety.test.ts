import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  ASTROLOGY_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/templates/default-templates";

describe("Phase 11.3 — Migration 015 Disposable PGlite Safety & Compatibility Verification", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  let db: PGlite;

  const testExistingTemplateId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup Supabase Roles & Auth mocks
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

    // 2. Replay Migrations 001 through 014 FIRST
    const files001to014 = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") && !f.includes("015"))
      .sort();

    for (const file of files001to014) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }

    // 3. Pre-populate existing business & template rows in pre-migration-015 state
    await db.query(`
      INSERT INTO public.wa_message_templates (
        id, business_id, template_name, language, category, status, components
      ) VALUES (
        '${testExistingTemplateId}',
        '${ASTROLOGY_BUSINESS_ID}',
        'pre_migration_existing_template',
        'en_US',
        'UTILITY',
        'APPROVED',
        '[{"type": "BODY", "text": "Pre-existing template body"}]'::jsonb
      );
    `);

    // 4. Now replay Migration 015
    const migration015Sql = fs
      .readFileSync(path.join(MIGRATIONS_DIR, "20261107_015_phase11_template_management.sql"), "utf-8")
      .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native")
      .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");

    await db.exec(migration015Sql);
  });

  // Test 1: Existing rows survive and retain data
  it("1. Existing template rows survive migration intact with backward-compatible defaults", async () => {
    const res = await db.query(`
      SELECT * FROM public.wa_message_templates WHERE id = '${testExistingTemplateId}';
    `);

    expect(res.rows).toHaveLength(1);
    const row = res.rows[0] as any;
    expect(row.template_name).toBe("pre_migration_existing_template");
    expect(row.status).toBe("APPROVED");
    expect(row.category).toBe("UTILITY");
    expect(row.is_archived).toBe(false); // default applied
    expect(row.meta_template_id).toBeNull(); // nullable default
    expect(row.rejection_reason).toBeNull(); // nullable default
    expect(row.last_synced_at).toBeNull(); // nullable default
  });

  // Test 2: DRAFT insertion succeeds
  it("2. DRAFT status insertion succeeds under new status constraint", async () => {
    const draftId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    await db.query(`
      INSERT INTO public.wa_message_templates (
        id, business_id, template_name, language, category, status, components, is_archived
      ) VALUES (
        '${draftId}',
        '${ASTROLOGY_BUSINESS_ID}',
        'new_draft_template',
        'en_US',
        'UTILITY',
        'DRAFT',
        '[{"type": "BODY", "text": "Draft body {{1}}"}]'::jsonb,
        false
      );
    `);

    const check = await db.query(`
      SELECT status, is_archived FROM public.wa_message_templates WHERE id = '${draftId}';
    `);
    expect(check.rows[0]).toMatchObject({
      status: "DRAFT",
      is_archived: false,
    });
  });

  // Test 3: ARCHIVED status succeeds
  it("3. ARCHIVED status insertion succeeds under new status constraint", async () => {
    const archivedId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await db.query(`
      INSERT INTO public.wa_message_templates (
        id, business_id, template_name, language, category, status, components, is_archived
      ) VALUES (
        '${archivedId}',
        '${ASTROLOGY_BUSINESS_ID}',
        'archived_template',
        'en_US',
        'MARKETING',
        'ARCHIVED',
        '[{"type": "BODY", "text": "Archived body"}]'::jsonb,
        true
      );
    `);

    const check = await db.query(`
      SELECT status, is_archived FROM public.wa_message_templates WHERE id = '${archivedId}';
    `);
    expect(check.rows[0]).toMatchObject({
      status: "ARCHIVED",
      is_archived: true,
    });
  });

  // Test 4: Draft editing works
  it("4. Draft editing works as expected without constraint violations", async () => {
    const draftId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    await db.query(`
      UPDATE public.wa_message_templates
      SET components = '[{"type": "BODY", "text": "Edited draft body {{1}} with updates"}]'::jsonb,
          updated_at = NOW()
      WHERE id = '${draftId}' AND business_id = '${ASTROLOGY_BUSINESS_ID}' AND status = 'DRAFT';
    `);

    const check = await db.query(`
      SELECT components FROM public.wa_message_templates WHERE id = '${draftId}';
    `);
    const comp = (check.rows[0] as any).components;
    expect(comp[0].text).toBe("Edited draft body {{1}} with updates");
  });

  // Test 5: Archive and unarchive work
  it("5. Archive and unarchive operations update is_archived and status correctly", async () => {
    const templateId = testExistingTemplateId;

    // Archive
    await db.query(`
      UPDATE public.wa_message_templates
      SET is_archived = true, status = 'ARCHIVED', updated_at = NOW()
      WHERE id = '${templateId}' AND business_id = '${ASTROLOGY_BUSINESS_ID}';
    `);

    let check = await db.query(`
      SELECT is_archived, status FROM public.wa_message_templates WHERE id = '${templateId}';
    `);
    expect((check.rows[0] as any).is_archived).toBe(true);
    expect((check.rows[0] as any).status).toBe("ARCHIVED");

    // Unarchive
    await db.query(`
      UPDATE public.wa_message_templates
      SET is_archived = false, status = 'APPROVED', updated_at = NOW()
      WHERE id = '${templateId}' AND business_id = '${ASTROLOGY_BUSINESS_ID}';
    `);

    check = await db.query(`
      SELECT is_archived, status FROM public.wa_message_templates WHERE id = '${templateId}';
    `);
    expect((check.rows[0] as any).is_archived).toBe(false);
    expect((check.rows[0] as any).status).toBe("APPROVED");
  });

  // Test 6: Meta sync metadata can be persisted
  it("6. Meta sync metadata (meta_template_id, rejection_reason, last_synced_at) can be persisted", async () => {
    const metaSyncId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const nowIso = new Date().toISOString();

    await db.query(`
      INSERT INTO public.wa_message_templates (
        id, business_id, template_name, language, category, status,
        meta_template_id, rejection_reason, last_synced_at, components
      ) VALUES (
        '${metaSyncId}',
        '${ASTROLOGY_BUSINESS_ID}',
        'meta_synced_template',
        'en_US',
        'MARKETING',
        'REJECTED',
        '987654321012345',
        'Violates promotional messaging policy',
        '${nowIso}',
        '[{"type": "BODY", "text": "Special offer"}]'::jsonb
      );
    `);

    const check = await db.query(`
      SELECT meta_template_id, rejection_reason, last_synced_at, status
      FROM public.wa_message_templates
      WHERE id = '${metaSyncId}';
    `);

    const row = check.rows[0] as any;
    expect(row.meta_template_id).toBe("987654321012345");
    expect(row.rejection_reason).toBe("Violates promotional messaging policy");
    expect(row.status).toBe("REJECTED");
    expect(row.last_synced_at).toBeTruthy();
  });

  // Test 7: Duplicate Meta template IDs handled safely across different tenants or records
  it("7. Duplicate Meta template IDs do not trigger unwanted constraint collisions", async () => {
    // Both Astro and Vivaham having the same Meta Template ID (e.g. shared template or cross-tenant sync)
    const sharedMetaId = "META_GLOBAL_TPL_001";

    const astroTplId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const vivahamTplId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

    await db.query(`
      INSERT INTO public.wa_message_templates (
        id, business_id, template_name, language, category, status, meta_template_id
      ) VALUES (
        '${astroTplId}',
        '${ASTROLOGY_BUSINESS_ID}',
        'astro_shared_template',
        'en_US',
        'UTILITY',
        'APPROVED',
        '${sharedMetaId}'
      );
    `);

    // Vivaham inserting same meta_template_id must SUCCEED because index is tenant-scoped
    await db.query(`
      INSERT INTO public.wa_message_templates (
        id, business_id, template_name, language, category, status, meta_template_id
      ) VALUES (
        '${vivahamTplId}',
        '${VIVAHAM_BUSINESS_ID}',
        'vivaham_shared_template',
        'en_US',
        'UTILITY',
        'APPROVED',
        '${sharedMetaId}'
      );
    `);

    const countRes = await db.query(`
      SELECT count(*) as c FROM public.wa_message_templates WHERE meta_template_id = '${sharedMetaId}';
    `);
    expect(Number((countRes.rows[0] as any).c)).toBe(2);
  });

  // Test 8: Cross-tenant access remains blocked via trigger and foreign key constraints
  it("8. Cross-tenant access and tenant reassignment remain strictly blocked", async () => {
    const templateId = testExistingTemplateId;

    // Direct attempt to reassign business_id across tenants
    await expect(
      db.query(`
        UPDATE public.wa_message_templates
        SET business_id = '${VIVAHAM_BUSINESS_ID}'
        WHERE id = '${templateId}';
      `)
    ).rejects.toThrow(/Tenant reassignment forbidden/i);
  });

  // Test 9: Migration 015 is idempotent (can be re-executed safely)
  it("9. Migration 015 is strictly idempotent and safe to re-run", async () => {
    const migration015Sql = fs
      .readFileSync(path.join(MIGRATIONS_DIR, "20261107_015_phase11_template_management.sql"), "utf-8")
      .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native")
      .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");

    // Second execution must not fail
    await expect(db.exec(migration015Sql)).resolves.not.toThrow();

    // Verify constraints and columns remain intact after re-run
    const res = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wa_message_templates';
    `);
    const cols = res.rows.map((r: any) => r.column_name);
    expect(cols).toContain("meta_template_id");
    expect(cols).toContain("is_archived");
  });
});
