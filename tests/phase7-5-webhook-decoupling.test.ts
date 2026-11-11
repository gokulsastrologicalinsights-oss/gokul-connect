import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/whatsapp/route";
import { processQueueBatch } from "@/lib/automation/worker";
import { processInboundAutomation } from "@/lib/automation/dispatcher";
import { calculateBackoffDelaySeconds } from "@/lib/automation/worker";
import { validateMetaMessagingWindow } from "@/lib/automation/safeguards";

describe("Phase 7.5 — Webhook Decoupling & Durable Event Processing Suite", () => {
  const APP_SECRET = "test_phase7_5_meta_secret_abcdef0123456789";
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
  const ASTRO_PHONE_ID = "109283746501928";
  const VIVAHAM_PHONE_ID = "1395663896970053";

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

  const sampleInboundPayload = {
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
                  profile: { name: "Gokul Connect Tester" },
                  wa_id: "919444559071",
                },
              ],
              messages: [
                {
                  from: "919444559071",
                  id: "wamid.test_decouple_msg_001",
                  timestamp: "1730900000",
                  text: { body: "Vanakkam, what are your consultation timings?" },
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
  // TEST 1: VALID WEBHOOK SIGNATURE
  // ============================================================================
  it("Test 1: should accept webhook with valid HMAC-SHA256 signature", async () => {
    const req = createWebhookRequest({ object: "whatsapp_business_account", entry: [] });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // ============================================================================
  // TEST 2: INVALID WEBHOOK SIGNATURE
  // ============================================================================
  it("Test 2: should reject webhook with invalid or tampered HMAC signature (401)", async () => {
    const req = createWebhookRequest(
      { object: "whatsapp_business_account", entry: [] },
      "sha256=tampered_hex_signature_000000000000000000000000000000000000000000000000"
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // ============================================================================
  // TEST 3: SUCCESSFUL EVENT PERSISTENCE
  // ============================================================================
  it("Test 3: should atomically persist inbound event via ingest_wa_inbound_message", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        status: "success",
        business_id: ASTRO_BIZ_ID,
        connection_id: ASTRO_CONN_ID,
      },
      error: null,
    });
    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    };
    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("ingest_wa_inbound_message", expect.objectContaining({
      p_phone_number_id: ASTRO_PHONE_ID,
      p_meta_message_id: "wamid.test_decouple_msg_001",
      p_sender_phone: "919444559071",
      p_sender_name: "Gokul Connect Tester",
    }));
  });

  // ============================================================================
  // TEST 4: SUCCESSFUL JOB ENQUEUE
  // ============================================================================
  it("Test 4: should enqueue background evaluate_automation_rules job with deterministic idempotency key", async () => {
    const mockJobsInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "success",
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_ID,
          conversation_id: "conv-astro-001",
          contact_id: "contact-astro-001",
          message_id: "msg-astro-001",
        },
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === "wa_processing_jobs") return { insert: mockJobsInsert };
        return { select: vi.fn(), insert: vi.fn() };
      }),
    };
    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockJobsInsert).toHaveBeenCalledWith(expect.objectContaining({
      business_id: ASTRO_BIZ_ID,
      connection_id: ASTRO_CONN_ID,
      job_type: "evaluate_automation_rules",
      idempotency_key: "inbound_eval_wamid.test_decouple_msg_001",
      status: "pending",
    }));
  });

  // ============================================================================
  // TEST 5: PROMPT HTTP ACKNOWLEDGEMENT (<100ms)
  // ============================================================================
  it("Test 5: should acknowledge incoming webhooks promptly without blocking on automation evaluation", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: "success",
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_ID,
        },
        error: null,
      }),
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    };
    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const startTime = Date.now();
    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);
    const elapsed = Date.now() - startTime;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });

  // ============================================================================
  // TEST 6: DUPLICATE WEBHOOK DELIVERY
  // ============================================================================
  it("Test 6: should deduplicate duplicate webhook deliveries without queuing duplicate jobs", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        status: "duplicate",
        meta_message_id: "wamid.test_decouple_msg_001",
        message: "Webhook event already processed",
      },
      error: null,
    });

    const mockJobsInsert = vi.fn();
    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn(() => ({ insert: mockJobsInsert })),
    };

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    // When RPC returns duplicate, NO job should be enqueued
    expect(mockJobsInsert).not.toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 7: DATABASE PERSISTENCE FAILURE
  // ============================================================================
  it("Test 7: should return retryable HTTP 500 when database persistence RPC fails", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection timeout" },
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn(() => ({ insert: vi.fn() })),
    };

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Failed to persist or queue webhook event");
  });

  // ============================================================================
  // TEST 8: QUEUE INSERTION FAILURE
  // ============================================================================
  it("Test 8: should return retryable HTTP 500 when background queue insertion fails", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        status: "success",
        business_id: ASTRO_BIZ_ID,
        connection_id: ASTRO_CONN_ID,
      },
      error: null,
    });

    const mockJobsInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "50001", message: "Deadlock detected on queue table" },
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn(() => ({ insert: mockJobsInsert })),
    };

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  // ============================================================================
  // TEST 9: IMMEDIATE REPLY DEFERRED TO WORKER
  // ============================================================================
  it("Test 9: should defer immediate replies to wa_processing_jobs rather than calling Meta API synchronously", async () => {
    const mockJobsInsert = vi.fn().mockResolvedValue({ error: null });
    const mockLogsInsert = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_contacts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "contact-1",
                    business_id: ASTRO_BIZ_ID,
                    phone_number: "919444559071",
                    is_opted_out: false,
                    last_inbound_at: new Date().toISOString(),
                  },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "conv-1",
                    business_id: ASTRO_BIZ_ID,
                    status: "open",
                    is_automation_paused: false,
                  },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "business_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    business_hours: null,
                    automation_settings: { is_automation_enabled: true },
                  },
                }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { insert: mockJobsInsert };
        }
        if (table === "wa_automation_execution_logs") {
          return { insert: mockLogsInsert };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    // Trigger dispatcher with opt-out keyword 'STOP'
    await processInboundAutomation(mockSupabase, {
      businessId: ASTRO_BIZ_ID,
      connectionId: ASTRO_CONN_ID,
      conversationId: "conv-1",
      contactId: "contact-1",
      messageId: "msg-1",
      messageContent: "STOP",
      messageType: "text",
    });

    // Verify immediate reply was queued as a durable job with delay_seconds = 0
    expect(mockJobsInsert).toHaveBeenCalledWith(expect.objectContaining({
      business_id: ASTRO_BIZ_ID,
      connection_id: ASTRO_CONN_ID,
      job_type: "send_outbound_message",
      status: "pending",
      idempotency_key: expect.stringContaining("reply_"),
      payload: expect.objectContaining({
        recipient_phone: "919444559071",
        content: expect.stringContaining("unsubscribed"),
      }),
    }));

    // Verify audit log recorded intent
    expect(mockLogsInsert).toHaveBeenCalledWith(expect.objectContaining({
      status: "queued",
      business_id: ASTRO_BIZ_ID,
    }));
  });

  // ============================================================================
  // TEST 10: WORKER PROCESSING AFTER ACKNOWLEDGEMENT
  // ============================================================================
  it("Test 10: should claim and process inbound evaluation job through background worker", async () => {
    const mockClaimRpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "job-eval-001",
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_ID,
          job_type: "evaluate_automation_rules",
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          payload: {
            conversation_id: "conv-astro-001",
            contact_id: "cont-astro-001",
            message_id: "msg-astro-001",
            message_content: "Consultation enquiry",
            message_type: "text",
          },
        },
      ],
      error: null,
    });

    const mockJobsUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const mockSupabase = {
      rpc: vi.fn((fnName: string) => {
        if (fnName === "reclaim_stuck_wa_jobs") return Promise.resolve({ data: 0 });
        if (fnName === "claim_next_wa_jobs") return mockClaimRpc();
        return Promise.resolve({ data: null });
      }),
      from: vi.fn((table: string) => {
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-astro-001", business_id: ASTRO_BIZ_ID, status: "open" },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "wa_contacts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "cont-astro-001", business_id: ASTRO_BIZ_ID, phone_number: "919444559071" },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "business_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { automation_settings: { is_automation_enabled: false } },
                }),
              })),
            })),
          };
        }
        if (table === "wa_automation_rules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [] }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { update: mockJobsUpdate, insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const result = await processQueueBatch(10, "worker_test_10");

    expect(result.claimedCount).toBe(1);
    expect(result.processedCount).toBe(1);
    expect(result.succeededCount).toBe(1);
    expect(mockJobsUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "completed",
    }));
  });

  // ============================================================================
  // TEST 11: WORKER RETRY AND BACKOFF
  // ============================================================================
  it("Test 11: should calculate exponential backoff with random jitter up to 30 minutes", () => {
    // Attempt 1: 2^1 * 30 = 60s + [0..5]s jitter
    const delay1 = calculateBackoffDelaySeconds(1);
    expect(delay1).toBeGreaterThanOrEqual(60);
    expect(delay1).toBeLessThanOrEqual(65);

    // Attempt 2: 2^2 * 30 = 120s + [0..5]s jitter
    const delay2 = calculateBackoffDelaySeconds(2);
    expect(delay2).toBeGreaterThanOrEqual(120);
    expect(delay2).toBeLessThanOrEqual(125);

    // Attempt 3: 2^3 * 30 = 240s
    const delay3 = calculateBackoffDelaySeconds(3);
    expect(delay3).toBeGreaterThanOrEqual(240);
    expect(delay3).toBeLessThanOrEqual(245);

    // Large attempt should cap at 1800s (30m)
    const delayLarge = calculateBackoffDelaySeconds(10);
    expect(delayLarge).toBeLessThanOrEqual(1800);
  });

  // ============================================================================
  // TEST 12: DUPLICATE JOB EXECUTION IDEMPOTENCY
  // ============================================================================
  it("Test 12: should enforce job queue idempotency constraint preventing duplicate execution", async () => {
    const mockJobsInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint uq_wa_processing_jobs_idempotency" },
    });

    const mockRpc = vi.fn().mockResolvedValue({
      data: { status: "success", business_id: ASTRO_BIZ_ID, connection_id: ASTRO_CONN_ID },
      error: null,
    });

    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn(() => ({ insert: mockJobsInsert })),
    };

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const req = createWebhookRequest(sampleInboundPayload);
    const res = await POST(req);

    // When duplicate key 23505 occurs on queue insert, it should safely acknowledge with 200 OK
    expect(res.status).toBe(200);
  });

  // ============================================================================
  // TEST 13: CROSS-BUSINESS ISOLATION
  // ============================================================================
  it("Test 13: should block worker execution if job business_id does not match conversation business_id", async () => {
    const mockClaimRpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "job-cross-tenant",
          business_id: ASTRO_BIZ_ID, // Astrology Job
          connection_id: ASTRO_CONN_ID,
          job_type: "evaluate_automation_rules",
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          payload: {
            conversation_id: "conv-vivaham-001",
            contact_id: "cont-astro-001",
          },
        },
      ],
      error: null,
    });

    const mockSupabase = {
      rpc: vi.fn((fnName: string) => {
        if (fnName === "reclaim_stuck_wa_jobs") return Promise.resolve({ data: 0 });
        if (fnName === "claim_next_wa_jobs") return mockClaimRpc();
        return Promise.resolve({ data: null });
      }),
      from: vi.fn((table: string) => {
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  // Cross-tenant data: Conversation belongs to Vivaham!
                  data: { id: "conv-vivaham-001", business_id: VIVAHAM_BIZ_ID },
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
                  data: { id: "cont-astro-001", business_id: ASTRO_BIZ_ID },
                }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    const adminModule = await import("@/lib/supabase/admin");
    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

    const result = await processQueueBatch(10, "worker_cross_tenant_test");
    expect(result.failedCount).toBe(1);
    expect(result.succeededCount).toBe(0);
  });

  // ============================================================================
  // TEST 14: STOP / நிறுத்து OPT-OUT ENFORCEMENT
  // ============================================================================
  it("Test 14: should handle STOP and Tamil 'நிறுத்து' keywords by setting is_opted_out = true", async () => {
    const mockContactUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const mockJobsInsert = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_contacts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "cont-tamil", business_id: VIVAHAM_BIZ_ID, is_opted_out: false },
                }),
              })),
            })),
            update: mockContactUpdate,
          };
        }
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-tamil", business_id: VIVAHAM_BIZ_ID, status: "open" },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "business_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    automation_settings: {
                      is_automation_enabled: true,
                      opt_out_keywords: ["STOP", "நிறுத்து"],
                    },
                  },
                }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { insert: mockJobsInsert };
        }
        if (table === "wa_automation_execution_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    await processInboundAutomation(mockSupabase, {
      businessId: VIVAHAM_BIZ_ID,
      connectionId: "conn-vivaham-1",
      conversationId: "conv-tamil",
      contactId: "cont-tamil",
      messageId: "msg-tamil-stop",
      messageContent: "நிறுத்து",
      messageType: "text",
    });

    expect(mockContactUpdate).toHaveBeenCalledWith(expect.objectContaining({
      is_opted_out: true,
      opted_out_reason: expect.stringContaining("நிறுத்து"),
    }));
  });

  // ============================================================================
  // TEST 15: HUMAN HANDOVER (AGENT / உதவி)
  // ============================================================================
  it("Test 15: should handle human handover request by setting status = pending_human and pausing bot", async () => {
    const mockConvUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_contacts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "cont-handover", business_id: ASTRO_BIZ_ID, is_opted_out: false },
                }),
              })),
            })),
          };
        }
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-handover", business_id: ASTRO_BIZ_ID, status: "open", is_automation_paused: false },
                }),
              })),
            })),
            update: mockConvUpdate,
          };
        }
        if (table === "business_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    automation_settings: {
                      is_automation_enabled: true,
                      human_handover_keywords: ["AGENT", "உதவி"],
                    },
                  },
                }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === "wa_automation_execution_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    await processInboundAutomation(mockSupabase, {
      businessId: ASTRO_BIZ_ID,
      connectionId: ASTRO_CONN_ID,
      conversationId: "conv-handover",
      contactId: "cont-handover",
      messageId: "msg-handover",
      messageContent: "உதவி",
      messageType: "text",
    });

    expect(mockConvUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "pending_human",
      is_automation_paused: true,
    }));
  });

  // ============================================================================
  // TEST 16: DISABLED AUTOMATION NEVER EXECUTES
  // ============================================================================
  it("Test 16: should completely skip rule execution when is_automation_enabled is false", async () => {
    const mockJobsInsert = vi.fn();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_contacts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "cont-dis", business_id: ASTRO_BIZ_ID, is_opted_out: false },
                }),
              })),
            })),
          };
        }
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-dis", business_id: ASTRO_BIZ_ID, status: "open", is_automation_paused: false },
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
                  data: { automation_settings: { is_automation_enabled: false } }, // Disabled!
                }),
              })),
            })),
          };
        }
        if (table === "wa_automation_rules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "rule-1",
                      business_id: ASTRO_BIZ_ID,
                      trigger_type: "inbound_message",
                      is_active: true,
                    },
                  ],
                }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { insert: mockJobsInsert };
        }
        if (table === "wa_automation_execution_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    await processInboundAutomation(mockSupabase, {
      businessId: ASTRO_BIZ_ID,
      connectionId: ASTRO_CONN_ID,
      conversationId: "conv-dis",
      contactId: "cont-dis",
      messageId: "msg-dis",
      messageContent: "General enquiry",
      messageType: "text",
    });

    // Zero outbound reply jobs should be enqueued when workspace automation is disabled
    expect(mockJobsInsert).not.toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 17: 24-HOUR MESSAGING RESTRICTIONS
  // ============================================================================
  it("Test 17: should block free-form text when customer 24-hour service window has expired", () => {
    // 25 hours ago
    const past25h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const resultText = validateMetaMessagingWindow(past25h, "send_text_message");

    expect(resultText.isValid).toBe(false);
    expect(resultText.code).toBe("meta_24h_window_expired");

    // Template messages are permitted outside 24-hour window
    const resultTemplate = validateMetaMessagingWindow(past25h, "send_template_message");
    expect(resultTemplate.isValid).toBe(true);
  });

  // ============================================================================
  // TEST 18: OUTBOUND MESSAGE IDEMPOTENCY
  // ============================================================================
  it("Test 18: should generate deterministic idempotency keys for outbound replies", async () => {
    const mockJobsInsert = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_contacts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "cont-idemp",
                    business_id: ASTRO_BIZ_ID,
                    phone_number: "919444559071",
                    is_opted_out: false,
                    last_inbound_at: new Date().toISOString(),
                  },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "wa_conversations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-idemp", business_id: ASTRO_BIZ_ID, status: "open", is_automation_paused: false },
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        if (table === "business_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    automation_settings: { is_automation_enabled: true },
                  },
                }),
              })),
            })),
          };
        }
        if (table === "wa_processing_jobs") {
          return { insert: mockJobsInsert };
        }
        if (table === "wa_automation_execution_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
      }),
    };

    await processInboundAutomation(mockSupabase, {
      businessId: ASTRO_BIZ_ID,
      connectionId: ASTRO_CONN_ID,
      conversationId: "conv-idemp",
      contactId: "cont-idemp",
      messageId: "msg-idemp-12345",
      messageContent: "STOP",
      messageType: "text",
    });

    expect(mockJobsInsert).toHaveBeenCalledWith(expect.objectContaining({
      idempotency_key: "reply_default_conv-idemp_msg-idemp-12345_0",
      job_type: "send_outbound_message",
    }));
  });
});
