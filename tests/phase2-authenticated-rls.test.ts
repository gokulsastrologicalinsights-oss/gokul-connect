import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";

describe("Phase 2.4: Authenticated Multi-Tenant RLS & Security Definer Tests", () => {
  let db: PGlite;
  const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";
  const USER_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Astrology Owner
  const USER_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // Vivaham Owner

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup Auth Mock Schema
    await db.exec(`
      DO $$
      BEGIN
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

      -- Session auth.uid() function simulating active Supabase JWT
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT current_setting('request.jwt.claim.sub', true)::UUID;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS JSONB
      LANGUAGE sql
      STABLE
      AS $$
        SELECT jsonb_build_object(
          'sub', current_setting('request.jwt.claim.sub', true),
          'role', 'authenticated'
        );
      $$;
    `);

    // 2. Load Migrations 001, 002, 003, 004
    const mig1 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_001_phase1_foundation.sql"), "utf8")
      .replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- native');
    const mig2 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_002_phase2_wa_connections.sql"), "utf8");
    const mig3 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_003_phase2_wa_credentials.sql"), "utf8");
    const mig4 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_004_phase2_privilege_escalation_guard.sql"), "utf8");

    await db.exec(mig1);
    await db.exec(mig2);
    await db.exec(mig3);
    await db.exec(mig4);

    // Enable FORCE ROW LEVEL SECURITY for all tables and grant permissions
    await db.exec(`
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

      ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.business_members FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.wa_connections FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.business_settings FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.wa_credentials FORCE ROW LEVEL SECURITY;
    `);

    // 3. Insert Test Users and Memberships
    await db.query(`
      INSERT INTO auth.users (id, email) VALUES
        ($1, 'user_a@gokulconnect.com'),
        ($2, 'user_b@gokulconnect.com');
    `, [USER_A_ID, USER_B_ID]);

    await db.query(`
      INSERT INTO public.business_members (business_id, user_id, role, is_active) VALUES
        ($1, $2, 'owner', true),
        ($3, $4, 'owner', true);
    `, [ASTROLOGY_ID, USER_A_ID, VIVAHAM_ID, USER_B_ID]);
  });

  // Helper to run query under specific user session
  async function runAsUser<T = any>(userId: string, sql: string, params: any[] = []): Promise<T[]> {
    await db.exec(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${userId}';
    `);
    const res = await db.query<T>(sql, params);
    return res.rows;
  }

  // TC-AUTH-RLS-01: Astrology user reads Astrology data
  it("TC-AUTH-RLS-01: Astrology user can read Astrology business data (ALLOWED)", async () => {
    const rows = await runAsUser(USER_A_ID, "SELECT * FROM public.businesses;");
    expect(rows.length).toBe(1);
    expect((rows[0] as any).slug).toBe("astrology");
  });

  // TC-AUTH-RLS-02: Astrology user reads Vivaham data (BLOCKED)
  it("TC-AUTH-RLS-02: Astrology user cannot read Vivaham business data (BLOCKED)", async () => {
    const rows = await runAsUser(USER_A_ID, "SELECT * FROM public.businesses WHERE slug = 'vivaham';");
    expect(rows.length).toBe(0);
  });

  // TC-AUTH-RLS-03: Vivaham user reads Vivaham data (ALLOWED)
  it("TC-AUTH-RLS-03: Vivaham user can read Vivaham business data (ALLOWED)", async () => {
    const rows = await runAsUser(USER_B_ID, "SELECT * FROM public.businesses;");
    expect(rows.length).toBe(1);
    expect((rows[0] as any).slug).toBe("vivaham");
  });

  // TC-AUTH-RLS-04: Vivaham user reads Astrology data (BLOCKED)
  it("TC-AUTH-RLS-04: Vivaham user cannot read Astrology business data (BLOCKED)", async () => {
    const rows = await runAsUser(USER_B_ID, "SELECT * FROM public.businesses WHERE slug = 'astrology';");
    expect(rows.length).toBe(0);
  });

  // TC-AUTH-RLS-05: Astrology user updates Vivaham records (BLOCKED)
  it("TC-AUTH-RLS-05: Astrology user cannot update Vivaham business settings (BLOCKED)", async () => {
    await runAsUser(
      USER_A_ID,
      "UPDATE public.business_settings SET display_name = 'Hacked Vivaham' WHERE business_id = $1;",
      [VIVAHAM_ID]
    );

    // Verify Vivaham settings remained intact
    const settings = await runAsUser(USER_B_ID, "SELECT display_name FROM public.business_settings;");
    expect((settings[0] as any).display_name).toBe("Gokul Vivaham");
  });

  // TC-AUTH-RLS-06: Vivaham user updates Astrology records (BLOCKED)
  it("TC-AUTH-RLS-06: Vivaham user cannot update Astrology business settings (BLOCKED)", async () => {
    await runAsUser(
      USER_B_ID,
      "UPDATE public.business_settings SET display_name = 'Hacked Astrology' WHERE business_id = $1;",
      [ASTROLOGY_ID]
    );

    const settings = await runAsUser(USER_A_ID, "SELECT display_name FROM public.business_settings;");
    expect((settings[0] as any).display_name).toBe("Gokul's Astrological Insights");
  });

  // TC-AUTH-RLS-07: Cross-business INSERT (BLOCKED)
  it("TC-AUTH-RLS-07: Astrology user cannot insert WhatsApp connections for Vivaham (BLOCKED)", async () => {
    await expect(async () => {
      await runAsUser(
        USER_A_ID,
        `INSERT INTO public.wa_connections (
          business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
        ) VALUES ($1, 'Rogue Line', '+91 99999 00000', 'ROGUE_ID_1', 'WABA_R', 'vault:r');`,
        [VIVAHAM_ID]
      );
    }).rejects.toThrow();
  });

  // TC-AUTH-RLS-08: Cross-business DELETE (BLOCKED)
  it("TC-AUTH-RLS-08: Vivaham user cannot delete Astrology WhatsApp connections (BLOCKED)", async () => {
    // Service role inserts an Astrology connection
    await db.exec("SET ROLE postgres; SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';");
    const connId = "55555555-5555-5555-5555-555555555555";
    await db.query(`
      INSERT INTO public.wa_connections (
        id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
      ) VALUES ($1, $2, 'Astro Perm Line', '+91 98400 33333', 'PHONE_PERM_1', 'WABA_P', 'vault:p')
      ON CONFLICT DO NOTHING;
    `, [connId, ASTROLOGY_ID]);

    // Vivaham user attempts to delete it
    await runAsUser(USER_B_ID, "DELETE FROM public.wa_connections WHERE id = $1;", [connId]);

    // Check if Astrology connection still exists
    const check = await runAsUser(USER_A_ID, "SELECT id FROM public.wa_connections WHERE id = $1;", [connId]);
    expect(check.length).toBe(1);
  });

  // TC-AUTH-RLS-09: Business ID manipulation on UPDATE is BLOCKED by trigger
  it("TC-AUTH-RLS-09: Reassigning business_id on wa_connections is BLOCKED by immutability trigger", async () => {
    await expect(async () => {
      await runAsUser(
        USER_A_ID,
        "UPDATE public.wa_connections SET business_id = $1 WHERE id = '55555555-5555-5555-5555-555555555555';",
        [VIVAHAM_ID]
      );
    }).rejects.toThrow(/Tenant reassignment forbidden/);
  });

  // TC-AUTH-RLS-10: Self-privilege escalation to is_superadmin is BLOCKED by trigger
  it("TC-AUTH-RLS-10: Updating is_superadmin on user_profiles is BLOCKED by escalation trigger", async () => {
    await expect(async () => {
      await runAsUser(
        USER_A_ID,
        "UPDATE public.user_profiles SET is_superadmin = true WHERE id = $1;",
        [USER_A_ID]
      );
    }).rejects.toThrow(/Privilege escalation forbidden/);
  });
});
