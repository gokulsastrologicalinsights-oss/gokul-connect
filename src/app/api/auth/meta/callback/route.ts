import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  fetchUserPagesAndInstagram,
  verifyMetaOAuthState,
} from "@/lib/meta-social/oauth";
import { stageDiscoveredPages } from "@/lib/meta-social/discovery-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Handle Meta OAuth denial or user cancel
  if (error || !code || !state) {
    const errorMsg = encodeURIComponent(
      errorDescription || error || "User cancelled Meta authorization."
    );
    return NextResponse.redirect(`${appUrl}/select-business?oauth_error=${errorMsg}`);
  }

  // 1. Verify CSRF cookie and State integrity
  const csrfCookie = request.cookies.get("meta_oauth_csrf")?.value;
  let statePayload;
  try {
    statePayload = verifyMetaOAuthState(state, csrfCookie);
  } catch (stateErr: any) {
    console.error("[Meta OAuth Callback] State verification failed:", stateErr.message);
    const errorMsg = encodeURIComponent(`Security validation failed: ${stateErr.message}`);
    return NextResponse.redirect(`${appUrl}/select-business?oauth_error=${errorMsg}`);
  }

  const { businessSlug, businessId } = statePayload;

  try {
    // 2. Exchange code for short-lived User Access Token
    const shortLived = await exchangeCodeForUserToken({
      code,
      redirectUri: `${appUrl.replace(/\/$/, "")}/api/auth/meta/callback`,
    });

    // 3. Exchange short-lived token for 60-day Long-Lived User Access Token
    let userAccessToken = shortLived.accessToken;
    try {
      const longLived = await exchangeForLongLivedUserToken({
        shortLivedToken: shortLived.accessToken,
      });
      userAccessToken = longLived.accessToken;
    } catch (swapErr: any) {
      console.warn(
        "[Meta OAuth Callback] Long-lived exchange warning, proceeding with primary token:",
        swapErr.message
      );
    }

    // 4. Retrieve Facebook Pages & linked Instagram Professional accounts
    const discoveredPages = await fetchUserPagesAndInstagram(userAccessToken);

    if (!discoveredPages || discoveredPages.length === 0) {
      const errorMsg = encodeURIComponent(
        "No Facebook Pages found for this Meta account. Please create or manage a Facebook Page first."
      );
      return NextResponse.redirect(
        `${appUrl}/workspace/${businessSlug}/connections/social?oauth_error=${errorMsg}`
      );
    }

    // 5. Stage discovered pages server-side (Zero raw tokens sent to browser!)
    const sessionId = stageDiscoveredPages(businessId, discoveredPages);

    // 6. Redirect to dashboard selection UI with sessionId and clear CSRF cookie
    const redirectUrl = new URL(
      `${appUrl}/workspace/${businessSlug}/connections/social`
    );
    redirectUrl.searchParams.set("discovery", "success");
    redirectUrl.searchParams.set("session", sessionId);

    const response = NextResponse.redirect(redirectUrl.toString());
    response.cookies.delete("meta_oauth_csrf");

    return response;
  } catch (apiErr: any) {
    console.error("[Meta OAuth Callback] Error processing callback:", apiErr.message);
    const errorMsg = encodeURIComponent(
      `Failed to complete Meta account discovery: ${apiErr.message}`
    );
    return NextResponse.redirect(
      `${appUrl}/workspace/${businessSlug}/connections/social?oauth_error=${errorMsg}`
    );
  }
}
