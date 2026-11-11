"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitSensitiveAction } from "@/lib/rate-limit/rate-limiter";
import {
  InviteTeamMemberSchema,
  RemoveMemberSchema,
  ResendInvitationSchema,
  RevokeInvitationSchema,
  ToggleMemberStatusSchema,
  UpdateMemberRoleSchema,
} from "@/lib/validation/schemas";
import {
  getAgentWorkloadSummary,
  getConversationAssignmentHistory,
  getTeamActivityLogs,
  getTeamInvitations,
  getTeamMembers,
  inviteTeamMember,
  removeMember,
  resendInvitation,
  revokeInvitation,
  toggleMemberStatus,
  updateMemberRole,
  validateInvitationToken,
  acceptInvitation,
} from "@/lib/team/store";
import {
  AgentWorkload,
  BusinessInvitation,
  ConversationAssignmentLog,
  TeamActivityLog,
  TeamFilterOptions,
  TeamMemberWithProfile,
} from "@/types/database";

export type GetTeamMembersResult =
  | { success: true; members: TeamMemberWithProfile[] }
  | { success: false; error: string; members?: never };

export type InviteTeamMemberResult =
  | { success: true; invitation: BusinessInvitation }
  | { success: false; error: string; invitation?: never };

export type MutateMemberResult =
  | { success: true; member: TeamMemberWithProfile }
  | { success: false; error: string; member?: never };

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string };

export type GetInvitationsResult =
  | { success: true; invitations: BusinessInvitation[] }
  | { success: false; error: string; invitations?: never };

export type GetActivityLogsResult =
  | { success: true; logs: TeamActivityLog[] }
  | { success: false; error: string; logs?: never };

export type GetAgentWorkloadResult =
  | { success: true; workloads: AgentWorkload[] }
  | { success: false; error: string; workloads?: never };

export type GetAssignmentHistoryResult =
  | { success: true; history: ConversationAssignmentLog[] }
  | { success: false; error: string; history?: never };

/**
 * 1. GET TEAM MEMBERS
 */
export async function getTeamMembersAction(
  businessSlug: string,
  filters: TeamFilterOptions = {}
): Promise<GetTeamMembersResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, error: "Unauthorized: Access denied." };
    }

    const members = await getTeamMembers(business.id, filters);
    return { success: true, members };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load team members." };
  }
}

/**
 * 2. INVITE NEW TEAM MEMBER
 */
export async function inviteTeamMemberAction(input: {
  businessSlug: string;
  email: string;
  role: "owner" | "admin" | "agent" | "viewer";
  fullName?: string;
}): Promise<InviteTeamMemberResult> {
  try {
    const validated = InviteTeamMemberSchema.parse(input);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    // RBAC: Only Owners and Admins can invite
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return { success: false, error: "Unauthorized: Only owners and admins can invite team members." };
    }

    // Admins cannot invite Owners or Admins
    if (membership.role === "admin" && (validated.role === "owner" || validated.role === "admin")) {
      return {
        success: false,
        error: "Privilege escalation forbidden: Business admins can only invite Agents and Viewers.",
      };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "invite_member");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before sending another invite.`,
      };
    }

    const invitation = await inviteTeamMember(
      business.id,
      {
        email: validated.email,
        role: validated.role,
        fullName: validated.fullName,
      },
      {
        id: user.id,
        name: user.full_name || user.email,
        role: membership.role,
      }
    );

    revalidatePath(`/workspace/${business.slug}/team`);
    return { success: true, invitation };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to invite team member." };
  }
}

/**
 * 3. UPDATE MEMBER ROLE
 */
export async function updateMemberRoleAction(input: {
  businessSlug: string;
  memberId: string;
  newRole: "owner" | "admin" | "agent" | "viewer";
}): Promise<MutateMemberResult> {
  try {
    const validated = UpdateMemberRoleSchema.parse(input);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return { success: false, error: "Unauthorized: Insufficient permissions to modify roles." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "update_member_role");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const updated = await updateMemberRole(
      business.id,
      validated.memberId,
      validated.newRole,
      {
        id: user.id,
        name: user.full_name || user.email,
        role: membership.role,
      }
    );

    revalidatePath(`/workspace/${business.slug}/team`);
    return { success: true, member: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update member role." };
  }
}

/**
 * 4. TOGGLE MEMBER STATUS (ACTIVATE / DEACTIVATE)
 */
export async function toggleMemberStatusAction(input: {
  businessSlug: string;
  memberId: string;
  isActive: boolean;
}): Promise<MutateMemberResult> {
  try {
    const validated = ToggleMemberStatusSchema.parse(input);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "toggle_member_status");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const updated = await toggleMemberStatus(
      business.id,
      validated.memberId,
      validated.isActive,
      {
        id: user.id,
        name: user.full_name || user.email,
        role: membership.role,
      }
    );

    revalidatePath(`/workspace/${business.slug}/team`);
    return { success: true, member: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to change member status." };
  }
}

/**
 * 5. REMOVE MEMBER FROM BUSINESS
 */
export async function removeMemberAction(input: {
  businessSlug: string;
  memberId: string;
}): Promise<SimpleActionResult> {
  try {
    const validated = RemoveMemberSchema.parse(input);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "remove_member");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    await removeMember(
      business.id,
      validated.memberId,
      {
        id: user.id,
        name: user.full_name || user.email,
        role: membership.role,
      }
    );

    revalidatePath(`/workspace/${business.slug}/team`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove member." };
  }
}

/**
 * 6. GET TEAM INVITATIONS
 */
export async function getTeamInvitationsAction(
  businessSlug: string
): Promise<GetInvitationsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, error: "Unauthorized: Access denied." };
    }

    const invitations = await getTeamInvitations(business.id);
    return { success: true, invitations };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load invitations." };
  }
}

/**
 * 7. REVOKE INVITATION
 */
export async function revokeInvitationAction(input: {
  businessSlug: string;
  invitationId: string;
}): Promise<SimpleActionResult> {
  try {
    const validated = RevokeInvitationSchema.parse(input);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    await revokeInvitation(
      business.id,
      validated.invitationId,
      {
        id: user.id,
        name: user.full_name || user.email,
        role: membership.role,
      }
    );

    revalidatePath(`/workspace/${business.slug}/team`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to revoke invitation." };
  }
}

/**
 * 8. RESEND INVITATION
 */
export async function resendInvitationAction(input: {
  businessSlug: string;
  invitationId: string;
}): Promise<InviteTeamMemberResult> {
  try {
    const validated = ResendInvitationSchema.parse(input);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const invitation = await resendInvitation(
      business.id,
      validated.invitationId,
      {
        id: user.id,
        name: user.full_name || user.email,
        role: membership.role,
      }
    );

    revalidatePath(`/workspace/${business.slug}/team`);
    return { success: true, invitation };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to resend invitation." };
  }
}

/**
 * 9. GET TEAM ACTIVITY LOGS
 */
export async function getTeamActivityLogsAction(
  businessSlug: string,
  options: { limit?: number; activityType?: string } = {}
): Promise<GetActivityLogsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, error: "Unauthorized: Access denied." };
    }

    const logs = await getTeamActivityLogs(business.id, options);
    return { success: true, logs };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load team activity logs." };
  }
}

/**
 * 10. GET AGENT WORKLOAD SUMMARY
 */
export async function getAgentWorkloadSummaryAction(
  businessSlug: string
): Promise<GetAgentWorkloadResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, error: "Unauthorized: Access denied." };
    }

    const workloads = await getAgentWorkloadSummary(business.id);
    return { success: true, workloads };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load agent workloads." };
  }
}

/**
 * 11. GET CONVERSATION ASSIGNMENT HISTORY
 */
export async function getConversationAssignmentHistoryAction(
  businessSlug: string,
  conversationId: string
): Promise<GetAssignmentHistoryResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, error: "Unauthorized: Access denied." };
    }

    const history = await getConversationAssignmentHistory(business.id, conversationId);
    return { success: true, history };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load assignment history." };
  }
}

/**
 * 12. VALIDATE INVITATION TOKEN
 */
export async function validateInvitationTokenAction(token: string) {
  try {
    return await validateInvitationToken(token);
  } catch (err: any) {
    return {
      valid: false,
      status: "invalid" as const,
      error: err.message || "Failed to validate invitation token.",
    };
  }
}

/**
 * 13. ACCEPT INVITATION
 */
export async function acceptInvitationAction(input: {
  token: string;
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };
  fullName?: string;
  password?: string;
}) {
  try {
    if (!input.token?.trim()) {
      return { success: false, error: "Invitation token is required." };
    }

    const token = input.token.trim();
    let user = input.user;

    // 1. If user not explicitly provided, check active Supabase Auth session
    if (!user && isSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabaseClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser && authUser.email) {
          user = {
            id: authUser.id,
            email: authUser.email,
            fullName:
              input.fullName ||
              authUser.user_metadata?.full_name ||
              authUser.email.split("@")[0],
          };
        }
      } catch {
        // Not authenticated in session
      }
    }

    // 2. If user is still not present, validate token first
    const validation = await validateInvitationToken(token);
    if (!validation.valid || !validation.invitation) {
      return {
        success: false,
        error: validation.error || "Cannot accept invalid invitation.",
      };
    }

    // 3. If password was provided and user doesn't exist, create account or proceed
    if (!user) {
      if (input.password && input.password.length >= 8) {
        if (isSupabaseConfigured()) {
          try {
            const adminClient = createAdminClient();
            const { data: newUser, error: createErr } =
              await adminClient.auth.admin.createUser({
                email: validation.invitation.email,
                password: input.password,
                email_confirm: true,
                user_metadata: {
                  full_name:
                    input.fullName || validation.invitation.email.split("@")[0],
                },
              });

            if (createErr) {
              // If user already exists in auth, prompt to login
              if (createErr.message.includes("already registered") || createErr.message.includes("exists")) {
                return {
                  success: false,
                  error: "An account with this email already exists. Please log in first, then accept the invitation.",
                };
              }
              return { success: false, error: createErr.message };
            }

            if (newUser?.user) {
              user = {
                id: newUser.user.id,
                email: newUser.user.email || validation.invitation.email,
                fullName:
                  input.fullName || validation.invitation.email.split("@")[0],
              };
            }
          } catch (authErr: any) {
            return { success: false, error: authErr.message || "Account creation failed." };
          }
        } else {
          // Dev / mock user
          user = {
            id: `user-invited-${Date.now()}`,
            email: validation.invitation.email,
            fullName:
              input.fullName || validation.invitation.email.split("@")[0],
          };
        }
      } else {
        return {
          success: false,
          error:
            "Please log in to your account, or provide a password (min 8 characters) to set up your account.",
        };
      }
    }

    if (!user?.id || !user?.email) {
      return { success: false, error: "Failed to resolve user identity." };
    }

    const result = await acceptInvitation(token, user);

    try {
      revalidatePath(`/select-business`);
      revalidatePath(`/workspace/${result.businessSlug}/dashboard`);
      revalidatePath(`/workspace/${result.businessSlug}/team`);
    } catch {
      // Revalidation safe fallback
    }

    return {
      success: true,
      membershipId: result.membershipId,
      businessId: result.businessId,
      businessSlug: result.businessSlug,
      role: result.role,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to accept invitation.",
    };
  }
}
