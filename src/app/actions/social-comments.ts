"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getSocialComments,
  replyToSocialComment,
  executeAutoReplies,
  seedPresetCommentsMemory,
} from "@/lib/social-comments/comments-store";
import {
  SocialComment,
  SocialCommentFilterParams,
  SocialCommentsStats,
  SocialReplyTemplate,
  YouTubeChannelConnection,
} from "@/lib/social-comments/types";
import { getReplyTemplatesForBusiness } from "@/lib/social-comments/templates";
import {
  getYouTubeConnections,
  disconnectYouTubeConnection,
} from "@/lib/social-comments/youtube-store";
import {
  createYouTubeOAuthState,
  getYouTubeOAuthAuthorizationUrl,
} from "@/lib/social-comments/youtube-oauth";

/**
 * 1. Fetch unified comments with filters and statistics
 */
export async function getSocialCommentsAction(
  businessSlug: string,
  params: SocialCommentFilterParams = {}
): Promise<{
  success: boolean;
  comments?: SocialComment[];
  stats?: SocialCommentsStats;
  templates?: SocialReplyTemplate[];
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);

    // Initial check: if no comments exist yet, seed preset comments for interactive preview
    let { comments, stats } = getSocialComments(business.id, params);
    if (stats.totalComments === 0) {
      seedPresetCommentsMemory(business.id, business.slug);
      const res = getSocialComments(business.id, params);
      comments = res.comments;
      stats = res.stats;
    }

    const templates = getReplyTemplatesForBusiness(business.slug);

    return {
      success: true,
      comments,
      stats,
      templates,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load social comments.",
    };
  }
}

/**
 * 2. Send manual public reply to a comment
 */
export async function replyToSocialCommentAction(
  businessSlug: string,
  params: {
    commentId: string;
    replyText: string;
  }
): Promise<{ success: boolean; commentId?: string; replyId?: string; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin" && membership.role !== "agent") {
      throw new Error("You do not have permission to reply to social comments.");
    }

    const res = await replyToSocialComment({
      businessId: business.id,
      commentId: params.commentId,
      replyText: params.replyText,
    });

    if (!res.success) {
      return { success: false, error: res.error || "Failed to post reply." };
    }

    revalidatePath(`/workspace/${businessSlug}/comments`);
    return {
      success: true,
      commentId: res.commentId,
      replyId: res.replyId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to submit comment reply.",
    };
  }
}

/**
 * 3. Batch execute auto-replies on keyword-matched pending comments
 */
export async function executeAutoRepliesAction(
  businessSlug: string,
  commentIds?: string[]
): Promise<{ success: boolean; processed?: number; replied?: number; skipped?: number; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only owners and administrators can trigger bulk automatic replies.");
    }

    const result = await executeAutoReplies(business.id, commentIds);
    revalidatePath(`/workspace/${businessSlug}/comments`);

    return {
      success: true,
      processed: result.processed,
      replied: result.replied,
      skipped: result.skipped,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to execute auto-replies.",
    };
  }
}

/**
 * 4. Fetch reply templates for business
 */
export async function getReplyTemplatesAction(
  businessSlug: string,
  language?: "ta" | "en"
): Promise<{ success: boolean; templates?: SocialReplyTemplate[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const templates = getReplyTemplatesForBusiness(business.slug, language);
    return { success: true, templates };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load reply templates." };
  }
}

/**
 * 5. Fetch YouTube channel connection status
 */
export async function getYouTubeConnectionStatusAction(
  businessSlug: string
): Promise<{ success: boolean; connections?: YouTubeChannelConnection[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const connections = getYouTubeConnections(business.id);
    return { success: true, connections };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to check YouTube connection." };
  }
}

/**
 * 6. Initiate Google OAuth for YouTube channel connection
 */
export async function initiateYouTubeOAuthAction(
  businessSlug: string
): Promise<{ success: boolean; authorizationUrl?: string; error?: string }> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can connect YouTube channels.");
    }

    const { state, csrfCookie } = createYouTubeOAuthState({
      businessSlug: business.slug,
      businessId: business.id,
      userId: user.id,
    });

    // Store CSRF nonce in HTTP-only cookie (15 min TTL)
    try {
      const cookieStore = await cookies();
      cookieStore.set("youtube_oauth_csrf", csrfCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      });
    } catch {}

    const authorizationUrl = getYouTubeOAuthAuthorizationUrl({ state });

    return { success: true, authorizationUrl };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to initiate YouTube connection." };
  }
}

/**
 * 7. Disconnect YouTube channel
 */
export async function disconnectYouTubeAction(
  businessSlug: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can disconnect YouTube channels.");
    }

    disconnectYouTubeConnection(business.id, connectionId);
    revalidatePath(`/workspace/${businessSlug}/comments`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to disconnect YouTube channel." };
  }
}
