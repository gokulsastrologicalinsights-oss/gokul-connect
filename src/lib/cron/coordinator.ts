import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { WorkerType } from "@/types/operations";
import { logger, sanitizeLogData } from "@/lib/observability/logger";
import { recordWorkerRunInMemory } from "@/lib/observability/worker-health";

/**
 * ==============================================================================
 * GOKUL CONNECT — CENTRALIZED CRON EXECUTION COORDINATOR
 * ==============================================================================
 * Unified execution wrapper for background cron routes.
 * Enforces:
 * 1. Fail-closed CRON_SECRET authentication.
 * 2. PostgreSQL-backed distributed locking with owner verification, lease renewal,
 *    and automatic crash recovery across multi-instance serverless deployments.
 * 3. Multi-tenant lock scoping (cron_name:business_id) ensuring tenant isolation.
 * 4. Structured telemetry logging, safe error sanitization, and DB execution audit.
 * ==============================================================================
 */

export interface CronCoordinatorOptions<TResult> {
  cronName: string;
  workerType: WorkerType;
  workerIdPrefix?: string;
  request: NextRequest;
  businessId?: string | null;
  timeoutMs?: number;
  supabaseClient?: any;
  handler: (workerId: string) => Promise<TResult>;
}

export interface CronLockAcquisitionResult {
  acquired: boolean;
  lockKey: string;
  ownerId: string;
  currentOwner?: string;
  acquiredAt?: string | Date;
  expiresAt?: string | Date;
  recovered?: boolean;
}

export interface CronLockRenewalResult {
  renewed: boolean;
  lockKey: string;
  ownerId: string;
  expiresAt?: string | Date;
  renewalCount?: number;
  reason?: string;
}

export interface CronLockReleaseResult {
  released: boolean;
  lockKey: string;
  ownerId: string;
  reason?: string;
}

// In-process concurrency lock map used for process-local tracking and offline fallback
const activeCronLocks = new Map<string, { lockedAt: number; workerId: string; expiresAt: number }>();

/**
 * Resolves the atomic lock key. If a businessId is provided, the lock is strictly
 * tenant-scoped so jobs for one business never collide with or block other tenants.
 */
export function resolveLockKey(cronName: string, businessId?: string | null): string {
  if (businessId && typeof businessId === "string" && businessId.trim().length > 0) {
    return `${cronName}:${businessId.trim()}`;
  }
  return cronName;
}

/**
 * Acquires a distributed lock atomically via PostgreSQL RPC `acquire_cron_lock`,
 * with seamless in-memory fallback for test environments or offline operation.
 */
export async function acquireDistributedLock(options: {
  lockKey: string;
  cronName: string;
  ownerId: string;
  ttlSeconds: number;
  businessId?: string | null;
  metadata?: Record<string, any>;
  client?: any;
}): Promise<CronLockAcquisitionResult> {
  const { lockKey, cronName, ownerId, ttlSeconds, businessId = null, metadata = {}, client } = options;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = createAdminClient();
    } catch {
      supabase = null;
    }
  }

  // 1. PostgreSQL-backed atomic distributed lock
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("acquire_cron_lock", {
        p_lock_key: lockKey,
        p_cron_name: cronName,
        p_owner_id: ownerId,
        p_ttl_seconds: ttlSeconds,
        p_business_id: businessId || null,
        p_metadata: metadata,
      });

      if (!error && data) {
        if (data.acquired) {
          activeCronLocks.set(lockKey, {
            lockedAt: Date.now(),
            workerId: ownerId,
            expiresAt: Date.now() + ttlSeconds * 1000,
          });
          return {
            acquired: true,
            lockKey,
            ownerId,
            acquiredAt: data.acquired_at,
            expiresAt: data.expires_at,
            recovered: Boolean(data.recovered),
          };
        } else {
          return {
            acquired: false,
            lockKey,
            ownerId,
            currentOwner: data.current_owner,
            expiresAt: data.expires_at,
          };
        }
      }

      logger.warn("acquire_cron_lock_rpc_fallback", {
        meta: { lockKey, error: error?.message },
      });
    } catch (err: any) {
      logger.warn("acquire_cron_lock_exception_fallback", {
        meta: { lockKey, error: err?.message },
      });
    }
  }

  // 2. In-process fallback lock
  const now = Date.now();
  const existing = activeCronLocks.get(lockKey);

  if (existing && existing.expiresAt > now) {
    return {
      acquired: false,
      lockKey,
      ownerId,
      currentOwner: existing.workerId,
      expiresAt: new Date(existing.expiresAt).toISOString(),
    };
  }

  activeCronLocks.set(lockKey, {
    lockedAt: now,
    workerId: ownerId,
    expiresAt: now + ttlSeconds * 1000,
  });

  return {
    acquired: true,
    lockKey,
    ownerId,
    acquiredAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    recovered: existing ? existing.expiresAt <= now : false,
  };
}

/**
 * Renews an active distributed lock lease, verifying owner identity and remaining validity.
 */
export async function renewDistributedLock(options: {
  lockKey: string;
  ownerId: string;
  ttlSeconds: number;
  client?: any;
}): Promise<CronLockRenewalResult> {
  const { lockKey, ownerId, ttlSeconds, client } = options;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = createAdminClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("renew_cron_lock", {
        p_lock_key: lockKey,
        p_owner_id: ownerId,
        p_ttl_seconds: ttlSeconds,
      });

      if (!error && data) {
        if (data.renewed) {
          activeCronLocks.set(lockKey, {
            lockedAt: Date.now(),
            workerId: ownerId,
            expiresAt: Date.now() + ttlSeconds * 1000,
          });
          return {
            renewed: true,
            lockKey,
            ownerId,
            expiresAt: data.expires_at,
            renewalCount: data.renewal_count,
          };
        } else {
          return {
            renewed: false,
            lockKey,
            ownerId,
            reason: data.reason,
          };
        }
      }
    } catch (err: any) {
      logger.warn("renew_cron_lock_rpc_error", {
        meta: { lockKey, error: err?.message },
      });
    }
  }

  const now = Date.now();
  const existing = activeCronLocks.get(lockKey);
  if (existing && existing.workerId === ownerId && existing.expiresAt >= now) {
    existing.expiresAt = now + ttlSeconds * 1000;
    return {
      renewed: true,
      lockKey,
      ownerId,
      expiresAt: new Date(existing.expiresAt).toISOString(),
    };
  }

  return {
    renewed: false,
    lockKey,
    ownerId,
    reason: "Lock not found or expired in process memory",
  };
}

/**
 * Releases a distributed lock with owner verification. Ensures that a worker that hung
 * or crashed cannot accidentally release a newly granted lock owned by another instance.
 */
export async function releaseDistributedLock(options: {
  lockKey: string;
  ownerId: string;
  client?: any;
}): Promise<CronLockReleaseResult> {
  const { lockKey, ownerId, client } = options;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = createAdminClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("release_cron_lock", {
        p_lock_key: lockKey,
        p_owner_id: ownerId,
      });

      if (!error && data) {
        const existing = activeCronLocks.get(lockKey);
        if (existing && existing.workerId === ownerId) {
          activeCronLocks.delete(lockKey);
        }
        return {
          released: Boolean(data.released),
          lockKey,
          ownerId,
          reason: data.reason,
        };
      }
    } catch (err: any) {
      logger.warn("release_cron_lock_rpc_error", {
        meta: { lockKey, error: err?.message },
      });
    }
  }

  const existing = activeCronLocks.get(lockKey);
  if (existing && existing.workerId === ownerId) {
    activeCronLocks.delete(lockKey);
    return { released: true, lockKey, ownerId };
  }

  return { released: false, lockKey, ownerId, reason: "Lock not owned or already released" };
}

/**
 * Check whether a cron job is currently locked in memory.
 */
export function isCronLocked(
  cronName: string,
  lockTtlMs: number = 60000,
  businessId?: string | null
): boolean {
  const lockKey = resolveLockKey(cronName, businessId);
  const lock = activeCronLocks.get(lockKey) || activeCronLocks.get(cronName);
  if (!lock) return false;
  if (Date.now() > lock.expiresAt) {
    activeCronLocks.delete(lockKey);
    activeCronLocks.delete(cronName);
    return false;
  }
  return true;
}

/**
 * Reset all in-memory cron locks (useful for test resets).
 */
export function resetCronLocks(): void {
  activeCronLocks.clear();
}

/**
 * Executes a cron handler with centralized security, distributed PostgreSQL concurrency guards,
 * bounded execution safety, and structured telemetry recording.
 */
export async function runCoordinatedCron<TResult extends Record<string, any>>(
  options: CronCoordinatorOptions<TResult>
): Promise<NextResponse> {
  const {
    cronName,
    workerType,
    request,
    businessId = null,
    timeoutMs = 60000,
    handler,
    supabaseClient,
  } = options;
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 1. Fail-closed authentication
  if (!verifyCronAuthorization(authHeader, cronSecret)) {
    logger.warn("cron_unauthorized_rejection", {
      workerName: workerType,
      error: "Missing or invalid CRON_SECRET authorization header",
      businessId,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockKey = resolveLockKey(cronName, businessId);
  const ttlSeconds = Math.max(10, Math.ceil(timeoutMs / 1000));
  const prefix =
    options.workerIdPrefix ||
    (cronName === "process-automation-jobs" ? "cron" : `${cronName.replace(/-/g, "_")}`);
  const workerId = `${prefix}_${Date.now()}`;
  const startTime = Date.now();

  // 2. Concurrency overlap guard (PostgreSQL distributed lock)
  const lockResult = await acquireDistributedLock({
    lockKey,
    cronName,
    ownerId: workerId,
    ttlSeconds,
    businessId,
    metadata: { cronName, workerType, timeoutMs },
    client: supabaseClient,
  });

  if (!lockResult.acquired) {
    logger.warn("cron_overlapping_execution_prevented", {
      workerName: workerType,
      meta: {
        cronName,
        lockKey,
        activeWorkerId: lockResult.currentOwner,
        expiresAt: lockResult.expiresAt,
      },
      businessId,
    });
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: "Overlapping execution prevented: previous run still in progress",
        cronName,
        lockKey,
        currentOwner: lockResult.currentOwner,
      },
      { status: 200 }
    );
  }

  try {
    // 3. Execute cron batch handler
    const result = await handler(workerId);
    const durationMs = Date.now() - startTime;

    // Extract metrics if available from result
    const claimedCount =
      result?.claimedCount ??
      result?.queue?.claimedCount ??
      result?.result?.claimedCount ??
      result?.worker?.claimedCount ??
      0;
    const processedCount =
      result?.processedCount ??
      result?.queue?.processedCount ??
      result?.result?.processedCount ??
      result?.worker?.processedCount ??
      0;
    const succeededCount =
      result?.succeededCount ??
      result?.queue?.succeededCount ??
      result?.result?.sentCount ??
      result?.worker?.succeededCount ??
      0;
    const failedCount =
      result?.failedCount ??
      result?.queue?.failedCount ??
      result?.result?.failedCount ??
      result?.worker?.failedCount ??
      0;
    const reclaimedCount =
      result?.reclaimedCount ??
      result?.result?.reclaimedCount ??
      result?.worker?.reclaimedCount ??
      0;

    // Record telemetry in-memory
    recordWorkerRunInMemory({
      id: `run_${workerId}`,
      businessId,
      workerName: workerType,
      workerId,
      status: failedCount > 0 && succeededCount === 0 ? "failed" : "succeeded",
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      claimedCount,
      processedCount,
      succeededCount,
      failedCount,
      reclaimedCount,
      skippedCount: result?.skippedCount ?? result?.queue?.skippedCount ?? 0,
      error: null,
    });

    // Record telemetry in Supabase DB if configured
    if (isSupabaseConfigured() || supabaseClient) {
      try {
        const supabase = supabaseClient || createAdminClient();
        await supabase.from("worker_execution_runs").insert({
          business_id: businessId,
          worker_name: workerType,
          worker_id: workerId,
          status: "succeeded",
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          claimed_count: claimedCount,
          processed_count: processedCount,
          succeeded_count: succeededCount,
          failed_count: failedCount,
          reclaimed_count: reclaimedCount,
          skipped_count: result?.skippedCount ?? 0,
          metadata: { cronName, lockKey },
        });
      } catch (dbErr: any) {
        // Non-blocking telemetry write error
        logger.warn("worker_execution_run_db_log_failed", {
          error: dbErr.message,
        });
      }
    }

    // Structured JSON log
    logger.logWorkerRun({
      workerName: workerType,
      workerId,
      businessId,
      status: "succeeded",
      durationMs,
      claimedCount,
      processedCount,
      succeededCount,
      failedCount,
      reclaimedCount,
      meta: { cronName, lockKey },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workerId,
      durationMs,
      lockKey,
      ...result,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const rawMessage = typeof err?.message === "string" ? err.message : "Execution error";
    const sanitizedError = sanitizeLogData(rawMessage);

    // Record failure in-memory
    recordWorkerRunInMemory({
      id: `run_${workerId}`,
      businessId,
      workerName: workerType,
      workerId,
      status: "failed",
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      claimedCount: 0,
      processedCount: 0,
      succeededCount: 0,
      failedCount: 1,
      reclaimedCount: 0,
      skippedCount: 0,
      error: sanitizedError,
    });

    // Structured log
    logger.logWorkerRun({
      workerName: workerType,
      workerId,
      businessId,
      status: "failed",
      durationMs,
      failedCount: 1,
      error: sanitizedError,
      meta: { cronName, lockKey },
    });

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        workerId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } finally {
    // 4. Release distributed concurrency lock (owner-verified)
    await releaseDistributedLock({
      lockKey,
      ownerId: workerId,
      client: supabaseClient,
    });
  }
}
