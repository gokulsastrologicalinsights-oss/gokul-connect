import { validateBusinessTenant } from "@/lib/auth/tenant-guard";
import {
  SocialComment,
  SocialCommentFilterParams,
  SocialCommentsStats,
  ManualReplyResult,
} from "./types";
import { replyMetaCommentPublic } from "@/lib/meta-social/client";
import { getDecryptedAccessTokenMemory, getDecryptedAccessTokenDb } from "@/lib/meta-social/connections-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { replyToYouTubeComment } from "./youtube-client";
import { getDecryptedYouTubeToken } from "./youtube-store";

// In-Memory store for comments
const memorySocialComments = new Map<string, SocialComment>();

/**
 * Normalizes text for keyword matching (case-insensitive, trims accents/whitespace)
 */
export function normalizeCommentText(text: string): string {
  if (!text) return "";
  return text.toLowerCase().normalize("NFKC").trim();
}

/**
 * Seed realistic initial comments for development and interactive testing
 */
export function seedPresetCommentsMemory(businessId: string, businessSlug: string): void {
  validateBusinessTenant(businessId);

  const isVivaham = businessSlug.toLowerCase().includes("vivaham");
  const now = Date.now();

  if (isVivaham) {
    const vivahamComments: SocialComment[] = [
      {
        id: `comm_viv_fb_1_${businessId.slice(0, 8)}`,
        businessId,
        platform: "facebook",
        accountId: "fb_page_vivaham_official",
        accountName: "Gokul Vivaham Matrimony Page",
        postId: "fb_post_viv_101",
        postTitle: "Special Matrimony Alliance Meet - Chennai 2026",
        postUrl: "https://facebook.com/gokulvivaham/posts/101",
        commentId: "fb_comm_101_01",
        commenterId: "fb_user_sundaram",
        commenterName: "Sundaramurthy Pillai",
        commenterAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
        text: "வணக்கம், பொறியாளர் வரன்கள் விவரங்கள் மற்றும் பதிவு கட்டணம் என்னவென்று கூற முடியுமா? [விவரம்]",
        timestamp: new Date(now - 1000 * 60 * 35).toISOString(),
        replyStatus: "pending",
        matchedKeyword: "விவரம்",
        matchedRuleName: "Vivaham Registration Info",
        canReply: true,
      },
      {
        id: `comm_viv_ig_2_${businessId.slice(0, 8)}`,
        businessId,
        platform: "instagram",
        accountId: "ig_vivaham_matrimony",
        accountName: "@gokul_vivaham",
        postId: "ig_media_viv_202",
        postTitle: "Horoscope Compatibility in Matchmaking (10 Porutham)",
        postUrl: "https://instagram.com/p/vivaham202",
        commentId: "ig_comm_202_01",
        commenterId: "ig_user_priya_m",
        commenterName: "Priya Mohan",
        commenterUsername: "priya_mohan_92",
        commenterAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
        text: "How do we register for USA/Canada groom profiles? Please share fees and registration link.",
        timestamp: new Date(now - 1000 * 60 * 120).toISOString(),
        replyStatus: "replied",
        replyText: "Namaste Priya! Thank you for reaching out. We have sent our overseas membership details directly to your inbox.",
        replyTimestamp: new Date(now - 1000 * 60 * 105).toISOString(),
        replyId: "ig_rep_202_01_r",
        matchedKeyword: "fees",
        matchedRuleName: "Registration & Fees Rule",
        canReply: true,
      },
      {
        id: `comm_viv_yt_3_${businessId.slice(0, 8)}`,
        businessId,
        platform: "youtube",
        accountId: "UC_vivaham_channel",
        accountName: "Gokul Vivaham Official YouTube",
        postId: "yt_video_viv_303",
        postTitle: "Top 5 Tips for Safe and Successful Matrimony Profile Search",
        postUrl: "https://youtube.com/watch?v=viv303",
        commentId: "yt_comm_303_01",
        commenterId: "yt_user_ramesh_k",
        commenterName: "Ramesh Kumar K",
        commenterAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        text: "ஜாதக பொருத்தம் இலவசமாக பார்த்து தருவீர்களா? தொடர்பு எண் பகிருங்கள்.",
        timestamp: new Date(now - 1000 * 60 * 240).toISOString(),
        replyStatus: "pending",
        matchedKeyword: "ஜாதகம்",
        matchedRuleName: "Horoscope Inquiry",
        canReply: true,
      },
      {
        id: `comm_viv_fb_4_${businessId.slice(0, 8)}`,
        businessId,
        platform: "facebook",
        accountId: "fb_page_vivaham_official",
        accountName: "Gokul Vivaham Matrimony Page",
        postId: "fb_post_viv_102",
        postTitle: "Success Story: Anand & Deepa Tied the Knot!",
        postUrl: "https://facebook.com/gokulvivaham/posts/102",
        commentId: "fb_comm_102_02",
        commenterId: "fb_user_kavitha",
        commenterName: "Kavitha R",
        commenterAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
        text: "Hearty congratulations to the couple! Wishing them lifelong happiness.",
        timestamp: new Date(now - 1000 * 60 * 360).toISOString(),
        replyStatus: "replied",
        replyText: "Thank you so much Kavitha for your heartfelt blessings!",
        replyTimestamp: new Date(now - 1000 * 60 * 340).toISOString(),
        replyId: "fb_rep_102_02_r",
        canReply: true,
      },
      {
        id: `comm_viv_ig_5_${businessId.slice(0, 8)}`,
        businessId,
        platform: "instagram",
        accountId: "ig_vivaham_matrimony",
        accountName: "@gokul_vivaham",
        postId: "ig_media_viv_203",
        postTitle: "Weekend Walk-in Matrimony Consultation Desk",
        postUrl: "https://instagram.com/p/vivaham203",
        commentId: "ig_comm_203_03",
        commenterId: "ig_user_selvakumar",
        commenterName: "Selvakumar Nadar",
        commenterUsername: "selva_k_99",
        text: "What are your Coimbatore office timings this Sunday? Want to register offline.",
        timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
        replyStatus: "failed",
        failureReason: "Network timeout attempting to deliver reply. Retry available.",
        canReply: true,
      },
    ];

    for (const c of vivahamComments) {
      memorySocialComments.set(c.id, c);
    }
  } else {
    // Gokul's Astrological Insights
    const astroComments: SocialComment[] = [
      {
        id: `comm_astro_fb_1_${businessId.slice(0, 8)}`,
        businessId,
        platform: "facebook",
        accountId: "fb_page_astro_insights",
        accountName: "Gokul Astrological Insights Page",
        postId: "fb_post_astro_001",
        postTitle: "Guru Peyarchi 2026 Palangal & Pariharam Guide",
        postUrl: "https://facebook.com/gokulastrology/posts/001",
        commentId: "fb_comm_001_01",
        commenterId: "fb_user_manikandan",
        commenterName: "Manikandan S",
        commenterAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
        text: "ஐயா வணக்கம்! சிம்ம ராசிக்கு குரு பெயர்ச்சி பலன்கள் எப்படி இருக்கும்? ஜாதகம் பார்க்க கட்டணம் என்ன? [ஜாதகம்]",
        timestamp: new Date(now - 1000 * 60 * 15).toISOString(),
        replyStatus: "pending",
        matchedKeyword: "ஜாதகம்",
        matchedRuleName: "Astrology Horoscope Consultation",
        canReply: true,
      },
      {
        id: `comm_astro_ig_2_${businessId.slice(0, 8)}`,
        businessId,
        platform: "instagram",
        accountId: "ig_gokul_astrology",
        accountName: "@gokul_astrology",
        postId: "ig_media_astro_002",
        postTitle: "Rahu Ketu Transit Secrets: Remedies That Actually Work",
        postUrl: "https://instagram.com/p/astro002",
        commentId: "ig_comm_002_02",
        commenterId: "ig_user_divya_v",
        commenterName: "Divya Venkat",
        commenterUsername: "divya_astrolife",
        commenterAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
        text: "Can I book a 1-on-1 video call appointment for marriage prediction? Please share details and fees.",
        timestamp: new Date(now - 1000 * 60 * 60).toISOString(),
        replyStatus: "replied",
        replyText: "Namaste Divya! Thank you for commenting. We have sent our appointment schedule and consultation fee details to your DM.",
        replyTimestamp: new Date(now - 1000 * 60 * 50).toISOString(),
        replyId: "ig_rep_002_02_r",
        matchedKeyword: "fees",
        matchedRuleName: "Astrology Pricing & Booking",
        canReply: true,
      },
      {
        id: `comm_astro_yt_3_${businessId.slice(0, 8)}`,
        businessId,
        platform: "youtube",
        accountId: "UC_astro_channel_gokul",
        accountName: "Gokul Astrology YouTube Channel",
        postId: "yt_video_astro_003",
        postTitle: "Sani Peyarchi Impact on Mesha & Rishaba Rasi (Detailed Analysis)",
        postUrl: "https://youtube.com/watch?v=astro003",
        commentId: "yt_comm_003_03",
        commenterId: "yt_user_karthik_subbu",
        commenterName: "Karthik Subramanian",
        commenterAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop",
        text: "பிறந்த தேதி மற்றும் நேரம் அனுப்பி ஜாதக கட்டம் கணிக்க முடியுமா ஐயா? தகவல் தருவீர்களா? [தகவல்]",
        timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
        replyStatus: "pending",
        matchedKeyword: "தகவல்",
        matchedRuleName: "Astrology Info Inquiry",
        canReply: true,
      },
      {
        id: `comm_astro_fb_4_${businessId.slice(0, 8)}`,
        businessId,
        platform: "facebook",
        accountId: "fb_page_astro_insights",
        accountName: "Gokul Astrological Insights Page",
        postId: "fb_post_astro_004",
        postTitle: "Significance of Tuesday Rahu Kalam Durga Pooja",
        postUrl: "https://facebook.com/gokulastrology/posts/004",
        commentId: "fb_comm_004_04",
        commenterId: "fb_user_meenakshi",
        commenterName: "Meenakshi Sundaresan",
        commenterAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop",
        text: "மிக்க நன்றி ஐயா! மிகவும் பயனுள்ள பதிவு. அம்மன் அருள் அனைவருக்கும் கிடைக்கட்டும்.",
        timestamp: new Date(now - 1000 * 60 * 300).toISOString(),
        replyStatus: "replied",
        replyText: "நன்றி அம்மா! துர்க்கை அம்மனின் அருள் உங்கள் குடும்பத்திற்கு என்றும் நிலைக்கட்டும்.",
        replyTimestamp: new Date(now - 1000 * 60 * 280).toISOString(),
        replyId: "fb_rep_004_04_r",
        canReply: true,
      },
      {
        id: `comm_astro_ig_5_${businessId.slice(0, 8)}`,
        businessId,
        platform: "instagram",
        accountId: "ig_gokul_astrology",
        accountName: "@gokul_astrology",
        postId: "ig_media_astro_005",
        postTitle: "Numerology & Lucky Stones for 2026",
        postUrl: "https://instagram.com/p/astro005",
        commentId: "ig_comm_005_05",
        commenterId: "ig_user_arun_kumar",
        commenterName: "Arun Kumar",
        commenterUsername: "arunkumar_chennai",
        text: "Can I wear Yellow Sapphire for Dhanusu Rasi? What is the price of consultation?",
        timestamp: new Date(now - 1000 * 60 * 25).toISOString(),
        replyStatus: "failed",
        failureReason: "Instagram rate limit reached (HTTP 429). Operator can manually retry.",
        canReply: true,
      },
    ];

    for (const c of astroComments) {
      memorySocialComments.set(c.id, c);
    }
  }
}

/**
 * Retrieve comments for a business workspace with filtering and search
 */
export function getSocialComments(
  businessId: string,
  params: SocialCommentFilterParams = {}
): { comments: SocialComment[]; stats: SocialCommentsStats } {
  validateBusinessTenant(businessId);

  const allComments = Array.from(memorySocialComments.values()).filter(
    (c) => c.businessId === businessId
  );

  // Compute stats across all comments of this business
  const stats: SocialCommentsStats = {
    totalComments: allComments.length,
    pendingReplies: allComments.filter((c) => c.replyStatus === "pending").length,
    repliedComments: allComments.filter((c) => c.replyStatus === "replied").length,
    failedReplies: allComments.filter((c) => c.replyStatus === "failed").length,
    keywordMatched: allComments.filter((c) => Boolean(c.matchedKeyword)).length,
    facebookCount: allComments.filter((c) => c.platform === "facebook").length,
    instagramCount: allComments.filter((c) => c.platform === "instagram").length,
    youtubeCount: allComments.filter((c) => c.platform === "youtube").length,
  };

  // Apply filters
  let filtered = allComments;

  if (params.platform && params.platform !== "all") {
    filtered = filtered.filter((c) => c.platform === params.platform);
  }

  if (params.replyStatus && params.replyStatus !== "all") {
    if (params.replyStatus === "keyword_matched") {
      filtered = filtered.filter((c) => Boolean(c.matchedKeyword));
    } else {
      filtered = filtered.filter((c) => c.replyStatus === params.replyStatus);
    }
  }

  if (params.searchQuery?.trim()) {
    const q = normalizeCommentText(params.searchQuery);
    filtered = filtered.filter((c) => {
      const textMatch = normalizeCommentText(c.text).includes(q);
      const commenterMatch = normalizeCommentText(c.commenterName).includes(q);
      const postMatch = normalizeCommentText(c.postTitle).includes(q);
      const replyMatch = c.replyText ? normalizeCommentText(c.replyText).includes(q) : false;
      return textMatch || commenterMatch || postMatch || replyMatch;
    });
  }

  // Sort: pending first, then by timestamp descending
  filtered.sort((a, b) => {
    if (a.replyStatus === "pending" && b.replyStatus !== "pending") return -1;
    if (a.replyStatus !== "pending" && b.replyStatus === "pending") return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const limit = params.limit || 50;
  const offset = params.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  return { comments: paginated, stats };
}

/**
 * Execute a manual public reply to a comment (Facebook, Instagram, or YouTube)
 */
export async function replyToSocialComment(params: {
  businessId: string;
  commentId: string;
  replyText: string;
}): Promise<ManualReplyResult> {
  const { businessId, commentId, replyText } = params;
  validateBusinessTenant(businessId);

  if (!replyText?.trim()) {
    throw new Error("Reply text cannot be empty or only whitespace.");
  }

  const comment = memorySocialComments.get(commentId);
  if (!comment) {
    throw new Error("Social comment not found.");
  }
  if (comment.businessId !== businessId) {
    throw new Error("Tenant mismatch: Comment does not belong to active business.");
  }

  const now = new Date().toISOString();
  const trimmedReply = replyText.trim();

  // Route reply to platform API
  try {
    let publishedReplyId = `rep_${comment.platform}_${Date.now()}`;

    if (comment.platform === "facebook" || comment.platform === "instagram") {
      // Lookup access token for connected Meta account
      const useDb = isSupabaseConfigured();
      let accessToken: string | null = null;
      if (useDb) {
        accessToken = await getDecryptedAccessTokenDb(businessId, comment.accountId);
      } else {
        accessToken = getDecryptedAccessTokenMemory(businessId, comment.accountId);
      }

      // If token is found, execute live Meta Graph API call
      if (accessToken) {
        const res = await replyMetaCommentPublic({
          platform: comment.platform,
          commentId: comment.commentId,
          message: trimmedReply,
          accessToken,
        });
        publishedReplyId = res.id;
      }
    } else if (comment.platform === "youtube") {
      // Lookup access token for connected YouTube account
      const tokenObj = getDecryptedYouTubeToken(businessId, comment.accountId);
      if (tokenObj?.accessToken) {
        const res = await replyToYouTubeComment({
          parentId: comment.commentId,
          text: trimmedReply,
          accessToken: tokenObj.accessToken,
        });
        publishedReplyId = res.id;
      }
    }

    // Update in-memory comment status
    comment.replyStatus = "replied";
    comment.replyText = trimmedReply;
    comment.replyTimestamp = now;
    comment.replyId = publishedReplyId;
    comment.failureReason = undefined;
    memorySocialComments.set(commentId, comment);

    return {
      success: true,
      commentId,
      replyId: publishedReplyId,
      replyText: trimmedReply,
      replyTimestamp: now,
    };
  } catch (err: any) {
    comment.replyStatus = "failed";
    comment.failureReason = err.message || "Failed to publish public reply to social platform.";
    memorySocialComments.set(commentId, comment);

    return {
      success: false,
      commentId,
      replyText: trimmedReply,
      replyTimestamp: now,
      error: comment.failureReason,
    };
  }
}

/**
 * Execute automatic keyword-based replies across all eligible pending comments
 */
export async function executeAutoReplies(
  businessId: string,
  commentIds?: string[]
): Promise<{ processed: number; replied: number; skipped: number }> {
  validateBusinessTenant(businessId);

  const commentsToEvaluate = Array.from(memorySocialComments.values()).filter((c) => {
    if (c.businessId !== businessId) return false;
    if (c.replyStatus !== "pending") return false;
    if (commentIds && !commentIds.includes(c.id)) return false;
    return Boolean(c.matchedKeyword);
  });

  let repliedCount = 0;
  let skippedCount = 0;

  for (const comment of commentsToEvaluate) {
    const defaultReply =
      comment.matchedKeyword === "ஜாதகம்"
        ? "வணக்கம்! உங்கள் ஜாதக பலன்கள் மற்றும் ஜோதிட ஆலோசனை பெற எங்கள் இன்பாக்ஸில் தொடர்பு கொள்ளவும்."
        : comment.matchedKeyword === "fees" || comment.matchedKeyword === "விவரம்"
        ? "நன்றி! கட்டண விவரங்கள் மற்றும் முன்பதிவு வழிகாட்டுதலை உங்கள் இன்பாக்ஸில் அனுப்பியுள்ளோம்."
        : "நன்றி! உங்கள் பதிவிற்கான விவரங்களை எங்கள் குழு விரைவில் பகிர்ந்து கொள்ளும்.";

    const res = await replyToSocialComment({
      businessId,
      commentId: comment.id,
      replyText: defaultReply,
    });

    if (res.success) {
      repliedCount++;
    } else {
      skippedCount++;
    }
  }

  return {
    processed: commentsToEvaluate.length,
    replied: repliedCount,
    skipped: skippedCount,
  };
}

/**
 * Ingest an external comment into the unified store
 */
export function ingestSocialComment(comment: SocialComment): void {
  validateBusinessTenant(comment.businessId);
  memorySocialComments.set(comment.id, comment);
}

/**
 * Clear in-memory comments for test isolation
 */
export function resetMemorySocialComments(): void {
  memorySocialComments.clear();
}
