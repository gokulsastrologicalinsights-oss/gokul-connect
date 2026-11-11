import { maskTokenForLogging } from "@/lib/crypto/encryption";
import type {
  MetaPhoneNumberDetails,
  MetaSendResponse,
  MetaSendTemplateMessagePayload,
  MetaSendTextMessagePayload,
} from "@/types/database";

const META_GRAPH_VERSION = "v26.0";
const META_GRAPH_BASE_URL = "https://graph.facebook.com";

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export class MetaCloudApiError extends Error {
  public readonly code: number;
  public readonly subcode?: number;
  public readonly fbtraceId?: string;
  public readonly errorType: string;

  constructor(error: MetaApiError, sanitizedUrl: string) {
    super(`Meta Cloud API Error (${error.code}${error.error_subcode ? `:${error.error_subcode}` : ""}): ${error.message} [URL: ${sanitizedUrl}]`);
    this.name = "MetaCloudApiError";
    this.code = error.code;
    this.subcode = error.error_subcode;
    this.fbtraceId = error.fbtrace_id;
    this.errorType = error.type;
  }
}

/**
 * Sanitize an error or string so that raw access tokens are never exposed in logs or errors.
 */
export function sanitizeMetaLog(input: string, tokenToMask?: string): string {
  let cleaned = input;
  if (tokenToMask && tokenToMask.length > 8) {
    const masked = maskTokenForLogging(tokenToMask);
    cleaned = cleaned.replaceAll(tokenToMask, masked);
  }
  // Generic token pattern scrubber (EAA...)
  cleaned = cleaned.replace(/EAA[A-Za-z0-9_-]{20,}/g, "EAA••••••••[MASKED]");
  return cleaned;
}

/**
 * Fetch WhatsApp Phone Number Details from Meta Graph API
 * Verifies that the Phone Number ID is valid and accessible by the token.
 */
export async function getMetaPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string
): Promise<MetaPhoneNumberDetails> {
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId.trim())}?fields=id,verified_name,display_phone_number,quality_rating,code_verification_status`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${phoneNumberId}`;
      throw new MetaCloudApiError(data.error || { message: "Unknown Meta API error", type: "OAuthException", code: response.status }, sanitizedUrl);
    }

    return data as MetaPhoneNumberDetails;
  } catch (err: any) {
    if (err instanceof MetaCloudApiError) throw err;
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Send a Text Message via Meta WhatsApp Cloud API
 */
export async function sendMetaTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string
): Promise<MetaSendResponse> {
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");
  if (!to?.trim()) throw new Error("Recipient phone number ('to') is required.");
  if (!body?.trim()) throw new Error("Message body is required.");

  // Clean phone number: remove spaces, dashes, parentheses
  const cleanTo = to.replace(/[^0-9]/g, "");

  const payload: MetaSendTextMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "text",
    text: {
      preview_url: false,
      body: body.trim(),
    },
  };

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId.trim())}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
      throw new MetaCloudApiError(data.error || { message: "Failed to send message", type: "WhatsAppError", code: response.status }, sanitizedUrl);
    }

    return data as MetaSendResponse;
  } catch (err: any) {
    if (err instanceof MetaCloudApiError) throw err;
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Send an Approved Template Message via Meta WhatsApp Cloud API
 */
export async function sendMetaTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  components?: Array<Record<string, unknown>>
): Promise<MetaSendResponse> {
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");
  if (!to?.trim()) throw new Error("Recipient phone number ('to') is required.");
  if (!templateName?.trim()) throw new Error("templateName is required.");

  const cleanTo = to.replace(/[^0-9]/g, "");

  const payload: MetaSendTemplateMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "template",
    template: {
      name: templateName.trim(),
      language: {
        code: languageCode.trim(),
      },
      ...(components && components.length > 0 ? { components } : {}),
    },
  };

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId.trim())}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
      throw new MetaCloudApiError(data.error || { message: "Failed to send template message", type: "WhatsAppError", code: response.status }, sanitizedUrl);
    }

    return data as MetaSendResponse;
  } catch (err: any) {
    if (err instanceof MetaCloudApiError) throw err;
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Mark an incoming WhatsApp message as read
 */
export async function markMetaMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<{ success: boolean }> {
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");
  if (!messageId?.trim()) throw new Error("messageId is required.");

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId.trim())}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId.trim(),
      }),
    });

    const data = await response.json();
    return { success: response.ok && Boolean(data.success) };
  } catch (err: any) {
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Upload a media file to Meta WhatsApp Cloud API
 */
export async function uploadMetaMedia(
  phoneNumberId: string,
  accessToken: string,
  fileBuffer: Buffer | Uint8Array,
  mimeType: string,
  filename: string
): Promise<{ id: string }> {
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");
  if (!fileBuffer || fileBuffer.length === 0) throw new Error("File buffer cannot be empty.");
  if (!mimeType?.trim()) throw new Error("MIME type is required.");

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId.trim())}/media`;

  const blob = new Blob([fileBuffer as any], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, filename || "upload");
  formData.append("type", mimeType);
  formData.append("messaging_product", "whatsapp");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${phoneNumberId}/media`;
      throw new MetaCloudApiError(
        data.error || { message: "Failed to upload media to Meta Cloud API", type: "WhatsAppError", code: response.status },
        sanitizedUrl
      );
    }

    if (!data.id) {
      throw new Error("Meta API response missing media ID.");
    }

    return { id: String(data.id) };
  } catch (err: any) {
    if (err instanceof MetaCloudApiError) throw err;
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Send an outbound media message (Image, Document, Audio, Video) via Meta WhatsApp Cloud API
 */
export async function sendMetaMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaType: "image" | "document" | "audio" | "video",
  mediaIdOrUrl: string,
  options?: {
    caption?: string;
    filename?: string;
  }
): Promise<MetaSendResponse> {
  if (!phoneNumberId?.trim()) throw new Error("phoneNumberId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");
  if (!to?.trim()) throw new Error("Recipient phone number ('to') is required.");
  if (!mediaIdOrUrl?.trim()) throw new Error("Media ID or URL is required.");

  const cleanTo = to.replace(/[^0-9]/g, "");
  const isUrl = mediaIdOrUrl.startsWith("http://") || mediaIdOrUrl.startsWith("https://");

  const mediaObject: Record<string, unknown> = isUrl
    ? { link: mediaIdOrUrl.trim() }
    : { id: mediaIdOrUrl.trim() };

  if (options?.caption?.trim() && (mediaType === "image" || mediaType === "document" || mediaType === "video")) {
    mediaObject.caption = options.caption.trim();
  }

  if (options?.filename?.trim() && mediaType === "document") {
    mediaObject.filename = options.filename.trim();
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: mediaType,
    [mediaType]: mediaObject,
  };

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId.trim())}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
      throw new MetaCloudApiError(
        data.error || { message: `Failed to send ${mediaType} message`, type: "WhatsAppError", code: response.status },
        sanitizedUrl
      );
    }

    return data as MetaSendResponse;
  } catch (err: any) {
    if (err instanceof MetaCloudApiError) throw err;
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Retrieve metadata and temporary download URL for a Meta media item
 */
export async function getMetaMediaInfo(
  mediaId: string,
  accessToken: string
): Promise<{
  id: string;
  url: string;
  mime_type: string;
  sha256?: string;
  file_size?: number;
}> {
  if (!mediaId?.trim()) throw new Error("mediaId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(mediaId.trim())}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${mediaId}`;
      throw new MetaCloudApiError(
        data.error || { message: "Failed to retrieve media metadata", type: "WhatsAppError", code: response.status },
        sanitizedUrl
      );
    }

    return {
      id: String(data.id),
      url: String(data.url),
      mime_type: String(data.mime_type || "application/octet-stream"),
      sha256: data.sha256 ? String(data.sha256) : undefined,
      file_size: data.file_size ? Number(data.file_size) : undefined,
    };
  } catch (err: any) {
    if (err instanceof MetaCloudApiError) throw err;
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}

/**
 * Download raw binary content from Meta's temporary media download URL
 */
export async function downloadMetaMediaContent(
  mediaUrl: string,
  accessToken: string
): Promise<ArrayBuffer> {
  if (!mediaUrl?.trim()) throw new Error("mediaUrl is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  try {
    const response = await fetch(mediaUrl.trim(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media bytes (HTTP ${response.status})`);
    }

    return await response.arrayBuffer();
  } catch (err: any) {
    throw new Error(sanitizeMetaLog(err.message, accessToken));
  }
}
