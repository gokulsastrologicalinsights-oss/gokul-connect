import crypto from "crypto";

/**
 * Standard encrypted secret payload matching the planned dedicated Supabase
 * public.wa_credentials schema.
 */
export interface EncryptedSecretPayload {
  key_version: string;
  iv: string;        // 12 bytes hex
  auth_tag: string;  // 16 bytes hex
  ciphertext: string;// AES-256-GCM encrypted ciphertext in hex
}

/**
 * Metadata for tracking encrypted credentials without exposing secrets.
 */
export interface CredentialMetadata {
  credential_ref: string;
  key_version: string;
  algorithm: "AES-256-GCM";
  created_at: string;
  updated_at: string;
}

// Default development key seed. In production, this MUST be set via process.env.APP_ENCRYPTION_SECRET (32 bytes).
const DEV_KEY_SEED = "gokul_connect_dev_master_key_32bytes!!";

function getMasterKey(version: string = "v1"): Buffer {
  const envKey = process.env.APP_ENCRYPTION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // Production Guard (SEC-LOW-02): Fail-closed if encryption secret is missing, empty, or insecure
  if (isProduction) {
    if (
      !envKey ||
      typeof envKey !== "string" ||
      envKey.trim().length === 0 ||
      envKey.trim().length < 32 ||
      envKey.includes("your_") ||
      envKey.includes("placeholder") ||
      envKey.includes(DEV_KEY_SEED) ||
      envKey.startsWith("<")
    ) {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: APP_ENCRYPTION_SECRET must be configured with at least 32 characters in production."
      );
    }
  }

  if (envKey && envKey.trim().length > 0) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, "hex");
    }
    return crypto.createHash("sha256").update(envKey).digest();
  }

  // Local development deterministic key
  return crypto.createHash("sha256").update(`${DEV_KEY_SEED}_${version}`).digest();
}

/**
 * Encrypts a sensitive string (e.g., Meta Access Token) using AES-256-GCM
 * with a unique 12-byte IV per encryption and generates a 16-byte authentication tag.
 */
export function encryptSecret(
  plaintext: string,
  keyVersion: string = "v1"
): EncryptedSecretPayload {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Cannot encrypt empty or invalid secret.");
  }

  const key = getMasterKey(keyVersion);
  // Generate cryptographically strong random 12-byte IV (NIST SP 800-38D recommended for GCM)
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    key_version: keyVersion,
    iv: iv.toString("hex"),
    auth_tag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

/**
 * Decrypts and verifies the integrity of an AES-256-GCM encrypted payload.
 * Throws if the authentication tag fails (tamper detection) or if decryption fails.
 */
export function decryptSecret(payload: EncryptedSecretPayload): string {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.auth_tag) {
    throw new Error("Invalid encrypted payload structure.");
  }

  const key = getMasterKey(payload.key_version || "v1");
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.auth_tag, "hex");
  const encryptedText = Buffer.from(payload.ciphertext, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err: any) {
    throw new Error(
      "Decryption authentication failed. The ciphertext or authentication tag has been tampered with or corrupted."
    );
  }
}

/**
 * Safe logger utility: Masks a token string so that it can never be leaked in logs.
 * Example: "EAAX...token_astro_1234" -> "EAAX••••1234"
 */
export function maskTokenForLogging(token: string): string {
  if (!token) return "[EMPTY]";
  if (token.length <= 8) return "••••";
  const prefix = token.slice(0, 4);
  const suffix = token.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
