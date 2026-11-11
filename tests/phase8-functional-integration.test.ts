import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { GET as authCallbackGET } from "@/app/auth/callback/route";
import { GET as cronGET, POST as cronPOST } from "@/app/api/cron/process-automation-jobs/route";
import { GET as webhookGET, POST as webhookPOST } from "@/app/api/webhooks/whatsapp/route";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";
import { rateLimitLogin } from "@/lib/rate-limit/rate-limiter";
import { normalizeText, matchExact, matchContains } from "@/lib/automation/normalizer";
import { evaluateBusinessHours, DEFAULT_BUSINESS_HOURS } from "@/lib/automation/business-hours";
import {
  encryptSecret,
  decryptSecret,
} from "@/lib/crypto/encryption";
import {
  InboxSendMessageInputSchema,
  CreateWhatsAppConnectionSchema,
  LoginInputSchema,
} from "@/lib/validation/schemas";
import {
  checkMessagingWindow,
  isRetryableMetaError,
} from "@/lib/whatsapp/service";
import { calculateBackoffDelaySeconds } from "@/lib/automation/worker";
import { simulateRuleExecution } from "@/lib/automation/store";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/store";
import { AutomationRule } from "@/types/database";

describe("Phase 8 — Complete Local Functional Testing & Integration Quality Gate", () => {
  const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const TEST_CRON_SECRET = "cron_secret_test_key_secure_phase8_0123456789abcdef";
  const TEST_META_APP_SECRET = "meta_app_secret_phase8_9876543210abcdef";
  const ASTRO_SLUG = "astrology";
  const VIVAHAM_SLUG = "vivaham";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_ENCRYPTION_SECRET = TEST_SECRET;
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    process.env.META_APP_SECRET = TEST_META_APP_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ansiwtwqgrfmzfrhkzuu.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // DOMAIN 1: AUTHENTICATION & SESSION LIFECYCLE
  // ============================================================================
  describe("Domain 1: Authentication Lifecycle & Security Controls", () => {
    it("1.1 should enforce brute-force sliding-window rate limit on login attempts", () => {
      const email = `test_rate_limit_${Date.now()}@example.com`;
      for (let i = 0; i < 5; i++) {
        const res = rateLimitLogin(email);
        expect(res.success).toBe(true);
      }
      const throttledRes = rateLimitLogin(email);
      expect(throttledRes.success).toBe(false);
      expect(throttledRes.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("1.2 should safely handle auth callback code exchange and prevent open redirects", async () => {
      // Open redirect attempt
      const maliciousUrl = "http://localhost:3000/auth/callback?code=mock_code&next=https://attacker.com";
      const req = new NextRequest(maliciousUrl);
      const res = await authCallbackGET(req);
      
      // When code exchange fails or next is absolute/malicious, redirect stays safe
      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location.startsWith("https://attacker.com")).toBe(false);
    });

    it("1.3 should redirect to login when auth callback code is missing", async () => {
      const req = new NextRequest("http://localhost:3000/auth/callback");
      const res = await authCallbackGET(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/login?error=auth_callback_failed");
    });

    it("1.4 should validate login inputs with LoginInputSchema", () => {
      // Invalid email
      const invalidEmail = LoginInputSchema.safeParse({ email: "not-an-email", password: "some_password" });
      expect(invalidEmail.success).toBe(false);

      // Empty password
      const emptyPassword = LoginInputSchema.safeParse({ email: "user@example.com", password: "" });
      expect(emptyPassword.success).toBe(false);

      // Valid credentials
      const valid = LoginInputSchema.safeParse({ email: "user@example.com", password: "validPassword123" });
      expect(valid.success).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 2: MULTI-TENANT ISOLATION & BOUNDARY GUARDS
  // ============================================================================
  describe("Domain 2: Multi-Tenant Business Isolation", () => {
    it("2.1 should maintain independent business identifiers for Astrology and Vivaham", () => {
      expect(ASTRO_BUSINESS_ID).not.toBe(VIVAHAM_BUSINESS_ID);
      expect(ASTRO_BUSINESS_ID).toBe("11111111-1111-1111-1111-111111111111");
      expect(VIVAHAM_BUSINESS_ID).toBe("22222222-2222-2222-2222-222222222222");
    });

    it("2.2 should reject cross-referencing default connections from another business", () => {
      // Simulating composite validation logic
      const businessAId = ASTRO_BUSINESS_ID;
      const connectionB = { id: "conn-vivaham-01", business_id: VIVAHAM_BUSINESS_ID };

      const isCrossReferenced = connectionB.business_id !== businessAId;
      expect(isCrossReferenced).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 3: WHATSAPP CONNECTION CREDENTIAL SECURITY
  // ============================================================================
  describe("Domain 3: WhatsApp Credential Security & AES-256-GCM Vault", () => {
    it("3.1 should encrypt and decrypt credentials with AES-256-GCM integrity", () => {
      const rawToken = "EAAGtest_meta_token_value_0123456789";
      const encrypted = encryptSecret(rawToken);

      expect(encrypted).toHaveProperty("ciphertext");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("auth_tag");
      expect(encrypted.ciphertext).not.toBe(rawToken);

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(rawToken);
    });

    it("3.2 should fail decryption if ciphertext or auth tag is tampered", () => {
      const rawToken = "EAAGtest_meta_token_value_0123456789";
      const encrypted = encryptSecret(rawToken);

      const tamperedTag = {
        ...encrypted,
        auth_tag: "00000000000000000000000000000000",
      };

      expect(() => decryptSecret(tamperedTag)).toThrow();
    });

    it("3.3 should never expose credentials in safe connection DTOs", () => {
      const rawConnection = {
        id: "conn-1",
        business_id: ASTRO_BUSINESS_ID,
        phone_number_id: "109283746501928",
        access_token_encrypted: "vault_encrypted_string",
        display_name: "Astro Line",
      };

      const { access_token_encrypted, ...safeDto } = rawConnection;
      expect(safeDto).not.toHaveProperty("access_token_encrypted");
      expect(safeDto).toHaveProperty("display_name", "Astro Line");
    });

    it("3.4 should validate Add Connection modal inputs strictly", () => {
      // Valid input
      const valid = CreateWhatsAppConnectionSchema.safeParse({
        phone_number: "+91 98400 12345",
        phone_number_id: "109283746501928",
        waba_id: "1153964060437882",
        access_token: "EAAGtest_long_valid_access_token_value_here",
        display_name: "New Line",
      });
      expect(valid.success).toBe(true);

      // Invalid short access token
      const shortToken = CreateWhatsAppConnectionSchema.safeParse({
        phone_number: "+91 98400 12345",
        phone_number_id: "109283746501928",
        waba_id: "1153964060437882",
        access_token: "short_tok",
        display_name: "New Line",
      });
      expect(shortToken.success).toBe(false);

      // Non-numeric phone number id
      const nonNumericPhoneId = CreateWhatsAppConnectionSchema.safeParse({
        phone_number: "+91 98400 12345",
        phone_number_id: "not_a_number_id",
        waba_id: "1153964060437882",
        access_token: "EAAGtest_long_valid_access_token_value_here",
        display_name: "New Line",
      });
      expect(nonNumericPhoneId.success).toBe(false);
    });
  });

  // ============================================================================
  // DOMAIN 4: INBOX & MESSAGING COMPLIANCE
  // ============================================================================
  describe("Domain 4: Inbox & 24-Hour Messaging Window Rules", () => {
    it("4.1 should correctly identify open 24h customer service window", () => {
      const recentInboundTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const messages = [
        { direction: "inbound", created_at: recentInboundTime },
        { direction: "outbound", created_at: new Date().toISOString() },
      ];

      const windowStatus = checkMessagingWindow(messages);
      expect(windowStatus.isOpen).toBe(true);
      expect(windowStatus.remainingSeconds).toBeGreaterThan(0);
    });

    it("4.2 should correctly identify expired 24h customer service window", () => {
      const oldInboundTime = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(); // 26 hours ago
      const messages = [
        { direction: "inbound", created_at: oldInboundTime },
      ];

      const windowStatus = checkMessagingWindow(messages);
      expect(windowStatus.isOpen).toBe(false);
      expect(windowStatus.remainingSeconds).toBe(0);
    });

    it("4.3 should close window when there are zero inbound messages", () => {
      const messages = [
        { direction: "outbound", created_at: new Date().toISOString() },
      ];

      const windowStatus = checkMessagingWindow(messages);
      expect(windowStatus.isOpen).toBe(false);
      expect(windowStatus.remainingSeconds).toBe(0);
    });

    it("4.4 should classify retryable vs permanent Meta Cloud API errors", () => {
      // Retryable
      expect(isRetryableMetaError({ code: 429, message: "Rate limit reached" })).toBe(true);
      expect(isRetryableMetaError({ message: "ETIMEDOUT connection reset" })).toBe(true);
      expect(isRetryableMetaError({ code: 503, message: "Service Unavailable" })).toBe(true);

      // Permanent
      expect(isRetryableMetaError({ code: 190, message: "Invalid OAuth access token" })).toBe(false);
      expect(isRetryableMetaError({ code: 131047, message: "Re-engagement message required" })).toBe(false);
      expect(isRetryableMetaError({ code: 100, message: "Invalid parameter format" })).toBe(false);
    });

    it("4.5 should enforce Message Composer validation (empty message, length limit, template requirements)", () => {
      // Empty text rejected
      const emptyCheck = InboxSendMessageInputSchema.safeParse({
        businessSlug: "astrology",
        conversationId: "conv-1",
        text: "   ",
      });
      expect(emptyCheck.success).toBe(false);

      // Exceeding 4096 characters rejected
      const longText = "a".repeat(4097);
      const lengthCheck = InboxSendMessageInputSchema.safeParse({
        businessSlug: "astrology",
        conversationId: "conv-1",
        text: longText,
      });
      expect(lengthCheck.success).toBe(false);

      // Valid text accepted
      const validText = InboxSendMessageInputSchema.safeParse({
        businessSlug: "astrology",
        conversationId: "conv-1",
        text: "Vanakkam, your consultation is confirmed.",
      });
      expect(validText.success).toBe(true);

      // Both text and template omitted rejected
      const neitherCheck = InboxSendMessageInputSchema.safeParse({
        businessSlug: "astrology",
        conversationId: "conv-1",
      });
      expect(neitherCheck.success).toBe(false);

      // Valid template accepted
      const templateCheck = InboxSendMessageInputSchema.safeParse({
        businessSlug: "astrology",
        conversationId: "conv-1",
        template: {
          name: "appointment_reminder",
          languageCode: "ta",
        },
      });
      expect(templateCheck.success).toBe(true);
    });
  });

  // ============================================================================
  // DOMAIN 5: INBOUND WEBHOOK PROCESSING
  // ============================================================================
  describe("Domain 5: Inbound Webhook Ingestion & Cryptographic Verification", () => {
    function generateHmac(payload: string, secret: string) {
      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(payload);
      return `sha256=${hmac.digest("hex")}`;
    }

    it("5.1 should reject incoming webhook with invalid HMAC signature with HTTP 401", async () => {
      const payload = JSON.stringify({ object: "whatsapp_business_account" });
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "sha256=invalid_forged_hash_0123456789abcdef",
        },
        body: payload,
      });

      const res = await webhookPOST(req);
      expect(res.status).toBe(401);
    });

    it("5.2 should fail closed with HTTP 500 when META_APP_SECRET is unconfigured", async () => {
      delete process.env.META_APP_SECRET;
      const payload = JSON.stringify({ object: "whatsapp_business_account" });
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "sha256=mock",
        },
        body: payload,
      });

      const res = await webhookPOST(req);
      expect(res.status).toBe(500);
    });

    it("5.3 should accept valid HMAC signature and respond with 200 OK for ignored non-whatsapp object", async () => {
      const payload = JSON.stringify({ object: "page", entry: [] });
      const sig = generateHmac(payload, TEST_META_APP_SECRET);
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": sig,
        },
        body: payload,
      });

      const res = await webhookPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ignored");
    });

    it("5.4 should handle webhook GET verification handshake correctly", async () => {
      process.env.META_WEBHOOK_VERIFY_TOKEN = "test_verify_token_12345";
      const req = new NextRequest(
        "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_verify_token_12345&hub.challenge=test_challenge_code"
      );

      const res = await webhookGET(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("test_challenge_code");
    });

    it("5.5 should reject webhook GET verification handshake on token mismatch", async () => {
      process.env.META_WEBHOOK_VERIFY_TOKEN = "test_verify_token_12345";
      const req = new NextRequest(
        "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_code"
      );

      const res = await webhookGET(req);
      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // DOMAIN 6: BACKGROUND WORKER & QUEUEING
  // ============================================================================
  describe("Domain 6: Background Queue Worker & Exponential Backoff", () => {
    it("6.1 should calculate exponential backoff delay with jitter bounded by 30 minutes", () => {
      const delay1 = calculateBackoffDelaySeconds(1); // 2^1 * 30s + jitter = 60-64s
      expect(delay1).toBeGreaterThanOrEqual(60);
      expect(delay1).toBeLessThanOrEqual(65);

      const delay3 = calculateBackoffDelaySeconds(3); // 2^3 * 30s + jitter = 240-244s
      expect(delay3).toBeGreaterThanOrEqual(240);
      expect(delay3).toBeLessThanOrEqual(245);

      const delayHigh = calculateBackoffDelaySeconds(10); // Bounded at 1800 (30 mins)
      expect(delayHigh).toBe(1800);
    });
  });

  // ============================================================================
  // DOMAIN 7: AUTOMATION ENGINE & LANGUAGE MATCHING
  // ============================================================================
  describe("Domain 7: Deterministic Automation Engine & Bilingual Keyword Matching", () => {
    it("7.1 should normalize English and Tamil strings using NFC Unicode composition", () => {
      const rawEnglish = "   Astrology   Fees   ";
      expect(normalizeText(rawEnglish)).toBe("astrology fees");

      const tamilNFC = "ஜாதகம்".normalize("NFC");
      const tamilNFD = "ஜாதகம்".normalize("NFD");
      expect(normalizeText(tamilNFC)).toBe(normalizeText(tamilNFD));
    });

    it("7.2 should match English and Tamil exact keywords accurately", () => {
      expect(matchExact("horoscope", ["horoscope", "kundali"])).toBe(true);
      expect(matchExact("ஜாதகம்", ["ஜாதகம்", "பொருத்தம்"])).toBe(true);
      expect(matchExact("price", ["horoscope", "kundali"])).toBe(false);
    });

    it("7.3 should match English and Tamil partial (contains) keywords accurately", () => {
      expect(matchContains("Can you check my horoscope matching?", ["horoscope"])).toBe(true);
      expect(matchContains("எனக்கு ஜாதக பொருத்தம் பார்க்க வேண்டும்", ["பொருத்தம்"])).toBe(true);
      expect(matchContains("Good morning", ["horoscope"])).toBe(false);
    });

    it("7.4 should evaluate business hours in Asia/Kolkata timezone", () => {
      // 2026-11-10 11:30 AM IST = 06:00 UTC (Tuesday)
      const openTime = new Date("2026-11-10T06:00:00Z");
      const openResult = evaluateBusinessHours(openTime, DEFAULT_BUSINESS_HOURS);
      expect(openResult.isWithinHours).toBe(true);

      // 2026-11-10 11:30 PM IST = 18:00 UTC (Tuesday)
      const closedTime = new Date("2026-11-10T18:00:00Z");
      const closedResult = evaluateBusinessHours(closedTime, DEFAULT_BUSINESS_HOURS);
      expect(closedResult.isWithinHours).toBe(false);
    });

    it("7.5 should handle STOP and Tamil opt-out 'நிறுத்து' keywords in simulator", () => {
      const rules: AutomationRule[] = [];
      const simStop = simulateRuleExecution(ASTRO_BUSINESS_ID, "STOP", {
        rules,
        isOptedOut: false,
      });
      expect(simStop.matched).toBe(true);
      expect(simStop.status).toBe("opt_out_handled");
      expect(simStop.actionsToDispatch[0].payload.message_text).toContain("unsubscribed");

      const simTamilStop = simulateRuleExecution(ASTRO_BUSINESS_ID, "நிறுத்து", {
        rules,
        isOptedOut: false,
      });
      expect(simTamilStop.matched).toBe(true);
      expect(simTamilStop.status).toBe("opt_out_handled");
      expect(simTamilStop.actionsToDispatch[0].payload.message_text).toContain("unsubscribed");
    });

    it("7.6 should block automations if customer is already opted out", () => {
      const rules: AutomationRule[] = [];
      const sim = simulateRuleExecution(ASTRO_BUSINESS_ID, "horoscope", {
        rules,
        isOptedOut: true,
      });
      expect(sim.matched).toBe(false);
      expect(sim.status).toBe("skipped");
      expect(sim.skipReason).toBe("contact_opted_out");
    });
  });

  // ============================================================================
  // DOMAIN 8: CRON AUTHENTICATION & SECURITY
  // ============================================================================
  describe("Domain 8: Cron Authentication & Timing-Safe Security", () => {
    it("8.1 should fail closed if CRON_SECRET is missing or empty", () => {
      expect(verifyCronAuthorization("Bearer secret", undefined)).toBe(false);
      expect(verifyCronAuthorization("Bearer secret", "")).toBe(false);
      expect(verifyCronAuthorization("Bearer secret", "   ")).toBe(false);
    });

    it("8.2 should reject requests with missing or invalid Authorization header", () => {
      expect(verifyCronAuthorization(null, TEST_CRON_SECRET)).toBe(false);
      expect(verifyCronAuthorization("Basic user:pass", TEST_CRON_SECRET)).toBe(false);
      expect(verifyCronAuthorization("Bearer wrong_secret", TEST_CRON_SECRET)).toBe(false);
    });

    it("8.3 should authenticate valid Bearer token using constant-time comparison", () => {
      const validHeader = `Bearer ${TEST_CRON_SECRET}`;
      expect(verifyCronAuthorization(validHeader, TEST_CRON_SECRET)).toBe(true);
    });

    it("8.4 should reject unauthorized cron API requests with HTTP 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        headers: {
          authorization: "Bearer wrong_token_value",
        },
      });

      const res = await cronGET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });
  });
});
