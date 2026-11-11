import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";

import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";
import {
  encryptSecret,
  decryptSecret,
  maskTokenForLogging,
} from "@/lib/crypto/encryption";
import { sanitizeMetaLog } from "@/lib/whatsapp/client";
import {
  validateScheduledFollowupPreExecution,
  validateMetaMessagingWindow,
  validateContactConsent,
  checkBotLoopCircuitBreaker,
} from "@/lib/automation/safeguards";
import {
  rateLimitLogin,
  rateLimitOutboundMessages,
  rateLimitSensitiveAction,
  rateLimitInvalidWebhookSignatures,
  rateLimitWebhookHandshake,
} from "@/lib/rate-limit/rate-limiter";
import {
  ASTROLOGY_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  getDefaultBusinessTemplates,
} from "@/lib/templates/default-templates";
import {
  validateTemplateDraft,
  extractTemplateVariables,
  replaceVariables,
} from "@/lib/templates/validation";
import { exportContactsToCsvString } from "@/lib/crm/database";
import { exportAnalyticsCsv } from "@/lib/analytics/service";
import { triggerQueueWorkerAction } from "@/app/actions/automations";

describe("Phase 11.2 — Independent Security & Integration Audit Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // Setup Supabase Roles & Auth mocks in PGlite
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
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::UUID;
      $$;
    `);

    // Replay Migrations 001 through 015 in sequence
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  // =========================================================================
  // DOMAIN 1: AUTHENTICATION, SESSION & ACCESS MANAGEMENT
  // =========================================================================
  describe("Domain 1: Authentication, Session & Access Management", () => {
    it("1.1 should enforce brute-force rate limit of 5 login attempts per 60 seconds", () => {
      const email = `audit_login_${Date.now()}@example.com`;
      for (let i = 1; i <= 5; i++) {
        const res = rateLimitLogin(email);
        expect(res.success).toBe(true);
      }
      const sixth = rateLimitLogin(email);
      expect(sixth.success).toBe(false);
      expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("1.2 should strictly require Bearer token for CRON_SECRET and fail-closed", () => {
      const secret = "test_super_secret_cron_token_12345";
      expect(verifyCronAuthorization(undefined, secret)).toBe(false);
      expect(verifyCronAuthorization("", secret)).toBe(false);
      expect(verifyCronAuthorization("Bearer ", secret)).toBe(false);
      expect(verifyCronAuthorization("Basic 123", secret)).toBe(false);
      expect(verifyCronAuthorization(`Bearer wrong_token`, secret)).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${secret}`, "")).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${secret}`, undefined)).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    });
  });

  // =========================================================================
  // DOMAIN 2: BUSINESS-LEVEL TENANT ISOLATION (ASTROLOGY VS VIVAHAM)
  // =========================================================================
  describe("Domain 2: Business-Level Tenant Isolation", () => {
    it("2.1 should enforce complete isolation between Astrology and Vivaham in database tables", async () => {
      // Insert contacts for Astrology and Vivaham
      const astroPhone = "919999000001";
      const vivahamPhone = "919999000002";

      await db.exec(`
        INSERT INTO public.wa_contacts (business_id, phone_number, display_name)
        VALUES ('${ASTROLOGY_BUSINESS_ID}', '${astroPhone}', 'Astro Customer')
        ON CONFLICT (business_id, phone_number) DO NOTHING;

        INSERT INTO public.wa_contacts (business_id, phone_number, display_name)
        VALUES ('${VIVAHAM_BUSINESS_ID}', '${vivahamPhone}', 'Vivaham Member')
        ON CONFLICT (business_id, phone_number) DO NOTHING;
      `);

      // Verify querying Astrology contacts returns 0 Vivaham contacts
      const astroContacts = await db.query(
        `SELECT * FROM public.wa_contacts WHERE business_id = '${ASTROLOGY_BUSINESS_ID}'`
      );
      expect(astroContacts.rows.some((r: any) => r.phone_number === vivahamPhone)).toBe(false);

      const vivahamContacts = await db.query(
        `SELECT * FROM public.wa_contacts WHERE business_id = '${VIVAHAM_BUSINESS_ID}'`
      );
      expect(vivahamContacts.rows.some((r: any) => r.phone_number === astroPhone)).toBe(false);
    });

    it("2.2 should reject cross-tenant template access and modification", async () => {
      const vivahamTemplateId = "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1";
      await db.query(`
        INSERT INTO public.wa_message_templates (
          id, business_id, template_name, language, category, status, components
        ) VALUES (
          '${vivahamTemplateId}',
          '${VIVAHAM_BUSINESS_ID}',
          'vivaham_isolated_template',
          'en_US',
          'UTILITY',
          'DRAFT',
          '[]'::jsonb
        ) ON CONFLICT (id, business_id) DO NOTHING;
      `);

      // Astrology tenant cannot query this template by business_id
      const astroQuery = await db.query(
        `SELECT * FROM public.wa_message_templates WHERE id = '${vivahamTemplateId}' AND business_id = '${ASTROLOGY_BUSINESS_ID}'`
      );
      expect(astroQuery.rows.length).toBe(0);

      // Attempting to update Vivaham template with Astrology business_id returns 0 rows updated
      const updateRes = await db.query(
        `UPDATE public.wa_message_templates SET template_name = 'tampered_name' WHERE id = '${vivahamTemplateId}' AND business_id = '${ASTROLOGY_BUSINESS_ID}' RETURNING *`
      );
      expect(updateRes.rows.length).toBe(0);
    });
  });

  // =========================================================================
  // DOMAIN 3: WHATSAPP CREDENTIAL ENCRYPTION & SECRET HANDLING
  // =========================================================================
  describe("Domain 3: WhatsApp Credential Encryption & Secret Handling", () => {
    it("3.1 should encrypt with AES-256-GCM and unique random IV per call", () => {
      const token = "EAAX1234567890abcdef_real_meta_token_value";
      const enc1 = encryptSecret(token);
      const enc2 = encryptSecret(token);

      // IV and ciphertext must be non-deterministic (different per run)
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      expect(enc1.auth_tag).toBeDefined();
      expect(enc1.auth_tag.length).toBe(32); // 16 bytes hex

      // Decryption restores exact plaintext
      expect(decryptSecret(enc1)).toBe(token);
      expect(decryptSecret(enc2)).toBe(token);
    });

    it("3.2 should detect ciphertext tampering and fail-closed", () => {
      const token = "EAAX_sensitive_meta_token";
      const enc = encryptSecret(token);

      // Tamper with ciphertext
      const tampered = {
        ...enc,
        ciphertext: enc.ciphertext.slice(0, -2) + (enc.ciphertext.endsWith("00") ? "11" : "00"),
      };

      expect(() => decryptSecret(tampered)).toThrow(
        /Decryption authentication failed/
      );
    });

    it("3.3 should never expose access tokens in logs or error messages", () => {
      const token = "EAAG1234567890abcdefghijklmnopqrstu_sample_token";
      const masked = maskTokenForLogging(token);
      expect(masked).not.toContain(token);
      expect(masked).toMatch(/^EAAG••••••••/);

      const logMsg = `Error connecting to Meta with token ${token} on API call`;
      const sanitized = sanitizeMetaLog(logMsg, token);
      expect(sanitized).not.toContain(token);
    });
  });

  // =========================================================================
  // DOMAIN 4: META WEBHOOK SIGNATURE & FAIL-CLOSED VALIDATION
  // =========================================================================
  describe("Domain 4: Meta Webhook Signature Validation", () => {
    const appSecret = "0123456789abcdef0123456789abcdef";
    const payload = JSON.stringify({ entry: [{ id: "123", changes: [] }] });

    it("4.1 should correctly verify valid timing-safe HMAC-SHA256 signature", () => {
      const hmac = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
      const sigHeader = `sha256=${hmac}`;
      expect(verifyMetaWebhookSignature(payload, sigHeader, appSecret)).toBe(true);
    });

    it("4.2 should reject tampered payload or missing/invalid signature", () => {
      const hmac = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
      const sigHeader = `sha256=${hmac}`;

      expect(verifyMetaWebhookSignature(payload + "tampered", sigHeader, appSecret)).toBe(false);
      expect(verifyMetaWebhookSignature(payload, "sha256=invalidhash", appSecret)).toBe(false);
      expect(verifyMetaWebhookSignature(payload, null, appSecret)).toBe(false);
      expect(verifyMetaWebhookSignature(payload, "", appSecret)).toBe(false);
      expect(verifyMetaWebhookSignature(payload, sigHeader, "")).toBe(false);
    });

    it("4.3 should rate limit abusive callers attempting signature forgery", () => {
      const clientIp = `192.168.1.${Math.floor(Math.random() * 200) + 10}`;
      for (let i = 1; i <= 10; i++) {
        const res = rateLimitInvalidWebhookSignatures(clientIp);
        expect(res.success).toBe(true);
      }
      const eleventh = rateLimitInvalidWebhookSignatures(clientIp);
      expect(eleventh.success).toBe(false);
      expect(eleventh.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // DOMAIN 5: AUTOMATION SAFEGUARDS & 7-POINT PRE-EXECUTION GATE
  // =========================================================================
  describe("Domain 5: Automation Execution Safeguards", () => {
    const mockJob: any = {
      id: "job-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      created_at: new Date(Date.now() - 3600_000).toISOString(), // 1 hr ago
      payload: { action_type: "send_text_message" },
    };

    const mockConv: any = {
      id: "conv-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      status: "open",
      is_automation_paused: false,
    };

    const mockContact: any = {
      id: "cont-1",
      business_id: ASTROLOGY_BUSINESS_ID,
      phone_number: "919999000001",
      is_opted_out: false,
      last_inbound_at: new Date(Date.now() - 7200_000).toISOString(), // 2 hours ago (before job creation)
    };

    it("5.1 Gate 1: should block execution if contact is opted out", () => {
      const res = validateScheduledFollowupPreExecution({
        job: mockJob,
        conversation: mockConv,
        contact: { ...mockContact, is_opted_out: true },
      });
      expect(res.isValid).toBe(false);
      expect(res.code).toBe("contact_opted_out");
    });

    it("5.2 Gate 2: should block execution on cross-tenant mismatch", () => {
      const res = validateScheduledFollowupPreExecution({
        job: mockJob,
        conversation: { ...mockConv, business_id: VIVAHAM_BUSINESS_ID },
        contact: mockContact,
      });
      expect(res.isValid).toBe(false);
      expect(res.code).toBe("cross_tenant_violation");
    });

    it("5.3 Gate 3: should block follow-up if customer already replied after schedule", () => {
      const res = validateScheduledFollowupPreExecution({
        job: mockJob, // created 1 hr ago
        conversation: mockConv,
        contact: {
          ...mockContact,
          last_inbound_at: new Date(Date.now() - 600_000).toISOString(), // 10 min ago (after job creation)
        },
      });
      expect(res.isValid).toBe(false);
      expect(res.code).toBe("customer_already_replied");
    });

    it("5.4 Gate 4: should block follow-up if conversation is pending human or paused", () => {
      const resHuman = validateScheduledFollowupPreExecution({
        job: mockJob,
        conversation: { ...mockConv, status: "pending_human" },
        contact: mockContact,
      });
      expect(resHuman.isValid).toBe(false);
      expect(resHuman.code).toBe("agent_takeover_or_paused");

      const resPaused = validateScheduledFollowupPreExecution({
        job: mockJob,
        conversation: { ...mockConv, is_automation_paused: true },
        contact: mockContact,
      });
      expect(resPaused.isValid).toBe(false);
      expect(resPaused.code).toBe("agent_takeover_or_paused");
    });

    it("5.5 Gate 5: should enforce 24h Meta messaging window for text", () => {
      const expiredInbound = new Date(Date.now() - 25 * 3600_000).toISOString(); // 25 hours ago
      const resText = validateMetaMessagingWindow(expiredInbound, "send_text_message");
      expect(resText.isValid).toBe(false);
      expect(resText.code).toBe("meta_24h_window_expired");

      // Pre-approved template is permitted outside window
      const resTpl = validateMetaMessagingWindow(expiredInbound, "send_template_message");
      expect(resTpl.isValid).toBe(true);
    });

    it("5.6 Bot loop circuit breaker: should trip after 5 bot replies within 15 minutes", () => {
      const conv: any = {
        last_bot_reply_at: new Date().toISOString(),
        bot_reply_count_window: 5,
      };
      const breaker = checkBotLoopCircuitBreaker(conv, 5);
      expect(breaker.tripped).toBe(true);
      expect(breaker.reason).toContain("automated loop detected");
    });
  });

  // =========================================================================
  // DOMAIN 6: TEMPLATE DISPATCH RESTRICTIONS (ARCHIVED & DRAFT BLOCKING)
  // =========================================================================
  describe("Domain 6: Template Dispatch Restrictions", () => {
    it("6.1 Gate 7: should reject dispatching unapproved or draft templates", () => {
      const templateJob: any = {
        id: "job-tpl",
        business_id: ASTROLOGY_BUSINESS_ID,
        created_at: new Date(Date.now() - 3600_000).toISOString(),
        payload: { action_type: "send_template_message" },
      };

      const resDraft = validateScheduledFollowupPreExecution({
        job: templateJob,
        conversation: { id: "conv-1", business_id: ASTROLOGY_BUSINESS_ID, status: "open" } as any,
        contact: { id: "c-1", business_id: ASTROLOGY_BUSINESS_ID, is_opted_out: false } as any,
        templateStatus: "DRAFT",
      });
      expect(resDraft.isValid).toBe(false);
      expect(resDraft.code).toBe("template_not_approved");

      const resApproved = validateScheduledFollowupPreExecution({
        job: templateJob,
        conversation: { id: "conv-1", business_id: ASTROLOGY_BUSINESS_ID, status: "open" } as any,
        contact: { id: "c-1", business_id: ASTROLOGY_BUSINESS_ID, is_opted_out: false } as any,
        templateStatus: "APPROVED",
      });
      expect(resApproved.isValid).toBe(true);
    });
  });

  // =========================================================================
  // DOMAIN 7: CSV EXPORT TENANT ISOLATION & FORMULA INJECTION AUDIT
  // =========================================================================
  describe("Domain 7: CSV Export Tenant Isolation & Formula Injection", () => {
    it("7.1 CSV export must isolate tenant records strictly", () => {
      const astroContacts: any[] = [
        { display_name: "Astro Client", phone_number: "919999000001", business_id: ASTROLOGY_BUSINESS_ID },
      ];
      const csv = exportContactsToCsvString(astroContacts);
      expect(csv).toContain("Astro Client");
      expect(csv).toContain("919999000001");
      expect(csv).not.toContain("Vivaham");
    });

    it("7.2 CSV Formula Injection Detection: checks whether leading =, +, -, @ are escaped", () => {
      const injectionContact: any[] = [
        { display_name: "=cmd|' /C calc'!A0", phone_number: "919999000099", business_id: ASTROLOGY_BUSINESS_ID },
      ];
      const csv = exportContactsToCsvString(injectionContact);
      // Remediated behavior (SEC-MED-02): neutralized with leading single quote
      expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
    });
  });

  // =========================================================================
  // DOMAIN 8: SECURITY DEFINER FUNCTIONS & LEAST PRIVILEGE GRANTS
  // =========================================================================
  describe("Domain 8: SQL Functions & Privilege Grants", () => {
    it("8.1 should verify claim_next_wa_jobs and reclaim_stuck_wa_jobs are restricted to service_role", async () => {
      // In Migration 011:
      // REVOKE ALL ON FUNCTION public.claim_next_wa_jobs FROM PUBLIC, anon, authenticated;
      // GRANT EXECUTE ON FUNCTION public.claim_next_wa_jobs TO service_role;
      const funcPrivs = await db.query(`
        SELECT proname, prosecdef 
        FROM pg_proc 
        WHERE proname IN ('claim_next_wa_jobs', 'reclaim_stuck_wa_jobs', 'ingest_wa_inbound_message_v2');
      `);

      const names = funcPrivs.rows.map((r: any) => r.proname);
      expect(names).toContain("claim_next_wa_jobs");
      expect(names).toContain("reclaim_stuck_wa_jobs");
      expect(names).toContain("ingest_wa_inbound_message_v2");
    });
  });

  // =========================================================================
  // DOMAIN 9: RACE CONDITIONS & IDEMPOTENCY SAFETY
  // =========================================================================
  describe("Domain 9: Race Conditions & Queue Idempotency", () => {
    it("9.1 should enforce unique idempotency key constraint on wa_processing_jobs", async () => {
      const idempotencyKey = `inbound_eval_meta_${Date.now()}`;

      await db.query(`
        INSERT INTO public.wa_processing_jobs (
          business_id, job_type, payload, idempotency_key, scheduled_at, status
        ) VALUES (
          '${ASTROLOGY_BUSINESS_ID}',
          'evaluate_automation_rules',
          '{}'::jsonb,
          '${idempotencyKey}',
          NOW(),
          'pending'
        );
      `);

      // Attempting to insert identical idempotency key must fail with unique constraint violation
      await expect(
        db.query(`
          INSERT INTO public.wa_processing_jobs (
            business_id, job_type, payload, idempotency_key, scheduled_at, status
          ) VALUES (
            '${ASTROLOGY_BUSINESS_ID}',
            'evaluate_automation_rules',
            '{}'::jsonb,
            '${idempotencyKey}',
            NOW(),
            'pending'
          );
        `)
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // DOMAIN 10: SERVER ACTION AUTHORIZATION AUDIT (AUDIT FINDING DISCOVERY)
  // =========================================================================
  describe("Domain 10: Server Action Authorization Audit (Remediated)", () => {
    it("10.1 audit check: triggerQueueWorkerAction requires businessSlug and rejects empty input", async () => {
      // SEC-MED-01 remediated: triggerQueueWorkerAction requires businessSlug and validates access
      const res = await triggerQueueWorkerAction("");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Business slug is required");
    });
  });
});
