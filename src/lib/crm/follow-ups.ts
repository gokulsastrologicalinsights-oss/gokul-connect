import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant } from "@/lib/inbox/database";
import {
  CrmFollowUp,
  FollowUpFilterOptions,
  FollowUpMetrics,
  FollowUpPriority,
  FollowUpStatus,
} from "@/types/database";
import {
  ValidatedCreateFollowUp,
  CreateFollowUpInput,
  ValidatedUpdateFollowUp,
} from "@/lib/validation/schemas";
import { logContactActivityDb } from "./database";
import { createNotificationDb, formatKolkataTimestamp } from "@/lib/notifications/service";

// In-memory mock store for unit testing & offline development
const mockFollowUpsStore = new Map<string, CrmFollowUp>();

export function resetMockFollowUpsStore(): void {
  mockFollowUpsStore.clear();
}

export function getMockFollowUps(businessId?: string): CrmFollowUp[] {
  const all = Array.from(mockFollowUpsStore.values());
  if (businessId) {
    return all.filter((f) => f.business_id === businessId);
  }
  return all;
}

/**
 * Returns current timestamp in ISO format
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Checks if a given ISO timestamp falls on "today" in Asia/Kolkata timezone
 */
export function isTodayKolkata(dateIso: string): boolean {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const kolkataNowStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  return kolkataNowStr === dateStr;
}

/**
 * Checks if a given ISO timestamp is overdue (in the past relative to now)
 */
export function isOverdue(dateIso: string, status: FollowUpStatus): boolean {
  if (status === "completed" || status === "cancelled") return false;
  return new Date(dateIso).getTime() < Date.now();
}

/**
 * Create a new follow-up task
 */
export async function createFollowUpDb(
  businessId: string,
  input: ValidatedCreateFollowUp | CreateFollowUpInput,
  actor?: { id: string; name?: string },
  client?: any
): Promise<CrmFollowUp> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = nowIso();

  if (supabase) {
    // 1. Verify contact belongs to business
    const { data: contact, error: contactErr } = await supabase
      .from("wa_contacts")
      .select("id, display_name, phone_number, business_id")
      .eq("id", input.contactId)
      .eq("business_id", businessId)
      .single();

    if (contactErr || !contact) {
      throw new Error("Contact not found or does not belong to this business.");
    }

    // 2. If conversationId provided, verify it belongs to business
    if (input.conversationId) {
      const { data: conv, error: convErr } = await supabase
        .from("wa_conversations")
        .select("id, business_id")
        .eq("id", input.conversationId)
        .eq("business_id", businessId)
        .single();

      if (convErr || !conv) {
        throw new Error("Conversation not found or does not belong to this business.");
      }
    }

    // 3. Insert follow-up
    const { data: followUp, error: insertErr } = await supabase
      .from("crm_follow_ups")
      .insert({
        business_id: businessId,
        contact_id: input.contactId,
        conversation_id: input.conversationId || null,
        title: input.title,
        description: input.description || null,
        priority: input.priority || "normal",
        due_at: input.dueAt,
        assigned_to: input.assignedTo || null,
        status: "open",
        created_by: actor?.id || null,
      })
      .select(`
        *,
        contact:wa_contacts (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `)
      .single();

    if (insertErr) {
      throw new Error(`Failed to create follow-up: ${insertErr.message}`);
    }

    // 4. Log contact activity
    await logContactActivityDb(
      businessId,
      input.contactId,
      "follow_up_created",
      "Follow-up Created",
      `Follow-up created: "${input.title}" (Priority: ${input.priority || "normal"}, Due: ${input.dueAt})`,
      {
        follow_up_id: followUp.id,
        title: input.title,
        priority: input.priority,
        due_at: input.dueAt,
        created_by: actor?.id,
      },
      client
    ).catch(() => {});

    // 5. Trigger internal assignment notification if assigned to a team member
    if (input.assignedTo) {
      await createNotificationDb(
        businessId,
        {
          userId: input.assignedTo,
          followUpId: followUp.id,
          reminderType: "assigned",
          category: "crm_follow_up",
          title: `Assigned: ${input.title}`,
          message: `You were assigned follow-up: "${input.title}". Due: ${formatKolkataTimestamp(input.dueAt)}`,
          actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${followUp.id}`,
          dedupKey: `followup:${followUp.id}:${input.assignedTo}:assigned`,
        },
        client
      ).catch(() => {});
    }

    return followUp;
  }

  // Mock implementation
  const id = `fu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const followUp: CrmFollowUp = {
    id,
    business_id: businessId,
    contact_id: input.contactId,
    conversation_id: input.conversationId || null,
    title: input.title,
    description: input.description || null,
    priority: (input.priority || "normal") as FollowUpPriority,
    status: "open",
    due_at: input.dueAt,
    assigned_to: input.assignedTo || null,
    completed_at: null,
    completion_notes: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_by: actor?.id || null,
    created_at: now,
    updated_at: now,
    contact: {
      id: input.contactId,
      business_id: businessId,
      display_name: "Mock Contact",
      phone_number: "919999999999",
      profile_photo_url: null,
      category: "general",
      lifecycle_stage_slug: "new-lead",
      metadata: {},
      created_at: now,
      updated_at: now,
    },
  };

  mockFollowUpsStore.set(id, followUp);

  if (input.assignedTo) {
    await createNotificationDb(
      businessId,
      {
        userId: input.assignedTo,
        followUpId: followUp.id,
        reminderType: "assigned",
        category: "crm_follow_up",
        title: `Assigned: ${input.title}`,
        message: `You were assigned follow-up: "${input.title}". Due: ${formatKolkataTimestamp(input.dueAt)}`,
        actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${followUp.id}`,
        dedupKey: `followup:${followUp.id}:${input.assignedTo}:assigned`,
      },
      client
    ).catch(() => {});
  }

  return followUp;
}

/**
 * Update an existing follow-up task
 */
export async function updateFollowUpDb(
  businessId: string,
  followUpId: string,
  input: ValidatedUpdateFollowUp,
  actor?: { id: string },
  client?: any
): Promise<CrmFollowUp> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = nowIso();

  if (supabase) {
    const updatePayload: any = {
      updated_at: now,
    };
    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.dueAt !== undefined) updatePayload.due_at = input.dueAt;
    if (input.assignedTo !== undefined) updatePayload.assigned_to = input.assignedTo;
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data: updated, error } = await supabase
      .from("crm_follow_ups")
      .update(updatePayload)
      .eq("id", followUpId)
      .eq("business_id", businessId)
      .select(`
        *,
        contact:wa_contacts (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update follow-up: ${error.message}`);
    }

    if (input.assignedTo) {
      await createNotificationDb(
        businessId,
        {
          userId: input.assignedTo,
          followUpId: followUpId,
          reminderType: "reassigned",
          category: "crm_follow_up",
          title: `Reassigned: ${updated.title}`,
          message: `Follow-up "${updated.title}" was reassigned to you. Due: ${formatKolkataTimestamp(updated.due_at)}`,
          actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${followUpId}`,
          dedupKey: `followup:${followUpId}:${input.assignedTo}:reassigned`,
        },
        client
      ).catch(() => {});
    }

    return updated;
  }

  const existing = mockFollowUpsStore.get(followUpId);
  if (!existing || existing.business_id !== businessId) {
    throw new Error("Follow-up not found.");
  }

  const updated: CrmFollowUp = {
    ...existing,
    title: input.title !== undefined ? input.title : existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    priority: input.priority !== undefined ? (input.priority as FollowUpPriority) : existing.priority,
    due_at: input.dueAt !== undefined ? input.dueAt : existing.due_at,
    assigned_to: input.assignedTo !== undefined ? input.assignedTo : existing.assigned_to,
    status: input.status !== undefined ? (input.status as FollowUpStatus) : existing.status,
    updated_at: now,
  };

  mockFollowUpsStore.set(followUpId, updated);

  if (input.assignedTo && input.assignedTo !== existing.assigned_to) {
    await createNotificationDb(
      businessId,
      {
        userId: input.assignedTo,
        followUpId: followUpId,
        reminderType: "reassigned",
        category: "crm_follow_up",
        title: `Reassigned: ${updated.title}`,
        message: `Follow-up "${updated.title}" was reassigned to you. Due: ${formatKolkataTimestamp(updated.due_at)}`,
        actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${followUpId}`,
        dedupKey: `followup:${followUpId}:${input.assignedTo}:reassigned`,
      },
      client
    ).catch(() => {});
  }

  return updated;
}

/**
 * Mark a follow-up task completed
 */
export async function completeFollowUpDb(
  businessId: string,
  followUpId: string,
  completionNotes?: string,
  actor?: { id: string; name?: string },
  client?: any
): Promise<CrmFollowUp> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = nowIso();

  if (supabase) {
    const { data: updated, error } = await supabase
      .from("crm_follow_ups")
      .update({
        status: "completed",
        completed_at: now,
        completion_notes: completionNotes || null,
        updated_at: now,
      })
      .eq("id", followUpId)
      .eq("business_id", businessId)
      .select(`
        *,
        contact:wa_contacts (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to complete follow-up: ${error.message}`);
    }

    // Log activity
    await logContactActivityDb(
      businessId,
      updated.contact_id,
      "follow_up_completed",
      "Follow-up Completed",
      `Follow-up completed: "${updated.title}"${completionNotes ? ` - Notes: ${completionNotes}` : ""}`,
      {
        follow_up_id: followUpId,
        title: updated.title,
        completion_notes: completionNotes,
        completed_by: actor?.id,
      },
      client
    ).catch(() => {});

    // Notify assigned user if completed by another person
    const notifyUser = updated.assigned_to || updated.created_by;
    if (notifyUser && notifyUser !== actor?.id) {
      await createNotificationDb(
        businessId,
        {
          userId: notifyUser,
          followUpId: followUpId,
          reminderType: "completed",
          category: "crm_follow_up",
          title: `Completed: ${updated.title}`,
          message: `Follow-up "${updated.title}" was marked completed by ${actor?.name || "a team member"}.`,
          actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${followUpId}`,
          dedupKey: `followup:${followUpId}:${notifyUser}:completed`,
        },
        client
      ).catch(() => {});
    }

    return updated;
  }

  const existing = mockFollowUpsStore.get(followUpId);
  if (!existing || existing.business_id !== businessId) {
    throw new Error("Follow-up not found.");
  }

  const updated: CrmFollowUp = {
    ...existing,
    status: "completed",
    completed_at: now,
    completion_notes: completionNotes || null,
    updated_at: now,
  };

  mockFollowUpsStore.set(followUpId, updated);

  const notifyUserMock = updated.assigned_to || updated.created_by;
  if (notifyUserMock && notifyUserMock !== actor?.id) {
    await createNotificationDb(
      businessId,
      {
        userId: notifyUserMock,
        followUpId: followUpId,
        reminderType: "completed",
        category: "crm_follow_up",
        title: `Completed: ${updated.title}`,
        message: `Follow-up "${updated.title}" was marked completed by ${actor?.name || "a team member"}.`,
        actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${followUpId}`,
        dedupKey: `followup:${followUpId}:${notifyUserMock}:completed`,
      },
      client
    ).catch(() => {});
  }

  return updated;
}

/**
 * Reschedule a follow-up task
 */
export async function rescheduleFollowUpDb(
  businessId: string,
  followUpId: string,
  newDueAt: string,
  reason?: string,
  actor?: { id: string },
  client?: any
): Promise<CrmFollowUp> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = nowIso();

  if (supabase) {
    const { data: updated, error } = await supabase
      .from("crm_follow_ups")
      .update({
        due_at: newDueAt,
        status: "open", // Reopen if previously another status
        updated_at: now,
      })
      .eq("id", followUpId)
      .eq("business_id", businessId)
      .select(`
        *,
        contact:wa_contacts (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to reschedule follow-up: ${error.message}`);
    }

    // Log activity
    await logContactActivityDb(
      businessId,
      updated.contact_id,
      "follow_up_rescheduled",
      "Follow-up Rescheduled",
      `Follow-up rescheduled to ${newDueAt}${reason ? ` (Reason: ${reason})` : ""}`,
      {
        follow_up_id: followUpId,
        new_due_at: newDueAt,
        reason,
        rescheduled_by: actor?.id,
      },
      client
    ).catch(() => {});

    return updated;
  }

  const existing = mockFollowUpsStore.get(followUpId);
  if (!existing || existing.business_id !== businessId) {
    throw new Error("Follow-up not found.");
  }

  const updated: CrmFollowUp = {
    ...existing,
    due_at: newDueAt,
    status: "open",
    updated_at: now,
  };

  mockFollowUpsStore.set(followUpId, updated);
  return updated;
}

/**
 * Cancel a follow-up task
 */
export async function cancelFollowUpDb(
  businessId: string,
  followUpId: string,
  reason?: string,
  actor?: { id: string },
  client?: any
): Promise<CrmFollowUp> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = nowIso();

  if (supabase) {
    const { data: updated, error } = await supabase
      .from("crm_follow_ups")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: reason || null,
        updated_at: now,
      })
      .eq("id", followUpId)
      .eq("business_id", businessId)
      .select(`
        *,
        contact:wa_contacts (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to cancel follow-up: ${error.message}`);
    }

    // Log activity
    await logContactActivityDb(
      businessId,
      updated.contact_id,
      "follow_up_cancelled",
      "Follow-up Cancelled",
      `Follow-up cancelled: "${updated.title}"${reason ? ` (Reason: ${reason})` : ""}`,
      {
        follow_up_id: followUpId,
        reason,
        cancelled_by: actor?.id,
      },
      client
    ).catch(() => {});

    return updated;
  }

  const existing = mockFollowUpsStore.get(followUpId);
  if (!existing || existing.business_id !== businessId) {
    throw new Error("Follow-up not found.");
  }

  const updated: CrmFollowUp = {
    ...existing,
    status: "cancelled",
    cancelled_at: now,
    cancellation_reason: reason || null,
    updated_at: now,
  };

  mockFollowUpsStore.set(followUpId, updated);
  return updated;
}

/**
 * Get a single follow-up by ID
 */
export async function getFollowUpByIdDb(
  businessId: string,
  followUpId: string,
  client?: any
): Promise<CrmFollowUp | null> {
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
      .from("crm_follow_ups")
      .select(`
        *,
        contact:wa_contacts (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `)
      .eq("id", followUpId)
      .eq("business_id", businessId)
      .single();

    if (error || !data) return null;
    return data;
  }

  const item = mockFollowUpsStore.get(followUpId);
  if (item && item.business_id === businessId) return item;
  return null;
}

/**
 * Get follow-ups with filtering, tabs, and pagination
 */
export async function getFollowUpsDb(
  businessId: string,
  filters: FollowUpFilterOptions = {},
  client?: any
): Promise<{ followUps: CrmFollowUp[]; totalCount: number }> {
  await validateTenant(businessId, { client });

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 25));
  const offset = (page - 1) * limit;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    let query = supabase
      .from("crm_follow_ups")
      .select(`
        *,
        contact:wa_contacts!inner (
          id,
          display_name,
          phone_number,
          profile_photo_url,
          category,
          lifecycle_stage_slug
        )
      `, { count: "exact" })
      .eq("business_id", businessId);

    // Filter by tab
    const now = new Date().toISOString();
    const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const todayStartIso = `${todayKolkata}T00:00:00+05:30`;
    const todayEndIso = `${todayKolkata}T23:59:59.999+05:30`;

    if (filters.tab === "today") {
      query = query
        .in("status", ["open", "in_progress"])
        .gte("due_at", todayStartIso)
        .lte("due_at", todayEndIso);
    } else if (filters.tab === "upcoming") {
      query = query
        .in("status", ["open", "in_progress"])
        .gt("due_at", todayEndIso);
    } else if (filters.tab === "overdue") {
      query = query
        .in("status", ["open", "in_progress"])
        .lt("due_at", now);
    } else if (filters.tab === "completed") {
      query = query.eq("status", "completed");
    } else if (filters.tab === "assigned_to_me" && filters.assignedTo) {
      query = query
        .eq("assigned_to", filters.assignedTo)
        .in("status", ["open", "in_progress"]);
    }

    if (filters.status && filters.status !== "all" && !filters.tab) {
      query = query.eq("status", filters.status);
    }

    if (filters.priority && filters.priority !== "all") {
      query = query.eq("priority", filters.priority);
    }

    if (filters.contactId) {
      query = query.eq("contact_id", filters.contactId);
    }

    if (filters.assignedTo && filters.tab !== "assigned_to_me") {
      query = query.eq("assigned_to", filters.assignedTo);
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      query = query.or(`title.ilike.%${q}%,contact.display_name.ilike.%${q}%,contact.phone_number.ilike.%${q}%`);
    }

    query = query
      .order("due_at", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (!error && data) {
      return {
        followUps: data,
        totalCount: count ?? data.length,
      };
    }
  }

  // Fallback to in-memory store
  let items = Array.from(mockFollowUpsStore.values()).filter((f) => f.business_id === businessId);

  // Tab filtering
  if (filters.tab === "today") {
    items = items.filter((f) => (f.status === "open" || f.status === "in_progress") && isTodayKolkata(f.due_at));
  } else if (filters.tab === "upcoming") {
    items = items.filter(
      (f) => (f.status === "open" || f.status === "in_progress") && !isTodayKolkata(f.due_at) && new Date(f.due_at).getTime() > Date.now()
    );
  } else if (filters.tab === "overdue") {
    items = items.filter((f) => isOverdue(f.due_at, f.status));
  } else if (filters.tab === "completed") {
    items = items.filter((f) => f.status === "completed");
  } else if (filters.tab === "assigned_to_me" && filters.assignedTo) {
    items = items.filter((f) => f.assigned_to === filters.assignedTo && (f.status === "open" || f.status === "in_progress"));
  }

  if (filters.status && filters.status !== "all" && !filters.tab) {
    items = items.filter((f) => f.status === filters.status);
  }

  if (filters.priority && filters.priority !== "all") {
    items = items.filter((f) => f.priority === filters.priority);
  }

  if (filters.contactId) {
    items = items.filter((f) => f.contact_id === filters.contactId);
  }

  if (filters.assignedTo && filters.tab !== "assigned_to_me") {
    items = items.filter((f) => f.assigned_to === filters.assignedTo);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        (f.contact?.display_name && f.contact.display_name.toLowerCase().includes(q)) ||
        (f.contact?.phone_number && f.contact.phone_number.includes(q))
    );
  }

  items.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  const totalCount = items.length;
  const paged = items.slice(offset, offset + limit);

  return { followUps: paged, totalCount };
}

/**
 * Get follow-up metrics and KPI counters
 */
export async function getFollowUpMetricsDb(
  businessId: string,
  client?: any
): Promise<FollowUpMetrics> {
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
      .from("crm_follow_ups")
      .select("id, status, due_at")
      .eq("business_id", businessId);

    if (!error && data) {
      let total = data.length;
      let open = 0;
      let completed = 0;
      let dueToday = 0;
      let overdue = 0;

      const now = Date.now();

      for (const row of data) {
        if (row.status === "completed") {
          completed++;
        } else if (row.status === "open" || row.status === "in_progress") {
          open++;
          if (isTodayKolkata(row.due_at)) {
            dueToday++;
          }
          if (new Date(row.due_at).getTime() < now) {
            overdue++;
          }
        }
      }

      const totalActionable = completed + open;
      const completionRate = totalActionable > 0 ? Math.round((completed / totalActionable) * 100) : 0;

      return {
        total,
        totalFollowUps: total,
        todayCount: dueToday,
        dueTodayFollowUps: dueToday,
        upcomingCount: total - dueToday - overdue - completed,
        overdueCount: overdue,
        overdueFollowUps: overdue,
        completedCount: completed,
        completedFollowUps: completed,
        openFollowUps: open,
        completionRate,
      };
    }
  }

  // Fallback to in-memory store
  const items = Array.from(mockFollowUpsStore.values()).filter((f) => f.business_id === businessId);
  let open = 0;
  let completed = 0;
  let dueToday = 0;
  let overdue = 0;
  const now = Date.now();

  for (const row of items) {
    if (row.status === "completed") {
      completed++;
    } else if (row.status === "open" || row.status === "in_progress") {
      open++;
      if (isTodayKolkata(row.due_at)) {
        dueToday++;
      }
      if (new Date(row.due_at).getTime() < now) {
        overdue++;
      }
    }
  }

  const totalActionable = completed + open;
  const completionRate = totalActionable > 0 ? Math.round((completed / totalActionable) * 100) : 0;

  return {
    total: items.length,
    totalFollowUps: items.length,
    todayCount: dueToday,
    dueTodayFollowUps: dueToday,
    upcomingCount: items.length - dueToday - overdue - completed,
    overdueCount: overdue,
    overdueFollowUps: overdue,
    completedCount: completed,
    completedFollowUps: completed,
    openFollowUps: open,
    completionRate,
  };
}
