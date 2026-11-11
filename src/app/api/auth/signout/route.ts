import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/auth/signout
 * Secure sign-out handler: executes supabase.auth.signOut(), purges session cookies,
 * and redirects to /login.
 */
async function handleSignOut(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Session may have already been purged
  }

  const allCookies = request.cookies.getAll();
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, { status: 303 });

  // Explicitly expire standard Supabase cookies on the response
  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("auth") ||
      cookie.name.includes("token")
    ) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        expires: new Date(0),
        path: "/",
      });
    }
  }

  return response;
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}
