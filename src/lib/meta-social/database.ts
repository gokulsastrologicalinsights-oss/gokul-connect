import type {
  MetaSocialConnection,
  MetaSocialRule,
  MetaSocialEvent,
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
    console.error("[Meta Social] Error fetching connections:", error);
    return [];
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
    console.error("[Meta Social] Error fetching rules:", error);
    return [];
  }
  return data || [];
}

/**
 * Ingest an inbound Meta Social event atomically via RPC or direct insert
 */
export async function ingestSocialEvent(
  supabase: any,
  event: NormalizedMetaSocialEvent
): Promise<{
  status: "ingested" | "duplicate" | "ignored";
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
}> {
  // Try atomic RPC first
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
    }
  );

  if (!rpcError && rpcData) {
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
    };
  }

  // Fallback: Direct database query if RPC is pending migration
  const { data: conn } = await supabase
    .from("meta_social_connections")
    .select("*")
    .eq("platform", event.platform)
    .or(`account_id.eq.${event.accountId},page_id.eq.${event.accountId}`)
    .eq("is_enabled", true)
    .limit(1)
    .single();

  if (!conn) {
    return { status: "ignored" };
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from("meta_social_events")
    .select("id")
    .eq("business_id", conn.business_id)
    .eq("meta_event_id", event.metaEventId)
    .single();

  if (existing) {
    return { status: "duplicate", businessId: conn.business_id, connectionId: conn.id };
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
      status: "received",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { status: "ignored" };
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
  };
}

/**
 * Update the event status after processing and sending responses
 */
export async function updateSocialEventResult(
  supabase: any,
  eventId: string,
  result: {
    status: "replied" | "ignored" | "failed";
    matchedRuleId?: string | null;
    replyType?: "dm_reply" | "comment_public_reply" | "comment_private_dm" | "both" | "none";
    replyContent?: string;
    errorMessage?: string;
  }
): Promise<void> {
  await supabase
    .from("meta_social_events")
    .update({
      status: result.status,
      matched_rule_id: result.matchedRuleId || null,
      reply_type: result.replyType || "none",
      reply_content: result.replyContent || null,
      error_message: result.errorMessage || null,
    })
    .eq("id", eventId);
}
