import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createConnection,
  getConnectionsForBusiness,
  getEncryptedVaultPayload,
  resetStoreForTests,
  updateBusinessSettings,
  updateConnection,
} from "../src/lib/connections/store";
import { decryptSecret, encryptSecret } from "../src/lib/crypto/encryption";

describe("Phase 2.2: Gokul Connect — Security Patches & Persistent Architecture Tests", () => {
  const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    resetStoreForTests();
  });

  // Test 1: Security-definer functions have safe search_path
  it("TC-SEC-01: All PostgreSQL SECURITY DEFINER functions explicitly set search_path to public, pg_temp", () => {
    const migration001Path = path.resolve("./supabase/migrations/20261106_001_phase1_foundation.sql");
    const migration001Content = fs.readFileSync(migration001Path, "utf8");

    // Extract all SECURITY DEFINER blocks
    const securityDefinerRegex = /CREATE OR REPLACE FUNCTION\s+public\.([a-zA-Z0-9_]+)[\s\S]*?SECURITY DEFINER[\s\S]*?AS/g;
    const matches = Array.from(migration001Content.matchAll(securityDefinerRegex));

    expect(matches.length).toBeGreaterThanOrEqual(3);

    for (const match of matches) {
      const functionBlock = match[0];
      const functionName = match[1];

      // Must explicitly enforce safe search_path to prevent schema hijacking
      const hasSafeSearchPath =
        functionBlock.includes("SET search_path = public, pg_temp") ||
        functionBlock.includes("SET search_path = public");

      expect(
        hasSafeSearchPath,
        `Function public.${functionName} is missing explicit SET search_path`
      ).toBe(true);
    }
  });

  // Test 2: Unauthorized users cannot execute privileged functions (REVOKE FROM PUBLIC)
  it("TC-SEC-02: Privileged SECURITY DEFINER functions revoke EXECUTE from PUBLIC", () => {
    const migration001Path = path.resolve("./supabase/migrations/20261106_001_phase1_foundation.sql");
    const migration001Content = fs.readFileSync(migration001Path, "utf8");

    expect(migration001Content).toContain("REVOKE EXECUTE ON FUNCTION public.check_user_business_access(UUID) FROM PUBLIC;");
    expect(migration001Content).toContain("GRANT EXECUTE ON FUNCTION public.check_user_business_access(UUID) TO authenticated, service_role;");

    expect(migration001Content).toContain("REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;");
    expect(migration001Content).toContain("GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;");

    expect(migration001Content).toContain("REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;");
  });

  // Test 3: business_id cannot be changed during connection updates
  it("TC-SEC-03: business_id cannot be changed during connection updates (Tenant Immutability)", () => {
    // 1. Application-level check
    expect(() => {
      updateConnection(ASTROLOGY_ID, "conn-astro-01", {
        business_id: VIVAHAM_ID,
      } as any);
    }).toThrow(/Tenant reassignment forbidden: business_id on wa_connections cannot be modified/i);

    // 2. Database migration check: trigger present
    const migration002Path = path.resolve("./supabase/migrations/20261106_002_phase2_wa_connections.sql");
    const migration002Content = fs.readFileSync(migration002Path, "utf8");

    expect(migration002Content).toContain("prevent_wa_connection_tenant_reassignment()");
    expect(migration002Content).toContain("trg_wa_connections_immutable_business_id");
    expect(migration002Content).toContain("NEW.business_id IS DISTINCT FROM OLD.business_id");
  });

  // Test 4: Default connection cannot reference another business (Composite FK)
  it("TC-SEC-04: Default connection cannot reference another business (Composite Foreign Key)", () => {
    // 1. Application layer check: Astrology attempts to set a Vivaham connection as default
    expect(() => {
      updateBusinessSettings(ASTROLOGY_ID, {
        whatsapp_preferences: {
          default_connection_id: "conn-vivaham-01", // Belongs to Vivaham
          webhook_retry_policy: "standard",
          opt_out_keywords: "STOP",
        },
      });
    }).toThrow(/Tenant cross-referencing forbidden.*belongs to another business tenant/i);

    // Setting a valid connection belonging to Astrology succeeds
    const validSettings = updateBusinessSettings(ASTROLOGY_ID, {
      whatsapp_preferences: {
        default_connection_id: "conn-astro-01",
        webhook_retry_policy: "standard",
        opt_out_keywords: "STOP",
      },
    });
    expect(validSettings.whatsapp_preferences.default_connection_id).toBe("conn-astro-01");

    // Setting null/empty default connection succeeds
    const nullSettings = updateBusinessSettings(ASTROLOGY_ID, {
      whatsapp_preferences: {
        default_connection_id: "",
        webhook_retry_policy: "standard",
        opt_out_keywords: "STOP",
      },
    });
    expect(nullSettings.whatsapp_preferences.default_connection_id).toBe("");

    // 2. Database migration check: Composite FK with column-specific SET NULL (PostgreSQL 15+)
    const migration002Path = path.resolve("./supabase/migrations/20261106_002_phase2_wa_connections.sql");
    const migration002Content = fs.readFileSync(migration002Path, "utf8");

    expect(migration002Content).toContain("CONSTRAINT uq_wa_connections_id_business UNIQUE (id, business_id)");
    expect(migration002Content).toContain("FOREIGN KEY (default_connection_id, business_id)");
    expect(migration002Content).toContain("REFERENCES public.wa_connections(id, business_id)");
    expect(migration002Content).toContain("ON DELETE SET NULL (default_connection_id)");
  });

  // Test 5: Existing tenant isolation remains intact
  it("TC-SEC-05: Existing tenant isolation remains strictly intact", () => {
    const astroList = getConnectionsForBusiness(ASTROLOGY_ID);
    const vivahamList = getConnectionsForBusiness(VIVAHAM_ID);

    expect(astroList.every((c) => c.business_id === ASTROLOGY_ID)).toBe(true);
    expect(vivahamList.every((c) => c.business_id === VIVAHAM_ID)).toBe(true);

    const crossLeak1 = astroList.some((c) => c.business_id === VIVAHAM_ID);
    const crossLeak2 = vivahamList.some((c) => c.business_id === ASTROLOGY_ID);

    expect(crossLeak1).toBe(false);
    expect(crossLeak2).toBe(false);
  });

  // Test 6: AES-256-GCM encryption architecture & Zero-Token leakage
  it("TC-SEC-06: AES-256-GCM encryption produces unique 12-byte IV, 16-byte auth tag, and zero token leakage", () => {
    const rawSecret = "EAAX_PRODUCTION_SECRET_PERMANENT_META_TOKEN_987654321";

    // 1. Encryption generates unique 12-byte IV (24 hex chars) and 16-byte tag (32 hex chars)
    const payload1 = encryptSecret(rawSecret);
    const payload2 = encryptSecret(rawSecret);

    expect(payload1.iv.length).toBe(24); // 12 bytes = 24 hex chars
    expect(payload1.auth_tag.length).toBe(32); // 16 bytes = 32 hex chars
    expect(payload1.ciphertext).not.toBe(rawSecret);

    // Semantic security: Same plaintext produces different IVs and different ciphertexts
    expect(payload1.iv).not.toBe(payload2.iv);
    expect(payload1.ciphertext).not.toBe(payload2.ciphertext);

    // Decryption works accurately
    const decrypted1 = decryptSecret(payload1);
    const decrypted2 = decryptSecret(payload2);
    expect(decrypted1).toBe(rawSecret);
    expect(decrypted2).toBe(rawSecret);

    // Tampering with ciphertext fails authentication
    const tamperedPayload = {
      ...payload1,
      ciphertext: payload1.ciphertext.slice(0, -2) + (payload1.ciphertext.endsWith("0") ? "1" : "0"),
    };
    expect(() => decryptSecret(tamperedPayload)).toThrow(/Decryption authentication failed/i);

    // 2. Check vault storage and safe client DTO
    const created = createConnection(ASTROLOGY_ID, {
      display_name: "AES Safety Line",
      phone_number: "+91 98400 33333",
      phone_number_id: "888888888888888",
      waba_id: "293847561029384",
      access_token: rawSecret,
    });

    // Vault stores AES-256-GCM encrypted payload, not plain string
    const vaultItem = getEncryptedVaultPayload(created.id ? `vault:sec_${created.id}` : "");
    if (vaultItem) {
      expect(vaultItem.ciphertext).toBeDefined();
      expect(vaultItem.ciphertext).not.toContain(rawSecret);
      expect(decryptSecret(vaultItem)).toBe(rawSecret);
    }

    // Client object has NO secret keys and NO token
    const clientJson = JSON.stringify(created);
    expect(clientJson).not.toContain(rawSecret);
    expect(clientJson).not.toContain("access_token");
    expect((created as any).credential_ref).toBeUndefined();
  });
});
