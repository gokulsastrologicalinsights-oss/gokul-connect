import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getAgentWorkloadSummaryAction,
  getTeamActivityLogsAction,
  getTeamInvitationsAction,
  getTeamMembersAction,
} from "@/app/actions/team";
import { TeamClient } from "@/components/team/TeamClient";

export const metadata: Metadata = {
  title: "Team Management & Agent Assignment | Gokul Connect",
  description:
    "Multi-tenant team management, business roles, invitations, agent assignment, and activity audit logs.",
};

export default async function TeamManagementPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business, user, membership } = await validateBusinessAccess(businessSlug);

  // Fetch initial team data in parallel
  const [membersRes, invitationsRes, activitiesRes, workloadsRes] = await Promise.all([
    getTeamMembersAction(businessSlug),
    getTeamInvitationsAction(businessSlug),
    getTeamActivityLogsAction(businessSlug, { limit: 50 }),
    getAgentWorkloadSummaryAction(businessSlug),
  ]);

  const initialMembers = membersRes.success ? membersRes.members : [];
  const initialInvitations = invitationsRes.success ? invitationsRes.invitations : [];
  const initialActivities = activitiesRes.success ? activitiesRes.logs : [];
  const initialWorkloads = workloadsRes.success ? workloadsRes.workloads : [];

  return (
    <TeamClient
      business={business}
      currentUser={user}
      currentMembership={membership}
      initialMembers={initialMembers}
      initialInvitations={initialInvitations}
      initialActivities={initialActivities}
      initialWorkloads={initialWorkloads}
    />
  );
}
