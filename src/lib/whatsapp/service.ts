import { decryptSecret } from "@/lib/crypto/encryption";
import { getDefaultBusinessTemplates } from "@/lib/templates/default-templates";
import {
  MetaSendResponse,
  SupportedMediaType,
  WhatsAppContact,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/types/database";
import {
  sendMetaMediaMessage,
  sendMetaTemplateMessage,
  sendMetaTextMessage,
  uploadMetaMedia,
} from "./client";

export interface SendMediaInput {
  type: SupportedMediaType;
  filename: string;
  mimeType: string;
  fileSize: number;
  fileBuffer?: Buffer | Uint8Array;
  storagePath?: string;
  caption?: string;
  metaMediaId?: string;
}

export interface SendMessageOptions {
  businessId: string;
  connectionId: string;
  recipientPhone: string;
  recipientName?: string;
  conversationId?: string;
  text?: string;
  template?: {
    name: string;
    languageCode?: string;
    components?: Array<Record<string, unknown>>;
  };
  media?: SendMediaInput;
  supabaseClient?: any;
  enforceWindow?: boolean;
}

export interface SendMessageResult {
  success: boolean;
  messageId: string;
  metaMessageId?: string;
  conversationId: string;
  contactId: string;
  status: "sent" | "failed";
  message?: WhatsAppMessage;
  error?: string;
  isWindowClosed?: boolean;
}

export interface MessagingWindowStatus {
  isOpen: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number;
}

/**
 * Classify whether an error is transient/retryable (rate limits, network timeout)
 * or permanent (invalid credentials, expired window, undeliverable recipient).
 */
export function isRetryableMetaError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = error.code || error.status;

  // Rate limits
  if (code === 130429 || code === 80007 || code === 429) return true;
  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("130429")) return true;

  // Network / timeout errors
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("network error") ||
    msg.includes("fetch failed")
  ) {
    return true;
  }

  // 5xx server errors
  if (code === 502 || code === 503 || code === 504) return true;

  return false;
}

/**
 * Calculate the WhatsApp 24-hour customer service window status
 * from a list of conversation messages.
 */
export function checkMessagingWindow(
  messages: Array<{ direction: string; created_at: string }>
): MessagingWindowStatus {
  const inboundMessages = messages.filter((m) => m.direction === "inbound");
  if (inboundMessages.length === 0) {
    return {
      isOpen: false,
      lastInboundAt: null,
      expiresAt: null,
      remainingSeconds: 0,
    };
  }

  const sorted = [...inboundMessages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const latestInbound = sorted[0];
  const lastInboundTime = new Date(latestInbound.created_at).getTime();
  const now = Date.now();
  const elapsedMs = now - lastInboundTime;
  const windowDurationMs = 24 * 60 * 60 * 1000; // 24 hours

  const isOpen = elapsedMs >= 0 && elapsedMs < windowDurationMs;
  const remainingMs = isOpen ? windowDurationMs - elapsedMs : 0;
  const expiresAt = new Date(lastInboundTime + windowDurationMs).toISOString();

  return {
    isOpen,
    lastInboundAt: latestInbound.created_at,
    expiresAt,
    remainingSeconds: Math.floor(remainingMs / 1000),
  };
}

/**
 * Retrieve the decrypted access token and verified phone number ID for a connection.
 * Strictly verifies that the connection belongs to the given business_id.
 */
export async function getDecryptedConnectionCredentials(
  businessId: string,
  connectionId: string,
  client?: any
): Promise<{ phoneNumberId: string; accessToken: string; displayName: string }> {
  let supabase = client;
  if (!supabase) {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  }

  const { data: conn, error: connError } = await supabase
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number_id, is_enabled, wa_credentials(*)")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();

  if (connError || !conn) {
    throw new Error("Connection not found or cross-tenant access denied.");
  }

  if (!conn.is_enabled) {
    throw new Error(`WhatsApp connection "${conn.display_name}" is currently disabled.`);
  }

  const credRow = Array.isArray(conn.wa_credentials) ? conn.wa_credentials[0] : conn.wa_credentials;

  // If credentials exist in the vault, decrypt them
  if (credRow && credRow.ciphertext && credRow.iv && credRow.auth_tag) {
    const token = decryptSecret({
      key_version: credRow.key_version,
      iv: credRow.iv,
      auth_tag: credRow.auth_tag,
      ciphertext: credRow.ciphertext,
    });
    return {
      phoneNumberId: conn.phone_number_id,
      accessToken: token,
      displayName: conn.display_name,
    };
  }

  // Fallback for Phase 3 test sandbox if connection matches test Phone Number ID
  const testPhoneId = process.env.META_TEST_PHONE_NUMBER_ID;
  const testToken = process.env.META_TEST_ACCESS_TOKEN;
  if (testPhoneId && testToken && conn.phone_number_id === testPhoneId) {
    return {
      phoneNumberId: testPhoneId,
      accessToken: testToken,
      displayName: conn.display_name,
    };
  }

  throw new Error("Missing or corrupted credentials in vault for this connection.");
}

/**
 * Send an Outbound WhatsApp Message with Full Tenant Isolation and Supabase Persistence
 */
export async function sendWhatsAppMessageService(
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const { businessId, connectionId, recipientPhone, recipientName, text, template, media, supabaseClient } = options;

  if (!businessId?.trim()) throw new Error("businessId is required.");
  if (!connectionId?.trim()) throw new Error("connectionId is required.");
  if (!recipientPhone?.trim()) throw new Error("recipientPhone is required.");
  if (!text && !template && !media) throw new Error("Either text, template, or media is required to send a message.");

  let supabase = supabaseClient;
  if (!supabase) {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  }

  // 1. Verify tenant access and decrypt connection credentials
  const { phoneNumberId, accessToken } = await getDecryptedConnectionCredentials(
    businessId,
    connectionId,
    supabase
  );

  const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");

  // 2. Upsert Contact in wa_contacts (tenant isolated)
  const { data: contact, error: contactError } = await supabase
    .from("wa_contacts")
    .upsert(
      {
        business_id: businessId,
        phone_number: cleanPhone,
        display_name: recipientName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id, phone_number" }
    )
    .select()
    .single();

  if (contactError || !contact) {
    throw new Error(`Failed to resolve contact: ${contactError?.message}`);
  }

  // 3. Upsert Conversation thread in wa_conversations
  let preview = text || "";
  if (template) {
    preview = `[Template: ${template.name}]`;
  } else if (media) {
    if (media.type === "image") {
      preview = media.caption ? `📷 ${media.caption}` : "📷 Photo";
    } else if (media.type === "document") {
      preview = media.caption ? `📄 ${media.caption}` : `📄 ${media.filename}`;
    } else if (media.type === "audio") {
      preview = "🎤 Audio message";
    } else if (media.type === "video") {
      preview = media.caption ? `🎥 ${media.caption}` : "🎥 Video";
    }
  }
  const now = new Date().toISOString();

  const { data: conversation, error: convError } = await supabase
    .from("wa_conversations")
    .upsert(
      {
        business_id: businessId,
        connection_id: connectionId,
        contact_id: contact.id,
        status: "open",
        last_message_preview: preview.slice(0, 200),
        last_message_at: now,
        updated_at: now,
      },
      { onConflict: "connection_id, contact_id" }
    )
    .select()
    .single();

  if (convError || !conversation) {
    throw new Error(`Failed to resolve conversation: ${convError?.message}`);
  }

  // 3b. Validate 24-hour customer service window if enforceWindow is active and sending free-form text
  if (options.enforceWindow && !template) {
    const { data: lastInbound, error: inboundErr } = await supabase
      .from("wa_messages")
      .select("created_at")
      .eq("business_id", businessId)
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let isWindowOpen = false;
    if (lastInbound && lastInbound.created_at) {
      const inboundTime = new Date(lastInbound.created_at).getTime();
      const elapsed = Date.now() - inboundTime;
      isWindowOpen = elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;
    }

    if (!isWindowOpen) {
      return {
        success: false,
        messageId: "",
        conversationId: conversation.id,
        contactId: contact.id,
        status: "failed",
        isWindowClosed: true,
        error:
          "WhatsApp 24-hour customer service window has expired. Free-form text messages cannot be sent. You must send an approved WhatsApp Template to initiate or re-engage this customer.",
      };
    }
  }

  // 3c. SEC-LOW-01: Defense-in-depth template validation
  if (template) {
    const rawTemplateName = template.name?.trim().toLowerCase();
    if (!rawTemplateName) {
      return {
        success: false,
        messageId: "",
        conversationId: conversation.id,
        contactId: contact.id,
        status: "failed",
        error: "Template name is required for template dispatch.",
      };
    }

    let templateRecord: any = null;
    try {
      const { data: dbTpl } = await supabase
        .from("wa_message_templates")
        .select("id, business_id, connection_id, template_name, status, is_archived")
        .eq("business_id", businessId)
        .eq("template_name", rawTemplateName)
        .maybeSingle();
      templateRecord = dbTpl;
    } catch {
      // Offline DB or in-memory fallback
    }

    if (!templateRecord) {
      const defaults = getDefaultBusinessTemplates(businessId);
      templateRecord = defaults.find((t) => t.template_name.toLowerCase() === rawTemplateName) || null;
    }

    if (!templateRecord) {
      return {
        success: false,
        messageId: "",
        conversationId: conversation.id,
        contactId: contact.id,
        status: "failed",
        error: `Template "${template.name}" not found for this business workspace. Outbound dispatch rejected.`,
      };
    }

    // Verify connection scope: if template has a specific connection bound, it must match active connection
    if (templateRecord.connection_id && templateRecord.connection_id !== connectionId) {
      return {
        success: false,
        messageId: "",
        conversationId: conversation.id,
        contactId: contact.id,
        status: "failed",
        error: `Template "${template.name}" is bound to connection "${templateRecord.connection_id}", cannot be dispatched over "${connectionId}".`,
      };
    }

    // Verify template status is APPROVED
    if (templateRecord.status !== "APPROVED") {
      return {
        success: false,
        messageId: "",
        conversationId: conversation.id,
        contactId: contact.id,
        status: "failed",
        error: `Template "${template.name}" cannot be dispatched because its status is "${templateRecord.status}". Only APPROVED templates can be dispatched.`,
      };
    }

    // Verify template is not archived
    if (templateRecord.is_archived) {
      return {
        success: false,
        messageId: "",
        conversationId: conversation.id,
        contactId: contact.id,
        status: "failed",
        error: `Template "${template.name}" is archived. Archived templates cannot be dispatched.`,
      };
    }
  }

  // 4. Insert Pending Message Record in wa_messages
  const messageType = template ? "template" : media ? media.type : "text";
  const { data: messageRecord, error: msgError } = await supabase
    .from("wa_messages")
    .insert({
      business_id: businessId,
      connection_id: connectionId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      direction: "outbound",
      message_type: messageType,
      content: preview,
      status: "pending",
      media_type: media ? media.type : null,
      media_id: media?.metaMediaId || null,
      mime_type: media?.mimeType || null,
      file_name: media?.filename || null,
      file_size: media?.fileSize || null,
      caption: media?.caption || null,
      storage_path: media?.storagePath || null,
      download_status: "not_applicable",
      uploaded_at: media ? new Date().toISOString() : null,
      raw_payload: template ? { template } : media ? { media } : { text },
    })
    .select()
    .single();

  if (msgError || !messageRecord) {
    throw new Error(`Failed to initialize message record: ${msgError?.message}`);
  }

  // 5. Dispatch via Meta WhatsApp Cloud API
  try {
    let metaResponse: MetaSendResponse;

    if (template) {
      metaResponse = await sendMetaTemplateMessage(
        phoneNumberId,
        accessToken,
        cleanPhone,
        template.name,
        template.languageCode || "en_US",
        template.components
      );
    } else if (media) {
      let mediaIdToSend = media.metaMediaId;
      if (!mediaIdToSend && media.fileBuffer) {
        try {
          const uploadRes = await uploadMetaMedia(
            phoneNumberId,
            accessToken,
            media.fileBuffer,
            media.mimeType,
            media.filename
          );
          mediaIdToSend = uploadRes.id;
        } catch (uploadErr: any) {
          console.warn("[Media Upload] Meta upload skipped/fallback:", uploadErr.message);
          mediaIdToSend = `media_${Date.now()}`;
        }
      }

      metaResponse = await sendMetaMediaMessage(
        phoneNumberId,
        accessToken,
        cleanPhone,
        media.type,
        mediaIdToSend || `media_${Date.now()}`,
        {
          caption: media.caption,
          filename: media.filename,
        }
      );
    } else {
      metaResponse = await sendMetaTextMessage(
        phoneNumberId,
        accessToken,
        cleanPhone,
        text!
      );
    }

    const metaMessageId = metaResponse.messages?.[0]?.id || null;
    const sentAt = new Date().toISOString();

    // 6. Update message record as sent
    await supabase
      .from("wa_messages")
      .update({
        meta_message_id: metaMessageId,
        status: "sent",
        sent_at: sentAt,
        ...(media ? { media_id: media.metaMediaId || (metaResponse.messages?.[0] as any)?.media_id } : {}),
      })
      .eq("id", messageRecord.id);

    // Update connection last_message_at timestamp
    await supabase
      .from("wa_connections")
      .update({ last_message_at: sentAt })
      .eq("id", connectionId);

    const sentMessage: WhatsAppMessage = {
      ...messageRecord,
      meta_message_id: metaMessageId,
      status: "sent",
      sent_at: sentAt,
    };

    return {
      success: true,
      messageId: messageRecord.id,
      metaMessageId: metaMessageId || undefined,
      conversationId: conversation.id,
      contactId: contact.id,
      status: "sent",
      message: sentMessage,
    };
  } catch (apiError: any) {
    const errorMsg = apiError.message || "Meta API call failed";
    const errorCode = apiError.code ? String(apiError.code) : null;
    const retryable = isRetryableMetaError(apiError);

    // If retryable (rate limit, network timeout), schedule outbox job with backoff
    if (retryable) {
      try {
        await supabase.from("wa_processing_jobs").insert({
          business_id: businessId,
          connection_id: connectionId,
          job_type: "send_message",
          payload: {
            messageId: messageRecord.id,
            recipientPhone: cleanPhone,
            recipientName,
            text,
            template,
          },
          status: "pending",
          attempts: 1,
          max_attempts: 5,
          last_error: errorMsg,
          scheduled_at: new Date(Date.now() + 60 * 1000).toISOString(),
        });
      } catch (jobErr) {
        console.error("[Outbox Job Enqueue Error]:", jobErr);
      }
    }

    // Update message record as failed (permanent or awaiting retry)
    await supabase
      .from("wa_messages")
      .update({
        status: "failed",
        error_code: errorCode,
        error_message: errorMsg,
      })
      .eq("id", messageRecord.id);

    const failedMessage: WhatsAppMessage = {
      ...messageRecord,
      status: "failed",
      error_code: errorCode,
      error_message: errorMsg,
    };

    return {
      success: false,
      messageId: messageRecord.id,
      conversationId: conversation.id,
      contactId: contact.id,
      status: "failed",
      error: errorMsg,
      message: failedMessage,
    };
  }
}

/**
 * Convenient helper to send a WhatsApp text message.
 * Supports both object options and positional arguments.
 */
export async function sendWhatsAppTextMessage(
  connectionIdOrOptions: string | SendMessageOptions,
  recipientPhone?: string,
  text?: string,
  businessId?: string,
  client?: any
): Promise<SendMessageResult> {
  if (typeof connectionIdOrOptions === "object") {
    return sendWhatsAppMessageService(connectionIdOrOptions);
  }
  return sendWhatsAppMessageService({
    connectionId: connectionIdOrOptions,
    recipientPhone: recipientPhone!,
    text: text!,
    businessId: businessId!,
    supabaseClient: client,
  });
}

/**
 * Convenient helper to send a pre-approved WhatsApp template message.
 * Supports both object options and positional arguments.
 */
export async function sendWhatsAppTemplateMessage(
  connectionIdOrOptions: string | SendMessageOptions,
  recipientPhone?: string,
  templateName?: string,
  languageCode: string = "en",
  components: Array<Record<string, unknown>> = [],
  businessId?: string,
  client?: any
): Promise<SendMessageResult> {
  if (typeof connectionIdOrOptions === "object") {
    return sendWhatsAppMessageService(connectionIdOrOptions);
  }
  return sendWhatsAppMessageService({
    connectionId: connectionIdOrOptions,
    recipientPhone: recipientPhone!,
    template: {
      name: templateName!,
      languageCode,
      components,
    },
    businessId: businessId!,
    supabaseClient: client,
  });
}

/**
 * Retrieve recent messages for a business workspace (RLS protected)
 */
export async function getRecentMessagesForBusiness(
  businessId: string,
  limit = 20,
  client?: any
): Promise<WhatsAppMessage[]> {
  let supabase = client;
  if (!supabase) {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  }

  const { data, error } = await supabase
    .from("wa_messages")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieve active conversations for a business workspace (RLS protected)
 */
export async function getConversationsForBusiness(
  businessId: string,
  limit = 20,
  client?: any
): Promise<WhatsAppConversation[]> {
  let supabase = client;
  if (!supabase) {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  }

  const { data, error } = await supabase
    .from("wa_conversations")
    .select("*, wa_contacts(*)")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieve contacts for a business workspace (RLS protected)
 */
export async function getContactsForBusiness(
  businessId: string,
  limit = 50,
  client?: any
): Promise<WhatsAppContact[]> {
  let supabase = client;
  if (!supabase) {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    supabase = await createServerSupabaseClient();
  }

  const { data, error } = await supabase
    .from("wa_contacts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  return data || [];
}


