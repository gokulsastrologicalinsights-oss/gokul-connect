import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { createAdminClient } from "@/lib/supabase/admin";
import * as worker from "@/lib/meta-social/worker";
import * as webhookRoute from "@/app/api/webhooks/meta-social/route";

describe("Phase 13B.4.1 — RPC Privilege Hardening & Security Verification", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const migration027Path = path.join(MIGRATIONS_DIR, "20261122_027_meta_social_critical_fixes.sql");
  const migration028Path = path.join(MIGRATIONS_DIR, "20261122_028_meta_social_worker_reliability.sql");

  let sql027: string;
  let sql028: string;
  let db: PGlite;

  beforeAll(async () => {
    sql027 = fs.readFileSync(migration027Path, "utf-8");
    sql028 = fs.readFileSync(migration028Path, "utf-8");

    // Initialize in-memory PGlite instance to verify PostgreSQL privilege enforcement
    db = new PGlite();

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

      -- Schema mocks required for function definitions
      CREATE TABLE IF NOT EXISTS public.businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.meta_social_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES public.businesses(id),
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        username TEXT,
        page_id TEXT,
        credential_ref TEXT,
        is_enabled BOOLEAN DEFAULT true,
        connection_status TEXT DEFAULT 'connected',
        auto_reply_dms BOOLEAN DEFAULT false,
        auto_reply_comments BOOLEAN DEFAULT false,
        auto_dm_on_comment BOOLEAN DEFAULT false,
        comment_dm_trigger_keywords TEXT[] DEFAULT '{}',
        default_comment_reply TEXT,
        default_dm_reply TEXT,
        last_webhook_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_conn_id_biz UNIQUE (id, business_id)
      );

      CREATE TABLE IF NOT EXISTS public.meta_social_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES public.businesses(id),
        connection_id UUID REFERENCES public.meta_social_connections(id),
        platform TEXT NOT NULL,
        event_type TEXT NOT NULL,
        meta_event_id TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        post_id TEXT,
        comment_id TEXT,
        parent_comment_id TEXT,
        content TEXT,
        event_timestamp TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'received',
        attempt_count INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        claimed_by TEXT,
        claimed_at TIMESTAMPTZ,
        lease_expires_at TIMESTAMPTZ,
        next_retry_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_events_id_biz UNIQUE (id, business_id),
        CONSTRAINT uq_events_meta UNIQUE (business_id, meta_event_id)
      );

      -- RLS and Delivery Ledger mocks from Migration 027
      CREATE OR REPLACE FUNCTION public.check_user_business_access(b_id UUID)
      RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
        SELECT b_id = '11111111-1111-1111-1111-111111111111'::UUID;
      $$;

      CREATE OR REPLACE FUNCTION public.is_superadmin()
      RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
        SELECT false;
      $$;

      CREATE TABLE IF NOT EXISTS public.meta_social_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES public.businesses(id),
        connection_id UUID REFERENCES public.meta_social_connections(id),
        event_id UUID REFERENCES public.meta_social_events(id),
        action_type TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.meta_social_deliveries ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "service_role_meta_social_deliveries" ON public.meta_social_deliveries;
      CREATE POLICY "service_role_meta_social_deliveries"
          ON public.meta_social_deliveries
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);

      DROP POLICY IF EXISTS "Tenant isolation for meta_social_deliveries select" ON public.meta_social_deliveries;
      CREATE POLICY "Tenant isolation for meta_social_deliveries select"
          ON public.meta_social_deliveries
          FOR SELECT
          TO authenticated
          USING (
              (select public.check_user_business_access(business_id))
              OR (select public.is_superadmin())
          );

      GRANT SELECT ON public.meta_social_deliveries TO authenticated;
      GRANT ALL ON public.meta_social_deliveries TO service_role;
    `);

    // Extract and create functions and their privilege grants from Migration 027 & 028
    // Simulate legacy Migration 026 10-param function existing prior to Migration 027
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.ingest_meta_social_event_atomic(
        p_platform TEXT, p_account_id TEXT, p_event_type TEXT, p_meta_event_id TEXT,
        p_sender_id TEXT, p_sender_name TEXT, p_post_id TEXT, p_comment_id TEXT,
        p_parent_comment_id TEXT, p_content TEXT
      ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN RETURN jsonb_build_object('status', 'legacy_10'); END;
      $$;
      GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
    `);

    // Apply Migration 027 DROP statement for legacy 10-param overload
    const dropDef = sql027.substring(
      sql027.indexOf("DROP FUNCTION IF EXISTS public.ingest_meta_social_event_atomic"),
      sql027.indexOf("CREATE OR REPLACE FUNCTION public.ingest_meta_social_event_atomic")
    );
    await db.exec(dropDef);

    // 1. Create ingest_meta_social_event_atomic
    const ingestDef = sql027.substring(
      sql027.indexOf("CREATE OR REPLACE FUNCTION public.ingest_meta_social_event_atomic"),
      sql027.indexOf("-- ------------------------------------------------------------------------------\n-- 6. PRIVILEGE HARDENING")
    );
    await db.exec(ingestDef);

    // Apply 027 privilege statements
    const ingestPrivs = sql027.substring(
      sql027.indexOf("REVOKE ALL ON FUNCTION public.ingest_meta_social_event_atomic"),
      sql027.indexOf("COMMENT ON FUNCTION public.ingest_meta_social_event_atomic")
    );
    await db.exec(ingestPrivs);

    // 2. Create claim_meta_social_events
    const claimDef = sql028.substring(
      sql028.indexOf("CREATE OR REPLACE FUNCTION public.claim_meta_social_events"),
      sql028.indexOf("CREATE OR REPLACE FUNCTION public.reclaim_stuck_meta_social_events")
    );
    await db.exec(claimDef);

    // 3. Create reclaim_stuck_meta_social_events
    const reclaimDef = sql028.substring(
      sql028.indexOf("CREATE OR REPLACE FUNCTION public.reclaim_stuck_meta_social_events"),
      sql028.indexOf("-- ------------------------------------------------------------------------------\n-- 5. FUNCTION AUTHORIZATION GRANTS")
    );
    await db.exec(reclaimDef);

    // Apply 028 privilege statements
    const workerPrivs = sql028.substring(
      sql028.indexOf("REVOKE ALL ON FUNCTION public.claim_meta_social_events"),
      sql028.indexOf("COMMENT ON FUNCTION public.claim_meta_social_events")
    );
    await db.exec(workerPrivs);

    const reclaimPrivs = sql028.substring(
      sql028.indexOf("REVOKE ALL ON FUNCTION public.reclaim_stuck_meta_social_events"),
      sql028.indexOf("COMMENT ON FUNCTION public.reclaim_stuck_meta_social_events")
    );
    await db.exec(reclaimPrivs);

    // Grant schema usage to test roles
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    `);
  });

  // ============================================================================
  // DOMAIN 1: Migration 027 SQL Contract & Privilege Verification
  // ============================================================================
  describe("Domain 1: Migration 027 (ingest_meta_social_event_atomic) Privilege Hardening", () => {
    it("1.1 Migration 027 explicitly REVOKEs execution from PUBLIC, anon, and authenticated", () => {
      expect(sql027).toContain(
        "REVOKE ALL ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;"
      );
      expect(sql027).toContain(
        "REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;"
      );
      expect(sql027).toContain(
        "REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM anon;"
      );
      expect(sql027).toContain(
        "REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;"
      );
    });

    it("1.2 Migration 027 explicitly GRANTs execution strictly to service_role", () => {
      expect(sql027).toContain(
        "GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;"
      );
      // Ensure authenticated is NOT granted execution
      expect(sql027).not.toContain(
        "GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated"
      );
    });

    it("1.3 Postgres blocks 'anon' from executing ingest_meta_social_event_atomic", async () => {
      await db.exec("SET ROLE anon;");
      let errorThrown = false;
      try {
        await db.query(`
          SELECT public.ingest_meta_social_event_atomic(
            'facebook', 'page_123', 'comment', 'evt_999', 'sender_1', 'Sender', 'p_1', 'c_1', NULL, 'Hello', NOW()
          );
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/permission denied for function ingest_meta_social_event_atomic/i);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(errorThrown).toBe(true);
    });

    it("1.4 Postgres blocks 'authenticated' from executing ingest_meta_social_event_atomic", async () => {
      await db.exec("SET ROLE authenticated;");
      let errorThrown = false;
      try {
        await db.query(`
          SELECT public.ingest_meta_social_event_atomic(
            'facebook', 'page_123', 'comment', 'evt_999', 'sender_1', 'Sender', 'p_1', 'c_1', NULL, 'Hello', NOW()
          );
        `);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/permission denied for function ingest_meta_social_event_atomic/i);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(errorThrown).toBe(true);
    });

    it("1.5 Postgres permits 'service_role' to execute ingest_meta_social_event_atomic", async () => {
      await db.exec("SET ROLE service_role;");
      let result: any = null;
      try {
        result = await db.query(`
          SELECT public.ingest_meta_social_event_atomic(
            'facebook', 'page_123', 'comment', 'evt_999', 'sender_1', 'Sender', 'p_1', 'c_1', NULL, 'Hello', NOW()
          );
        `);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
    });

    it("1.6 Migration 027 explicitly drops the legacy 10-parameter overload from Migration 026", () => {
      expect(sql027).toContain(
        "DROP FUNCTION IF EXISTS public.ingest_meta_social_event_atomic(\n    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT\n);"
      );
    });

    it("1.7 Postgres drops the 10-parameter overload, ensuring exactly 1 procedure exists in pg_proc", async () => {
      const procs = await db.query(`
        SELECT proname, pronargs
        FROM pg_proc
        WHERE proname = 'ingest_meta_social_event_atomic';
      `);
      expect(procs.rows.length).toBe(1);
      expect((procs.rows[0] as any).pronargs).toBe(11);
    });
  });

  // ============================================================================
  // DOMAIN 2: Migration 028 SQL Contract & Privilege Verification
  // ============================================================================
  describe("Domain 2: Migration 028 Worker RPCs Privilege Hardening", () => {
    it("2.1 Migration 028 explicitly REVOKEs execution on claim_meta_social_events from PUBLIC, anon, and authenticated", () => {
      expect(sql028).toContain(
        "REVOKE ALL ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM PUBLIC;"
      );
      expect(sql028).toContain(
        "REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM PUBLIC;"
      );
      expect(sql028).toContain(
        "REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM anon;"
      );
      expect(sql028).toContain(
        "REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM authenticated;"
      );
      expect(sql028).toContain(
        "GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO service_role;"
      );
      expect(sql028).not.toContain(
        "GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO authenticated"
      );
    });

    it("2.2 Migration 028 explicitly REVOKEs execution on reclaim_stuck_meta_social_events from PUBLIC, anon, and authenticated", () => {
      expect(sql028).toContain(
        "REVOKE ALL ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM PUBLIC;"
      );
      expect(sql028).toContain(
        "REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM PUBLIC;"
      );
      expect(sql028).toContain(
        "REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM anon;"
      );
      expect(sql028).toContain(
        "REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM authenticated;"
      );
      expect(sql028).toContain(
        "GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO service_role;"
      );
      expect(sql028).not.toContain(
        "GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO authenticated"
      );
    });

    it("2.3 Postgres blocks 'anon' from executing claim_meta_social_events", async () => {
      await db.exec("SET ROLE anon;");
      let errorThrown = false;
      try {
        await db.query(`SELECT * FROM public.claim_meta_social_events('worker-anon-1', 10, 300);`);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/permission denied for function claim_meta_social_events/i);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(errorThrown).toBe(true);
    });

    it("2.4 Postgres blocks 'authenticated' from executing claim_meta_social_events (Cross-Tenant Theft Prevention)", async () => {
      await db.exec("SET ROLE authenticated;");
      let errorThrown = false;
      try {
        await db.query(`SELECT * FROM public.claim_meta_social_events('malicious-client-worker', 10, 300);`);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/permission denied for function claim_meta_social_events/i);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(errorThrown).toBe(true);
    });

    it("2.5 Postgres blocks 'anon' and 'authenticated' from executing reclaim_stuck_meta_social_events", async () => {
      await db.exec("SET ROLE anon;");
      let anonBlocked = false;
      try {
        await db.query(`SELECT public.reclaim_stuck_meta_social_events(300);`);
      } catch (err: any) {
        anonBlocked = true;
        expect(err.message).toMatch(/permission denied for function reclaim_stuck_meta_social_events/i);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(anonBlocked).toBe(true);

      await db.exec("SET ROLE authenticated;");
      let authBlocked = false;
      try {
        await db.query(`SELECT public.reclaim_stuck_meta_social_events(300);`);
      } catch (err: any) {
        authBlocked = true;
        expect(err.message).toMatch(/permission denied for function reclaim_stuck_meta_social_events/i);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(authBlocked).toBe(true);
    });

    it("2.6 Postgres permits 'service_role' to execute worker queue functions", async () => {
      await db.exec("SET ROLE service_role;");
      let claimResult: any = null;
      let reclaimResult: any = null;
      try {
        claimResult = await db.query(`SELECT * FROM public.claim_meta_social_events('trusted-worker-1', 10, 300);`);
        reclaimResult = await db.query(`SELECT public.reclaim_stuck_meta_social_events(300);`);
      } finally {
        await db.exec("RESET ROLE;");
      }
      expect(claimResult).toBeDefined();
      expect(reclaimResult).toBeDefined();
    });
  });

  // ============================================================================
  // DOMAIN 3: Server & Worker Architecture Verification
  // ============================================================================
  describe("Domain 3: Worker & Webhook Admin Client Usage", () => {
    it("3.1 createAdminClient enforces SUPABASE_SERVICE_ROLE_KEY presence and configures client", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-test.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_key_for_verification";

      const adminClient = createAdminClient();
      expect(adminClient).toBeDefined();
      expect(typeof adminClient.rpc).toBe("function");
      expect(typeof adminClient.from).toBe("function");
    });

    it("3.2 Background worker code imports and instantiates createAdminClient", () => {
      const workerFilePath = path.resolve(process.cwd(), "src/lib/meta-social/worker.ts");
      const workerSource = fs.readFileSync(workerFilePath, "utf-8");

      expect(workerSource).toContain('import { createAdminClient } from "@/lib/supabase/admin";');
      expect(workerSource).toContain("supabase = createAdminClient();");
    });

    it("3.3 Webhook handler code imports and instantiates createAdminClient", () => {
      const webhookFilePath = path.resolve(process.cwd(), "src/app/api/webhooks/meta-social/route.ts");
      const webhookSource = fs.readFileSync(webhookFilePath, "utf-8");

      expect(webhookSource).toContain('import { createAdminClient } from "@/lib/supabase/admin";');
      expect(webhookSource).toContain("supabase = createAdminClient();");
    });
  });

  // ============================================================================
  // DOMAIN 4: WhatsApp Non-Interference & Blast Radius
  // ============================================================================
  describe("Domain 4: WhatsApp Isolation & Non-Interference", () => {
    it("4.1 Migrations 027 and 028 do not modify or reference WhatsApp tables", () => {
      const waTables = [
        "wa_connections",
        "wa_messages",
        "wa_contacts",
        "wa_conversations",
        "wa_processing_jobs",
        "wa_message_templates",
        "wa_campaigns",
        "wa_scheduled_messages",
      ];

      for (const table of waTables) {
        expect(sql027.toLowerCase()).not.toContain(`alter table ${table}`);
        expect(sql027.toLowerCase()).not.toContain(`alter table public.${table}`);
        expect(sql027.toLowerCase()).not.toContain(`drop table ${table}`);
        expect(sql027.toLowerCase()).not.toContain(`drop table public.${table}`);

        expect(sql028.toLowerCase()).not.toContain(`alter table ${table}`);
        expect(sql028.toLowerCase()).not.toContain(`alter table public.${table}`);
        expect(sql028.toLowerCase()).not.toContain(`drop table ${table}`);
        expect(sql028.toLowerCase()).not.toContain(`drop table public.${table}`);
      }
    });

    it("4.2 WhatsApp queue RPC privileges in Migration 011 remain strictly intact", () => {
      const migration011Path = path.join(MIGRATIONS_DIR, "20261107_011_phase7_5_queue_rpc_privilege_hardening.sql");
      const sql011 = fs.readFileSync(migration011Path, "utf-8");

      expect(sql011).toContain("GRANT EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) TO service_role;");
      expect(sql011).toContain("GRANT EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) TO service_role;");
      expect(sql011).toContain("REVOKE EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM authenticated;");
      expect(sql011).toContain("REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM authenticated;");
    });
  });

  // ============================================================================
  // DOMAIN 5: Dashboard User Access via RLS & Delivery Ledger Immutability
  // ============================================================================
  describe("Domain 5: Tenant Isolation via RLS & Audit Ledger Protection", () => {
    const BIZ_ASTRO = "11111111-1111-1111-1111-111111111111";
    const BIZ_VIVAHAM = "22222222-2222-2222-2222-222222222222";

    beforeAll(async () => {
      // Seed business tenants and deliveries
      await db.exec(`
        INSERT INTO public.businesses (id, slug) VALUES 
          ('${BIZ_ASTRO}', 'astrology'),
          ('${BIZ_VIVAHAM}', 'vivaham')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.meta_social_deliveries (
          business_id, action_type, recipient_id, status, error_message
        ) VALUES 
          ('${BIZ_ASTRO}', 'public_comment', 'user_astro_1', 'sent', NULL),
          ('${BIZ_VIVAHAM}', 'private_dm', 'user_viv_1', 'failed', 'Token expired');
      `);
    });

    it("5.1 Authenticated dashboard user can view deliveries for their permitted business", async () => {
      await db.exec("SET ROLE authenticated;");
      let rows: any[] = [];
      try {
        const res = await db.query(`SELECT * FROM public.meta_social_deliveries;`);
        rows = res.rows;
      } finally {
        await db.exec("RESET ROLE;");
      }

      // Astro user should only see Astro delivery
      expect(rows.length).toBe(1);
      expect(rows[0].business_id).toBe(BIZ_ASTRO);
      expect(rows[0].action_type).toBe("public_comment");
    });

    it("5.2 Authenticated user cannot view deliveries belonging to another business (Zero Cross-Tenant Leak)", async () => {
      await db.exec("SET ROLE authenticated;");
      let rows: any[] = [];
      try {
        const res = await db.query(`
          SELECT * FROM public.meta_social_deliveries WHERE business_id = '${BIZ_VIVAHAM}';
        `);
        rows = res.rows;
      } finally {
        await db.exec("RESET ROLE;");
      }

      // RLS filters out Vivaham deliveries for Astro user
      expect(rows.length).toBe(0);
    });

    it("5.3 Authenticated user cannot INSERT, UPDATE, or DELETE audit deliveries directly (Tamper-Proof)", async () => {
      await db.exec("SET ROLE authenticated;");
      let insertBlocked = false;
      let updateBlocked = false;
      let deleteBlocked = false;

      try {
        await db.query(`
          INSERT INTO public.meta_social_deliveries (
            business_id, action_type, recipient_id, status
          ) VALUES ('${BIZ_ASTRO}', 'private_dm', 'hacker', 'tampered');
        `);
      } catch (err: any) {
        insertBlocked = true;
      }

      try {
        await db.query(`
          UPDATE public.meta_social_deliveries SET status = 'tampered' WHERE business_id = '${BIZ_ASTRO}';
        `);
      } catch (err: any) {
        updateBlocked = true;
      }

      try {
        await db.query(`
          DELETE FROM public.meta_social_deliveries WHERE business_id = '${BIZ_ASTRO}';
        `);
      } catch (err: any) {
        deleteBlocked = true;
      } finally {
        await db.exec("RESET ROLE;");
      }

      expect(insertBlocked).toBe(true);
      expect(updateBlocked).toBe(true);
      expect(deleteBlocked).toBe(true);
    });

    it("5.4 service_role has full CRUD access across all tenants for background worker execution", async () => {
      await db.exec("SET ROLE service_role;");
      let allRows: any[] = [];
      try {
        const res = await db.query(`SELECT * FROM public.meta_social_deliveries;`);
        allRows = res.rows;
      } finally {
        await db.exec("RESET ROLE;");
      }

      expect(allRows.length).toBe(2);
      const bizIds = allRows.map((r: any) => r.business_id);
      expect(bizIds).toContain(BIZ_ASTRO);
      expect(bizIds).toContain(BIZ_VIVAHAM);
    });
  });
});
