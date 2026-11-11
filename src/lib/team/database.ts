import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  AgentWorkload,
  BusinessInvitation,
  BusinessRole,
  ConversationAssignmentLog,
  TeamActivityLog,
  TeamActivityType,
  TeamFilterOptions,
  TeamMemberWithProfile,
  UserProfile,
} from "@/types/database";
import { createNotificationDb } from "@/lib/notifications/service";
import { sendInvitationEmail } from "@/lib/email/adapter";

export const ASTRO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
export const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Validates tenant identity to enforce strict RLS and business boundary
 */
export async function validateTenant(businessId: string) {
  if (!businessId || typeof businessId !== "string" || !businessId.trim()) {
    throw new Error("Tenant isolation violation: businessId is strictly required.");
  }
}

// ==============================================================================
// IN-MEMORY SEED & FALLBACK DATA (INDEPENDENT TEAMS PER BUSINESS)
// ==============================================================================

const SEED_USERS: Record<string, UserProfile> = {
  // Shared Platform Owner (with distinct business memberships)
  "owner-user-00000000-0000-0000-0000-000000000001": {
    id: "owner-user-00000000-0000-0000-0000-000000000001",
    email: "gokulsastrologicalinsights@gmail.com",
    full_name: "Gokul Murugan (Owner)",
    avatar_url: null,
    is_superadmin: true,
    created_at: "2026-11-06T10:00:00.000Z",
    updated_at: "2026-11-07T12:00:00.000Z",
  },
  // Astrology-specific staff
  "user-astro-admin-01": {
    id: "user-astro-admin-01",
    email: "suresh.sastri@astrology.example.com",
    full_name: "Suresh Sastri",
    avatar_url: null,
    is_superadmin: false,
    created_at: "2026-11-06T10:30:00.000Z",
    updated_at: "2026-11-07T14:00:00.000Z",
  },
  "user-astro-agent-01": {
    id: "user-astro-agent-01",
    email: "meenakshi@astrology.example.com",
    full_name: "Meenakshi Sundaram",
    avatar_url: null,
    is_superadmin: false,
    created_at: "2026-11-06T11:00:00.000Z",
    updated_at: "2026-11-07T15:00:00.000Z",
  },
  "user-astro-viewer-01": {
    id: "user-astro-viewer-01",
    email: "kavitha.narayanan@astrology.example.com",
    full_name: "Kavitha Narayanan",
    avatar_url: null,
    is_superadmin: false,
    created_at: "2026-11-06T11:30:00.000Z",
    updated_at: "2026-11-07T11:30:00.000Z",
  },
  // Vivaham-specific staff
  "user-vivaham-admin-01": {
    id: "user-vivaham-admin-01",
    email: "radhika.raman@vivaham.example.com",
    full_name: "Radhika Raman",
    avatar_url: null,
    is_superadmin: false,
    created_at: "2026-11-06T12:00:00.000Z",
    updated_at: "2026-11-07T13:00:00.000Z",
  },
  "user-vivaham-agent-01": {
    id: "user-vivaham-agent-01",
    email: "karthik.natarajan@vivaham.example.com",
    full_name: "Karthik Natarajan",
    avatar_url: null,
    is_superadmin: false,
    created_at: "2026-11-06T12:30:00.000Z",
    updated_at: "2026-11-07T14:30:00.000Z",
  },
  "user-vivaham-viewer-01": {
    id: "user-vivaham-viewer-01",
    email: "ananya.srinivasan@vivaham.example.com",
    full_name: "Ananya Srinivasan",
    avatar_url: null,
    is_superadmin: false,
    created_at: "2026-11-06T13:00:00.000Z",
    updated_at: "2026-11-07T13:00:00.000Z",
  },
};

// Mutable in-memory stores for testing and offline fallback
let memoryMembers: TeamMemberWithProfile[] = [
  // Astrology Team Members
  {
    id: "mem-astro-01",
    business_id: ASTRO_BUSINESS_ID,
    user_id: "owner-user-00000000-0000-0000-0000-000000000001",
    role: "owner",
    is_active: true,
    last_login_at: "2026-11-07T18:00:00.000Z",
    created_at: "2026-11-06T10:00:00.000Z",
    updated_at: "2026-11-07T18:00:00.000Z",
    user_profile: SEED_USERS["owner-user-00000000-0000-0000-0000-000000000001"],
  },
  {
    id: "mem-astro-02",
    business_id: ASTRO_BUSINESS_ID,
    user_id: "user-astro-admin-01",
    role: "admin",
    is_active: true,
    last_login_at: "2026-11-07T17:30:00.000Z",
    created_at: "2026-11-06T10:30:00.000Z",
    updated_at: "2026-11-07T17:30:00.000Z",
    user_profile: SEED_USERS["user-astro-admin-01"],
  },
  {
    id: "mem-astro-03",
    business_id: ASTRO_BUSINESS_ID,
    user_id: "user-astro-agent-01",
    role: "agent",
    is_active: true,
    last_login_at: "2026-11-07T19:00:00.000Z",
    created_at: "2026-11-06T11:00:00.000Z",
    updated_at: "2026-11-07T19:00:00.000Z",
    user_profile: SEED_USERS["user-astro-agent-01"],
  },
  {
    id: "mem-astro-04",
    business_id: ASTRO_BUSINESS_ID,
    user_id: "user-astro-viewer-01",
    role: "viewer",
    is_active: true,
    last_login_at: "2026-11-07T11:30:00.000Z",
    created_at: "2026-11-06T11:30:00.000Z",
    updated_at: "2026-11-07T11:30:00.000Z",
    user_profile: SEED_USERS["user-astro-viewer-01"],
  },
  // Vivaham Team Members
  {
    id: "mem-vivaham-01",
    business_id: VIVAHAM_BUSINESS_ID,
    user_id: "owner-user-00000000-0000-0000-0000-000000000001",
    role: "owner",
    is_active: true,
    last_login_at: "2026-11-07T18:00:00.000Z",
    created_at: "2026-11-06T10:00:00.000Z",
    updated_at: "2026-11-07T18:00:00.000Z",
    user_profile: SEED_USERS["owner-user-00000000-0000-0000-0000-000000000001"],
  },
  {
    id: "mem-vivaham-02",
    business_id: VIVAHAM_BUSINESS_ID,
    user_id: "user-vivaham-admin-01",
    role: "admin",
    is_active: true,
    last_login_at: "2026-11-07T16:45:00.000Z",
    created_at: "2026-11-06T12:00:00.000Z",
    updated_at: "2026-11-07T16:45:00.000Z",
    user_profile: SEED_USERS["user-vivaham-admin-01"],
  },
  {
    id: "mem-vivaham-03",
    business_id: VIVAHAM_BUSINESS_ID,
    user_id: "user-vivaham-agent-01",
    role: "agent",
    is_active: true,
    last_login_at: "2026-11-07T18:15:00.000Z",
    created_at: "2026-11-06T12:30:00.000Z",
    updated_at: "2026-11-07T18:15:00.000Z",
    user_profile: SEED_USERS["user-vivaham-agent-01"],
  },
  {
    id: "mem-vivaham-04",
    business_id: VIVAHAM_BUSINESS_ID,
    user_id: "user-vivaham-viewer-01",
    role: "viewer",
    is_active: true,
    last_login_at: "2026-11-07T13:00:00.000Z",
    created_at: "2026-11-06T13:00:00.000Z",
    updated_at: "2026-11-07T13:00:00.000Z",
    user_profile: SEED_USERS["user-vivaham-viewer-01"],
  },
];

let memoryInvitations: BusinessInvitation[] = [
  {
    id: "inv-astro-01",
    business_id: ASTRO_BUSINESS_ID,
    email: "consultant.lead@astrology.example.com",
    role: "agent",
    status: "pending",
    invited_by: "owner-user-00000000-0000-0000-0000-000000000001",
    invited_by_name: "Gokul Murugan",
    token: "token-astro-inv-01",
    expires_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "inv-vivaham-01",
    business_id: VIVAHAM_BUSINESS_ID,
    email: "matchmaker.senior@vivaham.example.com",
    role: "agent",
    status: "pending",
    invited_by: "owner-user-00000000-0000-0000-0000-000000000001",
    invited_by_name: "Gokul Murugan",
    token: "token-vivaham-inv-01",
    expires_at: new Date(Date.now() + 86400000 * 6).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

let memoryActivities: TeamActivityLog[] = [
  {
    id: "act-astro-01",
    business_id: ASTRO_BUSINESS_ID,
    actor_id: "owner-user-00000000-0000-0000-0000-000000000001",
    actor_name: "Gokul Murugan",
    activity_type: "member_invited",
    description: "Invited consultant.lead@astrology.example.com as Agent",
    metadata: { email: "consultant.lead@astrology.example.com", role: "agent" },
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "act-astro-02",
    business_id: ASTRO_BUSINESS_ID,
    actor_id: "owner-user-00000000-0000-0000-0000-000000000001",
    actor_name: "Gokul Murugan",
    activity_type: "role_changed",
    description: "Changed Suresh Sastri's role to Admin",
    metadata: { member_name: "Suresh Sastri", old_role: "agent", new_role: "admin" },
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "act-vivaham-01",
    business_id: VIVAHAM_BUSINESS_ID,
    actor_id: "owner-user-00000000-0000-0000-0000-000000000001",
    actor_name: "Gokul Murugan",
    activity_type: "member_invited",
    description: "Invited matchmaker.senior@vivaham.example.com as Agent",
    metadata: { email: "matchmaker.senior@vivaham.example.com", role: "agent" },
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

let memoryAssignmentLogs: ConversationAssignmentLog[] = [];

// Helper for test reset
export function resetTeamMemoryStore() {
  memoryMembers = memoryMembers.map((m) => ({ ...m }));
  memoryInvitations = memoryInvitations.map((i) => ({ ...i }));
  memoryActivities = [...memoryActivities];
  memoryAssignmentLogs = [];
}

// ==============================================================================
// 1. GET TEAM MEMBERS
// ==============================================================================

export async function getTeamMembersDb(
  businessId: string,
  filters: TeamFilterOptions = {},
  client?: any
): Promise<TeamMemberWithProfile[]> {
  await validateTenant(businessId);

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      let query = supabase
        .from("business_members")
        .select(`
          id,
          business_id,
          user_id,
          role,
          is_active,
          last_login_at,
          created_at,
          updated_at,
          user_profiles (
            id,
            email,
            full_name,
            avatar_url,
            is_superadmin,
            created_at,
            updated_at
          )
        `)
        .eq("business_id", businessId);

      if (filters.role && filters.role !== "all") {
        query = query.eq("role", filters.role);
      }
      if (filters.status === "active") {
        query = query.eq("is_active", true);
      } else if (filters.status === "inactive") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return (data as any[]).map((row) => ({
          id: row.id,
          business_id: row.business_id,
          user_id: row.user_id,
          role: row.role as BusinessRole,
          is_active: row.is_active,
          last_login_at: row.last_login_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          user_profile: row.user_profiles || {
            id: row.user_id,
            email: "user@example.com",
            full_name: "Team Member",
            avatar_url: null,
            is_superadmin: false,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
        }));
      }
    } catch (err) {
      console.warn("getTeamMembersDb fallback to memory:", err);
    }
  }

  // Memory fallback
  return memoryMembers.filter((m) => {
    if (m.business_id !== businessId) return false;
    if (filters.role && filters.role !== "all" && m.role !== filters.role) return false;
    if (filters.status === "active" && !m.is_active) return false;
    if (filters.status === "inactive" && m.is_active) return false;
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const name = m.user_profile.full_name?.toLowerCase() || "";
      const email = m.user_profile.email.toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });
}

// ==============================================================================
// 2. INVITE TEAM MEMBER
// ==============================================================================

export interface InviteTeamMemberInput {
  email: string;
  role: BusinessRole;
  fullName?: string;
}

export async function inviteTeamMemberDb(
  businessId: string,
  input: InviteTeamMemberInput,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<BusinessInvitation> {
  await validateTenant(businessId);

  // RBAC Permission checks:
  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("Unauthorized: Only business owners and admins can invite team members.");
  }
  if (actor.role === "admin" && (input.role === "owner" || input.role === "admin")) {
    throw new Error("Privilege escalation forbidden: Business admins can only invite Agents and Viewers.");
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  // Verify email is not already an active member of this business
  const existingMembers = await getTeamMembersDb(businessId, {}, client);
  const alreadyMember = existingMembers.find(
    (m) => m.user_profile.email.toLowerCase() === normalizedEmail && m.is_active
  );
  if (alreadyMember) {
    throw new Error(`User with email "${normalizedEmail}" is already an active member of this business.`);
  }

  const invitation: BusinessInvitation = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    business_id: businessId,
    email: normalizedEmail,
    role: input.role,
    status: "pending",
    invited_by: actor.id,
    invited_by_name: actor.name,
    token: `tok-${Math.random().toString(36).substring(2, 12)}`,
    expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("business_invitations")
        .insert({
          business_id: businessId,
          email: invitation.email,
          role: invitation.role,
          status: "pending",
          invited_by: actor.id,
          invited_by_name: actor.name,
          token: invitation.token,
          expires_at: invitation.expires_at,
        })
        .select()
        .single();

      if (!error && data) {
        invitation.id = data.id;
      }
    } catch (err) {
      console.warn("inviteTeamMemberDb Supabase write error, keeping memory record:", err);
    }
  }

  // Resolve business metadata for email
  let businessName = businessId === ASTRO_BUSINESS_ID ? "Gokul's Astrological Insights" : "Gokul Vivaham";
  let businessSlug = businessId === ASTRO_BUSINESS_ID ? "astrology" : "vivaham";
  if (supabase) {
    try {
      const { data: bData } = await supabase
        .from("businesses")
        .select("name, slug")
        .eq("id", businessId)
        .maybeSingle();
      if (bData) {
        businessName = bData.name || businessName;
        businessSlug = bData.slug || businessSlug;
      }
    } catch {
      // fallback
    }
  }

  // Dispatch transactional email via server-side adapter
  try {
    const delivery = await sendInvitationEmail({
      toEmail: normalizedEmail,
      businessName,
      businessSlug,
      inviterName: actor.name,
      role: input.role,
      invitationToken: invitation.token || "",
      expiresAt: invitation.expires_at,
    });
    invitation.delivery_status = delivery.sent
      ? "sent"
      : delivery.configured
      ? "failed"
      : "not_configured";
    if (!delivery.sent && delivery.error) {
      invitation.delivery_error = delivery.error;
    }
  } catch (err: any) {
    invitation.delivery_status = "failed";
    invitation.delivery_error = err?.message || "Email delivery failed";
  }

  // Record in memory store
  memoryInvitations.unshift(invitation);

  // Log Team Activity
  await logTeamActivityDb(
    businessId,
    {
      actor_id: actor.id,
      actor_name: actor.name,
      activity_type: "member_invited",
      description: `Invited ${normalizedEmail} as ${input.role.toUpperCase()}`,
      metadata: { email: normalizedEmail, role: input.role },
    },
    client
  );

  // Trigger internal team notification
  await createNotificationDb(
    businessId,
    {
      userId: actor.id,
      reminderType: "team_invitation",
      category: "team",
      title: `Team Member Invited: ${normalizedEmail}`,
      message: `${normalizedEmail} was invited to join as ${input.role.toUpperCase()} by ${actor.name}.`,
      actionUrl: `/workspace/${businessId}/team`,
      dedupKey: `team:invite:${invitation.id}:${actor.id}`,
    },
    client
  ).catch(() => {});

  return invitation;
}

// ==============================================================================
// 3. UPDATE MEMBER ROLE
// ==============================================================================

export async function updateMemberRoleDb(
  businessId: string,
  memberId: string,
  newRole: BusinessRole,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<TeamMemberWithProfile> {
  await validateTenant(businessId);

  const members = await getTeamMembersDb(businessId, {}, client);
  const target = members.find((m) => m.id === memberId);
  if (!target) {
    throw new Error(`Team member not found for this business.`);
  }

  // RBAC Permission checks:
  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("Unauthorized: Only owners and admins can update member roles.");
  }

  // Guard against non-owners modifying owners
  if (target.role === "owner" && actor.role !== "owner") {
    throw new Error("Privilege escalation forbidden: Non-owners cannot modify an owner's role.");
  }

  // Guard against non-owners promoting to owner
  if (newRole === "owner" && actor.role !== "owner") {
    throw new Error("Privilege escalation forbidden: Only owners can grant owner role.");
  }

  // Admin cannot promote anyone to Admin or Owner
  if (actor.role === "admin" && (newRole === "admin" || target.role === "admin")) {
    throw new Error("Privilege escalation forbidden: Admins cannot promote or demote Admin roles.");
  }

  // Cannot demote the sole active owner
  if (target.role === "owner" && newRole !== "owner") {
    const activeOwners = members.filter((m) => m.role === "owner" && m.is_active);
    if (activeOwners.length <= 1) {
      throw new Error("Cannot demote the sole active owner of this business.");
    }
  }

  const oldRole = target.role;
  target.role = newRole;
  target.updated_at = new Date().toISOString();

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      await supabase
        .from("business_members")
        .update({ role: newRole, updated_at: target.updated_at })
        .eq("id", memberId)
        .eq("business_id", businessId);
    } catch (err) {
      console.warn("updateMemberRoleDb Supabase update error:", err);
    }
  }

  // Log activity
  await logTeamActivityDb(
    businessId,
    {
      actor_id: actor.id,
      actor_name: actor.name,
      activity_type: "role_changed",
      description: `Changed ${target.user_profile.full_name || target.user_profile.email}'s role from ${oldRole} to ${newRole}`,
      metadata: {
        member_id: memberId,
        member_name: target.user_profile.full_name,
        old_role: oldRole,
        new_role: newRole,
      },
    },
    client
  );

  return target;
}

// ==============================================================================
// 4. TOGGLE MEMBER STATUS (ACTIVATE / DEACTIVATE)
// ==============================================================================

export async function toggleMemberStatusDb(
  businessId: string,
  memberId: string,
  isActive: boolean,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<TeamMemberWithProfile> {
  await validateTenant(businessId);

  const members = await getTeamMembersDb(businessId, {}, client);
  const target = members.find((m) => m.id === memberId);
  if (!target) {
    throw new Error(`Team member not found for this business.`);
  }

  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("Unauthorized: Only owners and admins can activate or deactivate members.");
  }

  if (target.role === "owner" && actor.role !== "owner") {
    throw new Error("Privilege escalation forbidden: Non-owners cannot deactivate an owner.");
  }

  if (actor.role === "admin" && target.role === "admin") {
    throw new Error("Privilege escalation forbidden: Admins cannot deactivate fellow admins.");
  }

  if (target.role === "owner" && !isActive) {
    const activeOwners = members.filter((m) => m.role === "owner" && m.is_active);
    if (activeOwners.length <= 1) {
      throw new Error("Cannot deactivate the sole active owner of this business.");
    }
  }

  target.is_active = isActive;
  target.updated_at = new Date().toISOString();

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      await supabase
        .from("business_members")
        .update({ is_active: isActive, updated_at: target.updated_at })
        .eq("id", memberId)
        .eq("business_id", businessId);
    } catch (err) {
      console.warn("toggleMemberStatusDb Supabase update error:", err);
    }
  }

  const activityType: TeamActivityType = isActive ? "member_activated" : "member_deactivated";
  await logTeamActivityDb(
    businessId,
    {
      actor_id: actor.id,
      actor_name: actor.name,
      activity_type: activityType,
      description: `${isActive ? "Activated" : "Deactivated"} team member ${target.user_profile.full_name || target.user_profile.email}`,
      metadata: { member_id: memberId, member_name: target.user_profile.full_name, is_active: isActive },
    },
    client
  );

  return target;
}

// ==============================================================================
// 5. REMOVE MEMBER FROM BUSINESS
// ==============================================================================

export async function removeMemberDb(
  businessId: string,
  memberId: string,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<void> {
  await validateTenant(businessId);

  const members = await getTeamMembersDb(businessId, {}, client);
  const target = members.find((m) => m.id === memberId);
  if (!target) {
    throw new Error(`Team member not found for this business.`);
  }

  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("Unauthorized: Only owners and admins can remove team members.");
  }

  if (target.role === "owner" && actor.role !== "owner") {
    throw new Error("Privilege escalation forbidden: Non-owners cannot remove an owner.");
  }

  if (actor.role === "admin" && target.role === "admin") {
    throw new Error("Privilege escalation forbidden: Admins cannot remove fellow admins.");
  }

  if (target.role === "owner") {
    const activeOwners = members.filter((m) => m.role === "owner" && m.is_active);
    if (activeOwners.length <= 1) {
      throw new Error("Cannot remove the sole active owner of this business.");
    }
  }

  // Remove from memory
  const idx = memoryMembers.findIndex((m) => m.id === memberId);
  if (idx !== -1) {
    memoryMembers.splice(idx, 1);
  }

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      await supabase
        .from("business_members")
        .delete()
        .eq("id", memberId)
        .eq("business_id", businessId);
    } catch (err) {
      console.warn("removeMemberDb Supabase delete error:", err);
    }
  }

  await logTeamActivityDb(
    businessId,
    {
      actor_id: actor.id,
      actor_name: actor.name,
      activity_type: "member_removed",
      description: `Removed team member ${target.user_profile.full_name || target.user_profile.email} from the business`,
      metadata: { member_id: memberId, member_name: target.user_profile.full_name, role: target.role },
    },
    client
  );
}

// ==============================================================================
// 6. INVITATION MANAGEMENT (LIST, REVOKE, RESEND)
// ==============================================================================

export async function getTeamInvitationsDb(
  businessId: string,
  client?: any
): Promise<BusinessInvitation[]> {
  await validateTenant(businessId);

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("business_invitations")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as BusinessInvitation[];
      }
    } catch (err) {
      console.warn("getTeamInvitationsDb fallback to memory:", err);
    }
  }

  return memoryInvitations.filter((i) => i.business_id === businessId);
}

export async function revokeInvitationDb(
  businessId: string,
  invitationId: string,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<void> {
  await validateTenant(businessId);

  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("Unauthorized: Only owners and admins can revoke invitations.");
  }

  const target = memoryInvitations.find((i) => i.id === invitationId && i.business_id === businessId);
  if (target) {
    target.status = "revoked";
    target.updated_at = new Date().toISOString();
  }

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      await supabase
        .from("business_invitations")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", invitationId)
        .eq("business_id", businessId);
    } catch (err) {
      console.warn("revokeInvitationDb Supabase update error:", err);
    }
  }
}

export async function resendInvitationDb(
  businessId: string,
  invitationId: string,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<BusinessInvitation> {
  await validateTenant(businessId);

  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("Unauthorized: Only owners and admins can resend invitations.");
  }

  const target = memoryInvitations.find((i) => i.id === invitationId && i.business_id === businessId);
  if (!target) {
    throw new Error("Invitation not found.");
  }

  target.status = "pending";
  target.expires_at = new Date(Date.now() + 86400000 * 7).toISOString();
  target.updated_at = new Date().toISOString();

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      await supabase
        .from("business_invitations")
        .update({
          status: "pending",
          expires_at: target.expires_at,
          updated_at: target.updated_at,
        })
        .eq("id", invitationId)
        .eq("business_id", businessId);
    } catch (err) {
      console.warn("resendInvitationDb Supabase update error:", err);
    }
  }

  // Dispatch fresh email via adapter
  let resendBizName = businessId === ASTRO_BUSINESS_ID ? "Gokul's Astrological Insights" : "Gokul Vivaham";
  let resendBizSlug = businessId === ASTRO_BUSINESS_ID ? "astrology" : "vivaham";
  try {
    const delivery = await sendInvitationEmail({
      toEmail: target.email,
      businessName: resendBizName,
      businessSlug: resendBizSlug,
      inviterName: actor.name,
      role: target.role,
      invitationToken: target.token || "",
      expiresAt: target.expires_at,
    });
    target.delivery_status = delivery.sent
      ? "sent"
      : delivery.configured
      ? "failed"
      : "not_configured";
    if (!delivery.sent && delivery.error) {
      target.delivery_error = delivery.error;
    }
  } catch (err: any) {
    target.delivery_status = "failed";
    target.delivery_error = err?.message || "Email resend delivery failed";
  }

  return target;
}

// ==============================================================================
// 6.5. INVITATION VALIDATION & ACCEPTANCE WORKFLOW
// ==============================================================================

export interface InvitationValidationDetails {
  valid: boolean;
  status: "valid" | "expired" | "revoked" | "already_accepted" | "invalid";
  error?: string;
  invitation?: {
    id: string;
    email: string;
    role: BusinessRole;
    business_id: string;
    business_name: string;
    business_slug: string;
    invited_by_name?: string | null;
    expires_at: string;
  };
}

export async function validateInvitationTokenDb(
  token: string,
  client?: any
): Promise<InvitationValidationDetails> {
  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      valid: false,
      status: "invalid",
      error: "Missing or invalid invitation token.",
    };
  }

  const cleanToken = token.trim();
  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  let inv: BusinessInvitation | null = null;
  let businessName = "Gokul Connect Business";
  let businessSlug = "astrology";

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("business_invitations")
        .select("*, businesses(name, slug)")
        .eq("token", cleanToken)
        .maybeSingle();

      if (!error && data) {
        inv = {
          id: data.id,
          business_id: data.business_id,
          email: data.email,
          role: data.role,
          status: data.status,
          invited_by: data.invited_by,
          invited_by_name: data.invited_by_name,
          token: data.token,
          expires_at: data.expires_at,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        if (data.businesses) {
          businessName = data.businesses.name || businessName;
          businessSlug = data.businesses.slug || businessSlug;
        }
      }
    } catch (err) {
      console.warn("validateInvitationTokenDb Supabase lookup error:", err);
    }
  }

  if (!inv) {
    inv = memoryInvitations.find((i) => i.token === cleanToken) || null;
    if (inv) {
      businessName =
        inv.business_id === ASTRO_BUSINESS_ID
          ? "Gokul's Astrological Insights"
          : "Gokul Vivaham";
      businessSlug =
        inv.business_id === ASTRO_BUSINESS_ID ? "astrology" : "vivaham";
    }
  }

  if (!inv) {
    return {
      valid: false,
      status: "invalid",
      error:
        "This invitation link is invalid or does not exist. Please check your link or request a new invite.",
    };
  }

  if (inv.status === "revoked") {
    return {
      valid: false,
      status: "revoked",
      error: "This invitation has been revoked by an administrator.",
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        business_id: inv.business_id,
        business_name: businessName,
        business_slug: businessSlug,
        invited_by_name: inv.invited_by_name,
        expires_at: inv.expires_at,
      },
    };
  }

  if (inv.status === "accepted") {
    return {
      valid: false,
      status: "already_accepted",
      error:
        "This invitation has already been accepted. You can log in directly to access your workspace.",
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        business_id: inv.business_id,
        business_name: businessName,
        business_slug: businessSlug,
        invited_by_name: inv.invited_by_name,
        expires_at: inv.expires_at,
      },
    };
  }

  const isExpired =
    new Date(inv.expires_at).getTime() < Date.now() || inv.status === "expired";
  if (isExpired) {
    return {
      valid: false,
      status: "expired",
      error:
        "This invitation link has expired. Invitations are valid for 7 days. Please request a new invite.",
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        business_id: inv.business_id,
        business_name: businessName,
        business_slug: businessSlug,
        invited_by_name: inv.invited_by_name,
        expires_at: inv.expires_at,
      },
    };
  }

  return {
    valid: true,
    status: "valid",
    invitation: {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      business_id: inv.business_id,
      business_name: businessName,
      business_slug: businessSlug,
      invited_by_name: inv.invited_by_name,
      expires_at: inv.expires_at,
    },
  };
}

export async function getInvitationByTokenDb(
  token: string,
  client?: any
): Promise<BusinessInvitation | null> {
  const result = await validateInvitationTokenDb(token, client);
  if (!result.invitation) return null;
  const memoryMatch = memoryInvitations.find((i) => i.token === token);
  if (memoryMatch) return memoryMatch;
  return {
    id: result.invitation.id,
    business_id: result.invitation.business_id,
    email: result.invitation.email,
    role: result.invitation.role,
    status: (result.status === "valid" ? "pending" : result.status) as any,
    invited_by: null,
    invited_by_name: result.invitation.invited_by_name,
    token,
    expires_at: result.invitation.expires_at,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function acceptInvitationDb(
  token: string,
  userOrUserId:
    | string
    | {
        id: string;
        email?: string;
        fullName?: string;
      },
  fullName?: string,
  client?: any
): Promise<{
  success: boolean;
  membershipId: string;
  businessId: string;
  businessSlug: string;
  role: BusinessRole;
}> {
  const actualClient = typeof fullName === "object" && fullName !== null ? fullName : client;
  const validation = await validateInvitationTokenDb(token, actualClient);
  if (!validation.valid || !validation.invitation) {
    throw new Error(validation.error || "Cannot accept invalid invitation.");
  }

  const { invitation } = validation;
  const businessId = invitation.business_id;

  const user = typeof userOrUserId === "string"
    ? { id: userOrUserId, email: invitation.email, fullName }
    : {
        id: userOrUserId.id,
        email: userOrUserId.email || invitation.email,
        fullName: userOrUserId.fullName || fullName,
      };

  const normalizedUserEmail = user.email.toLowerCase().trim();
  const normalizedInviteEmail = invitation.email.toLowerCase().trim();

  // Enforce tenant & user integrity: Check email match
  if (normalizedUserEmail !== normalizedInviteEmail) {
    throw new Error(
      `Cross-account invitation mismatch: Invitation was issued for ${invitation.email}, but you are signed in as ${user.email}. Please sign in with the invited email address.`
    );
  }

  let supabase = actualClient;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  // Check if user is already an active member in this business
  if (supabase) {
    try {
      const { data: existingMember } = await supabase
        .from("business_members")
        .select("id, role, is_active")
        .eq("business_id", businessId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingMember && existingMember.is_active) {
        throw new Error("You are already an active member of this business.");
      }
    } catch (err: any) {
      if (err.message?.includes("already an active member")) throw err;
    }
  }

  // Memory store check
  const existingMemMember = memoryMembers.find(
    (m) =>
      m.business_id === businessId &&
      (m.user_id === user.id ||
        m.user_profile.email.toLowerCase() === normalizedUserEmail)
  );
  if (existingMemMember && existingMemMember.is_active) {
    throw new Error("You are already an active member of this business.");
  }

  const membershipId = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  // Update invitation status atomically in DB
  if (supabase) {
    // 1. Ensure user profile exists
    await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          email: normalizedUserEmail,
          full_name: user.fullName || normalizedUserEmail.split("@")[0],
          updated_at: nowIso,
        },
        { onConflict: "id" }
      )
      .catch((e: any) => console.warn("upsert user_profile warning:", e));

    // 2. Insert or update membership
    const { error: memberErr } = await supabase
      .from("business_members")
      .upsert(
        {
          business_id: businessId,
          user_id: user.id,
          role: invitation.role,
          is_active: true,
          last_login_at: nowIso,
        },
        { onConflict: "business_id, user_id" }
      );

    if (memberErr) {
      throw new Error(
        `Failed to create business membership: ${memberErr.message}`
      );
    }

    // 3. Mark invitation as accepted atomically
    const { error: inviteErr } = await supabase
      .from("business_invitations")
      .update({
        status: "accepted",
        updated_at: nowIso,
      })
      .eq("id", invitation.id);

    if (inviteErr) {
      console.warn("business_invitations update warning:", inviteErr);
    }
  }

  // Update memory stores
  const memInv = memoryInvitations.find(
    (i) => i.id === invitation.id || i.token === token
  );
  if (memInv) {
    memInv.status = "accepted";
    memInv.updated_at = nowIso;
  }

  const newMember: TeamMemberWithProfile = {
    id: membershipId,
    business_id: businessId,
    user_id: user.id,
    role: invitation.role,
    is_active: true,
    last_login_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
    user_profile: {
      id: user.id,
      email: normalizedUserEmail,
      full_name: user.fullName || normalizedUserEmail.split("@")[0],
      avatar_url: null,
      is_superadmin: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
  };
  memoryMembers.push(newMember);

  // Log Team Activity
  await logTeamActivityDb(
    businessId,
    {
      actor_id: user.id,
      actor_name: user.fullName || user.email,
      activity_type: "member_activated",
      description: `${user.fullName || user.email} accepted invitation and joined as ${invitation.role.toUpperCase()}`,
      metadata: { role: invitation.role, email: normalizedUserEmail },
    },
    client
  );

  return {
    success: true,
    membershipId,
    businessId,
    businessSlug: invitation.business_slug,
    role: invitation.role,
  };
}

// ==============================================================================
// 7. TEAM ACTIVITY AUDIT LOGS
// ==============================================================================

export async function logTeamActivityDb(
  businessId: string,
  activity: {
    actor_id: string | null;
    actor_name: string | null;
    activity_type: TeamActivityType;
    description: string;
    metadata?: Record<string, unknown>;
  },
  client?: any
): Promise<TeamActivityLog> {
  await validateTenant(businessId);

  const log: TeamActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    business_id: businessId,
    actor_id: activity.actor_id,
    actor_name: activity.actor_name,
    activity_type: activity.activity_type,
    description: activity.description,
    metadata: activity.metadata || {},
    created_at: new Date().toISOString(),
  };

  memoryActivities.unshift(log);

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("team_activity_logs")
        .insert({
          business_id: businessId,
          actor_id: log.actor_id,
          actor_name: log.actor_name,
          activity_type: log.activity_type,
          description: log.description,
          metadata: log.metadata,
        })
        .select()
        .single();

      if (!error && data) {
        log.id = data.id;
      }
    } catch (err) {
      console.warn("logTeamActivityDb Supabase write error:", err);
    }
  }

  return log;
}

export async function getTeamActivityLogsDb(
  businessId: string,
  options: { limit?: number; activityType?: string } = {},
  client?: any
): Promise<TeamActivityLog[]> {
  await validateTenant(businessId);
  const limit = options.limit || 50;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      let query = supabase
        .from("team_activity_logs")
        .select("*")
        .eq("business_id", businessId);

      if (options.activityType && options.activityType !== "all") {
        query = query.eq("activity_type", options.activityType);
      }

      query = query.order("created_at", { ascending: false }).limit(limit);

      const { data, error } = await query;
      if (!error && data) {
        return data as TeamActivityLog[];
      }
    } catch (err) {
      console.warn("getTeamActivityLogsDb fallback to memory:", err);
    }
  }

  return memoryActivities
    .filter((a) => {
      if (a.business_id !== businessId) return false;
      if (options.activityType && options.activityType !== "all" && a.activity_type !== options.activityType) {
        return false;
      }
      return true;
    })
    .slice(0, limit);
}

// ==============================================================================
// 8. AGENT ASSIGNMENT & WORKLOAD
// ==============================================================================

export async function assignConversationToAgentDb(
  businessId: string,
  conversationId: string,
  agentId: string | null,
  agentName: string | null,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<{ success: boolean; previousAgentId: string | null }> {
  await validateTenant(businessId);

  // RBAC Permission check: Viewers cannot assign agents
  if (actor.role === "viewer") {
    throw new Error("Unauthorized: Viewers have read-only access and cannot assign conversations.");
  }

  // If assigning to a specific agent, verify they are an active member of this business
  if (agentId) {
    const members = await getTeamMembersDb(businessId, {}, client);
    const targetAgent = members.find((m) => m.user_id === agentId);
    if (!targetAgent) {
      throw new Error(`Agent with ID "${agentId}" does not belong to this business.`);
    }
    if (!targetAgent.is_active) {
      throw new Error(`Cannot assign conversation to inactive member "${targetAgent.user_profile.full_name}".`);
    }
    if (targetAgent.role === "viewer") {
      throw new Error(`Cannot assign conversation to a Viewer.`);
    }
    agentName = targetAgent.user_profile.full_name || targetAgent.user_profile.email;
  }

  let previousAgentId: string | null = null;
  let previousAgentName: string | null = null;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      // Fetch current conversation state
      const { data: conv } = await supabase
        .from("wa_conversations")
        .select("id, assigned_agent_id, assigned_agent_name")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .single();

      if (conv) {
        previousAgentId = conv.assigned_agent_id;
        previousAgentName = conv.assigned_agent_name;
      }

      await supabase
        .from("wa_conversations")
        .update({
          assigned_agent_id: agentId,
          assigned_agent_name: agentName,
          assigned_at: agentId ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("business_id", businessId);

      // Record assignment log in database
      await supabase.from("conversation_assignment_logs").insert({
        business_id: businessId,
        conversation_id: conversationId,
        assigned_by: actor.id,
        assigned_by_name: actor.name,
        assigned_to: agentId,
        assigned_to_name: agentName,
        previous_assigned_to: previousAgentId,
        previous_assigned_to_name: previousAgentName,
        notes: agentId ? `Assigned to ${agentName}` : `Unassigned`,
      });
    } catch (err) {
      console.warn("assignConversationToAgentDb Supabase update error:", err);
    }
  }

  // Record assignment in memory
  const assignmentLog: ConversationAssignmentLog = {
    id: `cas-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    business_id: businessId,
    conversation_id: conversationId,
    assigned_by: actor.id,
    assigned_by_name: actor.name,
    assigned_to: agentId,
    assigned_to_name: agentName,
    previous_assigned_to: previousAgentId,
    previous_assigned_to_name: previousAgentName,
    notes: agentId ? `Assigned to ${agentName}` : `Unassigned`,
    created_at: new Date().toISOString(),
  };
  memoryAssignmentLogs.unshift(assignmentLog);

  // Log Team Activity
  const isReassignment = Boolean(previousAgentId && agentId && previousAgentId !== agentId);
  const activityType: TeamActivityType = isReassignment ? "conversation_reassigned" : "conversation_assigned";
  const desc = agentId
    ? isReassignment
      ? `Reassigned conversation from ${previousAgentName || "agent"} to ${agentName}`
      : `Assigned conversation to ${agentName}`
    : `Unassigned conversation`;

  await logTeamActivityDb(
    businessId,
    {
      actor_id: actor.id,
      actor_name: actor.name,
      activity_type: activityType,
      description: desc,
      metadata: {
        conversation_id: conversationId,
        assigned_to: agentId,
        assigned_to_name: agentName,
        previous_assigned_to: previousAgentId,
        previous_assigned_to_name: previousAgentName,
      },
    },
    client
  );

  return { success: true, previousAgentId };
}

export async function getConversationAssignmentHistoryDb(
  businessId: string,
  conversationId: string,
  client?: any
): Promise<ConversationAssignmentLog[]> {
  await validateTenant(businessId);

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("conversation_assignment_logs")
        .select("*")
        .eq("business_id", businessId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as ConversationAssignmentLog[];
      }
    } catch (err) {
      console.warn("getConversationAssignmentHistoryDb fallback to memory:", err);
    }
  }

  return memoryAssignmentLogs.filter(
    (l) => l.business_id === businessId && l.conversation_id === conversationId
  );
}

export async function getAgentWorkloadSummaryDb(
  businessId: string,
  client?: any
): Promise<AgentWorkload[]> {
  await validateTenant(businessId);

  const members = await getTeamMembersDb(businessId, {}, client);
  const eligibleAgents = members.filter((m) => m.role !== "viewer");

  let conversations: any[] = [];
  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, assigned_agent_id, status, unread_count")
        .eq("business_id", businessId);
      if (data) conversations = data;
    } catch (err) {
      console.warn("getAgentWorkloadSummaryDb conversations error:", err);
    }
  }

  return eligibleAgents.map((agent) => {
    const agentConvs = conversations.filter((c) => c.assigned_agent_id === agent.user_id);
    const activeConvs = agentConvs.filter((c) => c.status !== "closed" && c.status !== "archived");
    const unread = agentConvs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    const pendingHuman = agentConvs.filter((c) => c.status === "pending_human").length;
    const resolved = agentConvs.filter((c) => c.status === "closed").length;

    return {
      userId: agent.user_id,
      userName: agent.user_profile.full_name || agent.user_profile.email,
      email: agent.user_profile.email,
      role: agent.role,
      isActive: agent.is_active,
      activeConversationsCount: activeConvs.length,
      unreadCount: unread,
      pendingHumanCount: pendingHuman,
      resolvedCount: resolved,
      lastActiveAt: agent.last_login_at || agent.updated_at,
    };
  });
}


