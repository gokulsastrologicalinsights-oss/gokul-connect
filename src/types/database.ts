export type BusinessSlug = 'astrology' | 'vivaham';

export interface Business {
  id: string;
  name: string;
  slug: BusinessSlug;
  description: string;
  icon_name: string;
  accent_color: 'purple' | 'rose' | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    connectionStatus: 'connected' | 'disconnected' | 'setup_required' | 'testing';
    connectedNumbersCount: number;
    unreadEnquiriesCount: number;
    pendingRepliesCount: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
}

export type BusinessRole = 'owner' | 'admin' | 'agent' | 'viewer';

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessRole;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  business?: Business;
  user_profile?: UserProfile;
}

export interface BusinessWorkspaceContext {
  business: Business;
  membership: BusinessMember;
  user: UserProfile;
}

// ==========================================
// PHASE 2: WHATSAPP CONNECTION DEFINITIONS
// ==========================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'setup_required' | 'error';
export type WebhookStatus = 'active' | 'pending' | 'unconfigured' | 'error';
export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export interface WhatsAppConnection {
  id: string;
  business_id: string;
  display_name: string;
  phone_number: string;
  phone_number_id: string;
  waba_id: string;
  credential_ref: string; // Server-side vault identifier; NEVER plain-text token
  connection_status: ConnectionStatus;
  webhook_status: WebhookStatus;
  is_enabled: boolean;
  description?: string;
  quality_rating?: QualityRating;
  last_connected_at: string | null;
  last_checked_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// Client-safe connection representation (strictly guarantees no secrets leaked)
export type SafeWhatsAppConnection = Omit<WhatsAppConnection, 'credential_ref'> & {
  has_credential: boolean;
  credential_masked_hint: string;
};

// Phase 2 Input for adding a WhatsApp number
export interface CreateWhatsAppConnectionInput {
  display_name: string;
  phone_number: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string; // Captured securely on creation, stored in server vault
  description?: string;
}

export interface UpdateWhatsAppConnectionInput {
  display_name?: string;
  phone_number?: string;
  description?: string;
  is_enabled?: boolean;
  access_token?: string; // Optional: Rotate or replace expired access token
}

// ==========================================
// PHASE 2: BUSINESS SETTINGS DEFINITIONS
// ==========================================

export interface BusinessSettings {
  id: string;
  business_id: string;
  display_name: string;
  business_info: string;
  logo_placeholder: string;
  timezone: string;
  default_language: string;
  notification_preferences: {
    connection_drops: boolean;
    unread_alerts: boolean;
    daily_digest: boolean;
  };
  whatsapp_preferences: {
    default_connection_id?: string;
    webhook_retry_policy: 'standard' | 'aggressive' | 'relaxed';
    opt_out_keywords: string;
  };
  created_at: string;
  updated_at: string;
}

export type UpdateBusinessSettingsInput = Partial<
  Omit<BusinessSettings, "whatsapp_preferences" | "notification_preferences">
> & {
  whatsapp_preferences?: Partial<BusinessSettings["whatsapp_preferences"]>;
  notification_preferences?: Partial<BusinessSettings["notification_preferences"]>;
};

// ==========================================
// PHASE 3: WHATSAPP CLOUD API & MESSAGING
// ==========================================

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'interactive' | 'reaction';
export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MediaDownloadStatus = 'not_applicable' | 'pending' | 'downloaded' | 'failed';
export type SupportedMediaType = 'image' | 'document' | 'audio' | 'video';
export type ConversationStatus = 'open' | 'closed' | 'archived' | 'pending_human';
export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type TemplateStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'
  | 'DRAFT'
  | 'ARCHIVED';

export type TemplateComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type TemplateHeaderFormat = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
export type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface TemplateButton {
  type: TemplateButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateComponent {
  type: TemplateComponentType;
  format?: TemplateHeaderFormat;
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

export type ContactStatus = 'lead' | 'active' | 'inactive' | 'customer';

export type ContactSource =
  | 'whatsapp'
  | 'website'
  | 'referral'
  | 'walk_in'
  | 'csv_import'
  | 'manual'
  | 'other';

export interface WhatsAppContact {
  id: string;
  business_id: string;
  phone_number: string;
  display_name: string | null;
  profile_photo_url: string | null;
  email?: string | null;
  status?: ContactStatus;
  category?: string | null;
  source?: ContactSource;
  is_archived?: boolean;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_opted_out?: boolean;
  opted_out_at?: string | null;
  opted_out_reason?: string | null;
  is_blocked?: boolean;
  consent_status?: 'opted_in' | 'implicit' | 'opted_out' | 'none';
  consent_source?: string | null;
  consented_at?: string | null;
  consent_withdrawn_at?: string | null;
  last_eligibility_evaluation_at?: string | null;
  last_welcome_sent_at?: string | null;
  last_inbound_at?: string | null;
  total_inbound_count?: number;
  lifecycle_stage_id?: string | null;
  lifecycle_stage_slug?: string | null;
  next_follow_up_at?: string | null;
  last_interaction_at?: string | null;
  created_at: string;
  updated_at: string;
  notes?: ContactNote[];
  activity_logs?: ContactActivityLog[];
  conversation?: WhatsAppConversation | null;
  follow_ups?: CrmFollowUp[];
  lifecycle_history?: ContactLifecycleHistory[];
  campaign_history?: WhatsAppCampaignRecipient[];
}

export interface WhatsAppConversation {
  id: string;
  business_id: string;
  connection_id: string;
  contact_id: string;
  status: ConversationStatus;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_automation_paused?: boolean;
  automation_paused_until?: string | null;
  automation_paused_by?: string | null;
  bot_reply_count_window?: number;
  last_bot_reply_at?: string | null;
  created_at: string;
  updated_at: string;
  contact?: WhatsAppContact;
  connection?: SafeWhatsAppConnection;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  labels?: string[];
  last_message_direction?: MessageDirection;
  last_message_status?: MessageDeliveryStatus;
}

export type InboxFolder =
  | 'all'
  | 'unread'
  | 'unassigned'
  | 'assigned_to_me'
  | 'open'
  | 'pending'
  | 'resolved'
  | 'archived';

export interface InboxCounts {
  all: number;
  unread: number;
  unassigned: number;
  assigned_to_me: number;
  open: number;
  pending: number;
  resolved: number;
  archived: number;
}

export interface WhatsAppMessage {
  id: string;
  business_id: string;
  connection_id: string;
  conversation_id: string;
  contact_id: string;
  direction: MessageDirection;
  message_type: MessageType;
  content: string;
  meta_message_id: string | null;
  status: MessageDeliveryStatus;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Phase 12.2 Media attributes
  media_type?: SupportedMediaType | null;
  media_id?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  caption?: string | null;
  storage_path?: string | null;
  media_url?: string | null;
  download_status?: MediaDownloadStatus | null;
  downloaded_at?: string | null;
  uploaded_at?: string | null;
  media_error?: string | null;
}

export interface WhatsAppMediaFile {
  id: string;
  business_id: string;
  conversation_id: string | null;
  message_id: string | null;
  media_type: SupportedMediaType;
  meta_media_id: string | null;
  mime_type: string;
  original_filename: string;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  sha256?: string | null;
  caption?: string | null;
  direction: MessageDirection;
  download_status: MediaDownloadStatus;
  error_message?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessageTemplate {
  id: string;
  business_id: string;
  connection_id: string | null;
  template_name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: TemplateComponent[] | Array<Record<string, unknown>>;
  meta_template_id?: string | null;
  rejection_reason?: string | null;
  is_archived?: boolean;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppWebhookEvent {
  id: string;
  business_id: string | null;
  connection_id: string | null;
  phone_number_id: string;
  meta_event_id: string | null;
  event_type: 'message' | 'status' | 'error' | 'other';
  payload: Record<string, unknown>;
  is_processed: boolean;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
}

export interface WhatsAppProcessingJob {
  id: string;
  business_id: string;
  connection_id: string | null;
  job_type:
    | 'send_message'
    | 'send_outbound_message'
    | 'evaluate_rules'
    | 'evaluate_automation_rules'
    | 'scheduled_followup'
    | 'process_webhook'
    | 'process_webhook_event'
    | 'update_status'
    | 'download_inbound_media'
    | 'process_campaign';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_at: string | null;
  locked_by?: string | null;
  idempotency_key?: string | null;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// PHASE 5: RULE-BASED AUTOMATION ENGINE
// ==========================================

export type AutomationTriggerType =
  | 'inbound_message'
  | 'first_inbound_message'
  | 'keyword_match'
  | 'outside_business_hours'
  | 'inside_business_hours'
  | 'customer_enquiry'
  | 'opt_out'
  | 'opt_in'
  | 'human_requested';

export type RuleConditionType =
  | 'keyword_exact'
  | 'keyword_contains'
  | 'keyword_starts_with'
  | 'keyword_regex'
  | 'business_hours'
  | 'outside_hours'
  | 'conversation_status'
  | 'contact_opt_in'
  | 'first_time_contact';

export type RuleConditionOperator =
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'regex'
  | 'is_true'
  | 'is_false'
  | 'in_list';

export type RuleActionType =
  | 'send_text_message'
  | 'send_template_message'
  | 'send_interactive_buttons'
  | 'send_interactive_list'
  | 'assign_agent'
  | 'update_conversation_status'
  | 'apply_contact_label'
  | 'set_opt_status'
  | 'schedule_follow_up';

export interface AutomationRule {
  id: string;
  business_id: string;
  connection_id: string | null;
  name: string;
  description: string | null;
  trigger_type: AutomationTriggerType;
  priority: number;
  stop_processing_on_match: boolean;
  cooldown_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}

export interface RuleCondition {
  id: string;
  business_id: string;
  rule_id: string;
  condition_group: number;
  condition_type: RuleConditionType;
  operator: RuleConditionOperator;
  match_value: {
    keywords?: string[];
    text?: string;
    case_sensitive?: boolean;
    status?: string;
    [key: string]: unknown;
  };
  order_index: number;
  created_at: string;
}

export interface RuleAction {
  id: string;
  business_id: string;
  rule_id: string;
  action_type: RuleActionType;
  action_payload: {
    message_text?: string;
    template_name?: string;
    template_language?: string;
    template_components?: unknown[];
    buttons?: Array<{ id: string; title: string }>;
    status?: string;
    label?: string;
    delay_seconds?: number;
    opt_status?: boolean;
    [key: string]: unknown;
  };
  delay_seconds: number;
  order_index: number;
  created_at: string;
}

export interface AutomationExecutionLog {
  id: string;
  business_id: string;
  rule_id: string | null;
  connection_id: string;
  conversation_id: string;
  contact_id: string;
  inbound_message_id: string | null;
  outbound_message_id: string | null;
  trigger_matched: string;
  conditions_snapshot: unknown[];
  actions_executed: unknown[];
  status: 'success' | 'skipped' | 'failed' | 'delayed';
  skip_reason: string | null;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface BusinessHoursScheduleDay {
  is_open: boolean;
  open_time: string; // "09:00"
  close_time: string; // "18:00"
}

export interface BusinessHoursConfig {
  enabled?: boolean;
  timezone: string;
  weekly_schedule: {
    monday: BusinessHoursScheduleDay;
    tuesday: BusinessHoursScheduleDay;
    wednesday: BusinessHoursScheduleDay;
    thursday: BusinessHoursScheduleDay;
    friday: BusinessHoursScheduleDay;
    saturday: BusinessHoursScheduleDay;
    sunday: BusinessHoursScheduleDay;
  };
  holiday_dates?: string[];
}

export interface AutomationSettingsConfig {
  is_automation_enabled: boolean;
  opt_out_keywords: string[];
  opt_in_keywords: string[];
  human_handover_keywords: string[];
  max_bot_replies_per_hour: number;
  circuit_breaker_max_replies_15m: number;
}

// Meta WhatsApp Cloud API Types
export interface MetaSendTextMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface MetaSendTemplateMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<Record<string, unknown>>;
  };
}

export interface MetaSendResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: string;
  }>;
}

export interface MetaPhoneNumberDetails {
  id: string;
  verified_name?: string;
  display_phone_number?: string;
  quality_rating?: QualityRating;
  code_verification_status?: string;
}

// ==========================================
// PHASE 9: CRM & CONTACT MANAGEMENT
// ==========================================

export interface CrmCategory {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  color: string;
  description?: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmSegment {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  filters: {
    status?: ContactStatus[];
    category?: string[];
    source?: ContactSource[];
    tags?: string[];
    is_opted_out?: boolean;
    search?: string;
    has_notes?: boolean;
    date_from?: string;
    date_to?: string;
    lifecycle_stage?: string[];
    assigned_agent_id?: string[];
    has_overdue_followups?: boolean;
    has_upcoming_followups?: boolean;
    last_interaction_days?: number;
    consent_status?: string[];
    created_date_from?: string;
    created_date_to?: string;
    [key: string]: unknown;
  };
  is_system: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactNote {
  id: string;
  business_id: string;
  contact_id: string;
  author_id?: string | null;
  author_name: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export type ContactActivityType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'category_changed'
  | 'lifecycle_stage_changed'
  | 'follow_up_created'
  | 'follow_up_completed'
  | 'follow_up_rescheduled'
  | 'follow_up_cancelled'
  | 'tag_added'
  | 'tag_removed'
  | 'note_added'
  | 'archived'
  | 'unarchived'
  | 'inbound_message'
  | 'outbound_message'
  | 'opt_out'
  | 'opt_in'
  | 'imported';

export interface ContactActivityLog {
  id: string;
  business_id: string;
  contact_id: string;
  activity_type: ContactActivityType;
  title: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
}

export interface CrmMetrics {
  totalContacts: number;
  leads: number;
  activeCustomers: number;
  inactive: number;
  optedOut: number;
  newThisMonth: number;
}

export interface CrmContactFilter {
  search?: string;
  status?: ContactStatus | 'all';
  category?: string | 'all';
  source?: ContactSource | 'all';
  tag?: string | 'all';
  is_opted_out?: boolean;
  is_archived?: boolean;
  lifecycle_stage?: string | 'all';
  assigned_agent_id?: string | 'all';
  has_overdue_followups?: boolean;
  has_upcoming_followups?: boolean;
  last_interaction_days?: number;
  page?: number;
  limit?: number;
}

export interface CsvContactImportRow {
  name: string;
  phone: string;
  email?: string;
  category?: string;
  status?: ContactStatus;
  source?: ContactSource;
  tags?: string[];
  notes?: string;
}

export interface CsvImportValidationResult {
  totalRows: number;
  validRows: CsvContactImportRow[];
  duplicateCount: number;
  invalidCount: number;
  errors: Array<{ row: number; phone?: string; error: string }>;
}

// ==========================================
// PHASE 12.1: TEAM MANAGEMENT & AGENT ASSIGNMENT
// ==========================================

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface BusinessInvitation {
  id: string;
  business_id: string;
  email: string;
  role: BusinessRole;
  status: InvitationStatus;
  invited_by: string | null;
  invited_by_name?: string | null;
  token?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  delivery_status?: 'sent' | 'failed' | 'not_configured' | 'pending';
  delivery_error?: string;
}

export type TeamActivityType =
  | 'member_invited'
  | 'role_changed'
  | 'member_activated'
  | 'member_deactivated'
  | 'member_removed'
  | 'conversation_assigned'
  | 'conversation_reassigned'
  | 'human_takeover'
  | 'bot_resumed'
  | 'conversation_resolved'
  | 'scheduled_message_created'
  | 'scheduled_message_edited'
  | 'scheduled_message_rescheduled'
  | 'scheduled_message_cancelled'
  | 'scheduled_message_dispatched'
  | 'scheduled_message_failed'
  | 'scheduled_message_retried';

export interface TeamActivityLog {
  id: string;
  business_id: string;
  actor_id: string | null;
  actor_name: string | null;
  activity_type: TeamActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ConversationAssignmentLog {
  id: string;
  business_id: string;
  conversation_id: string;
  assigned_by: string | null;
  assigned_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  previous_assigned_to?: string | null;
  previous_assigned_to_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface TeamMemberWithProfile extends BusinessMember {
  user_profile: UserProfile;
  assignedConversationsCount?: number;
  unreadCount?: number;
}

export interface AgentWorkload {
  userId: string;
  userName: string;
  email: string;
  role: BusinessRole;
  isActive: boolean;
  activeConversationsCount: number;
  unreadCount: number;
  pendingHumanCount: number;
  resolvedCount: number;
  lastActiveAt?: string | null;
}

export interface TeamFilterOptions {
  search?: string;
  role?: BusinessRole | 'all';
  status?: 'active' | 'inactive' | 'all';
}

// ==========================================
// PHASE 12.3: SCHEDULED MESSAGES & SCHEDULING
// ==========================================

export type ScheduledMessageStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export type ScheduledMessageType =
  | 'text'
  | 'template'
  | 'image'
  | 'document'
  | 'audio'
  | 'video';

export interface WhatsAppScheduledMessage {
  id: string;
  business_id: string;
  connection_id: string;
  conversation_id: string | null;
  recipient_phone: string;
  recipient_name: string | null;
  message_type: ScheduledMessageType;
  content: string | null;
  template_name: string | null;
  template_language: string;
  template_variables: Record<string, string>;
  media_type: SupportedMediaType | null;
  media_storage_path: string | null;
  media_filename: string | null;
  media_file_size: number | null;
  media_mime_type: string | null;
  media_caption: string | null;
  media_meta_id: string | null;
  scheduled_at: string;
  timezone: string;
  status: ScheduledMessageStatus;
  locked_at: string | null;
  locked_by: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  message_id: string | null;
  meta_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  connection?: SafeWhatsAppConnection | null;
  conversation?: WhatsAppConversation | null;
}

export interface ScheduledMessageFilters {
  tab?: 'upcoming' | 'past' | 'all';
  status?: ScheduledMessageStatus | 'all';
  messageType?: ScheduledMessageType | 'all';
  connectionId?: string | 'all';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ScheduledMessagesSummaryStats {
  upcomingCount: number;
  sentCount: number;
  failedCount: number;
  cancelledCount: number;
  draftCount: number;
  totalCount: number;
}

// ==========================================
// PHASE 12.4: CAMPAIGN MANAGEMENT & BULK MESSAGING
// ==========================================

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'preparing'
  | 'queued'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type CampaignMessageType =
  | 'template'
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video';

export type CampaignAudienceType =
  | 'all_contacts'
  | 'segment'
  | 'category'
  | 'manual';

export type CampaignRecipientStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type CampaignRecipientEligibility = 'eligible' | 'excluded';

export interface CampaignAudienceFilters {
  segment_id?: string | null;
  category_slug?: string | null;
  included_contact_ids?: string[];
  excluded_contact_ids?: string[];
  search_query?: string;
  tags?: string[];
}

export interface WhatsAppCampaign {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  message_type: CampaignMessageType;
  template_id: string | null;
  template_name: string | null;
  template_language: string;
  template_variables: Record<string, string>;
  message_content: string | null;
  media_type: SupportedMediaType | null;
  media_storage_path: string | null;
  media_filename: string | null;
  media_file_size: number | null;
  media_mime_type: string | null;
  media_caption: string | null;
  media_meta_id: string | null;
  connection_id: string;
  scheduled_at: string | null;
  timezone: string;
  status: CampaignStatus;
  audience_type: CampaignAudienceType;
  audience_filters: CampaignAudienceFilters;
  audience_count: number;
  eligible_count: number;
  excluded_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  batch_size: number;
  dispatch_interval_ms: number;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  paused_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  connection?: SafeWhatsAppConnection | null;
}

export interface WhatsAppCampaignRecipient {
  id: string;
  business_id: string;
  campaign_id: string;
  contact_id: string | null;
  phone_number: string;
  recipient_name: string | null;
  eligibility_status: CampaignRecipientEligibility;
  exclusion_reason: string | null;
  status: CampaignRecipientStatus;
  message_id: string | null;
  meta_message_id: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignSummaryStats {
  totalCampaigns: number;
  activeCampaigns: number;
  scheduledCampaigns: number;
  completedCampaigns: number;
  draftCampaigns: number;
  totalAudience: number;
  totalEligible: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

export interface CampaignFilterOptions {
  status?: CampaignStatus | 'all';
  messageType?: CampaignMessageType | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CampaignAudiencePreviewResult {
  totalCount: number;
  eligibleCount: number;
  excludedCount: number;
  exclusionsBreakdown: Record<string, number>;
  sampleEligible: Array<{ id: string; name: string | null; phone: string; category?: string | null }>;
  sampleExcluded: Array<{ id: string; name: string | null; phone: string; reason: string }>;
}

// ==========================================
// PHASE 12.5: ADVANCED CRM LIFECYCLE & FOLLOW-UPS
// ==========================================

export interface CrmLifecycleStage {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description?: string | null;
  color: string;
  sort_order: number;
  is_default: boolean;
  is_converted: boolean;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactLifecycleHistory {
  id: string;
  business_id: string;
  contact_id: string;
  from_stage_id?: string | null;
  from_stage_slug?: string | null;
  from_stage?: string | null;
  to_stage_id?: string;
  to_stage_slug?: string;
  to_stage?: string;
  changed_by?: string | null;
  changed_by_name?: string | null;
  change_reason?: string | null;
  created_at: string;
}

export type FollowUpPriority = 'low' | 'normal' | 'high' | 'urgent';

export type FollowUpStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface CrmFollowUp {
  id: string;
  business_id: string;
  contact_id: string;
  conversation_id?: string | null;
  title: string;
  description?: string | null;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  due_at: string;
  timezone?: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  completed_by_name?: string | null;
  completion_notes?: string | null;
  rescheduled_at?: string | null;
  rescheduled_count?: number;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancelled_by_name?: string | null;
  cancellation_reason?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  contact?: WhatsAppContact | null;
  conversation?: WhatsAppConversation | null;
}

export type FollowUpReminderType =
  | 'due_today'
  | 'due_soon'
  | 'overdue'
  | 'assigned'
  | 'reassigned'
  | 'completed'
  | 'team_invitation'
  | 'team_member_joined'
  | 'system'
  | 'escalation';

export type NotificationCategory = 'crm_follow_up' | 'team' | 'system';

export type NotificationProcessingStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dismissed';

export interface CrmFollowUpReminder {
  id: string;
  business_id: string;
  follow_up_id?: string | null;
  user_id: string;
  reminder_type: FollowUpReminderType;
  category?: NotificationCategory;
  title?: string;
  message?: string;
  action_url?: string | null;
  metadata?: Record<string, any>;
  is_read: boolean;
  read_at?: string | null;
  is_dismissed?: boolean;
  dismissed_at?: string | null;
  dedup_key?: string | null;
  status?: NotificationProcessingStatus;
  locked_at?: string | null;
  locked_by?: string | null;
  retry_count?: number;
  max_retries?: number;
  last_error?: string | null;
  created_at: string;
  follow_up?: CrmFollowUp | null;
}

export interface UserNotificationPreferences {
  id: string;
  business_id: string;
  user_id: string;
  in_app_enabled: boolean;
  notify_due_today: boolean;
  notify_due_soon: boolean;
  notify_overdue: boolean;
  notify_assigned: boolean;
  notify_team_events: boolean;
  notify_system: boolean;
  lead_time_hours: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationFilterOptions {
  tab?: 'all' | 'unread' | 'crm' | 'team' | 'system';
  isRead?: boolean;
  category?: NotificationCategory;
  reminderType?: FollowUpReminderType;
  includeDismissed?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  total: number;
  unreadCount: number;
  dueTodayCount: number;
  overdueCount: number;
  assignedCount: number;
}

export interface FollowUpFilterOptions {
  tab?: 'today' | 'upcoming' | 'overdue' | 'completed' | 'assigned_to_me' | 'all';
  status?: FollowUpStatus | 'all';
  priority?: FollowUpPriority | 'all';
  contactId?: string;
  assignedTo?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface FollowUpMetrics {
  total: number;
  totalFollowUps?: number;
  openFollowUps?: number;
  todayCount: number;
  dueTodayFollowUps?: number;
  upcomingCount?: number;
  overdueCount: number;
  overdueFollowUps?: number;
  completedCount: number;
  completedFollowUps?: number;
  completionRate: number;
}

export interface CrmLifecycleReport {
  contactsByStage: Array<{
    stage: string;
    slug: string;
    name: string;
    count: number;
    color: string;
    stageName?: string;
    stageSlug?: string;
    percentage?: number;
  }>;
  totalContacts: number;
  leadsOverTime: Array<{ period: string; count: number }>;
  newLeadsOverTime?: Array<{ date: string; count: number }>;
  conversionRate: number;
  leadToConversionRate?: number;
  convertedCount: number;
  lostCount: number;
  conversionByCategory: Array<{
    category: string;
    total: number;
    converted: number;
    rate: number;
    convertedCount?: number;
    totalCount?: number;
  }>;
  followUpMetrics: FollowUpMetrics;
  followUpCompletionRate?: number;
  overdueFollowUpCount?: number;
  agentWorkload: Array<{
    agentId: string;
    agentName: string;
    openCount: number;
    overdueCount: number;
    completedCount: number;
  }>;
  teamWorkload?: Array<{
    userId: string;
    userName: string;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
  }>;
  inactiveContactsCount: number;
}





