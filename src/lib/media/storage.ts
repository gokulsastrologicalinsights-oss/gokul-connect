import { SupportedMediaType } from "@/types/database";
import crypto from "crypto";

export const MEDIA_STORAGE_BUCKET = "whatsapp-media";
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

/**
 * Meta WhatsApp Cloud API Maximum File Size Limits
 */
export const MEDIA_SIZE_LIMITS: Record<SupportedMediaType, number> = {
  image: 5 * 1024 * 1024, // 5 MB
  document: 100 * 1024 * 1024, // 100 MB
  audio: 16 * 1024 * 1024, // 16 MB
  video: 16 * 1024 * 1024, // 16 MB
};

/**
 * Permitted MIME types per media category as defined by Meta WhatsApp Cloud API
 */
export const ALLOWED_MIME_TYPES: Record<SupportedMediaType, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  document: [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
  ],
  audio: [
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/amr",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
  ],
  video: ["video/mp4", "video/3gpp"],
};

/**
 * Sanitize untrusted filenames to prevent directory traversal and filesystem exploits.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return `media_${Date.now()}`;
  }

  // Remove directory traversal characters
  let clean = filename.replace(/[/\\?%*:|"<>]/g, "_");
  clean = clean.replace(/\.\./g, "_");
  clean = clean.trim();

  // Strip leading dots or underscores
  clean = clean.replace(/^[._]+/, "");

  if (clean.length === 0) {
    clean = `media_${Date.now()}`;
  }

  // Limit filename length to 100 characters while preserving extension
  if (clean.length > 100) {
    const lastDot = clean.lastIndexOf(".");
    if (lastDot > 0 && lastDot > clean.length - 10) {
      const ext = clean.slice(lastDot);
      clean = clean.slice(0, 95 - ext.length) + ext;
    } else {
      clean = clean.slice(0, 95);
    }
  }

  return clean;
}

/**
 * Determine supported media type category from MIME type
 */
export function getMediaTypeFromMime(mimeType: string): SupportedMediaType | null {
  const normalized = (mimeType || "").toLowerCase().trim();
  for (const [type, allowedList] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (allowedList.includes(normalized)) {
      return type as SupportedMediaType;
    }
  }
  // Generic fallback checks
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  if (
    normalized.startsWith("application/") ||
    normalized.startsWith("text/")
  ) {
    return "document";
  }
  return null;
}

/**
 * Validate media file size and MIME type
 */
export function validateMediaFile(
  type: SupportedMediaType,
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  const normalizedMime = (mimeType || "").toLowerCase().trim();

  const allowedList = ALLOWED_MIME_TYPES[type];
  if (!allowedList || !allowedList.includes(normalizedMime)) {
    return {
      valid: false,
      error: `Unsupported MIME type "${mimeType}" for media type "${type}". Allowed types: ${allowedList?.join(", ")}`,
    };
  }

  const maxSize = MEDIA_SIZE_LIMITS[type];
  if (fileSize > maxSize) {
    const maxMb = (maxSize / (1024 * 1024)).toFixed(0);
    const actualMb = (fileSize / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${actualMb} MB) exceeds maximum allowed limit of ${maxMb} MB for ${type} messages.`,
    };
  }

  if (fileSize <= 0) {
    return {
      valid: false,
      error: "File is empty (0 bytes).",
    };
  }

  return { valid: true };
}

/**
 * Build business-scoped storage path to guarantee tenant isolation
 */
export function buildBusinessStoragePath(
  businessId: string,
  conversationId: string,
  fileId: string,
  sanitizedFilename: string
): string {
  return `businesses/${businessId}/conversations/${conversationId}/${fileId}-${sanitizedFilename}`;
}

export function buildBusinessLogoStoragePath(
  businessId: string,
  fileId: string,
  sanitizedFilename: string
): string {
  return `businesses/${businessId}/branding/${fileId}-${sanitizedFilename}`;
}

function inferImageMimeFromPath(storagePath: string): string | null {
  const lower = storagePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return null;
}

/**
 * Validate a custom business logo file (PNG, JPEG, WEBP, SVG) with magic-byte & SVG XSS safety checks.
 */
export function validateBusinessLogoFile(
  mimeType: string,
  fileBuffer: Buffer,
  filename: string
): { valid: boolean; error?: string; normalizedMime?: string } {
  const normalizedMime = (mimeType || "").toLowerCase().trim();
  if (!(ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(normalizedMime)) {
    return {
      valid: false,
      error: `Unsupported logo format "${mimeType}". Allowed formats: PNG, JPEG, WebP, SVG.`,
    };
  }

  if (!fileBuffer || fileBuffer.length <= 0) {
    return { valid: false, error: "Logo file is empty (0 bytes)." };
  }

  if (fileBuffer.length > MAX_LOGO_SIZE_BYTES) {
    const actualMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Logo file size (${actualMb} MB) exceeds maximum allowed limit of 2 MB.`,
    };
  }

  if (normalizedMime === "image/png") {
    const isPng =
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x89 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x4e &&
      fileBuffer[3] === 0x47;
    if (!isPng) {
      return { valid: false, error: "Invalid PNG file signature." };
    }
  } else if (normalizedMime === "image/jpeg") {
    const isJpg =
      fileBuffer.length >= 3 &&
      fileBuffer[0] === 0xff &&
      fileBuffer[1] === 0xd8 &&
      fileBuffer[2] === 0xff;
    if (!isJpg) {
      return { valid: false, error: "Invalid JPEG file signature." };
    }
  } else if (normalizedMime === "image/webp") {
    const isWebp =
      fileBuffer.length >= 12 &&
      fileBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      fileBuffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isWebp) {
      return { valid: false, error: "Invalid WebP file signature." };
    }
  } else if (normalizedMime === "image/svg+xml") {
    const text = fileBuffer.toString("utf8");
    if (!/<svg[\s>]/i.test(text)) {
      return { valid: false, error: "Invalid SVG file: missing <svg> root element." };
    }
    const unsafePatterns = [
      /<script\b/i,
      /<foreignObject\b/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
      /\son[a-z]+\s*=/i,
      /javascript\s*:/i,
      /vbscript\s*:/i,
    ];
    for (const pattern of unsafePatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          error: "SVG contains prohibited active scripting or embedded HTML elements.",
        };
      }
    }
  }

  return { valid: true, normalizedMime };
}

/**
 * Verify storage path matches business tenant boundary
 */
export function verifyTenantStoragePath(businessId: string, storagePath: string): boolean {
  if (!storagePath || !businessId) return false;
  const prefix = `businesses/${businessId}/`;
  return storagePath.startsWith(prefix);
}

// ============================================================================
// IN-MEMORY / HYBRID STORAGE DRIVER
// Works seamlessly in serverless, CI, unit tests and production with Supabase Storage
// ============================================================================

interface StoredMediaItem {
  buffer: Buffer;
  mimeType: string;
  size: number;
  businessId: string;
  storagePath: string;
  createdAt: string;
}

const globalMediaRef = globalThis as unknown as {
  __gokulInMemoryMediaStore?: Map<string, StoredMediaItem>;
};
const inMemoryMediaStore: Map<string, StoredMediaItem> =
  globalMediaRef.__gokulInMemoryMediaStore ??
  (globalMediaRef.__gokulInMemoryMediaStore = new Map<string, StoredMediaItem>());

export function clearInMemoryMediaStore(): void {
  inMemoryMediaStore.clear();
}

/**
 * Securely store a media buffer in business-scoped private storage
 */
export async function storeMediaFile(params: {
  businessId: string;
  conversationId: string;
  fileBuffer: Buffer;
  mimeType: string;
  originalFilename: string;
  mediaType: SupportedMediaType;
}): Promise<{
  fileId: string;
  storagePath: string;
  fileSize: number;
  sanitizedFilename: string;
  sha256: string;
}> {
  const { businessId, conversationId, fileBuffer, mimeType, originalFilename, mediaType } = params;

  const validation = validateMediaFile(mediaType, mimeType, fileBuffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileId = crypto.randomUUID();
  const sanitizedFilename = sanitizeFilename(originalFilename);
  const storagePath = buildBusinessStoragePath(businessId, conversationId, fileId, sanitizedFilename);
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Attempt to use Supabase Storage Admin Client if configured
  let storedToSupabase = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createAdminClient();

      const { error: uploadError } = await supabaseAdmin.storage
        .from(MEDIA_STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (!uploadError) {
        storedToSupabase = true;
      }
    } catch {
      // Fallback to in-memory store in local/test environment
    }
  }

  // Always register in local media store cache for fast, reliable read/test execution
  inMemoryMediaStore.set(storagePath, {
    buffer: fileBuffer,
    mimeType,
    size: fileBuffer.length,
    businessId,
    storagePath,
    createdAt: new Date().toISOString(),
  });

  return {
    fileId,
    storagePath,
    fileSize: fileBuffer.length,
    sanitizedFilename,
    sha256,
  };
}

/**
 * Retrieve a stored media file ensuring strict business tenant isolation
 */
export async function getStoredMediaFile(
  businessId: string,
  storagePath: string
): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
  if (!verifyTenantStoragePath(businessId, storagePath)) {
    throw new Error(`Cross-tenant media access violation: Path does not belong to business "${businessId}".`);
  }

  const localItem = inMemoryMediaStore.get(storagePath);
  if (localItem) {
    return {
      buffer: localItem.buffer,
      mimeType: localItem.mimeType,
      size: localItem.size,
    };
  }

  // Attempt retrieval from Supabase Storage
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createAdminClient();

      const { data, error } = await supabaseAdmin.storage
        .from(MEDIA_STORAGE_BUCKET)
        .download(storagePath);

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const rawType = data.type && data.type !== "application/octet-stream" ? data.type : null;
        return {
          buffer,
          mimeType: rawType || inferImageMimeFromPath(storagePath) || "application/octet-stream",
          size: buffer.length,
        };
      }
    } catch {
      // Fall through to error
    }
  }

  throw new Error(`Media file not found at storage path: ${storagePath}`);
}

/**
 * Generate a short-lived signed URL for authorized viewing/downloading
 */
export async function createSignedMediaUrl(
  businessId: string,
  storagePath: string,
  expiresInSeconds: number = 300
): Promise<string> {
  if (!verifyTenantStoragePath(businessId, storagePath)) {
    throw new Error(`Cross-tenant media access violation: Path does not belong to business "${businessId}".`);
  }

  // If Supabase Storage is configured, generate a signed URL
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createAdminClient();

      const { data, error } = await supabaseAdmin.storage
        .from(MEDIA_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // Fall through to secure tokenized route
    }
  }

  // Fallback: Generate an authorized HMAC-signed local media route URL
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const secret = process.env.APP_ENCRYPTION_SECRET || "dev-media-secret-key-32-chars-long";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${businessId}:${storagePath}:${expiresAt}`)
    .digest("hex");

  return `/api/media/download?path=${encodeURIComponent(storagePath)}&biz=${encodeURIComponent(businessId)}&exp=${expiresAt}&sig=${signature}`;
}

/**
 * Store a custom business logo file under tenant-isolated `businesses/<id>/branding/`.
 */
export async function storeBusinessLogoFile(params: {
  businessId: string;
  fileBuffer: Buffer;
  mimeType: string;
  originalFilename: string;
}): Promise<{
  fileId: string;
  storagePath: string;
  fileSize: number;
  sanitizedFilename: string;
  logoUrl: string;
}> {
  const { businessId, fileBuffer, mimeType, originalFilename } = params;
  const validation = validateBusinessLogoFile(mimeType, fileBuffer, originalFilename);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid business logo file.");
  }

  const fileId = crypto.randomUUID();
  const sanitizedFilename = sanitizeFilename(originalFilename);
  const storagePath = buildBusinessLogoStoragePath(businessId, fileId, sanitizedFilename);

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createAdminClient();

      let { error: uploadError } = await supabaseAdmin.storage
        .from(MEDIA_STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError && /bucket.*not found/i.test(uploadError.message || "")) {
        await supabaseAdmin.storage.createBucket(MEDIA_STORAGE_BUCKET, {
          public: false,
          fileSizeLimit: 20 * 1024 * 1024,
        });
        const retryRes = await supabaseAdmin.storage
          .from(MEDIA_STORAGE_BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });
        uploadError = retryRes.error;
      }
    } catch {
      // Fallback to in-memory store in local/test environment
    }
  }

  inMemoryMediaStore.set(storagePath, {
    buffer: fileBuffer,
    mimeType,
    size: fileBuffer.length,
    businessId,
    storagePath,
    createdAt: new Date().toISOString(),
  });

  const logoUrl = `/api/media/download?path=${encodeURIComponent(storagePath)}&biz=${encodeURIComponent(businessId)}`;
  return {
    fileId,
    storagePath,
    fileSize: fileBuffer.length,
    sanitizedFilename,
    logoUrl,
  };
}

/**
 * Delete a previously stored business logo file (best-effort cleanup).
 */
export async function deleteBusinessLogoFile(
  businessId: string,
  logoUrlOrPath: string
): Promise<void> {
  if (!logoUrlOrPath) return;

  let storagePath = logoUrlOrPath;
  if (logoUrlOrPath.includes("/api/media/download")) {
    try {
      const parsed = new URL(logoUrlOrPath, "http://localhost");
      const pathParam = parsed.searchParams.get("path");
      if (pathParam) storagePath = pathParam;
    } catch {
      return;
    }
  }

  if (!verifyTenantStoragePath(businessId, storagePath)) {
    return;
  }

  inMemoryMediaStore.delete(storagePath);

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.storage.from(MEDIA_STORAGE_BUCKET).remove([storagePath]);
    } catch {
      // Best effort
    }
  }
}

/**
 * Validate an HMAC-signed local media token
 */
export function verifySignedMediaToken(
  businessId: string,
  storagePath: string,
  expiresAtStr: string,
  signature: string
): boolean {
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
    return false; // Expired
  }

  if (!verifyTenantStoragePath(businessId, storagePath)) {
    return false;
  }

  const secret = process.env.APP_ENCRYPTION_SECRET || "dev-media-secret-key-32-chars-long";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${businessId}:${storagePath}:${expiresAt}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"));
  } catch {
    return false;
  }
}
