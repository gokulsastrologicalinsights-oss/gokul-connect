"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  cancelScheduledMessage,
  createScheduledMessage,
  deleteDraftScheduledMessage,
  getScheduledMessageById,
  getScheduledMessagesStats,
  listScheduledMessages,
  rescheduleMessage,
  retryScheduledMessage,
  updateScheduledMessage,
} from "@/lib/scheduled/store";
import { processScheduledMessagesBatch } from "@/lib/scheduled/worker";
import {
  ScheduledMessageFilters,
  ScheduledMessagesSummaryStats,
  WhatsAppScheduledMessage,
} from "@/types/database";
import {
  CancelScheduledMessageSchema,
  CreateScheduledMessageSchema,
  DeleteDraftScheduledMessageSchema,
  RescheduleMessageSchema,
  RetryScheduledMessageSchema,
  UpdateScheduledMessageSchema,
} from "@/lib/validation/schemas";
import { storeMediaFile } from "@/lib/media/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const EDIT_ROLES = ["owner", "admin", "agent"];

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-fatal if invoked outside Next.js request context (e.g. in tests)
  }
}

/**
 * List scheduled messages for a business workspace
 */
export async function getScheduledMessagesAction(
  businessSlug: string,
  filters: ScheduledMessageFilters = {}
): Promise<{
  success: boolean;
  messages: WhatsAppScheduledMessage[];
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const messages = await listScheduledMessages(business.id, filters);
    return { success: true, messages };
  } catch (err: any) {
    return {
      success: false,
      messages: [],
      error: err.message || "Failed to load scheduled messages.",
    };
  }
}

/**
 * Retrieve a single scheduled message
 */
export async function getScheduledMessageByIdAction(
  businessSlug: string,
  id: string
): Promise<{
  success: boolean;
  message?: WhatsAppScheduledMessage | null;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const message = await getScheduledMessageById(business.id, id);
    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load scheduled message.",
    };
  }
}

/**
 * Retrieve summary counters for scheduled messages dashboard
 */
export async function getScheduledMessagesStatsAction(
  businessSlug: string
): Promise<{
  success: boolean;
  stats?: ScheduledMessagesSummaryStats;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const stats = await getScheduledMessagesStats(business.id);
    return { success: true, stats };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load scheduled statistics.",
    };
  }
}

/**
 * Create a new scheduled message (Text, Template, or Media)
 */
export async function createScheduledMessageAction(
  rawInput: unknown
): Promise<{
  success: boolean;
  message?: WhatsAppScheduledMessage;
  error?: string;
}> {
  try {
    const validated = CreateScheduledMessageSchema.parse(rawInput);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    // Strict RBAC: Viewers cannot create scheduled messages
    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers have read-only access and cannot schedule messages.",
      };
    }

    // 1. Verify Connection belongs to active business tenant
    try {
      const { isSupabaseConfigured } = await import("@/lib/supabase/client");
      if (isSupabaseConfigured()) {
        const supabase = await createServerSupabaseClient();
        const { data: conn } = await supabase
          .from("wa_connections")
          .select("id, business_id, is_enabled")
          .eq("id", validated.connectionId)
          .eq("business_id", business.id)
          .maybeSingle();

        if (conn && !conn.is_enabled) {
          return {
            success: false,
            error: "Selected WhatsApp connection is currently disabled.",
          };
        }
      } else {
        const { getConnectionInternal } = await import("@/lib/connections/store");
        try {
          const conn = getConnectionInternal(business.id, validated.connectionId);
          if (conn && conn.business_id !== business.id) {
            return {
              success: false,
              error: "Selected WhatsApp connection does not belong to this business.",
            };
          }
          if (conn && !conn.is_enabled) {
            return {
              success: false,
              error: "Selected WhatsApp connection is currently disabled.",
            };
          }
        } catch {
          // Dynamic connection ID in tests
        }
      }
    } catch {
      // Offline fallback
    }

    // 2. If Template message, verify template exists and is APPROVED
    if (validated.messageType === "template" && validated.templateName) {
      try {
        const supabase = await createServerSupabaseClient();
        const { data: tpl } = await supabase
          .from("wa_message_templates")
          .select("id, status, is_archived")
          .eq("business_id", business.id)
          .eq("template_name", validated.templateName)
          .maybeSingle();

        if (tpl) {
          if (tpl.status !== "APPROVED") {
            return {
              success: false,
              error: `Template "${validated.templateName}" is not approved by Meta (current status: ${tpl.status}). Only approved templates can be scheduled.`,
            };
          }
          if (tpl.is_archived) {
            return {
              success: false,
              error: `Template "${validated.templateName}" is archived.`,
            };
          }
        }
      } catch {
        // Offline fallback
      }
    }

    // 3. If Media message with buffer/base64, store media in business tenant storage
    let mediaStoragePath: string | null = null;
    let mediaFilename: string | null = null;
    let mediaFileSize: number | null = null;
    let mediaMimeType: string | null = null;
    let mediaCaption: string | null = null;

    if (validated.media) {
      mediaFilename = validated.media.filename;
      mediaFileSize = validated.media.fileSize;
      mediaMimeType = validated.media.mimeType;
      mediaCaption = validated.media.caption || null;

      if (validated.media.base64Data) {
        const buffer = Buffer.from(validated.media.base64Data, "base64");
        const stored = await storeMediaFile({
          businessId: business.id,
          conversationId: validated.conversationId || "scheduled",
          fileBuffer: buffer,
          mimeType: validated.media.mimeType,
          originalFilename: validated.media.filename,
          mediaType: validated.media.mediaType,
        });
        mediaStoragePath = stored.storagePath;
      } else if (validated.media.storagePath) {
        mediaStoragePath = validated.media.storagePath;
      }
    }

    const message = await createScheduledMessage(
      business.id,
      {
        connection_id: validated.connectionId,
        recipient_phone: validated.recipientPhone,
        recipient_name: validated.recipientName || null,
        conversation_id: validated.conversationId || null,
        message_type: validated.messageType,
        content: validated.content || null,
        template_name: validated.templateName || null,
        template_language: validated.templateLanguage || "en_US",
        template_variables: validated.templateVariables || {},
        media_type: validated.media?.mediaType || null,
        media_storage_path: mediaStoragePath,
        media_filename: mediaFilename,
        media_file_size: mediaFileSize,
        media_mime_type: mediaMimeType,
        media_caption: mediaCaption,
        scheduled_at: validated.scheduledAt,
        timezone: validated.timezone || "Asia/Kolkata",
        status: validated.status || "scheduled",
      },
      { id: user.id, name: user.full_name || user.email }
    );

    safeRevalidatePath(`/workspace/${validated.businessSlug}/scheduled`);
    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to schedule message.",
    };
  }
}

/**
 * Edit an existing scheduled or draft message
 */
export async function updateScheduledMessageAction(
  rawInput: unknown
): Promise<{
  success: boolean;
  message?: WhatsAppScheduledMessage;
  error?: string;
}> {
  try {
    const validated = UpdateScheduledMessageSchema.parse(rawInput);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot modify scheduled messages.",
      };
    }

    const message = await updateScheduledMessage(
      business.id,
      validated.messageId,
      {
        scheduled_at: validated.scheduledAt,
        content: validated.content,
        template_variables: validated.templateVariables,
        media_caption: validated.mediaCaption,
        status: validated.status,
      },
      { id: user.id, name: user.full_name || user.email }
    );

    safeRevalidatePath(`/workspace/${validated.businessSlug}/scheduled`);
    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update scheduled message.",
    };
  }
}

/**
 * Reschedule a message to a new date and time
 */
export async function rescheduleMessageAction(
  businessSlug: string,
  messageId: string,
  newScheduledAt: string
): Promise<{
  success: boolean;
  message?: WhatsAppScheduledMessage;
  error?: string;
}> {
  try {
    const validated = RescheduleMessageSchema.parse({
      businessSlug,
      messageId,
      newScheduledAt,
    });

    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot reschedule messages.",
      };
    }

    const message = await rescheduleMessage(
      business.id,
      validated.messageId,
      validated.newScheduledAt,
      { id: user.id, name: user.full_name || user.email }
    );

    safeRevalidatePath(`/workspace/${validated.businessSlug}/scheduled`);
    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reschedule message.",
    };
  }
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessageAction(
  rawInput: unknown
): Promise<{
  success: boolean;
  message?: WhatsAppScheduledMessage;
  error?: string;
}> {
  try {
    const validated = CancelScheduledMessageSchema.parse(rawInput);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot cancel scheduled messages.",
      };
    }

    const message = await cancelScheduledMessage(
      business.id,
      validated.messageId,
      { id: user.id, name: user.full_name || user.email },
      validated.reason || null
    );

    safeRevalidatePath(`/workspace/${validated.businessSlug}/scheduled`);
    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to cancel scheduled message.",
    };
  }
}

/**
 * Retry an eligible failed scheduled message
 */
export async function retryScheduledMessageAction(
  rawInput: unknown
): Promise<{
  success: boolean;
  message?: WhatsAppScheduledMessage;
  error?: string;
}> {
  try {
    const validated = RetryScheduledMessageSchema.parse(rawInput);
    const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot retry scheduled messages.",
      };
    }

    const message = await retryScheduledMessage(
      business.id,
      validated.messageId,
      { id: user.id, name: user.full_name || user.email }
    );

    safeRevalidatePath(`/workspace/${validated.businessSlug}/scheduled`);
    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to retry scheduled message.",
    };
  }
}

/**
 * Delete a draft scheduled message
 */
export async function deleteDraftScheduledMessageAction(
  businessSlug: string,
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = DeleteDraftScheduledMessageSchema.parse({
      businessSlug,
      messageId,
    });

    const { business, membership } = await validateBusinessAccess(validated.businessSlug);

    if (!membership || !EDIT_ROLES.includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot delete draft messages.",
      };
    }

    const deleted = await deleteDraftScheduledMessage(business.id, validated.messageId);
    if (!deleted) {
      return {
        success: false,
        error: "Draft message not found or message is not in draft status.",
      };
    }

    safeRevalidatePath(`/workspace/${validated.businessSlug}/scheduled`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete draft message.",
    };
  }
}

/**
 * Trigger scheduled message worker on-demand (Owner / Admin only)
 */
export async function triggerScheduledWorkerAction(
  businessSlug: string
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  try {
    const { membership } = await validateBusinessAccess(businessSlug);

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Only Owners and Admins can trigger the scheduled worker.",
      };
    }

    const workerResult = await processScheduledMessagesBatch(15, `admin_trigger_${Date.now()}`);

    safeRevalidatePath(`/workspace/${businessSlug}/scheduled`);
    return { success: true, result: workerResult };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Worker trigger failed.",
    };
  }
}
