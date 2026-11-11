import { Metadata } from "next";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getCampaignsAction,
  getCampaignStatsAction,
} from "@/app/actions/campaigns";
import { CampaignsDashboardClient } from "@/components/campaigns/CampaignsDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaigns | Gokul Connect",
  description: "Create, target, schedule, and track compliant bulk messaging WhatsApp campaigns.",
};

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business, user, membership } = await validateBusinessAccess(businessSlug);

  // Fetch campaigns and summary statistics in parallel
  const [campaignsRes, statsRes] = await Promise.all([
    getCampaignsAction(businessSlug),
    getCampaignStatsAction(businessSlug),
  ]);

  const initialCampaigns = campaignsRes.success ? campaignsRes.campaigns : [];
  const initialStats = statsRes.success && statsRes.stats
    ? statsRes.stats
    : {
        totalCampaigns: 0,
        activeCampaigns: 0,
        scheduledCampaigns: 0,
        completedCampaigns: 0,
        draftCampaigns: 0,
        totalAudience: 0,
        totalEligible: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        totalFailed: 0,
        deliveryRate: 0,
        readRate: 0,
        failureRate: 0,
      };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CampaignsDashboardClient
        business={business}
        currentUser={user}
        currentMembership={membership}
        initialCampaigns={initialCampaigns}
        initialStats={initialStats}
      />
    </div>
  );
}
