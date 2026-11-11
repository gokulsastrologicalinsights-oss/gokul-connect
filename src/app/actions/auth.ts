"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitLogin } from "@/lib/rate-limit/rate-limiter";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { LoginInputSchema } from "@/lib/validation/schemas";

export interface LoginActionResult {
  success: boolean;
  error?: string;
  retryAfterSeconds?: number;
  mustChangePassword?: boolean;
}

/**
 * Server-Side Login Action with Brute-Force Rate Limiting & Schema Validation
 */
export async function loginAction(formData: {
  email: string;
  password?: string;
}): Promise<LoginActionResult> {
  const parsed = LoginInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid login credentials." };
  }

  const { email, password } = parsed.data;

  // 1. Enforce sliding window rate limit (5 attempts / 60 seconds per email)
  const rateLimit = rateLimitLogin(email);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many login attempts. Access throttled. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  if (!isSupabaseConfigured()) {
    // Local preview mode
    return { success: true, mustChangePassword: false };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { success: false, error: signInError.message };
    }

    const mustChangePassword = Boolean(
      signInData.user?.app_metadata?.must_change_password ??
      signInData.user?.user_metadata?.must_change_password
    );

    return { success: true, mustChangePassword };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during authentication.",
    };
  }
}

/**
 * Server-Side Password Update Action:
 * - Updates user password in Supabase Auth
 * - Clears must_change_password flag server-side via Supabase Admin API
 */
export async function updatePasswordAction(formData: {
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const { password } = formData;
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { success: false, error: "Active authentication session required to update password." };
    }

    // 1. Update user password
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
    });

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 2. Clear must_change_password flag server-side via Supabase Admin API (in both app_metadata and user_metadata)
    const adminClient = createAdminClient();
    const { error: adminErr } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        must_change_password: false,
      },
      app_metadata: {
        ...(user.app_metadata || {}),
        must_change_password: false,
      },
    });

    if (adminErr) {
      return { success: false, error: "Failed to reset password change security flag." };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during password update.",
    };
  }
}

/**
 * Server-Side Sign Out Action:
 * - Calls supabase.auth.signOut()
 * - Invalidates all active session cookies
 * - Redirects to /login
 */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Non-fatal if session was already expired
  }

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      if (
        cookie.name.startsWith("sb-") ||
        cookie.name.includes("auth") ||
        cookie.name.includes("token")
      ) {
        cookieStore.delete(cookie.name);
      }
    }
  } catch {
    // Handled in Server Action context
  }

  redirect("/login");
}
