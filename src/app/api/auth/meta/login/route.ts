import { NextRequest, NextResponse } from "next/server";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  createMetaOAuthState,
  getMetaOAuthAuthorizationUrl,
} from "@/lib/meta-social/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const businessSlug = searchParams.get("businessSlug");

  if (!businessSlug) {
    return NextResponse.json(
      { error: "businessSlug query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and administrators can connect social accounts." },
        { status: 403 }
      );
    }

    const { state, csrfCookie } = createMetaOAuthState({
      businessSlug: business.slug,
      businessId: business.id,
      userId: user.id,
    });

    const authUrl = getMetaOAuthAuthorizationUrl({ state });
    const response = NextResponse.redirect(authUrl);

    response.cookies.set("meta_oauth_csrf", csrfCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to initiate Meta OAuth authorization." },
      { status: 401 }
    );
  }
}
