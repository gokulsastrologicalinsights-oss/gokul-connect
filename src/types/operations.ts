/**
-- ==============================================================================
-- GOKUL CONNECT — OPERATIONAL RELIABILITY & WORKER TYPES
-- ==============================================================================
-- Strict multi-tenant operational monitoring, failure classification,
-- and queue health telemetry definitions.
-- ==============================================================================
*/

export type WorkerType =
  | "automation_worker"
  | "scheduled_worker"
  | "campaign_worker"
  | "crm_reminder_worker"
  | "notification_worker"
  | "prune_worker";

export type QueueType =
  | "automation"
  | "scheduled"
  | "campaign"
  | "crm_reminder"
  | "notification";

export type JobStatus =
  | "pending"
  | "processing"
  | "retrying"
  | "failed"
  | "dead_letter"
  | "completed"
  | "sent"
  | "delivered"
  | "read"
  | "skipped"
  | "cancelled";

export type WorkerRunStatus = "started" | "succeeded" | "failed" | "partial" | "skipped";

export type WorkerHealthStatus = "healthy" | "degraded" | "stalled" | "idle";

export interface QueueHealthMetrics {
  workerType: WorkerType;
  pending: number;
  processing: number;
  retrying: number;
  failed: number;
  deadLetter: number;
  completed: number;
  stuck: number;
}

export interface WorkerStatusInfo {
  workerType: WorkerType;
  displayName: string;
  description: string;
  status: WorkerHealthStatus;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastWorkerId: string | null;
  lastError: string | null;
  avgDurationMs: number;
  queue: QueueHealthMetrics;
}

export interface OperationalActivityItem {
  id: string;
  timestamp: string;
  workerType: WorkerType;
  type: "worker_run" | "job_failure" | "stuck_job_alert" | "dead_letter" | "manual_retry";
  status: "success" | "warning" | "error" | "info";
  summary: string;
  details?: string;
  durationMs?: number;
  jobId?: string;
  queueType?: QueueType;
  payloadPreview?: string;
  isRetryable?: boolean;
}

export interface OperationalDashboardData {
  businessId: string;
  businessSlug: string;
  userRole: "owner" | "admin" | "agent" | "viewer";
  canManageOperations: boolean;
  timestamp: string;
  overallStatus: "healthy" | "degraded" | "critical";
  queuesSummary: {
    totalPending: number;
    totalProcessing: number;
    totalRetrying: number;
    totalFailed: number;
    totalDeadLetter: number;
    totalCompleted: number;
    totalStuck: number;
  };
  workers: WorkerStatusInfo[];
  recentActivity: OperationalActivityItem[];
}

export type ErrorSeverity = "transient" | "permanent";

export interface ClassifiedError {
  classification: ErrorSeverity;
  errorCode: string;
  sanitizedMessage: string;
  isRetryable: boolean;
  recommendedDelaySec?: number;
}

export interface WorkerExecutionRunRecord {
  id: string;
  business_id: string | null;
  worker_name: WorkerType;
  worker_id: string;
  status: WorkerRunStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  claimed_count: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  reclaimed_count: number;
  skipped_count: number;
  error_message: string | null;
  error_code: string | null;
  metadata: Record<string, any>;
  created_at: string;
}
