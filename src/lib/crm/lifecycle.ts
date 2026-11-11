import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant, ASTRO_BUSINESS_ID, VIVAHAM_BUSINESS_ID } from "@/lib/inbox/database";
import {
  CrmLifecycleStage,
  ContactLifecycleHistory,
  WhatsAppContact,
} from "@/types/database";
import { ValidatedCreateLifecycleStage } from "@/lib/validation/schemas";
import { logContactActivityDb } from "./database";

/**
 * Default Lifecycle Stages for Gokul's Astrological Insights (astrology)
 */
export const DEFAULT_ASTRO_LIFECYCLE_STAGES: Array<Omit<CrmLifecycleStage, "id" | "business_id" | "created_at" | "updated_at">> = [
  { name: "New Lead", slug: "new-lead", color: "blue", sort_order: 1, is_default: true, is_converted: false, is_lost: false },
  { name: "Contacted", slug: "contacted", color: "sky", sort_order: 2, is_default: false, is_converted: false, is_lost: false },
  { name: "Horoscope Shared", slug: "horoscope-shared", color: "purple", sort_order: 3, is_default: false, is_converted: false, is_lost: false },
  { name: "Consultation Scheduled", slug: "consultation-scheduled", color: "amber", sort_order: 4, is_default: false, is_converted: false, is_lost: false },
  { name: "Follow-up Required", slug: "follow-up-required", color: "orange", sort_order: 5, is_default: false, is_converted: false, is_lost: false },
  { name: "Consultation Completed", slug: "consultation-completed", color: "emerald", sort_order: 6, is_default: false, is_converted: true, is_lost: false },
  { name: "Inactive", slug: "inactive", color: "slate", sort_order: 7, is_default: false, is_converted: false, is_lost: false },
  { name: "Lost", slug: "lost", color: "rose", sort_order: 8, is_default: false, is_converted: false, is_lost: true },
];

/**
 * Default Lifecycle Stages for Gokul Vivaham (vivaham)
 */
export const DEFAULT_VIVAHAM_LIFECYCLE_STAGES: Array<Omit<CrmLifecycleStage, "id" | "business_id" | "created_at" | "updated_at">> = [
  { name: "New Registration", slug: "new-registration", color: "blue", sort_order: 1, is_default: true, is_converted: false, is_lost: false },
  { name: "Profile Verified", slug: "profile-verified", color: "sky", sort_order: 2, is_default: false, is_converted: false, is_lost: false },
  { name: "Matchmaking Active", slug: "matchmaking-active", color: "indigo", sort_order: 3, is_default: false, is_converted: false, is_lost: false },
  { name: "Horoscope / Family Matching", slug: "family-matching", color: "purple", sort_order: 4, is_default: false, is_converted: false, is_lost: false },
  { name: "Follow-up Required", slug: "follow-up-required", color: "orange", sort_order: 5, is_default: false, is_converted: false, is_lost: false },
  { name: "Match Finalized", slug: "match-finalized", color: "emerald", sort_order: 6, is_default: false, is_converted: true, is_lost: false },
  { name: "Inactive", slug: "inactive", color: "slate", sort_order: 7, is_default: false, is_converted: false, is_lost: false },
  { name: "Lost", slug: "lost", color: "rose", sort_order: 8, is_default: false, is_converted: false, is_lost: true },
];

// In-memory fallback stores for testing & offline mode
const mockStagesStore = new Map<string, CrmLifecycleStage>();
const mockHistoryStore = new Map<string, ContactLifecycleHistory>();

export function resetMockLifecycleStore(): void {
  mockStagesStore.clear();
  mockHistoryStore.clear();
}

/**
 * Returns default stages seeded with synthetic UUIDs for mock/testing
 */
export function getDefaultLifecycleStages(businessId: string): CrmLifecycleStage[] {
  const isVivaham = businessId === VIVAHAM_BUSINESS_ID;
  const defaults = isVivaham ? DEFAULT_VIVAHAM_LIFECYCLE_STAGES : DEFAULT_ASTRO_LIFECYCLE_STAGES;
  const now = new Date().toISOString();

  return defaults.map((d, index) => ({
    id: `stage-${businessId.slice(0, 8)}-${index + 1}`,
    business_id: businessId,
    name: d.name,
    slug: d.slug,
    color: d.color,
    sort_order: d.sort_order,
    is_default: d.is_default,
    is_converted: d.is_converted,
    is_lost: d.is_lost,
    created_at: now,
    updated_at: now,
  }));
}

/**
 * Get all lifecycle stages for a business
 */
export async function getLifecycleStagesDb(
  businessId: string,
  client?: any
): Promise<CrmLifecycleStage[]> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_lifecycle_stages")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }

    // If table exists but empty, return defaults
    if (!error && (!data || data.length === 0)) {
      return getDefaultLifecycleStages(businessId);
    }
  }

  // Fallback to in-memory store
  const stages: CrmLifecycleStage[] = [];
  for (const stage of mockStagesStore.values()) {
    if (stage.business_id === businessId) {
      stages.push(stage);
    }
  }

  if (stages.length > 0) {
    return stages.sort((a, b) => a.sort_order - b.sort_order);
  }

  // Seed default stages in mock
  const defaultStages = getDefaultLifecycleStages(businessId);
  for (const s of defaultStages) {
    mockStagesStore.set(s.id, s);
  }
  return defaultStages;
}

/**
 * Create a new lifecycle stage for a business
 */
export async function createLifecycleStageDb(
  businessId: string,
  input: ValidatedCreateLifecycleStage,
  client?: any
): Promise<CrmLifecycleStage> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_lifecycle_stages")
      .insert({
        business_id: businessId,
        name: input.name,
        slug: input.slug,
        color: input.color,
        sort_order: input.sortOrder,
        is_default: input.isDefault,
        is_converted: input.isConverted,
        is_lost: input.isLost,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create lifecycle stage: ${error.message}`);
    }
    return data;
  }

  const id = `stage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const stage: CrmLifecycleStage = {
    id,
    business_id: businessId,
    name: input.name,
    slug: input.slug,
    color: input.color,
    sort_order: input.sortOrder,
    is_default: input.isDefault,
    is_converted: input.isConverted,
    is_lost: input.isLost,
    created_at: now,
    updated_at: now,
  };
  mockStagesStore.set(id, stage);
  return stage;
}

/**
 * Update a contact's lifecycle stage, recording history and activity log
 */
export async function updateContactLifecycleStageDb(
  businessId: string,
  contactId: string,
  stageSlug: string,
  changedBy?: string,
  reason?: string,
  client?: any
): Promise<{ success: boolean; contact: WhatsAppContact; history: ContactLifecycleHistory }> {
  await validateTenant(businessId, { client });

  // 1. Resolve target stage
  const stages = await getLifecycleStagesDb(businessId, client);
  const targetStage = stages.find((s) => s.slug === stageSlug);
  if (!targetStage) {
    throw new Error(`Lifecycle stage '${stageSlug}' does not exist for this business.`);
  }

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = new Date().toISOString();

  if (supabase) {
    // 2. Fetch contact to get current stage
    const { data: contact, error: fetchErr } = await supabase
      .from("wa_contacts")
      .select("*")
      .eq("id", contactId)
      .eq("business_id", businessId)
      .single();

    if (fetchErr || !contact) {
      throw new Error("Contact not found or does not belong to this business.");
    }

    const fromStageId = contact.lifecycle_stage_id || null;
    const fromStageSlug = contact.lifecycle_stage_slug || null;

    // 3. Update contact
    const { data: updatedContact, error: updateErr } = await supabase
      .from("wa_contacts")
      .update({
        lifecycle_stage_id: targetStage.id,
        lifecycle_stage_slug: targetStage.slug,
        updated_at: now,
      })
      .eq("id", contactId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update contact lifecycle stage: ${updateErr.message}`);
    }

    // 4. Insert into contact_lifecycle_history
    const { data: history, error: histErr } = await supabase
      .from("contact_lifecycle_history")
      .insert({
        business_id: businessId,
        contact_id: contactId,
        from_stage_id: fromStageId,
        from_stage_slug: fromStageSlug,
        to_stage_id: targetStage.id,
        to_stage_slug: targetStage.slug,
        changed_by: changedBy || null,
        change_reason: reason || null,
      })
      .select()
      .single();

    if (histErr) {
      // Non-fatal if history table trigger or permissions issue, but log
      console.warn("Failed to record lifecycle history:", histErr.message);
    }

    // 5. Log activity
    await logContactActivityDb(
      businessId,
      contactId,
      "lifecycle_stage_changed",
      "Lifecycle Stage Changed",
      `Lifecycle stage changed from ${fromStageSlug || "None"} to ${targetStage.name}${reason ? ` (${reason})` : ""}`,
      {
        from_stage: fromStageSlug,
        to_stage: targetStage.slug,
        changed_by: changedBy,
        reason,
      },
      client
    ).catch(() => {});

    return {
      success: true,
      contact: updatedContact,
      history: history || {
        id: `hist-${Date.now()}`,
        business_id: businessId,
        contact_id: contactId,
        from_stage_id: fromStageId,
        from_stage_slug: fromStageSlug,
        to_stage_id: targetStage.id,
        to_stage_slug: targetStage.slug,
        changed_by: changedBy || null,
        change_reason: reason || null,
        created_at: now,
      },
    };
  }

  // Mock implementation for testing/offline
  const contact = {
    id: contactId,
    business_id: businessId,
    phone_number: "919999999999",
    lifecycle_stage_id: targetStage.id,
    lifecycle_stage_slug: targetStage.slug,
    updated_at: now,
  } as WhatsAppContact;

  const history: ContactLifecycleHistory = {
    id: `hist-${Date.now()}`,
    business_id: businessId,
    contact_id: contactId,
    from_stage_id: null,
    from_stage_slug: null,
    from_stage: null,
    to_stage_id: targetStage.id,
    to_stage_slug: targetStage.slug,
    to_stage: targetStage.slug,
    changed_by: changedBy || null,
    changed_by_name: changedBy || "Staff",
    change_reason: reason || null,
    created_at: now,
  };

  mockHistoryStore.set(history.id, history);

  return { success: true, contact, history };
}

/**
 * Bulk update lifecycle stage for multiple contacts
 */
export async function bulkUpdateContactsLifecycleStageDb(
  businessId: string,
  contactIds: string[],
  stageSlug: string,
  changedBy?: string,
  reason?: string,
  client?: any
): Promise<{ success: boolean; updatedCount: number; errors: Array<{ contactId: string; error: string }> }> {
  await validateTenant(businessId, { client });

  const errors: Array<{ contactId: string; error: string }> = [];
  let updatedCount = 0;

  for (const contactId of contactIds) {
    try {
      await updateContactLifecycleStageDb(
        businessId,
        contactId,
        stageSlug,
        changedBy,
        reason,
        client
      );
      updatedCount++;
    } catch (err: any) {
      errors.push({ contactId, error: err.message || "Failed to update stage" });
    }
  }

  return {
    success: errors.length === 0,
    updatedCount,
    errors,
  };
}

/**
 * Get lifecycle history for a contact
 */
export async function getContactLifecycleHistoryDb(
  businessId: string,
  contactId: string,
  client?: any
): Promise<ContactLifecycleHistory[]> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("contact_lifecycle_history")
      .select("*")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data;
    }
  }

  const list: ContactLifecycleHistory[] = [];
  for (const h of mockHistoryStore.values()) {
    if (h.business_id === businessId && h.contact_id === contactId) {
      list.push(h);
    }
  }
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
