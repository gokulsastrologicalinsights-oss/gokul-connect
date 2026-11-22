"use server";

import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { encryptSecret } from "@/lib/crypto/encryption";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type {
  MetaSocialConnection,
  MetaSocialRule,
  MetaSocialEvent,
  MetaSocialPlatform,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "@/lib/meta-social/types";

/**
 * Fetch all Facebook & Instagram connections for a business workspace
 */
export async function getSocialConnectionsAction(
  businessSlug: string
): Promise<{ success: boolean; data?: MetaSocialConnection[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("meta_social_connections")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load social connections" };
  }
}

/**
 * Save or connect a Facebook Page or Instagram Business Account
 */
export async function saveSocialConnectionAction(
  businessSlug: string,
  params: {
    platform: MetaSocialPlatform;
    accountId: string;
    accountName: string;
    username?: string;
    pageId?: string;
    accessToken: string;
    autoReplyDms?: boolean;
    autoReplyComments?: boolean;
    autoDmOnComment?: boolean;
    defaultCommentReply?: string;
    defaultDmReply?: string;
  }
): Promise<{ success: boolean; data?: MetaSocialConnection; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only owners and admins can configure social connections.");
    }

    if (!params.accountId?.trim()) throw new Error("Account ID is required.");
    if (!params.accountName?.trim()) throw new Error("Account Name is required.");
    if (!params.accessToken?.trim()) throw new Error("Access Token is required.");

    // Validate Instagram linked Facebook Page requirement
    if (params.platform === "instagram" && !params.pageId?.trim()) {
      throw new Error(
        "Connected Facebook Page ID (pageId) is strictly required for Instagram accounts to support Meta Private Replies."
      );
    }

    const supabase = createAdminClient();

    // 1. Encrypt Access Token using AES-256-GCM
    const encrypted = encryptSecret(params.accessToken.trim());
    const credentialRef = `sec_social_${business.id.slice(0, 8)}_${Date.now()}`;

    // 2. Upsert connection record with global (platform, account_id) conflict handling
    const { data: conn, error: connErr } = await supabase
      .from("meta_social_connections")
      .upsert(
        {
          business_id: business.id,
          platform: params.platform,
          account_id: params.accountId.trim(),
          account_name: params.accountName.trim(),
          username: params.username?.trim() || null,
          page_id: params.pageId?.trim() || null,
          credential_ref: credentialRef,
          connection_status: "connected",
          is_enabled: true,
          auto_reply_dms: params.autoReplyDms ?? true,
          auto_reply_comments: params.autoReplyComments ?? true,
          autoDmOnComment: params.autoDmOnComment ?? true,
          default_comment_reply:
            params.defaultCommentReply?.trim() ||
            "Thank you for your comment! We have sent details directly to your inbox.",
          default_dm_reply:
            params.defaultDmReply?.trim() ||
            "வணக்கம்! எங்கள் சேவைகள் மற்றும் ஆலோசனை விவரங்களை இங்கே பகிர்கிறோம்.",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "platform,account_id" }
      )
      .select("*")
      .single();

    if (connErr) throw connErr;

    // 3. Store encrypted token in meta_social_credentials
    await supabase.from("meta_social_credentials").upsert(
      {
        connection_id: conn.id,
        business_id: business.id,
        key_version: encrypted.key_version,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        ciphertext: encrypted.ciphertext,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id" }
    );

    revalidatePath(`/workspace/${businessSlug}/social`);
    return { success: true, data: conn };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save social connection" };
  }
}

/**
 * Delete a social connection
 */
export async function deleteSocialConnectionAction(
  businessSlug: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (membership.role !== "owner") {
      throw new Error("Only workspace owners can disconnect social channels.");
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("meta_social_connections")
      .delete()
      .eq("id", connectionId)
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath(`/workspace/${businessSlug}/social`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete connection" };
  }
}

/**
 * Fetch automation rules for Facebook & Instagram
 */
export async function getSocialRulesAction(
  businessSlug: string
): Promise<{ success: boolean; data?: MetaSocialRule[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("meta_social_rules")
      .select("*")
      .eq("business_id", business.id)
      .order("priority", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load social rules" };
  }
}

/**
 * Save or update a deterministic automation rule for DMs / Comments
 */
export async function saveSocialRuleAction(
  businessSlug: string,
  params: {
    id?: string;
    platform: MetaSocialRulePlatform;
    targetType: MetaSocialRuleTarget;
    ruleName: string;
    description?: string;
    keywords: string[];
    matchType: MetaSocialMatchType;
    responseAction: MetaSocialResponseAction;
    predefinedReply: string;
    predefinedDm?: string;
    priority?: number;
    isActive?: boolean;
  }
): Promise<{ success: boolean; data?: MetaSocialRule; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only owners and admins can configure social rules.");
    }

    if (!params.ruleName?.trim()) throw new Error("Rule name is required.");
    if (!params.predefinedReply?.trim()) throw new Error("Predefined reply message is required.");

    const supabase = createAdminClient();

    const payload = {
      business_id: business.id,
      platform: params.platform,
      target_type: params.targetType,
      rule_name: params.ruleName.trim(),
      description: params.description?.trim() || null,
      keywords: params.keywords,
      match_type: params.matchType,
      response_action: params.responseAction,
      predefined_reply: params.predefinedReply.trim(),
      predefined_dm: params.predefinedDm?.trim() || null,
      priority: params.priority ?? 100,
      is_active: params.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (params.id) {
      const { data, error } = await supabase
        .from("meta_social_rules")
        .update(payload)
        .eq("id", params.id)
        .eq("business_id", business.id)
        .select("*")
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("meta_social_rules")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      result = data;
    }

    revalidatePath(`/workspace/${businessSlug}/social`);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save social rule" };
  }
}

/**
 * Delete a social automation rule
 */
export async function deleteSocialRuleAction(
  businessSlug: string,
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only owners and admins can delete rules.");
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("meta_social_rules")
      .delete()
      .eq("id", ruleId)
      .eq("business_id", business.id);

    if (error) throw error;

    revalidatePath(`/workspace/${businessSlug}/social`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete rule" };
  }
}

/**
 * Fetch inbound social event audit trail
 */
export async function getSocialAuditEventsAction(
  businessSlug: string,
  limit: number = 50
): Promise<{ success: boolean; data?: MetaSocialEvent[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("meta_social_events")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load social events" };
  }
}
