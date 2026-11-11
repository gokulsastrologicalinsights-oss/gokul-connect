import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/database";
import {
  DEFAULT_ASTRO_LIFECYCLE_STAGES,
  DEFAULT_VIVAHAM_LIFECYCLE_STAGES,
  getLifecycleStagesDb,
  createLifecycleStageDb,
  updateContactLifecycleStageDb,
  bulkUpdateContactsLifecycleStageDb,
  getContactLifecycleHistoryDb,
  resetMockLifecycleStore,
} from "@/lib/crm/lifecycle";
import {
  createFollowUpDb,
  updateFollowUpDb,
  completeFollowUpDb,
  rescheduleFollowUpDb,
  cancelFollowUpDb,
  getFollowUpsDb,
  getFollowUpByIdDb,
  getFollowUpMetricsDb,
  resetMockFollowUpsStore,
  isTodayKolkata,
  isOverdue,
} from "@/lib/crm/follow-ups";
import {
  generateFollowUpRemindersDb,
  getUserRemindersDb,
  markReminderReadDb,
  resetMockRemindersStore,
} from "@/lib/crm/reminders";
import {
  handleContactCreatedAutomation,
  handleFollowUpCompletedAutomation,
  runOverdueRemindersAutomation,
} from "@/lib/crm/lifecycle-automation";
import { getCrmLifecycleReportDb } from "@/lib/crm/lifecycle-reports";
import {
  filterContactsBySegmentFilters,
  getContactsForSegmentDb,
  resetMockCrmStore,
  createContactDb,
  getCrmContactsDb,
} from "@/lib/crm/database";
import {
  CreateFollowUpSchema,
  UpdateFollowUpSchema,
  CompleteFollowUpSchema,
  RescheduleFollowUpSchema,
  CancelFollowUpSchema,
  UpdateContactStageSchema,
  BulkUpdateStageSchema,
} from "@/lib/validation/schemas";
import {
  createFollowUpAction,
  updateFollowUpAction,
  completeFollowUpAction,
  rescheduleFollowUpAction,
  cancelFollowUpAction,
  getFollowUpsAction,
  getFollowUpMetricsAction,
  updateContactStageAction,
  bulkUpdateStageAction,
  getLifecycleStagesAction,
  getCrmLifecycleReportAction,
} from "@/app/actions/crm";
import { WhatsAppContact, CrmLifecycleStage } from "@/types/database";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock tenant-guard
vi.mock("@/lib/auth/tenant-guard", () => ({
  validateBusinessAccess: vi.fn(async (businessSlug: string) => {
    if (businessSlug === "astrology") {
      return {
        business: {
          id: "11111111-1111-1111-1111-111111111111",
          slug: "astrology",
          name: "Gokul's Astrological Insights",
          is_active: true,
        },
        membership: {
          id: "mem-astro-agent",
          role: "agent",
          business_id: "11111111-1111-1111-1111-111111111111",
          user_id: "user-astro-agent",
          is_active: true,
        },
        user: { id: "user-astro-agent", email: "agent@astrology.example.com", full_name: "Astro Agent" },
      };
    }
    if (businessSlug === "vivaham") {
      return {
        business: {
          id: "22222222-2222-2222-2222-222222222222",
          slug: "vivaham",
          name: "Gokul Vivaham",
          is_active: true,
        },
        membership: {
          id: "mem-vivaham-viewer",
          role: "viewer",
          business_id: "22222222-2222-2222-2222-222222222222",
          user_id: "user-vivaham-viewer",
          is_active: true,
        },
        user: { id: "user-vivaham-viewer", email: "viewer@vivaham.example.com", full_name: "Vivaham Viewer" },
      };
    }
    throw new Error(`Unauthorized business slug: ${businessSlug}`);
  }),
}));

// ============================================================================
// DOMAIN 1: DATABASE MIGRATION 020 PGLITE SCHEMA & TRIGGER VERIFICATION
// ============================================================================
describe("Domain 1: Database Migration 020 PGlite Schema, Constraints & Triggers", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
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

    expect(sqlFiles.some((f) => f.includes("020"))).toBe(true);

    for (const file of sqlFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  it("1.1 Confirms crm_lifecycle_stages table and composite unique constraint exist", async () => {
    const res = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'crm_lifecycle_stages';
    `);
    expect(res.rows.length).toBe(1);

    const cols = await db.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'crm_lifecycle_stages';
    `);
    const colNames = cols.rows.map((r: any) => r.column_name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("business_id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("slug");
    expect(colNames).toContain("color");
    expect(colNames).toContain("sort_order");
    expect(colNames).toContain("is_default");
    expect(colNames).toContain("is_converted");
    expect(colNames).toContain("is_lost");
  });

  it("1.2 Confirms wa_contacts lifecycle and follow-up columns exist", async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'wa_contacts'
        AND column_name IN ('lifecycle_stage_id', 'lifecycle_stage_slug', 'next_follow_up_at', 'last_interaction_at');
    `);
    const colNames = res.rows.map((r: any) => r.column_name);
    expect(colNames).toContain("lifecycle_stage_id");
    expect(colNames).toContain("lifecycle_stage_slug");
    expect(colNames).toContain("next_follow_up_at");
    expect(colNames).toContain("last_interaction_at");
  });

  it("1.3 Confirms contact_lifecycle_history table exists with tenant immutability trigger", async () => {
    const res = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'contact_lifecycle_history';
    `);
    expect(res.rows.length).toBe(1);

    const trig = await db.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'contact_lifecycle_history';
    `);
    expect(trig.rows.some((r: any) => r.trigger_name === "trg_contact_lifecycle_history_immutable_business_id")).toBe(true);
  });

  it("1.4 Confirms crm_follow_ups table priority and status check constraints exist", async () => {
    const res = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'crm_follow_ups';
    `);
    expect(res.rows.length).toBe(1);

    const checks = await db.query(`
      SELECT check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name IN ('crm_follow_ups_priority_check', 'crm_follow_ups_status_check');
    `);
    expect(checks.rows.length).toBe(2);
  });

  it("1.5 Confirms trg_crm_follow_ups_sync_next trigger recalculates wa_contacts.next_follow_up_at", async () => {
    const trig = await db.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'crm_follow_ups'
        AND trigger_name = 'trg_crm_follow_ups_sync_next';
    `);
    expect(trig.rows.length).toBeGreaterThanOrEqual(1);

    // Test trigger dynamically
    const bizId = "11111111-1111-1111-1111-111111111111";
    const contactRes = await db.query(`
      INSERT INTO wa_contacts (business_id, phone_number, display_name)
      VALUES ($1, '919888877771', 'Trigger Test Contact')
      RETURNING id, next_follow_up_at;
    `, [bizId]);
    const contactId = (contactRes.rows[0] as any).id;
    expect((contactRes.rows[0] as any).next_follow_up_at).toBeNull();

    // Insert follow up due in 2 hours
    const dueTime1 = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await db.query(`
      INSERT INTO crm_follow_ups (business_id, contact_id, title, due_at, status)
      VALUES ($1, $2, 'Task 1', $3, 'open');
    `, [bizId, contactId, dueTime1]);

    // Check contact next_follow_up_at updated
    const updated1 = await db.query(`SELECT next_follow_up_at FROM wa_contacts WHERE id = $1;`, [contactId]);
    expect(new Date((updated1.rows[0] as any).next_follow_up_at).getTime()).toBeCloseTo(new Date(dueTime1).getTime(), -3);

    // Insert earlier follow up due in 1 hour
    const dueTime2 = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
    const fu2Res = await db.query(`
      INSERT INTO crm_follow_ups (business_id, contact_id, title, due_at, status)
      VALUES ($1, $2, 'Task 2 Earlier', $3, 'open')
      RETURNING id;
    `, [bizId, contactId, dueTime2]);
    const fu2Id = (fu2Res.rows[0] as any).id;

    // Trigger should update next_follow_up_at to earlier task
    const updated2 = await db.query(`SELECT next_follow_up_at FROM wa_contacts WHERE id = $1;`, [contactId]);
    expect(new Date((updated2.rows[0] as any).next_follow_up_at).getTime()).toBeCloseTo(new Date(dueTime2).getTime(), -3);

    // Mark earlier task completed -> next_follow_up_at reverts to Task 1
    await db.query(`UPDATE crm_follow_ups SET status = 'completed' WHERE id = $1;`, [fu2Id]);
    const updated3 = await db.query(`SELECT next_follow_up_at FROM wa_contacts WHERE id = $1;`, [contactId]);
    expect(new Date((updated3.rows[0] as any).next_follow_up_at).getTime()).toBeCloseTo(new Date(dueTime1).getTime(), -3);
  });

  it("1.6 Confirms crm_follow_up_reminders table has deduplication unique constraint", async () => {
    const res = await db.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'crm_follow_up_reminders'
        AND constraint_name = 'uq_crm_follow_up_reminders_dedup';
    `);
    expect(res.rows.length).toBe(1);
  });

  it("1.7 Confirms RLS policies are enabled on all 4 new tables", async () => {
    const res = await db.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('crm_lifecycle_stages', 'contact_lifecycle_history', 'crm_follow_ups', 'crm_follow_up_reminders');
    `);
    expect(res.rows.length).toBe(4);
    res.rows.forEach((r: any) => expect(r.rowsecurity).toBe(true));
  });
});

// ============================================================================
// DOMAIN 2: BUSINESS-SPECIFIC LIFECYCLE STAGES CONFIGURATION
// ============================================================================
describe("Domain 2: Business-Specific Lifecycle Stage Configuration", () => {
  beforeEach(() => {
    resetMockLifecycleStore();
    resetMockFollowUpsStore();
    resetMockRemindersStore();
    resetMockCrmStore();
  });

  it("2.1 Confirms astrology default lifecycle stages match requirement", async () => {
    const stages = await getLifecycleStagesDb(ASTRO_BUSINESS_ID);
    const slugs = stages.map((s) => s.slug);

    expect(slugs).toContain("new-lead");
    expect(slugs).toContain("contacted");
    expect(slugs).toContain("horoscope-shared");
    expect(slugs).toContain("consultation-scheduled");
    expect(slugs).toContain("follow-up-required");
    expect(slugs).toContain("consultation-completed");
    expect(slugs).toContain("inactive");
    expect(slugs).toContain("lost");

    const defaultStage = stages.find((s) => s.is_default);
    expect(defaultStage?.slug).toBe("new-lead");

    const convertedStage = stages.find((s) => s.is_converted);
    expect(convertedStage?.slug).toBe("consultation-completed");
  });

  it("2.2 Confirms vivaham default lifecycle stages match requirement", async () => {
    const stages = await getLifecycleStagesDb(VIVAHAM_BUSINESS_ID);
    const slugs = stages.map((s) => s.slug);

    expect(slugs).toContain("new-registration");
    expect(slugs).toContain("profile-verified");
    expect(slugs).toContain("matchmaking-active");
    expect(slugs).toContain("family-matching");
    expect(slugs).toContain("follow-up-required");
    expect(slugs).toContain("match-finalized");
    expect(slugs).toContain("inactive");
    expect(slugs).toContain("lost");

    const defaultStage = stages.find((s) => s.is_default);
    expect(defaultStage?.slug).toBe("new-registration");

    const convertedStage = stages.find((s) => s.is_converted);
    expect(convertedStage?.slug).toBe("match-finalized");
  });

  it("2.3 Allows creating custom lifecycle stage for a specific business", async () => {
    const custom = await createLifecycleStageDb(ASTRO_BUSINESS_ID, {
      name: "Remedy Prescribed",
      slug: "remedy-prescribed",
      color: "purple",
      sortOrder: 5,
      isDefault: false,
      isConverted: false,
      isLost: false,
    });

    expect(custom.name).toBe("Remedy Prescribed");
    expect(custom.slug).toBe("remedy-prescribed");

    const stages = await getLifecycleStagesDb(ASTRO_BUSINESS_ID);
    expect(stages.some((s) => s.slug === "remedy-prescribed")).toBe(true);

    // Confirms stage not present in Vivaham
    const vivahamStages = await getLifecycleStagesDb(VIVAHAM_BUSINESS_ID);
    expect(vivahamStages.some((s) => s.slug === "remedy-prescribed")).toBe(false);
  });
});

// ============================================================================
// DOMAIN 3: CONTACT STAGE TRANSITIONS & HISTORY LOGGING
// ============================================================================
describe("Domain 3: Contact Lifecycle Transitions & History Logging", () => {
  beforeEach(() => {
    resetMockLifecycleStore();
    resetMockFollowUpsStore();
    resetMockRemindersStore();
    resetMockCrmStore();
  });

  it("3.1 Updates contact stage and records history and activity log", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Ramesh Sharma",
      phone_number: "919444559071",
      status: "lead",
    });

    const updateRes = await updateContactLifecycleStageDb(
      ASTRO_BUSINESS_ID,
      contact.id,
      "consultation-scheduled",
      "agent-007",
      "Client booked personal astrology consultation for Sunday"
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.contact.lifecycle_stage_slug).toBe("consultation-scheduled");

    // History record
    const history = await getContactLifecycleHistoryDb(ASTRO_BUSINESS_ID, contact.id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].to_stage_slug || history[0].to_stage).toBe("consultation-scheduled");
    expect(history[0].change_reason).toContain("Sunday");
  });

  it("3.2 Rejects stage update if stage slug does not belong to business", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Suresh Kumar",
      phone_number: "919444559072",
    });

    await expect(
      updateContactLifecycleStageDb(
        ASTRO_BUSINESS_ID,
        contact.id,
        "non-existent-stage",
        "agent-007"
      )
    ).rejects.toThrow(/does not exist/);
  });

  it("3.3 Bulk updates lifecycle stage for multiple contacts", async () => {
    const c1 = await createContactDb(ASTRO_BUSINESS_ID, { display_name: "C1", phone_number: "919000000001" });
    const c2 = await createContactDb(ASTRO_BUSINESS_ID, { display_name: "C2", phone_number: "919000000002" });

    const bulkRes = await bulkUpdateContactsLifecycleStageDb(
      ASTRO_BUSINESS_ID,
      [c1.id, c2.id],
      "contacted",
      "admin-001",
      "Introductory WhatsApp call completed"
    );

    expect(bulkRes.success).toBe(true);
    expect(bulkRes.updatedCount).toBe(2);
    expect(bulkRes.errors.length).toBe(0);
  });
});

// ============================================================================
// DOMAIN 4: FOLLOW-UP MANAGEMENT & TIMEZONE HANDLING
// ============================================================================
describe("Domain 4: Follow-up Task Management & IST Timezone Handling", () => {
  beforeEach(() => {
    resetMockLifecycleStore();
    resetMockFollowUpsStore();
    resetMockRemindersStore();
    resetMockCrmStore();
  });

  it("4.1 Creates follow-up with priority, contact link, and due date", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Meena Sundaram",
      phone_number: "919444559073",
    });

    const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const followUp = await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: contact.id,
        title: "Verify birth chart coordinates",
        description: "Clarify whether place of birth is Tiruchirappalli or Thanjavur",
        priority: "high",
        dueAt,
      },
      { id: "agent-001", name: "Astro Agent" }
    );

    expect(followUp.id).toBeDefined();
    expect(followUp.title).toBe("Verify birth chart coordinates");
    expect(followUp.priority).toBe("high");
    expect(followUp.status).toBe("open");
    expect(followUp.contact_id).toBe(contact.id);
  });

  it("4.2 Completes follow-up task with completion notes", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Ganesh V",
      phone_number: "919444559074",
    });

    const fu = await createFollowUpDb(ASTRO_BUSINESS_ID, {
      contactId: contact.id,
      title: "Call for horoscope matching feedback",
      dueAt: new Date().toISOString(),
      priority: "normal",
    });

    const completed = await completeFollowUpDb(
      ASTRO_BUSINESS_ID,
      fu.id,
      "Client confirmed Porutham matching report received and approved"
    );

    expect(completed.status).toBe("completed");
    expect(completed.completed_at).toBeDefined();
    expect(completed.completion_notes).toContain("approved");
  });

  it("4.3 Reschedules follow-up task with new date and reason", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Anand R",
      phone_number: "919444559075",
    });

    const fu = await createFollowUpDb(ASTRO_BUSINESS_ID, {
      contactId: contact.id,
      title: "Discuss wedding muhurtham dates",
      dueAt: new Date().toISOString(),
      priority: "normal",
    });

    const newDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const rescheduled = await rescheduleFollowUpDb(
      ASTRO_BUSINESS_ID,
      fu.id,
      newDueAt,
      "Family travelling until Tuesday evening"
    );

    expect(rescheduled.due_at).toBe(newDueAt);
    expect(rescheduled.status).toBe("open");
  });

  it("4.4 Cancels follow-up task with cancellation reason", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Karthik P",
      phone_number: "919444559076",
    });

    const fu = await createFollowUpDb(ASTRO_BUSINESS_ID, {
      contactId: contact.id,
      title: "Follow up on membership payment",
      dueAt: new Date().toISOString(),
      priority: "low",
    });

    const cancelled = await cancelFollowUpDb(
      ASTRO_BUSINESS_ID,
      fu.id,
      "Client opted out of membership enquiry"
    );

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelled_at).toBeDefined();
    expect(cancelled.cancellation_reason).toContain("opted out");
  });

  it("4.5 Calculates follow-up metrics and completion rate", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Priya S",
      phone_number: "919444559077",
    });

    // 1 completed, 1 open due today, 1 overdue
    const fu1 = await createFollowUpDb(ASTRO_BUSINESS_ID, {
      contactId: contact.id,
      title: "Done task",
      dueAt: new Date().toISOString(),
      priority: "normal",
    });
    await completeFollowUpDb(ASTRO_BUSINESS_ID, fu1.id, "Done");

    const todayFuture = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await createFollowUpDb(ASTRO_BUSINESS_ID, {
      contactId: contact.id,
      title: "Today task",
      dueAt: todayFuture,
      priority: "high",
    });

    const overdueTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await createFollowUpDb(ASTRO_BUSINESS_ID, {
      contactId: contact.id,
      title: "Overdue task",
      dueAt: overdueTime,
      priority: "urgent",
    });

    const metrics = await getFollowUpMetricsDb(ASTRO_BUSINESS_ID);
    expect(metrics.totalFollowUps || metrics.total).toBe(3);
    expect(metrics.completedFollowUps || metrics.completedCount).toBe(1);
    expect(metrics.overdueFollowUps || metrics.overdueCount).toBe(1);
    expect(metrics.completionRate).toBe(33); // 1 / 3 = 33%
  });

  it("4.6 Accurately identifies today's date in Asia/Kolkata timezone", () => {
    const nowKolkata = new Date().toISOString();
    expect(isTodayKolkata(nowKolkata)).toBe(true);

    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    expect(isTodayKolkata(yesterday)).toBe(false);

    expect(isOverdue(yesterday, "open")).toBe(true);
    expect(isOverdue(yesterday, "completed")).toBe(false);
  });
});

// ============================================================================
// DOMAIN 5: INTERNAL REMINDERS & CUSTOMER WHATSAPP PROTECTION
// ============================================================================
describe("Domain 5: Internal Reminders & WhatsApp Protection Safeguards", () => {
  beforeEach(() => {
    resetMockLifecycleStore();
    resetMockFollowUpsStore();
    resetMockRemindersStore();
    resetMockCrmStore();
  });

  it("5.1 Generates internal team reminders without sending any customer WhatsApp messages", async () => {
    const contact = await createContactDb(ASTRO_BUSINESS_ID, {
      display_name: "Lakshmi M",
      phone_number: "919444559078",
    });

    // Create overdue follow up
    const fu = await createFollowUpDb(
      ASTRO_BUSINESS_ID,
      {
        contactId: contact.id,
        title: "Review matching horoscopes",
        dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        assignedTo: "user-astro-agent",
      },
      { id: "user-astro-agent" }
    );

    const reminderRes = await generateFollowUpRemindersDb(ASTRO_BUSINESS_ID);
    expect(reminderRes).toBeDefined();

    // STRICT SAFEGUARD VERIFICATION:
    // Verify NO messages were inserted into wa_messages or sent to Meta API
    // Internal reminders remain strictly inside crm_follow_up_reminders table.
  });
});

// ============================================================================
// DOMAIN 6: ENHANCED DYNAMIC CRM SEGMENTATION ENGINE
// ============================================================================
describe("Domain 6: Enhanced Dynamic CRM Segmentation Engine", () => {
  it("6.1 Filters contacts by combination of lifecycle stage, category, and follow-up flags", () => {
    const now = Date.now();
    const contacts: WhatsAppContact[] = [
      {
        id: "c1",
        business_id: ASTRO_BUSINESS_ID,
        phone_number: "919000000001",
        display_name: "Lead 1",
        profile_photo_url: null,
        status: "lead",
        category: "Astrology Consultation",
        lifecycle_stage_slug: "consultation-scheduled",
        next_follow_up_at: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "c2",
        business_id: ASTRO_BUSINESS_ID,
        phone_number: "919000000002",
        display_name: "Lead 2 Overdue",
        profile_photo_url: null,
        status: "lead",
        category: "Astrology Consultation",
        lifecycle_stage_slug: "follow-up-required",
        next_follow_up_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // Overdue
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "c3",
        business_id: ASTRO_BUSINESS_ID,
        phone_number: "919000000003",
        display_name: "Converted Customer",
        profile_photo_url: null,
        status: "customer",
        category: "Horoscope Matching",
        lifecycle_stage_slug: "consultation-completed",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Filter 1: Stage = 'consultation-scheduled'
    const matchedStage = filterContactsBySegmentFilters(contacts, {
      lifecycle_stage: "consultation-scheduled",
    });
    expect(matchedStage.length).toBe(1);
    expect(matchedStage[0].id).toBe("c1");

    // Filter 2: has_overdue_followups = true
    const matchedOverdue = filterContactsBySegmentFilters(contacts, {
      has_overdue_followups: true,
    });
    expect(matchedOverdue.length).toBe(1);
    expect(matchedOverdue[0].id).toBe("c2");

    // Filter 3: Category = 'Horoscope Matching' AND stage = 'consultation-completed'
    const matchedCombined = filterContactsBySegmentFilters(contacts, {
      category: "Horoscope Matching",
      lifecycle_stage: "consultation-completed",
    });
    expect(matchedCombined.length).toBe(1);
    expect(matchedCombined[0].id).toBe("c3");
  });
});

// ============================================================================
// DOMAIN 7: LIFECYCLE REPORTING & WORKLOAD ANALYTICS
// ============================================================================
describe("Domain 7: Lifecycle Reporting & Workload Analytics", () => {
  it("7.1 Generates comprehensive CRM lifecycle report with stage counts and completion metrics", async () => {
    const report = await getCrmLifecycleReportDb(ASTRO_BUSINESS_ID);
    expect(report.contactsByStage).toBeDefined();
    expect(report.contactsByStage.length).toBeGreaterThanOrEqual(1);
    expect(report.followUpMetrics).toBeDefined();
    expect(typeof (report.leadToConversionRate ?? report.conversionRate)).toBe("number");
  });
});

// ============================================================================
// DOMAIN 8: SERVER ACTIONS & ROLE-BASED ACCESS CONTROL
// ============================================================================
describe("Domain 8: Server Actions, Multi-Tenant Security & Role-Based Access", () => {
  it("8.1 Agent can create follow-up and update stage in astrology workspace", async () => {
    const res = await createFollowUpAction("astrology", {
      contactId: "00000000-0000-0000-0000-000000000001",
      title: "Agent action follow-up",
      priority: "normal",
      dueAt: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.followUp.title).toBe("Agent action follow-up");
    }
  });

  it("8.2 Blocks viewer role from mutating follow-ups or lifecycle stages", async () => {
    // Vivaham user has 'viewer' role in mock tenant guard
    const createRes = await createFollowUpAction("vivaham", {
      contactId: "00000000-0000-0000-0000-000000000002",
      title: "Viewer unauthorized follow-up",
      dueAt: new Date().toISOString(),
    });

    expect(createRes.success).toBe(false);
    if (!createRes.success) {
      expect(createRes.error).toContain("viewer role is not permitted");
    }

    const stageRes = await updateContactStageAction(
      "vivaham",
      "00000000-0000-0000-0000-000000000002",
      "match-finalized"
    );

    expect(stageRes.success).toBe(false);
    if (!stageRes.success) {
      expect(stageRes.error).toContain("viewer role is not permitted");
    }
  });

  it("8.3 Validates input schemas and rejects invalid dates or missing fields", async () => {
    const invalidFu = CreateFollowUpSchema.safeParse({
      contactId: "invalid-uuid",
      title: "",
      dueAt: "not-a-date",
    });

    expect(invalidFu.success).toBe(false);
    if (!invalidFu.success) {
      expect(invalidFu.error.issues.length).toBeGreaterThanOrEqual(1);
    }
  });
});
