import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { parseMetaSocialWebhook } from "@/lib/meta-social/parser";
import {
  normalizeSocialText,
  matchSocialRule,
  findMatchingSocialRule,
} from "@/lib/meta-social/evaluator";
import { processMetaSocialEvent } from "@/lib/meta-social/service";
import * as client from "@/lib/meta-social/client";
import type { MetaSocialRule, NormalizedMetaSocialEvent } from "@/lib/meta-social/types";

describe("Phase 13: Meta Social Automation (Facebook & Instagram)", () => {
  const TEST_SECRET = "test-meta-app-secret-32-chars-long!";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Webhook Signature & Security Tests
  // --------------------------------------------------------------------------
  describe("Webhook Cryptographic Security", () => {
    it("successfully validates authentic HMAC-SHA256 signature", () => {
      const payload = JSON.stringify({ object: "page", entry: [] });
      const hmac = crypto.createHmac("sha256", TEST_SECRET).update(payload).digest("hex");
      const signatureHeader = `sha256=${hmac}`;

      const isValid = verifyMetaWebhookSignature(payload, signatureHeader, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it("rejects forged or tampered signature", () => {
      const payload = JSON.stringify({ object: "page", entry: [] });
      const signatureHeader = "sha256=forged_invalid_hash_value_1234567890abcdef";

      const isValid = verifyMetaWebhookSignature(payload, signatureHeader, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it("rejects missing signature or missing secret", () => {
      expect(verifyMetaWebhookSignature("{}", null, TEST_SECRET)).toBe(false);
      expect(verifyMetaWebhookSignature("{}", "sha256=abc", "")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Webhook Ingestion & Parser Tests
  // --------------------------------------------------------------------------
  describe("Webhook Payload Parsing", () => {
    it("parses Facebook Messenger DM payload", () => {
      const fbDmPayload = {
        object: "page",
        entry: [
          {
            id: "fb_page_1001",
            time: 1732185000000,
            messaging: [
              {
                sender: { id: "user_psid_999" },
                recipient: { id: "fb_page_1001" },
                timestamp: 1732185000000,
                message: {
                  mid: "mid.fb_msg_12345",
                  text: "Hello, I want horoscope consultation",
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaSocialWebhook(fbDmPayload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        platform: "facebook",
        accountId: "fb_page_1001",
        eventType: "message",
        metaEventId: "mid.fb_msg_12345",
        senderId: "user_psid_999",
        content: "Hello, I want horoscope consultation",
      });
    });

    it("parses Facebook Post Comment payload", () => {
      const fbCommentPayload = {
        object: "page",
        entry: [
          {
            id: "fb_page_1001",
            changes: [
              {
                field: "feed",
                value: {
                  item: "comment",
                  verb: "add",
                  comment_id: "fb_comment_888",
                  post_id: "post_777",
                  from: { id: "user_123", name: "Ramesh Kumar" },
                  message: "Please send INFO details",
                  created_time: 1732185100,
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaSocialWebhook(fbCommentPayload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        platform: "facebook",
        accountId: "fb_page_1001",
        eventType: "comment",
        metaEventId: "fb_comment_888",
        senderId: "user_123",
        senderName: "Ramesh Kumar",
        commentId: "fb_comment_888",
        postId: "post_777",
        content: "Please send INFO details",
      });
    });

    it("parses Instagram Direct Message payload", () => {
      const instaDmPayload = {
        object: "instagram",
        entry: [
          {
            id: "ig_account_2002",
            messaging: [
              {
                sender: { id: "ig_user_555" },
                recipient: { id: "ig_account_2002" },
                timestamp: 1732185200000,
                message: {
                  mid: "mid.ig_msg_9876",
                  text: "ஜாதகம் பார்க்க வேண்டும்",
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaSocialWebhook(instaDmPayload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        platform: "instagram",
        accountId: "ig_account_2002",
        eventType: "message",
        metaEventId: "mid.ig_msg_9876",
        senderId: "ig_user_555",
        content: "ஜாதகம் பார்க்க வேண்டும்",
      });
    });

    it("parses Instagram Reel / Media Comment payload", () => {
      const instaCommentPayload = {
        object: "instagram",
        entry: [
          {
            id: "ig_account_2002",
            changes: [
              {
                field: "comments",
                value: {
                  id: "ig_comment_444",
                  text: "PRICE please",
                  from: { id: "ig_user_333", username: "anitha_user" },
                  media: { id: "media_reel_111" },
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaSocialWebhook(instaCommentPayload);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        platform: "instagram",
        accountId: "ig_account_2002",
        eventType: "comment",
        metaEventId: "ig_comment_444",
        senderId: "ig_user_333",
        senderName: "anitha_user",
        commentId: "ig_comment_444",
        postId: "media_reel_111",
        content: "PRICE please",
      });
    });

    it("ignores page echoes and self-comments", () => {
      const echoPayload = {
        object: "page",
        entry: [
          {
            id: "fb_page_1001",
            messaging: [
              {
                sender: { id: "fb_page_1001" },
                recipient: { id: "user_psid_999" },
                message: { mid: "mid.echo_1", text: "Echo message", is_echo: true },
              },
            ],
          },
        ],
      };

      expect(parseMetaSocialWebhook(echoPayload)).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Deterministic Evaluator & Tamil/English Normalizer
  // --------------------------------------------------------------------------
  describe("Rule Evaluator & Unicode Normalization", () => {
    it("correctly normalizes English and Tamil strings with punctuation", () => {
      expect(normalizeSocialText("  Hello, World!!  ")).toBe("hello world");
      expect(normalizeSocialText("வணக்கம்!! ஜாதகம் பார்க்க.")).toBe("வணக்கம் ஜாதகம் பார்க்க");
    });

    it("matches Tamil exact and contains keywords", () => {
      const tamilRule: MetaSocialRule = {
        id: "rule_tamil_1",
        business_id: "biz_astrology",
        platform: "both",
        target_type: "both",
        rule_name: "Astrology Keyword Match",
        keywords: ["ஜாதகம்", "horoscope", "consultation"],
        match_type: "contains",
        response_action: "reply_dm",
        predefined_reply: "வணக்கம்! உங்கள் ஜாதக விவரங்களை பகிரவும்.",
        priority: 10,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(matchSocialRule(tamilRule, "என் ஜாதகம் பார்க்க வேண்டும்", "facebook", "message")).toBe(true);
      expect(matchSocialRule(tamilRule, "Need horoscope booking", "instagram", "message")).toBe(true);
      expect(matchSocialRule(tamilRule, "Unrelated message", "facebook", "message")).toBe(false);
    });

    it("respects priority ordering when multiple rules match", () => {
      const ruleHighPriority: MetaSocialRule = {
        id: "rule_high",
        business_id: "biz_astrology",
        platform: "both",
        target_type: "both",
        rule_name: "Specific Pricing Rule",
        keywords: ["price", "fees", "கட்டணம்"],
        match_type: "contains",
        response_action: "reply_dm",
        predefined_reply: "Consultation fee is ₹500.",
        priority: 5,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const ruleLowPriority: MetaSocialRule = {
        id: "rule_low",
        business_id: "biz_astrology",
        platform: "both",
        target_type: "both",
        rule_name: "General Consultation Rule",
        keywords: ["consultation", "price"],
        match_type: "contains",
        response_action: "reply_dm",
        predefined_reply: "General Consultation details.",
        priority: 50,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const matched = findMatchingSocialRule(
        [ruleLowPriority, ruleHighPriority],
        "What is the consultation price?",
        "facebook",
        "message"
      );

      expect(matched?.id).toBe("rule_high");
      expect(matched?.predefined_reply).toBe("Consultation fee is ₹500.");
    });
  });

  // --------------------------------------------------------------------------
  // 4. End-to-End Orchestration & Dispatcher Tests
  // --------------------------------------------------------------------------
  describe("Dispatcher & Automation Orchestration", () => {
    function createMockSupabase(params: {
      rules?: MetaSocialRule[];
      connection?: any;
    }) {
      const { rules = [], connection } = params;

      return {
        rpc: vi.fn().mockImplementation((name, args) => {
          if (name === "ingest_meta_social_event_atomic") {
            if (!connection) {
              return Promise.resolve({
                data: { status: "ignored", reason: "no_active_connection_found" },
                error: null,
              });
            }
            return Promise.resolve({
              data: {
                status: "ingested",
                event_id: "event_uuid_101",
                business_id: connection.business_id,
                connection_id: connection.id,
                credential_ref: connection.credential_ref,
                page_id: connection.page_id,
                account_id: connection.account_id,
                auto_reply_dms: connection.auto_reply_dms,
                auto_reply_comments: connection.auto_reply_comments,
                auto_dm_on_comment: connection.auto_dm_on_comment,
                comment_dm_trigger_keywords: connection.comment_dm_trigger_keywords,
                default_comment_reply: connection.default_comment_reply,
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: rules, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })),
      };
    }

    it("sends predefined DM reply when Facebook message matches rule", async () => {
      const sendDmSpy = vi
        .spyOn(client, "sendMetaSocialDm")
        .mockResolvedValue({ message_id: "mid.outbound_1", recipient_id: "user_psid_999" });

      const mockConn = {
        id: "conn_fb_1",
        business_id: "biz_astrology",
        platform: "facebook",
        account_id: "fb_page_1001",
        page_id: "fb_page_1001",
        credential_ref: "sec_fb_1",
        auto_reply_dms: true,
        auto_reply_comments: true,
        auto_dm_on_comment: true,
      };

      const mockRule: MetaSocialRule = {
        id: "rule_astrology_dm",
        business_id: "biz_astrology",
        platform: "facebook",
        target_type: "message",
        rule_name: "Astrology Inquiry",
        keywords: ["horoscope", "ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_dm",
        predefined_reply: "வணக்கம்! Gokul Astrological Insights-க்கு வரவேற்கிறோம்.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = createMockSupabase({ connection: mockConn, rules: [mockRule] });

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "fb_page_1001",
        eventType: "message",
        metaEventId: "mid.inbound_99",
        senderId: "user_psid_999",
        content: "Need horoscope details please",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event, {
        overrideAccessToken: "EAAB_TEST_TOKEN",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.replyType).toBe("dm_reply");
      expect(result.replyContent).toBe("வணக்கம்! Gokul Astrological Insights-க்கு வரவேற்கிறோம்.");

      expect(sendDmSpy).toHaveBeenCalledWith({
        platform: "facebook",
        pageIdOrAccountId: "fb_page_1001",
        recipientId: "user_psid_999",
        text: "வணக்கம்! Gokul Astrological Insights-க்கு வரவேற்கிறோம்.",
        accessToken: "EAAB_TEST_TOKEN",
      });
    });

    it("sends public comment reply AND private DM on Instagram Reel comment with 'both_public_and_private'", async () => {
      const publicReplySpy = vi
        .spyOn(client, "replyMetaCommentPublic")
        .mockResolvedValue({ id: "ig_reply_1" });
      const privateDmSpy = vi
        .spyOn(client, "sendMetaCommentPrivateDm")
        .mockResolvedValue({ message_id: "mid.ig_dm_1", recipient_id: "ig_comment_88" });

      const mockConn = {
        id: "conn_ig_1",
        business_id: "biz_vivaham",
        platform: "instagram",
        account_id: "ig_acc_500",
        page_id: "fb_page_linked_500",
        credential_ref: "sec_ig_1",
        auto_reply_dms: true,
        auto_reply_comments: true,
        auto_dm_on_comment: true,
      };

      const mockRule: MetaSocialRule = {
        id: "rule_vivaham_comment",
        business_id: "biz_vivaham",
        platform: "instagram",
        target_type: "comment",
        rule_name: "Vivaham Registration Comment",
        keywords: ["details", "பதிவு", "vivaham"],
        match_type: "contains",
        response_action: "both_public_and_private",
        predefined_reply: "நன்றி! விவரங்களை உங்கள் DM-க்கு அனுப்பியுள்ளோம்.",
        predefined_dm: "Gokul Vivaham: புதிய வரன் பதிவிற்கு எங்கள் இணையதளத்தை அணுகவும்.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = createMockSupabase({ connection: mockConn, rules: [mockRule] });

      const event: NormalizedMetaSocialEvent = {
        platform: "instagram",
        accountId: "ig_acc_500",
        eventType: "comment",
        metaEventId: "ig_comment_88",
        commentId: "ig_comment_88",
        senderId: "user_insta_44",
        content: "Please send Vivaham details",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event, {
        overrideAccessToken: "EAAB_TEST_TOKEN",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.replyType).toBe("both");

      expect(publicReplySpy).toHaveBeenCalledWith({
        platform: "instagram",
        commentId: "ig_comment_88",
        message: "நன்றி! விவரங்களை உங்கள் DM-க்கு அனுப்பியுள்ளோம்.",
        accessToken: "EAAB_TEST_TOKEN",
      });

      expect(privateDmSpy).toHaveBeenCalledWith({
        pageId: "fb_page_linked_500",
        commentId: "ig_comment_88",
        text: "Gokul Vivaham: புதிய வரன் பதிவிற்கு எங்கள் இணையதளத்தை அணுகவும்.",
        accessToken: "EAAB_TEST_TOKEN",
      });
    });

    it("handles idempotency: returns duplicate status without triggering outbound API calls", async () => {
      const sendDmSpy = vi.spyOn(client, "sendMetaSocialDm");

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { status: "duplicate" },
          error: null,
        }),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "fb_page_1001",
        eventType: "message",
        metaEventId: "mid.already_seen_id",
        senderId: "user_psid_999",
        content: "Duplicate webhook delivery",
        timestamp: Date.now(),
      };

      const result = await processMetaSocialEvent(mockSupabase, event, {
        overrideAccessToken: "EAAB_TEST_TOKEN",
      });

      expect(result.status).toBe("duplicate");
      expect(sendDmSpy).not.toHaveBeenCalled();
    });
  });
});
