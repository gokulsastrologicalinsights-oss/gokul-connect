import crypto from "crypto";

/**
 * ==============================================================================
 * GOKUL CONNECT — STRUCTURED OBSERVABILITY LOGGER
 * ==============================================================================
 * Standardized JSON logging, correlation ID tracking, and strict secret
 * and PII sanitization across all worker and cron execution paths.
 * ==============================================================================
 */

export interface StructuredLogPayload {
  timestamp?: string;
  level: "info" | "warn" | "error" | "debug";
  service?: string;
  workerName?: string;
  correlationId?: string;
  businessId?: string | null;
  jobId?: string | null;
  action?: string;
  status?: string;
  attempt?: number;
  maxAttempts?: number;
  durationMs?: number;
  errorCode?: string;
  error?: string | null;
  meta?: Record<string, any>;
}

/**
 * Redacts secrets, tokens, connection strings, auth headers, and customer messages.
 */
export function sanitizeLogData(input: any): any {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.trim())) {
      return input;
    }

    let sanitized = input
      // Redact Bearer tokens
      .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
      // Redact Postgres / DB connection strings
      .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, "$1[REDACTED]$2")
      // Redact keys, passwords, secrets, tokens
      .replace(/(secret|token|password|key|auth|api_key|access_token|app_secret)\s*[:=]\s*['"]?[^\s'",;]+['"]?/gi, "$1=[REDACTED]");

    // Redact 13-16 digit credit card numbers, but ignore standard UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitized)) {
      sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,16}\b/g, (match) => {
        // Double check not part of a hyphenated UUID
        return match.includes("-") && match.length > 16 ? match : "[REDACTED_NUM]";
      });
    }

    return sanitized;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeLogData(item));
  }

  if (typeof input === "object") {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      // Mask sensitive keys completely
      if (
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("password") ||
        lowerKey.includes("key") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("credential")
      ) {
        sanitizedObj[key] = "[REDACTED]";
      } else if (lowerKey.includes("content") || lowerKey.includes("message_body")) {
        // Redact customer message content to safe preview
        if (typeof value === "string") {
          sanitizedObj[key] = value.length > 20 ? `${value.slice(0, 10)}...[TRUNCATED]` : "[MESSAGE_CONTENT]";
        } else {
          sanitizedObj[key] = "[MESSAGE_CONTENT]";
        }
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj;
  }

  return input;
}

/**
 * Generates or extracts a correlation ID
 */
export function generateCorrelationId(prefix: string = "corr"): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

class ObservabilityLogger {
  private serviceName: string = "gokul-connect";

  private emit(payload: StructuredLogPayload): void {
    const logEntry = {
      timestamp: payload.timestamp || new Date().toISOString(),
      service: payload.service || this.serviceName,
      level: payload.level,
      correlationId: payload.correlationId || generateCorrelationId(),
      workerName: payload.workerName,
      businessId: payload.businessId,
      jobId: payload.jobId,
      action: payload.action,
      status: payload.status,
      attempt: payload.attempt,
      maxAttempts: payload.maxAttempts,
      durationMs: payload.durationMs,
      errorCode: payload.errorCode,
      error: payload.error ? sanitizeLogData(payload.error) : undefined,
      meta: payload.meta ? sanitizeLogData(payload.meta) : undefined,
    };

    const serialized = JSON.stringify(logEntry);

    switch (payload.level) {
      case "error":
        console.error(serialized);
        break;
      case "warn":
        console.warn(serialized);
        break;
      case "debug":
        console.debug(serialized);
        break;
      case "info":
      default:
        console.log(serialized);
        break;
    }
  }

  info(action: string, payload: Omit<StructuredLogPayload, "level" | "action">): void {
    this.emit({ ...payload, level: "info", action });
  }

  warn(action: string, payload: Omit<StructuredLogPayload, "level" | "action">): void {
    this.emit({ ...payload, level: "warn", action });
  }

  error(action: string, payload: Omit<StructuredLogPayload, "level" | "action">): void {
    this.emit({ ...payload, level: "error", action });
  }

  logWorkerRun(data: {
    workerName: string;
    workerId: string;
    correlationId?: string;
    businessId?: string | null;
    status: "started" | "succeeded" | "failed" | "skipped";
    durationMs?: number;
    claimedCount?: number;
    processedCount?: number;
    succeededCount?: number;
    failedCount?: number;
    reclaimedCount?: number;
    skippedCount?: number;
    errorCode?: string;
    error?: string | null;
    meta?: Record<string, any>;
  }): void {
    const level = data.status === "failed" ? "error" : data.status === "skipped" ? "warn" : "info";
    this.emit({
      level,
      action: `worker_run_${data.status}`,
      workerName: data.workerName,
      correlationId: data.correlationId || data.workerId,
      businessId: data.businessId,
      durationMs: data.durationMs,
      status: data.status,
      errorCode: data.errorCode,
      error: data.error,
      meta: {
        workerId: data.workerId,
        claimed: data.claimedCount ?? 0,
        processed: data.processedCount ?? 0,
        succeeded: data.succeededCount ?? 0,
        failed: data.failedCount ?? 0,
        reclaimed: data.reclaimedCount ?? 0,
        skipped: data.skippedCount ?? 0,
        ...data.meta,
      },
    });
  }

  logJobEvent(data: {
    workerName: string;
    jobId: string;
    correlationId?: string;
    businessId?: string | null;
    action: string;
    status: string;
    attempt?: number;
    maxAttempts?: number;
    durationMs?: number;
    errorCode?: string;
    error?: string | null;
    meta?: Record<string, any>;
  }): void {
    const level = data.status.includes("fail") || data.status === "dead_letter" ? "error" : "info";
    this.emit({
      level,
      action: data.action,
      workerName: data.workerName,
      jobId: data.jobId,
      correlationId: data.correlationId,
      businessId: data.businessId,
      status: data.status,
      attempt: data.attempt,
      maxAttempts: data.maxAttempts,
      durationMs: data.durationMs,
      errorCode: data.errorCode,
      error: data.error,
      meta: data.meta,
    });
  }
}

export const logger = new ObservabilityLogger();
