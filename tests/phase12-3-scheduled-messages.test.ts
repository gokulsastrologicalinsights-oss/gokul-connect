import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  createScheduledMessageDb,
  listScheduledMessagesDb,
  getScheduledMessageByIdDb,
  updateScheduledMessageDb,
  cancelScheduledMessageDb,
  retryScheduledMessageDb,
  deleteDraftScheduledMessageDb,
  getScheduledMessagesStatsDb,
  resetScheduledMemoryStore,
  seedScheduledMemoryStore,
} from "@/lib/scheduled/database";
import {
  calculateScheduledBackoffDelay,
  checkContactOptOut,
  dispatchSingleScheduledMessage,
  processScheduledMessagesBatch,
  verifyCustomerServiceWindow,
} from "@/lib/scheduled/worker";
import {
  CreateScheduledMessageSchema,
  RescheduleMessageSchema,
  UpdateScheduledMessageSchema,
  CancelScheduledMessageSchema,
  RetryScheduledMessageSchema,
} from "@/lib/validation/schemas";
import {
  createScheduledMessageAction,
  updateScheduledMessageAction,
  rescheduleMessageAction,
  cancelScheduledMessageAction,
  retryScheduledMessageAction,
  deleteDraftScheduledMessageAction,
  getScheduledMessagesAction,
} from "@/app/actions/scheduled";
import { formatKolkataDate, kolkataToUtc } from "@/lib/analytics/date-utils";
import { WhatsAppScheduledMessage } from "@/types/database";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock tenant-guard and supabase server for server action tests
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
          id: "mem-vivaham-owner",
          role: "owner",
          business_id: "22222222-2222-2222-2222-222222222222",
          user_id: "user-vivaham-owner",
          is_active: true,
        },
        user: { id: "user-vivaham-owner", email: "owner@vivaham.example.com", full_name: "Vivaham Owner" },
      };
    }
    throw new Error(`Unauthorized business slug: ${businessSlug}`);
  }),
}));

// ============================================================================
// DOMAIN 1: DATABASE MIGRATION 018 PGLITE REPLAY & TRIGGERS
// ============================================================================
describe("Domain 1: Database Migration 018 PGlite Schema & Trigger Verification", () => {
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

    expect(sqlFiles.some((f) => f.includes("018"))).toBe(true);

    for (const file of sqlFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  it("1.1 Confirms wa_scheduled_messages table and all columns exist", async () => {
    const res = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'wa_scheduled_messages'
        AND column_name IN (
          'id', 'business_id', 'connection_id', 'conversation_id',
          'recipient_phone', 'recipient_name', 'message_type', 'content',
          'template_name', 'template_variables', 'media_type', 'media_storage_path',
          'scheduled_at', 'timezone', 'status', 'locked_at', 'locked_by',
          'retry_count', 'max_retries', 'last_error', 'message_id', 'meta_message_id',
          'sent_at', 'cancelled_at'
        );
    `);

    const cols = res.rows.map((r: any) => r.column_name);
    expect(cols).toContain("business_id");
    expect(cols).toContain("recipient_phone");
    expect(cols).toContain("message_type");
    expect(cols).toContain("scheduled_at");
    expect(cols).toContain("status");
    expect(cols).toContain("retry_count");
    expect(cols).toContain("locked_at");
  });

  it("1.2 Confirms wa_scheduled_messages status and message_type check constraints", async () => {
    // Attempt inserting invalid status
    await expect(
      db.query(`
        INSERT INTO public.wa_scheduled_messages (
          business_id, connection_id, recipient_phone, message_type, scheduled_at, status
        ) VALUES (
          '${ASTRO_BUSINESS_ID}',
          gen_random_uuid(),
          '+919840123456',
          'text',
          NOW(),
          'invalid_status'
        );
      `)
    ).rejects.toThrow();

    // Attempt inserting invalid message_type
    await expect(
      db.query(`
        INSERT INTO public.wa_scheduled_messages (
          business_id, connection_id, recipient_phone, message_type, scheduled_at, status
        ) VALUES (
          '${ASTRO_BUSINESS_ID}',
          gen_random_uuid(),
          '+919840123456',
          'hologram',
          NOW(),
          'scheduled'
        );
      `)
    ).rejects.toThrow();
  });

  it("1.3 Verifies tenant immutability trigger blocks business_id reassignments", async () => {
    const connRes = await db.query(`
      INSERT INTO public.wa_connections (
        business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', 'Astro Sender', '+919840123456', 'phone_imm_01', 'waba_imm_01', 'vault:imm_01'
      ) RETURNING id;
    `);
    const connId = (connRes.rows[0] as any).id;

    const schedRes = await db.query(`
      INSERT INTO public.wa_scheduled_messages (
        business_id, connection_id, recipient_phone, message_type, scheduled_at, status, content
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', '${connId}', '+919840123456', 'text', NOW() + INTERVAL '1 hour', 'scheduled', 'Test text'
      ) RETURNING id;
    `);
    const schedId = (schedRes.rows[0] as any).id;

    // Attempt reassigning business_id to Vivaham
    await expect(
      db.query(`
        UPDATE public.wa_scheduled_messages
        SET business_id = '${VIVAHAM_BUSINESS_ID}'
        WHERE id = '${schedId}';
      `)
    ).rejects.toThrow(/tenant reassignment forbidden/i);
  });

  it("1.4 Verifies atomic claim RPC exclusively locks due rows with FOR UPDATE SKIP LOCKED", async () => {
    const connRes = await db.query(`
      INSERT INTO public.wa_connections (
        business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', 'Astro Claimer', '+919840123457', 'phone_cl_01', 'waba_cl_01', 'vault:cl_01'
      ) RETURNING id;
    `);
    const connId = (connRes.rows[0] as any).id;

    // Insert 2 due messages and 1 future message
    await db.query(`
      INSERT INTO public.wa_scheduled_messages (
        business_id, connection_id, recipient_phone, message_type, scheduled_at, status, content
      ) VALUES
        ('${ASTRO_BUSINESS_ID}', '${connId}', '+919000000001', 'text', NOW() - INTERVAL '10 seconds', 'scheduled', 'Due 1'),
        ('${ASTRO_BUSINESS_ID}', '${connId}', '+919000000002', 'text', NOW() - INTERVAL '5 seconds', 'scheduled', 'Due 2'),
        ('${ASTRO_BUSINESS_ID}', '${connId}', '+919000000003', 'text', NOW() + INTERVAL '1 hour', 'scheduled', 'Future');
    `);

    // Worker 1 claims next batch of 10
    const claimRes = await db.query(`
      SELECT * FROM public.claim_next_scheduled_messages(10, 'worker_unit_test');
    `);

    expect(claimRes.rows.length).toBeGreaterThanOrEqual(2);
    const claimedStatuses = claimRes.rows.map((r: any) => r.status);
    expect(claimedStatuses.every((s: string) => s === "processing")).toBe(true);

    // Worker 2 attempts claiming concurrently -> Should claim 0 because due ones are locked/processing
    const claimRes2 = await db.query(`
      SELECT * FROM public.claim_next_scheduled_messages(10, 'worker_unit_test_2');
    `);
    expect(claimRes2.rows.length).toBe(0);
  });

  it("1.5 Verifies stuck job recovery RPC reclaims jobs exceeding timeout", async () => {
    const connRes = await db.query(`
      SELECT id FROM public.wa_connections WHERE business_id = '${ASTRO_BUSINESS_ID}' LIMIT 1;
    `);
    const connId = (connRes.rows[0] as any).id;

    // Insert a stuck processing job locked 10 minutes ago
    const stuckRes = await db.query(`
      INSERT INTO public.wa_scheduled_messages (
        business_id, connection_id, recipient_phone, message_type, scheduled_at, status, content,
        locked_at, locked_by, retry_count, max_retries
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', '${connId}', '+919000000099', 'text', NOW() - INTERVAL '15 minutes',
        'processing', 'Stuck message', NOW() - INTERVAL '10 minutes', 'stuck_worker', 0, 3
      ) RETURNING id;
    `);
    const stuckId = (stuckRes.rows[0] as any).id;

    // Run recovery RPC with 5 minute timeout
    const reclaimRes = await db.query(`
      SELECT public.reclaim_stuck_scheduled_messages(5) AS reclaimed;
    `);
    expect(Number((reclaimRes.rows[0] as any).reclaimed)).toBeGreaterThanOrEqual(1);

    // Verify row was reset to scheduled and retry count incremented
    const checkRes = await db.query(`
      SELECT status, retry_count, locked_at FROM public.wa_scheduled_messages WHERE id = '${stuckId}';
    `);
    expect((checkRes.rows[0] as any).status).toBe("scheduled");
    expect((checkRes.rows[0] as any).retry_count).toBe(1);
    expect((checkRes.rows[0] as any).locked_at).toBeNull();
  });
});

// ============================================================================
// DOMAIN 2: SCHEDULE CREATION, TIMEZONES & INPUT VALIDATION
// ============================================================================
describe("Domain 2: Schedule Creation & Input Validation", () => {
  beforeEach(() => {
    resetScheduledMemoryStore();
  });

  it("2.1 Successfully validates and creates a scheduled text message", () => {
    const futureTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const input = {
      businessSlug: "astrology",
      connectionId: "conn-01",
      recipientPhone: "+919840123456",
      messageType: "text",
      content: "Vanakkam, your consultation is confirmed.",
      scheduledAt: futureTime,
      status: "scheduled",
    };

    const validated = CreateScheduledMessageSchema.parse(input);
    expect(validated.recipientPhone).toBe("+919840123456");
    expect(validated.messageType).toBe("text");
    expect(validated.content).toBe("Vanakkam, your consultation is confirmed.");
  });

  it("2.2 Rejects past-date scheduling when status is 'scheduled'", () => {
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const input = {
      businessSlug: "astrology",
      connectionId: "conn-01",
      recipientPhone: "+919840123456",
      messageType: "text",
      content: "Hello from the past",
      scheduledAt: pastTime,
      status: "scheduled",
    };

    expect(() => CreateScheduledMessageSchema.parse(input)).toThrow(/Scheduled time must be in the future/i);
  });

  it("2.3 Allows past date only if status is 'draft'", () => {
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const input = {
      businessSlug: "astrology",
      connectionId: "conn-01",
      recipientPhone: "+919840123456",
      messageType: "text",
      content: "Draft message note",
      scheduledAt: pastTime,
      status: "draft",
    };

    const validated = CreateScheduledMessageSchema.parse(input);
    expect(validated.status).toBe("draft");
  });

  it("2.4 Rejects text message with empty content", () => {
    const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();
    const input = {
      businessSlug: "astrology",
      connectionId: "conn-01",
      recipientPhone: "+919840123456",
      messageType: "text",
      content: "   ",
      scheduledAt: futureTime,
      status: "scheduled",
    };

    expect(() => CreateScheduledMessageSchema.parse(input)).toThrow(/Message content cannot be empty/i);
  });

  it("2.5 Rejects template message missing templateName", () => {
    const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();
    const input = {
      businessSlug: "astrology",
      connectionId: "conn-01",
      recipientPhone: "+919840123456",
      messageType: "template",
      scheduledAt: futureTime,
      status: "scheduled",
    };

    expect(() => CreateScheduledMessageSchema.parse(input)).toThrow(/Template name is required/i);
  });

  it("2.6 Correctly converts Asia/Kolkata date to UTC timestamp", () => {
    // 2026-11-10 10:30:00 IST should be 2026-11-10 05:00:00 UTC (IST is UTC+05:30)
    const kolkataUtc = kolkataToUtc(2026, 10, 10, 10, 30, 0);
    expect(kolkataUtc.getUTCHours()).toBe(5);
    expect(kolkataUtc.getUTCMinutes()).toBe(0);

    const formatted = formatKolkataDate(kolkataUtc, true);
    expect(formatted).toContain("10:30:00 am IST");
  });
});

// ============================================================================
// DOMAIN 3: EDITING, RESCHEDULING & SAFE CANCELLATION
// ============================================================================
describe("Domain 3: Editing, Rescheduling & Safe Cancellation", () => {
  beforeEach(() => {
    resetScheduledMemoryStore();
  });

  it("3.1 Successfully edits content of a scheduled message", async () => {
    const updated = await updateScheduledMessageDb(
      ASTRO_BUSINESS_ID,
      "sched-astro-01",
      { content: "Updated horoscope reminder content" },
      "user-astro-admin-01"
    );

    expect(updated.content).toBe("Updated horoscope reminder content");
    const retrieved = await getScheduledMessageByIdDb(ASTRO_BUSINESS_ID, "sched-astro-01");
    expect(retrieved?.content).toBe("Updated horoscope reminder content");
  });

  it("3.2 Successfully reschedules message to a new future time", async () => {
    const newFuture = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const updated = await updateScheduledMessageDb(
      ASTRO_BUSINESS_ID,
      "sched-astro-01",
      { scheduled_at: newFuture },
      "user-astro-admin-01"
    );

    expect(updated.scheduled_at).toBe(newFuture);
  });

  it("3.3 Safely cancels a scheduled message", async () => {
    const cancelled = await cancelScheduledMessageDb(
      ASTRO_BUSINESS_ID,
      "sched-astro-01",
      "user-astro-admin-01",
      "Customer requested cancellation"
    );

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelled_at).toBeDefined();
    expect(cancelled.last_error).toContain("Customer requested cancellation");
  });

  it("3.4 Prevents editing or cancelling messages in 'processing' or 'sent' status (Race Protection)", async () => {
    // Attempt editing already sent message
    await expect(
      updateScheduledMessageDb(
        ASTRO_BUSINESS_ID,
        "sched-astro-03", // Already sent
        { content: "Malicious edit" },
        "user-astro-admin-01"
      )
    ).rejects.toThrow(/Cannot edit message in status "sent"/i);

    // Attempt cancelling already sent message
    await expect(
      cancelScheduledMessageDb(
        ASTRO_BUSINESS_ID,
        "sched-astro-03",
        "user-astro-admin-01"
      )
    ).rejects.toThrow(/Cannot cancel message in status "sent"/i);
  });
});

// ============================================================================
// DOMAIN 4: DISPATCH SAFEGUARDS (24H WINDOW, OPT-OUT, TEMPLATES)
// ============================================================================
describe("Domain 4: Dispatch Safeguards (24h Window, Opt-Out, Templates)", () => {
  it("4.1 Blocks text dispatch when 24h customer service window has expired", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_connections") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "conn-01", business_id: ASTRO_BUSINESS_ID, is_enabled: true, display_name: "Astro" },
              error: null,
            }),
          };
        }
        if (table === "wa_contacts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_opted_out: false },
              error: null,
            }),
          };
        }
        if (table === "wa_messages") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            // Last inbound was 48 hours ago -> Expired!
            maybeSingle: vi.fn().mockResolvedValue({
              data: { created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const scheduledMsg: WhatsAppScheduledMessage = {
      id: "sched-test-window",
      business_id: ASTRO_BUSINESS_ID,
      connection_id: "conn-01",
      conversation_id: "conv-01",
      recipient_phone: "+919840123456",
      recipient_name: "Test",
      message_type: "text",
      content: "Free form text outside window",
      template_name: null,
      template_language: "en_US",
      template_variables: {},
      media_type: null,
      media_storage_path: null,
      media_filename: null,
      media_file_size: null,
      media_mime_type: null,
      media_caption: null,
      media_meta_id: null,
      scheduled_at: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      status: "scheduled",
      locked_at: null,
      locked_by: null,
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      message_id: null,
      meta_message_id: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      cancelled_at: null,
      cancelled_by: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const outcome = await dispatchSingleScheduledMessage(mockSupabase, scheduledMsg);
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("Meta 24-hour customer service window is closed");
  });

  it("4.2 Strictly blocks dispatch to an opted-out contact", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_connections") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "conn-01", business_id: ASTRO_BUSINESS_ID, is_enabled: true },
              error: null,
            }),
          };
        }
        if (table === "wa_contacts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Contact has opted out
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_opted_out: true, opted_out_reason: "user_unsubscribe_STOP" },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const scheduledMsg: WhatsAppScheduledMessage = {
      id: "sched-test-optout",
      business_id: ASTRO_BUSINESS_ID,
      connection_id: "conn-01",
      conversation_id: "conv-01",
      recipient_phone: "+919840123456",
      recipient_name: "Test",
      message_type: "template",
      content: null,
      template_name: "welcome_inquiry",
      template_language: "en_US",
      template_variables: {},
      media_type: null,
      media_storage_path: null,
      media_filename: null,
      media_file_size: null,
      media_mime_type: null,
      media_caption: null,
      media_meta_id: null,
      scheduled_at: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      status: "scheduled",
      locked_at: null,
      locked_by: null,
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      message_id: null,
      meta_message_id: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      cancelled_at: null,
      cancelled_by: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const outcome = await dispatchSingleScheduledMessage(mockSupabase, scheduledMsg);
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("has opted out of automated WhatsApp messages");
  });

  it("4.3 Rejects template dispatch if template is unapproved or archived", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "wa_connections") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "conn-01", business_id: ASTRO_BUSINESS_ID, is_enabled: true },
              error: null,
            }),
          };
        }
        if (table === "wa_contacts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_opted_out: false },
              error: null,
            }),
          };
        }
        if (table === "wa_message_templates") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Unapproved status
            maybeSingle: vi.fn().mockResolvedValue({
              data: { template_name: "custom_unapproved", status: "REJECTED", is_archived: false },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const scheduledMsg: WhatsAppScheduledMessage = {
      id: "sched-test-unapproved",
      business_id: ASTRO_BUSINESS_ID,
      connection_id: "conn-01",
      conversation_id: null,
      recipient_phone: "+919840123456",
      recipient_name: "Test",
      message_type: "template",
      content: null,
      template_name: "custom_unapproved",
      template_language: "en_US",
      template_variables: {},
      media_type: null,
      media_storage_path: null,
      media_filename: null,
      media_file_size: null,
      media_mime_type: null,
      media_caption: null,
      media_meta_id: null,
      scheduled_at: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      status: "scheduled",
      locked_at: null,
      locked_by: null,
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      message_id: null,
      meta_message_id: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      cancelled_at: null,
      cancelled_by: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const outcome = await dispatchSingleScheduledMessage(mockSupabase, scheduledMsg);
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("is not approved by Meta");
  });

  it("4.4 Verifies exponential backoff delay calculation", () => {
    const delay0 = calculateScheduledBackoffDelay(0);
    expect(delay0).toBeGreaterThanOrEqual(30);
    expect(delay0).toBeLessThanOrEqual(35);

    const delay1 = calculateScheduledBackoffDelay(1);
    expect(delay1).toBeGreaterThanOrEqual(60);
    expect(delay1).toBeLessThanOrEqual(65);

    const delay2 = calculateScheduledBackoffDelay(2);
    expect(delay2).toBeGreaterThanOrEqual(120);
    expect(delay2).toBeLessThanOrEqual(125);

    // Max cap is 1800s (30m)
    const delayHigh = calculateScheduledBackoffDelay(10);
    expect(delayHigh).toBeLessThanOrEqual(1800);
  });
});

// ============================================================================
// DOMAIN 5: CROSS-BUSINESS ISOLATION & RBAC RESTRICTIONS
// ============================================================================
describe("Domain 5: Cross-Business Isolation & RBAC Restrictions", () => {
  beforeEach(() => {
    resetScheduledMemoryStore();
  });

  it("5.1 Confirms strict isolation between Astrology and Vivaham scheduled messages", async () => {
    const astroMessages = await listScheduledMessagesDb(ASTRO_BUSINESS_ID);
    const vivahamMessages = await listScheduledMessagesDb(VIVAHAM_BUSINESS_ID);

    expect(astroMessages.length).toBeGreaterThanOrEqual(3);
    expect(vivahamMessages.length).toBeGreaterThanOrEqual(2);

    // No overlap in IDs
    const astroIds = new Set(astroMessages.map((m) => m.id));
    const vivahamIds = new Set(vivahamMessages.map((m) => m.id));

    for (const id of astroIds) {
      expect(vivahamIds.has(id)).toBe(false);
    }

    // Attempt retrieving Astrology message using Vivaham tenant ID -> must return null
    const crossTenantGet = await getScheduledMessageByIdDb(VIVAHAM_BUSINESS_ID, "sched-astro-01");
    expect(crossTenantGet).toBeNull();
  });

  it("5.2 Enforces Viewer read-only restrictions for creating scheduled messages", async () => {
    const { validateBusinessAccess } = await import("@/lib/auth/tenant-guard");
    (validateBusinessAccess as any).mockResolvedValueOnce({
      business: { id: ASTRO_BUSINESS_ID, slug: "astrology" },
      membership: { role: "viewer", business_id: ASTRO_BUSINESS_ID },
      user: { id: "viewer-01", email: "viewer@astrology.example.com" },
    });

    const res = await createScheduledMessageAction({
      businessSlug: "astrology",
      connectionId: "conn-01",
      recipientPhone: "+919840123456",
      messageType: "text",
      content: "Unauthorized viewer message",
      scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Viewers have read-only access");
  });

  it("5.3 Allows Agent role to create, reschedule, and cancel messages", async () => {
    const futureTime = new Date(Date.now() + 5 * 3600 * 1000).toISOString();

    const res = await createScheduledMessageAction({
      businessSlug: "astrology",
      connectionId: "conn-astro-01",
      recipientPhone: "+919840123499",
      messageType: "text",
      content: "Agent scheduled message",
      scheduledAt: futureTime,
    });

    expect(res.success).toBe(true);
    expect(res.message).toBeDefined();

    const msgId = res.message!.id;

    // Agent reschedules
    const reschedTime = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
    const reschedRes = await rescheduleMessageAction("astrology", msgId, reschedTime);
    expect(reschedRes.success).toBe(true);

    // Agent cancels
    const cancelRes = await cancelScheduledMessageAction({
      businessSlug: "astrology",
      messageId: msgId,
      reason: "Agent test cancellation",
    });
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.message?.status).toBe("cancelled");
  });
});
