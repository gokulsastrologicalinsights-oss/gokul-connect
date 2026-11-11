/**
 * In-Memory Sliding Window Rate Limiter
 *
 * Implements server-side rate limiting for:
 * - Login attempts (brute-force defense)
 * - Outbound WhatsApp message dispatch
 * - Sensitive workspace mutations (connection additions, secret updates)
 * - Public API endpoints (webhooks handshake and invalid signature flood defense)
 *
 * Zero external paid dependencies. Sub-millisecond performance.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in ms
  retryAfterSeconds: number;
}

interface WindowBucket {
  timestamps: number[];
  blockedUntil?: number;
}

export class InMemoryRateLimiter {
  private buckets = new Map<string, WindowBucket>();
  private lastPruneTime = Date.now();
  private readonly pruneIntervalMs = 60_000; // prune every 60s

  public check(
    key: string,
    limit: number,
    windowMs: number,
    blockDurationMs?: number
  ): RateLimitResult {
    const now = Date.now();
    this.maybePrune(now);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Check if explicitly blocked
    if (bucket.blockedUntil && bucket.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
      return {
        success: false,
        limit,
        remaining: 0,
        resetAt: bucket.blockedUntil,
        retryAfterSeconds,
      };
    }

    // Filter out timestamps outside current sliding window
    const windowStart = now - windowMs;
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    if (bucket.timestamps.length >= limit) {
      const oldestInWindow = bucket.timestamps[0];
      const resetAt = oldestInWindow + windowMs;
      if (blockDurationMs) {
        bucket.blockedUntil = now + blockDurationMs;
      }
      const retryAfterSeconds = Math.ceil(((bucket.blockedUntil || resetAt) - now) / 1000);

      return {
        success: false,
        limit,
        remaining: 0,
        resetAt: bucket.blockedUntil || resetAt,
        retryAfterSeconds,
      };
    }

    // Record this attempt
    bucket.timestamps.push(now);
    const oldestInWindow = bucket.timestamps[0];
    const resetAt = oldestInWindow + windowMs;

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - bucket.timestamps.length),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  public reset(key: string): void {
    this.buckets.delete(key);
  }

  public clear(): void {
    this.buckets.clear();
  }

  private maybePrune(now: number): void {
    if (now - this.lastPruneTime < this.pruneIntervalMs) return;
    this.lastPruneTime = now;

    const expiryThreshold = now - 300_000; // prune records older than 5 min
    for (const [key, bucket] of this.buckets.entries()) {
      if (
        (!bucket.blockedUntil || bucket.blockedUntil < now) &&
        (bucket.timestamps.length === 0 || bucket.timestamps[bucket.timestamps.length - 1] < expiryThreshold)
      ) {
        this.buckets.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new InMemoryRateLimiter();

/**
 * Login Rate Limiter: 5 attempts per 60 seconds per identifier (IP / Email).
 * Blocks further attempts for 60 seconds once threshold is breached.
 */
export function rateLimitLogin(identifier: string): RateLimitResult {
  return globalRateLimiter.check(`login:${identifier}`, 5, 60_000, 60_000);
}

/**
 * Outbound WhatsApp Dispatch Limiter: 30 messages per 60 seconds per business tenant.
 */
export function rateLimitOutboundMessages(businessId: string): RateLimitResult {
  return globalRateLimiter.check(`outbound:${businessId}`, 30, 60_000);
}

/**
 * Sensitive Workspace Action Limiter: 15 mutations per 60 seconds per business tenant.
 */
export function rateLimitSensitiveAction(businessId: string, actionName: string): RateLimitResult {
  return globalRateLimiter.check(`sensitive:${businessId}:${actionName}`, 15, 60_000);
}

/**
 * Public Webhook Handshake GET Limiter: 30 requests per 60 seconds per IP.
 */
export function rateLimitWebhookHandshake(clientIp: string): RateLimitResult {
  return globalRateLimiter.check(`webhook_get:${clientIp}`, 30, 60_000);
}

/**
 * Invalid Webhook Signature Limiter: 10 failed signatures per 60 seconds per IP.
 * Blocks IP for 5 minutes (300,000ms) to throttle brute-force or malicious scanning.
 */
export function rateLimitInvalidWebhookSignatures(clientIp: string): RateLimitResult {
  return globalRateLimiter.check(`webhook_bad_sig:${clientIp}`, 10, 60_000, 300_000);
}

/**
 * Resolve client IP address safely from standard proxy headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}
