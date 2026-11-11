import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";
import {
  globalRateLimiter,
  rateLimitLogin,
  rateLimitOutboundMessages,
  rateLimitSensitiveAction,
  rateLimitInvalidWebhookSignatures,
} from "@/lib/rate-limit/rate-limiter";
import { loginAction } from "@/app/actions/auth";

describe("Phase 3H — Pre-Production Security Remediation Suite", () => {
  // ============================================================================
  // DOMAIN 1: Webhook Event RLS & Cross-Business Isolation (PostgreSQL / PGlite)
  // ============================================================================
  describe("Domain 1: Webhook Event RLS & Unassigned Payload Security", () => {
    let db: PGlite;
    const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
    const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
    const USER_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Astrology Owner
    const USER_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // Vivaham Owner
    const SUPERADMIN_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // Superadmin

    beforeAll(async () => {
      db = new PGlite();

      // Setup PostgreSQL Auth Simulation
      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
          END IF;
        END
        $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id UUID PRIMARY KEY,
          email TEXT,
          raw_user_meta_data JSONB
        );

        CREATE OR REPLACE FUNCTION auth.uid()
        RETURNS UUID
        LANGUAGE sql
        STABLE
        AS $$
          SELECT current_setting('request.jwt.claim.sub', true)::UUID;
        $$;

        CREATE OR REPLACE FUNCTION auth.jwt()
        RETURNS JSONB
        LANGUAGE sql
        STABLE
        AS $$
          SELECT jsonb_build_object(
            'sub', current_setting('request.jwt.claim.sub', true),
            'role', 'authenticated'
          );
        $$;
      `);

      // Load Foundation Migrations 001 - 008
      const mig1 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_001_phase1_foundation.sql"), "utf8")
        .replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- native');
      const mig2 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_002_phase2_wa_connections.sql"), "utf8");
      const mig3 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_003_phase2_wa_credentials.sql"), "utf8");
      const mig4 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_004_phase2_privilege_escalation_guard.sql"), "utf8");
      const mig5 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_005_phase3_messaging_schema.sql"), "utf8");
      const mig6 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_006_phase3_webhook_persistence_rpcs.sql"), "utf8");
      const mig8 = fs.readFileSync(path.resolve("./supabase/migrations/20261106_008_phase3h_webhook_events_rls.sql"), "utf8");

      await db.exec(mig1);
      await db.exec(mig2);
      await db.exec(mig3);
      await db.exec(mig4);
      await db.exec(mig5);
      await db.exec(mig6);
      await db.exec(mig8);

      // Grant permissions & enforce RLS
      await db.exec(`
        GRANT USAGE ON SCHEMA auth TO authenticated;
        GRANT USAGE ON SCHEMA public TO authenticated;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

        ALTER TABLE public.wa_webhook_events FORCE ROW LEVEL SECURITY;
      `);

      // Seed Users & Businesses
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${USER_A_ID}', 'owner@astrology.com'),
          ('${USER_B_ID}', 'owner@vivaham.com'),
          ('${SUPERADMIN_ID}', 'superadmin@gokulconnect.com');

        UPDATE public.user_profiles SET full_name = 'Astro Owner', is_superadmin = FALSE WHERE id = '${USER_A_ID}';
        UPDATE public.user_profiles SET full_name = 'Vivaham Owner', is_superadmin = FALSE WHERE id = '${USER_B_ID}';
        UPDATE public.user_profiles SET full_name = 'Superadmin', is_superadmin = TRUE WHERE id = '${SUPERADMIN_ID}';

        INSERT INTO public.businesses (id, name, slug) VALUES
          ('${ASTRO_BIZ_ID}', 'Gokuls Astrological Insights', 'astrology'),
          ('${VIVAHAM_BIZ_ID}', 'Gokul Vivaham', 'vivaham')
        ON CONFLICT (id) DO NOTHING;

        DELETE FROM public.business_members WHERE user_id IN ('${USER_A_ID}', '${USER_B_ID}');
        INSERT INTO public.business_members (business_id, user_id, role, is_active) VALUES
          ('${ASTRO_BIZ_ID}', '${USER_A_ID}', 'owner', TRUE),
          ('${VIVAHAM_BIZ_ID}', '${USER_B_ID}', 'owner', TRUE);

        -- Seed Webhook Events: Assigned to Astrology, Assigned to Vivaham, and Unassigned
        INSERT INTO public.wa_webhook_events (id, business_id, phone_number_id, meta_event_id, event_type, payload, is_processed) VALUES
          ('11110000-0000-0000-0000-000000000001', '${ASTRO_BIZ_ID}', '15551234567', 'evt_astro_001', 'message', '{"body": "Astrology secret"}', TRUE),
          ('22220000-0000-0000-0000-000000000002', '${VIVAHAM_BIZ_ID}', '15559876543', 'evt_vivaham_002', 'message', '{"body": "Vivaham secret"}', TRUE),
          ('99990000-0000-0000-0000-000000000003', NULL, '15550000000', 'evt_unassigned_003', 'message', '{"body": "Unassigned inbound"}', FALSE);
      `);
    });

    async function runAsUser<T = any>(userId: string, sql: string, params: any[] = []): Promise<T[]> {
      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '${userId}';
      `);
      const res = await db.query<T>(sql, params);
      return res.rows;
    }

    it("User A (Astrology) can read only Astrology webhook events and CANNOT read unassigned events", async () => {
      const rows = await runAsUser(USER_A_ID, "SELECT meta_event_id, business_id FROM public.wa_webhook_events;");
      expect(rows.length).toBe(1);
      expect((rows[0] as any).meta_event_id).toBe("evt_astro_001");
      expect((rows[0] as any).business_id).toBe(ASTRO_BIZ_ID);
    });

    it("User B (Vivaham) can read only Vivaham webhook events and CANNOT read unassigned events", async () => {
      const rows = await runAsUser(USER_B_ID, "SELECT meta_event_id, business_id FROM public.wa_webhook_events;");
      expect(rows.length).toBe(1);
      expect((rows[0] as any).meta_event_id).toBe("evt_vivaham_002");
      expect((rows[0] as any).business_id).toBe(VIVAHAM_BIZ_ID);
    });

    it("Regular authenticated user CANNOT read unassigned events by filtering for NULL", async () => {
      const rows = await runAsUser(USER_A_ID, "SELECT * FROM public.wa_webhook_events WHERE business_id IS NULL;");
      expect(rows.length).toBe(0);
    });

    it("Superadmin CAN read assigned AND unassigned webhook events", async () => {
      const rows = await runAsUser(SUPERADMIN_ID, "SELECT meta_event_id FROM public.wa_webhook_events ORDER BY meta_event_id ASC;");
      expect(rows.length).toBe(3);
      const eventIds = rows.map((r: any) => r.meta_event_id);
      expect(eventIds).toContain("evt_astro_001");
      expect(eventIds).toContain("evt_vivaham_002");
      expect(eventIds).toContain("evt_unassigned_003");
    });

    it("Privileged SECURITY DEFINER ingestion function continues to ingest unassigned events without error", async () => {
      await db.exec("RESET ROLE;");
      const res = await db.query(`
        SELECT public.ingest_wa_inbound_message(
          '999999999999999',
          'wamid_unassigned_test_999',
          '919876543210',
          'Unrecognized User',
          'text',
          'Inbound to unmapped number',
          '{}'::jsonb
        ) as result;
      `);

      const result = (res.rows[0] as any)?.result;
      expect(result.status).toBe("unregistered_phone");

      // Verify the unassigned row created in wa_webhook_events has business_id = NULL
      const unassignedRows = await db.query(
        "SELECT business_id, is_processed FROM public.wa_webhook_events WHERE meta_event_id = 'wamid_unassigned_test_999';"
      );
      expect(unassignedRows.rows.length).toBe(1);
      expect((unassignedRows.rows[0] as any).business_id).toBeNull();
    });
  });

  // ============================================================================
  // DOMAIN 2: Webhook Fail-Closed Security & Timing-Safe Verification
  // ============================================================================
  describe("Domain 2: Webhook Fail-Closed Security", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      globalRateLimiter.clear();
    });

    it("should reject POST with 500 when META_APP_SECRET is missing in production", async () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.META_APP_SECRET;

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object: "whatsapp_business_account" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toBe("Server configuration error");
      // Never expose secrets or config names
      expect(text).not.toContain("META_APP_SECRET");
    });

    it("should reject POST with 500 in dev when META_APP_SECRET is missing and ALLOW_INSECURE_WEBHOOKS is false", async () => {
      (process.env as any).NODE_ENV = "development";
      delete process.env.META_APP_SECRET;
      delete process.env.ALLOW_INSECURE_WEBHOOKS;

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object: "whatsapp_business_account" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("Server configuration error");
    });

    it("should reject POST with 401 when signature is invalid or tampered", async () => {
      process.env.META_APP_SECRET = "production_secret_key_12345";

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
        body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Invalid signature");
    });

    it("should accept POST with 200 when signature matches valid HMAC-SHA256", async () => {
      const secret = "production_secret_key_12345";
      process.env.META_APP_SECRET = secret;

      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  // ============================================================================
  // DOMAIN 3: Rate Limiting Enforcement
  // ============================================================================
  describe("Domain 3: Server-Side Rate Limiting", () => {
    beforeEach(() => {
      globalRateLimiter.clear();
    });

    it("Login rate limiter permits up to 5 attempts then throttles 6th attempt", () => {
      const userKey = "test-agent@gokulconnect.com";

      for (let i = 1; i <= 5; i++) {
        const result = rateLimitLogin(userKey);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(5 - i);
      }

      const blocked = rateLimitLogin(userKey);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("loginAction rejects when rate limit is exceeded", async () => {
      const email = "attacker@badactor.com";

      // Exhaust 5 attempts
      for (let i = 0; i < 5; i++) {
        rateLimitLogin(email);
      }

      const res = await loginAction({ email, password: "wrong_password" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Too many login attempts");
      expect(res.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("Outbound message rate limiter permits up to 30 messages then throttles", () => {
      const bizId = "test-biz-uuid-1";

      for (let i = 1; i <= 30; i++) {
        const result = rateLimitOutboundMessages(bizId);
        expect(result.success).toBe(true);
      }

      const blocked = rateLimitOutboundMessages(bizId);
      expect(blocked.success).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("Sensitive action rate limiter permits up to 15 mutations then throttles", () => {
      const bizId = "test-biz-uuid-2";

      for (let i = 1; i <= 15; i++) {
        const result = rateLimitSensitiveAction(bizId, "create_connection");
        expect(result.success).toBe(true);
      }

      const blocked = rateLimitSensitiveAction(bizId, "create_connection");
      expect(blocked.success).toBe(false);
    });

    it("Invalid webhook signature limiter blocks IP after 10 failed attempts", () => {
      const attackerIp = "198.51.100.42";

      for (let i = 1; i <= 10; i++) {
        const res = rateLimitInvalidWebhookSignatures(attackerIp);
        expect(res.success).toBe(true);
      }

      const blocked = rateLimitInvalidWebhookSignatures(attackerIp);
      expect(blocked.success).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(200); // 5 min block
    });
  });

  // ============================================================================
  // DOMAIN 4: Authentication Sign-Out & Cookie Invalidation
  // ============================================================================
  describe("Domain 4: Session Invalidation & Sign-Out", () => {
    it("GET /api/auth/signout purges cookies and redirects with 303 to /login", async () => {
      const { GET: signOutGet } = await import("@/app/api/auth/signout/route");

      const req = new NextRequest("http://localhost:3000/api/auth/signout", {
        method: "GET",
        headers: {
          cookie: "sb-ansiwtwqgrfmzfrhkzuu-auth-token=active_jwt_token_12345",
        },
      });

      const res = await signOutGet(req);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toContain("/login");

      // Verify Set-Cookie header expires the auth token
      const setCookies = res.headers.get("set-cookie") || "";
      expect(setCookies.toLowerCase()).toContain("max-age=0");
    });
  });

  // ============================================================================
  // DOMAIN 5: Security-Sensitive Server Input Validation (Zod Schemas)
  // ============================================================================
  describe("Domain 5: Input Validation & Injection Protection", () => {
    it("LoginInputSchema enforces valid email format and non-empty password", async () => {
      const { LoginInputSchema } = await import("@/lib/validation/schemas");

      const valid = LoginInputSchema.safeParse({
        email: "Owner@GokulConnect.com  ",
        password: "MySecurePassword123!",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe("owner@gokulconnect.com");
      }

      const invalidEmail = LoginInputSchema.safeParse({
        email: "not-an-email",
        password: "secretpassword",
      });
      expect(invalidEmail.success).toBe(false);

      const emptyPassword = LoginInputSchema.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(emptyPassword.success).toBe(false);
    });

    it("CreateWhatsAppConnectionSchema rejects non-digit IDs and short access tokens", async () => {
      const { CreateWhatsAppConnectionSchema } = await import("@/lib/validation/schemas");

      const valid = CreateWhatsAppConnectionSchema.safeParse({
        display_name: "Astro Primary Number",
        phone_number: "+91 98400 12345",
        phone_number_id: "1234567890",
        waba_id: "9876543210",
        access_token: "EAABtest_secret_token_at_least_20_chars",
        description: "Primary support line",
      });
      expect(valid.success).toBe(true);

      // Rejects non-digit phone_number_id
      const badPhoneId = CreateWhatsAppConnectionSchema.safeParse({
        display_name: "Test",
        phone_number: "+91 98400 12345",
        phone_number_id: "invalid-id-with-chars",
        waba_id: "9876543210",
        access_token: "EAABtest_secret_token_at_least_20_chars",
      });
      expect(badPhoneId.success).toBe(false);

      // Rejects token under 20 characters
      const shortToken = CreateWhatsAppConnectionSchema.safeParse({
        display_name: "Test",
        phone_number: "+91 98400 12345",
        phone_number_id: "1234567890",
        waba_id: "9876543210",
        access_token: "short_token",
      });
      expect(shortToken.success).toBe(false);
    });

    it("SendWhatsAppMessageInputSchema rejects requests missing both text and template", async () => {
      const { SendWhatsAppMessageInputSchema } = await import("@/lib/validation/schemas");

      const valid = SendWhatsAppMessageInputSchema.safeParse({
        businessSlug: "astrology",
        connectionId: "conn-123",
        recipientPhone: "+919840012345",
        text: "Hello from Gokul Connect!",
      });
      expect(valid.success).toBe(true);

      const neitherTextNorTemplate = SendWhatsAppMessageInputSchema.safeParse({
        businessSlug: "astrology",
        connectionId: "conn-123",
        recipientPhone: "+919840012345",
      });
      expect(neitherTextNorTemplate.success).toBe(false);

      // Rejects text exceeding 4096 characters
      const oversized = SendWhatsAppMessageInputSchema.safeParse({
        businessSlug: "astrology",
        connectionId: "conn-123",
        recipientPhone: "+919840012345",
        text: "a".repeat(4097),
      });
      expect(oversized.success).toBe(false);

      // Rejects malicious businessSlug with traversal/injection characters
      const badSlug = SendWhatsAppMessageInputSchema.safeParse({
        businessSlug: "../../../etc/passwd",
        connectionId: "conn-123",
        recipientPhone: "+919840012345",
        text: "test",
      });
      expect(badSlug.success).toBe(false);
    });

    it("UpdateConversationStatusSchema restricts status to allowed enum values", async () => {
      const { UpdateConversationStatusSchema } = await import("@/lib/validation/schemas");

      const valid = UpdateConversationStatusSchema.safeParse({
        businessSlug: "vivaham",
        conversationId: "conv-123",
        status: "closed",
      });
      expect(valid.success).toBe(true);

      const invalidStatus = UpdateConversationStatusSchema.safeParse({
        businessSlug: "vivaham",
        conversationId: "conv-123",
        status: "unauthorized_arbitrary_status",
      });
      expect(invalidStatus.success).toBe(false);
    });
  });
});
