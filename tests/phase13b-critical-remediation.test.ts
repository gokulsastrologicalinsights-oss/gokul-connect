import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/webhooks/meta-social/route";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { normalizeSocialText, matchSocialRule, findMatchingSocialRule } from "@/lib/meta-social/evaluator";
import {
  sendFacebookPrivateReply,
  sendInstagramPrivateReply,
  sendMetaCommentPrivateDm,
  sanitizeSocialLog,
} from "@/lib/meta-social/client";
import { processMetaSocialEvent } from "@/lib/meta-social/service";
import * as client from "@/lib/meta-social/client";
import * as db from "@/lib/meta-social/database";
import * as admin from "@/lib/supabase/admin";
import type { MetaSocialRule, NormalizedMetaSocialEvent } from "@/lib/meta-social/types";
import { encryptSecret } from "@/lib/crypto/encryption";

describe("Phase 13B — Critical Backend Remediation Test Suite", () => {
  const TEST_SECRET = "test-meta-app-secret-32-chars-long!";
  const TEST_VERIFY_TOKEN = "gokul_verify_token_secure_12345";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.META_APP_SECRET = TEST_SECRET;
    process.env.META_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_key_for_webhook_tests";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-test.supabase.co";
    delete process.env.META_PAGE_ACCESS_TOKEN;
    delete process.env.META_SOCIAL_ACCESS_TOKEN;
    vi.spyOn(admin, "createAdminClient").mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn() }),
      rpc: vi.fn(),
    });
  });

  // ============================================================================
  // DOMAIN A: Webhook Decoupling & Cryptographic Security
  // ============================================================================
  describe("Domain A: Webhook Decoupling & Security", () => {
    it("A.1 verifies GET handshake using timing-safe comparison", async () => {
      const validReq = new NextRequest(
        `http://localhost/api/webhooks/meta-social?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=test_challenge_123`
      );
      const res = await GET(validReq);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("test_challenge_123");

      const invalidReq = new NextRequest(
        `http://localhost/api/webhooks/meta-social?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_123`
      );
      const invalidRes = await GET(invalidReq);
      expect(invalidRes.status).toBe(403);
    });

    it("A.2 returns HTTP 200 promptly (<100ms) without synchronous Meta API calls (P0-1 Fix)", async () => {
      const sendDmSpy = vi.spyOn(client, "sendMetaSocialDm");
      const replyCommentSpy = vi.spyOn(client, "replyMetaCommentPublic");

      vi.spyOn(db, "ingestSocialEvent").mockResolvedValue({
        status: "ingested",
        eventId: "event-uuid-1",
        businessId: "biz-1",
      });

      const payload = JSON.stringify({
        object: "page",
        entry: [
          {
            id: "page_100",
            messaging: [
              {
                sender: { id: "user_99" },
                recipient: { id: "page_100" },
                message: { mid: "mid.msg_1", text: "Hello" },
              },
            ],
          },
        ],
      });

      const hmac = crypto.createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
      const req = new NextRequest("http://localhost/api/webhooks/meta-social", {
        method: "POST",
        headers: {
          "x-hub-signature-256": `sha256=${hmac}`,
          "content-type": "application/json",
        },
        body: payload,
      });

      const startTime = performance.now();
      const res = await POST(req);
      const durationMs = performance.now() - startTime;

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.ingested).toBe(1);

      // Webhook handler must NOT invoke outbound Meta API synchronously
      expect(sendDmSpy).not.toHaveBeenCalled();
      expect(replyCommentSpy).not.toHaveBeenCalled();
      expect(durationMs).toBeLessThan(100);
    });

    it("A.3 fails closed with HTTP 500 when database persistence fails (P0-2 Fix)", async () => {
      // Simulate database write failure or connection timeout
      vi.spyOn(db, "ingestSocialEvent").mockResolvedValue({
        status: "error",
        error: "Database connection timeout during transaction commit",
      });

      const payload = JSON.stringify({
        object: "page",
        entry: [
          {
            id: "page_100",
            messaging: [
              {
                sender: { id: "user_99" },
                message: { mid: "mid.msg_2", text: "Important inquiry" },
              },
            ],
          },
        ],
      });

      const hmac = crypto.createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
      const req = new NextRequest("http://localhost/api/webhooks/meta-social", {
        method: "POST",
        headers: {
          "x-hub-signature-256": `sha256=${hmac}`,
        },
        body: payload,
      });

      const res = await POST(req);
      // MUST NOT return 200; must return 500 so Meta safely retries delivery!
      expect(res.status).toBe(500);
      expect(await res.text()).toContain("persistence failure");
    });
  });

  // ============================================================================
  // DOMAIN B: Multi-Tenant Credential Isolation & Fail-Closed Security (P0-4 Fix)
  // ============================================================================
  describe("Domain B: Multi-Tenant Credential Isolation", () => {
    const astrologyBizId = "11111111-1111-1111-1111-111111111111";
    const vivahamBizId = "22222222-2222-2222-2222-222222222222";

    it("B.1 prevents using Astrology credentials for Vivaham connection (Tenant Mismatch Guard)", async () => {
      // Encrypt a token for Astrology business
      const astrologyToken = "EAAB_ASTROLOGY_SECRET_TOKEN_12345";
      const encrypted = encryptSecret(astrologyToken);

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "ingested",
            event_id: "evt-viv-1",
            business_id: vivahamBizId, // Target is Vivaham
            connection_id: "conn-viv-1",
            auto_reply_dms: true,
          },
          error: null,
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "rule-viv-1",
                    business_id: vivahamBizId,
                    platform: "facebook",
                    target_type: "message",
                    rule_name: "Vivaham Match",
                    keywords: ["vivaham"],
                    match_type: "contains",
                    response_action: "reply_dm",
                    predefined_reply: "Vivaham response",
                    priority: 1,
                    is_active: true,
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "meta_social_credentials") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              // Simulated cross-tenant credential row: connection belongs to Vivaham, but row has Astrology business_id!
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  ...encrypted,
                  business_id: astrologyBizId, // Cross-tenant!
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ data: { id: "del-1" }, error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_vivaham",
        eventType: "message",
        metaEventId: "mid.viv_msg_1",
        senderId: "user_viv_1",
        content: "Vivaham details please",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event);
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.errorMessage).toContain("SECURITY VIOLATION: Credential tenant mismatch");
    });

    it("B.2 fails closed when credentials missing; NEVER falls back to process.env token (P0-4 Fix)", async () => {
      process.env.META_PAGE_ACCESS_TOKEN = "GLOBAL_UNAUTHORIZED_FALLBACK_TOKEN";

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "ingested",
            event_id: "evt-astro-1",
            business_id: astrologyBizId,
            connection_id: "conn-no-creds",
            auto_reply_dms: true,
          },
          error: null,
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "rule-1",
                    business_id: astrologyBizId,
                    platform: "facebook",
                    target_type: "message",
                    keywords: ["horoscope"],
                    match_type: "contains",
                    response_action: "reply_dm",
                    predefined_reply: "Horoscope details",
                    priority: 1,
                    is_active: true,
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "meta_social_credentials") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // No credentials stored
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ data: { id: "del-1" }, error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_astro",
        eventType: "message",
        metaEventId: "mid.no_cred_msg",
        senderId: "user_1",
        content: "horoscope consultation",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event);
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      // Must NOT succeed using global token; must fail closed!
      expect(result.errorMessage).toContain("No valid decrypted credentials found");
    });

    it("B.3 sanitizes logs so access tokens are never printed or leaked", () => {
      const rawSecret = "EAAQWERTYUIOPASDFGHJKLZXCVBNM1234567890abcdef";
      const dirtyLog = `Error dispatching to Meta API with token ${rawSecret} on page 1001`;
      const cleaned = sanitizeSocialLog(dirtyLog, rawSecret);

      expect(cleaned).not.toContain(rawSecret);
      expect(cleaned).toContain("••••••••");
    });
  });

  // ============================================================================
  // DOMAIN C: Idempotency & Concurrency Safety (P0-5 Fix)
  // ============================================================================
  describe("Domain C: Idempotency & Concurrency", () => {
    it("C.1 returns duplicate status for seen events without triggering outbound API calls", async () => {
      const sendDmSpy = vi.spyOn(client, "sendMetaSocialDm");

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { status: "duplicate", event_id: "evt-dup-1" },
          error: null,
        }),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_1001",
        eventType: "message",
        metaEventId: "mid.seen_event_999",
        senderId: "user_1",
        content: "Duplicate delivery",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event);
      expect(result.status).toBe("duplicate");
      expect(sendDmSpy).not.toHaveBeenCalled();
    });

    it("C.2 handles concurrent duplicate webhooks gracefully without unhandled unique_violation", async () => {
      // Ingest 2 identical webhooks simultaneously
      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_1001",
        eventType: "comment",
        metaEventId: "comment_race_101",
        senderId: "user_race",
        content: "price info",
        timestamp: Date.now(),
      };

      let callCount = 0;
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((name, args) => {
          callCount++;
          if (callCount === 1) {
            // First call succeeds and ingests
            return Promise.resolve({
              data: { status: "ingested", event_id: "evt-first-1", business_id: "biz-1" },
              error: null,
            });
          }
          // Second simultaneous call hits ON CONFLICT and returns duplicate
          return Promise.resolve({
            data: { status: "duplicate", event_id: "evt-first-1", business_id: "biz-1" },
            error: null,
          });
        }),
      };

      const [res1, res2] = await Promise.all([
        db.ingestSocialEvent(mockSupabase, event),
        db.ingestSocialEvent(mockSupabase, event),
      ]);

      expect(res1.status).toBe("ingested");
      expect(res2.status).toBe("duplicate");
    });
  });

  // ============================================================================
  // DOMAIN D: Outbound Delivery Ledger & Atomic Delivery States (P1-2, P1-3)
  // ============================================================================
  describe("Domain D: Outbound Delivery Tracking & State Isolation", () => {
    it("D.1 independently tracks delivery states: public succeeds, private fails without failing public (P1-2 Fix)", async () => {
      // Mock public reply to succeed
      vi.spyOn(client, "replyMetaCommentPublic").mockResolvedValue({ id: "meta_pub_reply_999" });
      // Mock private reply to throw error
      vi.spyOn(client, "sendMetaCommentPrivateDm").mockRejectedValue(
        new Error("OAuthException: (#100) User cannot be messaged privately")
      );

      const mockConn = {
        id: "conn-1",
        business_id: "biz-astrology",
        platform: "facebook",
        account_id: "page_astro_1",
        page_id: "page_astro_1",
        credential_ref: "sec_1",
        auto_reply_comments: true,
        auto_dm_on_comment: true,
      };

      const mockRule: MetaSocialRule = {
        id: "rule-both",
        business_id: "biz-astrology",
        platform: "facebook",
        target_type: "comment",
        rule_name: "Combined Reply Rule",
        keywords: ["fees"],
        match_type: "contains",
        response_action: "both_public_and_private",
        predefined_reply: "Public acknowledgment: Fees is ₹500.",
        predefined_dm: "Private Details: You can pay via UPI to book your slot.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const deliveryRecords: any[] = [];
      let updatedEventPayload: any = null;

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "ingested",
            event_id: "evt-partial-1",
            business_id: mockConn.business_id,
            connection_id: mockConn.id,
            page_id: mockConn.page_id,
            account_id: mockConn.account_id,
            auto_reply_comments: true,
            auto_dm_on_comment: true,
          },
          error: null,
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                deliveryRecords.push(payload);
                return { select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: `del-${deliveryRecords.length}` }, error: null }) }) };
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockImplementation((payload) => {
                updatedEventPayload = payload;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_astro_1",
        eventType: "comment",
        metaEventId: "comment_user_777",
        commentId: "comment_user_777",
        senderId: "user_777",
        content: "What is your consultation fees?",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event, {
        overrideAccessToken: "TEST_VALID_PAGE_TOKEN",
      });

      // Overall status should reflect partial success (public replied, private failed)
      expect(result.status).toBe("replied");
      expect(result.publicReplyStatus).toBe("replied");
      expect(result.privateReplyStatus).toBe("failed");
      expect(result.publicReplyId).toBe("meta_pub_reply_999");
      expect(result.privateReplyId).toBeNull();

      // Verified delivery ledger created separate tracking rows for public and private
      expect(deliveryRecords.some((d) => d.action_type === "public_comment_reply")).toBe(true);
      expect(deliveryRecords.some((d) => d.action_type === "private_comment_reply")).toBe(true);

      // Verified event row updated with separate states
      expect(updatedEventPayload.public_reply_status).toBe("replied");
      expect(updatedEventPayload.private_reply_status).toBe("failed");
      expect(updatedEventPayload.public_reply_id).toBe("meta_pub_reply_999");
    });
  });

  // ============================================================================
  // DOMAIN E: Instagram vs Facebook Private Reply & Template Corrections (P1-1, P1-4)
  // ============================================================================
  describe("Domain E: Platform Compliance & Template Corrections", () => {
    it("E.1 strictly enforces linkedPageId for Instagram Private Replies (P1-1 Fix)", async () => {
      await expect(
        sendInstagramPrivateReply({
          linkedPageId: "", // Empty Facebook Page ID
          commentId: "ig_comment_123",
          text: "Hello",
          accessToken: "EAAB_TOKEN",
        })
      ).rejects.toThrow("linkedPageId (Facebook Page ID connected to Instagram Professional Account) is strictly required");
    });

    it("E.2 skips private DM if comment is older than 7 days per Meta rule (P1-1 & P1-5 Fix)", async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

      await expect(
        sendFacebookPrivateReply({
          pageId: "page_1001",
          commentId: "comment_old_1",
          text: "Belated reply",
          accessToken: "EAAB_TOKEN",
          commentCreatedAt: eightDaysAgo,
        })
      ).rejects.toThrow("older than 7 days; Meta rejects private replies to expired comments");
    });

    it("E.3 dispatches distinct public vs private templates for Tamil and English (P1-4 Fix)", async () => {
      const pubSpy = vi.spyOn(client, "replyMetaCommentPublic").mockResolvedValue({ id: "pub_1" });
      const privSpy = vi.spyOn(client, "sendMetaCommentPrivateDm").mockResolvedValue({
        message_id: "dm_1",
        recipient_id: "user_1",
      });

      const mockConn = {
        id: "conn-1",
        business_id: "biz-astrology",
        platform: "facebook",
        account_id: "page_1001",
        page_id: "page_1001",
        auto_reply_comments: true,
        auto_dm_on_comment: true,
        default_comment_reply: "நன்றி! கூடுதல் விவரங்களை Inbox-ல் அனுப்பியுள்ளோம்.",
        default_dm_reply: "வணக்கம்! எங்கள் ஜோதிட கட்டணம் ₹500. ஜாதக விவரங்களை பகிரவும்.",
      };

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "ingested",
            event_id: "evt-tamil-1",
            business_id: mockConn.business_id,
            connection_id: mockConn.id,
            page_id: mockConn.page_id,
            account_id: mockConn.account_id,
            auto_reply_comments: true,
            auto_dm_on_comment: true,
            default_comment_reply: mockConn.default_comment_reply,
            default_dm_reply: mockConn.default_dm_reply,
          },
          error: null,
        }),
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }), // No specific rule, falls back to default keywords
          upsert: vi.fn().mockResolvedValue({ data: { id: "del-1" }, error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        })),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_1001",
        eventType: "comment",
        metaEventId: "comment_tamil_88",
        commentId: "comment_tamil_88",
        senderId: "user_tamil_88",
        content: "ஜாதகம் பார்க்க விவரம் வேண்டும் [INFO]",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event, {
        overrideAccessToken: "TEST_TOKEN",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");

      // Verify Public Comment received the public acknowledgement
      expect(pubSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "நன்றி! கூடுதல் விவரங்களை Inbox-ல் அனுப்பியுள்ளோம்.",
        })
      );

      // Verify Private DM received the actual consultation details, NOT the public acknowledgment!
      expect(privSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "வணக்கம்! எங்கள் ஜோதிட கட்டணம் ₹500. ஜாதக விவரங்களை பகிரவும்.",
        })
      );
    });

    it("E.4 normalizes text removing quotes, brackets, and symbols while preserving Tamil syllables", () => {
      // Brackets and quotes stripping
      expect(normalizeSocialText("[INFO]")).toBe("info");
      expect(normalizeSocialText('"PRICE"')).toBe("price");
      expect(normalizeSocialText("'details'")).toBe("details");
      expect(normalizeSocialText("+1 horoscope please")).toBe("1 horoscope please");

      // Tamil text with quotes & brackets
      expect(normalizeSocialText("['ஜாதகம்']")).toBe("ஜாதகம்");
      expect(normalizeSocialText('"கட்டணம்" விவரம்?')).toBe("கட்டணம் விவரம்");
    });
  });
});
