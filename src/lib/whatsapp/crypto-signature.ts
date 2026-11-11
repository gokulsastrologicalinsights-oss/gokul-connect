import crypto from "crypto";

/**
 * Verify Meta Webhook HMAC-SHA256 Signature
 * Meta sends `X-Hub-Signature-256: sha256=<hash>`
 *
 * Uses timing-safe comparison to prevent side-channel timing attacks.
 */
export function verifyMetaWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedHash = parts[1];
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const actualHash = hmac.digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedHash, "utf8");
    const actualBuffer = Buffer.from(actualHash, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
