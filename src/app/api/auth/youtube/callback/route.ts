import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyYouTubeOAuthState,
  exchangeYouTubeCodeForTokens,
  fetchYouTubeChannelDetails,
} from "@/lib/social-comments/youtube-oauth";
import { saveYouTubeConnection } from "@/lib/social-comments/youtube-store";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const fallbackRedirect = "/workspace/astrology/comments";

  if (error) {
    const message = encodeURIComponent(errorDescription || error || "Google authorization was cancelled.");
    return NextResponse.redirect(new URL(`${fallbackRedirect}?error=${message}`, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${fallbackRedirect}?error=${encodeURIComponent("Missing authorization code or state parameter.")}`, request.url)
    );
  }

  // 1. Verify CSRF cookie
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("youtube_oauth_csrf")?.value;

  const stateVerification = verifyYouTubeOAuthState({
    state,
    csrfCookie,
  });

  if (!stateVerification.isValid || !stateVerification.payload) {
    return NextResponse.redirect(
      new URL(
        `${fallbackRedirect}?error=${encodeURIComponent(stateVerification.error || "Invalid or tampered OAuth state.")}`,
        request.url
      )
    );
  }

  const { businessSlug, businessId } = stateVerification.payload;
  const targetRedirect = `/workspace/${businessSlug}/comments`;

  try {
    // 2. Exchange code for access & refresh tokens
    const tokenResult = await exchangeYouTubeCodeForTokens({ code });

    // 3. Discover authenticated YouTube Channel
    const channel = await fetchYouTubeChannelDetails(tokenResult.accessToken);

    // 4. Encrypt and save connection in dedicated YouTube vault
    saveYouTubeConnection(businessId, {
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      customUrl: channel.customUrl,
      thumbnailUrl: channel.thumbnailUrl,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
    });

    // 5. Clean up CSRF cookie
    cookieStore.delete("youtube_oauth_csrf");

    return NextResponse.redirect(
      new URL(`${targetRedirect}?youtube_connected=true&channel=${encodeURIComponent(channel.channelTitle)}`, request.url)
    );
  } catch (err: any) {
    console.error("[YouTube OAuth Callback Error]:", err.message || err);
    return NextResponse.redirect(
      new URL(`${targetRedirect}?error=${encodeURIComponent(err.message || "Failed to complete YouTube connection.")}`, request.url)
    );
  }
}
