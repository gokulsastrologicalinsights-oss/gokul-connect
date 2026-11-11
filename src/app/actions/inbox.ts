"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  assignConversationAgent,
  getApprovedTemplatesDb,
  getConversationByIdDb,
  getConversationMessages,
  getConversationMessagingWindowDb,
  toggleConversationRead,
  updateConversationStatus,
  resumeConversationAutomation,
  updateConversationLabels,
} from "@/lib/inbox/store";
import { getInboxCountsDb } from "@/lib/inbox/database";
import {
  createContactDb,
  getOrCreateConversationForContactDb,
  normalizePhoneNumber,
} from "@/lib/crm/database";
import {
  createCannedResponseDb,
  deleteCannedResponseDb,
  listCannedResponsesDb,
  updateCannedResponseDb,
} from "@/lib/inbox/canned-responses";
import { extractTemplateVariables } from "@/lib/templates/validation";
import { assignConversationToAgent, logTeamActivity } from "@/lib/team/store";
import {
  CannedResponse,
  ConversationStatus,
  SupportedMediaType,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessageTemplate,
} from "@/types/database";
import {
  MessagingWindowStatus,
  sendWhatsAppMessageService,
} from "@/lib/whatsapp/service";
import {
  rateLimitOutboundMessages,
  rateLimitSensitiveAction,
} from "@/lib/rate-limit/rate-limiter";
import {
  AssignConversationAgentSchema,
  CreateCannedResponseSchema,
  DeleteCannedResponseSchema,
  GetMediaDownloadUrlSchema,
  InboxSendMessageInputSchema,
  RetryMediaMessageSchema,
  SendMediaMessageSchema,
  StartNewConversationSchema,
  UpdateCannedResponseSchema,
  UpdateConversationLabelsSchema,
  UpdateConversationStatusSchema,
  ValidatedSendMediaMessage,
} from "@/lib/validation/schemas";
import {
  createSignedMediaUrl,
  sanitizeFilename,
  storeMediaFile,
  validateMediaFile,
} from "@/lib/media/storage";

export async function updateConversationStatusAction(
  businessSlug: string,
  conversationId: string,
  status: ConversationStatus
) {
  const validated = UpdateConversationStatusSchema.parse({
    businessSlug,
    conversationId,
    status,
  });

  const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const rateLimit = rateLimitSensitiveAction(business.id, "update_conversation_status");
  if (!rateLimit.success) {
    throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`);
  }

  await updateConversationStatus(business.id, validated.conversationId, validated.status);

  // Log Team Activity for Human Takeover or Resolution
  if (validated.status === "pending_human") {
    await logTeamActivity(business.id, {
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      activity_type: "human_takeover",
      description: `Initiated human takeover for conversation`,
      metadata: { conversation_id: validated.conversationId },
    }).catch(() => {});
  } else if (validated.status === "closed") {
    await logTeamActivity(business.id, {
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      activity_type: "conversation_resolved",
      description: `Resolved conversation`,
      metadata: { conversation_id: validated.conversationId },
    }).catch(() => {});
  }

  revalidatePath(`/workspace/${businessSlug}/inbox`);
  revalidatePath(`/workspace/${businessSlug}/team`);
  return { success: true };
}

export async function resumeConversationAutomationAction(
  businessSlug: string,
  conversationId: string
) {
  const { business, membership, user } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const rateLimit = rateLimitSensitiveAction(business.id, "update_conversation_status");
  if (!rateLimit.success) {
    throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`);
  }

  await resumeConversationAutomation(business.id, conversationId);

  // Log Bot Resume
  await logTeamActivity(business.id, {
    actor_id: user.id,
    actor_name: user.full_name || user.email,
    activity_type: "bot_resumed",
    description: `Resumed WhatsApp automation bot for conversation`,
    metadata: { conversation_id: conversationId },
  }).catch(() => {});

  revalidatePath(`/workspace/${businessSlug}/inbox`);
  revalidatePath(`/workspace/${businessSlug}/team`);
  return { success: true };
}

export async function toggleConversationReadAction(
  businessSlug: string,
  conversationId: string,
  isRead: boolean
) {
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const rateLimit = rateLimitSensitiveAction(business.id, "toggle_conversation_read");
  if (!rateLimit.success) {
    throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`);
  }

  await toggleConversationRead(business.id, conversationId, isRead);
  revalidatePath(`/workspace/${businessSlug}/inbox`);
  return { success: true };
}

export async function assignConversationAgentAction(
  businessSlug: string,
  conversationId: string,
  agentId: string | null,
  agentName: string | null
) {
  const validated = AssignConversationAgentSchema.parse({
    businessSlug,
    conversationId,
    agentId,
    agentName,
  });

  const { business, membership, user } = await validateBusinessAccess(validated.businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const rateLimit = rateLimitSensitiveAction(business.id, "assign_agent");
  if (!rateLimit.success) {
    throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`);
  }

  // Update in inbox store and execute team database assignment logic
  await assignConversationAgent(business.id, validated.conversationId, validated.agentId, validated.agentName);
  await assignConversationToAgent(
    business.id,
    validated.conversationId,
    validated.agentId,
    validated.agentName,
    {
      id: user.id,
      name: user.full_name || user.email,
      role: membership.role,
    }
  );

  revalidatePath(`/workspace/${businessSlug}/inbox`);
  revalidatePath(`/workspace/${businessSlug}/team`);
  return { success: true };
}

export async function getConversationMessagesAction(
  businessSlug: string,
  conversationId: string,
  options?: {
    limit?: number;
    before?: string;
  }
): Promise<{ success: boolean; messages: WhatsAppMessage[]; hasMore: boolean }> {
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const result = await getConversationMessages(business.id, conversationId, options);
  return { success: true, ...result };
}

export interface SendWhatsAppMessageActionParams {
  businessSlug: string;
  conversationId: string;
  text?: string;
  template?: {
    name: string;
    languageCode?: string;
    components?: Array<Record<string, unknown>>;
  };
}

export interface SendWhatsAppMessageActionResult {
  success: boolean;
  message?: WhatsAppMessage;
  error?: string;
  isWindowClosed?: boolean;
}

/**
 * Send an interactive WhatsApp message (Text or Template)
 * Strictly verifies server authorization, business membership, conversation ownership,
 * and Meta 24-hour customer service window compliance.
 */
export async function sendWhatsAppMessageAction(
  params: SendWhatsAppMessageActionParams
): Promise<SendWhatsAppMessageActionResult> {
  const parseResult = InboxSendMessageInputSchema.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Invalid input parameters.",
    };
  }
  const { businessSlug, conversationId, text, template } = parseResult.data;

  // 1. Server Authorization & Business Membership Validation
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  // 2. Server-Side Outbound Rate Limiting
  const rateLimit = rateLimitOutboundMessages(business.id);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Rate limit exceeded: Outbound dispatch paused. Please wait ${rateLimit.retryAfterSeconds}s before retrying.`,
    };
  }

  // 3. Message Content Validation
  if (text !== undefined) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return {
        success: false,
        error: "Message text cannot be empty.",
      };
    }
    if (trimmed.length > 4096) {
      return {
        success: false,
        error: `Message exceeds maximum allowed character length of 4096 (current: ${trimmed.length}).`,
      };
    }
  } else if (!template) {
    return {
      success: false,
      error: "Message content or template is required.",
    };
  }

  // 3. Validate Conversation Ownership within Verified Business
  const conv = await getConversationByIdDb(business.id, conversationId);
  if (!conv) {
    return {
      success: false,
      error: "Conversation not found or cross-tenant access denied.",
    };
  }

  if (!conv.contact?.phone_number) {
    return {
      success: false,
      error: "Contact phone number not found for this conversation.",
    };
  }

  // 4. Meta Compliance: Enforce WhatsApp 24-hour customer service window for free-form text
  if (!template) {
    const windowStatus = await getConversationMessagingWindowDb(business.id, conversationId);
    if (!windowStatus.isOpen) {
      return {
        success: false,
        isWindowClosed: true,
        error:
          "WhatsApp 24-hour customer service window has expired. Free-form text messages cannot be sent. Please send an approved WhatsApp Template to re-open the conversation.",
      };
    }
  }

  // 5. Outgoing Message Pipeline: Send via WhatsApp Service
  const sendRes = await sendWhatsAppMessageService({
    businessId: business.id,
    connectionId: conv.connection_id,
    recipientPhone: conv.contact.phone_number,
    recipientName: conv.contact.display_name || undefined,
    conversationId: conv.id,
    text: text ? text.trim() : undefined,
    template,
    enforceWindow: true,
  });

  if (!sendRes.success) {
    return {
      success: false,
      error: sendRes.error || "Failed to deliver WhatsApp message via Meta Cloud API.",
      isWindowClosed: sendRes.isWindowClosed,
      message: sendRes.message,
    };
  }

  revalidatePath(`/workspace/${businessSlug}/inbox`);

  return {
    success: true,
    message: sendRes.message,
  };
}

/**
 * Retrieve WhatsApp 24-hour messaging window status for a conversation.
 */
export async function getConversationMessagingWindowAction(
  businessSlug: string,
  conversationId: string
): Promise<{ success: boolean; window: MessagingWindowStatus }> {
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const window = await getConversationMessagingWindowDb(business.id, conversationId);
  return { success: true, window };
}

/**
 * Retrieve approved WhatsApp templates for this business.
 */
export async function getApprovedTemplatesAction(
  businessSlug: string,
  connectionId?: string
): Promise<{ success: boolean; templates: WhatsAppMessageTemplate[] }> {
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  const templates = await getApprovedTemplatesDb(business.id, connectionId);
  return { success: true, templates };
}

/**
 * Phase 12.2: Send an outbound WhatsApp Media message (Image, Document, Audio, Video)
 * Strictly verifies server authorization, business membership, conversation ownership,
 * file-size limits, MIME validity, and Meta 24-hour customer service window compliance.
 */
export async function sendWhatsAppMediaMessageAction(
  params: ValidatedSendMediaMessage
): Promise<SendWhatsAppMessageActionResult> {
  const parseResult = SendMediaMessageSchema.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Invalid media parameters.",
    };
  }

  const {
    businessSlug,
    conversationId,
    mediaType,
    filename,
    mimeType,
    fileSize,
    base64Data,
    caption,
  } = parseResult.data;

  // 1. Server Authorization & Business Membership Validation
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership) {
    throw new Error("Unauthorized: Membership required.");
  }

  // Strictly block viewers from sending media messages
  if (!["owner", "admin", "agent"].includes(membership.role)) {
    return {
      success: false,
      error: "Read-only access: Viewers cannot send media messages.",
    };
  }

  // 2. Server-Side Outbound Rate Limiting
  const rateLimit = rateLimitOutboundMessages(business.id);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Rate limit exceeded: Outbound dispatch paused. Please wait ${rateLimit.retryAfterSeconds}s before retrying.`,
    };
  }

  // 3. Convert payload and validate file size & MIME
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return { success: false, error: "Invalid base64 payload encoding." };
  }

  const validation = validateMediaFile(mediaType, mimeType, buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error || "File validation failed." };
  }

  // 4. Validate Conversation Ownership within Verified Business
  const conv = await getConversationByIdDb(business.id, conversationId);
  if (!conv) {
    return {
      success: false,
      error: "Conversation not found or cross-tenant access denied.",
    };
  }

  if (!conv.contact?.phone_number) {
    return {
      success: false,
      error: "Contact phone number not found for this conversation.",
    };
  }

  // 5. Meta Compliance: Enforce WhatsApp 24-hour customer service window
  const windowStatus = await getConversationMessagingWindowDb(business.id, conversationId);
  if (!windowStatus.isOpen) {
    return {
      success: false,
      isWindowClosed: true,
      error:
        "WhatsApp 24-hour customer service window has expired. Free-form media messages cannot be sent. Please send an approved WhatsApp Template to re-open the conversation.",
    };
  }

  // 6. Secure Storage: Store media buffer in business-scoped private storage
  let stored: {
    fileId: string;
    storagePath: string;
    fileSize: number;
    sanitizedFilename: string;
    sha256: string;
  };

  try {
    stored = await storeMediaFile({
      businessId: business.id,
      conversationId: conv.id,
      fileBuffer: buffer,
      mimeType,
      originalFilename: filename,
      mediaType,
    });
  } catch (storeErr: any) {
    return {
      success: false,
      error: `Storage error: ${storeErr.message}`,
    };
  }

  // 7. Dispatch via WhatsApp Outbound Service
  const sendRes = await sendWhatsAppMessageService({
    businessId: business.id,
    connectionId: conv.connection_id,
    recipientPhone: conv.contact.phone_number,
    recipientName: conv.contact.display_name || undefined,
    conversationId: conv.id,
    media: {
      type: mediaType,
      filename: stored.sanitizedFilename,
      mimeType,
      fileSize: stored.fileSize,
      fileBuffer: buffer,
      storagePath: stored.storagePath,
      caption: caption?.trim() || undefined,
    },
    enforceWindow: true,
  });

  if (!sendRes.success) {
    return {
      success: false,
      error: sendRes.error || "Failed to deliver WhatsApp media message.",
      isWindowClosed: sendRes.isWindowClosed,
      message: sendRes.message,
    };
  }

  revalidatePath(`/workspace/${businessSlug}/inbox`);

  return {
    success: true,
    message: sendRes.message,
  };
}

/**
 * Phase 12.2: Generate Authorized Short-Lived Signed Download URL for a Media Message
 * Viewers, Agents, Admins, and Owners can view and download media within their business.
 * Cross-business access is strictly denied.
 */
export async function getMediaDownloadUrlAction(params: {
  businessSlug: string;
  messageId: string;
}): Promise<{
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  mimeType?: string;
  error?: string;
}> {
  const parseResult = GetMediaDownloadUrlSchema.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Invalid input parameters.",
    };
  }
  const { businessSlug, messageId } = parseResult.data;

  // Viewers and all business members are authorized to download media
  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership) {
    throw new Error("Unauthorized: Membership required.");
  }

  let supabase: any = null;
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  } catch {
    supabase = null;
  }

  let msg: WhatsAppMessage | null = null;
  if (supabase) {
    const { data, error } = await supabase
      .from("wa_messages")
      .select("*")
      .eq("id", messageId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!error && data) {
      msg = data;
    }
  }

  if (!msg) {
    return {
      success: false,
      error: "Media message not found or cross-tenant access denied.",
    };
  }

  if (!msg.storage_path) {
    if (msg.media_id || ["image", "document", "audio", "video"].includes(msg.message_type)) {
      try {
        const { retrieveAndPersistInboundMedia } = await import("@/lib/whatsapp/media-fetcher");
        const retrieval = await retrieveAndPersistInboundMedia(business.id, msg.id, {
          supabaseClient: supabase,
        });
        if (retrieval.success && retrieval.storagePath) {
          msg.storage_path = retrieval.storagePath;
          if (retrieval.sanitizedFilename) msg.file_name = retrieval.sanitizedFilename;
          if (retrieval.mimeType) msg.mime_type = retrieval.mimeType;
        }
      } catch (fetchErr: any) {
        console.warn("[On-Demand Media Fetch Warning]:", fetchErr?.message || fetchErr);
      }
    }
  }

  if (!msg.storage_path) {
    if (msg.media_url) {
      return {
        success: true,
        downloadUrl: msg.media_url,
        filename: msg.file_name || "download",
        mimeType: msg.mime_type || "application/octet-stream",
      };
    }
    return {
      success: false,
      error: "Media file is not currently stored or has expired.",
    };
  }

  try {
    const downloadUrl = await createSignedMediaUrl(business.id, msg.storage_path, 300);
    return {
      success: true,
      downloadUrl,
      filename: msg.file_name || "download",
      mimeType: msg.mime_type || "application/octet-stream",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to generate signed media URL.",
    };
  }
}

/**
 * Phase 12.2: Retry sending a failed outbound media or text message
 */
export async function retryFailedMediaMessageAction(params: {
  businessSlug: string;
  messageId: string;
}): Promise<{ success: boolean; message?: WhatsAppMessage; error?: string }> {
  const parseResult = RetryMediaMessageSchema.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Invalid input parameters.",
    };
  }
  const { businessSlug, messageId } = parseResult.data;

  const { business, membership } = await validateBusinessAccess(businessSlug);
  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }

  let supabase: any = null;
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  } catch {
    supabase = null;
  }

  if (!supabase) {
    return { success: false, error: "Database client unavailable." };
  }

  const { data: msg, error: msgError } = await supabase
    .from("wa_messages")
    .select("*, wa_conversations(connection_id, wa_contacts(phone_number, display_name))")
    .eq("id", messageId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (msgError || !msg) {
    return { success: false, error: "Failed message record not found." };
  }

  const phone = msg.wa_conversations?.wa_contacts?.phone_number;
  if (!phone) {
    return { success: false, error: "Recipient phone number not found." };
  }

  const sendRes = await sendWhatsAppMessageService({
    businessId: business.id,
    connectionId: msg.connection_id,
    recipientPhone: phone,
    conversationId: msg.conversation_id,
    media: msg.media_type
      ? {
          type: msg.media_type,
          filename: msg.file_name || "media",
          mimeType: msg.mime_type || "application/octet-stream",
          fileSize: msg.file_size || 0,
          storagePath: msg.storage_path,
          caption: msg.caption || undefined,
          metaMediaId: msg.media_id,
        }
      : undefined,
    text: !msg.media_type ? msg.content : undefined,
  });

  if (!sendRes.success) {
    return { success: false, error: sendRes.error || "Retry dispatch failed." };
  }

  revalidatePath(`/workspace/${businessSlug}/inbox`);
  return { success: true, message: sendRes.message };
}

/**
 * Fetch total unread conversation count for business workspace sidebar.
 */
export async function getInboxUnreadCountAction(businessSlug: string) {
  try {
    // 1. Strictly require authenticated user and active membership for the requested tenant
    const authContext = await validateBusinessAccess(businessSlug);
    if (!authContext?.membership || !authContext?.business) {
      return {
        success: false,
        unread: 0,
        error: "Unauthorized: Active business membership required.",
      };
    }

    const businessId = authContext.business.id;
    const userId = authContext.user.id;

    // 2. Fetch counts strictly scoped to the authenticated tenant and user context
    const counts = await getInboxCountsDb(businessId, { currentUserId: userId });
    return { success: true, unread: counts.unread };
  } catch (err: any) {
    return {
      success: false,
      unread: 0,
      error: err.message || "Unauthorized: Access denied.",
    };
  }
}

/**
 * Update conversation labels
 */
export async function updateConversationLabelsAction(input: {
  businessSlug: string;
  conversationId: string;
  labels: string[];
}): Promise<{
  success: boolean;
  labels?: string[];
  error?: string;
}> {
  try {
    const parsed = UpdateConversationLabelsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid labels payload.",
      };
    }

    const { businessSlug, conversationId, labels } = parsed.data;
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "update_conversation_labels");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const updatedLabels = await updateConversationLabels(
      business.id,
      conversationId,
      labels
    );

    revalidatePath(`/workspace/${businessSlug}/inbox`);
    return { success: true, labels: updatedLabels };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update conversation labels.",
    };
  }
}

/**
 * Start a new customer conversation from the inbox (with E.164 validation & approved template dispatch).
 */
export async function startNewConversationAction(input: {
  businessSlug: string;
  phoneNumber: string;
  displayName: string;
  category?: string | null;
  connectionId?: string;
  initialMessage?: string;
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
}): Promise<{
  success: boolean;
  conversationId?: string;
  conversation?: WhatsAppConversation | null;
  message?: WhatsAppMessage;
  isWindowClosed?: boolean;
  error?: string;
}> {
  try {
    const parsed = StartNewConversationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid start-chat input parameters.",
      };
    }

    const data = parsed.data;
    const { business, membership } = await validateBusinessAccess(data.businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return {
        success: false,
        error: "Permission denied: Viewers cannot initiate customer conversations.",
      };
    }

    const normalizedDigits = normalizePhoneNumber(data.phoneNumber);
    if (normalizedDigits.length < 7 || normalizedDigits.length > 15) {
      return {
        success: false,
        error: "Valid E.164 phone number with country code is required (7–15 digits, e.g. +919840012345).",
      };
    }

    const rateLimit = rateLimitOutboundMessages(business.id);
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before starting a new chat.`,
      };
    }

    // 1. Resolve WhatsApp connection within verified business
    const { isSupabaseConfigured } = await import("@/lib/supabase/client");
    const { getConnectionsForBusiness, getConnectionsForBusinessDb } = await import(
      "@/lib/connections/store"
    );
    const conns = isSupabaseConfigured()
      ? await getConnectionsForBusinessDb(business.id)
      : getConnectionsForBusiness(business.id);

    let resolvedConnectionId = data.connectionId?.trim() || "";
    if (resolvedConnectionId) {
      const targetConn = conns.find((c) => c.id === resolvedConnectionId);
      if (!targetConn) {
        return {
          success: false,
          error: "Selected WhatsApp line does not belong to this business workspace.",
        };
      }
      if (!targetConn.is_enabled) {
        return {
          success: false,
          error: `WhatsApp line "${targetConn.display_name}" is currently disabled.`,
        };
      }
    } else {
      const activeConn = conns.find((c) => c.is_enabled) || conns[0];
      if (!activeConn) {
        return {
          success: false,
          error: "No WhatsApp connection configured for this business. Please configure one first.",
        };
      }
      resolvedConnectionId = activeConn.id;
    }

    // 2. Find existing or create CRM contact using normalized phone digits
    let contact: any = null;
    if (isSupabaseConfigured()) {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const supabase = await createServerSupabaseClient();
      const { data: existing } = await supabase
        .from("wa_contacts")
        .select("*")
        .eq("business_id", business.id)
        .in("phone_number", [normalizedDigits, `+${normalizedDigits}`])
        .limit(1)
        .maybeSingle();

      if (existing) {
        contact = existing;
      }
    }

    if (!contact) {
      try {
        contact = await createContactDb(business.id, {
          display_name: data.displayName || normalizedDigits,
          phone_number: normalizedDigits,
          category: data.category || null,
          status: "lead",
          source: "manual",
        });
      } catch (contactErr: any) {
        if (isSupabaseConfigured()) {
          const { createServerSupabaseClient } = await import("@/lib/supabase/server");
          const supabase = await createServerSupabaseClient();
          const { data: existing } = await supabase
            .from("wa_contacts")
            .select("*")
            .eq("business_id", business.id)
            .eq("phone_number", normalizedDigits)
            .maybeSingle();
          if (existing) {
            contact = existing;
          } else {
            throw contactErr;
          }
        } else {
          const { getCrmContactsDb } = await import("@/lib/crm/database");
          const existingList = await getCrmContactsDb(business.id, {
            search: normalizedDigits,
            limit: 10,
          });
          const match = existingList.contacts.find(
            (c) => normalizePhoneNumber(c.phone_number) === normalizedDigits
          );
          if (match) {
            contact = match;
          } else {
            throw contactErr;
          }
        }
      }
    }

    // 3. Create or find conversation bound to the selected connection
    const { conversationId } = await getOrCreateConversationForContactDb(
      business.id,
      contact.id,
      { connectionId: resolvedConnectionId }
    );

    // 4. Resolve and dispatch Approved Template (or enforce 24h window for free-form text)
    let sendRes: Awaited<ReturnType<typeof sendWhatsAppMessageService>> | null = null;
    const requestedTemplateKey = data.templateName?.trim() || data.templateId?.trim();

    if (requestedTemplateKey) {
      const approvedList = await getApprovedTemplatesDb(business.id, resolvedConnectionId);
      const matchedTpl = approvedList.find(
        (t) =>
          t.id === requestedTemplateKey ||
          t.template_name.toLowerCase() === requestedTemplateKey.toLowerCase()
      );

      if (!matchedTpl) {
        return {
          success: false,
          error: `Approved WhatsApp template "${requestedTemplateKey}" was not found for this business/line.`,
        };
      }

      if (matchedTpl.status !== "APPROVED" || matchedTpl.is_archived) {
        return {
          success: false,
          error: `Template "${matchedTpl.template_name}" is not approved for outbound initiation.`,
        };
      }

      const varExtraction = extractTemplateVariables(matchedTpl.components);
      const vars = data.templateVariables || {};
      const missingVars = varExtraction.allVariables.filter((v) => !vars[v]?.trim());
      if (missingVars.length > 0) {
        return {
          success: false,
          error: `Missing required template variable(s): {{${missingVars.join("}}, {{")}}}`,
        };
      }

      const componentsPayload: Array<Record<string, unknown>> = [];
      if (varExtraction.headerVariables.length > 0) {
        componentsPayload.push({
          type: "header",
          parameters: varExtraction.headerVariables.map((v) => ({
            type: "text",
            text: (vars[v] || "").trim(),
          })),
        });
      }
      if (varExtraction.bodyVariables.length > 0) {
        componentsPayload.push({
          type: "body",
          parameters: varExtraction.bodyVariables.map((v) => ({
            type: "text",
            text: (vars[v] || "").trim(),
          })),
        });
      }

      sendRes = await sendWhatsAppMessageService({
        businessId: business.id,
        connectionId: resolvedConnectionId,
        recipientPhone: normalizedDigits,
        recipientName: contact.display_name || data.displayName,
        conversationId,
        template: {
          name: matchedTpl.template_name,
          languageCode: matchedTpl.language || data.templateLanguage || "en_US",
          components: componentsPayload.length > 0 ? componentsPayload : undefined,
        },
        enforceWindow: true,
      });
    } else if (data.initialMessage) {
      sendRes = await sendWhatsAppMessageService({
        businessId: business.id,
        connectionId: resolvedConnectionId,
        recipientPhone: normalizedDigits,
        recipientName: contact.display_name || data.displayName,
        conversationId,
        text: data.initialMessage,
        enforceWindow: true,
      });
    } else {
      return {
        success: false,
        error: "Please select an approved WhatsApp template to initiate this conversation.",
      };
    }

    const finalConversationId = sendRes?.conversationId || conversationId;
    let hydratedConv: WhatsAppConversation | null = null;
    try {
      hydratedConv = await getConversationByIdDb(business.id, finalConversationId);
    } catch {
      hydratedConv = null;
    }

    if (!hydratedConv && contact) {
      const selectedConn = conns.find((c) => c.id === resolvedConnectionId);
      const nowIso = new Date().toISOString();
      hydratedConv = {
        id: finalConversationId,
        business_id: business.id,
        connection_id: resolvedConnectionId,
        contact_id: contact.id,
        status: "open",
        last_message_preview: sendRes?.message?.content || null,
        last_message_at: sendRes?.message?.created_at || nowIso,
        unread_count: 0,
        labels: [],
        created_at: nowIso,
        updated_at: nowIso,
        contact,
        connection: selectedConn,
        last_message_direction: "outbound",
      };
    }

    revalidatePath(`/workspace/${data.businessSlug}/inbox`);
    revalidatePath(`/workspace/${data.businessSlug}/crm`);

    if (!sendRes.success) {
      return {
        success: false,
        conversationId: finalConversationId,
        conversation: hydratedConv,
        message: sendRes.message,
        isWindowClosed: sendRes.isWindowClosed,
        error: sendRes.error || "Failed to dispatch WhatsApp opening template.",
      };
    }

    return {
      success: true,
      conversationId: finalConversationId,
      conversation: hydratedConv,
      message: sendRes.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to start conversation.",
    };
  }
}

/**
 * List quick replies / canned responses for a business workspace.
 */
export async function listCannedResponsesAction(
  businessSlug: string
): Promise<{ success: boolean; responses: CannedResponse[]; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, responses: [], error: "Unauthorized: Membership required." };
    }

    const responses = await listCannedResponsesDb(business.id, {
      businessSlug: business.slug,
    });
    return { success: true, responses };
  } catch (err: any) {
    return {
      success: false,
      responses: [],
      error: err.message || "Failed to load quick replies.",
    };
  }
}

/**
 * Create a new quick reply / canned response snippet.
 */
export async function createCannedResponseAction(input: {
  businessSlug: string;
  shortcut: string;
  title: string;
  content: string;
  category?: string;
}): Promise<{ success: boolean; response?: CannedResponse; error?: string }> {
  try {
    const parsed = CreateCannedResponseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid quick reply fields.",
      };
    }

    const { business, membership, user } = await validateBusinessAccess(parsed.data.businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot create quick replies.",
      };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "manage_canned_responses");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const created = await createCannedResponseDb(business.id, {
      shortcut: parsed.data.shortcut,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      createdBy: user.id,
      businessSlug: business.slug,
    });

    revalidatePath(`/workspace/${parsed.data.businessSlug}/inbox`);
    return { success: true, response: created };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create quick reply.",
    };
  }
}

/**
 * Update an existing quick reply / canned response snippet.
 */
export async function updateCannedResponseAction(input: {
  businessSlug: string;
  responseId: string;
  shortcut?: string;
  title?: string;
  content?: string;
  category?: string;
}): Promise<{ success: boolean; response?: CannedResponse; error?: string }> {
  try {
    const parsed = UpdateCannedResponseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid quick reply update.",
      };
    }

    const { business, membership } = await validateBusinessAccess(parsed.data.businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot update quick replies.",
      };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "manage_canned_responses");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const updated = await updateCannedResponseDb(business.id, parsed.data.responseId, {
      shortcut: parsed.data.shortcut,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
    });

    revalidatePath(`/workspace/${parsed.data.businessSlug}/inbox`);
    return { success: true, response: updated };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update quick reply.",
    };
  }
}

/**
 * Delete a quick reply / canned response snippet.
 */
export async function deleteCannedResponseAction(input: {
  businessSlug: string;
  responseId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = DeleteCannedResponseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid delete request.",
      };
    }

    const { business, membership } = await validateBusinessAccess(parsed.data.businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return {
        success: false,
        error: "Unauthorized: Viewers cannot delete quick replies.",
      };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "manage_canned_responses");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    await deleteCannedResponseDb(business.id, parsed.data.responseId);
    revalidatePath(`/workspace/${parsed.data.businessSlug}/inbox`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete quick reply.",
    };
  }
}
