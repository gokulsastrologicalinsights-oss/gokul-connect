export type MetaSocialPlatform = 'facebook' | 'instagram';
export type MetaSocialEventType = 'message' | 'comment' | 'mention';
export type MetaSocialRulePlatform = 'facebook' | 'instagram' | 'both';
export type MetaSocialRuleTarget = 'message' | 'comment' | 'both';
export type MetaSocialMatchType = 'exact' | 'contains' | 'starts_with' | 'any';
export type MetaSocialResponseAction =
  | 'reply_dm'
  | 'reply_comment_public'
  | 'reply_comment_private_dm'
  | 'both_public_and_private';

export interface MetaSocialConnection {
  id: string;
  business_id: string;
  platform: MetaSocialPlatform;
  account_id: string;
  account_name: string;
  username?: string | null;
  page_id?: string | null;
  credential_ref: string;
  connection_status: 'connected' | 'disconnected' | 'expired' | 'error';
  is_enabled: boolean;
  auto_reply_dms: boolean;
  auto_reply_comments: boolean;
  auto_dm_on_comment: boolean;
  comment_dm_trigger_keywords: string[];
  default_comment_reply: string;
  default_dm_reply?: string | null;
  token_expires_at?: string | null;
  last_webhook_at?: string | null;
  last_reply_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MetaSocialRule {
  id: string;
  business_id: string;
  connection_id?: string | null;
  platform: MetaSocialRulePlatform;
  target_type: MetaSocialRuleTarget;
  rule_name: string;
  description?: string | null;
  keywords: string[];
  match_type: MetaSocialMatchType;
  response_action: MetaSocialResponseAction;
  predefined_reply: string;
  predefined_dm?: string | null;
  priority: number;
  is_active: boolean;
  stop_processing_on_match: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaSocialEvent {
  id: string;
  business_id: string;
  connection_id: string;
  platform: MetaSocialPlatform;
  event_type: MetaSocialEventType;
  meta_event_id: string;
  sender_id: string;
  sender_name?: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  parent_comment_id?: string | null;
  content: string;
  status: 'received' | 'processed' | 'replied' | 'failed' | 'ignored';
  matched_rule_id?: string | null;
  reply_type?: 'dm_reply' | 'comment_public_reply' | 'comment_private_dm' | 'both' | 'none' | null;
  reply_content?: string | null;
  public_reply_status?: 'none' | 'pending' | 'replied' | 'failed' | 'skipped' | null;
  private_reply_status?: 'none' | 'pending' | 'replied' | 'failed' | 'skipped' | null;
  public_reply_id?: string | null;
  private_reply_id?: string | null;
  error_message?: string | null;
  event_timestamp?: string | null;
  created_at: string;
}

export type MetaSocialDeliveryActionType =
  | 'public_comment_reply'
  | 'private_comment_reply'
  | 'dm_reply';

export type MetaSocialDeliveryStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'retry_scheduled'
  | 'permanently_failed';

export interface MetaSocialDelivery {
  id: string;
  business_id: string;
  event_id: string;
  connection_id: string;
  platform: MetaSocialPlatform;
  action_type: MetaSocialDeliveryActionType;
  recipient_id: string;
  request_payload: Record<string, unknown>;
  response_id?: string | null;
  status: MetaSocialDeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  last_error?: string | null;
  idempotency_key: string;
  next_retry_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Normalized internal event parsed from raw Meta Webhook
 */
export interface NormalizedMetaSocialEvent {
  platform: MetaSocialPlatform;
  accountId: string;          // Page ID or Instagram Business Account ID
  eventType: MetaSocialEventType;
  metaEventId: string;        // mid or comment_id
  senderId: string;           // PSID or IGSID
  senderName?: string;
  postId?: string;
  commentId?: string;
  parentCommentId?: string;
  content: string;            // Text of message or comment
  timestamp: number;
  eventTimestamp?: string;    // ISO timestamp from Meta event
}
