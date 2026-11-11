import { NextResponse, NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Auth Callback Route Handler
 * Exchanges Supabase authorization codes (from email confirmations, password reset links, etc.)
 * for active authenticated sessions via @supabase/ssr.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/select-business";

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Prevent open redirect vulnerabilities by strictly allowing relative paths
        const forwardPath = next.startsWith("/") && !next.startsWith("//") ? next : "/select-business";
        return NextResponse.redirect(`${origin}${forwardPath}`);
      }
    } catch {
      // Fall through to error redirect
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
