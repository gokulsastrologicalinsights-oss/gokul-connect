import {
  AgentWorkload,
  BusinessInvitation,
  BusinessRole,
  ConversationAssignmentLog,
  TeamActivityLog,
  TeamFilterOptions,
  TeamMemberWithProfile,
} from "@/types/database";
import {
  assignConversationToAgentDb,
  getAgentWorkloadSummaryDb,
  getConversationAssignmentHistoryDb,
  getTeamActivityLogsDb,
  getTeamInvitationsDb,
  getTeamMembersDb,
  inviteTeamMemberDb,
  InviteTeamMemberInput,
  logTeamActivityDb,
  removeMemberDb,
  resendInvitationDb,
  resetTeamMemoryStore,
  revokeInvitationDb,
  toggleMemberStatusDb,
  updateMemberRoleDb,
  validateInvitationTokenDb,
  acceptInvitationDb,
  InvitationValidationDetails,
} from "./database";

export type { InvitationValidationDetails };

export { resetTeamMemoryStore };

export async function getTeamMembers(
  businessId: string,
  filters: TeamFilterOptions = {},
  client?: any
): Promise<TeamMemberWithProfile[]> {
  return getTeamMembersDb(businessId, filters, client);
}

export async function inviteTeamMember(
  businessId: string,
  input: InviteTeamMemberInput,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<BusinessInvitation> {
  return inviteTeamMemberDb(businessId, input, actor, client);
}

export async function updateMemberRole(
  businessId: string,
  memberId: string,
  newRole: BusinessRole,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<TeamMemberWithProfile> {
  return updateMemberRoleDb(businessId, memberId, newRole, actor, client);
}

export async function toggleMemberStatus(
  businessId: string,
  memberId: string,
  isActive: boolean,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<TeamMemberWithProfile> {
  return toggleMemberStatusDb(businessId, memberId, isActive, actor, client);
}

export async function removeMember(
  businessId: string,
  memberId: string,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<void> {
  return removeMemberDb(businessId, memberId, actor, client);
}

export async function getTeamInvitations(
  businessId: string,
  client?: any
): Promise<BusinessInvitation[]> {
  return getTeamInvitationsDb(businessId, client);
}

export async function revokeInvitation(
  businessId: string,
  invitationId: string,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<void> {
  return revokeInvitationDb(businessId, invitationId, actor, client);
}

export async function resendInvitation(
  businessId: string,
  invitationId: string,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<BusinessInvitation> {
  return resendInvitationDb(businessId, invitationId, actor, client);
}

export async function getTeamActivityLogs(
  businessId: string,
  options: { limit?: number; activityType?: string } = {},
  client?: any
): Promise<TeamActivityLog[]> {
  return getTeamActivityLogsDb(businessId, options, client);
}

export async function logTeamActivity(
  businessId: string,
  activity: {
    actor_id: string | null;
    actor_name: string | null;
    activity_type: any;
    description: string;
    metadata?: Record<string, unknown>;
  },
  client?: any
): Promise<TeamActivityLog> {
  return logTeamActivityDb(businessId, activity, client);
}

export async function assignConversationToAgent(
  businessId: string,
  conversationId: string,
  agentId: string | null,
  agentName: string | null,
  actor: { id: string; name: string; role: BusinessRole },
  client?: any
): Promise<{ success: boolean; previousAgentId: string | null }> {
  return assignConversationToAgentDb(businessId, conversationId, agentId, agentName, actor, client);
}

export async function getConversationAssignmentHistory(
  businessId: string,
  conversationId: string,
  client?: any
): Promise<ConversationAssignmentLog[]> {
  return getConversationAssignmentHistoryDb(businessId, conversationId, client);
}

export async function getAgentWorkloadSummary(
  businessId: string,
  client?: any
): Promise<AgentWorkload[]> {
  return getAgentWorkloadSummaryDb(businessId, client);
}

export async function validateInvitationToken(
  token: string,
  client?: any
): Promise<InvitationValidationDetails> {
  return validateInvitationTokenDb(token, client);
}

export async function acceptInvitation(
  token: string,
  user: {
    id: string;
    email: string;
    fullName?: string;
  },
  client?: any
) {
  return acceptInvitationDb(token, user, client);
}
