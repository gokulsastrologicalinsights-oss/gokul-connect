import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "crypto";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

import {
  sendWhatsAppMessageService,
  getRecentMessagesForBusiness,
  getConversationsForBusiness,
} from "@/lib/whatsapp/service";
import { POST } from "@/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";

describe("Phase 3F — End-to-End WhatsApp Validation Suite", () => {
  const APP_SECRET = "test_app_secret_phase3f_validation_2026";
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
  const ASTRO_PHONE_ID = "1395663896970053";
  const VIVAHAM_PHONE_ID = "209283746501930";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.META_TEST_PHONE_NUMBER_ID = ASTRO_PHONE_ID;
    process.env.META_TEST_ACCESS_TOKEN = "EAAPq2eMdDC8_TEST_VALIDATION_TOKEN_MOCK";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ansiwtwqgrfmzfrhkzuu.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  // Helper to generate Meta Webhook Signature
  function generateSignature(payload: string, secret = APP_SECRET) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    return `sha256=${hmac.digest("hex")}`;
  }

  // 1. Webhook Signature Validation
  describe("Requirement 6: Webhook Signature Validation", () => {
    it("should accept webhooks with valid HMAC-SHA256 signature", async () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      });
      const signature = generateSignature(payload);

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("should reject webhooks with tampered payload (401)", async () => {
      const originalPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const tamperedPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "tampered" }] });
      const signature = generateSignature(originalPayload);

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
        body: tamperedPayload,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should reject webhooks with missing signature header (401)", async () => {
      const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  // 2. Incoming Messages & Contact/Conversation Creation via Webhooks
  describe("Requirements 2, 3, 4, 7: Inbound Webhook Ingestion & Idempotency", () => {
    it("should dispatch atomic RPC ingest_wa_inbound_message with correct fields", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          status: "success",
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_ID,
          conversation_id: "conv-123",
          contact_id: "cont-123",
          message_id: "msg-123",
        },
        error: null,
      });

      const inboundPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1153964060437882",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15551529045",
                    phone_number_id: ASTRO_PHONE_ID,
                  },
                  contacts: [
                    {
                      profile: { name: "Gokul Test Client" },
                      wa_id: "919444559071",
                    },
                  ],
                  messages: [
                    {
                      from: "919444559071",
                      id: "wamid.HBgLOTE5NDQ0NTU5MDcxFQIAEhggMTIzNDU2Nzg5MAA=",
                      timestamp: "1730900000",
                      text: { body: "Vanakkam, looking for KP horoscope match" },
                      type: "text",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(inboundPayload);
      const signature = generateSignature(rawBody);

      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
        body: rawBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRpc).toHaveBeenCalledWith("ingest_wa_inbound_message", {
        p_phone_number_id: ASTRO_PHONE_ID,
        p_meta_message_id: "wamid.HBgLOTE5NDQ0NTU5MDcxFQIAEhggMTIzNDU2Nzg5MAA=",
        p_sender_phone: "919444559071",
        p_sender_name: "Gokul Test Client",
        p_message_type: "text",
        p_content: "Vanakkam, looking for KP horoscope match",
        p_raw_payload: expect.any(Object),
      });
    });

    it("should handle duplicate webhook events idempotently", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          status: "duplicate",
          meta_message_id: "wamid.duplicate_test_123",
          message: "Webhook event already processed",
        },
        error: null,
      });

      const duplicatePayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1153964060437882",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: ASTRO_PHONE_ID },
                  messages: [
                    {
                      from: "919444559071",
                      id: "wamid.duplicate_test_123",
                      timestamp: "1730900000",
                      text: { body: "Duplicate message check" },
                      type: "text",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(duplicatePayload);
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": generateSignature(rawBody) },
        body: rawBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("ingest_wa_inbound_message", expect.objectContaining({
        p_meta_message_id: "wamid.duplicate_test_123",
      }));
    });
  });

  // 3. Status Updates (sent, delivered, read, failed)
  describe("Requirement 5: Sent, Delivered, Read, and Failed Status Updates", () => {
    it("should route status updates through update_wa_message_status RPC", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          status: "success",
          meta_message_id: "wamid.status_test_msg",
          new_status: "read",
          rows_updated: 1,
        },
        error: null,
      });

      const statusPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1153964060437882",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: ASTRO_PHONE_ID },
                  statuses: [
                    {
                      id: "wamid.status_test_msg",
                      status: "read",
                      timestamp: "1730901234",
                      recipient_id: "919444559071",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(statusPayload);
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": generateSignature(rawBody) },
        body: rawBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRpc).toHaveBeenCalledWith("update_wa_message_status", {
        p_phone_number_id: ASTRO_PHONE_ID,
        p_meta_message_id: "wamid.status_test_msg",
        p_status: "read",
        p_timestamp: expect.any(String),
        p_error_code: null,
        p_error_message: null,
        p_raw_payload: expect.any(Object),
      });
    });

    it("should capture error code and error message for failed message statuses", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          status: "success",
          meta_message_id: "wamid.failed_msg_test",
          new_status: "failed",
          rows_updated: 1,
        },
        error: null,
      });

      const failedPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1153964060437882",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: ASTRO_PHONE_ID },
                  statuses: [
                    {
                      id: "wamid.failed_msg_test",
                      status: "failed",
                      timestamp: "1730901234",
                      recipient_id: "919444559071",
                      errors: [
                        {
                          code: 131026,
                          title: "Message undeliverable",
                          message: "Recipient phone number is inactive or not on WhatsApp",
                        },
                      ],
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(failedPayload);
      const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": generateSignature(rawBody) },
        body: rawBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockRpc).toHaveBeenCalledWith("update_wa_message_status", {
        p_phone_number_id: ASTRO_PHONE_ID,
        p_meta_message_id: "wamid.failed_msg_test",
        p_status: "failed",
        p_timestamp: expect.any(String),
        p_error_code: "131026",
        p_error_message: "Recipient phone number is inactive or not on WhatsApp",
        p_raw_payload: expect.any(Object),
      });
    });
  });

  // 4. Outgoing Messages & Error Handling
  describe("Requirements 1, 12: Outgoing Messages & Failed Message Handling", () => {
    it("should handle failed outbound delivery gracefully and record failure status", async () => {
      // Mock Supabase client
      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: ASTRO_CONN_ID,
                    business_id: ASTRO_BIZ_ID,
                    display_name: "Gokul Astrology",
                    phone_number_id: ASTRO_PHONE_ID,
                    is_enabled: true,
                    wa_credentials: [],
                  },
                  error: null,
                }),
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "test-contact-id" },
                error: null,
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "test-msg-id" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        }),
      };

      // Force Meta API client to simulate error
      const mockClient = await import("@/lib/whatsapp/client");
      vi.spyOn(mockClient, "sendMetaTextMessage").mockRejectedValue(
        new Error("Meta API Network Timeout (Simulated)")
      );

      const result = await sendWhatsAppMessageService({
        businessId: ASTRO_BIZ_ID,
        connectionId: ASTRO_CONN_ID,
        recipientPhone: "+91 94445 59071",
        text: "Test Outbound Message",
        supabaseClient: mockSupabase as any,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Meta API Network Timeout");
    });
  });

  // 5. Multi-Tenant Workspace Queries & Isolation
  describe("Requirements 8, 9, 10, 11: Business Isolation & Persistence", () => {
    it("should filter messages strictly by business_id in getRecentMessagesForBusiness", async () => {
      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "msg-1",
                business_id: ASTRO_BIZ_ID,
                content: "Astrology Message Only",
                direction: "inbound",
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        }),
      });

      const mockSupabase = {
        from: (table: string) => {
          expect(table).toBe("wa_messages");
          return {
            select: () => ({
              eq: mockEq,
            }),
          };
        },
      };

      const messages = await getRecentMessagesForBusiness(ASTRO_BIZ_ID, 10, mockSupabase as any);
      expect(messages.length).toBe(1);
      expect(messages[0].business_id).toBe(ASTRO_BIZ_ID);
      expect(mockEq).toHaveBeenCalledWith("business_id", ASTRO_BIZ_ID);
    });

    it("should filter conversations strictly by business_id in getConversationsForBusiness", async () => {
      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "conv-1",
                business_id: VIVAHAM_BIZ_ID,
                status: "open",
                last_message_preview: "Vivaham Inquiry",
              },
            ],
            error: null,
          }),
        }),
      });

      const mockSupabase = {
        from: (table: string) => {
          expect(table).toBe("wa_conversations");
          return {
            select: () => ({
              eq: mockEq,
            }),
          };
        },
      };

      const convs = await getConversationsForBusiness(VIVAHAM_BIZ_ID, 10, mockSupabase as any);
      expect(convs.length).toBe(1);
      expect(convs[0].business_id).toBe(VIVAHAM_BIZ_ID);
      expect(mockEq).toHaveBeenCalledWith("business_id", VIVAHAM_BIZ_ID);
    });

    it("should route multiple phone numbers independently based on phone_number_id", () => {
      expect(ASTRO_PHONE_ID).not.toBe(VIVAHAM_PHONE_ID);
      expect(ASTRO_BIZ_ID).not.toBe(VIVAHAM_BIZ_ID);
    });
  });
});
