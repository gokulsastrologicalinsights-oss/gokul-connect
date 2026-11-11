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
import {
  getInboxUnreadCountAction,
  updateConversationLabelsAction,
} from "@/app/actions/inbox";
import { updateConversationLabelsDb } from "@/lib/inbox/database";
import { NextRequest } from "next/server";

describe("Phase P3.3 — Independent Blocker Verification & Final P4 Audit Suite", () => {
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
            res = await pgliteDb.query<any>(
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
            res = await pgliteDb.query<any>(
              `SELECT public.renew_cron_lock($1, $2, $3) as result`,
              [params.p_lock_key, params.p_owner_id, params.p_ttl_seconds]
            );
          } else if (funcName === "release_cron_lock") {
            res = await pgliteDb.query<any>(
              `SELECT public.release_cron_lock($1, $2) as result`,
              [params.p_lock_key, params.p_owner_id]
            );
          } else if (funcName === "get_cron_lock_status") {
            res = await pgliteDb.query<any>(
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

  // ============================================================================
  // DOMAIN 1: MIGRATION STAGING & DATA PRESERVATION AUDIT (001-015 -> 016-024)
  // ============================================================================
  describe("Domain 1: Sequential Migration Application onto Populated 001-015 Baseline", () => {
    let stagedDb: PGlite;
    const testConvId = "aaaaaaaa-1111-2222-3333-444444444444";
    const testConnId = "bbbbbbbb-1111-2222-3333-444444444444";
    const testContactId = "cccccccc-1111-2222-3333-444444444444";

    it("1.1 Successfully applies baseline 001-015 and seeds active business records", async () => {
      stagedDb = new PGlite();

      // Setup auth roles & schema
      await stagedDb.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
        END
        $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT '${TEST_USER_ID}'::UUID; $$;
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sub', '${TEST_USER_ID}', 'role', 'service_role'); $$;
      `);

      // Apply migrations 001 through 015 only (exact live Supabase state)
      const allFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
      const baseline015Files = allFiles.slice(0, 15);
      expect(baseline015Files.length).toBe(15);
      expect(baseline015Files[14]).toContain("015_phase11_template_management");

      for (const file of baseline015Files) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', "-- native");
        await stagedDb.exec(sql);
      }

      // Seed active baseline data before applying migrations 016-024
      await stagedDb.exec(`
        INSERT INTO public.wa_connections (
          id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref, connection_status
        ) VALUES (
          '${testConnId}', '${ASTRO_BIZ_ID}', 'Primary Line', '+919876543210', 'phone_101', 'waba_101', 'vault_ref_1', 'connected'
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.wa_contacts (
          id, business_id, phone_number, display_name
        ) VALUES (
          '${testContactId}', '${ASTRO_BIZ_ID}', '+919988776655', 'Existing Customer'
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.wa_conversations (
          id, business_id, connection_id, contact_id, status, last_message_preview, unread_count
        ) VALUES (
          '${testConvId}', '${ASTRO_BIZ_ID}', '${testConnId}', '${testContactId}', 'open', 'Hello astrologer', 1
        );
      `);

      const seeded = await stagedDb.query<any>(`SELECT id, status, unread_count FROM public.wa_conversations WHERE id = $1;`, [testConvId]);
      expect(seeded.rows.length).toBe(1);
      expect(seeded.rows[0].unread_count).toBe(1);
    });

    it("1.2 Sequentially applies migrations 016 through 024 onto the populated baseline without errors", async () => {
      const allFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
      const pendingFiles = allFiles.slice(15); // 016 through 024
      expect(pendingFiles.length).toBeGreaterThanOrEqual(9);

      for (const file of pendingFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', "-- native");
        // Each migration must execute cleanly without throwing
        await expect(stagedDb.exec(sql)).resolves.not.toThrow();
      }
    });

    it("1.3 Confirms existing pre-migration records are 100% preserved and labels default to '{}'", async () => {
      const conv = await stagedDb.query<any>(
        `SELECT id, business_id, status, unread_count, labels FROM public.wa_conversations WHERE id = $1;`,
        [testConvId]
      );
      expect(conv.rows.length).toBe(1);
      expect(conv.rows[0].id).toBe(testConvId);
      expect(conv.rows[0].business_id).toBe(ASTRO_BIZ_ID);
      expect(conv.rows[0].status).toBe("open");
      expect(conv.rows[0].unread_count).toBe(1);
      // New column labels is present and defaulted to empty array
      expect(conv.rows[0].labels).toEqual([]);
    });
  });

  // ============================================================================
  // DOMAIN 2: DISTRIBUTED CRON LOCK VERIFICATION
  // ============================================================================
  describe("Domain 2: Distributed Cron Locking Real PostgreSQL RPC Audit", () => {
    beforeAll(async () => {
      db = new PGlite();

      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
        END
        $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT '${TEST_USER_ID}'::UUID; $$;
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sub', '${TEST_USER_ID}', 'role', 'service_role'); $$;
      `);

      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
      for (const file of migrationFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', "-- native");
        await db.exec(sql);
      }

      mockSupabase = createMockSupabase(db);
    });

    beforeEach(async () => {
      resetCronLocks();
      await db.exec(`DELETE FROM public.cron_locks;`);
    });

    it("2.1 Atomic mutual exclusion: Caller 1 wins; Caller 2 concurrently requesting same key is rejected", async () => {
      const lockKey = "process-automation-jobs";
      const caller1 = "worker_node_1";
      const caller2 = "worker_node_2";

      const res1 = await acquireDistributedLock({
        lockKey,
        cronName: "process-automation-jobs",
        ownerId: caller1,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      const res2 = await acquireDistributedLock({
        lockKey,
        cronName: "process-automation-jobs",
        ownerId: caller2,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      expect(res1.acquired).toBe(true);
      expect(res2.acquired).toBe(false);
      expect(res2.currentOwner).toBe(caller1);
    });

    it("2.2 Independent tenant keys never collide or block other businesses", async () => {
      const cronName = "process-campaigns";
      const keyAstro = resolveLockKey(cronName, ASTRO_BIZ_ID);
      const keyVivaham = resolveLockKey(cronName, VIVAHAM_BIZ_ID);

      const [resAstro, resVivaham] = await Promise.all([
        acquireDistributedLock({
          lockKey: keyAstro,
          cronName,
          ownerId: "astro_run_1",
          ttlSeconds: 60,
          businessId: ASTRO_BIZ_ID,
          client: mockSupabase,
        }),
        acquireDistributedLock({
          lockKey: keyVivaham,
          cronName,
          ownerId: "vivaham_run_1",
          ttlSeconds: 60,
          businessId: VIVAHAM_BIZ_ID,
          client: mockSupabase,
        }),
      ]);

      expect(resAstro.acquired).toBe(true);
      expect(resVivaham.acquired).toBe(true);

      const dbRows = await db.query<any>(`SELECT lock_key FROM public.cron_locks ORDER BY lock_key;`);
      expect(dbRows.rows.length).toBe(2);
    });

    it("2.3 Safe renewal extends lease and rejects imposter worker", async () => {
      const lockKey = "process-crm-reminders";
      const owner = "authorized_worker_01";

      await acquireDistributedLock({
        lockKey,
        cronName: "process-crm-reminders",
        ownerId: owner,
        ttlSeconds: 30,
        client: mockSupabase,
      });

      const renewal = await renewDistributedLock({
        lockKey,
        ownerId: owner,
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(renewal.renewed).toBe(true);
      expect(renewal.renewalCount).toBe(1);

      const imposterRenewal = await renewDistributedLock({
        lockKey,
        ownerId: "hacker_worker",
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(imposterRenewal.renewed).toBe(false);
    });

    it("2.4 Owner-verified release prevents zombie instances from deleting another worker's new lock", async () => {
      const lockKey = "process-scheduled-messages";
      const originalOwner = "worker_original";
      const newOwner = "worker_new";

      await acquireDistributedLock({
        lockKey,
        cronName: "process-scheduled-messages",
        ownerId: originalOwner,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      // Imposter / zombie worker attempts release -> must fail
      const badRelease = await releaseDistributedLock({
        lockKey,
        ownerId: newOwner,
        client: mockSupabase,
      });
      expect(badRelease.released).toBe(false);

      // Lock is still held by original owner
      const status = await db.query<any>(`SELECT public.get_cron_lock_status($1) as s;`, [lockKey]);
      expect(status.rows[0].s.is_locked).toBe(true);
      expect(status.rows[0].s.owner_id).toBe(originalOwner);

      // Original owner releases cleanly
      const goodRelease = await releaseDistributedLock({
        lockKey,
        ownerId: originalOwner,
        client: mockSupabase,
      });
      expect(goodRelease.released).toBe(true);

      // Now new worker can acquire
      const newAcquisition = await acquireDistributedLock({
        lockKey,
        cronName: "process-scheduled-messages",
        ownerId: newOwner,
        ttlSeconds: 60,
        client: mockSupabase,
      });
      expect(newAcquisition.acquired).toBe(true);
      expect(newAcquisition.ownerId).toBe(newOwner);
    });

    it("2.5 Automatic crash recovery claims expired locks without manual intervention", async () => {
      const lockKey = "stuck-crash-test";
      const deadWorker = "crashed_worker_dead";
      const freshWorker = "fresh_worker_alive";

      // Insert an expired lock directly (simulating a dead container)
      await db.exec(`
        INSERT INTO public.cron_locks (
          lock_key, cron_name, owner_id, acquired_at, expires_at, created_at, updated_at
        ) VALUES (
          '${lockKey}', 'test', '${deadWorker}',
          TIMEZONE('utc', NOW()) - INTERVAL '5 minutes',
          TIMEZONE('utc', NOW()) - INTERVAL '3 minutes',
          TIMEZONE('utc', NOW()) - INTERVAL '5 minutes',
          TIMEZONE('utc', NOW()) - INTERVAL '5 minutes'
        );
      `);

      // Fresh worker calls acquireDistributedLock -> automatically overwrites expired row
      const claim = await acquireDistributedLock({
        lockKey,
        cronName: "test",
        ownerId: freshWorker,
        ttlSeconds: 60,
        client: mockSupabase,
      });

      expect(claim.acquired).toBe(true);
      expect(claim.ownerId).toBe(freshWorker);

      const check = await db.query<any>(`SELECT owner_id FROM public.cron_locks WHERE lock_key = $1;`, [lockKey]);
      expect(check.rows[0].owner_id).toBe(freshWorker);
    });
  });

  // ============================================================================
  // DOMAIN 3: CONVERSATION LABELS LIFECYCLE & ROLE AUTHORIZATION
  // ============================================================================
  describe("Domain 3: Conversation Labels Lifecycle & Authorization", () => {
    const testConvId = "55555555-4444-3333-2222-111111111111";
    const testConnId = "66666666-4444-3333-2222-111111111111";
    const testContactId = "77777777-4444-3333-2222-111111111111";

    beforeEach(async () => {
      await db.exec(`
        INSERT INTO public.wa_connections (
          id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref, connection_status
        ) VALUES (
          '${testConnId}', '${ASTRO_BIZ_ID}', 'Line A', '+919876543210', 'pn_301', 'waba_301', 'cred_301', 'connected'
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.wa_contacts (
          id, business_id, phone_number, display_name
        ) VALUES (
          '${testContactId}', '${ASTRO_BIZ_ID}', '+919988776611', 'Sample Contact'
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.wa_conversations (
          id, business_id, connection_id, contact_id, status
        ) VALUES (
          '${testConvId}', '${ASTRO_BIZ_ID}', '${testConnId}', '${testContactId}', 'open'
        ) ON CONFLICT (id) DO NOTHING;
      `);
    });

    it("3.1 Supports multiple labels, trimming, deduplication, and removal on conversation", async () => {
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

      // 1. Add multiple labels with duplicates and whitespace
      const updated = await updateConversationLabelsDb(
        ASTRO_BIZ_ID,
        testConvId,
        ["  VIP  ", "Vedic Consultation", "VIP", "Remedy Pending"],
        customClient
      );

      expect(updated).toEqual(["VIP", "Vedic Consultation", "Remedy Pending"]);

      // Verify in PostgreSQL
      const row1 = await db.query<any>(`SELECT labels FROM public.wa_conversations WHERE id = $1;`, [testConvId]);
      expect(row1.rows[0].labels).toEqual(["VIP", "Vedic Consultation", "Remedy Pending"]);

      // 2. Remove label by updating with subset
      const remaining = await updateConversationLabelsDb(
        ASTRO_BIZ_ID,
        testConvId,
        ["VIP"],
        customClient
      );
      expect(remaining).toEqual(["VIP"]);

      const row2 = await db.query<any>(`SELECT labels FROM public.wa_conversations WHERE id = $1;`, [testConvId]);
      expect(row2.rows[0].labels).toEqual(["VIP"]);

      // 3. Clear all labels
      const cleared = await updateConversationLabelsDb(
        ASTRO_BIZ_ID,
        testConvId,
        [],
        customClient
      );
      expect(cleared).toEqual([]);

      const row3 = await db.query<any>(`SELECT labels FROM public.wa_conversations WHERE id = $1;`, [testConvId]);
      expect(row3.rows[0].labels).toEqual([]);
    });

    it("3.2 Rejects unauthenticated label update requests fail-closed", async () => {
      const res = await updateConversationLabelsAction({
        businessSlug: "invalid-tenant-slug",
        conversationId: testConvId,
        labels: ["VIP"],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  // ============================================================================
  // DOMAIN 4: TENANT AUTHORIZATION & UNREAD COUNT SECURITY
  // ============================================================================
  describe("Domain 4: Tenant Authorization & Fail-Closed Guards", () => {
    it("4.1 Rejects unauthenticated getInboxUnreadCountAction without falling back to hardcoded IDs", async () => {
      const res = await getInboxUnreadCountAction("unauthorized-foreign-slug");
      expect(res.success).toBe(false);
      expect(res.unread).toBe(0);
      expect(res.error).toBeDefined();
    });
  });
});
