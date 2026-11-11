import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("Phase 10 — Analytics RPC Verification on PostgreSQL (PGlite)", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
  const VIVAHAM_CONN_ID = "44444444-4444-4444-4444-444444444444";
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // Setup mock Supabase roles & auth
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
        SELECT '${TEST_USER_ID}'::UUID;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT jsonb_build_object(
          'sub', '${TEST_USER_ID}',
          'role', 'authenticated'
        );
      $$;
    `);

    // Apply all migrations sequentially
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- native');
      await db.exec(sql);
    }

    // Seed test user as member of Astrology business only
    await db.exec(`
      INSERT INTO auth.users (id, email)
      VALUES ('${TEST_USER_ID}', 'astro_agent@example.com')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.user_profiles (id, email, full_name, is_superadmin)
      VALUES ('${TEST_USER_ID}', 'astro_agent@example.com', 'Astro Agent', false)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.business_members (business_id, user_id, role, is_active)
      VALUES ('${ASTRO_BIZ_ID}', '${TEST_USER_ID}', 'agent', true)
      ON CONFLICT (business_id, user_id) DO NOTHING;

      INSERT INTO public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref)
      VALUES ('${ASTRO_CONN_ID}', '${ASTRO_BIZ_ID}', 'Astrology Official', '+919444559071', '109283746501928', 'waba-123', 'vault-ref-1')
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  it("Test 1: get_business_analytics_summary enforces strict tenant authorization guard", async () => {
    // Calling for Vivaham where user is NOT a member must throw Unauthorized
    await expect(
      db.query(`
        SELECT public.get_business_analytics_summary(
          '${VIVAHAM_BIZ_ID}'::UUID,
          NOW() - INTERVAL '7 days',
          NOW()
        );
      `)
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("Test 2: get_business_analytics_summary succeeds for authorized tenant and returns valid JSONB", async () => {
    const res = await db.query(`
      SELECT public.get_business_analytics_summary(
        '${ASTRO_BIZ_ID}'::UUID,
        NOW() - INTERVAL '7 days',
        NOW()
      ) AS summary;
    `);

    expect(res.rows.length).toBe(1);
    const summary = (res as any).rows[0].summary as any;
    expect(summary.business_id).toBe(ASTRO_BIZ_ID);
    expect(summary.messaging).toBeDefined();
    expect(summary.contacts).toBeDefined();
    expect(summary.conversations).toBeDefined();
    expect(summary.automations).toBeDefined();
  });

  it("Test 3: Seed messaging data and verify exact RPC count aggregation", async () => {
    // Insert a contact, conversation, and messages for Astrology
    const contactRes = await db.query(`
      INSERT INTO public.wa_contacts (business_id, phone_number, display_name)
      VALUES ('${ASTRO_BIZ_ID}', '+919999911111', 'RPC Test Contact')
      RETURNING id;
    `);
    const contactId = (contactRes as any).rows[0].id;

    const convRes = await db.query(`
      INSERT INTO public.wa_conversations (business_id, connection_id, contact_id, status)
      VALUES ('${ASTRO_BIZ_ID}', '${ASTRO_CONN_ID}', '${contactId}', 'open')
      RETURNING id;
    `);
    const convId = (convRes as any).rows[0].id;

    // Insert 1 inbound, 1 delivered outbound, 1 read outbound
    await db.exec(`
      INSERT INTO public.wa_messages (business_id, connection_id, conversation_id, contact_id, direction, status, content, created_at)
      VALUES
        ('${ASTRO_BIZ_ID}', '${ASTRO_CONN_ID}', '${convId}', '${contactId}', 'inbound', 'delivered', 'Enquiry message', NOW() - INTERVAL '1 hour'),
        ('${ASTRO_BIZ_ID}', '${ASTRO_CONN_ID}', '${convId}', '${contactId}', 'outbound', 'delivered', 'Reply 1', NOW() - INTERVAL '50 minutes'),
        ('${ASTRO_BIZ_ID}', '${ASTRO_CONN_ID}', '${convId}', '${contactId}', 'outbound', 'read', 'Reply 2', NOW() - INTERVAL '40 minutes');
    `);

    const res = await db.query(`
      SELECT public.get_business_analytics_summary(
        '${ASTRO_BIZ_ID}'::UUID,
        NOW() - INTERVAL '1 day',
        NOW() + INTERVAL '1 day'
      ) AS summary;
    `);

    const summary = (res as any).rows[0].summary as any;
    expect(summary.messaging.total_inbound).toBe(1);
    expect(summary.messaging.total_outbound).toBe(2);
    expect(summary.messaging.delivered).toBe(2); // 1 delivered + 1 read
    expect(summary.messaging.read).toBe(1);
    expect(summary.contacts.total_contacts).toBeGreaterThanOrEqual(1);
    expect(summary.conversations.open_conversations).toBeGreaterThanOrEqual(1);
  });

  it("Test 4: get_business_analytics_daily_trends returns day buckets with Asia/Kolkata timezone", async () => {
    const res = await db.query(`
      SELECT public.get_business_analytics_daily_trends(
        '${ASTRO_BIZ_ID}'::UUID,
        NOW() - INTERVAL '2 days',
        NOW()
      ) AS trends;
    `);

    const trends = (res as any).rows[0].trends as any[];
    expect(Array.isArray(trends)).toBe(true);
    expect(trends.length).toBeGreaterThanOrEqual(2);
    expect(trends[0]).toHaveProperty("date");
    expect(trends[0]).toHaveProperty("inbound");
    expect(trends[0]).toHaveProperty("outbound");
    expect(trends[0]).toHaveProperty("total");
  });
});
