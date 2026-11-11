import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { QueueType } from "@/types/operations";
import { classifyError } from "./error-classifier";
import { logger } from "./logger";

/**
 * ==============================================================================
 * GOKUL CONNECT — QUEUE RECOVERY & DEAD-LETTER MANAGEMENT
 * ==============================================================================
 * Safely recovers stuck jobs, prevents duplicate dispatches, manages dead letters,
 * and executes authorized manual retries with strict tenant isolation.
 * ==============================================================================
 */

export interface StuckRecoveryResult {
  timestamp: string;
  reclaimed: {
    automation: number;
    scheduled: number;
    campaigns: number;
    crm_reminders: number;
  };
}

export interface ManualRetryResult {
  success: boolean;
  jobId?: string;
  queueType?: QueueType;
  status?: string;
  error?: string;
}

// In-memory mock store for unit testing & offline development
export const mockOperationalJobs = new Map<string, any>();

export function resetMockOperationalJobs(): void {
  mockOperationalJobs.clear();
}

/**
 * Detects and recovers stuck queue jobs across all queues.
 * Verifies dispatch state to guarantee ZERO duplicate message dispatch.
 */
export async function recoverStuckJobsDb(options?: {
  timeoutMinutes?: number;
  businessId?: string;
}): Promise<StuckRecoveryResult> {
  const timeoutMinutes = options?.timeoutMinutes ?? 5;
  const businessId = options?.businessId;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("reclaim_stuck_queue_jobs", {
        p_timeout_minutes: timeoutMinutes,
        p_business_id: businessId || null,
      });

      if (!error && data) {
        logger.info("reclaim_stuck_queue_jobs", {
          meta: data,
          businessId: businessId || null,
        });
        return data as StuckRecoveryResult;
      }
    } catch (err: any) {
      logger.warn("reclaim_stuck_queue_jobs_fallback", {
        error: err.message,
      });
    }
  }

  // In-memory fallback for unit testing
  const now = Date.now();
  const thresholdMs = timeoutMinutes * 60 * 1000;
  const result: StuckRecoveryResult = {
    timestamp: new Date().toISOString(),
    reclaimed: {
      automation: 0,
      scheduled: 0,
      campaigns: 0,
      crm_reminders: 0,
    },
  };

  for (const [key, job] of mockOperationalJobs.entries()) {
    if (job.status === "processing" && job.locked_at) {
      const lockedTime = new Date(job.locked_at).getTime();
      if (now - lockedTime >= thresholdMs) {
        if (businessId && job.business_id !== businessId) {
          continue;
        }

        const qType: QueueType = job.queueType || "automation";

        // CRITICAL: Check if message was already sent!
        if (job.message_id || job.meta_message_id) {
          job.status = "sent";
          job.locked_at = null;
          job.locked_by = null;
          job.last_error = "Dispatched prior to lock recovery";
        } else if (job.attempts + 1 >= (job.max_attempts || 3)) {
          // Dead-letter: retries exhausted
          job.status = "dead_letter";
          job.attempts = job.attempts + 1;
          job.locked_at = null;
          job.locked_by = null;
          job.last_error = "Max attempts exhausted after stuck processing";
        } else {
          // Transient retry: reset to pending
          job.status = qType === "scheduled" ? "scheduled" : "pending";
          job.attempts = job.attempts + 1;
          job.locked_at = null;
          job.locked_by = null;
          job.last_error = "Reclaimed from stuck lock";
        }

        mockOperationalJobs.set(key, job);
        if (qType === "automation") result.reclaimed.automation++;
        else if (qType === "scheduled") result.reclaimed.scheduled++;
        else if (qType === "campaign") result.reclaimed.campaigns++;
        else if (qType === "crm_reminder") result.reclaimed.crm_reminders++;
      }
    }
  }

  return result;
}

/**
 * Manually retries an eligible failed or dead-letter job.
 * Enforces role restriction (Owner/Admin only) and strict tenant boundary.
 * Guarantees zero duplicate dispatch if already dispatched.
 */
export async function manualRetryJobDb(params: {
  businessId: string;
  queueType: QueueType;
  jobId: string;
  actorUserId: string;
  actorRole: "owner" | "admin" | "agent" | "viewer";
}): Promise<ManualRetryResult> {
  // 1. Role Authorization Check: Only Owner and Admin can retry jobs
  if (params.actorRole !== "owner" && params.actorRole !== "admin") {
    logger.warn("unauthorized_manual_retry_attempt", {
      businessId: params.businessId,
      jobId: params.jobId,
      meta: { actorRole: params.actorRole, actorUserId: params.actorUserId },
    });
    return {
      success: false,
      error: "Forbidden: Only Owner or Admin can manually retry jobs",
    };
  }

  // 2. Database RPC call if connected
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("retry_queue_job", {
        p_business_id: params.businessId,
        p_queue_type: params.queueType,
        p_job_id: params.jobId,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      logger.info("manual_retry_success", {
        businessId: params.businessId,
        jobId: params.jobId,
        meta: { queueType: params.queueType, actorUserId: params.actorUserId },
      });

      return data as ManualRetryResult;
    } catch (err: any) {
      logger.warn("manual_retry_rpc_fallback", { error: err.message });
    }
  }

  // 3. In-memory fallback
  const job = mockOperationalJobs.get(params.jobId);
  if (!job) {
    return {
      success: false,
      error: "Job not found in operational store",
    };
  }

  // Strict tenant validation
  if (job.business_id !== params.businessId) {
    return {
      success: false,
      error: "Cross-tenant access denied: job belongs to another business",
    };
  }

  // Prevent duplicate dispatch
  if (job.message_id || job.meta_message_id || job.status === "sent" || job.status === "completed") {
    return {
      success: false,
      error: "Cannot retry a job that has already been dispatched",
    };
  }

  // Must be in failed or dead_letter state
  if (job.status !== "failed" && job.status !== "dead_letter") {
    return {
      success: false,
      error: `Cannot retry job in status: ${job.status}`,
    };
  }

  // Reset job for retry
  job.status = params.queueType === "scheduled" ? "scheduled" : "pending";
  job.attempts = 0;
  job.locked_at = null;
  job.locked_by = null;
  job.last_error = `Manually requeued by ${params.actorRole} (${params.actorUserId})`;
  job.updated_at = new Date().toISOString();
  mockOperationalJobs.set(params.jobId, job);

  logger.info("manual_retry_job_requeued", {
    businessId: params.businessId,
    jobId: params.jobId,
    meta: { queueType: params.queueType, actorUserId: params.actorUserId },
  });

  return {
    success: true,
    jobId: params.jobId,
    queueType: params.queueType,
    status: "requeued",
  };
}
