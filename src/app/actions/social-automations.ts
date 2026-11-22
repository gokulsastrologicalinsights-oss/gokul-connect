"use server";

import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import type {
  MetaSocialConnection,
  MetaSocialRule,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "@/lib/meta-social/types";
import {
  getSocialConnectionsDb,
  getSocialConnectionsMemory,
  SafeMetaSocialConnection,
} from "@/lib/meta-social/connections-store";
import {
  getSocialRulesDb,
  getSocialRulesMemory,
  saveSocialRuleDb,
  saveSocialRuleMemory,
  toggleSocialRuleDb,
  toggleSocialRuleMemory,
  deleteSocialRuleDb,
  deleteSocialRuleMemory,
  getPresetTemplates,
  seedPresetSocialRulesMemory,
  SaveSocialRuleInput,
  MetaSocialReplyTemplate,
} from "@/lib/meta-social/rules-store";
import {
  getSocialLeadsDb,
  getSocialLeadsMemory,
  seedSampleLeadsMemory,
  SocialLeadFilters,
  MetaSocialLead,
} from "@/lib/meta-social/leads-store";
import { findMatchingSocialRule } from "@/lib/meta-social/evaluator";

export interface ConfigurationWarning {
  id: string;
  type: "warning" | "info" | "critical";
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

export interface SocialDashboardData {
  business: {
    id: string;
    slug: string;
    name: string;
    description?: string;
  };
  connections: SafeMetaSocialConnection[];
  rules: MetaSocialRule[];
  leads: MetaSocialLead[];
  totalLeadsCount: number;
  publicTemplates: MetaSocialReplyTemplate[];
  privateTemplates: MetaSocialReplyTemplate[];
  stats: {
    totalRules: number;
    activeRules: number;
    connectedChannels: number;
    commentsReceived: number;
    repliesDelivered: number;
    highIntentLeads: number;
    automationStatus: "active_dormant" | "live_active" | "no_connections";
  };
  warnings: ConfigurationWarning[];
}

/**
 * Fetch all Facebook & Instagram connections for a business workspace
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
    return { success: false, error: err.message || "Failed to load social connections" };
  }
}

/**
 * Fetch rules for Facebook & Instagram automation
 */
export async function getSocialRulesAction(
  businessSlug: string
): Promise<{ success: boolean; data?: MetaSocialRule[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const useDb = isSupabaseConfigured();
    let rules = useDb
      ? await getSocialRulesDb(business.id)
      : getSocialRulesMemory(business.id);

    // If memory store has no rules yet, seed preset rules for local preview
    if (!useDb && rules.length === 0) {
      rules = seedPresetSocialRulesMemory(business.id, business.slug);
    }

    return { success: true, data: rules };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load social rules" };
  }
}

/**
 * Save or update a deterministic automation rule
 */
export async function saveSocialRuleAction(
  businessSlug: string,
  params: SaveSocialRuleInput
): Promise<{ success: boolean; data?: MetaSocialRule; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can configure automation rules.");
    }

    if (!params.ruleName?.trim()) throw new Error("Rule name is required.");
    if (!params.predefinedReply?.trim()) throw new Error("Predefined reply message is required.");

    // Critical constraint: Never reuse public reply as private DM automatically
    if (
      params.responseAction === "both_public_and_private" &&
      params.predefinedDm &&
      params.predefinedDm.trim() === params.predefinedReply.trim()
    ) {
      throw new Error(
        "Public comment reply and Private DM must be configured separately. Reusing public replies for private DMs is prohibited."
      );
    }

    const useDb = isSupabaseConfigured();
    const saved = useDb
      ? await saveSocialRuleDb(business.id, params)
      : saveSocialRuleMemory(business.id, params);

    try {
      revalidatePath(`/workspace/${businessSlug}/social-automation`);
    } catch {}
    return { success: true, data: saved };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save social rule" };
  }
}

/**
 * Toggle rule enabled/disabled state
 */
export async function toggleSocialRuleAction(
  businessSlug: string,
  ruleId: string,
  isActive: boolean
): Promise<{ success: boolean; data?: MetaSocialRule; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can toggle rules.");
    }

    const useDb = isSupabaseConfigured();
    const updated = useDb
      ? await toggleSocialRuleDb(business.id, ruleId, isActive)
      : toggleSocialRuleMemory(business.id, ruleId, isActive);

    try {
      revalidatePath(`/workspace/${businessSlug}/social-automation`);
    } catch {}
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle rule" };
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
      throw new Error("Only workspace owners and administrators can delete rules.");
    }

    const useDb = isSupabaseConfigured();
    if (useDb) {
      await deleteSocialRuleDb(business.id, ruleId);
    } else {
      deleteSocialRuleMemory(business.id, ruleId);
    }

    try {
      revalidatePath(`/workspace/${businessSlug}/social-automation`);
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete rule" };
  }
}

/**
 * Fetch leads and comment activity with filtering
 */
export async function getSocialLeadsAction(
  businessSlug: string,
  filters: SocialLeadFilters = {}
): Promise<{ success: boolean; data?: MetaSocialLead[]; totalCount?: number; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const useDb = isSupabaseConfigured();

    let result = useDb
      ? await getSocialLeadsDb(business.id, filters)
      : getSocialLeadsMemory(business.id, filters);

    // If memory store has no leads yet, seed sample leads for local preview
    if (!useDb && result.totalCount === 0) {
      seedSampleLeadsMemory(business.id, business.slug);
      result = getSocialLeadsMemory(business.id, filters);
    }

    return {
      success: true,
      data: result.leads,
      totalCount: result.totalCount,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load social leads" };
  }
}

/**
 * Dry-run simulator to test keyword matching without live replies
 */
export async function simulateSocialRuleAction(
  businessSlug: string,
  params: {
    text: string;
    platform: "facebook" | "instagram";
    eventType: "comment" | "message";
  }
): Promise<{
  success: boolean;
  matched: boolean;
  rule?: MetaSocialRule;
  publicReplyPreview?: string;
  privateDmPreview?: string;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const useDb = isSupabaseConfigured();

    let rules = useDb
      ? await getSocialRulesDb(business.id)
      : getSocialRulesMemory(business.id);

    if (!useDb && rules.length === 0) {
      rules = seedPresetSocialRulesMemory(business.id, business.slug);
    }

    const matchedRule = findMatchingSocialRule(
      rules,
      params.text,
      params.platform,
      params.eventType
    );

    if (!matchedRule) {
      return {
        success: true,
        matched: false,
      };
    }

    let publicReply: string | undefined = undefined;
    let privateDm: string | undefined = undefined;

    if (
      matchedRule.response_action === "reply_comment_public" ||
      matchedRule.response_action === "both_public_and_private"
    ) {
      publicReply = matchedRule.predefined_reply;
    }

    if (
      matchedRule.response_action === "reply_comment_private_dm" ||
      matchedRule.response_action === "reply_dm"
    ) {
      privateDm = matchedRule.predefined_reply;
    } else if (matchedRule.response_action === "both_public_and_private") {
      privateDm = matchedRule.predefined_dm || undefined;
    }

    return {
      success: true,
      matched: true,
      rule: matchedRule,
      publicReplyPreview: publicReply,
      privateDmPreview: privateDm,
    };
  } catch (err: any) {
    return { success: false, matched: false, error: err.message || "Simulation error" };
  }
}

/**
 * Fetch full dashboard aggregated data
 */
export async function getSocialDashboardDataAction(
  businessSlug: string
): Promise<{ success: boolean; data?: SocialDashboardData; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const useDb = isSupabaseConfigured();

    // 1. Connections
    let connections = useDb
      ? await getSocialConnectionsDb(business.id)
      : getSocialConnectionsMemory(business.id);

    // 2. Rules
    let rules = useDb
      ? await getSocialRulesDb(business.id)
      : getSocialRulesMemory(business.id);

    if (!useDb && rules.length === 0) {
      rules = seedPresetSocialRulesMemory(business.id, business.slug);
    }

    // 3. Leads & Recent Events
    let leadsResult = useDb
      ? await getSocialLeadsDb(business.id, { limit: 10 })
      : getSocialLeadsMemory(business.id, { limit: 10 });

    if (!useDb && leadsResult.totalCount === 0) {
      seedSampleLeadsMemory(business.id, business.slug);
      leadsResult = getSocialLeadsMemory(business.id, { limit: 10 });
    }

    // 4. Preset Templates
    const { publicTemplates, privateTemplates } = getPresetTemplates(business.slug);

    // 5. Compute Warnings
    const warnings: ConfigurationWarning[] = [];

    const fbConn = connections.find((c) => c.platform === "facebook" && c.connection_status === "connected");
    const igConn = connections.find((c) => c.platform === "instagram" && c.connection_status === "connected");

    if (!fbConn && !igConn) {
      warnings.push({
        id: "warn_no_channels",
        type: "warning",
        title: "No Meta Channels Connected",
        message:
          "Connect a Facebook Page or Instagram Business account to begin automated keyword listening.",
        actionHref: `/workspace/${businessSlug}/connections/social`,
        actionLabel: "Connect Channels",
      });
    }

    if (igConn && !igConn.page_id && !fbConn) {
      warnings.push({
        id: "warn_ig_no_page",
        type: "critical",
        title: "Instagram Missing Linked Facebook Page",
        message:
          "Meta Private Replies strictly require an associated Facebook Page token. Connect your linked Facebook Page.",
        actionHref: `/workspace/${businessSlug}/connections/social`,
        actionLabel: "Review Connections",
      });
    }

    const activeRulesCount = rules.filter((r) => r.is_active).length;
    if (rules.length > 0 && activeRulesCount === 0) {
      warnings.push({
        id: "warn_all_rules_inactive",
        type: "warning",
        title: "All Rules Inactive",
        message: "You have configured rules, but none are currently enabled. Inbound comments will be ignored.",
      });
    } else if (rules.length === 0) {
      warnings.push({
        id: "warn_zero_rules",
        type: "info",
        title: "No Keyword Rules Configured",
        message:
          "Create your first Tamil or English keyword rule or activate a preset template below to automate replies.",
      });
    }

    // Phase 13D Dormant notice
    warnings.push({
      id: "info_phase13d_mode",
      type: "info",
      title: "Phase 13D Safe Mode (Dry Run Only)",
      message:
        "Deterministic rules and keyword engine are active in inspection mode. Real outbound Meta write operations remain dormant until production migration approval.",
    });

    const activeChannels = connections.filter((c) => c.connection_status === "connected" && c.is_enabled).length;
    const commentsReceived = leadsResult.totalCount;
    const repliesDelivered = leadsResult.leads.filter((l) => l.processing_status === "replied").length;
    const highIntentLeads = leadsResult.leads.filter((l) => l.lead_status === "high_intent").length;

    const data: SocialDashboardData = {
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        description: business.description || undefined,
      },
      connections,
      rules,
      leads: leadsResult.leads,
      totalLeadsCount: leadsResult.totalCount,
      publicTemplates,
      privateTemplates,
      stats: {
        totalRules: rules.length,
        activeRules: activeRulesCount,
        connectedChannels: activeChannels,
        commentsReceived,
        repliesDelivered,
        highIntentLeads,
        automationStatus: activeChannels > 0 ? "active_dormant" : "no_connections",
      },
      warnings,
    };

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load dashboard data" };
  }
}
