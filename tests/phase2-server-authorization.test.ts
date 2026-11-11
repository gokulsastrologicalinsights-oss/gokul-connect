import { describe, expect, it } from "vitest";
import { clearWorkspaceTenantCache } from "../src/components/workspace/SwitchBusinessButton";
import {
  getConnectionInternal,
  getConnectionsForBusiness,
  updateBusinessSettings,
  updateConnection,
  validateBusinessTenant,
} from "../src/lib/connections/store";

describe("Phase 2.4: Server-Side Authorization & Anti-Tampering Tests", () => {
  const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";
  const INVALID_TENANT_ID = "99999999-9999-9999-9999-999999999999";

  // TC-AUTH-01: Invalid business ID rejection
  it("TC-AUTH-01: validateBusinessTenant rejects nonexistent or invalid tenant IDs", () => {
    expect(() => validateBusinessTenant(INVALID_TENANT_ID)).toThrow(
      /Unauthorized Tenant: Business ID.*is invalid/
    );
    expect(() => validateBusinessTenant("")).toThrow();
  });

  // TC-AUTH-02: Cross-tenant connection inspection rejection
  it("TC-AUTH-02: getConnectionInternal prevents reading a connection belonging to another business", () => {
    // conn-astro-01 belongs to Astrology
    expect(() => {
      getConnectionInternal(VIVAHAM_ID, "conn-astro-01");
    }).toThrow(/Forbidden: Access denied. Connection "conn-astro-01" belongs to another business tenant/);
  });

  // TC-AUTH-03: Tenant reassignment rejection on connection update
  it("TC-AUTH-03: updateConnection forbids changing business_id (immutability)", () => {
    expect(() => {
      updateConnection(ASTROLOGY_ID, "conn-astro-01", {
        business_id: VIVAHAM_ID,
      } as any);
    }).toThrow(/Tenant reassignment forbidden: business_id on wa_connections cannot be modified/);
  });

  // TC-AUTH-04: Cross-tenant default connection assignment rejection
  it("TC-AUTH-04: updateBusinessSettings rejects setting default_connection_id from another tenant", () => {
    // Attempt to set Astrology's default connection to Vivaham's conn-vivaham-01
    expect(() => {
      updateBusinessSettings(ASTROLOGY_ID, {
        whatsapp_preferences: {
          default_connection_id: "conn-vivaham-01",
        },
      });
    }).toThrow(/Tenant cross-referencing forbidden: Default connection.*belongs to another business tenant/);
  });

  // TC-AUTH-05: Nonexistent default connection rejection
  it("TC-AUTH-05: updateBusinessSettings rejects non-existent default connection ID", () => {
    expect(() => {
      updateBusinessSettings(ASTROLOGY_ID, {
        whatsapp_preferences: {
          default_connection_id: "conn-nonexistent-999",
        },
      });
    }).toThrow(/Default connection not found with ID/);
  });

  // TC-AUTH-06: Switch Business Cache Clearing
  it("TC-AUTH-06: clearWorkspaceTenantCache executes cleanly without side effects", () => {
    expect(() => clearWorkspaceTenantCache()).not.toThrow();
  });
});
