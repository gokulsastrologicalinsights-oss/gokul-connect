import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import {
  createMetaOAuthState,
  verifyMetaOAuthState,
  getMetaOAuthAuthorizationUrl,
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  fetchUserPagesAndInstagram,
  sanitizeDiscoveredPages,
  debugMetaToken,
  META_REQUIRED_SCOPES,
} from "@/lib/meta-social/oauth";
import {
  stageDiscoveredPages,
  getStagedDiscoveredSession,
  getSanitizedStagedPages,
  clearStagedDiscovery,
} from "@/lib/meta-social/discovery-cache";
import {
  getSocialConnectionsMemory,
  saveSocialConnectionMemory,
  disconnectSocialAccountMemory,
  verifySocialConnectionTokenMemory,
  resetMemorySocialStore,
  projectSafeConnection,
} from "@/lib/meta-social/connections-store";
import {
  initiateMetaOAuthAction,
  getDiscoveredPagesAction,
  connectDiscoveredAccountAction,
  disconnectSocialConnectionAction,
  verifySocialConnectionAction,
  getSocialConnectionsAction,
} from "@/app/actions/meta-connections";
import { decryptSecret, maskTokenForLogging } from "@/lib/crypto/encryption";
import * as tenantGuard from "@/lib/auth/tenant-guard";
import { getConnectionsForBusiness } from "@/lib/connections/store";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";

describe("Phase 13C — Meta Facebook & Instagram Account Connection Test Suite", () => {
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const USER_ID = "user-uuid-12345";
  const TEST_SECRET = "test-meta-app-secret-32-chars-long!";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetMemorySocialStore();
    process.env.APP_ENCRYPTION_SECRET = "test_encryption_master_key_32bytes!!";
    process.env.META_APP_ID = "123456789012345";
    process.env.META_APP_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  // ============================================================================
  // 1. OAuth State Generation & Cryptographic Validation
  // ============================================================================
  describe("OAuth State Generation & Cryptographic Validation", () => {
    it("1.1 creates cryptographically signed state and CSRF nonce", () => {
      const { state, csrfCookie } = createMetaOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      expect(state).toBeDefined();
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).toHaveLength(48); // 24 bytes in hex
      expect(state.split(".")).toHaveLength(2);

      const verified = verifyMetaOAuthState(state, csrfCookie);
      expect(verified.businessSlug).toBe("astrology");
      expect(verified.businessId).toBe(ASTRO_BIZ_ID);
      expect(verified.userId).toBe(USER_ID);
      expect(verified.nonce).toBe(csrfCookie);
    });

    it("1.2 rejects tampered OAuth state signature (fails closed)", () => {
      const { state, csrfCookie } = createMetaOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      const [payload, sig] = state.split(".");
      const tamperedState = `${payload}.tampered_forged_sig_123`;

      expect(() => verifyMetaOAuthState(tamperedState, csrfCookie)).toThrow(
        /signature verification failed/i
      );
    });

    it("1.3 rejects expired OAuth state (>15 minutes)", () => {
      // Create expired payload
      const expiredPayload = {
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
        nonce: "test_nonce_123",
        timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago
      };

      const b64 = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      const sig = crypto
        .createHmac("sha256", process.env.APP_ENCRYPTION_SECRET!)
        .update(b64)
        .digest("base64url");
      const expiredState = `${b64}.${sig}`;

      expect(() => verifyMetaOAuthState(expiredState, "test_nonce_123")).toThrow(
        /expired/i
      );
    });

    it("1.4 rejects CSRF nonce mismatch between cookie and state", () => {
      const { state } = createMetaOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      expect(() => verifyMetaOAuthState(state, "attacker_forged_csrf_cookie")).toThrow(
        /CSRF validation failed/i
      );
    });

    it("1.4a rejects missing CSRF cookie (omitted argument) (fail closed)", () => {
      const { state } = createMetaOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      expect(() => (verifyMetaOAuthState as any)(state)).toThrow(
        /Missing or empty CSRF session cookie/i
      );
    });

    it("1.4b rejects undefined CSRF cookie (fail closed)", () => {
      const { state } = createMetaOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      expect(() => verifyMetaOAuthState(state, undefined)).toThrow(
        /Missing or empty CSRF session cookie/i
      );
    });

    it("1.4c rejects empty or whitespace-only CSRF cookie (fail closed)", () => {
      const { state } = createMetaOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      expect(() => verifyMetaOAuthState(state, "")).toThrow(
        /Missing or empty CSRF session cookie/i
      );
      expect(() => verifyMetaOAuthState(state, "   ")).toThrow(
        /Missing or empty CSRF session cookie/i
      );
    });

    it("1.4d rejects missing or malformed OAuth state", () => {
      expect(() => verifyMetaOAuthState("", "valid_csrf_cookie")).toThrow(
        /Invalid OAuth state format/i
      );
      expect(() => verifyMetaOAuthState("malformed_state_without_dot", "valid_csrf_cookie")).toThrow(
        /Invalid OAuth state format/i
      );
    });

    it("1.5 builds valid Meta OAuth authorization URL with all required scopes", () => {
      const authUrl = getMetaOAuthAuthorizationUrl({
        state: "test_state_val",
      });

      const parsedUrl = new URL(authUrl);
      expect(parsedUrl.origin).toBe("https://www.facebook.com");
      expect(parsedUrl.pathname).toBe("/v21.0/dialog/oauth");
      expect(parsedUrl.searchParams.get("client_id")).toBe("123456789012345");
      expect(parsedUrl.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/auth/meta/callback"
      );
      expect(parsedUrl.searchParams.get("state")).toBe("test_state_val");

      const scopes = parsedUrl.searchParams.get("scope")?.split(",") || [];
      expect(scopes).toContain("pages_show_list");
      expect(scopes).toContain("pages_read_engagement");
      expect(scopes).toContain("pages_messaging");
      expect(scopes).toContain("instagram_basic");
      expect(scopes).toContain("instagram_manage_comments");
      expect(scopes).toContain("instagram_manage_messages");
    });
  });

  // ============================================================================
  // 2. Meta OAuth Token Exchange & Page Discovery
  // ============================================================================
  describe("OAuth Token Exchange & Discovery", () => {
    it("2.1 exchanges authorization code for short-lived user token", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "EAAB_mock_user_short_token",
          token_type: "bearer",
          expires_in: 3600,
        }),
      } as Response);

      const result = await exchangeCodeForUserToken({
        code: "test_auth_code_123",
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.accessToken).toBe("EAAB_mock_user_short_token");
      expect(result.expiresIn).toBe(3600);
    });

    it("2.2 exchanges short-lived token for long-lived user token (~60 days)", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "EAAB_mock_user_long_token",
          token_type: "bearer",
          expires_in: 5184000,
        }),
      } as Response);

      const result = await exchangeForLongLivedUserToken({
        shortLivedToken: "EAAB_mock_user_short_token",
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.accessToken).toBe("EAAB_mock_user_long_token");
      expect(result.expiresIn).toBe(5184000);
    });

    it("2.3 discovers Facebook Pages and linked Instagram Professional accounts", async () => {
      const mockPagesResponse = {
        data: [
          {
            id: "page_astro_101",
            name: "Gokul Astrology Consultation Page",
            category: "Astrologist",
            access_token: "EAAB_mock_page_token_astro",
            tasks: ["MODERATE", "MESSAGING"],
            instagram_business_account: {
              id: "ig_astro_901",
              username: "gokul_astrology_official",
              name: "Gokul Astrology",
              profile_picture_url: "https://meta.example/astro.jpg",
            },
          },
          {
            id: "page_astro_102",
            name: "Gokul Astrology Tamil Daily",
            category: "Media",
            access_token: "EAAB_mock_page_token_astro_media",
            tasks: ["MESSAGING"],
            instagram_business_account: null, // No Instagram linked
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockPagesResponse,
      } as Response);

      const pages = await fetchUserPagesAndInstagram("EAAB_mock_user_long_token");

      expect(pages).toHaveLength(2);

      // Page 1: Has linked Instagram
      expect(pages[0].pageId).toBe("page_astro_101");
      expect(pages[0].pageName).toBe("Gokul Astrology Consultation Page");
      expect(pages[0].pageAccessToken).toBe("EAAB_mock_page_token_astro");
      expect(pages[0].instagramAccount).toMatchObject({
        id: "ig_astro_901",
        username: "gokul_astrology_official",
        name: "Gokul Astrology",
        isEligible: true,
      });

      // Page 2: No linked Instagram
      expect(pages[1].pageId).toBe("page_astro_102");
      expect(pages[1].instagramAccount?.isEligible).toBe(false);
      expect(pages[1].instagramAccount?.ineligibilityReason).toContain(
        "No Instagram Professional Account is linked"
      );
    });

    it("2.4 sanitizeDiscoveredPages strips all access tokens before client presentation", () => {
      const rawPages = [
        {
          pageId: "123",
          pageName: "Test Page",
          pageAccessToken: "SUPER_SECRET_PAGE_ACCESS_TOKEN_NEVER_EXPOSE",
          instagramAccount: {
            id: "456",
            username: "test_ig",
            isEligible: true,
          },
        },
      ];

      const sanitized = sanitizeDiscoveredPages(rawPages);
      expect(sanitized[0]).not.toHaveProperty("pageAccessToken");
      expect((sanitized[0] as any).pageAccessToken).toBeUndefined();
      expect(sanitized[0].pageId).toBe("123");
      expect(sanitized[0].pageName).toBe("Test Page");
    });
  });

  // ============================================================================
  // 3. Ephemeral Server-Side Discovery Staging
  // ============================================================================
  describe("Discovery Staging & Session Management", () => {
    it("3.1 stages discovered pages server-side and provides sanitized client projection", () => {
      const rawPages = [
        {
          pageId: "page_1",
          pageName: "Page One",
          pageAccessToken: "SECRET_TOKEN_PAGE_1",
          instagramAccount: null,
        },
      ];

      const sessionId = stageDiscoveredPages(ASTRO_BIZ_ID, rawPages);
      expect(sessionId).toMatch(/^disc_/);

      const sanitized = getSanitizedStagedPages(sessionId);
      expect(sanitized).toBeDefined();
      expect(sanitized?.businessId).toBe(ASTRO_BIZ_ID);
      expect((sanitized?.pages[0] as any).pageAccessToken).toBeUndefined();

      // Retrieve full session server-side
      const full = getStagedDiscoveredSession(sessionId);
      expect(full?.pages[0].pageAccessToken).toBe("SECRET_TOKEN_PAGE_1");

      // Invalidate session
      clearStagedDiscovery(sessionId);
      expect(getStagedDiscoveredSession(sessionId)).toBeNull();
    });
  });

  // ============================================================================
  // 4. Account Connection, AES-256-GCM Encryption & Independent Connection
  // ============================================================================
  describe("Account Connection & Encryption", () => {
    it("4.1 connects Facebook Page independently with AES-256-GCM encryption", () => {
      const fbConn = saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "fb_page_astro_01",
        accountName: "Gokul Astrology Main Page",
        pageId: "fb_page_astro_01",
        accessToken: "EAAB_real_page_token_astro_secret_12345",
      });

      expect(fbConn.id).toBeDefined();
      expect(fbConn.business_id).toBe(ASTRO_BIZ_ID);
      expect(fbConn.platform).toBe("facebook");
      expect(fbConn.account_id).toBe("fb_page_astro_01");
      expect(fbConn.connection_status).toBe("connected");
      expect(fbConn.has_credential).toBe(true);
      expect(fbConn.credential_masked_hint).toMatch(/Ref: ••••/);

      // Verify no raw token is exposed in the safe projection
      expect((fbConn as any).accessToken).toBeUndefined();
      expect((fbConn as any).credential_ref).toBeUndefined();

      // Verify connection appears in tenant list
      const connections = getSocialConnectionsMemory(ASTRO_BIZ_ID);
      expect(connections).toHaveLength(1);
      expect(connections[0].account_id).toBe("fb_page_astro_01");
    });

    it("4.2 connects Instagram Professional Account independently with associated FB Page ID", () => {
      const igConn = saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "instagram",
        accountId: "ig_astro_prof_01",
        accountName: "Gokul Astrology IG",
        username: "gokul_astrology",
        pageId: "fb_page_astro_01", // Required linked page ID
        accessToken: "EAAB_real_ig_token_astro_secret_67890",
      });

      expect(igConn.platform).toBe("instagram");
      expect(igConn.account_id).toBe("ig_astro_prof_01");
      expect(igConn.username).toBe("gokul_astrology");
      expect(igConn.page_id).toBe("fb_page_astro_01");
      expect(igConn.connection_status).toBe("connected");
      expect(igConn.has_credential).toBe(true);
    });

    it("4.3 rejects Instagram connection if linked Facebook Page ID is missing", () => {
      expect(() =>
        saveSocialConnectionMemory(ASTRO_BIZ_ID, {
          platform: "instagram",
          accountId: "ig_orphan_account",
          accountName: "Orphan IG",
          accessToken: "EAAB_token",
        })
      ).toThrow(/Connected Facebook Page ID.*strictly required/i);
    });
  });

  // ============================================================================
  // 5. Token Debugging & Status Verification
  // ============================================================================
  describe("Token Debugging & Validity Verification", () => {
    it("5.1 verifies valid token and reports connected status", async () => {
      // Connect account
      const conn = saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "page_valid_01",
        accountName: "Valid Page",
        pageId: "page_valid_01",
        accessToken: "EAAB_valid_active_token",
      });

      // Mock Meta debug_token response (valid)
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            is_valid: true,
            app_id: "123456789012345",
            user_id: "user_111",
            type: "PAGE",
            scopes: ["pages_show_list", "pages_messaging"],
            expires_at: 0, // Page tokens do not expire
          },
        }),
      } as Response);

      const result = await verifySocialConnectionTokenMemory(ASTRO_BIZ_ID, conn.id);
      expect(result.success).toBe(true);
      expect(result.status).toBe("connected");
      expect(result.diagnostics.credentialsDecryptable).toBe(true);
      expect(result.diagnostics.tokenValid).toBe(true);
    });

    it("5.2 detects expired or revoked token and marks status accordingly", async () => {
      const conn = saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "page_expired_01",
        accountName: "Expired Page",
        pageId: "page_expired_01",
        accessToken: "EAAB_expired_token",
      });

      // Mock Meta debug_token response (expired: code 190, subcode 463)
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            is_valid: false,
            error: {
              code: 190,
              subcode: 463,
              message: "Error validating access token: Session has expired.",
            },
          },
        }),
      } as Response);

      const result = await verifySocialConnectionTokenMemory(ASTRO_BIZ_ID, conn.id);
      expect(result.success).toBe(false);
      expect(result.status).toBe("expired");
      expect(result.diagnostics.tokenValid).toBe(false);

      // Verify connection status updated in store
      const conns = getSocialConnectionsMemory(ASTRO_BIZ_ID);
      expect(conns.find((c) => c.id === conn.id)?.connection_status).toBe("expired");
    });
  });

  // ============================================================================
  // 6. Account Disconnection
  // ============================================================================
  describe("Account Disconnection", () => {
    it("6.1 disconnects an account and purges credentials from vault", () => {
      const conn = saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "page_disconnect_01",
        accountName: "Disconnect Page",
        pageId: "page_disconnect_01",
        accessToken: "EAAB_temp_token",
      });

      expect(conn.connection_status).toBe("connected");
      expect(conn.has_credential).toBe(true);

      const discResult = disconnectSocialAccountMemory(ASTRO_BIZ_ID, conn.id);
      expect(discResult.success).toBe(true);

      const conns = getSocialConnectionsMemory(ASTRO_BIZ_ID);
      const updated = conns.find((c) => c.id === conn.id);
      expect(updated?.connection_status).toBe("disconnected");
      expect(updated?.is_enabled).toBe(false);
      expect(updated?.has_credential).toBe(false);
    });
  });

  // ============================================================================
  // 7. Multi-Tenant Isolation
  // ============================================================================
  describe("Multi-Tenant Isolation", () => {
    it("7.1 prevents Vivaham from viewing or querying Astrology social connections", () => {
      // Connect account in Astrology
      saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "astro_fb_page",
        accountName: "Gokul Astrology Page",
        pageId: "astro_fb_page",
        accessToken: "EAAB_astro_token",
      });

      // Query from Vivaham tenant
      const vivahamConns = getSocialConnectionsMemory(VIVAHAM_BIZ_ID);
      expect(vivahamConns).toHaveLength(0);

      // Query from Astrology tenant
      const astroConns = getSocialConnectionsMemory(ASTRO_BIZ_ID);
      expect(astroConns).toHaveLength(1);
      expect(astroConns[0].account_id).toBe("astro_fb_page");
    });

    it("7.2 blocks cross-tenant disconnection attempts (tenant mismatch guard)", () => {
      // Connect account in Astrology
      const astroConn = saveSocialConnectionMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        accountId: "astro_fb_page_secret",
        accountName: "Gokul Astrology Page",
        pageId: "astro_fb_page_secret",
        accessToken: "EAAB_astro_token",
      });

      // Vivaham attempts to disconnect Astrology's connection
      expect(() =>
        disconnectSocialAccountMemory(VIVAHAM_BIZ_ID, astroConn.id)
      ).toThrow(/Tenant mismatch.*does not belong to active business/i);
    });

    it("7.3 rejects invalid or unauthorized business tenant IDs", () => {
      expect(() =>
        getSocialConnectionsMemory("99999999-9999-9999-9999-999999999999")
      ).toThrow(/Unauthorized Tenant/i);
    });
  });

  // ============================================================================
  // 8. Server Actions Authorization & Workflow Tests
  // ============================================================================
  describe("Server Actions & Workflow Security", () => {
    it("8.1 initiateMetaOAuthAction generates valid OAuth URL for workspace owner", async () => {
      vi.spyOn(tenantGuard, "validateBusinessAccess").mockResolvedValueOnce({
        business: {
          id: ASTRO_BIZ_ID,
          name: "Gokul's Astrological Insights",
          slug: "astrology",
          description: "Vedic Astrology and Horoscopes",
          icon_name: "Sparkles",
          accent_color: "purple",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
        membership: {
          id: "mem_1",
          business_id: ASTRO_BIZ_ID,
          user_id: USER_ID,
          role: "owner",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        user: {
          id: USER_ID,
          email: "owner@astrology.com",
          full_name: "Astro Owner",
          avatar_url: null,
          is_superadmin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const res = await initiateMetaOAuthAction("astrology");
      expect(res.success).toBe(true);
      expect(res.authorizationUrl).toContain("https://www.facebook.com/v21.0/dialog/oauth");
      expect(res.authorizationUrl).toContain("client_id=");
      expect(res.authorizationUrl).toContain("state=");
    });

    it("8.2 rejects non-admin/non-owner members from initiating OAuth", async () => {
      vi.spyOn(tenantGuard, "validateBusinessAccess").mockResolvedValueOnce({
        business: {
          id: ASTRO_BIZ_ID,
          name: "Gokul's Astrological Insights",
          slug: "astrology",
          description: "Vedic Astrology and Horoscopes",
          icon_name: "Sparkles",
          accent_color: "purple",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
        membership: {
          id: "mem_2",
          business_id: ASTRO_BIZ_ID,
          user_id: "agent_user",
          role: "agent", // Not owner/admin
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        user: {
          id: "agent_user",
          email: "agent@astrology.com",
          full_name: "Astro Agent",
          avatar_url: null,
          is_superadmin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      const res = await initiateMetaOAuthAction("astrology");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Only workspace owners and administrators");
    });

    it("8.3 connectDiscoveredAccountAction connects chosen page and Instagram with tenant scoping", async () => {
      // 1. Stage discovery session
      const stagedPages = [
        {
          pageId: "page_vivaham_555",
          pageName: "Gokul Vivaham Matrimony",
          category: "Community",
          pageAccessToken: "EAAB_vivaham_secret_page_token",
          instagramAccount: {
            id: "ig_vivaham_777",
            username: "gokul_vivaham",
            name: "Gokul Vivaham",
            isEligible: true,
          },
        },
      ];

      const sessionId = stageDiscoveredPages(VIVAHAM_BIZ_ID, stagedPages);

      vi.spyOn(tenantGuard, "validateBusinessAccess").mockResolvedValue({
        business: {
          id: VIVAHAM_BIZ_ID,
          name: "Gokul Vivaham",
          slug: "vivaham",
          description: "Matrimonial Matchmaking Services",
          icon_name: "Heart",
          accent_color: "rose",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
        membership: {
          id: "mem_v1",
          business_id: VIVAHAM_BIZ_ID,
          user_id: "user_v1",
          role: "admin",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        user: {
          id: "user_v1",
          email: "admin@vivaham.com",
          full_name: "Vivaham Admin",
          avatar_url: null,
          is_superadmin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      // Connect both
      const connectRes = await connectDiscoveredAccountAction("vivaham", {
        sessionId,
        pageId: "page_vivaham_555",
        connectFacebook: true,
        connectInstagram: true,
      });

      expect(connectRes.success).toBe(true);
      expect(connectRes.connectedFacebook).toBe(true);
      expect(connectRes.connectedInstagram).toBe(true);

      // Verify connections in Vivaham
      const conns = getSocialConnectionsMemory(VIVAHAM_BIZ_ID);
      expect(conns).toHaveLength(2);
      expect(conns.some((c) => c.platform === "facebook")).toBe(true);
      expect(conns.some((c) => c.platform === "instagram")).toBe(true);

      // Verify discovery session was consumed/cleared
      expect(getStagedDiscoveredSession(sessionId)).toBeNull();
    });
  });

  // ============================================================================
  // 9. WhatsApp Regression Verification
  // ============================================================================
  describe("WhatsApp Regression Verification", () => {
    it("9.1 existing WhatsApp connections store remains intact and unaffected", () => {
      const astroWaConnections = getConnectionsForBusiness(ASTRO_BIZ_ID);
      expect(astroWaConnections.length).toBeGreaterThan(0);
      expect("platform" in astroWaConnections[0]).toBe(false); // WhatsApp connections do not have social platform discriminator
      expect(astroWaConnections[0].phone_number).toBeDefined();
      expect(astroWaConnections[0].business_id).toBe(ASTRO_BIZ_ID);

      const vivahamWaConnections = getConnectionsForBusiness(VIVAHAM_BIZ_ID);
      expect(vivahamWaConnections.length).toBeGreaterThan(0);
      expect(vivahamWaConnections[0].business_id).toBe(VIVAHAM_BIZ_ID);
    });

    it("9.2 WhatsApp webhook cryptographic signature verification remains fully operational", () => {
      const payload = JSON.stringify({ entry: [{ changes: [] }] });
      const hmac = crypto.createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
      const signatureHeader = `sha256=${hmac}`;

      const isValid = verifyMetaWebhookSignature(payload, signatureHeader, TEST_SECRET);
      expect(isValid).toBe(true);

      const isInvalid = verifyMetaWebhookSignature(payload, "sha256=tampered", TEST_SECRET);
      expect(isInvalid).toBe(false);
    });
  });
});
