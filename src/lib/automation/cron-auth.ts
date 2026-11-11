import crypto from "crypto";

/**
 * Validates the Authorization Bearer header against the configured CRON_SECRET.
 *
 * Requirements:
 * 1. If CRON_SECRET is missing or empty, fail-closed (returns false).
 * 2. Requires the exact format `Bearer <token>`.
 * 3. Uses constant-time SHA-256 buffer comparison via `crypto.timingSafeEqual`
 *    to prevent timing side-channel attacks and buffer length leakages.
 * 4. Never exposes the secret or authorization content in logs or errors.
 */
export function verifyCronAuthorization(
  authHeader: string | null | undefined,
  cronSecret: string | undefined
): boolean {
  // Fail-closed if cron secret is missing, not a string, or empty/whitespace
  if (!cronSecret || typeof cronSecret !== "string" || cronSecret.trim().length === 0) {
    return false;
  }

  // Require presence of auth header
  if (!authHeader || typeof authHeader !== "string") {
    return false;
  }

  // Require exact Bearer prefix
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  if (token.trim().length === 0) {
    return false;
  }

  const expectedHeader = `Bearer ${cronSecret}`;

  // Hash both inputs with SHA-256 to ensure identical 32-byte buffers for timingSafeEqual,
  // preventing length leakage and eliminating buffer length mismatch exceptions.
  const authHash = crypto.createHash("sha256").update(authHeader).digest();
  const expectedHash = crypto.createHash("sha256").update(expectedHeader).digest();

  try {
    return crypto.timingSafeEqual(authHash, expectedHash);
  } catch {
    return false;
  }
}
