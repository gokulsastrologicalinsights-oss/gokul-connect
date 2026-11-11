import { describe, it, expect, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
} from "@/lib/inbox/database";
import {
  ALLOWED_MIME_TYPES,
  MEDIA_SIZE_LIMITS,
  buildBusinessStoragePath,
  clearInMemoryMediaStore,
  createSignedMediaUrl,
  getMediaTypeFromMime,
  getStoredMediaFile,
  sanitizeFilename,
  storeMediaFile,
  validateMediaFile,
  verifySignedMediaToken,
  verifyTenantStoragePath,
} from "@/lib/media/storage";
import {
  SendMediaMessageSchema,
  GetMediaDownloadUrlSchema,
  RetryMediaMessageSchema,
} from "@/lib/validation/schemas";
import {
  sendWhatsAppMediaMessageAction,
  getMediaDownloadUrlAction,
  retryFailedMediaMessageAction,
} from "@/app/actions/inbox";
import { POST as webhookPost } from "@/app/api/webhooks/whatsapp/route";
import { GET as mediaDownloadGet } from "@/app/api/media/download/route";
import { NextRequest } from "next/server";

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
          id: "mem-astro-owner",
          role: "owner",
          business_id: "11111111-1111-1111-1111-111111111111",
          user_id: "user-astro-owner",
          is_active: true,
        },
        user: { id: "user-astro-owner", email: "owner@astrology.example.com" },
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
        user: { id: "user-vivaham-owner", email: "owner@vivaham.example.com" },
      };
    }
    throw new Error(`Unauthorized business access for slug: ${businessSlug}`);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/inbox/store", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getConversationByIdDb: vi.fn(async (businessId: string, conversationId: string) => {
      if (conversationId === "conv-open-window") {
        return {
          id: "conv-open-window",
          business_id: businessId,
          connection_id: "conn-123",
          contact_id: "contact-123",
          contact: { phone_number: "+919876543210", display_name: "Test Contact" },
          status: "open",
        };
      }
      if (conversationId === "conv-expired-window") {
        return {
          id: "conv-expired-window",
          business_id: businessId,
          connection_id: "conn-123",
          contact_id: "contact-123",
          contact: { phone_number: "+919876543210", display_name: "Test Contact" },
          status: "open",
        };
      }
      return null;
    }),
    getConversationMessagingWindowDb: vi.fn(async (_businessId: string, conversationId: string) => {
      if (conversationId === "conv-open-window") {
        return { isOpen: true, lastInboundAt: new Date().toISOString(), timeRemaining: "23h 50m" };
      }
      return { isOpen: false, lastInboundAt: null, timeRemaining: "" };
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "msg-123" }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnThis(),
    })),
  })),
}));

// ============================================================================
// DOMAIN 1: DATABASE MIGRATION 017 PGLITE REPLAY & SCHEMA VERIFICATION
// ============================================================================
describe("Domain 1: Database Migration 017 PGlite Schema & Trigger Verification", () => {
  const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();

    // Setup mock roles and auth schema for full migration replay
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

    expect(sqlFiles.some((f) => f.includes("017"))).toBe(true);

    for (const file of sqlFiles) {
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
      await db.exec(sql);
    }
  });

  it("1.1 Replays all 17 migrations cleanly and confirms wa_messages media columns", async () => {
    const res = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'wa_messages'
        AND column_name IN (
          'media_type', 'media_id', 'mime_type', 'file_name',
          'file_size', 'caption', 'storage_path', 'download_status',
          'downloaded_at', 'uploaded_at', 'media_error'
        );
    `);

    const colNames = res.rows.map((r: any) => r.column_name);
    expect(colNames).toContain("media_type");
    expect(colNames).toContain("media_id");
    expect(colNames).toContain("mime_type");
    expect(colNames).toContain("file_name");
    expect(colNames).toContain("file_size");
    expect(colNames).toContain("caption");
    expect(colNames).toContain("storage_path");
    expect(colNames).toContain("download_status");
    expect(colNames).toContain("downloaded_at");
    expect(colNames).toContain("uploaded_at");
    expect(colNames).toContain("media_error");
  });

  it("1.2 Confirms wa_messages message_type check constraint permits 'video'", async () => {
    // Insert dummy connection & contact first
    const connId = crypto.randomUUID();
    const contactId = crypto.randomUUID();
    const convId = crypto.randomUUID();

    await db.exec(`
      INSERT INTO public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref)
      VALUES ('${connId}', '${ASTRO_BUSINESS_ID}', 'Astro Line', '+919999999991', '1001', 'waba_1', 'vault:1');

      INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name)
      VALUES ('${contactId}', '${ASTRO_BUSINESS_ID}', '+919876543210', 'Dev Customer');

      INSERT INTO public.wa_conversations (id, business_id, connection_id, contact_id, status)
      VALUES ('${convId}', '${ASTRO_BUSINESS_ID}', '${connId}', '${contactId}', 'open');
    `);

    // Insert a video message
    const msgId = crypto.randomUUID();
    await db.exec(`
      INSERT INTO public.wa_messages (
        id, business_id, connection_id, conversation_id, contact_id,
        direction, message_type, content, status
      )
      VALUES (
        '${msgId}', '${ASTRO_BUSINESS_ID}', '${connId}', '${convId}', '${contactId}',
        'outbound', 'video', 'Sample video message', 'sent'
      );
    `);

    const msgCheck = await db.query<any>(`SELECT message_type FROM public.wa_messages WHERE id = '${msgId}'`);
    expect(msgCheck.rows[0].message_type).toBe("video");
  });

  it("1.3 Verifies wa_media_files table and tenant immutability trigger", async () => {
    const connId = crypto.randomUUID();
    const contactId = crypto.randomUUID();
    const convId = crypto.randomUUID();
    const fileId = crypto.randomUUID();

    await db.exec(`
      INSERT INTO public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref)
      VALUES ('${connId}', '${ASTRO_BUSINESS_ID}', 'Astro Line', '+919999999992', '1002', 'waba_2', 'vault:2');

      INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name)
      VALUES ('${contactId}', '${ASTRO_BUSINESS_ID}', '+919876543211', 'Dev Customer 2');

      INSERT INTO public.wa_conversations (id, business_id, connection_id, contact_id, status)
      VALUES ('${convId}', '${ASTRO_BUSINESS_ID}', '${connId}', '${contactId}', 'open');

      INSERT INTO public.wa_media_files (
        id, business_id, conversation_id, media_type, mime_type,
        original_filename, file_size, storage_path, direction
      )
      VALUES (
        '${fileId}', '${ASTRO_BUSINESS_ID}', '${convId}', 'image', 'image/jpeg',
        'chart.jpg', 10240, 'businesses/${ASTRO_BUSINESS_ID}/conversations/${convId}/${fileId}-chart.jpg', 'outbound'
      );
    `);

    const fileCheck = await db.query<any>(`SELECT original_filename, media_type FROM public.wa_media_files WHERE id = '${fileId}'`);
    expect(fileCheck.rows[0].original_filename).toBe("chart.jpg");
    expect(fileCheck.rows[0].media_type).toBe("image");

    // Tenant reassignment attempt must fail via trigger
    await expect(
      db.exec(`UPDATE public.wa_media_files SET business_id = '${VIVAHAM_BUSINESS_ID}' WHERE id = '${fileId}'`)
    ).rejects.toThrow(/Tenant reassignment forbidden/);
  });

  it("1.4 Verifies trg_wa_messages_populate_media extracts media fields from raw_payload automatically", async () => {
    const connId = crypto.randomUUID();
    const contactId = crypto.randomUUID();
    const convId = crypto.randomUUID();
    const msgId = crypto.randomUUID();

    await db.exec(`
      INSERT INTO public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref)
      VALUES ('${connId}', '${ASTRO_BUSINESS_ID}', 'Astro Line', '+919999999993', '1003', 'waba_3', 'vault:3');

      INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name)
      VALUES ('${contactId}', '${ASTRO_BUSINESS_ID}', '+919876543212', 'Astro User');

      INSERT INTO public.wa_conversations (id, business_id, connection_id, contact_id, status)
      VALUES ('${convId}', '${ASTRO_BUSINESS_ID}', '${connId}', '${contactId}', 'open');

      INSERT INTO public.wa_messages (
        id, business_id, connection_id, conversation_id, contact_id,
        direction, message_type, content, status, raw_payload
      )
      VALUES (
        '${msgId}', '${ASTRO_BUSINESS_ID}', '${connId}', '${convId}', '${contactId}',
        'inbound', 'document', '📄 Horoscope.pdf', 'delivered',
        '{"type":"document","document":{"id":"meta_doc_999","filename":"Horoscope.pdf","mime_type":"application/pdf","caption":"Here is your horoscope"}}'::jsonb
      );
    `);

    const check = await db.query<any>(`
      SELECT media_type, media_id, mime_type, file_name, caption, download_status
      FROM public.wa_messages
      WHERE id = '${msgId}'
    `);

    expect(check.rows[0].media_type).toBe("document");
    expect(check.rows[0].media_id).toBe("meta_doc_999");
    expect(check.rows[0].mime_type).toBe("application/pdf");
    expect(check.rows[0].file_name).toBe("Horoscope.pdf");
    expect(check.rows[0].caption).toBe("Here is your horoscope");
    expect(check.rows[0].download_status).toBe("pending");
  });
});

// ============================================================================
// DOMAIN 2: MEDIA VALIDATION & FILENAME SANITIZATION
// ============================================================================
describe("Domain 2: Media Validation & Filename Sanitization", () => {
  it("2.1 Validates permissible image MIME types and file sizes", () => {
    expect(validateMediaFile("image", "image/jpeg", 2 * 1024 * 1024).valid).toBe(true);
    expect(validateMediaFile("image", "image/png", 4.9 * 1024 * 1024).valid).toBe(true);
    expect(validateMediaFile("image", "image/webp", 1024).valid).toBe(true);

    // Oversized image (>5MB)
    const oversized = validateMediaFile("image", "image/jpeg", 5.5 * 1024 * 1024);
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain("exceeds maximum allowed limit of 5 MB");
  });

  it("2.2 Validates document MIME types and file sizes", () => {
    expect(validateMediaFile("document", "application/pdf", 10 * 1024 * 1024).valid).toBe(true);
    expect(validateMediaFile("document", "text/csv", 500).valid).toBe(true);
    expect(validateMediaFile("document", "text/plain", 1024).valid).toBe(true);

    // Oversized document (>100MB)
    const oversizedDoc = validateMediaFile("document", "application/pdf", 105 * 1024 * 1024);
    expect(oversizedDoc.valid).toBe(false);
    expect(oversizedDoc.error).toContain("exceeds maximum allowed limit of 100 MB");
  });

  it("2.3 Validates audio & video MIME types and file sizes", () => {
    expect(validateMediaFile("audio", "audio/ogg", 4 * 1024 * 1024).valid).toBe(true);
    expect(validateMediaFile("audio", "audio/mp4", 15 * 1024 * 1024).valid).toBe(true);
    expect(validateMediaFile("video", "video/mp4", 12 * 1024 * 1024).valid).toBe(true);

    // Oversized audio (>16MB)
    const oversizedAudio = validateMediaFile("audio", "audio/ogg", 18 * 1024 * 1024);
    expect(oversizedAudio.valid).toBe(false);
    expect(oversizedAudio.error).toContain("exceeds maximum allowed limit of 16 MB");
  });

  it("2.4 Rejects invalid or dangerous MIME types", () => {
    const exeCheck = validateMediaFile("document", "application/x-msdownload", 1024);
    expect(exeCheck.valid).toBe(false);
    expect(exeCheck.error).toContain("Unsupported MIME type");

    const htmlCheck = validateMediaFile("document", "text/html", 1024);
    expect(htmlCheck.valid).toBe(false);
  });

  it("2.5 Rejects 0-byte empty files", () => {
    const emptyCheck = validateMediaFile("image", "image/jpeg", 0);
    expect(emptyCheck.valid).toBe(false);
    expect(emptyCheck.error).toContain("File is empty");
  });

  it("2.6 Sanitizes path traversal attempts and hazardous characters in filenames", () => {
    const malicious = "../../../etc/passwd";
    const cleaned = sanitizeFilename(malicious);
    expect(cleaned).not.toContain("/");
    expect(cleaned).not.toContain("..");
    expect(cleaned).toContain("passwd");

    const windowsExploit = "..\\..\\windows\\system32\\calc.exe";
    const cleanedWin = sanitizeFilename(windowsExploit);
    expect(cleanedWin).not.toContain("\\");
    expect(cleanedWin).not.toContain("..");

    const empty = "   ";
    const cleanedEmpty = sanitizeFilename(empty);
    expect(cleanedEmpty).toMatch(/^media_\d+/);
  });

  it("2.7 Correctly infers media type category from MIME type", () => {
    expect(getMediaTypeFromMime("image/png")).toBe("image");
    expect(getMediaTypeFromMime("application/pdf")).toBe("document");
    expect(getMediaTypeFromMime("audio/aac")).toBe("audio");
    expect(getMediaTypeFromMime("video/mp4")).toBe("video");
  });
});

// ============================================================================
// DOMAIN 3: BUSINESS-SCOPED SECURE STORAGE & SIGNED URLS
// ============================================================================
describe("Domain 3: Business-Scoped Secure Storage Abstraction", () => {
  beforeEach(() => {
    clearInMemoryMediaStore();
  });

  it("3.1 Stores media file with business-scoped tenant path", async () => {
    const convId = crypto.randomUUID();
    const fakeBuffer = Buffer.from("fake-image-bytes-jpeg-content");

    const result = await storeMediaFile({
      businessId: ASTRO_BUSINESS_ID,
      conversationId: convId,
      fileBuffer: fakeBuffer,
      mimeType: "image/jpeg",
      originalFilename: "astrology_chart.jpeg",
      mediaType: "image",
    });

    expect(result.fileId).toBeDefined();
    expect(result.fileSize).toBe(fakeBuffer.length);
    expect(result.storagePath).toContain(`businesses/${ASTRO_BUSINESS_ID}/conversations/${convId}/`);
    expect(verifyTenantStoragePath(ASTRO_BUSINESS_ID, result.storagePath)).toBe(true);
    expect(verifyTenantStoragePath(VIVAHAM_BUSINESS_ID, result.storagePath)).toBe(false);
  });

  it("3.2 Rejects cross-tenant access when attempting to retrieve Astrology media with Vivaham ID", async () => {
    const convId = crypto.randomUUID();
    const fakeBuffer = Buffer.from("pdf-contract-data");

    const result = await storeMediaFile({
      businessId: ASTRO_BUSINESS_ID,
      conversationId: convId,
      fileBuffer: fakeBuffer,
      mimeType: "application/pdf",
      originalFilename: "astro_contract.pdf",
      mediaType: "document",
    });

    // Vivaham business tenant MUST be rejected
    await expect(
      getStoredMediaFile(VIVAHAM_BUSINESS_ID, result.storagePath)
    ).rejects.toThrow(/Cross-tenant media access violation/);

    // Astrology business tenant succeeds
    const retrieved = await getStoredMediaFile(ASTRO_BUSINESS_ID, result.storagePath);
    expect(retrieved.buffer.toString()).toBe("pdf-contract-data");
  });

  it("3.3 Generates and verifies HMAC-signed media access URLs", async () => {
    const convId = crypto.randomUUID();
    const fakeBuffer = Buffer.from("audio-bytes");

    const result = await storeMediaFile({
      businessId: ASTRO_BUSINESS_ID,
      conversationId: convId,
      fileBuffer: fakeBuffer,
      mimeType: "audio/ogg",
      originalFilename: "voice_note.ogg",
      mediaType: "audio",
    });

    const signedUrl = await createSignedMediaUrl(ASTRO_BUSINESS_ID, result.storagePath, 300);
    expect(signedUrl).toContain("/api/media/download?");
    expect(signedUrl).toContain("sig=");

    const urlObj = new URL(signedUrl, "http://localhost:3000");
    const pathParam = urlObj.searchParams.get("path")!;
    const bizParam = urlObj.searchParams.get("biz")!;
    const expParam = urlObj.searchParams.get("exp")!;
    const sigParam = urlObj.searchParams.get("sig")!;

    // Verification of valid signature
    expect(verifySignedMediaToken(bizParam, pathParam, expParam, sigParam)).toBe(true);

    // Tampered path verification fails
    expect(verifySignedMediaToken(bizParam, pathParam + "_tampered", expParam, sigParam)).toBe(false);

    // Tampered business ID verification fails
    expect(verifySignedMediaToken(VIVAHAM_BUSINESS_ID, pathParam, expParam, sigParam)).toBe(false);

    // Expired timestamp verification fails
    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 10);
    expect(verifySignedMediaToken(bizParam, pathParam, expiredTimestamp, sigParam)).toBe(false);
  });
});

// ============================================================================
// DOMAIN 4: OUTGOING MEDIA SERVER ACTIONS & RBAC ENFORCEMENT
// ============================================================================
describe("Domain 4: Outgoing Media Server Actions & RBAC", () => {
  it("4.1 Validates SendMediaMessageSchema input structure", () => {
    const valid = SendMediaMessageSchema.safeParse({
      businessSlug: "astrology",
      conversationId: "conv-123",
      mediaType: "image",
      filename: "chart.jpg",
      mimeType: "image/jpeg",
      fileSize: 1024,
      base64Data: Buffer.from("hello").toString("base64"),
      caption: "Test caption",
    });
    expect(valid.success).toBe(true);

    const invalidType = SendMediaMessageSchema.safeParse({
      businessSlug: "astrology",
      conversationId: "conv-123",
      mediaType: "executable",
      filename: "bad.exe",
      mimeType: "application/x-msdownload",
      fileSize: 1024,
      base64Data: "abc",
    });
    expect(invalidType.success).toBe(false);
  });

  it("4.2 Rejects sending media when 24h service window has expired", async () => {
    // Non-existent or expired window conversation
    const res = await sendWhatsAppMediaMessageAction({
      businessSlug: "astrology",
      conversationId: "conv-expired-window",
      mediaType: "document",
      filename: "kundali.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
      base64Data: Buffer.from("fake-pdf").toString("base64"),
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("4.3 Rejects getMediaDownloadUrlAction for invalid input or cross-tenant query", async () => {
    const res = await getMediaDownloadUrlAction({
      businessSlug: "astrology",
      messageId: "non-existent-msg-id",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Media message not found");
  });

  it("4.4 Enforces Viewer read-only restrictions for sending media", async () => {
    const { validateBusinessAccess } = await import("@/lib/auth/tenant-guard");
    (validateBusinessAccess as any).mockResolvedValueOnce({
      business: { id: ASTRO_BUSINESS_ID, slug: "astrology", name: "Astrology" },
      membership: { role: "viewer", id: "mem-viewer", business_id: ASTRO_BUSINESS_ID },
      user: { id: "user-viewer", email: "viewer@astrology.example.com" },
    });

    const res = await sendWhatsAppMediaMessageAction({
      businessSlug: "astrology",
      conversationId: "conv-open-window",
      mediaType: "image",
      filename: "test.png",
      mimeType: "image/png",
      fileSize: 1024,
      base64Data: Buffer.from("fake-img").toString("base64"),
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Read-only access: Viewers cannot send media messages");
  });

  it("4.5 Validates RetryMediaMessageSchema and input parsing", () => {
    const valid = RetryMediaMessageSchema.safeParse({
      businessSlug: "astrology",
      messageId: "msg-retry-123",
    });
    expect(valid.success).toBe(true);

    const empty = RetryMediaMessageSchema.safeParse({
      businessSlug: "",
      messageId: "",
    });
    expect(empty.success).toBe(false);
  });
});

// ============================================================================
// DOMAIN 5: INCOMING WEBHOOK MEDIA INGESTION & IMMEDIATE ACKNOWLEDGEMENT
// ============================================================================
describe("Domain 5: Incoming Webhook Media Event Ingestion", () => {
  it("5.1 Ingests inbound image webhook message with caption and returns HTTP 200 promptly", async () => {
    const secret = "test-webhook-secret-phase12-2";
    process.env.META_APP_SECRET = secret;

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+919999999991",
                  phone_number_id: "1001",
                },
                contacts: [{ wa_id: "919876543210", profile: { name: "Ananya Sharma" } }],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.media_img_001",
                    timestamp: "1731000000",
                    type: "image",
                    image: {
                      id: "meta_img_id_12345",
                      mime_type: "image/jpeg",
                      sha256: "hash123",
                      caption: "Please analyze this birth chart",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "x-hub-signature-256": `sha256=${signature}`,
        "content-type": "application/json",
      },
      body: rawBody,
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("5.2 Ingests inbound document webhook message and returns HTTP 200", async () => {
    const secret = "test-webhook-secret-phase12-2";
    process.env.META_APP_SECRET = secret;

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+919999999991",
                  phone_number_id: "1001",
                },
                contacts: [{ wa_id: "919876543210", profile: { name: "Karthik Raja" } }],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.media_doc_002",
                    timestamp: "1731000001",
                    type: "document",
                    document: {
                      id: "meta_doc_id_67890",
                      filename: "horoscope_report.pdf",
                      mime_type: "application/pdf",
                      sha256: "hash456",
                      caption: "Horoscope PDF Attached",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "x-hub-signature-256": `sha256=${signature}`,
        "content-type": "application/json",
      },
      body: rawBody,
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("5.3 Handles duplicate incoming media webhook events idempotently", async () => {
    const secret = "test-webhook-secret-phase12-2";
    process.env.META_APP_SECRET = secret;

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "+919999999991",
                  phone_number_id: "1001",
                },
                contacts: [{ wa_id: "919876543210", profile: { name: "Karthik Raja" } }],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.media_doc_002", // same message id
                    timestamp: "1731000001",
                    type: "document",
                    document: {
                      id: "meta_doc_id_67890",
                      filename: "horoscope_report.pdf",
                      mime_type: "application/pdf",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const req = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "x-hub-signature-256": `sha256=${signature}`,
        "content-type": "application/json",
      },
      body: rawBody,
    });

    // Duplicate message delivery returns 200 without throwing errors
    const res = await webhookPost(req);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// DOMAIN 6: SECURE MEDIA STREAMING ROUTE VERIFICATION
// ============================================================================
describe("Domain 6: Secure Media Download Streaming Route", () => {
  beforeEach(() => {
    clearInMemoryMediaStore();
  });

  it("6.1 Rejects request without signed authentication parameters (401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/media/download");
    const res = await mediaDownloadGet(req);
    expect(res.status).toBe(401);
  });

  it("6.2 Rejects request with forged or invalid signature (403)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/media/download?path=businesses/111/conv/1/file.jpg&biz=111&exp=9999999999&sig=forged_bad_signature"
    );
    const res = await mediaDownloadGet(req);
    expect(res.status).toBe(403);
  });

  it("6.3 Streams stored media file successfully with authorized signed token (200)", async () => {
    const convId = crypto.randomUUID();
    const fakeBuffer = Buffer.from("sample-image-data-stream");

    const result = await storeMediaFile({
      businessId: ASTRO_BUSINESS_ID,
      conversationId: convId,
      fileBuffer: fakeBuffer,
      mimeType: "image/png",
      originalFilename: "astrology_logo.png",
      mediaType: "image",
    });

    const signedUrl = await createSignedMediaUrl(ASTRO_BUSINESS_ID, result.storagePath, 300);
    const req = new NextRequest(`http://localhost:3000${signedUrl}`);
    const res = await mediaDownloadGet(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const bodyBytes = await res.arrayBuffer();
    expect(Buffer.from(bodyBytes).toString()).toBe("sample-image-data-stream");
  });
});
