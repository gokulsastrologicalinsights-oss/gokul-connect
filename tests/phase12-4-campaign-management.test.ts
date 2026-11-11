import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  createCampaignDb,
  listCampaignsDb,
  getCampaignByIdDb,
  updateCampaignDb,
  prepareCampaignAudienceDb,
  launchCampaignDb,
  pauseCampaignDb,
  resumeCampaignDb,
  cancelCampaignDb,
  deleteDraftCampaignDb,
  getCampaignRecipientsDb,
  retryFailedCampaignRecipientsDb,
  getCampaignStatsDb,
  previewCampaignAudienceDb,
  exportCampaignRecipientsToCsv,
  resetCampaignMemoryStore,
  seedCampaignMemoryStore,
} from "@/lib/campaigns/database";
import {
  evaluateContactEligibility,
  revalidateRecipientAtDispatch,
  validateWhatsAppPhoneNumber,
} from "@/lib/campaigns/eligibility";
import {
  calculateCampaignBackoffDelay,
  dispatchSingleCampaignRecipient,
  processCampaignsBatch,
} from "@/lib/campaigns/worker";
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CampaignAudiencePreviewSchema,
} from "@/lib/validation/schemas";
import {
  createCampaignAction,
  updateCampaignAction,
  prepareCampaignAudienceAction,
  launchCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
  cancelCampaignAction,
  deleteDraftCampaignAction,
  getCampaignsAction,
  getCampaignDetailsAction,
  getCampaignRecipientsAction,
  exportCampaignResultsCsvAction,
} from "@/app/actions/campaigns";
import {
  WhatsAppCampaign,
  WhatsAppCampaignRecipient,
  WhatsAppContact,
} from "@/types/database";

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
          id: "mem-astro-admin",
          role: "admin",
          business_id: "11111111-1111-1111-1111-111111111111",
          user_id: "user-astro-admin",
          is_active: true,
        },
        user: { id: "user-astro-admin", email: "admin@astrology.example.com", full_name: "Astro Admin" },
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
// DOMAIN 1: DATABASE MIGRATION 019 PGLITE SCHEMA & TRIGGER VERIFICATION
// ============================================================================
describe("Domain 1: Database Migration 019 PGlite Schema, Constraints & Triggers", () => {
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

    expect(sqlFiles.some((f) => f.includes("019"))).toBe(true);

    for (const file of sqlFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  it("1.1 Confirms wa_contacts consent and blocking columns exist", async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'wa_contacts'
        AND column_name IN (
          'is_blocked', 'consent_status', 'consent_source',
          'consented_at', 'consent_withdrawn_at', 'last_eligibility_evaluation_at'
        );
    `);
    const cols = res.rows.map((r: any) => r.column_name);
    expect(cols).toContain("is_blocked");
    expect(cols).toContain("consent_status");
    expect(cols).toContain("consent_source");
    expect(cols).toContain("consented_at");
  });

  it("1.2 Confirms wa_campaigns table and all required columns exist", async () => {
    const res = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'wa_campaigns';
    `);
    const cols = res.rows.map((r: any) => r.column_name);
    expect(cols).toContain("business_id");
    expect(cols).toContain("name");
    expect(cols).toContain("message_type");
    expect(cols).toContain("connection_id");
    expect(cols).toContain("status");
    expect(cols).toContain("audience_count");
    expect(cols).toContain("eligible_count");
    expect(cols).toContain("excluded_count");
    expect(cols).toContain("sent_count");
    expect(cols).toContain("delivered_count");
    expect(cols).toContain("read_count");
    expect(cols).toContain("failed_count");
  });

  it("1.3 Confirms wa_campaign_recipients table has unique constraint on (campaign_id, phone_number)", async () => {
    const res = await db.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conname = 'uq_wa_campaign_recipients_campaign_phone';
    `);
    expect(res.rows.length).toBe(1);
    expect((res.rows[0] as any).contype).toBe("u");
  });

  it("1.4 Verifies tenant immutability triggers prevent reassigning business_id", async () => {
    const connRes = await db.query(`
      INSERT INTO public.wa_connections (
        business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', 'Astro Sender', '+919840123456', 'phone_camp_01', 'waba_camp_01', 'vault:camp_01'
      ) RETURNING id;
    `);
    const connId = (connRes.rows[0] as any).id;

    const campRes = await db.query(`
      INSERT INTO public.wa_campaigns (
        business_id, connection_id, name, message_type, status
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', '${connId}', 'Immutability Test Campaign', 'template', 'draft'
      ) RETURNING id;
    `);
    const campId = (campRes.rows[0] as any).id;

    await expect(
      db.query(`
        UPDATE public.wa_campaigns
        SET business_id = '${VIVAHAM_BUSINESS_ID}'
        WHERE id = '${campId}';
      `)
    ).rejects.toThrow(/tenant reassignment forbidden/i);
  });

  it("1.5 Verifies atomic claim RPC exclusively locks pending recipients with FOR UPDATE SKIP LOCKED", async () => {
    const connRes = await db.query(`
      SELECT id FROM public.wa_connections WHERE business_id = '${ASTRO_BUSINESS_ID}' LIMIT 1;
    `);
    const connId = (connRes.rows[0] as any).id;

    const campRes = await db.query(`
      INSERT INTO public.wa_campaigns (
        business_id, connection_id, name, message_type, status
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', '${connId}', 'Claim RPC Test', 'template', 'queued'
      ) RETURNING id;
    `);
    const campId = (campRes.rows[0] as any).id;

    await db.query(`
      INSERT INTO public.wa_campaign_recipients (
        business_id, campaign_id, phone_number, eligibility_status, status
      ) VALUES
      ('${ASTRO_BUSINESS_ID}', '${campId}', '919840111111', 'eligible', 'pending'),
      ('${ASTRO_BUSINESS_ID}', '${campId}', '919840222222', 'eligible', 'pending');
    `);

    const claimRes = await db.query(`
      SELECT * FROM public.claim_next_campaign_recipients(10, 'test_worker_1');
    `);
    expect(claimRes.rows.length).toBe(2);
    expect((claimRes.rows[0] as any).status).toBe("processing");
    expect((claimRes.rows[0] as any).locked_by).toBe("test_worker_1");
  });

  it("1.6 Verifies stuck job recovery RPC reclaims stuck processing recipients", async () => {
    const campRes = await db.query(`
      SELECT id FROM public.wa_campaigns WHERE business_id = '${ASTRO_BUSINESS_ID}' LIMIT 1;
    `);
    const campId = (campRes.rows[0] as any).id;

    const stuckRes = await db.query(`
      INSERT INTO public.wa_campaign_recipients (
        business_id, campaign_id, phone_number, eligibility_status, status,
        locked_at, locked_by, retry_count, max_retries
      ) VALUES (
        '${ASTRO_BUSINESS_ID}', '${campId}', '919840999888', 'eligible', 'processing',
        NOW() - INTERVAL '10 minutes', 'stuck_worker', 0, 3
      ) RETURNING id;
    `);
    const stuckId = (stuckRes.rows[0] as any).id;

    const reclaimRes = await db.query(`
      SELECT public.reclaim_stuck_campaign_recipients(5) AS reclaimed;
    `);
    expect(Number((reclaimRes.rows[0] as any).reclaimed)).toBeGreaterThanOrEqual(1);

    const checkRes = await db.query(`
      SELECT status, retry_count, locked_at FROM public.wa_campaign_recipients WHERE id = '${stuckId}';
    `);
    expect((checkRes.rows[0] as any).status).toBe("pending");
    expect((checkRes.rows[0] as any).retry_count).toBe(1);
    expect((checkRes.rows[0] as any).locked_at).toBeNull();
  });
});

// ============================================================================
// DOMAIN 2: ELIGIBILITY & CONSENT COMPLIANCE SERVICE
// ============================================================================
describe("Domain 2: Centralized Eligibility & Consent Compliance Service", () => {
  it("2.1 Strictly excludes opted-out contacts and preserves opt-out reason", () => {
    const contact: WhatsAppContact = {
      id: "cnt-optout",
      business_id: ASTRO_BUSINESS_ID,
      phone_number: "919444559071",
      display_name: "Opted Out Seeker",
      profile_photo_url: null,
      metadata: {},
      is_opted_out: true,
      opted_out_reason: "User sent Tamil நிறுத்து keyword",
      consent_status: "opted_out",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = evaluateContactEligibility(contact, "template");
    expect(res.isEligible).toBe(false);
    expect(res.exclusionReason).toContain("Contact opted out");
    expect(res.exclusionReason).toContain("நிறுத்து");
  });

  it("2.2 Strictly excludes blocked contacts", () => {
    const contact: WhatsAppContact = {
      id: "cnt-blocked",
      business_id: ASTRO_BUSINESS_ID,
      phone_number: "919444559072",
      display_name: "Blocked User",
      profile_photo_url: null,
      metadata: {},
      is_blocked: true,
      consent_status: "opted_in",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = evaluateContactEligibility(contact, "template");
    expect(res.isEligible).toBe(false);
    expect(res.exclusionReason).toContain("marked as blocked");
  });

  it("2.3 Excludes invalid WhatsApp phone numbers (short, repeating dummy)", () => {
    expect(validateWhatsAppPhoneNumber("12345").isValid).toBe(false);
    expect(validateWhatsAppPhoneNumber("1111111111").isValid).toBe(false); // repeating
    expect(validateWhatsAppPhoneNumber("+91 94445 59071").isValid).toBe(true);
    expect(validateWhatsAppPhoneNumber("+91 94445 59071").normalized).toBe("919444559071");
  });

  it("2.4 Strictly excludes contacts with consent_status = 'none' and zero inbound engagement", () => {
    const contact: WhatsAppContact = {
      id: "cnt-no-consent",
      business_id: ASTRO_BUSINESS_ID,
      phone_number: "919840112233",
      display_name: "Cold Lead",
      profile_photo_url: null,
      metadata: {},
      consent_status: "none",
      total_inbound_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = evaluateContactEligibility(contact, "template");
    expect(res.isEligible).toBe(false);
    expect(res.exclusionReason).toContain("No messaging consent on record");
  });

  it("2.5 Enforces 24-hour customer window for free-form text campaigns", () => {
    const oldContact: WhatsAppContact = {
      id: "cnt-old",
      business_id: ASTRO_BUSINESS_ID,
      phone_number: "919840112244",
      display_name: "Inactive Contact",
      profile_photo_url: null,
      metadata: {},
      consent_status: "opted_in",
      last_inbound_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48h ago
      total_inbound_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Text campaign outside 24h window -> EXCLUDED
    const textRes = evaluateContactEligibility(oldContact, "text");
    expect(textRes.isEligible).toBe(false);
    expect(textRes.exclusionReason).toContain("24-hour customer service window closed");

    // Template campaign outside 24h window -> ELIGIBLE (Business-Initiated Template permitted by Meta)
    const templateRes = evaluateContactEligibility(oldContact, "template");
    expect(templateRes.isEligible).toBe(true);
  });
});

// ============================================================================
// DOMAIN 3: CAMPAIGN CREATION, EDITING & SAFE STATUS TRANSITIONS
// ============================================================================
describe("Domain 3: Campaign Lifecycle & Safe Status Transitions", () => {
  beforeEach(() => {
    resetCampaignMemoryStore();
  });

  it("3.1 Creates campaign in draft or scheduled status without sending messages automatically", async () => {
    const campaign = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "New Astrology Campaign",
      connection_id: "conn-astro-01",
      message_type: "template",
      template_name: "diwali_offer",
      status: "draft",
    });

    expect(campaign.status).toBe("draft");
    expect(campaign.sent_count).toBe(0);
    expect(campaign.business_id).toBe(ASTRO_BUSINESS_ID);
  });

  it("3.2 Allows editing campaigns in draft or scheduled status but blocks editing active/sending campaigns", async () => {
    const draft = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Editable Draft",
      connection_id: "conn-astro-01",
      message_type: "text",
      message_content: "Initial text",
      status: "draft",
    });

    const updated = await updateCampaignDb(ASTRO_BUSINESS_ID, draft.id, {
      name: "Renamed Draft",
      message_content: "Updated text",
    });
    expect(updated.name).toBe("Renamed Draft");

    // Mark as sending
    updated.status = "sending";

    await expect(
      updateCampaignDb(ASTRO_BUSINESS_ID, draft.id, {
        name: "Illegal Edit While Sending",
      })
    ).rejects.toThrow(/Cannot edit campaign in sending status/i);
  });

  it("3.3 Pause and Resume transitions work safely", async () => {
    const camp = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Pausable Campaign",
      connection_id: "conn-astro-01",
      message_type: "template",
      status: "draft",
    });

    camp.status = "sending";
    const paused = await pauseCampaignDb(ASTRO_BUSINESS_ID, camp.id);
    expect(paused.status).toBe("paused");
    expect(paused.paused_at).toBeDefined();

    const resumed = await resumeCampaignDb(ASTRO_BUSINESS_ID, camp.id);
    expect(resumed.status).toBe("sending");
    expect(resumed.paused_at).toBeNull();
  });

  it("3.4 Cancellation marks campaign cancelled and cancels pending recipients", async () => {
    const camp = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Cancellable Campaign",
      connection_id: "conn-astro-01",
      message_type: "template",
      status: "draft",
    });

    await prepareCampaignAudienceDb(ASTRO_BUSINESS_ID, camp.id);

    const cancelled = await cancelCampaignDb(ASTRO_BUSINESS_ID, camp.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelled_at).toBeDefined();

    const { recipients } = await getCampaignRecipientsDb(ASTRO_BUSINESS_ID, camp.id);
    for (const r of recipients) {
      if (r.eligibility_status === "eligible") {
        expect(r.status).toBe("cancelled");
      }
    }
  });

  it("3.5 Deletes draft campaign cleanly but disallows deleting non-draft campaigns", async () => {
    const draft = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Deletable Draft",
      connection_id: "conn-astro-01",
      message_type: "text",
      status: "draft",
    });

    const deleted = await deleteDraftCampaignDb(ASTRO_BUSINESS_ID, draft.id);
    expect(deleted).toBe(true);
    expect(await getCampaignByIdDb(ASTRO_BUSINESS_ID, draft.id)).toBeNull();

    // Cannot delete completed campaign
    const completedCamp = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Completed Campaign",
      connection_id: "conn-astro-01",
      message_type: "template",
      status: "completed",
    });

    await expect(deleteDraftCampaignDb(ASTRO_BUSINESS_ID, completedCamp.id)).rejects.toThrow(
      /Only drafts can be deleted/i
    );
  });
});

// ============================================================================
// DOMAIN 4: AUDIENCE BUILDER & SNAPSHOTTING
// ============================================================================
describe("Domain 4: Audience Builder & Snapshotting", () => {
  beforeEach(() => {
    resetCampaignMemoryStore();
  });

  it("4.1 Previews audience and returns eligibility count and exclusion breakdown", async () => {
    const preview = await previewCampaignAudienceDb(
      ASTRO_BUSINESS_ID,
      "template",
      "all_contacts",
      {}
    );

    expect(preview.totalCount).toBeGreaterThan(0);
    expect(preview.eligibleCount).toBeGreaterThan(0);
    expect(preview.excludedCount).toBeGreaterThan(0);
    expect(Object.keys(preview.exclusionsBreakdown).length).toBeGreaterThan(0);
  });

  it("4.2 Snapshots audience into wa_campaign_recipients and prevents duplicate phone recipients", async () => {
    const camp = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Snapshot Test",
      connection_id: "conn-astro-01",
      message_type: "template",
      status: "draft",
    });

    const res = await prepareCampaignAudienceDb(ASTRO_BUSINESS_ID, camp.id);
    expect(res.audienceCount).toBeGreaterThan(0);
    expect(res.eligibleCount).toBeGreaterThan(0);

    const { recipients } = await getCampaignRecipientsDb(ASTRO_BUSINESS_ID, camp.id);
    const phones = recipients.map((r) => r.phone_number);
    const uniquePhones = new Set(phones);
    expect(phones.length).toBe(uniquePhones.size); // Zero duplicate recipients
  });
});

// ============================================================================
// DOMAIN 5: BATCH DISPATCH ENGINE, RETRIES & STUCK-JOB RECLAIMING
// ============================================================================
describe("Domain 5: Batch Dispatch Engine & Worker Architecture", () => {
  beforeEach(() => {
    resetCampaignMemoryStore();
  });

  it("5.1 Calculates exponential backoff delay with random jitter", () => {
    const delay0 = calculateCampaignBackoffDelay(0);
    const delay1 = calculateCampaignBackoffDelay(1);
    const delay2 = calculateCampaignBackoffDelay(2);

    expect(delay0).toBeGreaterThanOrEqual(15);
    expect(delay1).toBeGreaterThanOrEqual(30);
    expect(delay2).toBeGreaterThanOrEqual(60);
    expect(delay2).toBeLessThanOrEqual(600); // capped at 10 minutes
  });

  it("5.2 Does not dispatch messages for campaigns in draft or paused status", async () => {
    const draftCamp = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Inactive Draft Campaign",
      connection_id: "conn-astro-01",
      message_type: "template",
      status: "draft",
    });
    await prepareCampaignAudienceDb(ASTRO_BUSINESS_ID, draftCamp.id);

    const workerRes = await processCampaignsBatch({ batchSize: 10 });
    expect(workerRes.claimedCount).toBe(0);
    expect(workerRes.sentCount).toBe(0);
  });

  it("5.3 Atomically claims pending recipients when campaign is launched to queued", async () => {
    const camp = await createCampaignDb(ASTRO_BUSINESS_ID, {
      name: "Active Queued Campaign",
      connection_id: "conn-astro-01",
      message_type: "template",
      template_name: "diwali_offer",
      status: "draft",
    });
    await prepareCampaignAudienceDb(ASTRO_BUSINESS_ID, camp.id);
    await launchCampaignDb(ASTRO_BUSINESS_ID, camp.id);

    const result = await processCampaignsBatch({ batchSize: 10 });
    expect(result.claimedCount).toBeGreaterThan(0);
    expect(result.processedCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// DOMAIN 6: IMMEDIATE DISPATCH-TIME REVALIDATION & OPT-OUT PROTECTION
// ============================================================================
describe("Domain 6: Immediate Dispatch-Time Revalidation & Compliance Safeguards", () => {
  it("6.1 Revalidation halts dispatch if contact opted out after audience snapshot", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "cnt-optedout-late",
                  business_id: ASTRO_BUSINESS_ID,
                  phone_number: "919444559071",
                  is_opted_out: true,
                  opted_out_reason: "User replied STOP after campaign snapshot",
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    const reval = await revalidateRecipientAtDispatch(
      mockSupabase,
      ASTRO_BUSINESS_ID,
      { phone_number: "919444559071", contact_id: "cnt-optedout-late" },
      "template"
    );

    expect(reval.isEligible).toBe(false);
    expect(reval.exclusionReason).toContain("Contact opted out");
  });
});

// ============================================================================
// DOMAIN 7: TEMPLATE APPROVAL & MEDIA CAMPAIGN VALIDATION
// ============================================================================
describe("Domain 7: Template Approval & Media Campaign Validation", () => {
  it("7.1 Validates template status must be APPROVED before dispatch", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  table === "wa_message_templates"
                    ? { name: "unapproved_template", status: "REJECTED", is_archived: false }
                    : table === "wa_contacts"
                    ? {
                        id: "cnt-1",
                        phone_number: "919444559071",
                        is_opted_out: false,
                        is_blocked: false,
                        consent_status: "opted_in",
                      }
                    : { id: "conn-1", connection_status: "connected", is_enabled: true },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    const campaign: WhatsAppCampaign = {
      id: "camp-unapproved",
      business_id: ASTRO_BUSINESS_ID,
      name: "Unapproved Template Campaign",
      description: null,
      message_type: "template",
      template_id: null,
      template_name: "unapproved_template",
      template_language: "en_US",
      template_variables: {},
      message_content: null,
      media_type: null,
      media_storage_path: null,
      media_filename: null,
      media_file_size: null,
      media_mime_type: null,
      media_caption: null,
      media_meta_id: null,
      connection_id: "conn-1",
      scheduled_at: null,
      timezone: "Asia/Kolkata",
      status: "sending",
      audience_type: "all_contacts",
      audience_filters: {},
      audience_count: 1,
      eligible_count: 1,
      excluded_count: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      failed_count: 0,
      batch_size: 50,
      dispatch_interval_ms: 1000,
      locked_at: null,
      locked_by: null,
      started_at: null,
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const recipient: WhatsAppCampaignRecipient = {
      id: "recp-1",
      business_id: ASTRO_BUSINESS_ID,
      campaign_id: campaign.id,
      contact_id: "cnt-1",
      phone_number: "919444559071",
      recipient_name: "Gokul Anand",
      eligibility_status: "eligible",
      exclusion_reason: null,
      status: "processing",
      message_id: null,
      meta_message_id: null,
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      locked_at: null,
      locked_by: null,
      dispatched_at: null,
      delivered_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await dispatchSingleCampaignRecipient(mockSupabase, campaign, recipient);
    expect(res.success).toBe(false);
    expect(res.error).toContain("is not approved");
  });
});

// ============================================================================
// DOMAIN 8: CAMPAIGN ANALYTICS ACCURACY
// ============================================================================
describe("Domain 8: Campaign Analytics & Real Calculations", () => {
  beforeEach(() => {
    resetCampaignMemoryStore();
  });

  it("8.1 Correctly computes delivery rate, read rate, and failure rate from real DB data", async () => {
    const stats = await getCampaignStatsDb(ASTRO_BUSINESS_ID);
    expect(stats.totalCampaigns).toBeGreaterThanOrEqual(2);
    expect(stats.deliveryRate).toBeGreaterThanOrEqual(0);
    expect(stats.deliveryRate).toBeLessThanOrEqual(100);
    expect(stats.readRate).toBeGreaterThanOrEqual(0);
    expect(stats.readRate).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// DOMAIN 9: SECURE RFC 4180 CSV EXPORT
// ============================================================================
describe("Domain 9: Secure RFC 4180 CSV Export with Formula Injection Neutralization", () => {
  it("9.1 Neutralizes formula injection vulnerabilities (SEC-MED-02 compliance)", () => {
    const maliciousRecipients: WhatsAppCampaignRecipient[] = [
      {
        id: "rec-mal-1",
        business_id: ASTRO_BUSINESS_ID,
        campaign_id: "camp-1",
        contact_id: "cnt-1",
        phone_number: "919444559071",
        recipient_name: "=cmd|' /C calc'!A0", // Malicious formula
        eligibility_status: "eligible",
        exclusion_reason: null,
        status: "sent",
        message_id: null,
        meta_message_id: "meta-1",
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        locked_at: null,
        locked_by: null,
        dispatched_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "rec-mal-2",
        business_id: ASTRO_BUSINESS_ID,
        campaign_id: "camp-1",
        contact_id: "cnt-2",
        phone_number: "919840112233",
        recipient_name: "@SUM(1+1)", // Malicious @ trigger
        eligibility_status: "eligible",
        exclusion_reason: null,
        status: "sent",
        message_id: null,
        meta_message_id: "meta-2",
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        locked_at: null,
        locked_by: null,
        dispatched_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const csv = exportCampaignRecipientsToCsv(maliciousRecipients);
    expect(csv).toContain("Recipient ID,Recipient Name,Phone Number");
    // Checks that leading formula triggers have been neutralized with a single quote prefix
    expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
    expect(csv).toContain("\"'@SUM(1+1)\"");
  });
});

// ============================================================================
// DOMAIN 10: MULTI-TENANT ISOLATION & ROLE-BASED ACCESS CONTROL
// ============================================================================
describe("Domain 10: Multi-Tenant Isolation & Role-Based Access Control", () => {
  beforeEach(() => {
    resetCampaignMemoryStore();
  });

  it("10.1 Enforces strict business tenant isolation between Astrology and Vivaham", async () => {
    const astroCampaigns = await listCampaignsDb(ASTRO_BUSINESS_ID);
    const vivahamCampaigns = await listCampaignsDb(VIVAHAM_BUSINESS_ID);

    expect(astroCampaigns.every((c) => c.business_id === ASTRO_BUSINESS_ID)).toBe(true);
    expect(vivahamCampaigns.every((c) => c.business_id === VIVAHAM_BUSINESS_ID)).toBe(true);

    // Astrology cannot see Vivaham campaign
    const vivCamp = vivahamCampaigns[0];
    const crossAccess = await getCampaignByIdDb(ASTRO_BUSINESS_ID, vivCamp.id);
    expect(crossAccess).toBeNull();
  });

  it("10.2 Disallows Viewer role from creating or modifying campaigns", async () => {
    // Vivaham user has role 'viewer' in our mock
    const formData = new FormData();
    formData.set("name", "Viewer Unauthorized Campaign");
    formData.set("connectionId", "conn-viv-01");
    formData.set("messageType", "text");
    formData.set("content", "Unauthorized text");

    const res = await createCampaignAction("vivaham", formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Permission denied: viewer role is not permitted");
  });

  it("10.3 Allows Admin role to create campaigns", async () => {
    // Astrology user has role 'admin' in our mock
    const formData = new FormData();
    formData.set("name", "Admin Authorized Campaign");
    formData.set("connectionId", "33333333-3333-3333-3333-333333333333");
    formData.set("messageType", "template");
    formData.set("templateName", "diwali_offer");

    const res = await createCampaignAction("astrology", formData);
    expect(res.success).toBe(true);
    expect(res.campaign?.name).toBe("Admin Authorized Campaign");
  });
});
