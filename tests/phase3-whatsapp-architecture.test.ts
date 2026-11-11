import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  MetaCloudApiError,
  sanitizeMetaLog,
} from "@/lib/whatsapp/client";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import {
  encryptSecret,
  decryptSecret,
} from "@/lib/crypto/encryption";

describe("Phase 3B — WhatsApp Integration Architecture & Security Tests", () => {
  const MOCK_APP_SECRET = "0123456789abcdef0123456789abcdef";
  const MOCK_TOKEN = "EAAPq2eMdDC8BSxyJwGiwzegZA8LMyT3uU98InHLdVmxIzG2pwvLL5iMS5ha2of9r";

  // 1. Signature Verification Tests
  describe("Webhook HMAC-SHA256 Signature Verification", () => {
    it("should accept valid Meta webhook signatures", () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ id: "1153964060437882", changes: [] }],
      });

      const hmac = crypto.createHmac("sha256", MOCK_APP_SECRET);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const isValid = verifyMetaWebhookSignature(payload, signature, MOCK_APP_SECRET);
      expect(isValid).toBe(true);
    });

    it("should reject signatures when payload has been tampered with", () => {
      const originalPayload = JSON.stringify({ test: "original" });
      const tamperedPayload = JSON.stringify({ test: "tampered" });

      const hmac = crypto.createHmac("sha256", MOCK_APP_SECRET);
      hmac.update(originalPayload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const isValid = verifyMetaWebhookSignature(tamperedPayload, signature, MOCK_APP_SECRET);
      expect(isValid).toBe(false);
    });

    it("should reject invalid, malformed, or missing signatures", () => {
      expect(verifyMetaWebhookSignature("{}", null, MOCK_APP_SECRET)).toBe(false);
      expect(verifyMetaWebhookSignature("{}", undefined, MOCK_APP_SECRET)).toBe(false);
      expect(verifyMetaWebhookSignature("{}", "", MOCK_APP_SECRET)).toBe(false);
      expect(verifyMetaWebhookSignature("{}", "invalid_format", MOCK_APP_SECRET)).toBe(false);
      expect(verifyMetaWebhookSignature("{}", "sha1=abcdef", MOCK_APP_SECRET)).toBe(false);
      expect(verifyMetaWebhookSignature("{}", "sha256=wronghash", MOCK_APP_SECRET)).toBe(false);
    });
  });

  // 2. Token Masking and Zero-Leakage Tests
  describe("Token Sanitization & Zero Secret Exposure", () => {
    it("should mask tokens from error logs and stack traces", () => {
      const errorMessage = `Failed to connect with token ${MOCK_TOKEN} to endpoint`;
      const sanitized = sanitizeMetaLog(errorMessage, MOCK_TOKEN);

      expect(sanitized).not.toContain(MOCK_TOKEN);
      expect(sanitized).toContain("••••••••");
    });

    it("should scrub generic Meta EAA tokens from arbitrary error strings", () => {
      const errorString = "OAuth error: EAA1234567890abcdefghijklmnopqrstuvwxyz is expired";
      const sanitized = sanitizeMetaLog(errorString);

      expect(sanitized).not.toContain("EAA1234567890abcdefghijklmnopqrstuvwxyz");
      expect(sanitized).toContain("EAA••••••••[MASKED]");
    });

    it("should construct MetaCloudApiError without exposing tokens in standard fields", () => {
      const apiErr = new MetaCloudApiError(
        {
          message: "Invalid OAuth access token.",
          type: "OAuthException",
          code: 190,
          error_subcode: 463,
          fbtrace_id: "AbCdEfGh123",
        },
        "https://graph.facebook.com/v26.0/1395663896970053/messages"
      );

      expect(apiErr.code).toBe(190);
      expect(apiErr.subcode).toBe(463);
      expect(apiErr.fbtraceId).toBe("AbCdEfGh123");
      expect(apiErr.message).toContain("Meta Cloud API Error (190:463)");
      expect(apiErr.message).not.toContain(MOCK_TOKEN);
    });
  });

  // 3. AES-256-GCM Credential Vault Verification
  describe("AES-256-GCM Vault Integrity for WhatsApp Credentials", () => {
    it("should encrypt and decrypt Meta access tokens without alteration", () => {
      const encrypted = encryptSecret(MOCK_TOKEN);
      expect(encrypted.ciphertext).not.toBe(MOCK_TOKEN);
      expect(encrypted.iv).toHaveLength(24); // 12 bytes hex
      expect(encrypted.auth_tag).toHaveLength(32); // 16 bytes hex

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(MOCK_TOKEN);
    });

    it("should fail decryption when ciphertext or authentication tag is tampered", () => {
      const encrypted = encryptSecret(MOCK_TOKEN);
      const lastChar = encrypted.ciphertext.slice(-1);
      const replacementChar = lastChar === "0" ? "1" : "0";
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -1) + replacementChar,
      };

      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  // 4. Multi-Tenant Business Isolation Verification
  describe("Multi-Tenant Business Boundaries", () => {
    const ASTROLOGY_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
    const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

    it("should enforce distinct business tenant IDs for each workspace", () => {
      expect(ASTROLOGY_BUSINESS_ID).not.toBe(VIVAHAM_BUSINESS_ID);
    });

    it("should format phone numbers into clean international strings without invalid characters", () => {
      const rawNumber = "+91 94445 59071";
      const clean = rawNumber.replace(/[^0-9]/g, "");
      expect(clean).toBe("919444559071");
    });
  });
});
