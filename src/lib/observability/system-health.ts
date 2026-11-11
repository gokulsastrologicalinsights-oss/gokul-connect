import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto/encryption";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";
import { logger } from "./logger";

/**
 * ==============================================================================
 * GOKUL CONNECT — SYSTEM HEALTH & READINESS SERVICE
 * ==============================================================================
 * Provides liveness, readiness, and background worker operational probes.
 * Public endpoints return sanitized high-level statuses; authorized admin callers
 * receive diagnostic telemetry without exposing secrets or connection URLs.
 * ==============================================================================
 */

export interface HealthCheckResult {
  status: "ok" | "degraded" | "unready";
  timestamp: string;
  uptimeSeconds: number;
  checks?: Record<string, { status: "pass" | "warn" | "fail"; message?: string; latencyMs?: number }>;
}

/**
 * Liveness probe: verifies Node.js process is active and responsive.
 * Lightweight, zero database overhead.
 */
export function checkLiveness(): {
  status: "ok";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
} {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  };
}

/**
 * Readiness probe: verifies application dependencies (Database, Schema, Queues, Encryption, Env).
 */
export async function checkReadiness(isAuthorizedAdmin: boolean = false): Promise<{
  status: "ready" | "degraded" | "unready";
  statusCode: number;
  data: Record<string, any>;
}> {
  const startTime = Date.now();
  const checks: Record<string, { status: "pass" | "warn" | "fail"; message?: string; latencyMs?: number }> = {};
  let overallStatus: "ready" | "degraded" | "unready" = "ready";

  // 1. Environment Configuration Check
  const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const missingEnv = requiredEnv.filter((key) => !process.env[key] || process.env[key]?.trim() === "");

  if (missingEnv.length > 0) {
    checks.environment = {
      status: "fail",
      message: `Missing required environment configuration: ${missingEnv.join(", ")}`,
    };
    overallStatus = "unready";
  } else {
    checks.environment = { status: "pass" };
  }

  // 2. Encryption Engine Check (AES-256-GCM Roundtrip)
  try {
    const encStart = Date.now();
    const testSecret = "health_check_probe_secret";
    const encrypted = encryptSecret(testSecret);
    const decrypted = decryptSecret(encrypted);

    if (decrypted === testSecret) {
      checks.encryption = {
        status: "pass",
        latencyMs: Date.now() - encStart,
      };
    } else {
      checks.encryption = {
        status: "fail",
        message: "Encryption engine failed roundtrip validation",
      };
      overallStatus = "unready";
    }
  } catch (err: any) {
    checks.encryption = {
      status: "fail",
      message: "Encryption key unconfigured or invalid",
    };
    overallStatus = "unready";
  }

  // 3. Database Connectivity & Schema Readiness
  if (isSupabaseConfigured()) {
    try {
      const dbStart = Date.now();
      const supabase = createAdminClient();
      const { data, error } = await supabase.from("businesses").select("id").limit(1);

      if (error) {
        checks.database = {
          status: "fail",
          message: "Database query failed",
          latencyMs: Date.now() - dbStart,
        };
        overallStatus = "unready";
      } else {
        checks.database = {
          status: "pass",
          latencyMs: Date.now() - dbStart,
        };
      }
    } catch (err: any) {
      checks.database = {
        status: "fail",
        message: "Failed to connect to database",
      };
      overallStatus = "unready";
    }
  } else {
    checks.database = {
      status: "warn",
      message: "Supabase credentials not configured in local environment",
    };
    // Non-fatal in offline dev mode, but marked degraded
    if (overallStatus === "ready") overallStatus = "degraded";
  }

  // 4. Background Queue Availability
  if (isSupabaseConfigured() && checks.database?.status === "pass") {
    try {
      const qStart = Date.now();
      const supabase = createAdminClient();
      const { error } = await supabase.from("wa_processing_jobs").select("id").limit(1);

      if (error) {
        checks.queues = {
          status: "warn",
          message: "Queue tables query error",
          latencyMs: Date.now() - qStart,
        };
        if (overallStatus === "ready") overallStatus = "degraded";
      } else {
        checks.queues = {
          status: "pass",
          latencyMs: Date.now() - qStart,
        };
      }
    } catch {
      checks.queues = { status: "warn", message: "Queue availability check timed out" };
      if (overallStatus === "ready") overallStatus = "degraded";
    }
  }

  const statusCode = overallStatus === "unready" ? 503 : 200;

  // Sanitized public payload vs authorized diagnostic payload
  if (!isAuthorizedAdmin) {
    return {
      status: overallStatus,
      statusCode,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  return {
    status: overallStatus,
    statusCode,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      totalLatencyMs: Date.now() - startTime,
      checks,
    },
  };
}

/**
 * Worker health probe: verifies background queue processing capabilities and scheduler setup.
 */
export async function checkWorkersHealth(isAuthorizedAdmin: boolean = false): Promise<{
  status: "healthy" | "degraded" | "stalled";
  statusCode: number;
  data: Record<string, any>;
}> {
  const cronSecret = process.env.CRON_SECRET;
  const isCronConfigured = Boolean(cronSecret && cronSecret.trim().length > 0);

  let status: "healthy" | "degraded" | "stalled" = "healthy";
  const checks: Record<string, any> = {
    cronSchedulerAuth: {
      status: isCronConfigured ? "pass" : "warn",
      configured: isCronConfigured,
    },
  };

  if (!isCronConfigured) {
    status = "degraded";
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Check for stuck jobs
      const { data: stuckJobs } = await supabase
        .from("wa_processing_jobs")
        .select("id")
        .eq("status", "processing")
        .lt("locked_at", threshold)
        .limit(5);

      const stuckCount = stuckJobs?.length || 0;
      checks.stuckJobs = {
        count: stuckCount,
        status: stuckCount > 0 ? "fail" : "pass",
      };

      if (stuckCount > 0) {
        status = "stalled";
      }
    } catch {
      checks.queueHealth = { status: "warn", message: "Queue inspection check skipped" };
    }
  }

  const statusCode = status === "stalled" ? 503 : 200;

  if (!isAuthorizedAdmin) {
    return {
      status,
      statusCode,
      data: {
        status,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    status,
    statusCode,
    data: {
      status,
      timestamp: new Date().toISOString(),
      checks,
    },
  };
}
