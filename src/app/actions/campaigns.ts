"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  cancelCampaign,
  createCampaign,
  deleteDraftCampaign,
  exportCampaignRecipientsToCsv,
  getCampaignById,
  getCampaignRecipients,
  getCampaignStats,
  launchCampaign,
  listCampaigns,
  pauseCampaign,
  prepareCampaignAudience,
  previewCampaignAudience,
  resumeCampaign,
  retryFailedCampaignRecipients,
  updateCampaign,
} from "@/lib/campaigns/store";
import { processCampaignsBatch } from "@/lib/campaigns/worker";
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
  CampaignAudiencePreviewSchema,
  CreateCampaignSchema,
  UpdateCampaignSchema,
} from "@/lib/validation/schemas";
import { getMediaTypeFromMime, storeMediaFile } from "@/lib/media/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MUTATION_ROLES = ["owner", "admin"];
const OPERATIONAL_ROLES = ["owner", "admin", "agent"];

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-fatal if invoked outside Next.js request context (e.g. in tests)
  }
}

/**
 * List campaigns for a business workspace
 */
export async function getCampaignsAction(
  businessSlug: string,
  filters: CampaignFilterOptions = {}
): Promise<{
  success: boolean;
  campaigns: WhatsAppCampaign[];
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const campaigns = await listCampaigns(business.id, filters);
    return { success: true, campaigns };
  } catch (err: any) {
    return {
      success: false,
      campaigns: [],
      error: err.message || "Failed to load campaigns.",
    };
  }
}

/**
 * Retrieve a single campaign by ID
 */
export async function getCampaignDetailsAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign | null;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const campaign = await getCampaignById(business.id, campaignId);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load campaign details.",
    };
  }
}

/**
 * Retrieve summary KPIs for the campaigns dashboard
 */
export async function getCampaignStatsAction(
  businessSlug: string
): Promise<{
  success: boolean;
  stats?: CampaignSummaryStats;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const stats = await getCampaignStats(business.id);
    return { success: true, stats };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load campaign statistics.",
    };
  }
}

/**
 * Preview audience and calculate eligibility breakdown
 */
export async function previewCampaignAudienceAction(
  businessSlug: string,
  messageType: CampaignMessageType,
  audienceType: CampaignAudienceType,
  audienceFilters: CampaignAudienceFilters = {}
): Promise<{
  success: boolean;
  preview?: CampaignAudiencePreviewResult;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const preview = await previewCampaignAudience(
      business.id,
      messageType,
      audienceType,
      audienceFilters
    );
    return { success: true, preview };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to preview campaign audience.",
    };
  }
}

/**
 * Create a new campaign (draft or scheduled)
 */
export async function createCampaignAction(
  businessSlug: string,
  formData: FormData
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    // Permission check: Viewers and unauthorized roles cannot create campaigns
    if (!MUTATION_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to create campaigns.`,
      };
    }

    const rawData: Record<string, any> = {
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      connectionId: formData.get("connectionId"),
      messageType: formData.get("messageType"),
      templateId: formData.get("templateId") || undefined,
      templateName: formData.get("templateName") || undefined,
      templateLanguage: formData.get("templateLanguage") || "en_US",
      content: formData.get("content") || undefined,
      mediaCaption: formData.get("mediaCaption") || undefined,
      audienceType: formData.get("audienceType") || "all_contacts",
      scheduledAt: formData.get("scheduledAt") || undefined,
      timezone: formData.get("timezone") || "Asia/Kolkata",
      status: formData.get("status") || "draft",
      batchSize: formData.get("batchSize") ? Number(formData.get("batchSize")) : 50,
      dispatchIntervalMs: formData.get("dispatchIntervalMs")
        ? Number(formData.get("dispatchIntervalMs"))
        : 1000,
    };

    const templateVariablesRaw = formData.get("templateVariables");
    if (typeof templateVariablesRaw === "string" && templateVariablesRaw.trim()) {
      try {
        rawData.templateVariables = JSON.parse(templateVariablesRaw);
      } catch {
        rawData.templateVariables = {};
      }
    }

    const audienceFiltersRaw = formData.get("audienceFilters");
    if (typeof audienceFiltersRaw === "string" && audienceFiltersRaw.trim()) {
      try {
        rawData.audienceFilters = JSON.parse(audienceFiltersRaw);
      } catch {
        rawData.audienceFilters = {};
      }
    }

    // Handle Media upload if attached
    const mediaFile = formData.get("mediaFile") as File | null;
    let mediaInfo: {
      storagePath?: string;
      filename?: string;
      fileSize?: number;
      mimeType?: string;
      mediaType?: any;
    } = {};

    if (mediaFile && mediaFile.size > 0) {
      const detectedMediaType = getMediaTypeFromMime(mediaFile.type);
      if (!detectedMediaType) {
        return { success: false, error: "Unsupported media format." };
      }
      const buffer = Buffer.from(await mediaFile.arrayBuffer());
      const storeRes = await storeMediaFile({
        businessId: business.id,
        conversationId: "campaigns",
        fileBuffer: buffer,
        mimeType: mediaFile.type,
        originalFilename: mediaFile.name,
        mediaType: detectedMediaType,
      });

      rawData.mediaType = detectedMediaType;
      rawData.mediaStoragePath = storeRes.storagePath;
      rawData.mediaFilename = storeRes.sanitizedFilename;
      rawData.mediaFileSize = storeRes.fileSize;
      rawData.mediaMimeType = mediaFile.type;
    }

    const validated = CreateCampaignSchema.parse(rawData);

    const campaign = await createCampaign(
      business.id,
      {
        name: validated.name,
        description: validated.description,
        connection_id: validated.connectionId,
        message_type: validated.messageType,
        template_id: validated.templateId,
        template_name: validated.templateName,
        template_language: validated.templateLanguage,
        template_variables: validated.templateVariables,
        message_content: validated.content,
        media_type: validated.mediaType,
        media_storage_path: validated.mediaStoragePath,
        media_filename: validated.mediaFilename,
        media_file_size: validated.mediaFileSize,
        media_mime_type: validated.mediaMimeType,
        media_caption: validated.mediaCaption,
        audience_type: validated.audienceType,
        audience_filters: validated.audienceFilters,
        scheduled_at: validated.scheduledAt,
        timezone: validated.timezone,
        status: validated.status,
        batch_size: validated.batchSize,
        dispatch_interval_ms: validated.dispatchIntervalMs,
      },
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create campaign.",
    };
  }
}

/**
 * Update an existing campaign
 */
export async function updateCampaignAction(
  businessSlug: string,
  campaignId: string,
  data: Record<string, any>
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!MUTATION_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to edit campaigns.`,
      };
    }

    const validated = UpdateCampaignSchema.parse(data);

    const campaign = await updateCampaign(
      business.id,
      campaignId,
      {
        name: validated.name,
        description: validated.description,
        connection_id: validated.connectionId,
        message_type: validated.messageType,
        template_id: validated.templateId,
        template_name: validated.templateName,
        template_language: validated.templateLanguage,
        template_variables: validated.templateVariables,
        message_content: validated.content,
        media_caption: validated.mediaCaption,
        audience_type: validated.audienceType,
        audience_filters: validated.audienceFilters,
        scheduled_at: validated.scheduledAt,
        batch_size: validated.batchSize,
        dispatch_interval_ms: validated.dispatchIntervalMs,
      },
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update campaign.",
    };
  }
}

/**
 * Prepare and snapshot audience for a campaign
 */
export async function prepareCampaignAudienceAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  audienceCount?: number;
  eligibleCount?: number;
  excludedCount?: number;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!MUTATION_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to prepare campaigns.`,
      };
    }

    const result = await prepareCampaignAudience(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, ...result };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to prepare campaign audience.",
    };
  }
}

/**
 * Launch campaign: transitions status to queued/sending and kicks off dispatch
 */
export async function launchCampaignAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!OPERATIONAL_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to launch campaigns.`,
      };
    }

    const campaign = await launchCampaign(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    // Asynchronously kick off immediate campaign recipient processing batch
    processCampaignsBatch().catch((err) => {
      console.error("[Campaign Dispatch Kickoff Error]:", err?.message || err);
    });

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to launch campaign.",
    };
  }
}

/**
 * Pause a running or queued campaign
 */
export async function pauseCampaignAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!OPERATIONAL_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to pause campaigns.`,
      };
    }

    const campaign = await pauseCampaign(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to pause campaign.",
    };
  }
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaignAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!OPERATIONAL_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to resume campaigns.`,
      };
    }

    const campaign = await resumeCampaign(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to resume campaign.",
    };
  }
}

/**
 * Cancel a campaign
 */
export async function cancelCampaignAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  campaign?: WhatsAppCampaign;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!MUTATION_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to cancel campaigns.`,
      };
    }

    const campaign = await cancelCampaign(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, campaign };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to cancel campaign.",
    };
  }
}

/**
 * Delete a draft campaign
 */
export async function deleteDraftCampaignAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!MUTATION_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to delete campaigns.`,
      };
    }

    const success = await deleteDraftCampaign(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete draft campaign.",
    };
  }
}

/**
 * Get recipients for a campaign
 */
export async function getCampaignRecipientsAction(
  businessSlug: string,
  campaignId: string,
  options: {
    status?: CampaignRecipientStatus | "all";
    eligibility?: CampaignRecipientEligibility | "all";
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  success: boolean;
  recipients: WhatsAppCampaignRecipient[];
  totalCount: number;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const result = await getCampaignRecipients(business.id, campaignId, options);
    return { success: true, ...result };
  } catch (err: any) {
    return {
      success: false,
      recipients: [],
      totalCount: 0,
      error: err.message || "Failed to load campaign recipients.",
    };
  }
}

/**
 * Retry failed recipients for a campaign
 */
export async function retryFailedCampaignRecipientsAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  retriedCount?: number;
  error?: string;
}> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);

    if (!OPERATIONAL_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to retry campaign recipients.`,
      };
    }

    const retriedCount = await retryFailedCampaignRecipients(
      business.id,
      campaignId,
      { id: user.id, name: user.email || "Staff" }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/campaigns/${campaignId}`);
    return { success: true, retriedCount };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to retry campaign recipients.",
    };
  }
}

/**
 * Export campaign results as secure RFC 4180 CSV
 */
export async function exportCampaignResultsCsvAction(
  businessSlug: string,
  campaignId: string
): Promise<{
  success: boolean;
  csv?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const campaign = await getCampaignById(business.id, campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found." };
    }

    const { recipients } = await getCampaignRecipients(business.id, campaignId, { limit: 10000 });
    const csv = exportCampaignRecipientsToCsv(recipients);

    const safeTitle = campaign.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `campaign_${safeTitle}_${new Date().toISOString().split("T")[0]}.csv`;

    return { success: true, csv, filename };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to export campaign results.",
    };
  }
}

/**
 * Trigger manual background campaign dispatch worker run
 */
export async function triggerCampaignWorkerAction(
  businessSlug: string
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    const { membership } = await validateBusinessAccess(businessSlug);
    if (!OPERATIONAL_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: `Permission denied: ${membership.role} role is not permitted to trigger campaign workers.`,
      };
    }

    const result = await processCampaignsBatch();
    safeRevalidatePath(`/workspace/${businessSlug}/campaigns`);
    return { success: true, result };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to execute campaign worker.",
    };
  }
}
