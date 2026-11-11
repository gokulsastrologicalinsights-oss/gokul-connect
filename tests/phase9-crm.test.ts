import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  createContactDb,
  getCrmContactsDb,
  getCrmContactByIdDb,
  updateContactDb,
  archiveContactDb,
  addContactNoteDb,
  getContactNotesDb,
  getContactActivityLogsDb,
  getCrmCategoriesDb,
  createCrmCategoryDb,
  getCrmSegmentsDb,
  createCrmSegmentDb,
  deleteCrmSegmentDb,
  bulkImportContactsDb,
  getCrmDashboardMetricsDb,
  getOrCreateConversationForContactDb,
  exportContactsToCsvString,
  parseAndValidateCsv,
  normalizePhoneNumber,
  resetMockCrmStore,
  DEFAULT_ASTRO_CATEGORIES,
  DEFAULT_VIVAHAM_CATEGORIES,
} from "@/lib/crm/database";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/database";

describe("Phase 9 — CRM & Contact Management Test Suite", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  let db: PGlite;

  beforeEach(() => {
    resetMockCrmStore();
  });

  // Setup PGlite with all migrations 001–013 for live SQL verification
  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup mock Supabase roles & auth schema
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB
      );
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::UUID;
      $$;
    `);

    // 2. Apply all migrations sequentially
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', "-- native");
      await db.exec(sql);
    }
  });

  // ============================================================================
  // DOMAIN 1: CONTACT CRUD & PROFILE MANAGEMENT
  // ============================================================================
  describe("Domain 1: Contact CRUD & Profile Management", () => {
    it("1.1 should create a new contact with all CRM fields", async () => {
      const contact = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Karthik Subramanian",
        phone_number: "+91 98401 12345",
        email: "karthik@example.com",
        status: "lead",
        category: "Astrology Consultation",
        source: "website",
        tags: ["VIP", "Chennai"],
        note: "Interested in career horoscope consultation",
      });

      expect(contact.id).toBeDefined();
      expect(contact.business_id).toBe(ASTRO_BUSINESS_ID);
      expect(contact.display_name).toBe("Karthik Subramanian");
      expect(contact.phone_number).toBe("919840112345"); // normalized E.164
      expect(contact.email).toBe("karthik@example.com");
      expect(contact.status).toBe("lead");
      expect(contact.category).toBe("Astrology Consultation");
      expect(contact.source).toBe("website");
      expect(contact.tags).toEqual(["VIP", "Chennai"]);
      expect(contact.is_archived).toBe(false);
      expect(contact.is_opted_out).toBe(false);
    });

    it("1.2 should retrieve contact by ID with notes and activity history", async () => {
      const created = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Meena Sundaram",
        phone_number: "919840155555",
        note: "Initial contact via WhatsApp",
      });

      const fetched = await getCrmContactByIdDb(ASTRO_BUSINESS_ID, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.display_name).toBe("Meena Sundaram");

      // Verify notes were recorded
      expect(fetched?.notes).toBeDefined();
      expect(fetched?.notes?.length).toBe(1);
      expect(fetched?.notes?.[0].note).toBe("Initial contact via WhatsApp");

      // Verify activity logs were recorded
      expect(fetched?.activity_logs).toBeDefined();
      expect(fetched?.activity_logs?.length).toBeGreaterThanOrEqual(1);
      expect(fetched?.activity_logs?.some((l) => l.activity_type === "created")).toBe(true);
    });

    it("1.3 should update contact details and log activity", async () => {
      const created = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Venkatesh Rao",
        phone_number: "919840166666",
        status: "lead",
      });

      const updated = await updateContactDb(ASTRO_BUSINESS_ID, created.id, {
        display_name: "Venkatesh Rao B.",
        status: "customer",
        category: "Horoscope Matching",
        tags: ["RepeatClient"],
      });

      expect(updated.display_name).toBe("Venkatesh Rao B.");
      expect(updated.status).toBe("customer");
      expect(updated.category).toBe("Horoscope Matching");
      expect(updated.tags).toEqual(["RepeatClient"]);

      // Verify activity logged status change
      const logs = await getContactActivityLogsDb(ASTRO_BUSINESS_ID, created.id);
      expect(logs.some((l) => l.activity_type === "status_changed")).toBe(true);
    });

    it("1.4 should archive and restore contacts cleanly", async () => {
      const created = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Archivable Contact",
        phone_number: "919840177777",
      });

      // Archive
      await archiveContactDb(ASTRO_BUSINESS_ID, created.id, true);
      const archived = await getCrmContactByIdDb(ASTRO_BUSINESS_ID, created.id);
      expect(archived?.is_archived).toBe(true);

      // Default list excludes archived contacts
      const activeList = await getCrmContactsDb(ASTRO_BUSINESS_ID, { is_archived: false });
      expect(activeList.contacts.some((c) => c.id === created.id)).toBe(false);

      // List with is_archived: true includes it
      const archivedList = await getCrmContactsDb(ASTRO_BUSINESS_ID, { is_archived: true });
      expect(archivedList.contacts.some((c) => c.id === created.id)).toBe(true);

      // Restore
      await archiveContactDb(ASTRO_BUSINESS_ID, created.id, false);
      const restored = await getCrmContactByIdDb(ASTRO_BUSINESS_ID, created.id);
      expect(restored?.is_archived).toBe(false);
    });

    it("1.5 should add multiple notes with author attribution", async () => {
      const contact = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Note Test",
        phone_number: "919840188888",
      });

      await addContactNoteDb(ASTRO_BUSINESS_ID, contact.id, "First consultation call held.", "user-1", "Gokul");
      await addContactNoteDb(ASTRO_BUSINESS_ID, contact.id, "Follow-up scheduled for next Tuesday.", "user-1", "Gokul");

      const notes = await getContactNotesDb(ASTRO_BUSINESS_ID, contact.id);
      expect(notes.length).toBe(2);
      expect(notes[0].note).toBe("Follow-up scheduled for next Tuesday."); // latest first
      expect(notes[0].author_name).toBe("Gokul");
    });
  });

  // ============================================================================
  // DOMAIN 2: DUPLICATE DETECTION & PHONE NORMALIZATION
  // ============================================================================
  describe("Domain 2: Duplicate Detection & Phone Normalization", () => {
    it("2.1 should reject duplicate phone number within the SAME business tenant", async () => {
      await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Original Contact",
        phone_number: "919444550001",
      });

      // Attempt duplicate with formatted phone number
      await expect(
        createContactDb(ASTRO_BUSINESS_ID, {
          display_name: "Duplicate Contact",
          phone_number: "+91 94445-50001",
        })
      ).rejects.toThrow(/already exists in this business/i);
    });

    it("2.2 should ALLOW identical phone number across DIFFERENT business tenants", async () => {
      const astroContact = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Dual Client Astro",
        phone_number: "919444550002",
      });

      const vivahamContact = await createContactDb(VIVAHAM_BUSINESS_ID, {
        display_name: "Dual Client Vivaham",
        phone_number: "919444550002",
      });

      expect(astroContact.id).not.toBe(vivahamContact.id);
      expect(astroContact.business_id).toBe(ASTRO_BUSINESS_ID);
      expect(vivahamContact.business_id).toBe(VIVAHAM_BUSINESS_ID);
      expect(astroContact.phone_number).toBe(vivahamContact.phone_number);
    });

    it("2.3 should normalize various phone formats correctly into E.164 digits", () => {
      expect(normalizePhoneNumber("+91 94445 59071")).toBe("919444559071");
      expect(normalizePhoneNumber("91-94445-59071")).toBe("919444559071");
      expect(normalizePhoneNumber("+91 (044) 2828 1234")).toBe("9104428281234");
      expect(normalizePhoneNumber("9444559071")).toBe("9444559071");
    });
  });

  // ============================================================================
  // DOMAIN 3: CSV PARSING, VALIDATION & BULK IMPORT
  // ============================================================================
  describe("Domain 3: CSV Parsing, Validation & Bulk Import", () => {
    it("3.1 should parse and validate valid CSV rows", () => {
      const csv = `Name,WhatsApp Number,Email,Category,Status
Ganesh,919840111111,ganesh@example.com,Astrology Consultation,lead
Lakshmi,919840222222,lakshmi@example.com,Horoscope Matching,customer`;

      const result = parseAndValidateCsv(csv);
      expect(result.totalRows).toBe(2);
      expect(result.validRows.length).toBe(2);
      expect(result.duplicateCount).toBe(0);
      expect(result.invalidCount).toBe(0);
      expect(result.validRows[0].name).toBe("Ganesh");
      expect(result.validRows[0].phone).toBe("919840111111");
    });

    it("3.2 should flag duplicates within the CSV and against existing business contacts", () => {
      const existingPhones = new Set(["919840111111"]);
      const csv = `Name,Phone Number
Duplicate Existing,919840111111
First New,919840333333
Duplicate In File,919840333333
Invalid Short,123`;

      const result = parseAndValidateCsv(csv, existingPhones);
      expect(result.validRows.length).toBe(1); // only First New is valid
      expect(result.validRows[0].phone).toBe("919840333333");
      expect(result.duplicateCount).toBe(2); // 1 existing, 1 intra-file duplicate
      expect(result.invalidCount).toBe(3); // 2 duplicates + 1 invalid short
    });

    it("3.3 should execute bulk import and return count statistics", async () => {
      const rows = [
        { name: "Bulk User 1", phone: "919840444441", category: "Numerology" },
        { name: "Bulk User 2", phone: "919840444442", category: "Astrology Consultation" },
      ];

      const res = await bulkImportContactsDb(ASTRO_BUSINESS_ID, rows);
      expect(res.importedCount).toBe(2);
      expect(res.duplicateCount).toBe(0);
      expect(res.errors.length).toBe(0);

      // Verify contacts exist in database
      const fetched = await getCrmContactsDb(ASTRO_BUSINESS_ID, { search: "Bulk User" });
      expect(fetched.totalCount).toBe(2);
    });
  });

  // ============================================================================
  // DOMAIN 4: CSV EXPORT
  // ============================================================================
  describe("Domain 4: CSV Export", () => {
    it("4.1 should export filtered contacts as RFC 4180 CSV with UTF-8 BOM", async () => {
      const c1 = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Sundaram & Sons",
        phone_number: "919840555551",
        email: "sundaram@example.com",
        category: "Horoscope Matching",
        tags: ["TamilNadu", "VIP"],
      });

      const csv = exportContactsToCsvString([c1]);
      // Verify UTF-8 BOM
      expect(csv.startsWith("\uFEFF")).toBe(true);
      // Verify headers
      expect(csv).toContain("Contact Name,WhatsApp Number,Email,Status,Category,Source,Tags,Opt Out");
      // Verify escaped row data
      expect(csv).toContain('"Sundaram & Sons","919840555551","sundaram@example.com"');
      expect(csv).toContain('"Horoscope Matching"');
      expect(csv).toContain('"TamilNadu, VIP"');
    });
  });

  // ============================================================================
  // DOMAIN 5: BUSINESS-SPECIFIC CONFIGURABLE CATEGORIES
  // ============================================================================
  describe("Domain 5: Business-Specific Configurable Categories", () => {
    it("5.1 should provide astrology-specific categories for Astrology business", async () => {
      const categories = await getCrmCategoriesDb(ASTRO_BUSINESS_ID);
      const catNames = categories.map((c) => c.name);

      expect(catNames).toContain("New Enquiry");
      expect(catNames).toContain("Astrology Consultation");
      expect(catNames).toContain("Horoscope Matching");
      expect(catNames).toContain("Numerology");
      expect(catNames).toContain("Existing Customer");
      expect(catNames).toContain("Follow-up Required");
      expect(catNames).not.toContain("Groom");
      expect(catNames).not.toContain("Bride");
    });

    it("5.2 should provide vivaham-specific categories for Vivaham business", async () => {
      const categories = await getCrmCategoriesDb(VIVAHAM_BUSINESS_ID);
      const catNames = categories.map((c) => c.name);

      expect(catNames).toContain("New Registration");
      expect(catNames).toContain("Groom");
      expect(catNames).toContain("Bride");
      expect(catNames).toContain("Membership Enquiry");
      expect(catNames).toContain("Active Member");
      expect(catNames).toContain("Follow-up Required");
      expect(catNames).not.toContain("Astrology Consultation");
      expect(catNames).not.toContain("Horoscope Matching");
    });

    it("5.3 should allow creating a custom category without affecting other businesses", async () => {
      const custom = await createCrmCategoryDb(ASTRO_BUSINESS_ID, {
        name: "Gemstone Recommendation",
        slug: "gemstone-recommendation",
        color: "emerald",
      });

      expect(custom.name).toBe("Gemstone Recommendation");
      expect(custom.business_id).toBe(ASTRO_BUSINESS_ID);

      // Verify it appears in Astrology categories
      const astroCats = await getCrmCategoriesDb(ASTRO_BUSINESS_ID);
      expect(astroCats.some((c) => c.slug === "gemstone-recommendation")).toBe(true);

      // Verify it DOES NOT appear in Vivaham categories
      const vivahamCats = await getCrmCategoriesDb(VIVAHAM_BUSINESS_ID);
      expect(vivahamCats.some((c) => c.slug === "gemstone-recommendation")).toBe(false);
    });
  });

  // ============================================================================
  // DOMAIN 6: CONTACT SEGMENTATION & CAMPAIGN PREPARATION
  // ============================================================================
  describe("Domain 6: Contact Segmentation & Campaign Preparation", () => {
    it("6.1 should create and retrieve saved segments per business tenant", async () => {
      const segment = await createCrmSegmentDb(ASTRO_BUSINESS_ID, {
        name: "Pending Horoscope Leads",
        description: "Leads awaiting horoscope generation",
        filters: { status: ["lead"], category: ["Horoscope Matching"] },
      });

      expect(segment.id).toBeDefined();
      expect(segment.name).toBe("Pending Horoscope Leads");

      const astroSegments = await getCrmSegmentsDb(ASTRO_BUSINESS_ID);
      expect(astroSegments.some((s) => s.id === segment.id)).toBe(true);

      // Vivaham cannot see Astrology segments
      const vivahamSegments = await getCrmSegmentsDb(VIVAHAM_BUSINESS_ID);
      expect(vivahamSegments.some((s) => s.id === segment.id)).toBe(false);
    });

    it("6.2 should delete saved segments with strict tenant checks", async () => {
      const segment = await createCrmSegmentDb(ASTRO_BUSINESS_ID, {
        name: "Temporary Segment",
        filters: {},
      });

      await deleteCrmSegmentDb(ASTRO_BUSINESS_ID, segment.id);
      const remaining = await getCrmSegmentsDb(ASTRO_BUSINESS_ID);
      expect(remaining.some((s) => s.id === segment.id)).toBe(false);
    });
  });

  // ============================================================================
  // DOMAIN 7: INBOX INTEGRATION & CONVERSATION LINKING
  // ============================================================================
  describe("Domain 7: Inbox Integration & Conversation Linking", () => {
    it("7.1 should link contact to conversation when requested from CRM", async () => {
      const contact = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Inbox Link Contact",
        phone_number: "919840666661",
      });

      const { conversationId } = await getOrCreateConversationForContactDb(ASTRO_BUSINESS_ID, contact.id);
      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe("string");
    });
  });

  // ============================================================================
  // DOMAIN 8: STRICT MULTI-TENANT ISOLATION & RLS
  // ============================================================================
  describe("Domain 8: Strict Multi-Tenant Isolation & RLS", () => {
    it("8.1 should strictly isolate contact search between Astrology and Vivaham", async () => {
      await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Astrology Secret Client",
        phone_number: "919999000001",
      });

      await createContactDb(VIVAHAM_BUSINESS_ID, {
        display_name: "Vivaham Secret Bride",
        phone_number: "919999000002",
      });

      // Query Astrology
      const astroResults = await getCrmContactsDb(ASTRO_BUSINESS_ID, { search: "Secret" });
      expect(astroResults.contacts.length).toBe(1);
      expect(astroResults.contacts[0].display_name).toBe("Astrology Secret Client");
      expect(astroResults.contacts[0].business_id).toBe(ASTRO_BUSINESS_ID);

      // Query Vivaham
      const vivahamResults = await getCrmContactsDb(VIVAHAM_BUSINESS_ID, { search: "Secret" });
      expect(vivahamResults.contacts.length).toBe(1);
      expect(vivahamResults.contacts[0].display_name).toBe("Vivaham Secret Bride");
      expect(vivahamResults.contacts[0].business_id).toBe(VIVAHAM_BUSINESS_ID);
    });

    it("8.2 should prevent cross-tenant contact access by contactId", async () => {
      const vivahamContact = await createContactDb(VIVAHAM_BUSINESS_ID, {
        display_name: "Private Vivaham Profile",
        phone_number: "919999000003",
      });

      // Astrology tenant attempts to fetch Vivaham contact by ID -> Must return null
      const crossTenantFetch = await getCrmContactByIdDb(ASTRO_BUSINESS_ID, vivahamContact.id);
      expect(crossTenantFetch).toBeNull();
    });

    it("8.3 should verify database trigger prevents business_id mutation on wa_contacts", async () => {
      const insertRes = await db.query(`
        INSERT INTO public.wa_contacts (business_id, phone_number, display_name)
        VALUES ('${ASTRO_BUSINESS_ID}', '919840777771', 'Immutability Check')
        RETURNING id;
      `);
      const contactId = (insertRes.rows[0] as any).id;

      // Attempt to reassign business_id to Vivaham -> Must fail with exception
      await expect(
        db.query(`
          UPDATE public.wa_contacts
          SET business_id = '${VIVAHAM_BUSINESS_ID}'
          WHERE id = '${contactId}';
        `)
      ).rejects.toThrow(/Tenant reassignment forbidden/i);
    });

    it("8.4 should enforce composite foreign key between contact_notes and wa_contacts", async () => {
      const astroContact = await db.query(`
        INSERT INTO public.wa_contacts (business_id, phone_number, display_name)
        VALUES ('${ASTRO_BUSINESS_ID}', '919840777772', 'Tenant FK Check')
        RETURNING id;
      `);
      const astroContactId = (astroContact.rows[0] as any).id;

      // Attempting to attach note for Vivaham business referencing Astrology contact must violate foreign key
      await expect(
        db.query(`
          INSERT INTO public.contact_notes (business_id, contact_id, note, author_name)
          VALUES ('${VIVAHAM_BUSINESS_ID}', '${astroContactId}', 'Cross-tenant illegal note', 'Hacker');
        `)
      ).rejects.toThrow(/violates foreign key constraint/i);
    });
  });

  // ============================================================================
  // DOMAIN 9: COMPLIANCE & OPT-OUT RESTRICTIONS
  // ============================================================================
  describe("Domain 9: Compliance & Opt-Out Restrictions", () => {
    it("9.1 should track opt-out status and compute accurate metrics", async () => {
      const c1 = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Active Client",
        phone_number: "919840888881",
        status: "customer",
      });

      const c2 = await createContactDb(ASTRO_BUSINESS_ID, {
        display_name: "Opted Out Client",
        phone_number: "919840888882",
        status: "lead",
      });

      await updateContactDb(ASTRO_BUSINESS_ID, c2.id, { is_opted_out: true });

      const metrics = await getCrmDashboardMetricsDb(ASTRO_BUSINESS_ID);
      expect(metrics.totalContacts).toBe(2);
      expect(metrics.optedOut).toBe(1);
      expect(metrics.activeCustomers).toBe(1);
      expect(metrics.leads).toBe(1);
    });
  });
});
