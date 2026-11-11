"use server";

import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  AutomationRule,
  RuleCondition,
  RuleAction,
  AutomationExecutionLog,
  BusinessHoursConfig,
  AutomationSettingsConfig,
} from "@/types/database";
import {
  getRulesForBusiness,
  saveAutomationRule,
  toggleRuleActiveStatus,
  deleteAutomationRule,
  getExecutionLogsForBusiness,
  simulateRuleExecution,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_AUTOMATION_SETTINGS,
} from "@/lib/automation/store";
import { processQueueBatch, ProcessQueueResult } from "@/lib/automation/worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitSensitiveAction } from "@/lib/rate-limit/rate-limiter";
import { revalidatePath } from "next/cache";

/**
 * Fetch automation rules for a business workspace.
 * Server-side validated: Rejects if user is not authorized for this business.
 */
export async function getAutomationRulesAction(
  businessSlug: string
): Promise<{ success: boolean; data?: AutomationRule[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const rules = await getRulesForBusiness(business.id);
    return { success: true, data: rules };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load automation rules" };
  }
}

/**
 * Save (create or update) an automation rule with conditions and actions.
 * Server-side validated: Role enforcement (owner or admin only).
 */
export async function saveAutomationRuleAction(
  businessSlug: string,
  ruleData: Partial<AutomationRule>,
  conditions: Partial<RuleCondition>[],
  actions: Partial<RuleAction>[]
): Promise<{ success: boolean; data?: AutomationRule; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "Only workspace owners and administrators can configure automation rules." };
    }

    const result = await saveAutomationRule(business.id, ruleData, conditions, actions);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath(`/workspace/${businessSlug}/automations`);
    return { success: true, data: result.rule };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save rule" };
  }
}

/**
 * Toggle a rule's active state.
 */
export async function toggleRuleActiveAction(
  businessSlug: string,
  ruleId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "Only workspace owners and administrators can toggle rules." };
    }

    const result = await toggleRuleActiveStatus(business.id, ruleId, isActive);
    revalidatePath(`/workspace/${businessSlug}/automations`);
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle rule state" };
  }
}

/**
 * Delete an automation rule.
 */
export async function deleteAutomationRuleAction(
  businessSlug: string,
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "Only workspace owners and administrators can delete rules." };
    }

    const result = await deleteAutomationRule(business.id, ruleId);
    revalidatePath(`/workspace/${businessSlug}/automations`);
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete rule" };
  }
}

/**
 * Fetch automation execution audit logs for a business.
 */
export async function getExecutionLogsAction(
  businessSlug: string,
  limit: number = 50
): Promise<{ success: boolean; data?: AutomationExecutionLog[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const logs = await getExecutionLogsForBusiness(business.id, limit);
    return { success: true, data: logs };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load execution logs" };
  }
}

/**
 * Fetch workspace business hours and automation configuration.
 */
export async function getWorkspaceAutomationConfigAction(
  businessSlug: string
): Promise<{
  success: boolean;
  businessHours?: BusinessHoursConfig;
  automationSettings?: AutomationSettingsConfig;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    let businessHours = DEFAULT_BUSINESS_HOURS;
    let automationSettings = DEFAULT_AUTOMATION_SETTINGS;

    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("business_settings")
        .select("business_hours, automation_settings")
        .eq("business_id", business.id)
        .single();

      if (!error && data) {
        if (data.business_hours) businessHours = data.business_hours;
        if (data.automation_settings) automationSettings = data.automation_settings;
      }
    } catch {
      // In-memory defaults
    }

    return { success: true, businessHours, automationSettings };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load automation configuration" };
  }
}

/**
 * Update business hours configuration for a workspace.
 */
export async function updateBusinessHoursAction(
  businessSlug: string,
  config: BusinessHoursConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "Only workspace owners and administrators can configure operating hours." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("business_settings")
      .update({
        business_hours: config,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (error) throw new Error(error.message);

    revalidatePath(`/workspace/${businessSlug}/automations`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update business hours" };
  }
}

/**
 * Update automation settings (e.g. enable/pause live automation, keywords, caps).
 */
export async function updateAutomationSettingsAction(
  businessSlug: string,
  config: AutomationSettingsConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "Only workspace owners and administrators can configure automation settings." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("business_settings")
      .update({
        automation_settings: config,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    if (error) throw new Error(error.message);

    revalidatePath(`/workspace/${businessSlug}/automations`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update automation settings" };
  }
}

/**
 * Dry-run simulator server action.
 */
export async function simulateRuleAction(
  businessSlug: string,
  messageText: string,
  options: {
    connectionId?: string;
    isFirstMessage?: boolean;
    isOptedOut?: boolean;
    conversationStatus?: "open" | "closed" | "pending_human";
    isAutomationPaused?: boolean;
  } = {}
) {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const rules = await getRulesForBusiness(business.id);
    const configRes = await getWorkspaceAutomationConfigAction(businessSlug);

    const simulation = simulateRuleExecution(business.id, messageText, {
      ...options,
      rules,
      businessHours: configRes.businessHours,
      automationSettings: configRes.automationSettings,
    });

    return { success: true, data: simulation };
  } catch (err: any) {
    return { success: false, error: err.message || "Simulation failed" };
  }
}

/**
 * Manually trigger a queue batch execution for an authorized business workspace.
 * Requires authenticated user session and owner or admin role within the verified business.
 */
export async function triggerQueueWorkerAction(
  businessSlug: string
): Promise<{ success: boolean; data?: ProcessQueueResult; error?: string }> {
  try {
    if (!businessSlug || typeof businessSlug !== "string" || !businessSlug.trim()) {
      return { success: false, error: "Unauthorized: Business slug is required." };
    }

    const { business, membership } = await validateBusinessAccess(businessSlug.trim());

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Only workspace owners and administrators can trigger background queue processing.",
      };
    }

    // Rate limit manual worker invocations (15 triggers / 60s per business)
    const rateLimit = rateLimitSensitiveAction(business.id, "trigger_queue_worker");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before triggering queue processing again.`,
      };
    }

    const result = await processQueueBatch(10, `manual_${business.id}_${Date.now()}`);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Queue worker run failed" };
  }
}
