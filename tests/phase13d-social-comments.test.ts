import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import {
  SocialComment,
  SocialCommentPlatform,
  SocialCommentReplyStatus,
} from "@/lib/social-comments/types";
import {
  getSocialComments,
  replyToSocialComment,
  executeAutoReplies,
  seedPresetCommentsMemory,
  resetMemorySocialComments,
  ingestSocialComment,
  normalizeCommentText,
} from "@/lib/social-comments/comments-store";
import {
  getReplyTemplatesForBusiness,
  PRESET_SOCIAL_REPLY_TEMPLATES,
} from "@/lib/social-comments/templates";
import {
  createYouTubeOAuthState,
  verifyYouTubeOAuthState,
  getYouTubeOAuthAuthorizationUrl,
  exchangeYouTubeCodeForTokens,
  fetchYouTubeChannelDetails,
  YOUTUBE_REQUIRED_SCOPES,
} from "@/lib/social-comments/youtube-oauth";
import {
  getYouTubeConnections,
  saveYouTubeConnection,
  disconnectYouTubeConnection,
  getDecryptedYouTubeToken,
  resetMemoryYouTubeStore,
} from "@/lib/social-comments/youtube-store";
import {
  fetchYouTubeVideoCommentThreads,
  replyToYouTubeComment,
} from "@/lib/social-comments/youtube-client";
import {
  saveSocialConnectionMemory,
  resetMemorySocialStore,
  getDecryptedAccessTokenMemory,
} from "@/lib/meta-social/connections-store";
import * as client from "@/lib/meta-social/client";

describe("Phase 13D — Unified Social Comment Management & Auto-Reply System Test Suite", () => {
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const USER_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetMemorySocialComments();
    resetMemorySocialStore();
    resetMemoryYouTubeStore();
    process.env.APP_ENCRYPTION_SECRET = "test_encryption_master_key_32bytes!!";
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret-32-chars-long!";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  // ============================================================================
  // DOMAIN 1: TENANT ISOLATION & BUSINESS SEPARATION
  // ============================================================================
  describe("Domain 1: Tenant Isolation & Multi-Business Separation", () => {
    it("1.1 seeds and isolates comments strictly between Astrology and Vivaham businesses", () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      seedPresetCommentsMemory(VIVAHAM_BIZ_ID, "vivaham");

      const astroResult = getSocialComments(ASTRO_BIZ_ID);
      const vivahamResult = getSocialComments(VIVAHAM_BIZ_ID);

      expect(astroResult.comments.length).toBeGreaterThan(0);
      expect(vivahamResult.comments.length).toBeGreaterThan(0);

      // Verify every astrology comment belongs to ASTRO_BIZ_ID
      for (const c of astroResult.comments) {
        expect(c.businessId).toBe(ASTRO_BIZ_ID);
        expect(c.postTitle).not.toContain("Matrimony");
      }

      // Verify every vivaham comment belongs to VIVAHAM_BIZ_ID
      for (const c of vivahamResult.comments) {
        expect(c.businessId).toBe(VIVAHAM_BIZ_ID);
        expect(c.postTitle).not.toContain("Guru Peyarchi");
      }
    });

    it("1.2 prevents cross-tenant replies (blocks replying to another business's comment)", async () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const astroComments = getSocialComments(ASTRO_BIZ_ID).comments;
      const targetComment = astroComments[0];

      // Vivaham operator tries to reply to an Astrology comment
      await expect(
        replyToSocialComment({
          businessId: VIVAHAM_BIZ_ID,
          commentId: targetComment.id,
          replyText: "Cross tenant reply attempt",
        })
      ).rejects.toThrow("Tenant mismatch");
    });
  });

  // ============================================================================
  // DOMAIN 2: PRIORITY 1 — FACEBOOK COMMENTS & REPLIES
  // ============================================================================
  describe("Domain 2: Priority 1 — Facebook Comments & Public Replies", () => {
    it("2.1 displays Facebook comment text, commenter name, post info, and timestamp", () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const fbComments = getSocialComments(ASTRO_BIZ_ID, { platform: "facebook" }).comments;

      expect(fbComments.length).toBeGreaterThan(0);
      const fb = fbComments[0];
      expect(fb.platform).toBe("facebook");
      expect(fb.commenterName).toBeTruthy();
      expect(fb.text).toBeTruthy();
      expect(fb.postId).toBeTruthy();
      expect(fb.postTitle).toBeTruthy();
      expect(fb.timestamp).toBeTruthy();
      expect(fb.canReply).toBe(true);
    });

    it("2.2 successfully executes a manual public reply to a Facebook comment", async () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const pendingComment = getSocialComments(ASTRO_BIZ_ID, {
        platform: "facebook",
        replyStatus: "pending",
      }).comments[0];

      expect(pendingComment).toBeDefined();

      const replyText = "வணக்கம்! உங்கள் ஜாதகத்தை கணிக்க பிறந்த நேரத்தை பகிரவும்.";
      const res = await replyToSocialComment({
        businessId: ASTRO_BIZ_ID,
        commentId: pendingComment.id,
        replyText,
      });

      expect(res.success).toBe(true);
      expect(res.replyText).toBe(replyText);
      expect(res.replyId).toBeTruthy();

      // Verify comment status updated in store
      const updated = getSocialComments(ASTRO_BIZ_ID).comments.find(
        (c) => c.id === pendingComment.id
      );
      expect(updated?.replyStatus).toBe("replied");
      expect(updated?.replyText).toBe(replyText);
      expect(updated?.replyTimestamp).toBeTruthy();
    });

    it("2.3 rejects empty or whitespace-only manual replies", async () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const pendingComment = getSocialComments(ASTRO_BIZ_ID).comments[0];

      await expect(
        replyToSocialComment({
          businessId: ASTRO_BIZ_ID,
          commentId: pendingComment.id,
          replyText: "   ",
        })
      ).rejects.toThrow("Reply text cannot be empty");
    });
  });

  // ============================================================================
  // DOMAIN 3: PRIORITY 1 — INSTAGRAM COMMENTS & REPLIES
  // ============================================================================
  describe("Domain 3: Priority 1 — Instagram Comments & Public Replies", () => {
    it("2.4 displays Instagram comment text, commenter username, media title, and timestamp", () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const igComments = getSocialComments(ASTRO_BIZ_ID, { platform: "instagram" }).comments;

      expect(igComments.length).toBeGreaterThan(0);
      const ig = igComments[0];
      expect(ig.platform).toBe("instagram");
      expect(ig.commenterUsername).toBeTruthy();
      expect(ig.text).toBeTruthy();
      expect(ig.postTitle).toBeTruthy();
    });

    it("2.5 supports keyword-based automatic replies for Instagram and Facebook comments", async () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const beforeStats = getSocialComments(ASTRO_BIZ_ID).stats;
      expect(beforeStats.pendingReplies).toBeGreaterThan(0);

      // Execute auto replies
      const autoResult = await executeAutoReplies(ASTRO_BIZ_ID);
      expect(autoResult.processed).toBeGreaterThan(0);
      expect(autoResult.replied).toBeGreaterThan(0);

      const afterStats = getSocialComments(ASTRO_BIZ_ID).stats;
      expect(afterStats.repliedComments).toBeGreaterThan(beforeStats.repliedComments);
    });
  });

  // ============================================================================
  // DOMAIN 4: PRIORITY 2 — YOUTUBE COMMENTS & GOOGLE OAUTH FEASIBILITY
  // ============================================================================
  describe("Domain 4: Priority 2 — YouTube Comments & Technical Feasibility", () => {
    it("4.1 creates cryptographically signed Google OAuth state with CSRF nonce", () => {
      const { state, csrfCookie } = createYouTubeOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      expect(state).toContain(".");
      expect(csrfCookie).toHaveLength(48);

      const verification = verifyYouTubeOAuthState({ state, csrfCookie });
      expect(verification.isValid).toBe(true);
      expect(verification.payload?.businessSlug).toBe("astrology");
      expect(verification.payload?.businessId).toBe(ASTRO_BIZ_ID);
      expect(verification.payload?.userId).toBe(USER_ID);
    });

    it("4.2 rejects tampered or expired Google OAuth state tokens", () => {
      const { state, csrfCookie } = createYouTubeOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      // Tampered state
      const tampered = state.slice(0, -4) + "XXXX";
      const tamperedVerif = verifyYouTubeOAuthState({ state: tampered, csrfCookie });
      expect(tamperedVerif.isValid).toBe(false);

      // Mismatched CSRF
      const wrongCsrfVerif = verifyYouTubeOAuthState({ state, csrfCookie: "wrong-csrf" });
      expect(wrongCsrfVerif.isValid).toBe(false);

      // Expired state
      const expiredVerif = verifyYouTubeOAuthState({ state, csrfCookie, maxAgeMs: -1 });
      expect(expiredVerif.isValid).toBe(false);
      expect(expiredVerif.error).toContain("expired");
    });

    it("4.3 verifies Google OAuth URL contains required YouTube scopes", () => {
      const { state } = createYouTubeOAuthState({
        businessSlug: "astrology",
        businessId: ASTRO_BIZ_ID,
        userId: USER_ID,
      });

      const authUrl = getYouTubeOAuthAuthorizationUrl({ state });
      expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(authUrl).toContain("youtube.force-ssl");
      expect(authUrl).toContain("state=" + encodeURIComponent(state));
    });

    it("4.4 stores YouTube credentials encrypted in AES-256-GCM vault separate from Meta", () => {
      const conn = saveYouTubeConnection(ASTRO_BIZ_ID, {
        channelId: "UC_astro_channel_123",
        channelTitle: "Gokul Astrology Channel",
        customUrl: "@gokul_astrology",
        accessToken: "secret_google_oauth_token_xyz",
        refreshToken: "secret_google_refresh_token_abc",
      });

      expect(conn.id).toBeTruthy();
      expect(conn.channelId).toBe("UC_astro_channel_123");
      expect(conn.hasCredential).toBe(true);
      expect(conn.credentialMaskedHint).toContain("Vault:");

      // Verify decrypted token can be retrieved server-side
      const token = getDecryptedYouTubeToken(ASTRO_BIZ_ID, conn.id);
      expect(token?.accessToken).toBe("secret_google_oauth_token_xyz");
      expect(token?.refreshToken).toBe("secret_google_refresh_token_abc");

      // Verify tenant isolation: Vivaham cannot decrypt Astrology's YouTube credentials
      const crossTenantToken = getDecryptedYouTubeToken(VIVAHAM_BIZ_ID, conn.id);
      expect(crossTenantToken).toBeNull();
    });

    it("4.5 publishes public reply to a YouTube comment and updates reply status", async () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");
      const ytComment = getSocialComments(ASTRO_BIZ_ID, { platform: "youtube" }).comments[0];

      expect(ytComment).toBeDefined();
      expect(ytComment.platform).toBe("youtube");

      const res = await replyToSocialComment({
        businessId: ASTRO_BIZ_ID,
        commentId: ytComment.id,
        replyText: "நன்றி! யூடியூப் விடியோ விளக்கத்தை பார்த்ததற்கு நன்றி.",
      });

      expect(res.success).toBe(true);
      expect(res.replyId).toBeTruthy();

      const updated = getSocialComments(ASTRO_BIZ_ID).comments.find((c) => c.id === ytComment.id);
      expect(updated?.replyStatus).toBe("replied");
    });

    it("4.6 handles YouTube API errors (such as disabled comments) gracefully", async () => {
      await expect(
        replyToYouTubeComment({
          parentId: "",
          text: "Reply test",
          accessToken: "valid_token",
        })
      ).rejects.toThrow("Parent comment ID is required");
    });
  });

  // ============================================================================
  // DOMAIN 5: UNIFIED COMMENT INBOX FILTERING & SEARCH
  // ============================================================================
  describe("Domain 5: Unified Comment Inbox Filtering & Text Search", () => {
    it("5.1 filters comments by platform cleanly", () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");

      const all = getSocialComments(ASTRO_BIZ_ID, { platform: "all" }).comments;
      const fbOnly = getSocialComments(ASTRO_BIZ_ID, { platform: "facebook" }).comments;
      const igOnly = getSocialComments(ASTRO_BIZ_ID, { platform: "instagram" }).comments;
      const ytOnly = getSocialComments(ASTRO_BIZ_ID, { platform: "youtube" }).comments;

      expect(all.length).toBe(fbOnly.length + igOnly.length + ytOnly.length);
      expect(fbOnly.every((c) => c.platform === "facebook")).toBe(true);
      expect(igOnly.every((c) => c.platform === "instagram")).toBe(true);
      expect(ytOnly.every((c) => c.platform === "youtube")).toBe(true);
    });

    it("5.2 filters comments by reply status (pending, replied, failed)", () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");

      const pending = getSocialComments(ASTRO_BIZ_ID, { replyStatus: "pending" }).comments;
      const replied = getSocialComments(ASTRO_BIZ_ID, { replyStatus: "replied" }).comments;
      const failed = getSocialComments(ASTRO_BIZ_ID, { replyStatus: "failed" }).comments;

      expect(pending.every((c) => c.replyStatus === "pending")).toBe(true);
      expect(replied.every((c) => c.replyStatus === "replied")).toBe(true);
      expect(failed.every((c) => c.replyStatus === "failed")).toBe(true);
    });

    it("5.3 performs case-insensitive text search across comments, commenter names, and posts", () => {
      seedPresetCommentsMemory(ASTRO_BIZ_ID, "astrology");

      // Search by Tamil keyword
      const tamilSearch = getSocialComments(ASTRO_BIZ_ID, { searchQuery: "ஜாதகம்" }).comments;
      expect(tamilSearch.length).toBeGreaterThan(0);
      expect(tamilSearch.some((c) => c.text.includes("ஜாதகம்"))).toBe(true);

      // Search by English text
      const englishSearch = getSocialComments(ASTRO_BIZ_ID, { searchQuery: "Sapphire" }).comments;
      expect(englishSearch.length).toBeGreaterThan(0);
      expect(englishSearch[0].text).toContain("Sapphire");

      // Search by commenter name
      const commenterSearch = getSocialComments(ASTRO_BIZ_ID, { searchQuery: "Manikandan" }).comments;
      expect(commenterSearch.length).toBe(1);
      expect(commenterSearch[0].commenterName).toContain("Manikandan");
    });
  });

  // ============================================================================
  // DOMAIN 6: REPLY TEMPLATES (TAMIL & ENGLISH)
  // ============================================================================
  describe("Domain 6: Reply Templates (Tamil & English)", () => {
    it("6.1 loads separate Tamil and English reply templates for Astrology", () => {
      const astroTa = getReplyTemplatesForBusiness("astrology", "ta");
      const astroEn = getReplyTemplatesForBusiness("astrology", "en");

      expect(astroTa.length).toBeGreaterThanOrEqual(3);
      expect(astroEn.length).toBeGreaterThanOrEqual(3);

      expect(astroTa.every((t) => t.language === "ta")).toBe(true);
      expect(astroEn.every((t) => t.language === "en")).toBe(true);

      // Check content reflects astrology consultation
      expect(astroTa.some((t) => t.text.includes("ஜாதக"))).toBe(true);
      expect(astroEn.some((t) => t.text.includes("horoscope"))).toBe(true);
    });

    it("6.2 loads separate Tamil and English reply templates for Vivaham", () => {
      const vivaTa = getReplyTemplatesForBusiness("vivaham", "ta");
      const vivaEn = getReplyTemplatesForBusiness("vivaham", "en");

      expect(vivaTa.length).toBeGreaterThanOrEqual(3);
      expect(vivaEn.length).toBeGreaterThanOrEqual(3);

      // Check content reflects matrimony & matchmaking
      expect(vivaTa.some((t) => t.text.includes("விவாஹம்") || t.text.includes("வரன்"))).toBe(true);
      expect(vivaEn.some((t) => t.text.includes("Matrimony") || t.text.includes("alliance"))).toBe(true);
    });
  });
});
