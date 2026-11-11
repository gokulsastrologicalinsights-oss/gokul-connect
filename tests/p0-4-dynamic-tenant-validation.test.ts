import { describe, it, expect, beforeEach } from "vitest";
import {
  validateTenant,
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  getConversationsForBusinessDb,
  getInboxCountsDb,
  clearVerifiedBusinessesCache,
} from "@/lib/inbox/database";

describe("P0.4 — Dynamic Tenant Validation & Authorization Suite", () => {
  beforeEach(() => {
    clearVerifiedBusinessesCache();
  });

  const ASTRO_OWNER_ID = "user-astro-owner";
  const VIVAHAM_OWNER_ID = "user-vivaham-owner";
  const UNAUTHORIZED_USER_ID = "user-unauthorized-random";
  const NONEXISTENT_BIZ_ID = "99999999-9999-9999-9999-999999999999";
  const FUTURE_BIZ_ID = "33333333-3333-3333-3333-333333333333";
  const FUTURE_OWNER_ID = "user-enterprise-owner";

  // Mock Database Client Factory for fully dynamic database simulation
  function createDynamicMockSupabaseClient(options: {
    businesses?: Array<{ id: string; name: string; slug: string; is_active: boolean }>;
    memberships?: Array<{ business_id: string; user_id: string; role: string; is_active: boolean }>;
    conversations?: Array<{ id: string; business_id: string; status: string; unread_count: number }>;
  } = {}) {
    const businesses = options.businesses || [
      { id: ASTRO_BUSINESS_ID, name: "Astrology", slug: "astrology", is_active: true },
      { id: VIVAHAM_BUSINESS_ID, name: "Vivaham", slug: "vivaham", is_active: true },
    ];

    const memberships = options.memberships || [
      { business_id: ASTRO_BUSINESS_ID, user_id: ASTRO_OWNER_ID, role: "owner", is_active: true },
      { business_id: VIVAHAM_BUSINESS_ID, user_id: VIVAHAM_OWNER_ID, role: "owner", is_active: true },
    ];

    const conversations = options.conversations || [];

    let queryCount = 0;

    return {
      getQueryCount: () => queryCount,
      from(table: string) {
        queryCount++;
        let dataset: any[] = [];
        if (table === "businesses") dataset = [...businesses];
        else if (table === "business_members") dataset = [...memberships];
        else if (table === "wa_conversations") dataset = [...conversations];

        let filtered = [...dataset];

        const chain: any = {
          select(cols = "*") {
            return chain;
          },
          eq(col: string, val: any) {
            filtered = filtered.filter((r) => r[col] === val);
            return chain;
          },
          neq(col: string, val: any) {
            filtered = filtered.filter((r) => r[col] !== val);
            return chain;
          },
          maybeSingle() {
            return Promise.resolve({
              data: filtered.length > 0 ? filtered[0] : null,
              error: null,
            });
          },
          single() {
            return Promise.resolve({
              data: filtered.length > 0 ? filtered[0] : null,
              error: filtered.length === 0 ? new Error("Not found") : null,
            });
          },
          order() {
            return chain;
          },
          range() {
            return chain;
          },
          limit(n: number) {
            filtered = filtered.slice(0, n);
            return chain;
          },
          then(resolve: any) {
            return Promise.resolve({ data: filtered, error: null }).then(resolve);
          },
        };

        return chain;
      },
    };
  }

  // 1. ASTROLOGY OWNER ACCESSING ASTROLOGY
  describe("Requirement 1: Astrology owner accessing Astrology", () => {
    it("should allow Astrology owner to access Astrology workspace via validateTenant", async () => {
      await expect(
        validateTenant(ASTRO_BUSINESS_ID, { userId: ASTRO_OWNER_ID })
      ).resolves.toBeUndefined();
    });

    it("should allow Astrology owner to query Astrology inbox conversations", async () => {
      const client = createDynamicMockSupabaseClient();
      const result = await getConversationsForBusinessDb(ASTRO_BUSINESS_ID, {
        client,
        currentUserId: ASTRO_OWNER_ID,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should allow database-backed membership authorization for Astrology owner", async () => {
      const client = createDynamicMockSupabaseClient({
        memberships: [
          { business_id: ASTRO_BUSINESS_ID, user_id: "custom-astro-user-99", role: "admin", is_active: true },
        ],
      });

      await expect(
        validateTenant(ASTRO_BUSINESS_ID, { client, userId: "custom-astro-user-99" })
      ).resolves.toBeUndefined();
    });
  });

  // 2. VIVAHAM OWNER ACCESSING VIVAHAM
  describe("Requirement 2: Vivaham owner accessing Vivaham", () => {
    it("should allow Vivaham owner to access Vivaham workspace via validateTenant", async () => {
      await expect(
        validateTenant(VIVAHAM_BUSINESS_ID, { userId: VIVAHAM_OWNER_ID })
      ).resolves.toBeUndefined();
    });

    it("should allow Vivaham owner to query Vivaham inbox counts", async () => {
      const client = createDynamicMockSupabaseClient();
      const counts = await getInboxCountsDb(VIVAHAM_BUSINESS_ID, {
        client,
        currentUserId: VIVAHAM_OWNER_ID,
      });
      expect(counts).toBeDefined();
      expect(typeof counts.all).toBe("number");
    });
  });

  // 3. ASTROLOGY USER ATTEMPTING VIVAHAM ACCESS
  describe("Requirement 3: Astrology user attempting Vivaham access", () => {
    it("should strictly reject Astrology owner attempting to access Vivaham tenant", async () => {
      await expect(
        validateTenant(VIVAHAM_BUSINESS_ID, { userId: ASTRO_OWNER_ID })
      ).rejects.toThrow(`Unauthorized: User "${ASTRO_OWNER_ID}" is not authorized for business "${VIVAHAM_BUSINESS_ID}".`);
    });

    it("should strictly block Astrology user attempting getConversationsForBusinessDb on Vivaham", async () => {
      const client = createDynamicMockSupabaseClient();
      await expect(
        getConversationsForBusinessDb(VIVAHAM_BUSINESS_ID, {
          client,
          currentUserId: ASTRO_OWNER_ID,
        })
      ).rejects.toThrow(/not authorized for business/);
    });
  });

  // 4. VIVAHAM USER ATTEMPTING ASTROLOGY ACCESS
  describe("Requirement 4: Vivaham user attempting Astrology access", () => {
    it("should strictly reject Vivaham owner attempting to access Astrology tenant", async () => {
      await expect(
        validateTenant(ASTRO_BUSINESS_ID, { userId: VIVAHAM_OWNER_ID })
      ).rejects.toThrow(`Unauthorized: User "${VIVAHAM_OWNER_ID}" is not authorized for business "${ASTRO_BUSINESS_ID}".`);
    });

    it("should strictly block Vivaham user attempting getInboxCountsDb on Astrology", async () => {
      const client = createDynamicMockSupabaseClient();
      await expect(
        getInboxCountsDb(ASTRO_BUSINESS_ID, {
          client,
          currentUserId: VIVAHAM_OWNER_ID,
        })
      ).rejects.toThrow(/not authorized for business/);
    });
  });

  // 5. UNAUTHORIZED USER
  describe("Requirement 5: Unauthorized user", () => {
    it("should reject users with no business memberships", async () => {
      await expect(
        validateTenant(ASTRO_BUSINESS_ID, { userId: UNAUTHORIZED_USER_ID })
      ).rejects.toThrow(`Unauthorized: User "${UNAUTHORIZED_USER_ID}" is not authorized for business "${ASTRO_BUSINESS_ID}".`);

      await expect(
        validateTenant(VIVAHAM_BUSINESS_ID, { userId: UNAUTHORIZED_USER_ID })
      ).rejects.toThrow(`Unauthorized: User "${UNAUTHORIZED_USER_ID}" is not authorized for business "${VIVAHAM_BUSINESS_ID}".`);
    });

    it("should reject user whose database membership is revoked (is_active: false)", async () => {
      const client = createDynamicMockSupabaseClient({
        memberships: [
          { business_id: ASTRO_BUSINESS_ID, user_id: "revoked-user-1", role: "agent", is_active: false },
        ],
      });

      await expect(
        validateTenant(ASTRO_BUSINESS_ID, { client, userId: "revoked-user-1" })
      ).rejects.toThrow(/not authorized for business/);
    });
  });

  // 6. NONEXISTENT BUSINESS
  describe("Requirement 6: Nonexistent business", () => {
    it("should reject nonexistent business UUID", async () => {
      await expect(
        validateTenant(NONEXISTENT_BIZ_ID)
      ).rejects.toThrow(`Unauthorized: Invalid business tenant identifier "${NONEXISTENT_BIZ_ID}".`);
    });

    it("should reject invalid/malformed non-UUID tenant identifiers without database queries", async () => {
      const client = createDynamicMockSupabaseClient();
      await expect(validateTenant("", client)).rejects.toThrow(/Invalid business tenant identifier/);
      await expect(validateTenant("astrology", client)).rejects.toThrow(/Invalid business tenant identifier/);
      await expect(validateTenant("invalid-uuid-1234", client)).rejects.toThrow(/Invalid business tenant identifier/);
      await expect(validateTenant("'; DROP TABLE businesses; --", client)).rejects.toThrow(/Invalid business tenant identifier/);

      // Verify zero queries were executed for invalid UUID format strings
      expect(client.getQueryCount()).toBe(0);
    });

    it("should reject deactivated business (is_active: false) in database", async () => {
      const deactivatedBizId = "44444444-4444-4444-4444-444444444444";
      const client = createDynamicMockSupabaseClient({
        businesses: [
          { id: deactivatedBizId, name: "Deactivated Business", slug: "deactivated", is_active: false },
        ],
      });

      await expect(
        validateTenant(deactivatedBizId, client)
      ).rejects.toThrow(`Unauthorized: Invalid business tenant identifier "${deactivatedBizId}".`);
    });
  });

  // 7. FUTURE BUSINESS EXPANSION WITHOUT CODE MODIFICATIONS
  describe("Requirement 7: Allow future businesses to be added without application code modifications", () => {
    it("should dynamically allow newly added 3rd business from database", async () => {
      const client = createDynamicMockSupabaseClient({
        businesses: [
          { id: ASTRO_BUSINESS_ID, name: "Astrology", slug: "astrology", is_active: true },
          { id: VIVAHAM_BUSINESS_ID, name: "Vivaham", slug: "vivaham", is_active: true },
          { id: FUTURE_BIZ_ID, name: "Gokul Enterprise Consulting", slug: "enterprise", is_active: true },
        ],
        memberships: [
          { business_id: FUTURE_BIZ_ID, user_id: FUTURE_OWNER_ID, role: "owner", is_active: true },
        ],
      });

      // Future business owner can access their business without code changes
      await expect(
        validateTenant(FUTURE_BIZ_ID, { client, userId: FUTURE_OWNER_ID })
      ).resolves.toBeUndefined();

      // Astrology owner cannot access the newly added 3rd business
      await expect(
        validateTenant(FUTURE_BIZ_ID, { client, userId: ASTRO_OWNER_ID })
      ).rejects.toThrow(/not authorized for business/);

      // 3rd business owner cannot access Astrology
      await expect(
        validateTenant(ASTRO_BUSINESS_ID, { client, userId: FUTURE_OWNER_ID })
      ).rejects.toThrow(/not authorized for business/);
    });
  });

  // 8. UNNECESSARY QUERY PREVENTION & IN-MEMORY CACHE
  describe("Requirement 8: Do not introduce unnecessary queries", () => {
    it("should not query database for known initial seed businesses when userId is not provided", async () => {
      const client = createDynamicMockSupabaseClient();
      await validateTenant(ASTRO_BUSINESS_ID, client);
      await validateTenant(VIVAHAM_BUSINESS_ID, client);

      expect(client.getQueryCount()).toBe(0);
    });

    it("should cache verified dynamic businesses to prevent redundant DB queries within TTL", async () => {
      const client = createDynamicMockSupabaseClient({
        businesses: [
          { id: FUTURE_BIZ_ID, name: "Gokul Enterprise", slug: "enterprise", is_active: true },
        ],
      });

      // First call queries DB for the dynamic business
      await validateTenant(FUTURE_BIZ_ID, client);
      const queryCountAfterFirst = client.getQueryCount();
      expect(queryCountAfterFirst).toBe(1);

      // Second call uses verified cache (0 additional DB queries)
      await validateTenant(FUTURE_BIZ_ID, client);
      expect(client.getQueryCount()).toBe(queryCountAfterFirst);
    });
  });
});
