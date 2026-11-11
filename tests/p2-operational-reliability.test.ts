import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { runCoordinatedCron, resetCronLocks } from "@/lib/cron/coordinator";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";
import {
  classifyError,
  calculateBoundedBackoff,
  KNOWN_ERROR_CODES,
} from "@/lib/observability/error-classifier";
import {
  recoverStuckJobsDb,
  manualRetryJobDb,
  mockOperationalJobs,
  resetMockOperationalJobs,
} from "@/lib/observability/recovery";
import {
  getTenantWorkerHealthSummary,
  getRecentOperationalActivity,
  recordWorkerRunInMemory,
  resetMockWorkerRuns,
  mockWorkerRuns,
} from "@/lib/observability/worker-health";
import {
  checkLiveness,
  checkReadiness,
  checkWorkersHealth,
} from "@/lib/observability/system-health";
import { sanitizeLogData, logger } from "@/lib/observability/logger";
import { GET as getAutomationCron } from "@/app/api/cron/process-automation-jobs/route";
import { GET as getScheduledCron } from "@/app/api/cron/process-scheduled-messages/route";
import { GET as getCampaignCron } from "@/app/api/cron/process-campaigns/route";
import { GET as getCrmRemindersCron } from "@/app/api/cron/process-crm-reminders/route";
import { GET as getLivenessRoute } from "@/app/api/health/liveness/route";
import { GET as getReadinessRoute } from "@/app/api/health/readiness/route";
import { GET as getWorkersRoute } from "@/app/api/health/workers/route";
import { GET as getCombinedHealthRoute } from "@/app/api/health/route";

const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
const TEST_CRON_SECRET = "test_cron_secret_operational_p2_2026";

describe("P2: Operational Reliability & Worker Observability Suite", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    resetCronLocks();
    resetMockOperationalJobs();
    resetMockWorkerRuns();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    resetCronLocks();
    resetMockOperationalJobs();
    resetMockWorkerRuns();
  });

  // ============================================================================
  // DOMAIN 1: CRON SCHEDULING, FAIL-CLOSED AUTH & CONCURRENCY OVERLAP GUARD
  // ============================================================================
  describe("Domain 1: Centralized Cron Scheduling & Concurrency Coordination", () => {
    it("1.1 Rejects unauthorized cron invocations with HTTP 401 when token is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs");
      const res = await getAutomationCron(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("1.2 Rejects unauthorized cron invocations when token is tampered or invalid", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/process-scheduled-messages", {
        headers: { authorization: "Bearer invalid_tampered_secret" },
      });
      const res = await getScheduledCron(req);
      expect(res.status).toBe(401);
    });

    it("1.3 Fails closed with HTTP 401 when CRON_SECRET is empty string or undefined in env", async () => {
      delete process.env.CRON_SECRET;
      const req = new NextRequest("http://localhost:3000/api/cron/process-campaigns", {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });
      const res = await getCampaignCron(req);
      expect(res.status).toBe(401);
    });

    it("1.4 Successfully executes cron endpoint with valid Bearer token", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/process-crm-reminders", {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });
      const res = await getCrmRemindersCron(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.workerId).toBeDefined();
    });

    it("1.5 Prevents concurrent overlapping execution of the same cron job", async () => {
      let resolveFirst: (val?: any) => void;
      const firstExecutionPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const req1 = new NextRequest("http://localhost:3000/api/cron/test-overlap", {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });

      // Launch first long-running execution
      const call1 = runCoordinatedCron({
        cronName: "test-overlap",
        workerType: "automation_worker",
        request: req1,
        handler: async () => {
          await firstExecutionPromise;
          return { claimedCount: 5, succeededCount: 5 };
        },
      });

      // Attempt second overlapping execution while first is in flight
      const req2 = new NextRequest("http://localhost:3000/api/cron/test-overlap", {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });

      const call2 = await runCoordinatedCron({
        cronName: "test-overlap",
        workerType: "automation_worker",
        request: req2,
        handler: async () => ({ claimedCount: 1, succeededCount: 1 }),
      });

      expect(call2.status).toBe(200);
      const json2 = await call2.json();
      expect(json2.skipped).toBe(true);
      expect(json2.reason).toContain("Overlapping execution prevented");

      // Finish first call
      resolveFirst!();
      const res1 = await call1;
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.success).toBe(true);
    });

    it("1.6 Allows repeated sequential invocations cleanly once lock is released", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/test-seq", {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });

      const res1 = await runCoordinatedCron({
        cronName: "test-seq",
        workerType: "automation_worker",
        request: req,
        handler: async () => ({ processedCount: 1 }),
      });
      expect(res1.status).toBe(200);

      // Run second invocation immediately
      const res2 = await runCoordinatedCron({
        cronName: "test-seq",
        workerType: "automation_worker",
        request: req,
        handler: async () => ({ processedCount: 2 }),
      });
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.success).toBe(true);
      expect(json2.skipped).toBeUndefined();
    });
  });

  // ============================================================================
  // DOMAIN 2: CENTRALIZED WORKER HEALTH MONITORING & MULTI-TENANT ISOLATION
  // ============================================================================
  describe("Domain 2: Centralized Worker Health Monitoring & Multi-Tenant Telemetry", () => {
    it("2.1 Aggregates queue health correctly for a healthy worker with no pending errors", async () => {
      mockOperationalJobs.set("job_astro_1", {
        business_id: ASTRO_BIZ_ID,
        workerType: "automation_worker",
        status: "pending",
        attempts: 0,
        max_attempts: 3,
      });

      const summary = await getTenantWorkerHealthSummary(ASTRO_BIZ_ID);
      expect(summary.overallStatus).toBe("healthy");
      expect(summary.queuesSummary.totalPending).toBe(1);
      expect(summary.queuesSummary.totalFailed).toBe(0);
      expect(summary.queuesSummary.totalStuck).toBe(0);

      const autoWorker = summary.workers.find((w) => w.workerType === "automation_worker");
      expect(autoWorker?.status).toBe("healthy");
      expect(autoWorker?.queue.pending).toBe(1);
    });

    it("2.2 Detects stalled worker status when stuck jobs exceed timeout threshold", async () => {
      const stuckTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      mockOperationalJobs.set("job_astro_stuck", {
        business_id: ASTRO_BIZ_ID,
        workerType: "scheduled_worker",
        queueType: "scheduled",
        status: "processing",
        locked_at: stuckTime,
        attempts: 1,
        max_attempts: 3,
      });

      const summary = await getTenantWorkerHealthSummary(ASTRO_BIZ_ID);
      expect(summary.overallStatus).toBe("critical");
      expect(summary.queuesSummary.totalStuck).toBe(1);

      const schedWorker = summary.workers.find((w) => w.workerType === "scheduled_worker");
      expect(schedWorker?.status).toBe("stalled");
      expect(schedWorker?.queue.stuck).toBe(1);
    });

    it("2.3 Strictly isolates operational metrics between Astrology and Vivaham tenants", async () => {
      // Astro has 3 pending jobs
      mockOperationalJobs.set("job_astro_a", {
        business_id: ASTRO_BIZ_ID,
        workerType: "automation_worker",
        status: "pending",
        attempts: 0,
      });
      mockOperationalJobs.set("job_astro_b", {
        business_id: ASTRO_BIZ_ID,
        workerType: "campaign_worker",
        queueType: "campaign",
        status: "pending",
        attempts: 0,
      });

      // Vivaham has 1 failed job
      mockOperationalJobs.set("job_vivaham_1", {
        business_id: VIVAHAM_BIZ_ID,
        workerType: "scheduled_worker",
        queueType: "scheduled",
        status: "failed",
        attempts: 3,
      });

      const astroSummary = await getTenantWorkerHealthSummary(ASTRO_BIZ_ID);
      expect(astroSummary.queuesSummary.totalPending).toBe(2);
      expect(astroSummary.queuesSummary.totalFailed).toBe(0);

      const vivahamSummary = await getTenantWorkerHealthSummary(VIVAHAM_BIZ_ID);
      expect(vivahamSummary.queuesSummary.totalPending).toBe(0);
      expect(vivahamSummary.queuesSummary.totalFailed).toBe(1);
    });

    it("2.4 Returns idle status when worker queues are completely empty", async () => {
      const summary = await getTenantWorkerHealthSummary(ASTRO_BIZ_ID);
      expect(summary.queuesSummary.totalPending).toBe(0);
      expect(summary.queuesSummary.totalProcessing).toBe(0);
      expect(summary.overallStatus).toBe("healthy");

      const workers = summary.workers;
      workers.forEach((w) => {
        expect(w.status).toBe("idle");
      });
    });
  });

  // ============================================================================
  // DOMAIN 3: FAILURE RECOVERY, ERROR CLASSIFICATION & DEAD-LETTER MANAGEMENT
  // ============================================================================
  describe("Domain 3: Failure Recovery, Error Classification & Dead-Letter Management", () => {
    it("3.1 Classifies HTTP 429 and rate limits as TRANSIENT with recommended delay", () => {
      const classified = classifyError({
        status: 429,
        message: "Meta Graph API rate limit exceeded (#131056)",
      });
      expect(classified.classification).toBe("transient");
      expect(classified.isRetryable).toBe(true);
      expect(classified.errorCode).toBe(KNOWN_ERROR_CODES.RATE_LIMIT_429);
      expect(classified.recommendedDelaySec).toBeGreaterThanOrEqual(30);
    });

    it("3.2 Classifies 5xx server errors and network timeouts as TRANSIENT", () => {
      const classified = classifyError(new Error("connect ETIMEDOUT 157.240.198.17:443"));
      expect(classified.classification).toBe("transient");
      expect(classified.isRetryable).toBe(true);
      expect(classified.errorCode).toBe(KNOWN_ERROR_CODES.NETWORK_TIMEOUT);
    });

    it("3.3 Classifies opt-out as PERMANENT and non-retryable", () => {
      const classified = classifyError("Recipient has opted_out of promotional messages");
      expect(classified.classification).toBe("permanent");
      expect(classified.isRetryable).toBe(false);
      expect(classified.errorCode).toBe(KNOWN_ERROR_CODES.CONTACT_OPTED_OUT);
    });

    it("3.4 Classifies expired 24h customer window as PERMANENT for non-template messages", () => {
      const classified = classifyError("WhatsApp 24 hour customer service window is closed (#131026)");
      expect(classified.classification).toBe("permanent");
      expect(classified.isRetryable).toBe(false);
      expect(classified.errorCode).toBe(KNOWN_ERROR_CODES.CUSTOMER_WINDOW_EXPIRED);
    });

    it("3.5 Classifies rejected or missing templates as PERMANENT", () => {
      const classified = classifyError("Template astro_consultation_intro not found or rejected (#131047)");
      expect(classified.classification).toBe("permanent");
      expect(classified.isRetryable).toBe(false);
      expect(classified.errorCode).toBe(KNOWN_ERROR_CODES.TEMPLATE_REJECTED_OR_MISSING);
    });

    it("3.6 Calculates exponential backoff with bounded limits", () => {
      const delay0 = calculateBoundedBackoff(0, 30, 1800);
      const delay1 = calculateBoundedBackoff(1, 30, 1800);
      const delay2 = calculateBoundedBackoff(2, 30, 1800);
      const delay10 = calculateBoundedBackoff(10, 30, 1800);

      expect(delay0).toBeGreaterThanOrEqual(30);
      expect(delay1).toBeGreaterThanOrEqual(60);
      expect(delay2).toBeGreaterThanOrEqual(120);
      expect(delay10).toBeLessThanOrEqual(1800); // Max bound
    });

    it("3.7 Reclaims stuck jobs and moves retry-exhausted jobs to dead_letter state", async () => {
      const stuckTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      mockOperationalJobs.set("job_exhausted", {
        business_id: ASTRO_BIZ_ID,
        workerType: "automation_worker",
        status: "processing",
        locked_at: stuckTime,
        attempts: 2,
        max_attempts: 3,
      });

      const recovery = await recoverStuckJobsDb({
        businessId: ASTRO_BIZ_ID,
        timeoutMinutes: 5,
      });

      expect(recovery.reclaimed.automation).toBe(1);
      const updatedJob = mockOperationalJobs.get("job_exhausted");
      expect(updatedJob.status).toBe("dead_letter");
      expect(updatedJob.attempts).toBe(3);
      expect(updatedJob.locked_at).toBeNull();
    });

    it("3.8 CRITICAL: Prevents duplicate message dispatch if message was already sent", async () => {
      const stuckTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      mockOperationalJobs.set("job_already_sent", {
        business_id: ASTRO_BIZ_ID,
        queueType: "scheduled",
        workerType: "scheduled_worker",
        status: "processing",
        locked_at: stuckTime,
        attempts: 1,
        max_attempts: 3,
        meta_message_id: "wamid.HBgLMTEwMjY0NjQ2OTI2NjQ3ORUCABEYEjA5MEIzOTI=", // Meta ID already assigned!
      });

      const recovery = await recoverStuckJobsDb({
        businessId: ASTRO_BIZ_ID,
        timeoutMinutes: 5,
      });

      expect(recovery.reclaimed.scheduled).toBe(1);
      const updatedJob = mockOperationalJobs.get("job_already_sent");
      // MUST NOT be rescheduled as pending! Must be marked 'sent' to prevent duplicate dispatch
      expect(updatedJob.status).toBe("sent");
      expect(updatedJob.locked_at).toBeNull();
    });

    it("3.9 Allows Owner and Admin to manually retry failed/dead-letter jobs", async () => {
      mockOperationalJobs.set("job_failed_manual", {
        business_id: ASTRO_BIZ_ID,
        queueType: "automation",
        status: "dead_letter",
        attempts: 3,
        max_attempts: 3,
      });

      const res = await manualRetryJobDb({
        businessId: ASTRO_BIZ_ID,
        queueType: "automation",
        jobId: "job_failed_manual",
        actorUserId: "00000000-0000-0000-0000-000000000001",
        actorRole: "owner",
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("requeued");
      const job = mockOperationalJobs.get("job_failed_manual");
      expect(job.status).toBe("pending");
      expect(job.attempts).toBe(0);
      expect(job.locked_at).toBeNull();
    });

    it("3.10 Rejects manual retry attempt by unauthorized Agent or Viewer role (403)", async () => {
      mockOperationalJobs.set("job_agent_retry", {
        business_id: ASTRO_BIZ_ID,
        queueType: "automation",
        status: "dead_letter",
        attempts: 3,
      });

      const resAgent = await manualRetryJobDb({
        businessId: ASTRO_BIZ_ID,
        queueType: "automation",
        jobId: "job_agent_retry",
        actorUserId: "00000000-0000-0000-0000-000000000002",
        actorRole: "agent",
      });

      expect(resAgent.success).toBe(false);
      expect(resAgent.error).toContain("Forbidden");

      const resViewer = await manualRetryJobDb({
        businessId: ASTRO_BIZ_ID,
        queueType: "automation",
        jobId: "job_agent_retry",
        actorUserId: "00000000-0000-0000-0000-000000000003",
        actorRole: "viewer",
      });

      expect(resViewer.success).toBe(false);
      expect(resViewer.error).toContain("Forbidden");
    });
  });

  // ============================================================================
  // DOMAIN 4: STRUCTURED LOGGING, SANITIZATION & DIAGNOSTICS
  // ============================================================================
  describe("Domain 4: Structured Logging, Sanitization & Secret Scrubbing", () => {
    it("4.1 Sanitizes Bearer authorization tokens from error messages", () => {
      const raw = "Request failed with header Authorization: Bearer EAAQx8...secret_token_value";
      const sanitized = sanitizeLogData(raw);
      expect(sanitized).not.toContain("EAAQx8");
      expect(sanitized).toContain("Bearer [REDACTED]");
    });

    it("4.2 Sanitizes PostgreSQL credentials from database error logs", () => {
      const raw = "Connection failed to postgresql://postgres:SuperSecretPw123@db.supabase.co:5432/postgres";
      const sanitized = sanitizeLogData(raw);
      expect(sanitized).not.toContain("SuperSecretPw123");
      expect(sanitized).toContain("postgresql://postgres:[REDACTED]@db.supabase.co");
    });

    it("4.3 Sanitizes secrets and tokens inside structured object payloads", () => {
      const payload = {
        metaToken: "EAABs8...token",
        appSecret: "90b123456789abcdef",
        businessId: ASTRO_BIZ_ID,
        messageContent: "Hi, this is a private WhatsApp message from customer",
      };

      const sanitized = sanitizeLogData(payload);
      expect(sanitized.metaToken).toBe("[REDACTED]");
      expect(sanitized.appSecret).toBe("[REDACTED]");
      expect(sanitized.businessId).toBe(ASTRO_BIZ_ID);
      expect(sanitized.messageContent).toContain("[TRUNCATED]");
    });
  });

  // ============================================================================
  // DOMAIN 5: SYSTEM HEALTH, LIVENESS & READINESS CHECKS
  // ============================================================================
  describe("Domain 5: System Health, Liveness & Readiness Probes", () => {
    it("5.1 Liveness probe returns HTTP 200 with uptime and zero database overhead", async () => {
      const res = await getLivenessRoute();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(typeof json.uptimeSeconds).toBe("number");
    });

    it("5.2 Readiness probe returns valid system readiness status", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/readiness");
      const res = await getReadinessRoute(req);
      expect([200, 503]).toContain(res.status);
      const json = await res.json();
      expect(json.status).toBeDefined();
    });

    it("5.3 Worker health probe verifies cron authentication and queue readiness", async () => {
      const req = new NextRequest("http://localhost:3000/api/health/workers");
      const res = await getWorkersRoute(req);
      expect([200, 503]).toContain(res.status);
      const json = await res.json();
      expect(json.status).toBeDefined();
    });

    it("5.4 Public caller receives sanitized high-level response; authorized admin receives diagnostics", async () => {
      // 1. Public caller
      const publicReq = new NextRequest("http://localhost:3000/api/health");
      const publicRes = await getCombinedHealthRoute(publicReq);
      const publicJson = await publicRes.json();
      expect(publicJson.status).toBeDefined();
      expect(publicJson.checks).toBeUndefined(); // Secrets and subsystem details omitted

      // 2. Authorized Administrator
      const adminReq = new NextRequest("http://localhost:3000/api/health", {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });
      const adminRes = await getCombinedHealthRoute(adminReq);
      const adminJson = await adminRes.json();
      expect(adminJson.status).toBeDefined();
      expect(adminJson.readiness).toBeDefined();
      expect(adminJson.workers).toBeDefined();
    });
  });

  // ============================================================================
  // DOMAIN 6: DATABASE MIGRATION 023 INTEGRITY & CONSTRAINTS IN PGLITE
  // ============================================================================
  describe("Domain 6: Database Migration 023 Integrity & Constraints (PGlite Engine)", () => {
    let db: PGlite;
    const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

    beforeEach(async () => {
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
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
          SELECT '00000000-0000-0000-0000-000000000001'::UUID;
        $$;
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
          SELECT '{"role": "service_role"}'::jsonb;
        $$;
      `);

      const sqlFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      expect(sqlFiles.some((f) => f.includes("023"))).toBe(true);

      for (const file of sqlFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
        await db.exec(sql);
      }
    });

    it("6.1 Confirms worker_execution_runs table and indexes exist in PGlite", async () => {
      const res = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'worker_execution_runs'
        ORDER BY column_name;
      `);

      const cols = res.rows.map((r: any) => r.column_name);
      expect(cols).toContain("id");
      expect(cols).toContain("business_id");
      expect(cols).toContain("worker_name");
      expect(cols).toContain("worker_id");
      expect(cols).toContain("status");
      expect(cols).toContain("started_at");
      expect(cols).toContain("duration_ms");
      expect(cols).toContain("claimed_count");
      expect(cols).toContain("succeeded_count");
    });

    it("6.2 Confirms dead_letter is permitted by check constraints on queue tables in PGlite", async () => {
      // Insert dead_letter job into wa_processing_jobs
      await db.query(`
        INSERT INTO public.wa_processing_jobs (
          id, business_id, job_type, payload, status, attempts, max_attempts
        ) VALUES (
          '88888888-8888-8888-8888-888888888888',
          '${ASTRO_BIZ_ID}',
          'send_message',
          '{}'::jsonb,
          'dead_letter',
          3,
          3
        );
      `);

      const res = await db.query(`
        SELECT status FROM public.wa_processing_jobs WHERE id = '88888888-8888-8888-8888-888888888888';
      `);
      expect((res.rows[0] as any).status).toBe("dead_letter");
    });

    it("6.3 Confirms RPC get_worker_health_metrics executes cleanly in PGlite", async () => {
      const res = await db.query(`
        SELECT public.get_worker_health_metrics('${ASTRO_BIZ_ID}'::UUID) AS metrics;
      `);

      expect(res.rows.length).toBe(1);
      const metrics = (res.rows[0] as any).metrics;
      expect(metrics.business_id).toBe(ASTRO_BIZ_ID);
      expect(metrics.queues).toBeDefined();
      expect(metrics.queues.automation).toBeDefined();
      expect(metrics.queues.scheduled).toBeDefined();
      expect(metrics.queues.campaigns).toBeDefined();
      expect(metrics.queues.crm_reminders).toBeDefined();
    });

    it("6.4 Confirms RPC reclaim_stuck_queue_jobs safely recovers stuck locks", async () => {
      const res = await db.query(`
        SELECT public.reclaim_stuck_queue_jobs(5, '${ASTRO_BIZ_ID}'::UUID) AS result;
      `);

      expect(res.rows.length).toBe(1);
      const result = (res.rows[0] as any).result;
      expect(result.reclaimed).toBeDefined();
      expect(typeof result.reclaimed.automation).toBe("number");
    });

    it("6.5 Confirms RPC retry_queue_job requeues dead_letter jobs atomically", async () => {
      await db.query(`
        INSERT INTO public.wa_processing_jobs (
          id, business_id, job_type, payload, status, attempts, max_attempts
        ) VALUES (
          '88888888-8888-8888-8888-888888888888',
          '${ASTRO_BIZ_ID}',
          'send_message',
          '{}'::jsonb,
          'dead_letter',
          3,
          3
        );
      `);

      const res = await db.query(`
        SELECT public.retry_queue_job(
          '${ASTRO_BIZ_ID}'::UUID,
          'automation',
          '88888888-8888-8888-8888-888888888888'::UUID
        ) AS retry_res;
      `);

      const retryRes = (res.rows[0] as any).retry_res;
      expect(retryRes.success).toBe(true);
      expect(retryRes.status).toBe("requeued");

      const check = await db.query(`
        SELECT status, attempts, locked_at 
        FROM public.wa_processing_jobs 
        WHERE id = '88888888-8888-8888-8888-888888888888';
      `);
      const row = check.rows[0] as any;
      expect(row.status).toBe("pending");
      expect(row.attempts).toBe(0);
      expect(row.locked_at).toBeNull();
    });
  });
});
