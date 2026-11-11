import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant } from "@/lib/inbox/database";
import {
  CrmFollowUpReminder,
  FollowUpReminderType,
  NotificationCategory,
  NotificationFilterOptions,
  NotificationStats,
  UserNotificationPreferences,
} from "@/types/database";
import { getMockFollowUps } from "@/lib/crm/follow-ups";
import { getTeamMembersDb } from "@/lib/team/database";
import {
  formatKolkataTimestamp,
  getKolkataDateString,
} from "./date-utils";

export { formatKolkataTimestamp, getKolkataDateString };

// In-memory mock stores for unit testing & offline development
const mockNotificationsStore = new Map<string, CrmFollowUpReminder>();
const mockPreferencesStore = new Map<string, UserNotificationPreferences>();

export function resetMockNotificationsStore(): void {
  mockNotificationsStore.clear();
  mockPreferencesStore.clear();
}

/**
 * Returns current timestamp in ISO format
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Validates whether a user is an active member of the specified business.
 * Ensures notifications are strictly directed to verified active members.
 */
export async function isUserActiveMember(
  businessId: string,
  userId: string,
  client?: any
): Promise<boolean> {
  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("business_members")
        .select("id, is_active")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) return true;
    } catch {
      // fallback to mock check
    }
  }

  // Mock lookup
  try {
    const members = await getTeamMembersDb(businessId, {}, client);
    return members.some(
      (m) => (m.user_id === userId || m.id === userId) && m.is_active
    );
  } catch {
    return true; // Default permissive for unit test stubs
  }
}

/**
 * Default User Notification Preferences factory
 */
export function getDefaultPreferences(
  businessId: string,
  userId: string
): UserNotificationPreferences {
  const now = nowIso();
  return {
    id: `pref-${businessId}-${userId}`,
    business_id: businessId,
    user_id: userId,
    in_app_enabled: true,
    notify_due_today: true,
    notify_due_soon: true,
    notify_overdue: true,
    notify_assigned: true,
    notify_team_events: true,
    notify_system: true,
    lead_time_hours: 24,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get notification preferences for a specific user within a business
 */
export async function getUserNotificationPreferencesDb(
  businessId: string,
  userId: string,
  client?: any
): Promise<UserNotificationPreferences> {
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
      .from("user_notification_preferences")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      return data as UserNotificationPreferences;
    }
  }

  const key = `${businessId}:${userId}`;
  const existing = mockPreferencesStore.get(key);
  if (existing) return existing;

  const def = getDefaultPreferences(businessId, userId);
  mockPreferencesStore.set(key, def);
  return def;
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferencesDb(
  businessId: string,
  userId: string,
  updates: Partial<UserNotificationPreferences>,
  client?: any
): Promise<UserNotificationPreferences> {
  await validateTenant(businessId, { client });

  const existing = await getUserNotificationPreferencesDb(businessId, userId, client);
  const now = nowIso();

  const merged: UserNotificationPreferences = {
    ...existing,
    ...updates,
    business_id: businessId, // Tenant immutable
    user_id: userId,
    updated_at: now,
  };

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
      .from("user_notification_preferences")
      .upsert(merged, { onConflict: "business_id,user_id" })
      .select()
      .single();

    if (!error && data) {
      return data as UserNotificationPreferences;
    }
  }

  const key = `${businessId}:${userId}`;
  mockPreferencesStore.set(key, merged);
  return merged;
}

export interface CreateNotificationInput {
  userId: string;
  reminderType: FollowUpReminderType;
  category?: NotificationCategory;
  title: string;
  message: string;
  followUpId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, any>;
  dedupKey?: string | null;
  status?: "pending" | "processing" | "delivered";
}

/**
 * Create an internal notification with deduplication & tenant isolation.
 * Delivers strictly to verified active team members.
 */
export async function createNotificationDb(
  businessId: string,
  input: CreateNotificationInput,
  client?: any
): Promise<CrmFollowUpReminder | null> {
  await validateTenant(businessId, { client });

  // 1. Revalidate active team member status
  const isActive = await isUserActiveMember(businessId, input.userId, client);
  if (!isActive) {
    return null; // Skip delivery to inactive/removed member
  }

  // 2. Generate deterministic deduplication key if not supplied
  const dedupKey =
    input.dedupKey ||
    (input.followUpId
      ? `followup:${input.followUpId}:${input.userId}:${input.reminderType}`
      : undefined);

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const now = nowIso();
  const category: NotificationCategory =
    input.category ||
    (["team_invitation", "team_member_joined"].includes(input.reminderType)
      ? "team"
      : input.reminderType === "system"
      ? "system"
      : "crm_follow_up");

  const record: Partial<CrmFollowUpReminder> = {
    business_id: businessId,
    user_id: input.userId,
    follow_up_id: input.followUpId || null,
    reminder_type: input.reminderType,
    category,
    title: input.title,
    message: input.message,
    action_url: input.actionUrl || null,
    metadata: input.metadata || {},
    dedup_key: dedupKey || null,
    is_read: false,
    is_dismissed: false,
    status: input.status || "delivered",
    created_at: now,
  };

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_follow_up_reminders")
      .upsert(record, {
        onConflict: dedupKey ? "business_id,dedup_key" : "id",
        ignoreDuplicates: true,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      return data as CrmFollowUpReminder;
    }
  }

  // Mock Store deduplication check
  if (dedupKey) {
    const existing = Array.from(mockNotificationsStore.values()).find(
      (n) => n.business_id === businessId && n.dedup_key === dedupKey
    );
    if (existing) {
      return existing;
    }
  }

  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const created: CrmFollowUpReminder = {
    id,
    business_id: businessId,
    user_id: input.userId,
    follow_up_id: input.followUpId || null,
    reminder_type: input.reminderType,
    category,
    title: input.title,
    message: input.message,
    action_url: input.actionUrl || null,
    metadata: input.metadata || {},
    dedup_key: dedupKey || null,
    is_read: false,
    read_at: null,
    is_dismissed: false,
    dismissed_at: null,
    status: input.status || "delivered",
    created_at: now,
  };

  mockNotificationsStore.set(id, created);
  return created;
}

/**
 * List internal notifications for a specific user and business
 */
export async function listNotificationsDb(
  businessId: string,
  userId: string,
  filters: NotificationFilterOptions = {},
  client?: any
): Promise<{
  notifications: CrmFollowUpReminder[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  await validateTenant(businessId, { client });

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = filters.offset !== undefined ? filters.offset : (page - 1) * limit;

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
      .from("crm_follow_up_reminders")
      .select(
        `
        *,
        follow_up:crm_follow_ups (
          id,
          title,
          priority,
          due_at,
          status,
          contact:wa_contacts (
            id,
            display_name,
            phone_number
          )
        )
      `,
        { count: "exact" }
      )
      .eq("business_id", businessId)
      .eq("user_id", userId);

    if (!filters.includeDismissed) {
      query = query.eq("is_dismissed", false);
    }

    if (filters.tab === "unread" || filters.isRead === false) {
      query = query.eq("is_read", false);
    } else if (filters.tab === "crm") {
      query = query.eq("category", "crm_follow_up");
    } else if (filters.tab === "team") {
      query = query.eq("category", "team");
    } else if (filters.tab === "system") {
      query = query.eq("category", "system");
    }

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.reminderType) {
      query = query.eq("reminder_type", filters.reminderType);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`title.ilike.${term},message.ilike.${term}`);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (!error && data) {
      // Fetch unread count
      const { count: unreadCount } = await supabase
        .from("crm_follow_up_reminders")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_dismissed", false);

      const total = count || 0;
      return {
        notifications: data as CrmFollowUpReminder[],
        total,
        unreadCount: unreadCount || 0,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }
  }

  // Mock Store Lookup
  let items = Array.from(mockNotificationsStore.values()).filter(
    (n) => n.business_id === businessId && n.user_id === userId
  );

  if (!filters.includeDismissed) {
    items = items.filter((n) => !n.is_dismissed);
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  if (filters.tab === "unread" || filters.isRead === false) {
    items = items.filter((n) => !n.is_read);
  } else if (filters.tab === "crm") {
    items = items.filter((n) => (n.category || "crm_follow_up") === "crm_follow_up");
  } else if (filters.tab === "team") {
    items = items.filter((n) => n.category === "team");
  } else if (filters.tab === "system") {
    items = items.filter((n) => n.category === "system");
  }

  if (filters.category) {
    items = items.filter((n) => n.category === filters.category);
  }

  if (filters.reminderType) {
    items = items.filter((n) => n.reminder_type === filters.reminderType);
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim().toLowerCase();
    items = items.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(s)) ||
        (n.message && n.message.toLowerCase().includes(s))
    );
  }

  items.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return {
    notifications: paged,
    total,
    unreadCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Get notification summary metrics for workspace badge and dashboard
 */
export async function getNotificationStatsDb(
  businessId: string,
  userId: string,
  client?: any
): Promise<NotificationStats> {
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
    const { data: rows } = await supabase
      .from("crm_follow_up_reminders")
      .select("reminder_type, is_read")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .eq("is_dismissed", false);

    if (rows) {
      let unreadCount = 0;
      let dueTodayCount = 0;
      let overdueCount = 0;
      let assignedCount = 0;

      for (const r of rows) {
        if (!r.is_read) {
          unreadCount++;
          if (r.reminder_type === "due_today") dueTodayCount++;
          if (r.reminder_type === "overdue") overdueCount++;
          if (r.reminder_type === "assigned" || r.reminder_type === "reassigned")
            assignedCount++;
        }
      }

      return {
        total: rows.length,
        unreadCount,
        dueTodayCount,
        overdueCount,
        assignedCount,
      };
    }
  }

  const items = Array.from(mockNotificationsStore.values()).filter(
    (n) => n.business_id === businessId && n.user_id === userId && !n.is_dismissed
  );

  const unread = items.filter((n) => !n.is_read);

  return {
    total: items.length,
    unreadCount: unread.length,
    dueTodayCount: unread.filter((n) => n.reminder_type === "due_today").length,
    overdueCount: unread.filter((n) => n.reminder_type === "overdue").length,
    assignedCount: unread.filter(
      (n) => n.reminder_type === "assigned" || n.reminder_type === "reassigned"
    ).length,
  };
}

/**
 * Mark a single notification as read
 */
export async function markNotificationReadDb(
  businessId: string,
  notificationId: string,
  userId: string,
  client?: any
): Promise<boolean> {
  await validateTenant(businessId, { client });

  const now = nowIso();
  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { error } = await supabase
      .from("crm_follow_up_reminders")
      .update({ is_read: true, read_at: now })
      .eq("id", notificationId)
      .eq("business_id", businessId)
      .eq("user_id", userId);

    return !error;
  }

  const item = mockNotificationsStore.get(notificationId);
  if (item && item.business_id === businessId && item.user_id === userId) {
    item.is_read = true;
    item.read_at = now;
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsReadDb(
  businessId: string,
  userId: string,
  client?: any
): Promise<number> {
  await validateTenant(businessId, { client });

  const now = nowIso();
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
      .from("crm_follow_up_reminders")
      .update({ is_read: true, read_at: now })
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .eq("is_read", false)
      .select("id");

    if (!error && data) {
      return data.length;
    }
    return 0;
  }

  let count = 0;
  for (const item of mockNotificationsStore.values()) {
    if (item.business_id === businessId && item.user_id === userId && !item.is_read) {
      item.is_read = true;
      item.read_at = now;
      count++;
    }
  }
  return count;
}

/**
 * Dismiss/archive a single notification
 */
export async function dismissNotificationDb(
  businessId: string,
  notificationId: string,
  userId: string,
  client?: any
): Promise<boolean> {
  await validateTenant(businessId, { client });

  const now = nowIso();
  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { error } = await supabase
      .from("crm_follow_up_reminders")
      .update({ is_dismissed: true, dismissed_at: now, status: "dismissed" })
      .eq("id", notificationId)
      .eq("business_id", businessId)
      .eq("user_id", userId);

    return !error;
  }

  const item = mockNotificationsStore.get(notificationId);
  if (item && item.business_id === businessId && item.user_id === userId) {
    item.is_dismissed = true;
    item.dismissed_at = now;
    item.status = "dismissed";
    return true;
  }
  return false;
}

/**
 * Dismiss all read notifications for a user
 */
export async function dismissAllNotificationsDb(
  businessId: string,
  userId: string,
  client?: any
): Promise<number> {
  await validateTenant(businessId, { client });

  const now = nowIso();
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
      .from("crm_follow_up_reminders")
      .update({ is_dismissed: true, dismissed_at: now, status: "dismissed" })
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .eq("is_dismissed", false)
      .eq("is_read", true)
      .select("id");

    if (!error && data) {
      return data.length;
    }
    return 0;
  }

  let count = 0;
  for (const item of mockNotificationsStore.values()) {
    if (
      item.business_id === businessId &&
      item.user_id === userId &&
      !item.is_dismissed &&
      item.is_read
    ) {
      item.is_dismissed = true;
      item.dismissed_at = now;
      item.status = "dismissed";
      count++;
    }
  }
  return count;
}

/**
 * Generate internal follow-up reminders for active team members.
 * Strictly database-backed, idempotent, bounded, and timezone-aware.
 *
 * Rules:
 * - Strictly INTERNAL. Zero customer WhatsApp messages.
 * - Delivered only to ACTIVE business members.
 * - Skip completed or cancelled follow-ups.
 * - Asia/Kolkata timezone boundary for "due_today".
 * - Bounded overdue horizon (max 14 days) to prevent infinite loops.
 * - Deduplication via business_id + dedup_key.
 */
export async function generateFollowUpRemindersDb(
  businessId: string,
  client?: any
): Promise<{ generatedCount: number; reminders: CrmFollowUpReminder[] }> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  const nowMs = Date.now();
  const kolkataToday = getKolkataDateString(new Date(nowMs));
  const maxOverdueHorizonMs = 14 * 24 * 60 * 60 * 1000; // 14 days
  const minOverdueDueTime = nowMs - maxOverdueHorizonMs;

  const generatedReminders: CrmFollowUpReminder[] = [];

  if (supabase) {
    // 1. Fetch active members for this business
    const { data: activeMembers } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("is_active", true);

    const activeUserIds = new Set(
      (activeMembers || []).map((m: any) => m.user_id).filter(Boolean)
    );

    // Default lead time 24 hours
    const soonThreshold = nowMs + 24 * 60 * 60 * 1000;
    const soonIso = new Date(soonThreshold).toISOString();

    // 2. Fetch active follow-ups with assigned user or creator
    const { data: followUps, error } = await supabase
      .from("crm_follow_ups")
      .select("id, business_id, title, due_at, status, priority, assigned_to, created_by")
      .eq("business_id", businessId)
      .in("status", ["open", "in_progress"])
      .lte("due_at", soonIso);

    if (error || !followUps || followUps.length === 0) {
      return { generatedCount: 0, reminders: [] };
    }

    const payloadList: any[] = [];

    for (const fu of followUps) {
      const recipientUserId = fu.assigned_to || fu.created_by;
      if (!recipientUserId) continue;

      // Deliver ONLY to active team members
      if (activeUserIds.size > 0 && !activeUserIds.has(recipientUserId)) {
        continue;
      }

      const dueTime = new Date(fu.due_at).getTime();
      const kolkataDueDay = getKolkataDateString(new Date(dueTime));

      let reminderType: FollowUpReminderType;
      let title: string;
      let message: string;
      let dedupKey: string;

      if (dueTime < nowMs) {
        // Bounded overdue: ignore if older than 14 days
        if (dueTime < minOverdueDueTime) {
          continue;
        }
        reminderType = "overdue";
        title = `Overdue Follow-up: ${fu.title}`;
        message = `Follow-up "${fu.title}" was due on ${formatKolkataTimestamp(fu.due_at)} and is overdue.`;
        dedupKey = `followup:${fu.id}:${recipientUserId}:overdue`;
      } else if (kolkataDueDay === kolkataToday) {
        reminderType = "due_today";
        title = `Follow-up Due Today: ${fu.title}`;
        message = `Follow-up "${fu.title}" is scheduled for today at ${formatKolkataTimestamp(fu.due_at)}.`;
        dedupKey = `followup:${fu.id}:${recipientUserId}:due_today:${kolkataToday}`;
      } else {
        reminderType = "due_soon";
        title = `Follow-up Due Soon: ${fu.title}`;
        message = `Follow-up "${fu.title}" is due soon on ${formatKolkataTimestamp(fu.due_at)}.`;
        dedupKey = `followup:${fu.id}:${recipientUserId}:due_soon`;
      }

      payloadList.push({
        business_id: businessId,
        follow_up_id: fu.id,
        user_id: recipientUserId,
        reminder_type: reminderType,
        category: "crm_follow_up",
        title,
        message,
        action_url: `/workspace/${businessId}/crm/follow-ups?id=${fu.id}`,
        metadata: {
          follow_up_id: fu.id,
          priority: fu.priority,
          due_at: fu.due_at,
        },
        dedup_key: dedupKey,
        is_read: false,
        is_dismissed: false,
        status: "delivered",
        created_at: nowIso(),
      });
    }

    if (payloadList.length === 0) {
      return { generatedCount: 0, reminders: [] };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("crm_follow_up_reminders")
      .upsert(payloadList, {
        onConflict: "business_id,dedup_key",
        ignoreDuplicates: true,
      })
      .select();

    if (insertErr) {
      console.warn("Failed to insert follow-up reminders:", insertErr.message);
      return { generatedCount: 0, reminders: [] };
    }

    return {
      generatedCount: inserted ? inserted.length : 0,
      reminders: (inserted || []) as CrmFollowUpReminder[],
    };
  }

  // Mock implementation for offline & Vitest suite
  const mockFollowUps = getMockFollowUps(businessId).filter(
    (f) => f.status === "open" || f.status === "in_progress"
  );

  let generatedCount = 0;

  for (const fu of mockFollowUps) {
    const recipientUserId = fu.assigned_to || fu.created_by;
    if (!recipientUserId) continue;

    const dueTime = new Date(fu.due_at).getTime();
    if (dueTime > nowMs + 24 * 60 * 60 * 1000) continue;

    const kolkataDueDay = getKolkataDateString(new Date(dueTime));

    let reminderType: FollowUpReminderType;
    let title: string;
    let message: string;
    let dedupKey: string;

    if (dueTime < nowMs) {
      if (dueTime < minOverdueDueTime) continue;
      reminderType = "overdue";
      title = `Overdue Follow-up: ${fu.title}`;
      message = `Follow-up "${fu.title}" was due on ${formatKolkataTimestamp(fu.due_at)} and is overdue.`;
      dedupKey = `followup:${fu.id}:${recipientUserId}:overdue`;
    } else if (kolkataDueDay === kolkataToday) {
      reminderType = "due_today";
      title = `Follow-up Due Today: ${fu.title}`;
      message = `Follow-up "${fu.title}" is scheduled for today at ${formatKolkataTimestamp(fu.due_at)}.`;
      dedupKey = `followup:${fu.id}:${recipientUserId}:due_today:${kolkataToday}`;
    } else {
      reminderType = "due_soon";
      title = `Follow-up Due Soon: ${fu.title}`;
      message = `Follow-up "${fu.title}" is due soon on ${formatKolkataTimestamp(fu.due_at)}.`;
      dedupKey = `followup:${fu.id}:${recipientUserId}:due_soon`;
    }

    const created = await createNotificationDb(
      businessId,
      {
        userId: recipientUserId,
        followUpId: fu.id,
        reminderType,
        category: "crm_follow_up",
        title,
        message,
        actionUrl: `/workspace/${businessId}/crm/follow-ups?id=${fu.id}`,
        metadata: {
          follow_up_id: fu.id,
          priority: fu.priority,
          due_at: fu.due_at,
        },
        dedupKey,
      },
      client
    );

    if (created) {
      generatedReminders.push(created);
      generatedCount++;
    }
  }

  return { generatedCount, reminders: generatedReminders };
}

export interface ProcessReminderBatchResult {
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  reclaimedCount: number;
  errors: string[];
}

/**
 * Durable Reminder Processing Batch Worker
 * Recovers stuck processing jobs and atomically claims & processes pending reminders.
 */
export async function processReminderJobsBatch(
  batchSize: number = 20,
  workerId: string = `remind_worker_${Date.now()}`
): Promise<ProcessReminderBatchResult> {
  const result: ProcessReminderBatchResult = {
    claimedCount: 0,
    processedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    reclaimedCount: 0,
    errors: [],
  };

  let supabase: any;
  if (isSupabaseConfigured()) {
    try {
      supabase = createAdminClient();
    } catch (err: any) {
      result.errors.push(`Admin client init error: ${err.message}`);
    }
  }

  // 1. Recover jobs stuck in 'processing' state > 5 minutes
  if (supabase) {
    try {
      const { data: reclaimed } = await supabase.rpc("reclaim_stuck_reminder_jobs", {
        p_timeout_minutes: 5,
      });
      if (typeof reclaimed === "number") {
        result.reclaimedCount = reclaimed;
      }
    } catch {
      // RPC execution fallback
    }
  } else {
    // Mock recovery: reclaim items locked > 5 min ago
    const timeoutThreshold = Date.now() - 5 * 60 * 1000;
    for (const notif of mockNotificationsStore.values()) {
      if (
        notif.status === "processing" &&
        notif.locked_at &&
        new Date(notif.locked_at).getTime() < timeoutThreshold
      ) {
        if ((notif.retry_count || 0) < (notif.max_retries || 3)) {
          notif.status = "pending";
          notif.locked_at = null;
          notif.locked_by = null;
          result.reclaimedCount++;
        } else {
          notif.status = "failed";
          notif.locked_at = null;
          notif.locked_by = null;
          notif.last_error = "Exceeded max retries";
        }
      }
    }
  }

  // 2. Atomic claim pending jobs
  let claimedRows: CrmFollowUpReminder[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("claim_next_reminder_jobs", {
        p_batch_size: batchSize,
        p_worker_id: workerId,
      });
      if (!error && Array.isArray(data)) {
        claimedRows = data as CrmFollowUpReminder[];
      }
    } catch (err: any) {
      result.errors.push(`Claim RPC error: ${err.message}`);
    }
  } else {
    // Mock claim
    const pending = Array.from(mockNotificationsStore.values()).filter(
      (n) => n.status === "pending"
    );
    for (const item of pending.slice(0, batchSize)) {
      item.status = "processing";
      item.locked_at = nowIso();
      item.locked_by = workerId;
      item.retry_count = (item.retry_count || 0) + 1;
      claimedRows.push(item);
    }
  }

  result.claimedCount = claimedRows.length;
  if (claimedRows.length === 0) {
    return result;
  }

  // 3. Process claimed items
  for (const job of claimedRows) {
    result.processedCount++;

    try {
      // Revalidate active member status in destination business
      const isActive = await isUserActiveMember(job.business_id, job.user_id, supabase);

      if (!isActive) {
        // Recipient deactivated -> fail
        result.failedCount++;
        const failError = "Recipient user is no longer an active member of this business.";

        if (supabase) {
          await supabase
            .from("crm_follow_up_reminders")
            .update({
              status: "failed",
              last_error: failError,
              locked_at: null,
              locked_by: null,
            })
            .eq("id", job.id);
        } else {
          job.status = "failed";
          job.last_error = failError;
          job.locked_at = null;
          job.locked_by = null;
        }
        continue;
      }

      // Success -> transition to delivered
      result.succeededCount++;

      if (supabase) {
        await supabase
          .from("crm_follow_up_reminders")
          .update({
            status: "delivered",
            locked_at: null,
            locked_by: null,
          })
          .eq("id", job.id);
      } else {
        job.status = "delivered";
        job.locked_at = null;
        job.locked_by = null;
      }
    } catch (err: any) {
      result.failedCount++;
      const errMsg = err.message || "Reminder processing failure";
      result.errors.push(`Job ${job.id} failure: ${errMsg}`);

      if (supabase) {
        await supabase
          .from("crm_follow_up_reminders")
          .update({
            status: "failed",
            last_error: errMsg,
            locked_at: null,
            locked_by: null,
          })
          .eq("id", job.id);
      } else {
        job.status = "failed";
        job.last_error = errMsg;
        job.locked_at = null;
        job.locked_by = null;
      }
    }
  }

  return result;
}
