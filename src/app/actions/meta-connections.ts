"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createMetaOAuthState,
  getMetaOAuthAuthorizationUrl,
  SanitizedDiscoveredPage,
} from "@/lib/meta-social/oauth";
import {
  clearStagedDiscovery,
  getSanitizedStagedPages,
  getStagedDiscoveredSession,
} from "@/lib/meta-social/discovery-cache";
import {
  disconnectSocialAccountDb,
  disconnectSocialAccountMemory,
  getSocialConnectionsDb,
  getSocialConnectionsMemory,
  SafeMetaSocialConnection,
  saveSocialConnectionDb,
  saveSocialConnectionMemory,
  verifySocialConnectionTokenDb,
  verifySocialConnectionTokenMemory,
  VerifyConnectionResult,
} from "@/lib/meta-social/connections-store";

/**
 * Initiate Meta OAuth Connection: Generates signed state and CSRF cookie.
 */
export async function initiateMetaOAuthAction(
  businessSlug: string
): Promise<{ success: boolean; authorizationUrl?: string; error?: string }> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can connect social accounts.");
    }

    const { state, csrfCookie } = createMetaOAuthState({
      businessSlug: business.slug,
      businessId: business.id,
      userId: user.id,
    });

    // Store CSRF nonce in HTTP-only cookie (15 minute TTL)
    try {
      const cookieStore = await cookies();
      cookieStore.set("meta_oauth_csrf", csrfCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes
        path: "/",
      });
    } catch {
      // In unit test or headless context where Next.js cookies() is unavailable
    }

    const authorizationUrl = getMetaOAuthAuthorizationUrl({ state });

    return {
      success: true,
      authorizationUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to initiate Meta OAuth authorization.",
    };
  }
}

/**
 * Fetch sanitized discovered pages from server-staged session (Zero tokens exposed!)
 */
export async function getDiscoveredPagesAction(
  businessSlug: string,
  sessionId: string
): Promise<{ success: boolean; data?: SanitizedDiscoveredPage[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);

    if (!sessionId?.trim()) {
      throw new Error("Discovery session ID is required.");
    }

    const staged = getSanitizedStagedPages(sessionId.trim());
    if (!staged) {
      throw new Error("Discovery session has expired or is invalid. Please reconnect.");
    }

    if (staged.businessId !== business.id) {
      throw new Error("Tenant mismatch: Discovery session does not belong to active business.");
    }

    return {
      success: true,
      data: staged.pages,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load discovered pages.",
    };
  }
}

/**
 * Connect selected Facebook Page and/or linked Instagram Professional Account.
 * Supports independent connection of Facebook, Instagram, or both.
 * Access tokens are encrypted with AES-256-GCM before database/vault storage.
 */
export async function connectDiscoveredAccountAction(
  businessSlug: string,
  params: {
    sessionId: string;
    pageId: string;
    connectFacebook: boolean;
    connectInstagram: boolean;
  }
): Promise<{
  success: boolean;
  connectedFacebook?: boolean;
  connectedInstagram?: boolean;
  error?: string;
}> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can connect social accounts.");
    }

    if (!params.connectFacebook && !params.connectInstagram) {
      throw new Error("Please select at least one account to connect (Facebook Page or Instagram).");
    }

    const session = getStagedDiscoveredSession(params.sessionId);
    if (!session) {
      throw new Error("Connection session has expired or is invalid. Please initiate connection again.");
    }

    if (session.businessId !== business.id) {
      throw new Error("Tenant mismatch: Session does not belong to this business.");
    }

    const targetPage = session.pages.find((p) => p.pageId === params.pageId);
    if (!targetPage) {
      throw new Error(`Facebook Page ${params.pageId} not found in authorized discovery session.`);
    }

    const useDb = isSupabaseConfigured();
    let fbSuccess = false;
    let igSuccess = false;

    // 1. Connect Facebook Page if requested
    if (params.connectFacebook) {
      const fbInput = {
        platform: "facebook" as const,
        accountId: targetPage.pageId,
        accountName: targetPage.pageName,
        pageId: targetPage.pageId,
        accessToken: targetPage.pageAccessToken,
        metadata: {
          category: targetPage.category || null,
          tasks: targetPage.tasks || [],
          has_linked_instagram: Boolean(targetPage.instagramAccount?.isEligible),
          linked_instagram_id: targetPage.instagramAccount?.id || null,
          linked_instagram_username: targetPage.instagramAccount?.username || null,
        },
      };

      if (useDb) {
        await saveSocialConnectionDb(business.id, fbInput);
      } else {
        saveSocialConnectionMemory(business.id, fbInput);
      }
      fbSuccess = true;
    }

    // 2. Connect Instagram Professional Account if requested
    if (params.connectInstagram) {
      const ig = targetPage.instagramAccount;
      if (!ig || !ig.isEligible || !ig.id) {
        throw new Error(
          ig?.ineligibilityReason ||
            "This Facebook Page has no eligible linked Instagram Professional Account."
        );
      }

      const igInput = {
        platform: "instagram" as const,
        accountId: ig.id,
        accountName: ig.name || ig.username || `Instagram ${ig.id}`,
        username: ig.username || null,
        pageId: targetPage.pageId, // Associated FB Page ID is strictly required for Meta Private Replies
        accessToken: targetPage.pageAccessToken, // Page Token manages linked Instagram in Graph API
        metadata: {
          linked_page_id: targetPage.pageId,
          linked_page_name: targetPage.pageName,
          profile_picture_url: ig.profilePictureUrl || null,
        },
      };

      if (useDb) {
        await saveSocialConnectionDb(business.id, igInput);
      } else {
        saveSocialConnectionMemory(business.id, igInput);
      }
      igSuccess = true;
    }

    // Invalidate discovery session after successful connection
    clearStagedDiscovery(params.sessionId);

    // Revalidate paths
    try {
      revalidatePath(`/workspace/${businessSlug}/connections`);
      revalidatePath(`/workspace/${businessSlug}/connections/social`);
      revalidatePath(`/workspace/${businessSlug}/dashboard`);
    } catch {
      // Non-fatal outside request context
    }

    return {
      success: true,
      connectedFacebook: fbSuccess,
      connectedInstagram: igSuccess,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to connect chosen account.",
    };
  }
}

/**
 * Disconnect a social connection (Facebook or Instagram)
 */
export async function disconnectSocialConnectionAction(
  businessSlug: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can disconnect social accounts.");
    }

    const useDb = isSupabaseConfigured();
    if (useDb) {
      await disconnectSocialAccountDb(business.id, connectionId);
    } else {
      disconnectSocialAccountMemory(business.id, connectionId);
    }

    try {
      revalidatePath(`/workspace/${businessSlug}/connections`);
      revalidatePath(`/workspace/${businessSlug}/connections/social`);
      revalidatePath(`/workspace/${businessSlug}/dashboard`);
    } catch {
      // Non-fatal outside request context
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to disconnect account.",
    };
  }
}

/**
 * Verify token validity and permissions with Meta Graph API
 */
export async function verifySocialConnectionAction(
  businessSlug: string,
  connectionId: string
): Promise<{ success: boolean; result?: VerifyConnectionResult; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);

    const useDb = isSupabaseConfigured();
    const result = useDb
      ? await verifySocialConnectionTokenDb(business.id, connectionId)
      : await verifySocialConnectionTokenMemory(business.id, connectionId);

    try {
      revalidatePath(`/workspace/${businessSlug}/connections`);
      revalidatePath(`/workspace/${businessSlug}/connections/social`);
    } catch {
      // Non-fatal outside request context
    }

    return { success: true, result };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to verify connection token.",
    };
  }
}

/**
 * Get all Facebook and Instagram connections for a business workspace
 */
export async function getSocialConnectionsAction(
  businessSlug: string
): Promise<{ success: boolean; data?: SafeMetaSocialConnection[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);

    const useDb = isSupabaseConfigured();
    const connections = useDb
      ? await getSocialConnectionsDb(business.id)
      : getSocialConnectionsMemory(business.id);

    return { success: true, data: connections };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load social connections.",
    };
  }
}
