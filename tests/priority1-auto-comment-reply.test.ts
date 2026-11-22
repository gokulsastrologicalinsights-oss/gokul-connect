import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseMetaSocialWebhook } from "@/lib/meta-social/parser";
import {
  findMatchingSocialRule,
  matchSocialRule,
  normalizeSocialText,
  detectLanguage,
  resolvePublicReplyText,
  getMatchedSocialKeyword,
} from "@/lib/meta-social/evaluator";
import {
  processPersistedMetaSocialEvent,
  computeBackoffDelay,
} from "@/lib/meta-social/service";
import * as client from "@/lib/meta-social/client";
import {
  saveSocialRuleMemory,
  resetMemorySocialRulesStore,
  getSocialRulesMemory,
} from "@/lib/meta-social/rules-store";
import type {
  MetaSocialRule,
  MetaSocialEvent,
  MetaSocialConnection,
} from "@/lib/meta-social/types";

describe("Priority 1: Facebook & Instagram Automatic Public Comment Reply Suite", () => {
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetMemorySocialRulesStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // DOMAIN 1: 6-STEP WORKFLOW FOR FACEBOOK COMMENTS
  // ============================================================================
  describe("Domain 1: 6-Step Workflow for Facebook Comments", () => {
    it("1.1 Step 1 & 2: Detects inbound Facebook comment from Meta webhook payload", () => {
      const fbPayload = {
        object: "page",
        entry: [
          {
            id: "fb_page_astro_101",
            time: 1774000000,
            changes: [
              {
                field: "feed",
                value: {
                  item: "comment",
                  verb: "add",
                  comment_id: "fb_comm_998877",
                  post_id: "fb_post_554433",
                  parent_id: "fb_post_554433",
                  created_time: 1774000000,
                  from: {
                    id: "fb_user_tamil_reader",
                    name: "Selvaraj M",
                  },
                  message: "வணக்கம் குருஜி, எனக்கு ஜாதகம் பார்க்க கட்டணம் எவ்வளவு?",
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaSocialWebhook(fbPayload);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.platform).toBe("facebook");
      expect(ev.eventType).toBe("comment");
      expect(ev.accountId).toBe("fb_page_astro_101");
      expect(ev.metaEventId).toBe("fb_comm_998877");
      expect(ev.commentId).toBe("fb_comm_998877");
      expect(ev.postId).toBe("fb_post_554433");
      expect(ev.senderName).toBe("Selvaraj M");
      expect(ev.content).toContain("ஜாதகம்");
    });

    it("1.2 Step 3, 4, 5, 6: Executes Facebook auto-reply on Tamil keyword match", async () => {
      const replySpy = vi
        .spyOn(client, "replyMetaCommentPublic")
        .mockResolvedValue({ id: "fb_reply_112233" });

      const mockRule: MetaSocialRule = {
        id: "rule_astro_ta_1",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Astro Tamil Horoscope",
        keywords: ["ஜாதகம்", "ஜோதிடம்", "ராசி பலன்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "வணக்கம்! உங்கள் ஜாதக ஆலோசனை விவரங்களை Inbox-ல் அனுப்பியுள்ளோம்.",
        priority: 10,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_fb_ta_1",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_astro",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_998877",
        sender_id: "fb_user_1",
        comment_id: "fb_comm_998877",
        post_id: "fb_post_554433",
        content: "வணக்கம் குருஜி, எனது பிறந்த ஜாதகம் கணித்து பலன் சொல்லவும்.",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_astro",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_astro_101",
        account_name: "Gokul's Astrological Insights Page",
        credential_ref: "sec_vault_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let recordedDelivery: any = null;
      let recordedEventResult: any = null;

      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockImplementation((payload) => {
                recordedDelivery = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { id: "del_fb_1" }, error: null }),
                  }),
                };
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockImplementation((payload) => {
                recordedEventResult = payload;
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

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN_ASTRO_FB",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      // Step 3 & 4: Correct rule and template matched
      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.matchedRuleId).toBe(mockRule.id);
      expect(result.replyContent).toBe(mockRule.predefined_reply);

      // Step 5: Published to official Facebook comments endpoint /{comment-id}/comments
      expect(replySpy).toHaveBeenCalledTimes(1);
      expect(replySpy).toHaveBeenCalledWith({
        platform: "facebook",
        commentId: "fb_comm_998877",
        message: mockRule.predefined_reply,
        accessToken: "EAAG_TEST_TOKEN_ASTRO_FB",
      });

      // Step 6: Recorded delivery status and response ID
      expect(result.publicReplyId).toBe("fb_reply_112233");
      expect(recordedDelivery).toBeDefined();
      expect(recordedDelivery.idempotency_key).toBe("idemp_pub_facebook_fb_page_astro_101_fb_comm_998877");
      expect(recordedEventResult.status).toBe("replied");
      expect(recordedEventResult.public_reply_id).toBe("fb_reply_112233");
    });

    it("1.3 Step 3 & 4: Selects English public reply for Facebook comment matching English keyword", async () => {
      const replySpy = vi
        .spyOn(client, "replyMetaCommentPublic")
        .mockResolvedValue({ id: "fb_reply_en_4455" });

      const bilingualRule: MetaSocialRule = {
        id: "rule_astro_bilingual",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Horoscope & Astrology Bilingual",
        keywords: ["horoscope", "astrology", "ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: JSON.stringify({
          ta: "வணக்கம்! உங்கள் ஜாதக ஆலோசனை விவரங்களை இன்பாக்ஸில் அனுப்பியுள்ளோம்.",
          en: "Namaste! Thank you for reaching out. We have sent consultation fees to your inbox.",
        }),
        priority: 5,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_fb_en_1",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_astro",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_en_101",
        sender_id: "fb_user_en",
        comment_id: "fb_comm_en_101",
        content: "What is your HOROSCOPE consultation fee?",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_astro",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_astro_101",
        account_name: "Gokul's Astrological Insights Page",
        credential_ref: "sec_vault_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [bilingualRule], error: null }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_fb_en" }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN_ASTRO_FB",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      // Must select English template because comment was in English
      expect(result.replyContent).toBe(
        "Namaste! Thank you for reaching out. We have sent consultation fees to your inbox."
      );
      expect(replySpy).toHaveBeenCalledWith({
        platform: "facebook",
        commentId: "fb_comm_en_101",
        message: "Namaste! Thank you for reaching out. We have sent consultation fees to your inbox.",
        accessToken: "EAAG_TEST_TOKEN_ASTRO_FB",
      });
    });

    it("1.4 Retrieves Facebook comment details when webhook payload lacks content", async () => {
      const fetchDetailsSpy = vi
        .spyOn(client, "fetchMetaCommentDetails")
        .mockResolvedValue({
          id: "fb_comm_empty_payload",
          text: "ஜோதிடம் பார்க்க நேரம் கிடைக்குமா?",
          fromId: "fb_user_seeker",
          fromName: "Seeker Murugan",
        });

      vi.spyOn(client, "replyMetaCommentPublic").mockResolvedValue({ id: "fb_reply_retrieved" });

      const mockRule: MetaSocialRule = {
        id: "rule_astro_jothidam",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Jothidam Tamil Rule",
        keywords: ["ஜோதிடம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "வணக்கம்! ஜோதிட ஆலோசனைக்கு உங்கள் விவரங்களை இன்பாக்ஸில் அனுப்பவும்.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Event arrives with empty content (minimal webhook notification)
      const mockEvent: MetaSocialEvent = {
        id: "evt_fb_no_content",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_astro",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_empty_payload",
        sender_id: "fb_user_seeker",
        comment_id: "fb_comm_empty_payload",
        content: "", // EMPTY!
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_astro",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_astro_101",
        account_name: "Gokul's Astrological Insights Page",
        credential_ref: "sec_vault_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_fb_ret" }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN_ASTRO_FB",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      // Verify fetchMetaCommentDetails was invoked to retrieve missing comment
      expect(fetchDetailsSpy).toHaveBeenCalledWith({
        platform: "facebook",
        commentId: "fb_comm_empty_payload",
        accessToken: "EAAG_TEST_TOKEN_ASTRO_FB",
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.matchedRuleId).toBe(mockRule.id);
    });
  });

  // ============================================================================
  // DOMAIN 2: 6-STEP WORKFLOW FOR INSTAGRAM COMMENTS
  // ============================================================================
  describe("Domain 2: 6-Step Workflow for Instagram Comments", () => {
    it("2.1 Step 1 & 2: Detects inbound Instagram comment from Meta webhook payload", () => {
      const igPayload = {
        object: "instagram",
        entry: [
          {
            id: "ig_account_vivaham_202",
            time: 1774000100,
            changes: [
              {
                field: "comments",
                value: {
                  id: "ig_comm_11223344",
                  text: "திருமணம் பதிவு கட்டணம் மற்றும் வரன் விவரங்கள் என்ன?",
                  created_time: 1774000100,
                  from: {
                    id: "ig_user_bride_parent",
                    username: "meenakshi_amma",
                  },
                  media: {
                    id: "ig_media_reels_8877",
                  },
                },
              },
            ],
          },
        ],
      };

      const events = parseMetaSocialWebhook(igPayload);
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.platform).toBe("instagram");
      expect(ev.eventType).toBe("comment");
      expect(ev.accountId).toBe("ig_account_vivaham_202");
      expect(ev.metaEventId).toBe("ig_comm_11223344");
      expect(ev.commentId).toBe("ig_comm_11223344");
      expect(ev.postId).toBe("ig_media_reels_8877");
      expect(ev.senderName).toBe("meenakshi_amma");
      expect(ev.content).toContain("திருமணம்");
    });

    it("2.2 Step 3, 4, 5, 6: Executes Instagram auto-reply via /{comment-id}/replies on Tamil keyword match", async () => {
      const replySpy = vi
        .spyOn(client, "replyMetaCommentPublic")
        .mockResolvedValue({ id: "ig_rep_ack_5566" });

      const mockRule: MetaSocialRule = {
        id: "rule_viva_ta_1",
        business_id: VIVAHAM_BIZ_ID,
        platform: "instagram",
        target_type: "comment",
        rule_name: "Vivaham Tamil Matrimony Registration",
        keywords: ["திருமணம்", "வரன்", "பெண் தேவை", "மாப்பிள்ளை தேவை"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply:
          "வணக்கம்! கோகுல் விவாஹம் வரன் பதிவு மற்றும் விவரங்களை உங்கள் இன்ஸ்டாகிராம் இன்பாக்ஸில் அனுப்பியுள்ளோம்.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_ig_ta_1",
        business_id: VIVAHAM_BIZ_ID,
        connection_id: "conn_ig_vivaham",
        platform: "instagram",
        event_type: "comment",
        meta_event_id: "ig_comm_11223344",
        sender_id: "ig_user_bride_parent",
        comment_id: "ig_comm_11223344",
        post_id: "ig_media_reels_8877",
        content: "திருமணம் வரன் பதிவு செய்ய விரும்புகிறோம்.",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_ig_vivaham",
        business_id: VIVAHAM_BIZ_ID,
        platform: "instagram",
        account_id: "ig_account_vivaham_202",
        account_name: "@gokul_vivaham",
        credential_ref: "sec_vault_viv",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_ig_1" }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN_VIVAHAM_IG",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.matchedRuleId).toBe(mockRule.id);

      // Step 5: Instagram uses /{comment-id}/replies, verified by platform parameter
      expect(replySpy).toHaveBeenCalledWith({
        platform: "instagram",
        commentId: "ig_comm_11223344",
        message: mockRule.predefined_reply,
        accessToken: "EAAG_TEST_TOKEN_VIVAHAM_IG",
      });
      expect(result.publicReplyId).toBe("ig_rep_ack_5566");
    });

    it("2.3 Step 3 & 4: Selects English public reply for Instagram comment matching English keyword (matrimony / bride)", async () => {
      const replySpy = vi
        .spyOn(client, "replyMetaCommentPublic")
        .mockResolvedValue({ id: "ig_rep_en_7788" });

      const bilingualRule: MetaSocialRule = {
        id: "rule_viva_bilingual",
        business_id: VIVAHAM_BIZ_ID,
        platform: "instagram",
        target_type: "comment",
        rule_name: "Vivaham Matrimony Bilingual",
        keywords: ["matrimony", "bride", "groom", "வரன்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: JSON.stringify({
          ta: "வணக்கம்! வரன் பதிவு விவரங்களை உங்கள் இன்ஸ்டாகிராமில் அனுப்பியுள்ளோம்.",
          en: "Hello! Thank you for contacting Gokul Vivaham. Registration details have been sent to your inbox.",
        }),
        priority: 5,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_ig_en_1",
        business_id: VIVAHAM_BIZ_ID,
        connection_id: "conn_ig_vivaham",
        platform: "instagram",
        event_type: "comment",
        meta_event_id: "ig_comm_en_7766",
        sender_id: "ig_user_groom_searcher",
        comment_id: "ig_comm_en_7766",
        content: "Looking for verified bride profiles in Chennai. Please share matrimony registration details.",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_ig_vivaham",
        business_id: VIVAHAM_BIZ_ID,
        platform: "instagram",
        account_id: "ig_account_vivaham_202",
        account_name: "@gokul_vivaham",
        credential_ref: "sec_vault_viv",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [bilingualRule], error: null }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_ig_en" }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN_VIVAHAM_IG",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.replyContent).toBe(
        "Hello! Thank you for contacting Gokul Vivaham. Registration details have been sent to your inbox."
      );
      expect(replySpy).toHaveBeenCalledWith({
        platform: "instagram",
        commentId: "ig_comm_en_7766",
        message: "Hello! Thank you for contacting Gokul Vivaham. Registration details have been sent to your inbox.",
        accessToken: "EAAG_TEST_TOKEN_VIVAHAM_IG",
      });
    });

    it("2.4 Retrieves Instagram comment details via Graph API when text is missing in webhook payload", async () => {
      const fetchDetailsSpy = vi
        .spyOn(client, "fetchMetaCommentDetails")
        .mockResolvedValue({
          id: "ig_comm_empty_text",
          text: "மாப்பிள்ளை தேவை விவரங்கள் தேவை",
          fromId: "ig_user_amma",
          fromName: "amma_99",
        });

      vi.spyOn(client, "replyMetaCommentPublic").mockResolvedValue({ id: "ig_rep_retrieved" });

      const mockRule: MetaSocialRule = {
        id: "rule_viva_groom",
        business_id: VIVAHAM_BIZ_ID,
        platform: "instagram",
        target_type: "comment",
        rule_name: "Groom Tamil Enquiry",
        keywords: ["மாப்பிள்ளை தேவை"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "வணக்கம்! மாப்பிள்ளை வரன் விவரங்களை எங்கள் ஒருங்கிணைப்பாளர் உடனே அனுப்புவார்.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_ig_empty_text",
        business_id: VIVAHAM_BIZ_ID,
        connection_id: "conn_ig_vivaham",
        platform: "instagram",
        event_type: "comment",
        meta_event_id: "ig_comm_empty_text",
        sender_id: "ig_user_amma",
        comment_id: "ig_comm_empty_text",
        content: "", // EMPTY!
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_ig_vivaham",
        business_id: VIVAHAM_BIZ_ID,
        platform: "instagram",
        account_id: "ig_account_vivaham_202",
        account_name: "@gokul_vivaham",
        credential_ref: "sec_vault_viv",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_ig_ret" }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN_VIVAHAM_IG",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(fetchDetailsSpy).toHaveBeenCalledWith({
        platform: "instagram",
        commentId: "ig_comm_empty_text",
        accessToken: "EAAG_TEST_TOKEN_VIVAHAM_IG",
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.matchedRuleId).toBe(mockRule.id);
    });
  });

  // ============================================================================
  // DOMAIN 3: KEYWORD MATCHING ENGINE & DETERMINISTIC PRIORITY
  // ============================================================================
  describe("Domain 3: Keyword Matching Engine & Deterministic Priority", () => {
    it("3.1 Normalizes Unicode Tamil syllables and strips zero-width spaces", () => {
      // String with zero-width spaces (\u200B) and combining characters
      const raw = "  \u200Bதிருமணப் பொருத்தம்!! & ஜாதகம்??\u200C  ";
      const normalized = normalizeSocialText(raw);
      expect(normalized).toBe("திருமணப் பொருத்தம் ஜாதகம்");
      expect(detectLanguage(normalized)).toBe("ta");
    });

    it("3.2 Performs case-insensitive matching for English keywords", () => {
      const baseRule: MetaSocialRule = {
        id: "r1",
        business_id: ASTRO_BIZ_ID,
        platform: "both",
        target_type: "comment",
        rule_name: "Astro",
        keywords: ["horoscope", "astrology"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "reply",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(matchSocialRule(baseRule, "PLEASE CHECK MY HOROSCOPE", "facebook", "comment")).toBe(true);
      expect(matchSocialRule(baseRule, "I want Astrology consultation", "instagram", "comment")).toBe(true);
      expect(matchSocialRule(baseRule, "unrelated text here", "facebook", "comment")).toBe(false);
    });

    it("3.3 Evaluates exact match vs partial match", () => {
      const exactRule: MetaSocialRule = {
        id: "r_exact",
        business_id: ASTRO_BIZ_ID,
        platform: "both",
        target_type: "comment",
        rule_name: "Exact",
        keywords: ["ஜாதகம்"],
        match_type: "exact",
        response_action: "reply_comment_public",
        predefined_reply: "reply",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(matchSocialRule(exactRule, "ஜாதகம்!", "facebook", "comment")).toBe(true);
      expect(matchSocialRule(exactRule, "எனக்கு ஜாதகம் வேண்டும்", "facebook", "comment")).toBe(false);

      const partialRule: MetaSocialRule = {
        ...exactRule,
        match_type: "contains",
      };
      expect(matchSocialRule(partialRule, "எனக்கு ஜாதகம் வேண்டும்", "facebook", "comment")).toBe(true);
    });

    it("3.4 Matches multi-word Tamil keywords (ராசி பலன், மாப்பிள்ளை தேவை)", () => {
      const multiWordRule: MetaSocialRule = {
        id: "r_multi",
        business_id: VIVAHAM_BIZ_ID,
        platform: "both",
        target_type: "comment",
        rule_name: "Vivaham Multi",
        keywords: ["மாப்பிள்ளை தேவை", "பெண் தேவை", "ராசி பலன்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "reply",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(matchSocialRule(multiWordRule, "USA-வில் நல்ல மாப்பிள்ளை தேவை", "instagram", "comment")).toBe(true);
      expect(matchSocialRule(multiWordRule, "இன்றைய ராசி பலன் என்ன?", "facebook", "comment")).toBe(true);
      expect(getMatchedSocialKeyword(multiWordRule, "USA-வில் நல்ல மாப்பிள்ளை தேவை")).toBe("மாப்பிள்ளை தேவை");
    });

    it("3.5 Strictly ignores disabled rules (is_active: false)", () => {
      const disabledRule: MetaSocialRule = {
        id: "r_disabled",
        business_id: ASTRO_BIZ_ID,
        platform: "both",
        target_type: "comment",
        rule_name: "Disabled Rule",
        keywords: ["ஜாதகம்", "horoscope"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "reply",
        priority: 1,
        is_active: false, // DISABLED
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(matchSocialRule(disabledRule, "ஜாதகம் பார்க்க வேண்டும்", "facebook", "comment")).toBe(false);
      const matched = findMatchingSocialRule([disabledRule], "ஜாதகம் பார்க்க வேண்டும்", "facebook", "comment");
      expect(matched).toBeNull();
    });

    it("3.6 Deterministically selects rule according to priority policy when multiple rules match", () => {
      const ruleLowPriority: MetaSocialRule = {
        id: "r_priority_100",
        business_id: ASTRO_BIZ_ID,
        platform: "both",
        target_type: "comment",
        rule_name: "General Astro Rule",
        keywords: ["ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "Low Priority Reply",
        priority: 100,
        is_active: true,
        stop_processing_on_match: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const ruleHighPriority: MetaSocialRule = {
        id: "r_priority_1",
        business_id: ASTRO_BIZ_ID,
        platform: "both",
        target_type: "comment",
        rule_name: "VIP Astro Rule",
        keywords: ["ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "VIP High Priority Reply",
        priority: 1, // LOWER NUMBER = HIGHER PRIORITY
        is_active: true,
        stop_processing_on_match: true,
        created_at: "2026-01-02T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      };

      // Pass in reverse order to test sorting
      const matched = findMatchingSocialRule(
        [ruleLowPriority, ruleHighPriority],
        "ஜாதகம்",
        "facebook",
        "comment"
      );
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe("r_priority_1");
      expect(matched?.predefined_reply).toBe("VIP High Priority Reply");
    });

    it("3.7 Does not reply if no rule matches and no keywords match (status: ignored)", async () => {
      const replySpy = vi.spyOn(client, "replyMetaCommentPublic");

      const mockEvent: MetaSocialEvent = {
        id: "evt_no_match",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_astro",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_random",
        sender_id: "user_random",
        comment_id: "fb_comm_random",
        content: "Nice photo, beautiful evening picture!",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_astro",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_astro_101",
        account_name: "Gokul's Astrological Insights Page",
        credential_ref: "sec_vault_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: ["ஜாதகம்", "horoscope"],
        default_comment_reply: "default reply",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let eventStatusRecorded = "";
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockImplementation((payload) => {
                eventStatusRecorded = payload.status;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("ignored");
      expect(eventStatusRecorded).toBe("ignored");
      expect(replySpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DOMAIN 4: BUSINESS SEPARATION & TENANT ISOLATION
  // ============================================================================
  describe("Domain 4: Business Separation & Tenant Isolation", () => {
    it("4.1 Separates rules, keywords and templates between Astrology and Vivaham", () => {
      saveSocialRuleMemory(ASTRO_BIZ_ID, {
        platform: "facebook",
        targetType: "comment",
        ruleName: "Astrology Rule",
        keywords: ["ஜாதகம்", "horoscope"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "Astrology Tamil Reply",
        isActive: true,
      });

      saveSocialRuleMemory(VIVAHAM_BIZ_ID, {
        platform: "facebook",
        targetType: "comment",
        ruleName: "Vivaham Rule",
        keywords: ["திருமணம்", "matrimony"],
        matchType: "contains",
        responseAction: "reply_comment_public",
        predefinedReply: "Vivaham Tamil Reply",
        isActive: true,
      });

      const astroRules = getSocialRulesMemory(ASTRO_BIZ_ID);
      const vivahamRules = getSocialRulesMemory(VIVAHAM_BIZ_ID);

      expect(astroRules).toHaveLength(1);
      expect(astroRules[0].rule_name).toBe("Astrology Rule");
      expect(astroRules[0].keywords).toContain("ஜாதகம்");

      expect(vivahamRules).toHaveLength(1);
      expect(vivahamRules[0].rule_name).toBe("Vivaham Rule");
      expect(vivahamRules[0].keywords).toContain("திருமணம்");
    });

    it("4.2 Blocks cross-tenant credential usage when processing comment", async () => {
      const mockEvent: MetaSocialEvent = {
        id: "evt_cross_tenant",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_vivaham_leak",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_cross",
        sender_id: "user_cross",
        comment_id: "fb_comm_cross",
        content: "ஜாதகம்",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      // Connection belongs to Vivaham, but event belongs to Astrology
      const crossTenantConn: MetaSocialConnection = {
        id: "conn_vivaham_leak",
        business_id: VIVAHAM_BIZ_ID, // MISMATCH!
        platform: "facebook",
        account_id: "fb_page_vivaham",
        account_name: "Vivaham",
        credential_ref: "sec_vault_viv",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_connections") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // Fails tenant check
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        preloadedEvent: mockEvent,
        preloadedConnection: crossTenantConn.business_id === mockEvent.business_id ? crossTenantConn : undefined,
      });

      expect(result.status).toBe("ignored");
    });
  });

  // ============================================================================
  // DOMAIN 5: EXACTLY-ONCE SAFETY & DUPLICATE PREVENTION
  // ============================================================================
  describe("Domain 5: Exactly-Once Safety & Duplicate Prevention", () => {
    it("5.1 Prevents duplicate reply using persistent idempotency key (platform_accountId_commentId)", async () => {
      const replySpy = vi.spyOn(client, "replyMetaCommentPublic");

      const mockRule: MetaSocialRule = {
        id: "rule_astro_dup",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Astro",
        keywords: ["ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "வணக்கம்! உங்கள் ஜாதக ஆலோசனை விவரங்கள் அனுப்பப்பட்டுள்ளது.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_dup_test",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_astro",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_dup_100",
        sender_id: "user_dup",
        comment_id: "fb_comm_dup_100",
        content: "ஜாதகம்",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_astro",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_astro_101",
        account_name: "Gokul's Astrological Insights Page",
        credential_ref: "sec_vault_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col, val) => {
                // Idempotency check: ALREADY SUCCEEDED!
                if (val === "idemp_pub_facebook_fb_page_astro_101_fb_comm_dup_100") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "del_prev_succeeded",
                        status: "succeeded",
                        response_id: "existing_fb_reply_999",
                      },
                      error: null,
                    }),
                  };
                }
                return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
              }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      // Exactly-once guarantee: does NOT execute duplicate Meta API call
      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.publicReplyId).toBe("existing_fb_reply_999");
      expect(replySpy).not.toHaveBeenCalled();
    });

    it("5.2 Halts on ambiguous network timeout without blindly re-posting, and reconciles before retry", async () => {
      // 1. First execution throws network timeout (504 Ambiguous)
      vi.spyOn(client, "replyMetaCommentPublic").mockRejectedValue(
        new client.MetaSocialApiError(
          { message: "Network timeout connecting to Graph API", code: 504 },
          "https://graph.facebook.com/v21.0/comm_ambig_1/comments",
          { httpStatus: 504, isAmbiguous: true }
        )
      );

      const mockRule: MetaSocialRule = {
        id: "rule_ambig",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Astro",
        keywords: ["ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "வணக்கம்! உங்கள் ஜாதக ஆலோசனை விவரங்கள் அனுப்பப்பட்டுள்ளது.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_ambig_1",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_astro",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "comm_ambig_1",
        sender_id: "user_ambig",
        comment_id: "comm_ambig_1",
        content: "ஜாதகம்",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_astro",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_astro_101",
        account_name: "Gokul's Astrological Insights Page",
        credential_ref: "sec_vault_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let deliveryStatus = "";
      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_ambig_1" }, error: null }),
                }),
              }),
              update: vi.fn().mockImplementation((payload) => {
                deliveryStatus = payload.status;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      // Verify it was marked ambiguous_outcome and NOT blindly retried
      expect(result.publicReplyStatus).toBe("ambiguous_outcome");
      expect(deliveryStatus).toBe("ambiguous_outcome");

      // 2. Second pass: Reconciliation confirms comment was already posted by Meta!
      const reconSpy = vi.spyOn(client, "checkCommentReplied").mockResolvedValue({
        replied: true,
        existingReplyId: "reconciled_reply_id_8899",
      });
      const dispatchSpy = vi.spyOn(client, "replyMetaCommentPublic");
      dispatchSpy.mockClear();

      const mockSupabaseRecon = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "del_ambig_1",
                    status: "ambiguous_outcome",
                  },
                  error: null,
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const reconResult = await processPersistedMetaSocialEvent(mockSupabaseRecon, mockEvent.id, {
        overrideAccessToken: "EAAG_TEST_TOKEN",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(reconSpy).toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled(); // No double post!
      expect(reconResult.publicReplyId).toBe("reconciled_reply_id_8899");
      expect(reconResult.status).toBe("replied");
    });
  });

  // ============================================================================
  // DOMAIN 6: ERROR CLASSIFICATION & TOKEN RESILIENCE
  // ============================================================================
  describe("Domain 6: Error Classification & Resilience", () => {
    it("6.1 Classifies expired token (code 190) and marks connection expired", async () => {
      vi.spyOn(client, "replyMetaCommentPublic").mockRejectedValue(
        new client.MetaSocialApiError(
          { message: "Error validating access token: Session has expired.", code: 190 },
          "https://graph.facebook.com/v21.0/c1/comments",
          { httpStatus: 400 }
        )
      );

      const mockRule: MetaSocialRule = {
        id: "r1",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Astro",
        keywords: ["ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "reply",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_expired_token",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_expired",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "c1",
        sender_id: "u1",
        comment_id: "c1",
        content: "ஜாதகம்",
        status: "processing",
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_expired",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_101",
        account_name: "FB Page",
        credential_ref: "sec_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let deliveryStatus = "";
      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_exp" }, error: null }),
                }),
              }),
              update: vi.fn().mockImplementation((payload) => {
                deliveryStatus = payload.status;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "EXPIRED_TOKEN",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(result.publicReplyStatus).toBe("failed");
      expect(deliveryStatus).toBe("failed");
      expect(result.errorMessage).toContain("Session has expired");
    });

    it("6.2 Classifies transient rate limit (HTTP 429) and schedules backoff retry", async () => {
      vi.spyOn(client, "replyMetaCommentPublic").mockRejectedValue(
        new client.MetaSocialApiError(
          { message: "User request limit reached", code: 613 },
          "https://graph.facebook.com/v21.0/c1/comments",
          { httpStatus: 429, retryAfterSeconds: 60 }
        )
      );

      const mockRule: MetaSocialRule = {
        id: "r1",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Astro",
        keywords: ["ஜாதகம்"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "reply",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: MetaSocialEvent = {
        id: "evt_rate_limit",
        business_id: ASTRO_BIZ_ID,
        connection_id: "conn_fb_1",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "c1",
        sender_id: "u1",
        comment_id: "c1",
        content: "ஜாதகம்",
        status: "processing",
        attempt_count: 1,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      };

      const mockConnection: MetaSocialConnection = {
        id: "conn_fb_1",
        business_id: ASTRO_BIZ_ID,
        platform: "facebook",
        account_id: "fb_page_101",
        account_name: "FB Page",
        credential_ref: "sec_1",
        connection_status: "connected",
        is_enabled: true,
        auto_reply_dms: false,
        auto_reply_comments: true,
        auto_dm_on_comment: false,
        comment_dm_trigger_keywords: [],
        default_comment_reply: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let deliveryStatus = "";
      let deliveryNextRetry: string | null = null;
      const mockSupabase = {
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
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "del_rate" }, error: null }),
                }),
              }),
              update: vi.fn().mockImplementation((payload) => {
                deliveryStatus = payload.status;
                deliveryNextRetry = payload.nextRetryAt;
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === "meta_social_events") {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, mockEvent.id, {
        overrideAccessToken: "RATE_LIMITED_TOKEN",
        preloadedEvent: mockEvent,
        preloadedConnection: mockConnection,
      });

      expect(result.publicReplyStatus).toBe("retry_scheduled");
      expect(deliveryStatus).toBe("retry_scheduled");
      expect(deliveryNextRetry).not.toBeNull();
    });

    it("6.3 Sanitizes access tokens from error strings so secrets never leak", () => {
      const secretToken = "EAAO7B08XYZ1234567890abcdefghijklmnopqrstuvwxyz";
      const dirtyError = `Error calling URL https://graph.facebook.com/v21.0/comment/123 with token ${secretToken}`;
      const clean = client.sanitizeSocialLog(dirtyError, secretToken);

      expect(clean).not.toContain(secretToken);
      expect(clean).toContain("••••••••");
    });
  });
});
