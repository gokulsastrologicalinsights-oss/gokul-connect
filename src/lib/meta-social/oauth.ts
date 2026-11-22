import crypto from "crypto";
import { maskTokenForLogging } from "@/lib/crypto/encryption";
import { validateBusinessTenant } from "@/lib/auth/tenant-guard";

export const META_GRAPH_VERSION = "v21.0";
export const META_GRAPH_BASE_URL = "https://graph.facebook.com";
export const META_OAUTH_DIALOG_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

export const META_REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "business_management",
];

export interface MetaOAuthStatePayload {
  businessSlug: string;
  businessId: string;
  userId: string;
  nonce: string;
  timestamp: number;
}

export interface DiscoveredInstagramAccount {
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface DiscoveredFacebookPage {
  pageId: string;
  pageName: string;
  category?: string;
  tasks?: string[];
  pageAccessToken: string; // Server-only, encrypted before storage, never sent to UI
  instagramAccount?: DiscoveredInstagramAccount | null;
}

export interface SanitizedDiscoveredPage {
  pageId: string;
  pageName: string;
  category?: string;
  tasks?: string[];
  instagramAccount?: DiscoveredInstagramAccount | null;
}

export interface MetaTokenDebugResult {
  isValid: boolean;
  appId?: string;
  userId?: string;
  type?: string;
  application?: string;
  dataAccessExpiresAt?: number;
  expiresAt?: number; // 0 or timestamp (0 means never expires for Page Tokens)
  scopes?: string[];
  error?: {
    code: number;
    subcode?: number;
    message: string;
  };
}

function getStateSigningSecret(): string {
  return (
    process.env.APP_ENCRYPTION_SECRET ||
    process.env.META_APP_SECRET ||
    "gokul_connect_state_signing_secret_dev_32b!"
  );
}

/**
 * Generate a cryptographically signed OAuth state and CSRF cookie value.
 * Valid for 15 minutes.
 */
export function createMetaOAuthState(params: {
  businessSlug: string;
  businessId: string;
  userId: string;
}): { state: string; csrfCookie: string } {
  validateBusinessTenant(params.businessId);

  const nonce = crypto.randomBytes(24).toString("hex");
  const payload: MetaOAuthStatePayload = {
    businessSlug: params.businessSlug,
    businessId: params.businessId,
    userId: params.userId,
    nonce,
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr, "utf8").toString("base64url");

  const secret = getStateSigningSecret();
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(base64Payload)
    .digest("base64url");

  const state = `${base64Payload}.${hmac}`;
  return { state, csrfCookie: nonce };
}

/**
 * Verify and decode OAuth state against signature, expiration, and CSRF cookie.
 */
export function verifyMetaOAuthState(
  stateString: string,
  csrfCookieValue?: string
): MetaOAuthStatePayload {
  if (!stateString || typeof stateString !== "string" || !stateString.includes(".")) {
    throw new Error("Invalid OAuth state format.");
  }

  // Strict CSRF cookie fail-closed validation: Cookie must be present and non-empty
  if (!csrfCookieValue || typeof csrfCookieValue !== "string" || !csrfCookieValue.trim()) {
    throw new Error("OAuth CSRF validation failed: Missing or empty CSRF session cookie.");
  }

  const [base64Payload, signature] = stateString.split(".");
  if (!base64Payload || !signature) {
    throw new Error("Malformed OAuth state components.");
  }

  const secret = getStateSigningSecret();
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(base64Payload)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedHmac, "utf8");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error("OAuth state signature verification failed: State has been tampered with.");
  }

  let payload: MetaOAuthStatePayload;
  try {
    const jsonStr = Buffer.from(base64Payload, "base64url").toString("utf8");
    payload = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse OAuth state payload.");
  }

  // 15-minute expiration
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  if (!payload.timestamp || Date.now() - payload.timestamp > FIFTEEN_MINUTES_MS) {
    throw new Error("OAuth state has expired. Please initiate connection again.");
  }

  // Timing-safe CSRF validation against state nonce
  const nonceBuffer = Buffer.from(payload.nonce || "", "utf8");
  const cookieBuffer = Buffer.from(csrfCookieValue.trim(), "utf8");

  if (
    nonceBuffer.length !== cookieBuffer.length ||
    !crypto.timingSafeEqual(nonceBuffer, cookieBuffer)
  ) {
    throw new Error("OAuth CSRF validation failed: State nonce does not match session cookie.");
  }

  // Tenant validation
  validateBusinessTenant(payload.businessId);

  return payload;
}

/**
 * Build the official Meta OAuth Authorization URL
 */
export function getMetaOAuthAuthorizationUrl(params: {
  state: string;
  redirectUri?: string;
  appId?: string;
  scopes?: string[];
}): string {
  const appId = params.appId || process.env.META_APP_ID || "mock_meta_app_id";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri =
    params.redirectUri || `${appUrl.replace(/\/$/, "")}/api/auth/meta/callback`;
  const scopes = (params.scopes || META_REQUIRED_SCOPES).join(",");

  const url = new URL(META_OAUTH_DIALOG_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");

  return url.toString();
}

/**
 * Exchange OAuth authorization code for short-lived User Access Token
 */
export async function exchangeCodeForUserToken(params: {
  code: string;
  redirectUri?: string;
  appId?: string;
  appSecret?: string;
}): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
  const appId = params.appId || process.env.META_APP_ID || "mock_meta_app_id";
  const appSecret = params.appSecret || process.env.META_APP_SECRET || "mock_meta_app_secret";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri =
    params.redirectUri || `${appUrl.replace(/\/$/, "")}/api/auth/meta/callback`;

  const url = new URL(`${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", params.code);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    const errorMsg = data.error?.message || res.statusText || "OAuth code exchange failed";
    throw new Error(`Meta OAuth Error (${data.error?.code || res.status}): ${errorMsg}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
    tokenType: data.token_type || "bearer",
  };
}

/**
 * Exchange short-lived User Access Token for 60-day Long-Lived User Access Token
 */
export async function exchangeForLongLivedUserToken(params: {
  shortLivedToken: string;
  appId?: string;
  appSecret?: string;
}): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
  const appId = params.appId || process.env.META_APP_ID || "mock_meta_app_id";
  const appSecret = params.appSecret || process.env.META_APP_SECRET || "mock_meta_app_secret";

  const url = new URL(`${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", params.shortLivedToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    const errorMsg = data.error?.message || res.statusText || "Long-lived token exchange failed";
    throw new Error(`Meta Token Exchange Error (${data.error?.code || res.status}): ${errorMsg}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // ~60 days
    tokenType: data.token_type || "bearer",
  };
}

/**
 * Fetch Facebook Pages accessible to the authorized user, including their
 * Page Access Tokens and linked Instagram Professional accounts.
 */
export async function fetchUserPagesAndInstagram(
  userAccessToken: string
): Promise<DiscoveredFacebookPage[]> {
  if (!userAccessToken) throw new Error("userAccessToken is required.");

  const fields =
    "id,name,category,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}";
  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/me/accounts?fields=${fields}&limit=50`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${userAccessToken.trim()}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const errorMsg = data.error?.message || res.statusText || "Failed to retrieve Facebook Pages";
    throw new Error(`Meta Graph API Error (${data.error?.code || res.status}): ${errorMsg}`);
  }

  const pagesRaw = Array.isArray(data.data) ? data.data : [];
  const discovered: DiscoveredFacebookPage[] = [];

  for (const page of pagesRaw) {
    let instagramAccount: DiscoveredInstagramAccount | null = null;

    if (page.instagram_business_account && page.instagram_business_account.id) {
      const ig = page.instagram_business_account;
      instagramAccount = {
        id: ig.id,
        username: ig.username || `ig_${ig.id}`,
        name: ig.name || ig.username,
        profilePictureUrl: ig.profile_picture_url,
        isEligible: true,
      };
    } else {
      instagramAccount = {
        id: "",
        username: "",
        isEligible: false,
        ineligibilityReason:
          "No Instagram Professional Account is linked to this Facebook Page. Link an Instagram Professional Account to this Page in Meta Business Suite to enable Instagram messaging.",
      };
    }

    discovered.push({
      pageId: String(page.id),
      pageName: page.name || `Facebook Page ${page.id}`,
      category: page.category,
      tasks: page.tasks,
      pageAccessToken: page.access_token || userAccessToken,
      instagramAccount,
    });
  }

  return discovered;
}

/**
 * Sanitize discovered pages for client response: Strips all access tokens!
 */
export function sanitizeDiscoveredPages(
  pages: DiscoveredFacebookPage[]
): SanitizedDiscoveredPage[] {
  return pages.map((p) => ({
    pageId: p.pageId,
    pageName: p.pageName,
    category: p.category,
    tasks: p.tasks,
    instagramAccount: p.instagramAccount,
  }));
}

/**
 * Debug and inspect a Meta access token to determine validity, expiry, and scopes.
 */
export async function debugMetaToken(params: {
  inputToken: string;
  appId?: string;
  appSecret?: string;
}): Promise<MetaTokenDebugResult> {
  const appId = params.appId || process.env.META_APP_ID || "mock_meta_app_id";
  const appSecret = params.appSecret || process.env.META_APP_SECRET || "mock_meta_app_secret";
  const appToken = `${appId}|${appSecret}`;

  const url = new URL(`${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/debug_token`);
  url.searchParams.set("input_token", params.inputToken.trim());
  url.searchParams.set("access_token", appToken);

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET" });
  } catch (err: any) {
    return {
      isValid: false,
      error: { code: 500, message: err.message || "Network error debugging token" },
    };
  }

  const json = await res.json().catch(() => ({}));
  const data = json?.data;

  if (!res.ok || json.error) {
    return {
      isValid: false,
      error: {
        code: json.error?.code || res.status,
        subcode: json.error?.error_subcode,
        message: json.error?.message || "Token verification failed",
      },
    };
  }

  return {
    isValid: Boolean(data?.is_valid),
    appId: data?.app_id,
    userId: data?.user_id,
    type: data?.type,
    application: data?.application,
    dataAccessExpiresAt: data?.data_access_expires_at,
    expiresAt: data?.expires_at,
    scopes: data?.scopes || [],
    error: data?.error
      ? {
          code: data.error.code,
          subcode: data.error.subcode,
          message: data.error.message,
        }
      : undefined,
  };
}
