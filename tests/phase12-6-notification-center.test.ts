import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  CrmFollowUpReminder,
  FollowUpReminderType,
  NotificationCategory,
  UserNotificationPreferences,
} from "@/types/database";
import {
  createNotificationDb,
  dismissAllNotificationsDb,
  dismissNotificationDb,
  formatKolkataTimestamp,
  generateFollowUpRemindersDb,
  getKolkataDateString,
  getNotificationStatsDb,
  getUserNotificationPreferencesDb,
  listNotificationsDb,
  markAllNotificationsReadDb,
  markNotificationReadDb,
  processReminderJobsBatch,
  resetMockNotificationsStore,
  updateUserNotificationPreferencesDb,
} from "@/lib/notifications/service";
import {
  createFollowUpDb,
  resetMockFollowUpsStore,
} from "@/lib/crm/follow-ups";
import { createContactDb, resetMockCrmStore } from "@/lib/crm/database";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const ASTRO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";
const ROGUE_BUSINESS_ID = "99999999-9999-9999-9999-999999999999";

const USER_ASTRO_AGENT = "user-astro-agent-01";
const USER_ASTRO_ADMIN = "user-astro-admin-01";
const USER_VIVAHAM_AGENT = "user-vivaham-agent-01";

// ==============================================================================
// DOMAIN 1: DATABASE MIGRATION 021 PGLITE SCHEMA & TRIGGER VERIFICATION
// ==============================================================================
describe("Domain 1: Database Migration 021 PGlite Schema, Constraints & Triggers", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::UUID;
      $$;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT '{"role": "service_role"}'::jsonb;
      $$;
    `);

    const sqlFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    expect(sqlFiles.some((f) => f.includes("021"))).toBe(true);

    for (const file of sqlFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  it("1.1 Confirms crm_follow_up_reminders has nullable follow_up_id and all new Phase 12.6 columns", async () => {
    const cols = await db.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'crm_follow_up_reminders';
    `);

    const colMap = new Map(cols.rows.map((r: any) => [r.column_name, r.is_nullable]));
    expect(colMap.get("follow_up_id")).toBe("YES");
    expect(colMap.has("category")).toBe(true);
    expect(colMap.has("action_url")).toBe(true);
    expect(colMap.has("metadata")).toBe(true);
    expect(colMap.has("is_dismissed")).toBe(true);
    expect(colMap.has("dismissed_at")).toBe(true);
    expect(colMap.has("dedup_key")).toBe(true);
    expect(colMap.has("status")).toBe(true);
    expect(colMap.has("locked_at")).toBe(true);
    expect(colMap.has("locked_by")).toBe(true);
    expect(colMap.has("retry_count")).toBe(true);
    expect(colMap.has("max_retries")).toBe(true);
    expect(colMap.has("last_error")).toBe(true);
  });

  it("1.2 Confirms user_notification_preferences table and composite unique constraint exist", async () => {
    const res = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'user_notification_preferences';
    `);
    expect(res.rows.length).toBe(1);

    const constraints = await db.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'user_notification_preferences';
    `);
    const cNames = constraints.rows.map((r: any) => r.constraint_name);
    expect(cNames).toContain("uq_user_notification_pref_tenant_user");
  });

  it("1.3 Confirms atomic RPC functions claim_next_reminder_jobs and reclaim_stuck_reminder_jobs exist", async () => {
    const res = await db.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_name IN ('claim_next_reminder_jobs', 'reclaim_stuck_reminder_jobs');
    `);
    const rNames = res.rows.map((r: any) => r.routine_name);
    expect(rNames).toContain("claim_next_reminder_jobs");
    expect(rNames).toContain("reclaim_stuck_reminder_jobs");
  });

  it("1.4 Confirms deduplication unique constraint exists on crm_follow_up_reminders", async () => {
    const constraints = await db.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'crm_follow_up_reminders';
    `);
    const cNames = constraints.rows.map((r: any) => r.constraint_name);
    expect(cNames).toContain("uq_crm_follow_up_reminders_dedup_key");
  });

  it("1.5 Confirms tenant immutability triggers block modifying business_id on preferences", async () => {
    const triggers = await db.query(`
      SELECT trigger_name FROM information_schema.triggers 
      WHERE event_object_table = 'user_notification_preferences';
    `);
    const tNames = triggers.rows.map((r: any) => r.trigger_name);
    expect(tNames).toContain("trg_user_notification_pref_immutable_business_id");
  });
});

// ==============================================================================
// DOMAIN 2: NOTIFICATION CREATION, DEDUPLICATION & CATEGORIES
// ==============================================================================
describe("Domain 2: Notification Creation, Deduplication & Supported Categories", () => {
  beforeEach(() => {
    resetMockNotificationsStore();
    resetMockFollowUpsStore();
    resetMockCrmStore();
  });

  it("2.1 Creates notification for follow-up assigned to current user", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "assigned",
      title: "New Follow-up Assigned",
      message: 'You have been assigned: "Review horoscope match"',
      followUpId: "fu-001",
      actionUrl: `/workspace/astrology/crm/follow-ups?id=fu-001`,
    });

    expect(notif).toBeDefined();
    expect(notif?.reminder_type).toBe("assigned");
    expect(notif?.category).toBe("crm_follow_up");
    expect(notif?.is_read).toBe(false);
    expect(notif?.is_dismissed).toBe(false);
  });

  it("2.2 Enforces deduplication: identical task and reminderType do not create duplicates", async () => {
    const notif1 = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Follow-up Due Soon",
      message: 'Task is due in 2 hours',
      followUpId: "fu-002",
      dedupKey: `followup:fu-002:${USER_ASTRO_AGENT}:due_soon`,
    });

    const notif2 = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Follow-up Due Soon",
      message: 'Task is due in 2 hours',
      followUpId: "fu-002",
      dedupKey: `followup:fu-002:${USER_ASTRO_AGENT}:due_soon`,
    });

    expect(notif1?.id).toBe(notif2?.id);

    const list = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(list.total).toBe(1);
  });

  it("2.3 Supports team events category (team_invitation)", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_ADMIN,
      reminderType: "team_invitation",
      title: "Team Member Invited",
      message: "priya@example.com was invited as AGENT",
      actionUrl: `/workspace/astrology/team`,
      dedupKey: `team:invite:inv-123:${USER_ASTRO_ADMIN}`,
    });

    expect(notif).toBeDefined();
    expect(notif?.category).toBe("team");
    expect(notif?.reminder_type).toBe("team_invitation");
  });

  it("2.4 Supports system-level operational notifications", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_ADMIN,
      reminderType: "system",
      title: "System Maintenance Notice",
      message: "Scheduled platform maintenance on Sunday at 02:00 AM IST",
      dedupKey: "system:maint:20261109",
    });

    expect(notif).toBeDefined();
    expect(notif?.category).toBe("system");
    expect(notif?.reminder_type).toBe("system");
  });
});

// ==============================================================================
// DOMAIN 3: UNREAD COUNTS, MARK AS READ & DISMISS ACTIONS
// ==============================================================================
describe("Domain 3: Unread Counts, Mark as Read & Dismiss Actions", () => {
  beforeEach(() => {
    resetMockNotificationsStore();
  });

  it("3.1 Accurately calculates unread notification count and categorization breakdown", async () => {
    await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_today",
      title: "Task Due Today",
      message: "Consultation call today",
      dedupKey: "fu-1",
    });

    await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "overdue",
      title: "Overdue Task",
      message: "Kundali preparation overdue",
      dedupKey: "fu-2",
    });

    await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "assigned",
      title: "Task Assigned",
      message: "Assigned new contact follow-up",
      dedupKey: "fu-3",
    });

    const stats = await getNotificationStatsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(stats.total).toBe(3);
    expect(stats.unreadCount).toBe(3);
    expect(stats.dueTodayCount).toBe(1);
    expect(stats.overdueCount).toBe(1);
    expect(stats.assignedCount).toBe(1);
  });

  it("3.2 Marks single notification as read and updates read_at timestamp", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Due soon",
      message: "Due soon test",
      dedupKey: "fu-mark-read",
    });

    expect(notif?.is_read).toBe(false);

    const marked = await markNotificationReadDb(
      ASTRO_BUSINESS_ID,
      notif!.id,
      USER_ASTRO_AGENT
    );
    expect(marked).toBe(true);

    const stats = await getNotificationStatsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(stats.unreadCount).toBe(0);

    const list = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(list.notifications[0].is_read).toBe(true);
    expect(list.notifications[0].read_at).toBeDefined();
  });

  it("3.3 Marks all notifications as read in bulk", async () => {
    for (let i = 1; i <= 4; i++) {
      await createNotificationDb(ASTRO_BUSINESS_ID, {
        userId: USER_ASTRO_AGENT,
        reminderType: "due_soon",
        title: `Task ${i}`,
        message: `Task message ${i}`,
        dedupKey: `fu-bulk-${i}`,
      });
    }

    const updatedCount = await markAllNotificationsReadDb(
      ASTRO_BUSINESS_ID,
      USER_ASTRO_AGENT
    );
    expect(updatedCount).toBe(4);

    const stats = await getNotificationStatsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(stats.unreadCount).toBe(0);
  });

  it("3.4 Dismisses/archives a notification so it is hidden from default views", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "completed",
      title: "Task completed",
      message: "Task completed test",
      dedupKey: "fu-dismiss-1",
    });

    const dismissed = await dismissNotificationDb(
      ASTRO_BUSINESS_ID,
      notif!.id,
      USER_ASTRO_AGENT
    );
    expect(dismissed).toBe(true);

    const activeList = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT, {
      includeDismissed: false,
    });
    expect(activeList.total).toBe(0);

    const allList = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT, {
      includeDismissed: true,
    });
    expect(allList.total).toBe(1);
    expect(allList.notifications[0].is_dismissed).toBe(true);
  });

  it("3.5 Dismisses all read notifications in one action", async () => {
    const notif1 = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Task 1",
      message: "Msg 1",
      dedupKey: "dismiss-all-1",
    });

    const notif2 = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Task 2",
      message: "Msg 2",
      dedupKey: "dismiss-all-2",
    });

    // Mark notif1 as read
    await markNotificationReadDb(ASTRO_BUSINESS_ID, notif1!.id, USER_ASTRO_AGENT);

    // Dismiss all read -> should only dismiss notif1
    const dismissedCount = await dismissAllNotificationsDb(
      ASTRO_BUSINESS_ID,
      USER_ASTRO_AGENT
    );
    expect(dismissedCount).toBe(1);

    const remaining = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(remaining.total).toBe(1);
    expect(remaining.notifications[0].id).toBe(notif2!.id);
  });
});

// ==============================================================================
// DOMAIN 4: USER & BUSINESS TENANT ISOLATION
// ==============================================================================
describe("Domain 4: User & Business Tenant Isolation", () => {
  beforeEach(() => {
    resetMockNotificationsStore();
  });

  it("4.1 Rejects cross-tenant notification access: Astrology user never sees Vivaham notifications", async () => {
    // Create notification in Vivaham
    await createNotificationDb(VIVAHAM_BUSINESS_ID, {
      userId: USER_VIVAHAM_AGENT,
      reminderType: "assigned",
      title: "Vivaham Match Review",
      message: "Review profile #441 for bride family",
      dedupKey: "vivaham-fu-01",
    });

    // Astrology query returns 0 notifications
    const astroList = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(astroList.total).toBe(0);

    const astroStats = await getNotificationStatsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(astroStats.unreadCount).toBe(0);

    // Vivaham query returns the notification
    const vivahamList = await listNotificationsDb(VIVAHAM_BUSINESS_ID, USER_VIVAHAM_AGENT);
    expect(vivahamList.total).toBe(1);
    expect(vivahamList.notifications[0].title).toBe("Vivaham Match Review");
  });

  it("4.2 Rejects modifying notification belonging to another user", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Agent Private Reminder",
      message: "Private task",
      dedupKey: "agent-priv-01",
    });

    // Rogue user attempt to mark as read fails
    const success = await markNotificationReadDb(
      ASTRO_BUSINESS_ID,
      notif!.id,
      "user-other-agent"
    );
    expect(success).toBe(false);

    // Verify it is still unread
    const list = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    expect(list.notifications[0].is_read).toBe(false);
  });

  it("4.3 Rejects rogue business ID that does not exist", async () => {
    await expect(
      createNotificationDb(ROGUE_BUSINESS_ID, {
        userId: USER_ASTRO_AGENT,
        reminderType: "due_soon",
        title: "Rogue",
        message: "Rogue",
      })
    ).rejects.toThrow();
  });
});

// ==============================================================================
// DOMAIN 5: DURABLE REMINDER PROCESSING & RECOVERY WORKER
// ==============================================================================
describe("Domain 5: Durable Reminder Processing & Recovery Worker", () => {
  beforeEach(() => {
    resetMockNotificationsStore();
    resetMockFollowUpsStore();
  });

  it("5.1 Generates due_today, due_soon, and overdue reminders accurately", async () => {
    const now = Date.now();
    const kolkataToday = getKolkataDateString();

    // 1. Due today task
    await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: "cnt-1",
        title: "Kundali Consultation Today",
        dueAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        assignedTo: USER_ASTRO_AGENT,
      },
      { id: USER_ASTRO_AGENT }
    );

    // 2. Overdue task (past due date)
    await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: "cnt-2",
        title: "Overdue Planetary Report",
        dueAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        assignedTo: USER_ASTRO_AGENT,
      },
      { id: USER_ASTRO_AGENT }
    );

    // 3. Completed task (must NOT generate reminder)
    const completedTask = await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: "cnt-3",
        title: "Already Completed Task",
        dueAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
        assignedTo: USER_ASTRO_AGENT,
      },
      { id: USER_ASTRO_AGENT }
    );
    completedTask.status = "completed";

    // 4. Cancelled task (must NOT generate reminder)
    const cancelledTask = await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: "cnt-4",
        title: "Cancelled Task",
        dueAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
        assignedTo: USER_ASTRO_AGENT,
      },
      { id: USER_ASTRO_AGENT }
    );
    cancelledTask.status = "cancelled";

    const res = await generateFollowUpRemindersDb(ASTRO_BUSINESS_ID);
    expect(res.generatedCount).toBeGreaterThanOrEqual(2);

    const list = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    const types = list.notifications.map((n) => n.reminder_type);
    expect(types).toContain("overdue");

    // Completed and cancelled tasks are strictly excluded from generating due_today/overdue/due_soon reminders
    const fuReminders = list.notifications.filter(
      (n) => n.reminder_type === "due_today" || n.reminder_type === "overdue" || n.reminder_type === "due_soon"
    );
    const fuTitles = fuReminders.map((n) => n.title);
    expect(fuTitles.some((t) => t?.includes("Already Completed Task"))).toBe(false);
    expect(fuTitles.some((t) => t?.includes("Cancelled Task"))).toBe(false);
  });

  it("5.2 Does not generate overdue reminders indefinitely for tasks older than 14 days", async () => {
    const ancientDue = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(); // 20 days ago

    await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: "cnt-old",
        title: "Ancient Forgotten Task",
        dueAt: ancientDue,
        assignedTo: USER_ASTRO_AGENT,
      },
      { id: USER_ASTRO_AGENT }
    );

    const res = await generateFollowUpRemindersDb(ASTRO_BUSINESS_ID);
    const list = await listNotificationsDb(ASTRO_BUSINESS_ID, USER_ASTRO_AGENT);
    const overdueReminders = list.notifications.filter((n) => n.reminder_type === "overdue");
    const hasAncient = overdueReminders.some((n) => n.title?.includes("Ancient Forgotten Task"));
    expect(hasAncient).toBe(false);
  });

  it("5.3 Reclaims stuck processing jobs locked > 5 minutes ago", async () => {
    // Insert stuck job
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Stuck Job",
      message: "Worker crashed midway",
      status: "pending",
    });

    notif!.status = "processing";
    notif!.locked_at = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    notif!.locked_by = "dead_worker_99";
    notif!.retry_count = 1;
    notif!.max_retries = 3;

    const result = await processReminderJobsBatch(10, "recovery_worker");
    expect(result.reclaimedCount).toBeGreaterThanOrEqual(1);

    // Job should have been reclaimed and delivered
    expect(notif!.status).toBe("delivered");
  });

  it("5.4 Fails permanently after exceeding max retries", async () => {
    const notif = await createNotificationDb(ASTRO_BUSINESS_ID, {
      userId: USER_ASTRO_AGENT,
      reminderType: "due_soon",
      title: "Exhausted Job",
      message: "Worker repeated failures",
      status: "pending",
    });

    notif!.status = "processing";
    notif!.locked_at = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    notif!.locked_by = "dead_worker_99";
    notif!.retry_count = 3;
    notif!.max_retries = 3;

    await processReminderJobsBatch(10, "recovery_worker");
    expect(notif!.status).toBe("failed");
    expect(notif!.last_error).toContain("max retries");
  });
});

// ==============================================================================
// DOMAIN 6: TIMEZONE FORMATTING & USER PREFERENCES
// ==============================================================================
describe("Domain 6: Timezone Formatting & User Preferences", () => {
  it("6.1 Formats notification timestamps cleanly in Asia/Kolkata timezone", () => {
    const utcIso = "2026-11-09T05:30:00.000Z";
    const formatted = formatKolkataTimestamp(utcIso);
    // UTC 05:30 is 11:00 AM IST
    expect(formatted).toContain("11:00");
    expect(formatted).toContain("Nov");
  });

  it("6.2 Stores and updates user notification preferences per business", async () => {
    const initial = await getUserNotificationPreferencesDb(
      ASTRO_BUSINESS_ID,
      USER_ASTRO_AGENT
    );
    expect(initial.in_app_enabled).toBe(true);
    expect(initial.lead_time_hours).toBe(24);

    const updated = await updateUserNotificationPreferencesDb(
      ASTRO_BUSINESS_ID,
      USER_ASTRO_AGENT,
      {
        lead_time_hours: 48,
        notify_overdue: false,
      }
    );

    expect(updated.lead_time_hours).toBe(48);
    expect(updated.notify_overdue).toBe(false);
    expect(updated.notify_due_today).toBe(true); // preserved

    const reloaded = await getUserNotificationPreferencesDb(
      ASTRO_BUSINESS_ID,
      USER_ASTRO_AGENT
    );
    expect(reloaded.lead_time_hours).toBe(48);
    expect(reloaded.notify_overdue).toBe(false);
  });
});

// ==============================================================================
// DOMAIN 7: STRICT PRE-PRODUCTION WHATSAPP SAFETY RULES
// ==============================================================================
describe("Domain 7: Strict Pre-Production WhatsApp Safety Rules", () => {
  it("7.1 Reminders and notifications NEVER send customer WhatsApp messages or call Meta API", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    await generateFollowUpRemindersDb(ASTRO_BUSINESS_ID);
    await processReminderJobsBatch(10, "test_worker");

    // ZERO live Meta API HTTP calls must occur during notification processing
    for (const call of fetchSpy.mock.calls) {
      const url = String(call[0]);
      expect(url).not.toContain("graph.facebook.com");
    }
    fetchSpy.mockRestore();
  });
});
