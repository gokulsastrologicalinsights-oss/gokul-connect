import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  acquireDistributedLock,
  renewDistributedLock,
  releaseDistributedLock,
  resolveLockKey,
  runCoordinatedCron,
  resetCronLocks,
} from "@/lib/cron/coordinator";
import { getInboxUnreadCountAction } from "@/app/actions/inbox";
import { updateConversationLabelsDb } from "@/lib/inbox/database";
import { NextRequest } from "next/server";

describe("Phase P3.2 — Production Blocker Remediation Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

  let db: PGlite;
  let mockSupabase: any;

  function createMockSupabase(pgliteDb: PGlite) {
    return {
      rpc: async (funcName: string, params: Record<string, any>) => {
        try {
          let res: any;
          if (funcName === "acquire_cron_lock") {
            res = await pgliteDb.query(
              `SELECT public.acquire_cron_lock($1, $2, $3, $4, $5, $6) as result`,
              [
                params.p_lock_key,
                params.p_cron_name,
                params.p_owner_id,
                params.p_ttl_seconds,
                params.p_business_id,
                JSON.stringify(params.p_metadata || {}),
              ]
            );
          } else if (funcName === "renew_cron_lock") {
            res = await pgliteDb.query(
              `SELECT public.renew_cron_lock($1, $2, $3) as result`,
              [params.p_lock_key, params.p_owner_id, params.p_ttl_seconds]
            );
          } else if (funcName === "release_cron_lock") {
            res = await pgliteDb.query(
              `SELECT public.release_cron_lock($1, $2) as result`,
              [params.p_lock_key, params.p_owner_id]
            );
          } else if (funcName === "get_cron_lock_status") {
            res = await pgliteDb.query(
              `SELECT public.get_cron_lock_status($1) as result`,
              [params.p_lock_key]
            );
          }
          return { data: res?.rows?.[0]?.result, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      from: (table: string) => ({
        insert: async (data: any) => ({ data, error: null }),
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    };
  }

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup Postgres roles and auth schema for Supabase compatibility
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT '${TEST_USER_ID}'::UUID;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT jsonb_build_object('sub', '${TEST_USER_ID}', 'role', 'service_role');
      $$;
    `);

    // 2. Apply all 24 migrations in exact sequential order
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    expect(migrationFiles.length).toBeGreaterThanOrEqual(24);

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', "-- native");
      await db.exec(sql);
    }

    mockSupabase = createMockSupabase(db);
  });

  beforeEach(async () => {
    resetCronLocks();
    // Clean up cron_locks table between tests
    await db.exec(`DELETE FROM public.cron_locks;`);
  });

  // ============================================================================
  // DOMAIN 1: DISTRIBUTED POSTGRESQL CRON LOCKING & CONCURRENCY
  // ============================================================================
  describe("Domain 1: PostgreSQL Distributed Cron Locking", () => {
    it("1.1 Atomically acquires a lock in public.cron_locks table", async () => {
      const lockKey = "process-automation-jobs";
      const ownerId = "worker_lambda_01";

      const res = await acquireDistributedLock({
        lockKey,
        cronName: "process-automation-jobs",
        ownerId,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      expect(res.acquired).toBe(true);
      expect(res.ownerId).toBe(ownerId);
      expect(res.lockKey).toBe(lockKey);

      // Verify row in database
      const dbRows = await db.query<any>(
        `SELECT lock_key, cron_name, owner_id, expires_at FROM public.cron_locks WHERE lock_key = $1;`,
        [lockKey]
      );
      expect(dbRows.rows.length).toBe(1);
      expect(dbRows.rows[0].owner_id).toBe(ownerId);
    });

    it("1.2 Prevents concurrent acquisition by separate application instances", async () => {
      const lockKey = "process-scheduled-messages";
      const instance1 = "lambda_instance_A";
      const instance2 = "lambda_instance_B";

      // Instance 1 acquires
      const res1 = await acquireDistributedLock({
        lockKey,
        cronName: "process-scheduled-messages",
        ownerId: instance1,
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(res1.acquired).toBe(true);

      // Instance 2 attempts concurrent acquisition on the same lock
      const res2 = await acquireDistributedLock({
        lockKey,
        cronName: "process-scheduled-messages",
        ownerId: instance2,
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(res2.acquired).toBe(false);
      expect(res2.currentOwner).toBe(instance1);
    });

    it("1.3 Safe lease renewal extends expiry and tracks renewal count", async () => {
      const lockKey = "process-campaigns";
      const ownerId = "campaign_worker_run_1";

      await acquireDistributedLock({
        lockKey,
        cronName: "process-campaigns",
        ownerId,
        ttlSeconds: 30,
        client: mockSupabase,
      });

      // Renew by valid owner
      const renewRes = await renewDistributedLock({
        lockKey,
        ownerId,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      expect(renewRes.renewed).toBe(true);
      expect(renewRes.renewalCount).toBe(1);

      // Attempt renewal by imposter instance should be rejected
      const imposterRenew = await renewDistributedLock({
        lockKey,
        ownerId: "imposter_worker",
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(imposterRenew.renewed).toBe(false);
    });

    it("1.4 Owner-verified release allows subsequent acquisition while blocking unauthorized release", async () => {
      const lockKey = "process-crm-reminders";
      const ownerId = "worker_original";
      const otherWorker = "worker_other";

      await acquireDistributedLock({
        lockKey,
        cronName: "process-crm-reminders",
        ownerId,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      // Other worker cannot release original owner's lock
      const failedRelease = await releaseDistributedLock({
        lockKey,
        ownerId: otherWorker,
        client: mockSupabase,
      });
      expect(failedRelease.released).toBe(false);

      // Lock is still held
      const statusRes = await db.query<any>(
        `SELECT public.get_cron_lock_status($1) as s;`,
        [lockKey]
      );
      expect(statusRes.rows[0].s.is_locked).toBe(true);

      // Original owner releases
      const okRelease = await releaseDistributedLock({
        lockKey,
        ownerId,
        client: mockSupabase,
      });
      expect(okRelease.released).toBe(true);

      // Now other worker can acquire
      const acquireAgain = await acquireDistributedLock({
        lockKey,
        cronName: "process-crm-reminders",
        ownerId: otherWorker,
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(acquireAgain.acquired).toBe(true);
      expect(acquireAgain.ownerId).toBe(otherWorker);
    });

    it("1.5 Automatically recovers expired locks after worker crashes without deadlock", async () => {
      const lockKey = "crashed-worker-test";
      const deadWorker = "crashed_worker_01";
      const recoveryWorker = "recovery_worker_02";

      // Insert an already-expired lock (simulating a crashed worker whose lease timed out in the past)
      await db.exec(`
        INSERT INTO public.cron_locks (
          lock_key, cron_name, owner_id, acquired_at, expires_at, created_at, updated_at
        ) VALUES (
          '${lockKey}', 'test-crash', '${deadWorker}',
          TIMEZONE('utc', NOW()) - INTERVAL '2 minutes',
          TIMEZONE('utc', NOW()) - INTERVAL '1 minute',
          TIMEZONE('utc', NOW()) - INTERVAL '2 minutes',
          TIMEZONE('utc', NOW()) - INTERVAL '2 minutes'
        );
      `);

      // Recovery worker calls acquireDistributedLock
      const res = await acquireDistributedLock({
        lockKey,
        cronName: "test-crash",
        ownerId: recoveryWorker,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      expect(res.acquired).toBe(true);
      expect(res.ownerId).toBe(recoveryWorker);

      // Verify the lock was reclaimed by the new worker
      const check = await db.query<any>(
        `SELECT owner_id, expires_at > TIMEZONE('utc', NOW()) as is_valid FROM public.cron_locks WHERE lock_key = $1;`,
        [lockKey]
      );
      expect(check.rows[0].owner_id).toBe(recoveryWorker);
      expect(check.rows[0].is_valid).toBe(true);
    });

    it("1.6 Enforces tenant isolation: tenant-specific jobs do not block other businesses", async () => {
      const cronName = "process-campaigns";
      const lockKeyAstro = resolveLockKey(cronName, ASTRO_BIZ_ID);
      const lockKeyVivaham = resolveLockKey(cronName, VIVAHAM_BIZ_ID);

      expect(lockKeyAstro).toBe(`${cronName}:${ASTRO_BIZ_ID}`);
      expect(lockKeyVivaham).toBe(`${cronName}:${VIVAHAM_BIZ_ID}`);

      // Astrology worker acquires
      const resAstro = await acquireDistributedLock({
        lockKey: lockKeyAstro,
        cronName,
        ownerId: "astro_campaign_worker",
        ttlSeconds: 60,
        businessId: ASTRO_BIZ_ID,
        client: mockSupabase,
      });
      expect(resAstro.acquired).toBe(true);

      // Vivaham worker acquires simultaneously — must NOT be blocked!
      const resVivaham = await acquireDistributedLock({
        lockKey: lockKeyVivaham,
        cronName,
        ownerId: "vivaham_campaign_worker",
        ttlSeconds: 60,
        businessId: VIVAHAM_BIZ_ID,
        client: mockSupabase,
      });
      expect(resVivaham.acquired).toBe(true);

      // Verify both locks coexist independently in PostgreSQL
      const rows = await db.query<any>(`SELECT lock_key, business_id FROM public.cron_locks ORDER BY lock_key;`);
      expect(rows.rows.length).toBe(2);
      expect(rows.rows.map((r: any) => r.lock_key)).toEqual([lockKeyAstro, lockKeyVivaham]);
    });
  });

  // ============================================================================
  // DOMAIN 2: PERSISTENT CONVERSATION LABELS
  // ============================================================================
  describe("Domain 2: Persistent Conversation Labels", () => {
    it("2.1 Verifies labels column exists on public.wa_conversations with default '{}'", async () => {
      const colCheck = await db.query<any>(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'wa_conversations'
          AND column_name = 'labels';
      `);

      expect(colCheck.rows.length).toBe(1);
      expect(colCheck.rows[0].data_type).toBe("ARRAY");
      expect(colCheck.rows[0].column_default).toContain("'{}'::text[]");
    });

    it("2.2 Verifies GIN index idx_wa_conversations_labels exists", async () => {
      const idxCheck = await db.query<any>(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'wa_conversations'
          AND indexname = 'idx_wa_conversations_labels';
      `);

      expect(idxCheck.rows.length).toBe(1);
      expect(idxCheck.rows[0].indexdef).toContain("gin (labels)");
    });

    it("2.3 Preserves existing conversation records and allows label updating and filtering", async () => {
      const convId = "77777777-7777-7777-7777-777777777777";
      const connId = "33333333-3333-3333-3333-333333333333";
      const contactId = "55555555-5555-5555-5555-555555555555";

      // Insert connection and contact first
      await db.exec(`
        INSERT INTO public.wa_connections (
          id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref, connection_status
        ) VALUES (
          '${connId}', '${ASTRO_BIZ_ID}', 'Astrology Line', '+919876543210', 'phone_num_id_1', 'waba_id_1', 'cred_ref_1', 'connected'
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name)
        VALUES ('${contactId}', '${ASTRO_BIZ_ID}', '+919999988888', 'Valued Client')
        ON CONFLICT (id) DO NOTHING;
      `);

      // Insert conversation without specifying labels — defaults to '{}'
      await db.exec(`
        INSERT INTO public.wa_conversations (
          id, business_id, connection_id, contact_id, status
        ) VALUES (
          '${convId}', '${ASTRO_BIZ_ID}', '${connId}', '${contactId}', 'open'
        );
      `);

      const initial = await db.query<any>(`SELECT labels FROM public.wa_conversations WHERE id = $1;`, [convId]);
      expect(initial.rows[0].labels).toEqual([]);

      // Update labels with array values
      await db.query(
        `UPDATE public.wa_conversations SET labels = $1 WHERE id = $2;`,
        [["VIP", "Horoscope Matching"], convId]
      );

      const updated = await db.query<any>(`SELECT labels FROM public.wa_conversations WHERE id = $1;`, [convId]);
      expect(updated.rows[0].labels).toEqual(["VIP", "Horoscope Matching"]);

      // Test GIN index array containment filter
      const searchVIP = await db.query<any>(
        `SELECT id FROM public.wa_conversations WHERE labels @> ARRAY['VIP'::text];`
      );
      expect(searchVIP.rows.length).toBe(1);
      expect(searchVIP.rows[0].id).toBe(convId);
    });

    it("2.4 Tests updateConversationLabelsDb with database client", async () => {
      const convId = "77777777-7777-7777-7777-777777777777";
      const customClient = {
        from: (table: string) => ({
          update: (payload: any) => ({
            eq: (col1: string, val1: any) => ({
              eq: async (col2: string, val2: any) => {
                await db.query(
                  `UPDATE public.wa_conversations SET labels = $1 WHERE id = $2 AND business_id = $3;`,
                  [payload.labels, val1, val2]
                );
                return { error: null };
              },
            }),
          }),
        }),
      };

      const result = await updateConversationLabelsDb(
        ASTRO_BIZ_ID,
        convId,
        ["Premium Client", "Vedic Report Ready", "  Premium Client  "],
        customClient
      );

      expect(result).toEqual(["Premium Client", "Vedic Report Ready"]);

      const check = await db.query<any>(`SELECT labels FROM public.wa_conversations WHERE id = $1;`, [convId]);
      expect(check.rows[0].labels).toEqual(["Premium Client", "Vedic Report Ready"]);
    });
  });

  // ============================================================================
  // DOMAIN 3: TENANT ISOLATION & REMOVAL OF HARDCODED FALLBACK
  // ============================================================================
  describe("Domain 3: Authentication & Dynamic Tenant Resolution", () => {
    it("3.1 Rejects unauthenticated inbox unread count request without falling back to hardcoded IDs", async () => {
      // Calling getInboxUnreadCountAction for non-existent or unauthenticated slug
      const res = await getInboxUnreadCountAction("unauthorized-foreign-tenant");
      expect(res.success).toBe(false);
      expect(res.unread).toBe(0);
      expect(res.error).toBeDefined();
    });

    it("3.2 Validates that coordinated cron enforces CRON_SECRET fail-closed", async () => {
      const mockReq = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        headers: { authorization: "Bearer invalid_secret_token" },
      });

      const res = await runCoordinatedCron({
        cronName: "process-automation-jobs",
        workerType: "automation_worker",
        request: mockReq,
        handler: async () => ({ claimedCount: 1 }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });
  });
});
