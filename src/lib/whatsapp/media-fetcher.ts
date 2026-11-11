import { getMetaMediaInfo, downloadMetaMediaContent, sanitizeMetaLog } from "./client";
import { storeMediaFile, validateMediaFile, MEDIA_SIZE_LIMITS } from "@/lib/media/storage";
import { SupportedMediaType } from "@/types/database";
import { getDecryptedConnectionCredentials } from "./service";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export interface RetrieveMediaResult {
  success: boolean;
  messageId: string;
  storagePath?: string;
  fileId?: string;
  fileSize?: number;
  mimeType?: string;
  sanitizedFilename?: string;
  error?: string;
  alreadyDownloaded?: boolean;
}

export interface RetrieveMediaOptions {
  supabaseClient?: any;
  maxRetries?: number;
  overrideAccessToken?: string;
}

/**
 * Helper to pause execution with exponential backoff delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeMediaError(msg: string, token?: string): string {
  let cleaned = sanitizeMetaLog(msg, token);
  cleaned = cleaned
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/EAA[A-Za-z0-9_\-\.]+/gi, "[REDACTED_ACCESS_TOKEN]")
    .replace(/access_token=[^&\s'"]+/gi, "access_token=[REDACTED_ACCESS_TOKEN]")
    .replace(/(secret|token|password|key)\s*[:=]\s*['"]?[^\s'"]+/gi, "$1=[REDACTED]");
  if (token && token.length > 5) {
    cleaned = cleaned.replaceAll(token, "[REDACTED]");
  }
  return cleaned;
}

/**
 * Retrieve incoming media metadata from Meta Graph API, download the raw content,
 * enforce file size & MIME boundaries, store the binary into private tenant-scoped storage,
 * and update message and media files records.
 *
 * Implements:
 * 1. Duplicate download prevention.
 * 2. Transient error retries with exponential backoff (up to maxRetries).
 * 3. File size & MIME validation.
 * 4. Token & credential redaction in all failure modes.
 * 5. Strict multi-tenant boundaries.
 */
export async function retrieveAndPersistInboundMedia(
  businessId: string,
  messageId: string,
  options: RetrieveMediaOptions = {}
): Promise<RetrieveMediaResult> {
  if (!businessId || !messageId) {
    return {
      success: false,
      messageId,
      error: "businessId and messageId are required.",
    };
  }

  const maxRetries = options.maxRetries ?? 3;

  // Resolve Supabase client
  let supabase = options.supabaseClient;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = createAdminClient();
    } catch {
      supabase = null;
    }
  }

  if (!supabase) {
    return {
      success: false,
      messageId,
      error: "Supabase client not available for media retrieval.",
    };
  }

  // 1. Fetch message record and verify tenant boundary
  const { data: msg, error: msgErr } = await supabase
    .from("wa_messages")
    .select("id, business_id, connection_id, conversation_id, message_type, media_type, media_id, file_name, file_size, mime_type, storage_path, download_status, raw_payload")
    .eq("id", messageId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (msgErr || !msg) {
    return {
      success: false,
      messageId,
      error: `Message ${messageId} not found or cross-tenant access violation.`,
    };
  }

  // 2. Prevent duplicate downloads: if already successfully downloaded and storage path exists, return early
  if (msg.download_status === "downloaded" && msg.storage_path) {
    return {
      success: true,
      messageId,
      storagePath: msg.storage_path,
      fileSize: Number(msg.file_size || 0),
      mimeType: msg.mime_type || "application/octet-stream",
      sanitizedFilename: msg.file_name || "download",
      alreadyDownloaded: true,
    };
  }

  // 3. Resolve Media ID and Media Type
  const mediaType: SupportedMediaType =
    (msg.media_type as SupportedMediaType) ||
    (["image", "document", "audio", "video"].includes(msg.message_type)
      ? (msg.message_type as SupportedMediaType)
      : "image");

  let metaMediaId = msg.media_id;
  if (!metaMediaId && msg.raw_payload) {
    const raw = typeof msg.raw_payload === "string" ? JSON.parse(msg.raw_payload) : msg.raw_payload;
    metaMediaId =
      raw[mediaType]?.id ||
      raw.image?.id ||
      raw.document?.id ||
      raw.audio?.id ||
      raw.video?.id ||
      null;
  }

  if (!metaMediaId) {
    await supabase
      .from("wa_messages")
      .update({
        download_status: "failed",
        media_error: "No Meta media ID associated with this message.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("business_id", businessId);

    return {
      success: false,
      messageId,
      error: "No Meta media ID found in message payload.",
    };
  }

  // 4. Resolve Meta access token
  let accessToken = options.overrideAccessToken;
  if (!accessToken) {
    try {
      const credentials = await getDecryptedConnectionCredentials(
        businessId,
        msg.connection_id,
        supabase
      );
      accessToken = credentials.accessToken;
    } catch (credErr: any) {
      // Check test token fallback
      accessToken = process.env.META_TEST_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
      if (!accessToken) {
        const safeError = sanitizeMetaLog(
          credErr?.message || "Failed to retrieve WhatsApp connection credentials.",
          ""
        );
        await supabase
          .from("wa_messages")
          .update({
            download_status: "failed",
            media_error: safeError,
            updated_at: new Date().toISOString(),
          })
          .eq("id", messageId)
          .eq("business_id", businessId);

        return {
          success: false,
          messageId,
          error: safeError,
        };
      }
    }
  }

  // 5. Retrieve Meta media metadata and binary content with transient retries
  let lastError: string = "Unknown error";
  let metaInfo: { id: string; url: string; mime_type: string; file_size?: number } | null = null;
  let fileBuffer: Buffer | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Step A: Fetch temporary URL & MIME from Meta Graph API
      metaInfo = await getMetaMediaInfo(metaMediaId, accessToken);

      // Pre-flight file size check from metadata if available
      if (metaInfo.file_size) {
        const maxSize = MEDIA_SIZE_LIMITS[mediaType as keyof typeof MEDIA_SIZE_LIMITS];
        if (metaInfo.file_size > maxSize) {
          const maxMb = (maxSize / (1024 * 1024)).toFixed(0);
          const actualMb = (metaInfo.file_size / (1024 * 1024)).toFixed(2);
          throw new Error(
            `File size (${actualMb} MB) exceeds maximum allowed limit of ${maxMb} MB for ${mediaType}.`
          );
        }
      }

      // Step B: Download binary content from Meta's temporary URL
      const arrayBuffer = await downloadMetaMediaContent(metaInfo.url, accessToken);
      fileBuffer = Buffer.from(arrayBuffer);

      // Step C: Validate binary against file size limit and MIME
      const validation = validateMediaFile(mediaType, metaInfo.mime_type, fileBuffer.length);
      if (!validation.valid) {
        throw new Error(validation.error || "File validation failed.");
      }

      // Successfully retrieved and validated
      break;
    } catch (err: any) {
      lastError = sanitizeMediaError(err?.message || "Transient media download error", accessToken);
      if (attempt < maxRetries) {
        // Exponential backoff delay: 50ms, 100ms, 200ms...
        await sleep(Math.pow(2, attempt) * 25);
      }
    }
  }

  if (!fileBuffer || !metaInfo) {
    // All attempts failed; record failure in database
    await supabase
      .from("wa_messages")
      .update({
        download_status: "failed",
        media_error: lastError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("business_id", businessId);

    // Also update wa_media_files if row exists
    await supabase
      .from("wa_media_files")
      .update({
        download_status: "failed",
        error_message: lastError,
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", messageId)
      .eq("business_id", businessId);

    return {
      success: false,
      messageId,
      error: lastError,
    };
  }

  // 6. Store downloaded binary in persistent private storage
  try {
    const rawFilename =
      msg.file_name ||
      `${mediaType}_${Date.now()}.${metaInfo.mime_type.split("/")[1] || "bin"}`;

    const stored = await storeMediaFile({
      businessId,
      conversationId: msg.conversation_id,
      fileBuffer,
      mimeType: metaInfo.mime_type,
      originalFilename: rawFilename,
      mediaType,
    });

    const nowIso = new Date().toISOString();

    // 7. Update wa_messages record with storage path and status
    await supabase
      .from("wa_messages")
      .update({
        storage_path: stored.storagePath,
        media_url: null, // Never expose Meta URL or permanent storage URL directly
        file_name: stored.sanitizedFilename,
        file_size: stored.fileSize,
        mime_type: metaInfo.mime_type,
        media_type: mediaType,
        media_id: metaMediaId,
        download_status: "downloaded",
        downloaded_at: nowIso,
        media_error: null,
        updated_at: nowIso,
      })
      .eq("id", messageId)
      .eq("business_id", businessId);

    // 8. Upsert wa_media_files record
    await supabase.from("wa_media_files").upsert(
      {
        business_id: businessId,
        conversation_id: msg.conversation_id,
        message_id: messageId,
        media_type: mediaType,
        meta_media_id: metaMediaId,
        mime_type: metaInfo.mime_type,
        original_filename: stored.sanitizedFilename,
        file_size: stored.fileSize,
        storage_bucket: "whatsapp-media",
        storage_path: stored.storagePath,
        sha256: stored.sha256,
        direction: "inbound",
        download_status: "downloaded",
        error_message: null,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );

    return {
      success: true,
      messageId,
      storagePath: stored.storagePath,
      fileId: stored.fileId,
      fileSize: stored.fileSize,
      mimeType: metaInfo.mime_type,
      sanitizedFilename: stored.sanitizedFilename,
    };
  } catch (storageErr: any) {
    const safeError = sanitizeMetaLog(
      storageErr?.message || "Failed to persist media in storage.",
      accessToken
    );

    await supabase
      .from("wa_messages")
      .update({
        download_status: "failed",
        media_error: safeError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("business_id", businessId);

    return {
      success: false,
      messageId,
      error: safeError,
    };
  }
}

/**
 * Standard alias for retrieveAndPersistInboundMedia
 */
export const fetchAndPersistInboundMedia = retrieveAndPersistInboundMedia;
