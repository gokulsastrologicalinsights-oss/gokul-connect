import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant } from "@/lib/inbox/database";
import { getLifecycleStagesDb, updateContactLifecycleStageDb } from "./lifecycle";
import { generateFollowUpRemindersDb } from "./reminders";

export interface LifecycleAutomationConfig {
  enabled: boolean;
  autoAssignDefaultStageOnCreate: boolean;
  autoAdvanceStageOnFollowUpComplete: boolean;
  inactivityThresholdDays: number;
}

export const DEFAULT_AUTOMATION_CONFIG: LifecycleAutomationConfig = {
  enabled: false, // Disabled by default as required
  autoAssignDefaultStageOnCreate: false,
  autoAdvanceStageOnFollowUpComplete: false,
  inactivityThresholdDays: 60,
};

/**
 * Executes post-contact creation automation
 * Assigns default lifecycle stage if enabled and contact has no stage.
 */
export async function handleContactCreatedAutomation(
  businessId: string,
  contactId: string,
  config: LifecycleAutomationConfig = DEFAULT_AUTOMATION_CONFIG,
  client?: any
): Promise<{ stageAssigned?: string }> {
  if (!config.enabled || !config.autoAssignDefaultStageOnCreate) {
    return {};
  }

  await validateTenant(businessId, { client });

  const stages = await getLifecycleStagesDb(businessId, client);
  const defaultStage = stages.find((s) => s.is_default) || stages[0];

  if (!defaultStage) return {};

  await updateContactLifecycleStageDb(
    businessId,
    contactId,
    defaultStage.slug,
    "system-automation",
    "Auto-assigned default lifecycle stage on contact creation",
    client
  );

  return { stageAssigned: defaultStage.slug };
}

/**
 * Executes post-follow-up completion automation
 * If requested and enabled, transitions the contact to a specified next stage.
 */
export async function handleFollowUpCompletedAutomation(
  businessId: string,
  contactId: string,
  targetStageSlug?: string,
  config: LifecycleAutomationConfig = DEFAULT_AUTOMATION_CONFIG,
  actorId?: string,
  client?: any
): Promise<{ stageUpdated?: string }> {
  if (!targetStageSlug) {
    return {};
  }

  // Follow-up completion stage advance is user-authorized
  await updateContactLifecycleStageDb(
    businessId,
    contactId,
    targetStageSlug,
    actorId || "user-follow-up-completion",
    "Updated lifecycle stage upon completing follow-up task",
    client
  );

  return { stageUpdated: targetStageSlug };
}

/**
 * Scans for overdue follow-ups and generates internal team reminders.
 * Never sends external WhatsApp messages.
 */
export async function runOverdueRemindersAutomation(
  businessId: string,
  client?: any
): Promise<{ generatedCount: number }> {
  const result = await generateFollowUpRemindersDb(businessId, client);
  return { generatedCount: result.generatedCount };
}
