import { INITIAL_BUSINESSES } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Business, BusinessMember, BusinessSlug, UserProfile } from "@/types/database";
import { redirect } from "next/navigation";

export interface AuthorizedContext {
  user: UserProfile;
  business: Business;
  membership: BusinessMember;
}

/**
 * Server-side tenant security check:
 * Validates that the active session user is authorized to enter or read data
 * for the requested business slug.
 *
 * Enforces strict isolation:
 * - Rejects unauthorized cross-business requests with a redirect or error.
 * - Resolves business context strictly from verified server-side business_members.
 */
export async function validateBusinessAccess(slug: string): Promise<AuthorizedContext> {
  const isProdConfigured = isSupabaseConfigured();

  if (isProdConfigured) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      redirect("/login");
    }

    // MANDATORY FIRST-TIME PASSWORD CHANGE GUARD:
    // Disallow workspace, dashboard, inbox, connections, and automations access until temporary password is changed
    const mustChangePassword = Boolean(
      authUser.app_metadata?.must_change_password ??
      authUser.user_metadata?.must_change_password
    );

    if (mustChangePassword) {
      redirect("/update-password?mandatory=true");
    }

    // 1. Fetch business by slug
    const { data: business, error: bError } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (bError || !business) {
      redirect("/select-business?error=not_found");
    }

    // 2. Check user membership in business_members
    const { data: membership, error: mError } = await supabase
      .from("business_members")
      .select("*")
      .eq("business_id", business.id)
      .eq("user_id", authUser.id)
      .eq("is_active", true)
      .single();

    if (mError || !membership) {
      // STRICT TENANT ISOLATION VIOLATION: User is not an active member of this business
      redirect("/select-business?error=unauthorized_business_access");
    }

    // 3. Fetch user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    const userProfile: UserProfile = {
      id: authUser.id,
      email: authUser.email || "",
      full_name: profile?.full_name || authUser.email || "User",
      avatar_url: profile?.avatar_url || null,
      is_superadmin: profile?.is_superadmin || false,
      must_change_password: mustChangePassword,
      created_at: profile?.created_at || new Date().toISOString(),
      updated_at: profile?.updated_at || new Date().toISOString(),
    };

    return {
      user: userProfile,
      business,
      membership,
    };
  }

  // --- LOCAL / SEED FALLBACK (BEFORE NEW DEDICATED SUPABASE IS PLUGGED IN) ---
  const foundBusiness = INITIAL_BUSINESSES.find(
    (b) => b.slug.toLowerCase() === slug.toLowerCase()
  );

  if (!foundBusiness) {
    redirect("/select-business?error=business_not_found");
  }

  const mockUser: UserProfile = {
    id: "owner-user-00000000-0000-0000-0000-000000000001",
    email: "owner@gokulconnect.com",
    full_name: "Gokul (Platform Owner)",
    avatar_url: null,
    is_superadmin: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockMembership: BusinessMember = {
    id: `mem-${foundBusiness.slug}`,
    business_id: foundBusiness.id,
    user_id: mockUser.id,
    role: "owner",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    user: mockUser,
    business: foundBusiness,
    membership: mockMembership,
  };
}

/**
 * Returns the list of businesses the authenticated user is allowed to access.
 */
export async function getAuthorizedBusinesses(): Promise<Business[]> {
  const isProdConfigured = isSupabaseConfigured();

  if (isProdConfigured) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return [];
    }

    const mustChangePassword = Boolean(
      authUser.app_metadata?.must_change_password ??
      authUser.user_metadata?.must_change_password
    );

    if (mustChangePassword) {
      return [];
    }

    const { data: memberships } = await supabase
      .from("business_members")
      .select("business_id, businesses(*)")
      .eq("user_id", authUser.id)
      .eq("is_active", true);

    if (!memberships) return [];

    const baseBusinesses: Business[] = memberships
      .map((m: any) => m.businesses)
      .filter((b: any) => Boolean(b && b.is_active));

    // Live Business Selection Counts (Active Connections, Live Unread Enquiries, Pending Follow-ups)
    const businessesWithStats = await Promise.all(
      baseBusinesses.map(async (b: Business) => {
        try {
          // 1. WhatsApp Connections live status
          const { data: conns } = await supabase
            .from("wa_connections")
            .select("id, connection_status, is_enabled")
            .eq("business_id", b.id);

          const enabledConns = conns?.filter((c: any) => c.is_enabled) || [];
          const connectedConns = enabledConns.filter(
            (c: any) => c.connection_status === "connected"
          );

          let connectionStatus: "connected" | "disconnected" | "setup_required" = "setup_required";
          if (connectedConns.length > 0) {
            connectionStatus = "connected";
          } else if (enabledConns.length > 0) {
            connectionStatus = "disconnected";
          } else {
            connectionStatus = "setup_required";
          }

          // 2. Live Unread Enquiries count from wa_conversations
          const { data: convData } = await supabase
            .from("wa_conversations")
            .select("unread_count")
            .eq("business_id", b.id)
            .gt("unread_count", 0);

          const unreadEnquiriesCount = convData
            ? convData.reduce((acc: number, c: any) => acc + (c.unread_count || 1), 0)
            : 0;

          // 3. Live Pending Follow-ups from crm_follow_ups or wa_conversations
          let pendingCount = 0;
          try {
            const { count: crmCount } = await supabase
              .from("crm_follow_ups")
              .select("id", { count: "exact", head: true })
              .eq("business_id", b.id)
              .eq("status", "pending");
            if (crmCount !== null && crmCount !== undefined) {
              pendingCount = crmCount;
            }
          } catch {
            const { count: convCount } = await supabase
              .from("wa_conversations")
              .select("id", { count: "exact", head: true })
              .eq("business_id", b.id)
              .eq("status", "pending_human");
            pendingCount = convCount || 0;
          }

          // 4. Optional custom logo URL from business_settings (graceful on pre-025 schemas)
          let logoUrl: string | null = null;
          try {
            const { data: settRow } = await supabase
              .from("business_settings")
              .select("logo_url")
              .eq("business_id", b.id)
              .maybeSingle();
            logoUrl = settRow?.logo_url ?? null;
          } catch {
            logoUrl = null;
          }

          return {
            ...b,
            logo_url: logoUrl,
            stats: {
              connectionStatus,
              connectedNumbersCount: connectedConns.length,
              unreadEnquiriesCount,
              pendingRepliesCount: pendingCount,
            },
          };
        } catch {
          return {
            ...b,
            logo_url: null,
            stats: {
              connectionStatus: "setup_required",
              connectedNumbersCount: 0,
              unreadEnquiriesCount: 0,
              pendingRepliesCount: 0,
            },
          };
        }
      })
    );

    return businessesWithStats as Business[];
  }

  // Local development fallback (include any updated in-memory logo_url)
  try {
    const { getBusinessSettings } = await import("@/lib/connections/store");
    return INITIAL_BUSINESSES.map((b) => {
      try {
        const sett = getBusinessSettings(b.id);
        return { ...b, logo_url: sett.logo_url ?? null };
      } catch {
        return b;
      }
    });
  } catch {
    return INITIAL_BUSINESSES;
  }
}
