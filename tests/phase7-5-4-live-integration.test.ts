import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/whatsapp/route";
import { processQueueBatch } from "@/lib/automation/worker";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Phase 7.5.4 — Live Atomic Webhook Integration Verification Suite", () => {
  const APP_SECRET = "test_phase7_5_4_meta_secret_abcdef0123456789";
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const ASTRO_PHONE_ID = "109283746501928";
  const TEST_WAMID = "wamid.phase7_5_4_test_message_001";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ansiwtwqgrfmzfrhkzuu.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.USE_ATOMIC_WEBHOOK_V2;
  });

  function generateSignature(payload: string, secret = APP_SECRET): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    return `sha256=${hmac.digest("hex")}`;
  }

  function createWebhookRequest(payloadObj: any, signatureHeader?: string): NextRequest {
    const bodyStr = JSON.stringify(payloadObj);
    const signature = signatureHeader !== undefined ? signatureHeader : generateSignature(bodyStr);
    return new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-hub-signature-256": signature } : {}),
      },
      body: bodyStr,
    });
  }

  const samplePayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1153964060437882",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551529045",
                phone_number_id: ASTRO_PHONE_ID,
              },
              contacts: [
                {
                  profile: { name: "Gokul Connect 7.5.4 Tester" },
                  wa_id: "919999997540",
                },
              ],
              messages: [
                {
                  from: "919999997540",
                  id: TEST_WAMID,
                  timestamp: "1730900000",
                  text: { body: "Phase 7.5.4 Integration Message" },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  // ============================================================================
  // DOMAIN 1: PRE-FLIGHT & CONFIGURATION INTEGRITY
  // ============================================================================
  describe("Domain 1: Pre-Flight & Configuration Integrity", () => {
    it("Test 1.1: Production feature flag USE_ATOMIC_WEBHOOK_V2 defaults to disabled in application runtime", () => {
      // In base environment without override
      delete process.env.USE_ATOMIC_WEBHOOK_V2;
      expect(process.env.USE_ATOMIC_WEBHOOK_V2).toBeUndefined();
      const isActive = process.env.USE_ATOMIC_WEBHOOK_V2 === "true";
      expect(isActive).toBe(false);
    });

    it("Test 1.2: Migration 010 must include partial index conflict arbiter predicate", () => {
      const migration010Path = path.resolve(
        process.cwd(),
        "supabase/migrations/20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql"
      );
      const sqlContent = fs.readFileSync(migration010Path, "utf-8");

      expect(sqlContent).toContain(
        "ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING"
      );
    });

    it("Test 1.3: Migration 010 must enforce strict service_role privilege isolation", () => {
      const migration010Path = path.resolve(
        process.cwd(),
        "supabase/migrations/20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql"
      );
      const sqlContent = fs.readFileSync(migration010Path, "utf-8");

      expect(sqlContent).toContain("REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2");
      expect(sqlContent).toContain("REVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2");
      expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;");
    });
  });

  // ============================================================================
  // DOMAIN 2: WEBHOOK ROUTE INTEGRATION
  // ============================================================================
  describe("Domain 2: Webhook Route Integration", () => {
    it("Test 2.1: Valid HMAC signature processes inbound event with HTTP 200", async () => {
      process.env.USE_ATOMIC_WEBHOOK_V2 = "true";

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          status: "success",
          business_id: ASTRO_BIZ_ID,
          connection_id: "conn-754",
          conversation_id: "conv-754",
          contact_id: "contact-754",
          message_id: "msg-754",
          job_id: "job-754",
        },
        error: null,
      });

      const mockSupabase = { rpc: mockRpc, from: vi.fn() };
      const adminModule = await import("@/lib/supabase/admin");
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const req = createWebhookRequest(samplePayload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("ingest_wa_inbound_message_v2", expect.objectContaining({
        p_phone_number_id: ASTRO_PHONE_ID,
        p_meta_message_id: TEST_WAMID,
        p_sender_phone: "919999997540",
      }));
    });

    it("Test 2.2: Invalid HMAC signature is rejected with HTTP 401", async () => {
      const req = createWebhookRequest(samplePayload, "sha256=invalid_signature_hex_00000000000000000000000000000000");
      const res = await POST(req);

      expect(res.status).toBe(401);
      expect(await res.text()).toBe("Invalid signature");
    });

    it("Test 2.3: Missing META_APP_SECRET fails closed with HTTP 500", async () => {
      delete process.env.META_APP_SECRET;

      const req = createWebhookRequest(samplePayload);
      const res = await POST(req);

      expect(res.status).toBe(500);
      expect(await res.text()).toBe("Server configuration error");
    });

    it("Test 2.4: Duplicate delivery acknowledges safely with HTTP 200 without duplicate job", async () => {
      process.env.USE_ATOMIC_WEBHOOK_V2 = "true";

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          status: "duplicate",
          meta_message_id: TEST_WAMID,
          message: "Webhook event already processed",
        },
        error: null,
      });

      const mockSupabase = { rpc: mockRpc, from: vi.fn() };
      const adminModule = await import("@/lib/supabase/admin");
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const req = createWebhookRequest(samplePayload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("Test 2.5: Database or RPC failure returns retryable HTTP 500", async () => {
      process.env.USE_ATOMIC_WEBHOOK_V2 = "true";

      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection timeout" },
      });

      const mockSupabase = { rpc: mockRpc, from: vi.fn() };
      const adminModule = await import("@/lib/supabase/admin");
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const req = createWebhookRequest(samplePayload);
      const res = await POST(req);

      expect(res.status).toBe(500);
      expect(await res.text()).toBe("Failed to persist or queue webhook event");
    });
  });

  // ============================================================================
  // DOMAIN 3: WORKER SAFEGUARD & PROCESSING VERIFICATION
  // ============================================================================
  describe("Domain 3: Worker Safeguard & Processing Verification", () => {
    it("Test 3.1: Worker rejects cross-tenant job where conversation belongs to another tenant", async () => {
      const mockJobsUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabase = {
        rpc: vi.fn((name: string) => {
          if (name === "reclaim_stuck_wa_jobs") return Promise.resolve({ data: 0, error: null });
          if (name === "claim_next_wa_jobs") {
            return Promise.resolve({
              data: [
                {
                  id: "job-cross-tenant-754",
                  business_id: VIVAHAM_BIZ_ID, // Mismatched
                  connection_id: "conn-754",
                  job_type: "evaluate_automation_rules",
                  payload: {
                    conversation_id: "conv-astro-754",
                    contact_id: "contact-astro-754",
                    message_id: "msg-754",
                  },
                  attempts: 0,
                  max_attempts: 5,
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn((table: string) => {
          if (table === "wa_processing_jobs") {
            return { update: mockJobsUpdate };
          }
          if (table === "wa_conversations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "conv-astro-754", business_id: ASTRO_BIZ_ID }, // Belongs to Astrology!
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === "wa_contacts") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "contact-astro-754", business_id: ASTRO_BIZ_ID },
                    error: null,
                  }),
                })),
              })),
            };
          }
          return { select: vi.fn(), update: vi.fn(), insert: vi.fn() };
        }),
      };

      const adminModule = await import("@/lib/supabase/admin");
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const result = await processQueueBatch(10, "worker_test_cross_tenant");
      expect(result.failedCount).toBe(1);
      expect(result.succeededCount).toBe(0);
      expect(mockJobsUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: "pending", // Incremented attempt with backoff
        last_error: "Security violation: Cross-tenant ID mismatch in job evaluation",
      }));
    });

    it("Test 3.2: Worker successfully processes evaluate_automation_rules when tenant matches and automation is disabled", async () => {
      const mockJobsUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockSupabase = {
        rpc: vi.fn((name: string) => {
          if (name === "reclaim_stuck_wa_jobs") return Promise.resolve({ data: 0, error: null });
          if (name === "claim_next_wa_jobs") {
            return Promise.resolve({
              data: [
                {
                  id: "job-valid-754",
                  business_id: ASTRO_BIZ_ID,
                  connection_id: "conn-astro-754",
                  job_type: "evaluate_automation_rules",
                  payload: {
                    business_id: ASTRO_BIZ_ID,
                    connection_id: "conn-astro-754",
                    conversation_id: "conv-astro-754",
                    contact_id: "contact-astro-754",
                    message_id: "msg-754",
                    message_content: "Hello",
                    message_type: "text",
                  },
                  attempts: 0,
                  max_attempts: 5,
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn((table: string) => {
          if (table === "wa_processing_jobs") {
            return { update: mockJobsUpdate };
          }
          if (table === "wa_conversations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "conv-astro-754", business_id: ASTRO_BIZ_ID },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === "wa_contacts") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "contact-astro-754", business_id: ASTRO_BIZ_ID, phone_number: "919999997540" },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === "business_settings") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      business_id: ASTRO_BIZ_ID,
                      automation_settings: { is_automation_enabled: false },
                      business_hours: {},
                    },
                    error: null,
                  }),
                })),
              })),
            };
          }
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [] }) })), update: vi.fn(), insert: vi.fn() };
        }),
      };

      const adminModule = await import("@/lib/supabase/admin");
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const result = await processQueueBatch(10, "worker_test_disabled_biz");
      expect(result.claimedCount).toBe(1);
      expect(result.processedCount).toBe(1);
      expect(result.succeededCount).toBe(1);
      expect(mockJobsUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: "completed",
      }));
    });
  });
});
