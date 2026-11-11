import {
  CampaignAudienceFilters,
  CampaignAudiencePreviewResult,
  CampaignAudienceType,
  CampaignFilterOptions,
  CampaignMessageType,
  CampaignRecipientEligibility,
  CampaignRecipientStatus,
  CampaignSummaryStats,
  WhatsAppCampaign,
  WhatsAppCampaignRecipient,
} from "@/types/database";
import {
  cancelCampaignDb,
  createCampaignDb,
  CreateCampaignDbInput,
  deleteDraftCampaignDb,
  exportCampaignRecipientsToCsv,
  getCampaignByIdDb,
  getCampaignRecipientsDb,
  getCampaignStatsDb,
  launchCampaignDb,
  listCampaignsDb,
  pauseCampaignDb,
  prepareCampaignAudienceDb,
  previewCampaignAudienceDb,
  resetCampaignMemoryStore,
  resumeCampaignDb,
  retryFailedCampaignRecipientsDb,
  seedCampaignMemoryStore,
  updateCampaignDb,
  UpdateCampaignDbInput,
} from "./database";
import { logTeamActivity } from "@/lib/team/store";

export { resetCampaignMemoryStore, seedCampaignMemoryStore, exportCampaignRecipientsToCsv };

export async function listCampaigns(
  businessId: string,
  filters: CampaignFilterOptions = {},
  client?: any
): Promise<WhatsAppCampaign[]> {
  return listCampaignsDb(businessId, filters, client);
}

export async function getCampaignById(
  businessId: string,
  campaignId: string,
  client?: any
): Promise<WhatsAppCampaign | null> {
  return getCampaignByIdDb(businessId, campaignId, client);
}

export async function getCampaignStats(
  businessId: string,
  client?: any
): Promise<CampaignSummaryStats> {
  return getCampaignStatsDb(businessId, client);
}

export async function previewCampaignAudience(
  businessId: string,
  messageType: CampaignMessageType,
  audienceType: CampaignAudienceType,
  audienceFilters: CampaignAudienceFilters = {},
  client?: any
): Promise<CampaignAudiencePreviewResult> {
  return previewCampaignAudienceDb(businessId, messageType, audienceType, audienceFilters, client);
}

export async function createCampaign(
  businessId: string,
  input: CreateCampaignDbInput,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppCampaign> {
  const result = await createCampaignDb(businessId, input, actor?.id, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_created", // reuse existing team activity enum
    description: `Created ${input.message_type} campaign: "${input.name}"`,
    metadata: { campaign_id: result.id, message_type: input.message_type },
  });

  return result;
}

export async function updateCampaign(
  businessId: string,
  campaignId: string,
  input: UpdateCampaignDbInput,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppCampaign> {
  const result = await updateCampaignDb(businessId, campaignId, input, actor?.id, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_edited",
    description: `Updated campaign: "${result.name}"`,
    metadata: { campaign_id: result.id },
  });

  return result;
}

export async function prepareCampaignAudience(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<{ audienceCount: number; eligibleCount: number; excludedCount: number }> {
  const result = await prepareCampaignAudienceDb(businessId, campaignId, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_created",
    description: `Prepared audience for campaign: ${result.eligibleCount} eligible, ${result.excludedCount} excluded`,
    metadata: { campaign_id: campaignId, ...result },
  });

  return result;
}

export async function launchCampaign(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppCampaign> {
  const result = await launchCampaignDb(businessId, campaignId, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_dispatched",
    description: `Launched campaign: "${result.name}" (${result.eligible_count} recipients queued)`,
    metadata: { campaign_id: result.id },
  });

  return result;
}

export async function pauseCampaign(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppCampaign> {
  const result = await pauseCampaignDb(businessId, campaignId, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_edited",
    description: `Paused campaign: "${result.name}"`,
    metadata: { campaign_id: result.id },
  });

  return result;
}

export async function resumeCampaign(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppCampaign> {
  const result = await resumeCampaignDb(businessId, campaignId, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_dispatched",
    description: `Resumed campaign: "${result.name}"`,
    metadata: { campaign_id: result.id },
  });

  return result;
}

export async function cancelCampaign(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppCampaign> {
  const result = await cancelCampaignDb(businessId, campaignId, actor?.id, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_cancelled",
    description: `Cancelled campaign: "${result.name}"`,
    metadata: { campaign_id: result.id },
  });

  return result;
}

export async function deleteDraftCampaign(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<boolean> {
  const success = await deleteDraftCampaignDb(businessId, campaignId, client);

  if (success) {
    await logTeamActivity(businessId, {
      actor_id: actor?.id || null,
      actor_name: actor?.name || "System",
      activity_type: "scheduled_message_cancelled",
      description: `Deleted draft campaign ID: ${campaignId}`,
      metadata: { campaign_id: campaignId },
    });
  }

  return success;
}

export async function getCampaignRecipients(
  businessId: string,
  campaignId: string,
  options: {
    status?: CampaignRecipientStatus | "all";
    eligibility?: CampaignRecipientEligibility | "all";
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
  client?: any
): Promise<{ recipients: WhatsAppCampaignRecipient[]; totalCount: number }> {
  return getCampaignRecipientsDb(businessId, campaignId, options, client);
}

export async function retryFailedCampaignRecipients(
  businessId: string,
  campaignId: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<number> {
  const count = await retryFailedCampaignRecipientsDb(businessId, campaignId, client);

  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_retried",
    description: `Retried ${count} failed recipients for campaign ID: ${campaignId}`,
    metadata: { campaign_id: campaignId, retried_count: count },
  });

  return count;
}
