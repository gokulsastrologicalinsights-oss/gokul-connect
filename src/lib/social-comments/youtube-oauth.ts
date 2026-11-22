import crypto from "crypto";
import { validateBusinessTenant } from "@/lib/auth/tenant-guard";

export const YOUTUBE_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export interface YouTubeOAuthStatePayload {
  businessSlug: string;
  businessId: string;
  userId: string;
  csrfNonce: string;
  timestamp: number;
}

export interface SanitizedYouTubeChannel {
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnailUrl?: string;
}

function getGoogleOAuthSecret(): string {
  return (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.APP_ENCRYPTION_SECRET ||
    "fallback_google_oauth_signing_secret_32bytes!"
  );
}

/**
 * 1. Create a cryptographically signed state token for Google OAuth
 */
export function createYouTubeOAuthState(params: {
  businessSlug: string;
  businessId: string;
  userId: string;
}): { state: string; csrfCookie: string } {
  validateBusinessTenant(params.businessId);

  const csrfNonce = crypto.randomBytes(24).toString("hex");
  const payload: YouTubeOAuthStatePayload = {
    businessSlug: params.businessSlug,
    businessId: params.businessId,
    userId: params.userId,
    csrfNonce,
    timestamp: Date.now(),
  };

  const jsonPayload = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonPayload, "utf8").toString("base64url");

  const secret = getGoogleOAuthSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(base64Payload)
    .digest("base64url");

  const state = `${base64Payload}.${signature}`;

  return {
    state,
    csrfCookie: csrfNonce,
  };
}

/**
 * 2. Verify state token from Google OAuth callback
 */
export function verifyYouTubeOAuthState(params: {
  state: string;
  csrfCookie?: string;
  maxAgeMs?: number;
}): { isValid: boolean; payload?: YouTubeOAuthStatePayload; error?: string } {
  const { state, csrfCookie, maxAgeMs = 15 * 60 * 1000 } = params;

  if (!state || typeof state !== "string" || !state.includes(".")) {
    return { isValid: false, error: "Invalid or malformed state format." };
  }

  const [base64Payload, signature] = state.split(".");
  if (!base64Payload || !signature) {
    return { isValid: false, error: "State segments are invalid." };
  }

  const secret = getGoogleOAuthSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(base64Payload)
    .digest("base64url");

  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { isValid: false, error: "State signature verification failed. Possible tampering." };
    }
  } catch {
    return { isValid: false, error: "Cryptographic validation failed." };
  }

  try {
    const rawJson = Buffer.from(base64Payload, "base64url").toString("utf8");
    const payload = JSON.parse(rawJson) as YouTubeOAuthStatePayload;

    if (!payload.businessId || !payload.businessSlug || !payload.userId || !payload.csrfNonce) {
      return { isValid: false, error: "State payload missing required claims." };
    }

    if (Date.now() - payload.timestamp > maxAgeMs) {
      return { isValid: false, error: "State has expired. Please initiate connection again." };
    }

    if (csrfCookie && payload.csrfNonce !== csrfCookie) {
      return { isValid: false, error: "CSRF nonce mismatch. Cross-site request rejected." };
    }

    return { isValid: true, payload };
  } catch {
    return { isValid: false, error: "Failed to deserialize state payload." };
  }
}

/**
 * 3. Generate Google OAuth authorization URL for YouTube
 */
export function getYouTubeOAuthAuthorizationUrl(params: {
  state: string;
  redirectUri?: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com";
  const redirectUri =
    params.redirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/youtube/callback`;

  const scopes = YOUTUBE_REQUIRED_SCOPES.join(" ");

  const queryParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state: params.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${queryParams.toString()}`;
}

/**
 * 4. Exchange authorization code for Google access token
 */
export async function exchangeYouTubeCodeForTokens(params: {
  code: string;
  redirectUri?: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const { code } = params;
  const clientId = process.env.GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret";
  const redirectUri =
    params.redirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/youtube/callback`;

  // For testing/mocking environments where mock ID is configured
  if (clientId.startsWith("mock-")) {
    return {
      accessToken: `mock_yt_access_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      refreshToken: `mock_yt_refresh_token_${Date.now()}`,
      expiresIn: 3600,
    };
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      `Google OAuth token exchange failed: ${errorData.error_description || errorData.error || res.statusText}`
    );
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * 5. Discover authenticated YouTube Channel details
 */
export async function fetchYouTubeChannelDetails(accessToken: string): Promise<SanitizedYouTubeChannel> {
  // In mock environment
  if (accessToken.startsWith("mock_yt_")) {
    return {
      channelId: "UC_mock_channel_gokul_123",
      channelTitle: "Gokul Astrology & Culture Official",
      customUrl: "@gokul_astrology",
      thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop",
    };
  }

  const url = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Failed to fetch YouTube channel: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const channel = data.items?.[0];
  if (!channel) {
    throw new Error("No YouTube channel found for the authenticated Google account.");
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title || "My YouTube Channel",
    customUrl: channel.snippet?.customUrl,
    thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
  };
}
