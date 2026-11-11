import { Metadata } from "next";
import { notFound } from "next/navigation";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getCampaignDetailsAction,
  getCampaignRecipientsAction,
} from "@/app/actions/campaigns";
import { CampaignDetailClient } from "@/components/campaigns/CampaignDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign Details | Gokul Connect",
  description: "View real-time delivery analytics, recipient report, and campaign performance.",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ businessSlug: string; campaignId: string }>;
}) {
  const { businessSlug, campaignId } = await params;
  const { business, user, membership } = await validateBusinessAccess(businessSlug);

  const [campaignRes, recipientsRes] = await Promise.all([
    getCampaignDetailsAction(businessSlug, campaignId),
    getCampaignRecipientsAction(businessSlug, campaignId, { limit: 100 }),
  ]);

  if (!campaignRes.success || !campaignRes.campaign) {
    notFound();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CampaignDetailClient
        business={business}
        currentUser={user}
        currentMembership={membership}
        initialCampaign={campaignRes.campaign}
        initialRecipients={recipientsRes.success ? recipientsRes.recipients : []}
        initialTotalRecipients={recipientsRes.success ? recipientsRes.totalCount : 0}
      />
    </div>
  );
}
