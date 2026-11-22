import { maskTokenForLogging } from "@/lib/crypto/encryption";
import type { MetaSocialPlatform } from "./types";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE_URL = "https://graph.facebook.com";

export interface MetaSocialApiErrorOptions {
  httpStatus?: number;
  retryAfterSeconds?: number;
  isAmbiguous?: boolean;
}

export class MetaSocialApiError extends Error {
  public readonly code: number;
  public readonly subcode?: number;
  public readonly fbtraceId?: string;
  public readonly errorType: string;
  public readonly httpStatus: number;
  public readonly retryAfterSeconds?: number;
  public readonly isRateLimit: boolean;
  public readonly isTransient: boolean;
  public readonly isAuthError: boolean;
  public readonly isPermanentPermissionError: boolean;
  public readonly isAmbiguous: boolean;

  constructor(error: any, sanitizedUrl: string, options?: MetaSocialApiErrorOptions) {
    const code = error?.code || options?.httpStatus || 500;
    const subcode = error?.error_subcode;
    const message = error?.message || "Unknown Meta Social API error";

    super(
      `Meta Social API Error (${code}${subcode ? `:${subcode}` : ""}): ${message} [URL: ${sanitizedUrl}]`
    );
    this.name = "MetaSocialApiError";
    this.code = code;
    this.subcode = subcode;
    this.fbtraceId = error?.fbtrace_id;
    this.errorType = error?.type || "OAuthException";
    this.httpStatus = options?.httpStatus || (code >= 100 && code < 600 ? code : 500);
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.isAmbiguous = options?.isAmbiguous || false;

    // Error Classification
    const is429 = this.httpStatus === 429 || code === 4 || code === 17 || code === 32 || code === 613;
    this.isRateLimit = is429;

    const is5xx = this.httpStatus >= 500 && this.httpStatus <= 599;
    this.isTransient = is429 || is5xx || Boolean(error?.is_transient);

    // Auth errors: 190 (Invalid OAuth token, 463: expired, 467: revoked)
    this.isAuthError = code === 190 || subcode === 463 || subcode === 467;

    // Permanent permission errors: 10, 200, 100, 368
    this.isPermanentPermissionError =
      code === 10 || code === 200 || code === 100 || code === 368 ||
      (typeof message === "string" && message.toLowerCase().includes("permission"));
  }
}

/**
 * Sanitize strings so access tokens and sensitive secrets are never leaked into logs
 */
export function sanitizeSocialLog(input: string, tokenToMask?: string): string {
  let cleaned = input || "";
  if (tokenToMask && tokenToMask.length > 8) {
    const masked = maskTokenForLogging(tokenToMask);
    cleaned = cleaned.replaceAll(tokenToMask, masked);
  }
  // Mask Meta access tokens
  cleaned = cleaned.replace(/EAA[A-Za-z0-9_-]{20,}/g, "EAA••••••••[MASKED]");
  // Mask Bearer tokens in headers
  cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, "Bearer [MASKED]");
  return cleaned;
}

/**
 * Helper to parse Retry-After header from Response
 */
function parseRetryAfter(response: Response): number | undefined {
  const retryHeader = response.headers.get("retry-after");
  if (!retryHeader) return undefined;
  const parsed = parseInt(retryHeader, 10);
  return isNaN(parsed) || parsed < 0 ? undefined : parsed;
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      { message: netErr.message || "Network timeout dispatching DM", code: 504 },
      cleanUrl,
      { httpStatus: 504, isAmbiguous: true }
    );
  }

  const retryAfter = parseRetryAfter(response);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      data.error || { message: response.statusText, code: response.status },
      cleanUrl,
      { httpStatus: response.status, retryAfterSeconds: retryAfter }
    );
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

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    // Network error during outbound request: outcome may be ambiguous!
    throw new MetaSocialApiError(
      { message: netErr.message || "Network connection failed during public comment reply", code: 504 },
      cleanUrl,
      { httpStatus: 504, isAmbiguous: true }
    );
  }

  const retryAfter = parseRetryAfter(response);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      data.error || { message: response.statusText, code: response.status },
      cleanUrl,
      { httpStatus: response.status, retryAfterSeconds: retryAfter }
    );
  }

  return { id: data.id };
}

/**
 * 2b. Retrieve Comment Details from Meta Graph API when required
 * (e.g. if inbound webhook payload only carries comment_id or has empty text)
 */
export async function fetchMetaCommentDetails(params: {
  platform: MetaSocialPlatform;
  commentId: string;
  accessToken: string;
}): Promise<{ id: string; text: string; fromId?: string; fromName?: string; createdTime?: string }> {
  const { platform, commentId, accessToken } = params;
  if (!commentId?.trim()) throw new Error("commentId is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  // Facebook uses fields=id,message,from,created_time
  // Instagram uses fields=id,text,from,timestamp
  const fields =
    platform === "facebook"
      ? "id,message,from,created_time"
      : "id,text,from,timestamp";

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    commentId.trim()
  )}?fields=${fields}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });
  } catch (netErr: any) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      { message: netErr.message || "Network timeout retrieving comment details", code: 504 },
      cleanUrl,
      { httpStatus: 504, isAmbiguous: false }
    );
  }

  const retryAfter = parseRetryAfter(response);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      data.error || { message: response.statusText, code: response.status },
      cleanUrl,
      { httpStatus: response.status, retryAfterSeconds: retryAfter }
    );
  }

  const text = platform === "facebook" ? (data.message || "") : (data.text || "");
  const fromId = data.from?.id;
  const fromName = data.from?.name || data.from?.username;

  return {
    id: data.id || commentId,
    text: String(text).trim(),
    fromId,
    fromName,
    createdTime: data.created_time || data.timestamp,
  };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 3. Send Facebook Private Reply to Page Comment
 * Meta Rule: Max 1 private message within 7 days of the comment.
 * Endpoint: POST https://graph.facebook.com/v21.0/{page-id}/messages
 */
export async function sendFacebookPrivateReply(params: {
  pageId: string;
  commentId: string;
  text: string;
  accessToken: string;
  commentCreatedAt?: number;
}): Promise<{ message_id: string; recipient_id: string }> {
  const { pageId, commentId, text, accessToken, commentCreatedAt } = params;
  if (!pageId?.trim()) throw new Error("pageId is required for Facebook private replies.");
  if (!commentId?.trim()) throw new Error("commentId is required.");
  if (!text?.trim()) throw new Error("text is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  if (commentCreatedAt && Date.now() - commentCreatedAt > SEVEN_DAYS_MS) {
    throw new Error(`Comment ${commentId} is older than 7 days; Meta rejects private replies to expired comments.`);
  }

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(pageId.trim())}/messages`;
  const payload = {
    recipient: { comment_id: commentId.trim() },
    message: { text: text.trim() },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      { message: netErr.message || "Network timeout dispatching Facebook private reply", code: 504 },
      cleanUrl,
      { httpStatus: 504, isAmbiguous: true }
    );
  }

  const retryAfter = parseRetryAfter(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      data.error || { message: response.statusText, code: response.status },
      cleanUrl,
      { httpStatus: response.status, retryAfterSeconds: retryAfter }
    );
  }

  return {
    message_id: data.message_id || data.id,
    recipient_id: data.recipient_id || commentId,
  };
}

/**
 * 4. Send Instagram Private Reply to Media / Reel Comment (Task 6 Fix)
 * Meta Rule: Endpoint targets the Instagram Professional Account ID ({app_users_ig_id}/messages),
 * NOT the linked Facebook Page ID.
 * Payload: { recipient: { comment_id: "<COMMENT_ID>" }, message: { text: "<TEXT>" } }
 * Max 1 private message within 7 days of the comment.
 */
export async function sendInstagramPrivateReply(params: {
  instagramAccountId?: string;
  linkedPageId?: string; // Accepted for backward compatibility
  commentId: string;
  text: string;
  accessToken: string;
  commentCreatedAt?: number;
}): Promise<{ message_id: string; recipient_id: string }> {
  const { instagramAccountId, linkedPageId, commentId, text, accessToken, commentCreatedAt } = params;
  const targetAccountId = (instagramAccountId || linkedPageId)?.trim();

  if (!targetAccountId) {
    throw new Error(
      "linkedPageId (Facebook Page ID connected to Instagram Professional Account) is strictly required for Instagram private replies."
    );
  }
  if (!commentId?.trim()) throw new Error("commentId is required.");
  if (!text?.trim()) throw new Error("text is required.");
  if (!accessToken?.trim()) throw new Error("accessToken is required.");

  if (commentCreatedAt && Date.now() - commentCreatedAt > SEVEN_DAYS_MS) {
    throw new Error(`Instagram comment ${commentId} is older than 7 days; Meta rejects private replies to expired comments.`);
  }

  // Official Meta endpoint: POST https://graph.facebook.com/v21.0/{app_users_ig_id}/messages
  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(targetAccountId)}/messages`;
  const payload = {
    recipient: { comment_id: commentId.trim() },
    message: { text: text.trim() },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      { message: netErr.message || "Network timeout dispatching Instagram private reply", code: 504 },
      cleanUrl,
      { httpStatus: 504, isAmbiguous: true }
    );
  }

  const retryAfter = parseRetryAfter(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const cleanUrl = sanitizeSocialLog(url, accessToken);
    throw new MetaSocialApiError(
      data.error || { message: response.statusText, code: response.status },
      cleanUrl,
      { httpStatus: response.status, retryAfterSeconds: retryAfter }
    );
  }

  return {
    message_id: data.message_id || data.id,
    recipient_id: data.recipient_id || commentId,
  };
}

/**
 * Backward-compatible dispatch wrapper for private comment replies
 */
export async function sendMetaCommentPrivateDm(params: {
  pageId: string;
  accountId?: string;
  commentId: string;
  text: string;
  accessToken: string;
  platform?: MetaSocialPlatform;
  commentCreatedAt?: number;
}): Promise<{ message_id: string; recipient_id: string }> {
  if (params.platform === "instagram" || (params.commentId && params.commentId.startsWith("ig_"))) {
    return sendInstagramPrivateReply({
      instagramAccountId: params.accountId || params.pageId,
      linkedPageId: params.pageId,
      commentId: params.commentId,
      text: params.text,
      accessToken: params.accessToken,
      commentCreatedAt: params.commentCreatedAt,
    });
  }
  return sendFacebookPrivateReply({
    pageId: params.pageId,
    commentId: params.commentId,
    text: params.text,
    accessToken: params.accessToken,
    commentCreatedAt: params.commentCreatedAt,
  });
}

/**
 * Reconcile / check whether a comment reply was already posted (Task 3 Reconciliation)
 */
export async function checkCommentReplied(params: {
  platform: MetaSocialPlatform;
  commentId: string;
  accessToken: string;
  expectedMessageSubstring?: string;
}): Promise<{ replied: boolean; existingReplyId?: string }> {
  const { platform, commentId, accessToken, expectedMessageSubstring } = params;
  if (!commentId?.trim() || !accessToken?.trim()) {
    return { replied: false };
  }

  const endpoint = platform === "facebook" ? "comments" : "replies";
  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    commentId.trim()
  )}/${endpoint}?fields=id,message,text,from,created_time&limit=25`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    if (!res.ok) {
      return { replied: false };
    }

    const data = await res.json().catch(() => ({}));
    const items = Array.isArray(data?.data) ? data.data : [];

    for (const item of items) {
      const itemText = item.message || item.text || "";
      if (
        !expectedMessageSubstring ||
        itemText.includes(expectedMessageSubstring)
      ) {
        return { replied: true, existingReplyId: item.id };
      }
    }

    return { replied: false };
  } catch {
    return { replied: false };
  }
}

/**
 * 6. Fetch Facebook Page Posts
 * Endpoint: GET https://graph.facebook.com/v21.0/{page-id}/posts
 */
export async function fetchFacebookPagePosts(params: {
  pageId: string;
  accessToken: string;
  limit?: number;
}): Promise<Array<{ id: string; message?: string; created_time: string; permalink_url?: string }>> {
  const { pageId, accessToken, limit = 10 } = params;
  if (!pageId?.trim() || !accessToken?.trim()) return [];

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    pageId.trim()
  )}/posts?fields=id,message,created_time,permalink_url&limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

/**
 * 7. Fetch Facebook Post Comments
 * Endpoint: GET https://graph.facebook.com/v21.0/{post-id}/comments
 */
export async function fetchFacebookPostComments(params: {
  postId: string;
  accessToken: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    from?: { id: string; name: string };
    message: string;
    created_time: string;
    comments?: { data?: Array<{ id: string; message: string; created_time: string }> };
  }>
> {
  const { postId, accessToken, limit = 25 } = params;
  if (!postId?.trim() || !accessToken?.trim()) return [];

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    postId.trim()
  )}/comments?fields=id,from,message,created_time,comments{id,message,created_time}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

/**
 * 8. Fetch Instagram Media
 * Endpoint: GET https://graph.facebook.com/v21.0/{ig-user-id}/media
 */
export async function fetchInstagramMedia(params: {
  instagramAccountId: string;
  accessToken: string;
  limit?: number;
}): Promise<Array<{ id: string; caption?: string; media_type?: string; permalink?: string; timestamp: string }>> {
  const { instagramAccountId, accessToken, limit = 10 } = params;
  if (!instagramAccountId?.trim() || !accessToken?.trim()) return [];

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    instagramAccountId.trim()
  )}/media?fields=id,caption,media_type,permalink,timestamp&limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

/**
 * 9. Fetch Instagram Media Comments
 * Endpoint: GET https://graph.facebook.com/v21.0/{media-id}/comments
 */
export async function fetchInstagramMediaComments(params: {
  mediaId: string;
  accessToken: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    text: string;
    timestamp: string;
    username?: string;
    from?: { id: string; username: string };
    replies?: { data?: Array<{ id: string; text: string; timestamp: string; username?: string }> };
  }>
> {
  const { mediaId, accessToken, limit = 25 } = params;
  if (!mediaId?.trim() || !accessToken?.trim()) return [];

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
    mediaId.trim()
  )}/comments?fields=id,text,timestamp,username,from,replies{id,text,timestamp,username}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

