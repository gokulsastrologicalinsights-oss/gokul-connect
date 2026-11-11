import { ClassifiedError, ErrorSeverity } from "@/types/operations";
import { sanitizeLogData } from "./logger";

/**
 * ==============================================================================
 * GOKUL CONNECT — ERROR CLASSIFIER & RETRY ENGINE
 * ==============================================================================
 * Categorizes background worker and dispatch errors into Transient vs Permanent,
 * determines retryability, and computes bounded exponential backoff with jitter.
 * ==============================================================================
 */

export const KNOWN_ERROR_CODES = {
  // Transient Errors (Eligible for automated retry)
  RATE_LIMIT_429: "RATE_LIMIT_429",
  META_RATE_LIMIT: "META_RATE_LIMIT",
  SERVER_ERROR_5XX: "SERVER_ERROR_5XX",
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  DB_LOCK_TIMEOUT: "DB_LOCK_TIMEOUT",
  DB_DEADLOCK: "DB_DEADLOCK",
  TEMPORARY_SERVICE_UNAVAILABLE: "TEMPORARY_SERVICE_UNAVAILABLE",

  // Permanent Errors (Dead-Letter immediately, no automated retry)
  INVALID_PHONE_NUMBER: "INVALID_PHONE_NUMBER",
  CONTACT_OPTED_OUT: "CONTACT_OPTED_OUT",
  CONTACT_BLOCKED: "CONTACT_BLOCKED",
  TEMPLATE_REJECTED_OR_MISSING: "TEMPLATE_REJECTED_OR_MISSING",
  CUSTOMER_WINDOW_EXPIRED: "CUSTOMER_WINDOW_EXPIRED",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  UNREGISTERED_PHONE_NUMBER: "UNREGISTERED_PHONE_NUMBER",
  MESSAGE_UNDELIVERABLE: "MESSAGE_UNDELIVERABLE",
  RETRY_LIMIT_EXHAUSTED: "RETRY_LIMIT_EXHAUSTED",
  PERMANENT_SCHEMA_ERROR: "PERMANENT_SCHEMA_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

/**
 * Classifies an error into transient or permanent
 */
export function classifyError(error: any): ClassifiedError {
  const rawMessage = typeof error === "string" ? error : error?.message || error?.error || "Unknown error";
  const sanitizedMessage = sanitizeLogData(rawMessage);
  const status = error?.status || error?.statusCode || error?.code;
  const msgLower = rawMessage.toLowerCase();

  // 1. Permanent: Opt-out & Blocking
  if (msgLower.includes("opted_out") || msgLower.includes("opt-out") || msgLower.includes("withdrawn consent")) {
    return {
      classification: "permanent",
      errorCode: KNOWN_ERROR_CODES.CONTACT_OPTED_OUT,
      sanitizedMessage,
      isRetryable: false,
    };
  }

  if (msgLower.includes("blocked") || msgLower.includes("contact is blocked")) {
    return {
      classification: "permanent",
      errorCode: KNOWN_ERROR_CODES.CONTACT_BLOCKED,
      sanitizedMessage,
      isRetryable: false,
    };
  }

  // 2. Permanent: WhatsApp 24-hour customer service window
  if (
    msgLower.includes("24 hour") ||
    msgLower.includes("24h window") ||
    msgLower.includes("service window closed") ||
    msgLower.includes("131026")
  ) {
    return {
      classification: "permanent",
      errorCode: KNOWN_ERROR_CODES.CUSTOMER_WINDOW_EXPIRED,
      sanitizedMessage,
      isRetryable: false,
    };
  }

  // 3. Permanent: Template rejected, disabled, or not found
  if (
    msgLower.includes("template") &&
    (msgLower.includes("not found") ||
      msgLower.includes("rejected") ||
      msgLower.includes("disabled") ||
      msgLower.includes("131047") ||
      msgLower.includes("132001"))
  ) {
    return {
      classification: "permanent",
      errorCode: KNOWN_ERROR_CODES.TEMPLATE_REJECTED_OR_MISSING,
      sanitizedMessage,
      isRetryable: false,
    };
  }

  // 4. Permanent: Invalid phone number
  if (
    msgLower.includes("invalid phone") ||
    msgLower.includes("invalid recipient") ||
    msgLower.includes("131030") ||
    msgLower.includes("131021") ||
    msgLower.includes("not a valid whatsapp user")
  ) {
    return {
      classification: "permanent",
      errorCode: KNOWN_ERROR_CODES.INVALID_PHONE_NUMBER,
      sanitizedMessage,
      isRetryable: false,
    };
  }

  // 5. Permanent: Meta App / Token Authentication failure (cannot be solved by automated retries without token refresh)
  if (
    status === 401 ||
    msgLower.includes("oauthexception") ||
    msgLower.includes("token expired") ||
    msgLower.includes("session invalid") ||
    msgLower.includes("error validating access token") ||
    msgLower.includes("subcode 463")
  ) {
    return {
      classification: "permanent",
      errorCode: KNOWN_ERROR_CODES.AUTHENTICATION_FAILED,
      sanitizedMessage,
      isRetryable: false,
    };
  }

  // 6. Transient: Rate limiting (HTTP 429, Meta error 131056 / 80007 / 4)
  if (
    status === 429 ||
    msgLower.includes("rate limit") ||
    msgLower.includes("too many requests") ||
    msgLower.includes("131056") ||
    msgLower.includes("80007")
  ) {
    return {
      classification: "transient",
      errorCode: KNOWN_ERROR_CODES.RATE_LIMIT_429,
      sanitizedMessage,
      isRetryable: true,
      recommendedDelaySec: 60,
    };
  }

  // 7. Transient: Network timeout, gateway timeout, socket hangup
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msgLower.includes("timeout") ||
    msgLower.includes("etimedout") ||
    msgLower.includes("econnreset") ||
    msgLower.includes("socket hang up") ||
    msgLower.includes("network error")
  ) {
    return {
      classification: "transient",
      errorCode: KNOWN_ERROR_CODES.NETWORK_TIMEOUT,
      sanitizedMessage,
      isRetryable: true,
      recommendedDelaySec: 30,
    };
  }

  // 8. Transient: DB lock or concurrency timeout
  if (
    msgLower.includes("lock timeout") ||
    msgLower.includes("deadlock detected") ||
    msgLower.includes("serialization failure")
  ) {
    return {
      classification: "transient",
      errorCode: KNOWN_ERROR_CODES.DB_LOCK_TIMEOUT,
      sanitizedMessage,
      isRetryable: true,
      recommendedDelaySec: 15,
    };
  }

  // 9. Transient: Server 500 error
  if (status === 500 || msgLower.includes("internal server error")) {
    return {
      classification: "transient",
      errorCode: KNOWN_ERROR_CODES.SERVER_ERROR_5XX,
      sanitizedMessage,
      isRetryable: true,
      recommendedDelaySec: 30,
    };
  }

  // Default: Treat unknown errors as transient up to bounded max retry limit
  return {
    classification: "transient",
    errorCode: KNOWN_ERROR_CODES.UNKNOWN_ERROR,
    sanitizedMessage,
    isRetryable: true,
    recommendedDelaySec: 30,
  };
}

/**
 * Calculates exponential backoff with jitter:
 * delay = min(baseSec * 2^attempts + jitter, maxSec)
 */
export function calculateBoundedBackoff(
  attempts: number,
  baseSec: number = 30,
  maxSec: number = 1800
): number {
  const safeAttempts = Math.max(0, attempts);
  const exponential = Math.pow(2, safeAttempts) * baseSec;
  const jitter = Math.floor(Math.random() * 5);
  return Math.min(exponential + jitter, maxSec);
}
