import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/whatsapp/route";

describe("Phase 7.5.1 — Webhook Latency & Acknowledgement Benchmark", () => {
  const APP_SECRET = "test_phase7_5_meta_secret_abcdef0123456789";
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
  const ASTRO_PHONE_ID = "109283746501928";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ansiwtwqgrfmzfrhkzuu.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function generateSignature(payload: string, secret = APP_SECRET): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    return `sha256=${hmac.digest("hex")}`;
  }

  function createWebhookRequest(payloadObj: any): NextRequest {
    const bodyStr = JSON.stringify(payloadObj);
    const signature = generateSignature(bodyStr);
    return new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: bodyStr,
    });
  }

  function makeSamplePayload(msgId: string) {
    return {
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
                    profile: { name: "Benchmark User" },
                    wa_id: "919444559071",
                  },
                ],
                messages: [
                  {
                    from: "919444559071",
                    id: msgId,
                    timestamp: "1730900000",
                    text: { body: "Vanakkam, benchmark test query" },
                    type: "text",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  function computeStats(durationsMs: number[]) {
    durationsMs.sort((a, b) => a - b);
    const sum = durationsMs.reduce((acc, v) => acc + v, 0);
    const mean = sum / durationsMs.length;
    const min = durationsMs[0];
    const max = durationsMs[durationsMs.length - 1];
    const p50 = durationsMs[Math.floor(durationsMs.length * 0.5)];
    const p95 = durationsMs[Math.floor(durationsMs.length * 0.95)];
    const p99 = durationsMs[Math.floor(durationsMs.length * 0.99)];
    return { count: durationsMs.length, min, max, mean, p50, p95, p99 };
  }

  it("Benchmark 1: measures Successful Persistence and Enqueue Latency over 50 iterations", async () => {
    const adminModule = await import("@/lib/supabase/admin");
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "success",
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_ID,
          conversation_id: "conv-bench-1",
          contact_id: "contact-bench-1",
          message_id: "msg-bench-1",
        },
        error: null,
      }),
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    };
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const iterations = 50;
    const durations: number[] = [];

    // Warm-up iteration
    await POST(createWebhookRequest(makeSamplePayload("wamid.warmup")));

    for (let i = 0; i < iterations; i++) {
      const req = createWebhookRequest(makeSamplePayload(`wamid.bench_success_${i}`));
      const t0 = performance.now();
      const res = await POST(req);
      const t1 = performance.now();

      expect(res.status).toBe(200);
      durations.push(t1 - t0);
    }

    const stats = computeStats(durations);
    console.log("[Latency Benchmark] Scenario 1 — Successful Ingestion & Enqueue:", stats);

    // Handler code itself should execute under 5ms with fast DB responses
    expect(stats.p95).toBeLessThan(25);
    expect(stats.mean).toBeLessThan(10);
  });

  it("Benchmark 2: measures Duplicate Event Delivery Acknowledgement Latency over 50 iterations", async () => {
    const adminModule = await import("@/lib/supabase/admin");
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "duplicate",
          meta_message_id: "wamid.bench_dup",
          message: "Webhook event already processed",
        },
        error: null,
      }),
      from: vi.fn(() => ({ insert: vi.fn() })),
    };
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const iterations = 50;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const req = createWebhookRequest(makeSamplePayload(`wamid.bench_dup_${i}`));
      const t0 = performance.now();
      const res = await POST(req);
      const t1 = performance.now();

      expect(res.status).toBe(200);
      durations.push(t1 - t0);
    }

    const stats = computeStats(durations);
    console.log("[Latency Benchmark] Scenario 2 — Duplicate Event Acknowledgement:", stats);

    expect(stats.p95).toBeLessThan(15);
    expect(stats.mean).toBeLessThan(5);
  });

  it("Benchmark 3: measures Persistence Failure Error Response Latency over 50 iterations", async () => {
    const adminModule = await import("@/lib/supabase/admin");
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Simulated DB timeout" },
      }),
      from: vi.fn(() => ({ insert: vi.fn() })),
    };
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const iterations = 50;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const req = createWebhookRequest(makeSamplePayload(`wamid.bench_fail_rpc_${i}`));
      const t0 = performance.now();
      const res = await POST(req);
      const t1 = performance.now();

      expect(res.status).toBe(500);
      durations.push(t1 - t0);
    }

    const stats = computeStats(durations);
    console.log("[Latency Benchmark] Scenario 3 — Persistence Failure Latency:", stats);

    expect(stats.p95).toBeLessThan(15);
    expect(stats.mean).toBeLessThan(5);
  });

  it("Benchmark 4: measures Queue Insertion Failure Error Response Latency over 50 iterations", async () => {
    const adminModule = await import("@/lib/supabase/admin");
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "success",
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_ID,
        },
        error: null,
      }),
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "50001", message: "Simulated lock timeout on queue table" },
        }),
      })),
    };
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const iterations = 50;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const req = createWebhookRequest(makeSamplePayload(`wamid.bench_fail_queue_${i}`));
      const t0 = performance.now();
      const res = await POST(req);
      const t1 = performance.now();

      expect(res.status).toBe(500);
      durations.push(t1 - t0);
    }

    const stats = computeStats(durations);
    console.log("[Latency Benchmark] Scenario 4 — Queue Insertion Failure Latency:", stats);

    expect(stats.p95).toBeLessThan(15);
    expect(stats.mean).toBeLessThan(5);
  });
});
