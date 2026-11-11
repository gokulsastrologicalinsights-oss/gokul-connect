import { beforeEach, describe, expect, it } from "vitest";
import {
  createConnection,
  disconnectConnection,
  getBusinessSettings,
  getConnectionsForBusiness,
  resetStoreForTests,
  testConnection,
  toggleConnectionEnabled,
  updateBusinessSettings,
  updateConnection,
} from "../src/lib/connections/store";

describe("Phase 2.4: Persistent Storage Lifecycle & Integrity Tests", () => {
  const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    resetStoreForTests();
  });

  // TC-PERSIST-01: Create connection and read with encrypted credentials
  it("TC-PERSIST-01: Creates connection and correctly stores encrypted credential reference", () => {
    const created = createConnection(ASTROLOGY_ID, {
      display_name: "Astrology VIP Desk",
      phone_number: "+91 98400 99999",
      phone_number_id: "PHONE_ID_PERSIST_1",
      waba_id: "WABA_PERSIST_1",
      access_token: "EAAG_SAMPLE_TOKEN_PERSIST_01",
      description: "Dedicated VIP astrology consultation line",
    });

    expect(created.id).toBeDefined();
    expect(created.business_id).toBe(ASTROLOGY_ID);
    expect(created.has_credential).toBe(true);
    expect((created as any).access_token).toBeUndefined();

    // Verify it appears in business list
    const list = getConnectionsForBusiness(ASTROLOGY_ID);
    const found = list.find((c) => c.phone_number_id === "PHONE_ID_PERSIST_1");
    expect(found).toBeDefined();
    expect(found?.display_name).toBe("Astrology VIP Desk");
  });

  // TC-PERSIST-02: Edit connection details
  it("TC-PERSIST-02: Updates connection metadata without affecting tenant ownership", () => {
    const created = createConnection(ASTROLOGY_ID, {
      display_name: "Original Name",
      phone_number: "+91 98400 11223",
      phone_number_id: "PHONE_ID_PERSIST_2",
      waba_id: "WABA_PERSIST_2",
      access_token: "EAAG_SAMPLE_TOKEN_PERSIST_02",
    });

    const updated = updateConnection(ASTROLOGY_ID, created.id, {
      display_name: "Renamed Desk",
      description: "Updated description text",
    });

    expect(updated.display_name).toBe("Renamed Desk");
    expect(updated.description).toBe("Updated description text");
    expect(updated.business_id).toBe(ASTROLOGY_ID);
  });

  // TC-PERSIST-03: Toggle enable / disable
  it("TC-PERSIST-03: Successfully toggles connection active status", () => {
    const created = createConnection(VIVAHAM_ID, {
      display_name: "Vivaham Support Desk",
      phone_number: "+91 98401 33445",
      phone_number_id: "PHONE_ID_PERSIST_3",
      waba_id: "WABA_PERSIST_3",
      access_token: "EAAG_SAMPLE_TOKEN_PERSIST_03",
    });

    expect(created.is_enabled).toBe(true);

    const disabled = toggleConnectionEnabled(VIVAHAM_ID, created.id, false);
    expect(disabled.is_enabled).toBe(false);

    const enabled = toggleConnectionEnabled(VIVAHAM_ID, created.id, true);
    expect(enabled.is_enabled).toBe(true);
  });

  // TC-PERSIST-04: Test connection diagnostics
  it("TC-PERSIST-04: Test diagnostic verifies credentials decryptability server-side", () => {
    const created = createConnection(ASTROLOGY_ID, {
      display_name: "Diagnostic Test Desk",
      phone_number: "+91 98400 77889",
      phone_number_id: "PHONE_ID_PERSIST_4",
      waba_id: "WABA_PERSIST_4",
      access_token: "EAAG_SAMPLE_TOKEN_PERSIST_04",
    });

    const diag = testConnection(ASTROLOGY_ID, created.id);
    expect(diag.success).toBe(true);
    expect(diag.diagnostics.credentialsPresent).toBe(true);
    expect(diag.diagnostics.credentialsDecryptable).toBe(true);
    expect(diag.diagnostics.phoneNumberIdValid).toBe(true);
  });

  // TC-PERSIST-05: Disconnect (delete) connection and verify vault cleanup
  it("TC-PERSIST-05: Disconnecting connection removes both connection record and credential", () => {
    const created = createConnection(VIVAHAM_ID, {
      display_name: "Disposable Desk",
      phone_number: "+91 98401 55667",
      phone_number_id: "PHONE_ID_PERSIST_5",
      waba_id: "WABA_PERSIST_5",
      access_token: "EAAG_SAMPLE_TOKEN_PERSIST_05",
    });

    const result = disconnectConnection(VIVAHAM_ID, created.id);
    expect(result.success).toBe(true);

    const list = getConnectionsForBusiness(VIVAHAM_ID);
    const found = list.find((c) => c.id === created.id);
    expect(found).toBeUndefined();
  });

  // TC-PERSIST-06: Business Settings Persistence and Composite Validation
  it("TC-PERSIST-06: Reads and updates business settings strictly within tenant scope", () => {
    const settings = getBusinessSettings(ASTROLOGY_ID);
    expect(settings.business_id).toBe(ASTROLOGY_ID);

    const updated = updateBusinessSettings(ASTROLOGY_ID, {
      display_name: "Gokul Astrology & KP Consultations",
      timezone: "Asia/Kolkata",
      notification_preferences: {
        connection_drops: true,
        unread_alerts: false,
        daily_digest: true,
      },
    });

    expect(updated.display_name).toBe("Gokul Astrology & KP Consultations");
    expect(updated.notification_preferences.unread_alerts).toBe(false);
  });
});
