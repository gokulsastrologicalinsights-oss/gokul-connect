import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  OperationalDashboardData,
  OperationalActivityItem,
  QueueHealthMetrics,
  WorkerHealthStatus,
  WorkerStatusInfo,
  WorkerType,
} from "@/types/operations";
import { logger } from "./logger";
import { mockOperationalJobs } from "./recovery";

/**
 * ==============================================================================
 * GOKUL CONNECT — CENTRALIZED WORKER HEALTH MONITORING SERVICE
 * ==============================================================================
 * Multi-tenant queue telemetry and worker health aggregator.
 * Guarantees 100% tenant isolation with zero cross-business data leakage.
 * ==============================================================================
 */

// In-memory worker runs store for telemetry tracking (used by coordinator and tests)
export const mockWorkerRuns: Array<{
  id: string;
  businessId: string | null;
  workerName: WorkerType;
  workerId: string;
  status: "started" | "succeeded" | "failed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  reclaimedCount: number;
  skippedCount: number;
  error?: string | null;
}> = [];

export function recordWorkerRunInMemory(run: (typeof mockWorkerRuns)[0]): void {
  mockWorkerRuns.unshift(run);
  if (mockWorkerRuns.length > 100) {
    mockWorkerRuns.pop();
  }
}

export function resetMockWorkerRuns(): void {
  mockWorkerRuns.length = 0;
}

const WORKER_DEFINITIONS: Record<
  WorkerType,
  { displayName: string; description: string }
> = {
  automation_worker: {
    displayName: "Automation Engine Worker",
    description: "Evaluates keyword triggers, business hours, and auto-reply dispatch",
  },
  scheduled_worker: {
    displayName: "Scheduled Messages Worker",
    description: "Dispatches scheduled reminders, templates, and multimedia messages",
  },
  campaign_worker: {
    displayName: "Bulk Campaign Worker",
    description: "Processes CRM audience batches, checks consent, and streams deliveries",
  },
  crm_reminder_worker: {
    displayName: "CRM Follow-up Reminder Worker",
    description: "Monitors due dates and generates internal task alerts for agents",
  },
  notification_worker: {
    displayName: "Notification Dispatch Worker",
    description: "Delivers in-app notifications and preferences-filtered alerts",
  },
  prune_worker: {
    displayName: "Storage Pruning Worker",
    description: "Prunes stale automation execution logs and completed job history",
  },
};

/**
 * Derives overall worker health status based on queue state and last run
 */
function deriveWorkerHealthStatus(
  queue: QueueHealthMetrics,
  lastRun?: { status: string; startedAt: string; error?: string | null }
): WorkerHealthStatus {
  // If stuck jobs are detected, worker is stalled
  if (queue.stuck > 0) {
    return "stalled";
  }

  // If last run failed, worker is degraded
  if (lastRun && lastRun.status === "failed") {
    return "degraded";
  }

  // If retry queue is accumulating failures
  if (queue.failed > 0 || queue.deadLetter > 0) {
    return "degraded";
  }

  // If there are pending/processing jobs and worker executed recently
  if (queue.pending > 0 || queue.processing > 0) {
    return "healthy";
  }

  // If no jobs and no active runs, idle
  return "idle";
}

/**
 * Fetches unified worker health telemetry for a specific business tenant.
 * Uses the database aggregation RPC `get_worker_health_metrics` when connected.
 */
export async function getTenantWorkerHealthSummary(
  businessId: string
): Promise<{
  workers: WorkerStatusInfo[];
  queuesSummary: {
    totalPending: number;
    totalProcessing: number;
    totalRetrying: number;
    totalFailed: number;
    totalDeadLetter: number;
    totalCompleted: number;
    totalStuck: number;
  };
  overallStatus: "healthy" | "degraded" | "critical";
}> {
  if (!businessId) {
    throw new Error("businessId is required to fetch worker health summary");
  }

  let dbData: any = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("get_worker_health_metrics", {
        p_business_id: businessId,
      });

      if (!error && data) {
        dbData = data;
      }
    } catch (err: any) {
      logger.warn("get_worker_health_metrics_rpc_fallback", {
        error: err.message,
        businessId,
      });
    }
  }

  // Queue metrics mapped from DB RPC or computed from in-memory fallback
  const queueMetricsMap: Record<WorkerType, QueueHealthMetrics> = {
    automation_worker: {
      workerType: "automation_worker",
      pending: dbData?.queues?.automation?.pending ?? 0,
      processing: dbData?.queues?.automation?.processing ?? 0,
      retrying: dbData?.queues?.automation?.retrying ?? 0,
      failed: dbData?.queues?.automation?.failed ?? 0,
      deadLetter: dbData?.queues?.automation?.dead_letter ?? 0,
      completed: dbData?.queues?.automation?.completed ?? 0,
      stuck: dbData?.queues?.automation?.stuck ?? 0,
    },
    scheduled_worker: {
      workerType: "scheduled_worker",
      pending: dbData?.queues?.scheduled?.pending ?? 0,
      processing: dbData?.queues?.scheduled?.processing ?? 0,
      retrying: dbData?.queues?.scheduled?.retrying ?? 0,
      failed: dbData?.queues?.scheduled?.failed ?? 0,
      deadLetter: dbData?.queues?.scheduled?.dead_letter ?? 0,
      completed: dbData?.queues?.scheduled?.completed ?? 0,
      stuck: dbData?.queues?.scheduled?.stuck ?? 0,
    },
    campaign_worker: {
      workerType: "campaign_worker",
      pending: dbData?.queues?.campaigns?.pending ?? 0,
      processing: dbData?.queues?.campaigns?.processing ?? 0,
      retrying: dbData?.queues?.campaigns?.retrying ?? 0,
      failed: dbData?.queues?.campaigns?.failed ?? 0,
      deadLetter: dbData?.queues?.campaigns?.dead_letter ?? 0,
      completed: dbData?.queues?.campaigns?.completed ?? 0,
      stuck: dbData?.queues?.campaigns?.stuck ?? 0,
    },
    crm_reminder_worker: {
      workerType: "crm_reminder_worker",
      pending: dbData?.queues?.crm_reminders?.pending ?? 0,
      processing: dbData?.queues?.crm_reminders?.processing ?? 0,
      retrying: dbData?.queues?.crm_reminders?.retrying ?? 0,
      failed: dbData?.queues?.crm_reminders?.failed ?? 0,
      deadLetter: dbData?.queues?.crm_reminders?.dead_letter ?? 0,
      completed: dbData?.queues?.crm_reminders?.completed ?? 0,
      stuck: dbData?.queues?.crm_reminders?.stuck ?? 0,
    },
    notification_worker: {
      workerType: "notification_worker",
      pending: 0,
      processing: 0,
      retrying: 0,
      failed: 0,
      deadLetter: 0,
      completed: 0,
      stuck: 0,
    },
    prune_worker: {
      workerType: "prune_worker",
      pending: 0,
      processing: 0,
      retrying: 0,
      failed: 0,
      deadLetter: 0,
      completed: 0,
      stuck: 0,
    },
  };

  // If DB was not available, compute from in-memory mock store
  if (!dbData) {
    for (const job of mockOperationalJobs.values()) {
      if (job.business_id && job.business_id !== businessId) {
        continue;
      }
      const wType: WorkerType =
        job.workerType ||
        (job.queueType === "scheduled"
          ? "scheduled_worker"
          : job.queueType === "campaign"
          ? "campaign_worker"
          : job.queueType === "crm_reminder"
          ? "crm_reminder_worker"
          : "automation_worker");

      const q = queueMetricsMap[wType];
      if (q) {
        if (job.status === "pending") {
          if (job.attempts > 0 || job.retry_count > 0) q.retrying++;
          else q.pending++;
        } else if (job.status === "processing") {
          const isStuck =
            job.locked_at &&
            Date.now() - new Date(job.locked_at).getTime() > 5 * 60 * 1000;
          if (isStuck) q.stuck++;
          q.processing++;
        } else if (job.status === "failed") {
          q.failed++;
        } else if (job.status === "dead_letter") {
          q.deadLetter++;
        } else if (["completed", "sent", "delivered", "read"].includes(job.status)) {
          q.completed++;
        }
      }
    }
  }

  // Get recent worker runs for this tenant
  const tenantRuns = mockWorkerRuns.filter(
    (r) => r.businessId === null || r.businessId === businessId
  );

  const workersList: WorkerType[] = [
    "automation_worker",
    "scheduled_worker",
    "campaign_worker",
    "crm_reminder_worker",
    "notification_worker",
  ];

  const workers: WorkerStatusInfo[] = workersList.map((wType) => {
    const queue = queueMetricsMap[wType];
    const def = WORKER_DEFINITIONS[wType];
    const runs = tenantRuns.filter((r) => r.workerName === wType);
    const lastRun = runs[0];
    const successfulRuns = runs.filter((r) => r.status === "succeeded");
    const lastSuccess = successfulRuns[0];

    const totalDuration = runs.reduce((acc, r) => acc + (r.durationMs || 0), 0);
    const avgDuration = runs.length > 0 ? Math.round(totalDuration / runs.length) : 0;

    const status = deriveWorkerHealthStatus(queue, lastRun);

    return {
      workerType: wType,
      displayName: def.displayName,
      description: def.description,
      status,
      lastRunAt: lastRun?.startedAt || null,
      lastSuccessAt: lastSuccess?.completedAt || null,
      lastWorkerId: lastRun?.workerId || null,
      lastError: lastRun?.error ? String(lastRun.error) : null,
      avgDurationMs: avgDuration,
      queue,
    };
  });

  const queuesSummary = {
    totalPending: workers.reduce((acc, w) => acc + w.queue.pending, 0),
    totalProcessing: workers.reduce((acc, w) => acc + w.queue.processing, 0),
    totalRetrying: workers.reduce((acc, w) => acc + w.queue.retrying, 0),
    totalFailed: workers.reduce((acc, w) => acc + w.queue.failed, 0),
    totalDeadLetter: workers.reduce((acc, w) => acc + w.queue.deadLetter, 0),
    totalCompleted: workers.reduce((acc, w) => acc + w.queue.completed, 0),
    totalStuck: workers.reduce((acc, w) => acc + w.queue.stuck, 0),
  };

  let overallStatus: "healthy" | "degraded" | "critical" = "healthy";
  if (queuesSummary.totalStuck > 0) {
    overallStatus = "critical";
  } else if (queuesSummary.totalFailed > 0 || queuesSummary.totalDeadLetter > 0) {
    overallStatus = "degraded";
  }

  return {
    workers,
    queuesSummary,
    overallStatus,
  };
}

/**
 * Generates recent operational activity items for the dashboard
 */
export async function getRecentOperationalActivity(
  businessId: string,
  limit: number = 20
): Promise<OperationalActivityItem[]> {
  const items: OperationalActivityItem[] = [];

  // 1. Worker runs
  const tenantRuns = mockWorkerRuns
    .filter((r) => r.businessId === null || r.businessId === businessId)
    .slice(0, limit);

  for (const run of tenantRuns) {
    items.push({
      id: run.id,
      timestamp: run.startedAt,
      workerType: run.workerName,
      type: "worker_run",
      status: run.status === "succeeded" ? "success" : run.status === "failed" ? "error" : "info",
      summary: `${WORKER_DEFINITIONS[run.workerName]?.displayName || run.workerName} executed`,
      details: run.status === "failed" ? run.error || undefined : `Processed: ${run.processedCount}, Succeeded: ${run.succeededCount}`,
      durationMs: run.durationMs,
    });
  }

  // 2. Failed / Stuck jobs from store
  for (const [id, job] of mockOperationalJobs.entries()) {
    if (job.business_id && job.business_id !== businessId) continue;

    if (job.status === "dead_letter" || (job.status === "failed" && job.attempts >= (job.max_attempts || 3))) {
      items.push({
        id: `dead_${id}`,
        timestamp: job.updated_at || new Date().toISOString(),
        workerType: job.workerType || "automation_worker",
        type: "dead_letter",
        status: "error",
        summary: `Job ${id.slice(0, 8)}... permanently failed (Dead Letter)`,
        details: job.last_error,
        jobId: id,
        queueType: job.queueType || "automation",
        payloadPreview: job.payload ? JSON.stringify(job.payload).slice(0, 50) : undefined,
        isRetryable: true,
      });
    } else if (job.status === "processing" && job.locked_at && Date.now() - new Date(job.locked_at).getTime() > 5 * 60 * 1000) {
      items.push({
        id: `stuck_${id}`,
        timestamp: job.locked_at,
        workerType: job.workerType || "automation_worker",
        type: "stuck_job_alert",
        status: "warning",
        summary: `Job ${id.slice(0, 8)}... is stuck in processing`,
        details: `Locked since ${job.locked_at}`,
        jobId: id,
        queueType: job.queueType || "automation",
      });
    }
  }

  // Sort by timestamp descending and slice
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, limit);
}
