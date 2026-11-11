import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  maskTokenForLogging,
} from "../src/lib/crypto/encryption";
import { toSafeConnection } from "../src/lib/connections/store";
import { WhatsAppConnection } from "../src/types/database";

describe("Phase 2.4: WhatsApp Credential Vault & AES-256-GCM Security Tests", () => {
  const SAMPLE_META_TOKEN = "EAAGm0PX4ZCpsBAK7ZCZCQ...long_secret_meta_access_token_sample_2026";

  // TC-VAULT-01: Unique random IV for every encryption
  it("TC-VAULT-01: Generates unique 12-byte random IV on each encryption call", () => {
    const enc1 = encryptSecret(SAMPLE_META_TOKEN);
    const enc2 = encryptSecret(SAMPLE_META_TOKEN);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    // 12 bytes = 24 hex characters
    expect(enc1.iv.length).toBe(24);
    expect(enc2.iv.length).toBe(24);
  });

  // TC-VAULT-02: Correct encryption/decryption round trip
  it("TC-VAULT-02: Correctly encrypts and decrypts secrets matching original plaintext", () => {
    const encrypted = encryptSecret(SAMPLE_META_TOKEN);
    const decrypted = decryptSecret(encrypted);

    expect(decrypted).toBe(SAMPLE_META_TOKEN);
    expect(encrypted.ciphertext).not.toBe(SAMPLE_META_TOKEN);
    expect(encrypted.key_version).toBe("v1");
  });

  // TC-VAULT-03: Authentication tag validation (16 bytes = 32 hex chars)
  it("TC-VAULT-03: Produces valid 16-byte GCM authentication tag", () => {
    const encrypted = encryptSecret(SAMPLE_META_TOKEN);

    expect(encrypted.auth_tag).toBeDefined();
    expect(encrypted.auth_tag.length).toBe(32); // 16 bytes in hex
  });

  // TC-VAULT-04: Modified ciphertext is rejected (tamper resistance)
  it("TC-VAULT-04: Tampered or modified ciphertext is rejected with authentication error", () => {
    const encrypted = encryptSecret(SAMPLE_META_TOKEN);
    // Flip first character of ciphertext
    const tamperedCiphertext =
      (encrypted.ciphertext[0] === "a" ? "b" : "a") + encrypted.ciphertext.slice(1);

    expect(() => {
      decryptSecret({
        ...encrypted,
        ciphertext: tamperedCiphertext,
      });
    }).toThrow(/Decryption authentication failed/);
  });

  // TC-VAULT-05: Modified auth tag is rejected
  it("TC-VAULT-05: Tampered authentication tag causes decryption failure", () => {
    const encrypted = encryptSecret(SAMPLE_META_TOKEN);
    const tamperedTag = (encrypted.auth_tag[0] === "f" ? "0" : "f") + encrypted.auth_tag.slice(1);

    expect(() => {
      decryptSecret({
        ...encrypted,
        auth_tag: tamperedTag,
      });
    }).toThrow();
  });

  // TC-VAULT-06: Plaintext access tokens are never persisted in client-facing DTOs
  it("TC-VAULT-06: toSafeConnection strips credential_ref and never leaks access tokens", () => {
    const rawConnection: WhatsAppConnection = {
      id: "conn-test-01",
      business_id: "11111111-1111-1111-1111-111111111111",
      display_name: "Test Desk",
      phone_number: "+91 98400 12345",
      phone_number_id: "109283746501928",
      waba_id: "293847561029384",
      credential_ref: "vault:sec_test_01",
      connection_status: "setup_required",
      webhook_status: "unconfigured",
      is_enabled: true,
      last_connected_at: null,
      last_checked_at: null,
      last_message_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const safe = toSafeConnection(rawConnection);

    expect((safe as any).credential_ref).toBeUndefined();
    expect((safe as any).access_token).toBeUndefined();
    expect(safe.has_credential).toBeDefined();
    expect(safe.credential_masked_hint).toContain("••••••••");
  });

  // TC-VAULT-07: Secrets never appear in application logs
  it("TC-VAULT-07: maskTokenForLogging safely redacts sensitive tokens for logging", () => {
    const masked = maskTokenForLogging(SAMPLE_META_TOKEN);
    expect(masked).not.toBe(SAMPLE_META_TOKEN);
    expect(masked).toContain("••••••••");
    expect(masked).toContain(SAMPLE_META_TOKEN.slice(-4));
    expect(masked.length).toBeLessThan(SAMPLE_META_TOKEN.length);
  });

  // TC-VAULT-08: Empty or invalid input handling
  it("TC-VAULT-08: Throws descriptive errors when passed empty or invalid payloads", () => {
    expect(() => encryptSecret("")).toThrow(/Cannot encrypt empty or invalid secret/);
    expect(() =>
      decryptSecret({
        key_version: "v1",
        iv: "",
        auth_tag: "",
        ciphertext: "",
      })
    ).toThrow();
  });
});
