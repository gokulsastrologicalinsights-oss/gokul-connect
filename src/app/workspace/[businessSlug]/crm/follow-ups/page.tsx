import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getFollowUpsAction,
  getFollowUpMetricsAction,
  getLifecycleStagesAction,
  getCrmContactsAction,
} from "@/app/actions/crm";
import { FollowUpsClient } from "@/components/crm/FollowUpsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Follow-ups | Gokul Connect",
  description: "Track customer follow-up tasks, deadlines, priorities, and internal team reminders.",
};

export default async function FollowUpsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business, user, membership } = await validateBusinessAccess(businessSlug);

  const [followUpsRes, metricsRes, stagesRes, contactsRes] = await Promise.all([
    getFollowUpsAction(businessSlug),
    getFollowUpMetricsAction(businessSlug),
    getLifecycleStagesAction(businessSlug),
    getCrmContactsAction(businessSlug, { limit: 100 }),
  ]);

  const initialFollowUps = followUpsRes.success ? followUpsRes.followUps : [];
  const initialMetrics = metricsRes.success && metricsRes.metrics
    ? metricsRes.metrics
    : {
        total: 0,
        totalFollowUps: 0,
        openFollowUps: 0,
        todayCount: 0,
        dueTodayFollowUps: 0,
        upcomingCount: 0,
        overdueCount: 0,
        overdueFollowUps: 0,
        completedCount: 0,
        completedFollowUps: 0,
        completionRate: 0,
      };

  const initialStages = stagesRes.success ? stagesRes.stages : [];
  const initialContacts = contactsRes.success ? contactsRes.contacts : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <FollowUpsClient
        business={business}
        currentUser={user}
        currentMembership={membership}
        initialFollowUps={initialFollowUps}
        initialMetrics={initialMetrics}
        stages={initialStages}
        contacts={initialContacts}
      />
    </div>
  );
}
