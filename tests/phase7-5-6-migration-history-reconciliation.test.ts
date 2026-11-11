import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll } from "vitest";

describe("Phase 7.5.6 — Forward-Only Migration 012 & Migration History Reconciliation Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
  const ASTRO_PHONE_ID = "109283746501928";

  // ============================================================================
  // DOMAIN 1: MIGRATION 012 STATIC PARITY & SECURITY DEFINER INTEGRITY
  // ============================================================================
  describe("Domain 1: Migration 012 Static Parity & Security Definer Integrity", () => {
    const mig012Path = path.join(MIGRATIONS_DIR, "20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql");
    const mig010Path = path.join(MIGRATIONS_DIR, "20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql");
    const mig011Path = path.join(MIGRATIONS_DIR, "20261107_011_phase7_5_queue_rpc_privilege_hardening.sql");

    it("Test 1.1: Migration 012 file exists and follows project naming convention", () => {
      expect(fs.existsSync(mig012Path)).toBe(true);
    });

    it("Test 1.2: Migration 012 preserves exact partial unique-index conflict predicate", () => {
      const sql = fs.readFileSync(mig012Path, "utf-8");
      expect(sql).toContain("ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING");
    });

    it("Test 1.3: Migration 012 preserves SECURITY DEFINER and safe search_path", () => {
      const sql = fs.readFileSync(mig012Path, "utf-8");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toContain("SET search_path = public, pg_temp");
    });

    it("Test 1.4: Migration 012 strictly revokes execution from PUBLIC, anon, and authenticated", () => {
      const sql = fs.readFileSync(mig012Path, "utf-8");
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2");
      expect(sql).toContain("FROM PUBLIC;");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2");
      expect(sql).toContain("FROM anon;");
      expect(sql).toContain("FROM authenticated;");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2");
      expect(sql).toContain("TO service_role;");
    });

    it("Test 1.5: Migrations 010 and 011 exist and remain intact", () => {
      expect(fs.existsSync(mig010Path)).toBe(true);
      expect(fs.existsSync(mig011Path)).toBe(true);

      const sql010 = fs.readFileSync(mig010Path, "utf-8");
      expect(sql010).toContain("CREATE OR REPLACE FUNCTION public.ingest_wa_inbound_message_v2");
      expect(sql010).toContain("GRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2");

      const sql011 = fs.readFileSync(mig011Path, "utf-8");
      expect(sql011).toContain("REVOKE ALL ON FUNCTION public.claim_next_wa_jobs");
      expect(sql011).toContain("GRANT EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) TO service_role;");
    });
  });

  // ============================================================================
  // DOMAIN 2: FULL DATABASE REPLAY & SCHEMA REPRODUCIBILITY (001–012 on PGlite)
  // ============================================================================
  describe("Domain 2: Full Database Replay & Schema Reproducibility (001–012)", () => {
    let db: PGlite;

    beforeAll(async () => {
      db = new PGlite();

      // Setup standard Supabase roles & auth schema mock
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
          SELECT '00000000-0000-0000-0000-000000000000'::UUID;
        $$;
      `);

      // Apply migrations 001 through 012 in sequential order
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith(".sql"))
        .sort();

      for (const file of migrationFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- native');
        await db.exec(sql);
      }
    });

    it("Test 2.1: Replayed database contains all core schema tables", async () => {
      const res = await db.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `);
      const tableNames = res.rows.map((r: any) => r.tablename);

      const requiredTables = [
        "businesses",
        "business_members",
        "business_settings",
        "user_profiles",
        "wa_connections",
        "wa_credentials",
        "wa_contacts",
        "wa_conversations",
        "wa_messages",
        "wa_message_templates",
        "wa_webhook_events",
        "wa_processing_jobs",
        "wa_automation_rules",
        "wa_rule_conditions",
        "wa_rule_actions",
        "wa_automation_execution_logs",
      ];

      for (const table of requiredTables) {
        expect(tableNames).toContain(table);
      }
    });

    it("Test 2.2: Replayed database contains partial unique index on wa_processing_jobs", async () => {
      const res = await db.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'wa_processing_jobs' 
          AND indexname = 'uq_wa_processing_jobs_idempotency';
      `);
      expect(res.rows.length).toBe(1);
      const indexDef = (res.rows[0] as any).indexdef;
      expect(indexDef).toContain("UNIQUE INDEX");
      expect(indexDef).toContain("idempotency_key");
      expect(indexDef).toContain("WHERE (idempotency_key IS NOT NULL)");
    });

    it("Test 2.3: Replayed database contains target functions with SECURITY DEFINER and search_path", async () => {
      const res = await db.query(`
        SELECT proname, prosecdef, proconfig 
        FROM pg_proc 
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE pg_namespace.nspname = 'public'
          AND proname IN ('ingest_wa_inbound_message_v2', 'claim_next_wa_jobs', 'reclaim_stuck_wa_jobs', 'prune_stale_automation_records');
      `);
      expect(res.rows.length).toBe(4);
      for (const row of res.rows as any[]) {
        expect(row.prosecdef).toBe(true);
        expect(row.proconfig).toEqual(["search_path=public, pg_temp"]);
      }
    });

    it("Test 2.4: Target functions enforce restricted role execution grants (service_role)", async () => {
      const res = await db.query(`
        SELECT proname, proacl 
        FROM pg_proc 
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE pg_namespace.nspname = 'public'
          AND proname IN ('ingest_wa_inbound_message_v2', 'claim_next_wa_jobs', 'reclaim_stuck_wa_jobs');
      `);
      for (const row of res.rows as any[]) {
        const aclStr = JSON.stringify(row.proacl);
        expect(aclStr).toContain("service_role");
        expect(aclStr).not.toContain("anon=");
        expect(aclStr).not.toContain("authenticated=");
      }
    });
  });

  // ============================================================================
  // DOMAIN 3: CLEAN REPLAY FUNCTIONAL EXECUTION & WEBHOOK ATOMICITY
  // ============================================================================
  describe("Domain 3: Clean Replay Functional Execution & Webhook Atomicity", () => {
    let db: PGlite;

    beforeAll(async () => {
      db = new PGlite();

      // Setup standard Supabase roles & auth schema mock
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
          SELECT '00000000-0000-0000-0000-000000000000'::UUID;
        $$;
      `);

      // Apply migrations 001 through 012 in sequential order
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith(".sql"))
        .sort();

      for (const file of migrationFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- native');
        await db.exec(sql);
      }

      // Seed a business and wa_connection for testing
      await db.exec(`
        INSERT INTO public.businesses (id, name, slug)
        VALUES ('${ASTRO_BIZ_ID}', 'Astro Business', 'astro-biz')
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref, is_enabled)
        VALUES ('${ASTRO_CONN_ID}', '${ASTRO_BIZ_ID}', 'Astro Connect', '+919999999999', '${ASTRO_PHONE_ID}', 'waba-123456', 'cred-123', TRUE)
        ON CONFLICT DO NOTHING;
      `);
    });

    it("Test 3.1: ingest_wa_inbound_message_v2 successfully ingests message and enqueues job", async () => {
      const metaMsgId = "wamid.clean_replay_test_001";
      const senderPhone = "+919876543210";
      const senderName = "Clean Replay Tester";
      const content = "Hello from clean replay test";

      const rpcRes = await db.query(`
        SELECT public.ingest_wa_inbound_message_v2(
          $1, $2, $3, $4, $5, $6, $7
        ) as result;
      `, [ASTRO_PHONE_ID, metaMsgId, senderPhone, senderName, "text", content, JSON.stringify({ raw: true })]);

      expect(rpcRes.rows.length).toBe(1);
      const result = (rpcRes.rows[0] as any).result;
      expect(result.status).toBe("success");
      expect(result.business_id).toBe(ASTRO_BIZ_ID);
      expect(result.connection_id).toBe(ASTRO_CONN_ID);
      expect(result.job_id).toBeDefined();

      // Verify wa_processing_jobs row has matching idempotency_key
      const jobRes = await db.query(`
        SELECT id, idempotency_key, status, job_type 
        FROM public.wa_processing_jobs 
        WHERE id = $1;
      `, [result.job_id]);
      expect(jobRes.rows.length).toBe(1);
      const job = jobRes.rows[0] as any;
      expect(job.idempotency_key).toBe(`inbound_eval_${metaMsgId}`);
      expect(job.status).toBe("pending");
      expect(job.job_type).toBe("evaluate_automation_rules");
    });

    it("Test 3.2: Duplicate delivery of same meta_message_id returns duplicate status without error", async () => {
      const metaMsgId = "wamid.clean_replay_test_001";
      const senderPhone = "+919876543210";

      const rpcRes = await db.query(`
        SELECT public.ingest_wa_inbound_message_v2(
          $1, $2, $3, $4, $5, $6, $7
        ) as result;
      `, [ASTRO_PHONE_ID, metaMsgId, senderPhone, "Tester", "text", "duplicate test", "{}"]);

      const result = (rpcRes.rows[0] as any).result;
      expect(result.status).toBe("duplicate");
      expect(result.meta_message_id).toBe(metaMsgId);
    });

    it("Test 3.3: claim_next_wa_jobs claims pending job using FOR UPDATE SKIP LOCKED", async () => {
      const claimRes = await db.query(`
        SELECT * FROM public.claim_next_wa_jobs(10, 'worker_test_clean_replay');
      `);
      expect(claimRes.rows.length).toBeGreaterThanOrEqual(1);
      const claimedJob = claimRes.rows[0] as any;
      expect(claimedJob.status).toBe("processing");
      expect(claimedJob.locked_by).toBe("worker_test_clean_replay");
    });
  });

  // ============================================================================
  // DOMAIN 4: FEATURE FLAG RUNTIME POSTURE
  // ============================================================================
  describe("Domain 4: Feature Flag Runtime Posture", () => {
    it("Test 4.1: USE_ATOMIC_WEBHOOK_V2 defaults to undefined / false in normal execution", () => {
      expect(process.env.USE_ATOMIC_WEBHOOK_V2).not.toBe("true");
    });
  });
});
