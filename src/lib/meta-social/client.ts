import { maskTokenForLogging } from "@/lib/crypto/encryption";
import type { MetaSocialPlatform } from "./types";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE_URL = "https://graph.facebook.com";

export class MetaSocialApiError extends Error {
  public readonly code: number;
  public readonly subcode?: number;
  public readonly fbtraceId?: string;
  public readonly errorType: string;

  constructor(error: any, sanitizedUrl: string) {
    super(
      `Meta Social API Error (${error.code || "UNKNOWN"}${
        error.error_subcode ? `:${error.error_subcode}` : ""
      }): ${error.message || "Unknown error"} [URL: ${sanitizedUrl}]`
    );
    this.name = "MetaSocialApiError";
    this.code = error.code || 500;
    this.subcode = error.error_subcode;
    this.fbtraceId = error.fbtrace_id;
    this.errorType = error.type || "OAuthException";
  }
}

/**
 * Sanitize strings so access tokens are never leaked into logs
 */
export function sanitizeSocialLog(input: string, tokenToMask?: string): string {
  let cleaned = input;
  if (tokenToMask && tokenToMask.length > 8) {
    const masked = maskTokenForLogging(tokenToMask);
    cleaned = cleaned.replaceAll(tokenToMask, masked);
  }
  cleaned = cleaned.replace(/EAA[A-Za-z0-9_-]{20,}/g, "EAA••••••••[MASKED]");
  return cleaned;
}

/**
 * 1. Send Direct Message (Inbound DM Reply) on Facebook or Instagram
 */
export async function sendMetaSocialDm(params: {
  platform: MetaSocialPlatform;
  pageIdOrAccountId: string;
  recipientId: string;
  text: string;
  accessToken: string;
}): Promise<{ message_id: string; recipient_id: string }> {
  const { pageIdOrAccountId, recipientId, text, accessToken } = params;
  if (!pageIdOrAccountId?.trim()) throw new Error("pageIdOrAccountId is required.");
  if (!recipientId?.trim()) throw new Error("recipientId is required.");
  if (!text?.trim()) throw new Error("text is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    pageIdOrAccountId.trim()
  )}/messages`;

  const payload = {
    recipient: { id: recipientId.trim() },
    message: { text: text.trim() },
    messaging_type: "RESPONSE",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    throw new MetaSocialApiError(data.error || { message: response.statusText, code: response.status }, url);
  }

  return {
    message_id: data.message_id || data.id,
    recipient_id: data.recipient_id || recipientId,
  };
}

/**
 * 2. Reply Publicly to a Comment on a Facebook Post or Instagram Media/Reel
 */
export async function replyMetaCommentPublic(params: {
  platform: MetaSocialPlatform;
  commentId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const { platform, commentId, message, accessToken } = params;
  if (!commentId?.trim()) throw new Error("commentId is required.");
  if (!message?.trim()) throw new Error("message is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  // Facebook uses /{comment-id}/comments, Instagram uses /{comment-id}/replies
  const endpoint = platform === "facebook" ? "comments" : "replies";
  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    commentId.trim()
  )}/${endpoint}`;

  const payload = {
    message: message.trim(),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    throw new MetaSocialApiError(data.error || { message: response.statusText, code: response.status }, url);
  }

  return { id: data.id };
}

/**
 * 3. Send a Private DM to a user who commented (Meta Official Private Replies)
 * Note: Meta allows sending 1 direct message to a user within 7 days of their comment.
 */
export async function sendMetaCommentPrivateDm(params: {
  pageId: string;
  commentId: string;
  text: string;
  accessToken: string;
}): Promise<{ message_id: string; recipient_id: string }> {
  const { pageId, commentId, text, accessToken } = params;
  if (!pageId?.trim()) throw new Error("pageId is required.");
  if (!commentId?.trim()) throw new Error("commentId is required.");
  if (!text?.trim()) throw new Error("text is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    pageId.trim()
  )}/messages`;

  const payload = {
    recipient: { comment_id: commentId.trim() },
    message: { text: text.trim() },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    throw new MetaSocialApiError(data.error || { message: response.statusText, code: response.status }, url);
  }

  return {
    message_id: data.message_id || data.id,
    recipient_id: data.recipient_id || commentId,
  };
}
