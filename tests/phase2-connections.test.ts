import { beforeEach, describe, expect, it } from "vitest";
import { clearWorkspaceTenantCache } from "../src/components/workspace/SwitchBusinessButton";
import {
  createConnection,
  getConnectionsForBusiness,
  resetStoreForTests,
  testConnection,
  updateConnection,
} from "../src/lib/connections/store";

describe("Phase 2: Gokul Connect — WhatsApp Connections & Multi-Business Isolation Tests", () => {
  const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    resetStoreForTests();
  });

  // Test 1: Astrology workspace displays only Astrology connections
  it("TC-01: Astrology workspace displays only Astrology connections", () => {
    const astroConnections = getConnectionsForBusiness(ASTROLOGY_ID);

    expect(astroConnections.length).toBeGreaterThan(0);
    // Every connection must strictly belong to Astrology
    astroConnections.forEach((conn) => {
      expect(conn.business_id).toBe(ASTROLOGY_ID);
      expect(conn.id.startsWith("conn-astro-")).toBe(true);
    });

    // None of Vivaham connections can exist in Astrology output
    const hasVivahamData = astroConnections.some(
      (conn) =>
        conn.business_id === VIVAHAM_ID ||
        conn.phone_number.includes("98401") ||
        conn.display_name.includes("Vivaham")
    );
    expect(hasVivahamData).toBe(false);
  });

  // Test 2: Vivaham workspace displays only Vivaham connections
  it("TC-02: Vivaham workspace displays only Vivaham connections", () => {
    const vivahamConnections = getConnectionsForBusiness(VIVAHAM_ID);

    expect(vivahamConnections.length).toBeGreaterThan(0);
    // Every connection must strictly belong to Vivaham
    vivahamConnections.forEach((conn) => {
      expect(conn.business_id).toBe(VIVAHAM_ID);
      expect(conn.id.startsWith("conn-vivaham-")).toBe(true);
    });

    // None of Astrology connections can exist in Vivaham output
    const hasAstrologyData = vivahamConnections.some(
      (conn) =>
        conn.business_id === ASTROLOGY_ID ||
        conn.phone_number.includes("98400") ||
        conn.display_name.includes("Astrology")
    );
    expect(hasAstrologyData).toBe(false);
  });

  // Test 3: Astrology cannot edit Vivaham connections
  it("TC-03: Astrology workspace cannot edit Vivaham connections", () => {
    const vivahamConnectionId = "conn-vivaham-01";

    // Attempt to update Vivaham connection while passing Astrology's business context
    expect(() => {
      updateConnection(ASTROLOGY_ID, vivahamConnectionId, {
        display_name: "Malicious Cross-Tenant Modification",
      });
    }).toThrow(/belongs to another business tenant/i);
  });

  // Test 4: Vivaham cannot edit Astrology connections
  it("TC-04: Vivaham workspace cannot edit Astrology connections", () => {
    const astrologyConnectionId = "conn-astro-01";

    // Attempt to update Astrology connection while passing Vivaham's business context
    expect(() => {
      updateConnection(VIVAHAM_ID, astrologyConnectionId, {
        display_name: "Malicious Cross-Tenant Modification",
      });
    }).toThrow(/belongs to another business tenant/i);
  });

  // Test 5: Duplicate Phone Number IDs are rejected across businesses and connections
  it("TC-05: Duplicate Phone Number IDs are rejected across businesses and connections", () => {
    // Existing phone_number_id on Astrology is 109283746501928
    const existingAstroPhoneId = "109283746501928";

    // 1. Attempt to re-register on Astrology itself
    expect(() => {
      createConnection(ASTROLOGY_ID, {
        display_name: "Duplicate Line Test",
        phone_number: "+91 99999 00001",
        phone_number_id: existingAstroPhoneId,
        waba_id: "293847561029384",
        access_token: "EAAX...secret_test",
      });
    }).toThrow(/Duplicate Phone Number ID/i);

    // 2. Attempt to register Astrology's Phone Number ID on Vivaham (cross-tenant collision)
    expect(() => {
      createConnection(VIVAHAM_ID, {
        display_name: "Vivaham Poaching Astrology Number",
        phone_number: "+91 99999 00002",
        phone_number_id: existingAstroPhoneId,
        waba_id: "393847561029385",
        access_token: "EAAX...secret_test",
      });
    }).toThrow(/Duplicate Phone Number ID.*another business tenant/i);
  });

  // Test 6: Invalid business IDs are rejected
  it("TC-06: Invalid business IDs are rejected", () => {
    const fakeBusinessId = "99999999-9999-9999-9999-999999999999";

    expect(() => {
      getConnectionsForBusiness(fakeBusinessId);
    }).toThrow(/Unauthorized Tenant.*invalid or does not exist/i);

    expect(() => {
      createConnection(fakeBusinessId, {
        display_name: "Fake Desk",
        phone_number: "+91 99999 99999",
        phone_number_id: "999999999999999",
        waba_id: "888888888888888",
        access_token: "EAAX...fake_token",
      });
    }).toThrow(/Unauthorized Tenant/i);
  });

  // Test 7: Disabled connections cannot be used
  it("TC-07: Disabled connections cannot be used for operational testing or message routing", () => {
    // conn-astro-02 is seeded with is_enabled: false
    const disabledConnId = "conn-astro-02";

    const result = testConnection(ASTROLOGY_ID, disabledConnId);

    expect(result.success).toBe(false);
    expect(result.status).toBe("disabled");
    expect(result.message).toMatch(/currently disabled/i);
  });

  // Test 8: Access tokens never appear in frontend responses or serialized connection objects
  it("TC-08: Access tokens never appear in frontend responses or serialized connection objects", () => {
    const rawSecretToken = "EAAX_SUPER_SENSITIVE_PERMANENT_META_TOKEN_123456";

    // Create a connection with a sensitive token
    const created = createConnection(ASTROLOGY_ID, {
      display_name: "Secret Safety Test Line",
      phone_number: "+91 98400 99999",
      phone_number_id: "555555555555555",
      waba_id: "293847561029384",
      access_token: rawSecretToken,
    });

    // 1. Check created object directly
    expect((created as any).access_token).toBeUndefined();
    expect((created as any).credential_ref).toBeUndefined();

    // 2. Check JSON serialized response that would go over HTTP/API
    const jsonString = JSON.stringify(created);
    expect(jsonString).not.toContain(rawSecretToken);
    expect(jsonString).not.toContain("access_token");

    // 3. Fetch all connections for business and test JSON representation
    const allConnections = getConnectionsForBusiness(ASTROLOGY_ID);
    const allJson = JSON.stringify(allConnections);
    expect(allJson).not.toContain(rawSecretToken);
    expect(allJson).not.toContain("access_token");
  });

  // Test 9: Switching businesses clears previous connection data
  it("TC-09: Switching businesses clears previous connection data from client cache", () => {
    // Setup mock browser storage
    const storageMap = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) || null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    // Polyfill window.sessionStorage & window.localStorage for test
    (globalThis as any).window = {
      sessionStorage: mockStorage,
      localStorage: mockStorage,
    };

    // Simulate active session in Astrology workspace with cached data
    mockStorage.setItem("active_connections_cache", JSON.stringify([{ id: "conn-astro-01" }]));
    mockStorage.setItem("active_workspace_cache", "astrology");
    mockStorage.setItem("cached_connections", "astro_cached_data");

    expect(mockStorage.getItem("active_connections_cache")).not.toBeNull();
    expect(mockStorage.getItem("cached_connections")).not.toBeNull();

    // Trigger clear workspace cache (invoked when user clicks "Switch Business")
    clearWorkspaceTenantCache();

    // Verify all cached connection & workspace records are wiped clean
    expect(mockStorage.getItem("active_connections_cache")).toBeNull();
    expect(mockStorage.getItem("active_workspace_cache")).toBeNull();
    expect(mockStorage.getItem("cached_connections")).toBeNull();

    // Clean up global polyfill
    delete (globalThis as any).window;
  });
});
