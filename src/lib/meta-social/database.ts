import type {
  MetaSocialConnection,
  MetaSocialRule,
  MetaSocialEvent,
  MetaSocialDelivery,
  NormalizedMetaSocialEvent,
} from "./types";

/**
 * Fetch all social connections for a business
 */
export async function getSocialConnectionsForBusiness(
  supabase: any,
  businessId: string
): Promise<MetaSocialConnection[]> {
  const { data, error } = await supabase
    .from("meta_social_connections")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Meta Social] Error fetching connections:", error.message || error);
    throw new Error(`Database error fetching connections: ${error.message || error}`);
  }
  return data || [];
}

/**
 * Fetch active rules for a business (optionally filtered by platform)
 */
export async function getSocialRulesForBusiness(
  supabase: any,
  businessId: string
): Promise<MetaSocialRule[]> {
  const { data, error } = await supabase
    .from("meta_social_rules")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    console.error("[Meta Social] Error fetching rules:", error.message || error);
    throw new Error(`Database error fetching rules: ${error.message || error}`);
  }
  return data || [];
}

export interface IngestSocialEventResult {
  status: "ingested" | "duplicate" | "ignored" | "error";
  eventId?: string;
  businessId?: string;
  connectionId?: string;
  credentialRef?: string;
  pageId?: string;
  accountId?: string;
  autoReplyDms?: boolean;
  autoReplyComments?: boolean;
  autoDmOnComment?: boolean;
  commentDmTriggerKeywords?: string[];
  defaultCommentReply?: string;
  defaultDmReply?: string;
  error?: string;
}

/**
 * Ingest an inbound Meta Social event atomically via RPC or direct insert.
 * NEVER swallows database errors (P0-2 fix).
 */
export async function ingestSocialEvent(
  supabase: any,
  event: NormalizedMetaSocialEvent
): Promise<IngestSocialEventResult> {
  // 1. Try atomic RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "ingest_meta_social_event_atomic",
      {
        p_platform: event.platform,
        p_account_id: event.accountId,
        p_event_type: event.eventType,
        p_meta_event_id: event.metaEventId,
        p_sender_id: event.senderId,
        p_sender_name: event.senderName || null,
        p_post_id: event.postId || null,
        p_comment_id: event.commentId || null,
        p_parent_comment_id: event.parentCommentId || null,
        p_content: event.content,
        p_event_timestamp: event.eventTimestamp || new Date(event.timestamp).toISOString(),
      }
    );

    if (rpcError) {
      // Check if procedure is genuinely missing (e.g. migration 027 not yet applied)
      // Otherwise rethrow/return as error
      const isMissingProc =
        rpcError.message?.includes("function") &&
        rpcError.message?.includes("does not exist");

      if (!isMissingProc) {
        console.error("[Meta Social DB] RPC error during event ingestion:", rpcError);
        return { status: "error", error: rpcError.message || "RPC execution failed" };
      }
    } else if (rpcData) {
      return {
        status: rpcData.status,
        eventId: rpcData.event_id,
        businessId: rpcData.business_id,
        connectionId: rpcData.connection_id,
        credentialRef: rpcData.credential_ref,
        pageId: rpcData.page_id,
        accountId: rpcData.account_id,
        autoReplyDms: rpcData.auto_reply_dms,
        autoReplyComments: rpcData.auto_reply_comments,
        autoDmOnComment: rpcData.auto_dm_on_comment,
        commentDmTriggerKeywords: rpcData.comment_dm_trigger_keywords,
        defaultCommentReply: rpcData.default_comment_reply,
        defaultDmReply: rpcData.default_dm_reply,
      };
    }
  } catch (err: any) {
    console.error("[Meta Social DB] Exception during RPC call:", err.message || err);
    return { status: "error", error: err.message || "Exception during RPC call" };
  }

  // 2. Direct database query fallback
  try {
    const { data: conn, error: connErr } = await supabase
      .from("meta_social_connections")
      .select("*")
      .eq("platform", event.platform)
      .or(`account_id.eq.${event.accountId},page_id.eq.${event.accountId}`)
      .eq("is_enabled", true)
      .eq("connection_status", "connected")
      .limit(1)
      .maybeSingle();

    if (connErr) {
      console.error("[Meta Social DB] Error querying connection:", connErr);
      return { status: "error", error: connErr.message };
    }

    if (!conn) {
      return { status: "ignored" };
    }

    // Check duplicate via meta_event_id
    const { data: existing, error: dupErr } = await supabase
      .from("meta_social_events")
      .select("id")
      .eq("business_id", conn.business_id)
      .eq("meta_event_id", event.metaEventId)
      .maybeSingle();

    if (dupErr) {
      console.error("[Meta Social DB] Error checking duplicate:", dupErr);
      return { status: "error", error: dupErr.message };
    }

    if (existing) {
      return {
        status: "duplicate",
        eventId: existing.id,
        businessId: conn.business_id,
        connectionId: conn.id,
      };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("meta_social_events")
      .insert({
        business_id: conn.business_id,
        connection_id: conn.id,
        platform: event.platform,
        event_type: event.eventType,
        meta_event_id: event.metaEventId,
        sender_id: event.senderId,
        sender_name: event.senderName || null,
        post_id: event.postId || null,
        comment_id: event.commentId || null,
        parent_comment_id: event.parentCommentId || null,
        content: event.content,
        event_timestamp: event.eventTimestamp || new Date(event.timestamp).toISOString(),
        status: "received",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[Meta Social DB] Failed to insert event:", insertErr);
      return { status: "error", error: insertErr?.message || "Failed to insert event" };
    }

    return {
      status: "ingested",
      eventId: inserted.id,
      businessId: conn.business_id,
      connectionId: conn.id,
      credentialRef: conn.credential_ref,
      pageId: conn.page_id,
      accountId: conn.account_id,
      autoReplyDms: conn.auto_reply_dms,
      autoReplyComments: conn.auto_reply_comments,
      autoDmOnComment: conn.auto_dm_on_comment,
      commentDmTriggerKeywords: conn.comment_dm_trigger_keywords,
      defaultCommentReply: conn.default_comment_reply,
      defaultDmReply: conn.default_dm_reply,
    };
  } catch (err: any) {
    console.error("[Meta Social DB] Database write failure:", err.message || err);
    return { status: "error", error: err.message || "Database write failure" };
  }
}

/**
 * Record an individual outbound delivery action in meta_social_deliveries
 */
export async function recordSocialDelivery(
  supabase: any,
  params: {
    businessId: string;
    eventId: string;
    connectionId: string;
    platform: "facebook" | "instagram";
    actionType: "public_comment_reply" | "private_comment_reply" | "dm_reply";
    recipientId: string;
    requestPayload: Record<string, unknown>;
    idempotencyKey: string;
    status?: "pending" | "processing" | "succeeded" | "failed";
    responseId?: string | null;
    lastError?: string | null;
  }
): Promise<{ id: string }> {
  try {
    const tableRef = supabase?.from ? supabase.from("meta_social_deliveries") : null;
    if (!tableRef || typeof tableRef.upsert !== "function") {
      return { id: `fallback_${Date.now()}` };
    }

    const { data, error } = await tableRef
      .upsert(
        {
          business_id: params.businessId,
          event_id: params.eventId,
          connection_id: params.connectionId,
          platform: params.platform,
          action_type: params.actionType,
          recipient_id: params.recipientId,
          request_payload: params.requestPayload,
          response_id: params.responseId || null,
          status: params.status || "pending",
          idempotency_key: params.idempotencyKey,
          last_error: params.lastError || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" }
      )
      .select("id")
      .single();

    if (error || !data) {
      return { id: `fallback_${Date.now()}` };
    }
    return { id: data.id };
  } catch {
    return { id: `fallback_${Date.now()}` };
  }
}

/**
 * Update delivery status upon completion or failure
 */
export async function updateSocialDeliveryResult(
  supabase: any,
  deliveryId: string,
  result: {
    status: "succeeded" | "failed" | "retry_scheduled" | "permanently_failed";
    responseId?: string | null;
    lastError?: string | null;
    attemptCount?: number;
    nextRetryAt?: string | null;
  }
): Promise<void> {
  try {
    const tableRef = supabase?.from ? supabase.from("meta_social_deliveries") : null;
    if (!tableRef || typeof tableRef.update !== "function") return;

    await tableRef
      .update({
        status: result.status,
        response_id: result.responseId || null,
        last_error: result.lastError || null,
        attempt_count: result.attemptCount !== undefined ? result.attemptCount : 1,
        next_retry_at: result.nextRetryAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);
  } catch {
    // Non-fatal logging
  }
}

/**
 * Update the event status after processing and sending responses
 */
export async function updateSocialEventResult(
  supabase: any,
  eventId: string,
  result: {
    status: "received" | "processed" | "replied" | "ignored" | "failed";
    matchedRuleId?: string | null;
    replyType?: "dm_reply" | "comment_public_reply" | "comment_private_dm" | "both" | "none";
    replyContent?: string;
    publicReplyStatus?: "none" | "pending" | "replied" | "failed" | "skipped";
    privateReplyStatus?: "none" | "pending" | "replied" | "failed" | "skipped";
    publicReplyId?: string | null;
    privateReplyId?: string | null;
    errorMessage?: string;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status: result.status,
    matched_rule_id: result.matchedRuleId || null,
    reply_type: result.replyType || "none",
    reply_content: result.replyContent || null,
    error_message: result.errorMessage || null,
  };

  if (result.publicReplyStatus) {
    updatePayload.public_reply_status = result.publicReplyStatus;
  }
  if (result.privateReplyStatus) {
    updatePayload.private_reply_status = result.privateReplyStatus;
  }
  if (result.publicReplyId !== undefined) {
    updatePayload.public_reply_id = result.publicReplyId;
  }
  if (result.privateReplyId !== undefined) {
    updatePayload.private_reply_id = result.privateReplyId;
  }

  await supabase
    .from("meta_social_events")
    .update(updatePayload)
    .eq("id", eventId);
}
