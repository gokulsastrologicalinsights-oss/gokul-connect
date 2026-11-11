import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  ScheduledMessageFilters,
  ScheduledMessagesSummaryStats,
  ScheduledMessageStatus,
  ScheduledMessageType,
  SupportedMediaType,
  WhatsAppScheduledMessage,
} from "@/types/database";

export const ASTRO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
export const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

export interface CreateScheduledMessageDbInput {
  connection_id: string;
  recipient_phone: string;
  recipient_name?: string | null;
  conversation_id?: string | null;
  message_type: ScheduledMessageType;
  content?: string | null;
  template_name?: string | null;
  template_language?: string;
  template_variables?: Record<string, string>;
  media_type?: SupportedMediaType | null;
  media_storage_path?: string | null;
  media_filename?: string | null;
  media_file_size?: number | null;
  media_mime_type?: string | null;
  media_caption?: string | null;
  media_meta_id?: string | null;
  scheduled_at: string;
  timezone?: string;
  status?: ScheduledMessageStatus;
}

export interface UpdateScheduledMessageDbInput {
  scheduled_at?: string;
  content?: string | null;
  template_variables?: Record<string, string>;
  media_caption?: string | null;
  status?: ScheduledMessageStatus;
}

/**
 * Validates tenant identity to enforce strict RLS and business boundary
 */
export function validateTenant(businessId: string): void {
  if (!businessId || typeof businessId !== "string" || !businessId.trim()) {
    throw new Error("Tenant isolation violation: businessId is strictly required.");
  }
}

// ==============================================================================
// IN-MEMORY SEED & FALLBACK STORE (ISOLATED PER BUSINESS)
// ==============================================================================

const INITIAL_SCHEDULED_MESSAGES: WhatsAppScheduledMessage[] = [
  // Astrology Scheduled Messages
  {
    id: "sched-astro-01",
    business_id: ASTRO_BUSINESS_ID,
    connection_id: "conn-astro-01",
    conversation_id: "conv-astro-01",
    recipient_phone: "+919840123456",
    recipient_name: "Karthik Subramanian",
    message_type: "text",
    content: "Vanakkam Karthik, your detailed horoscope reading appointment is scheduled for tomorrow at 10:30 AM IST.",
    template_name: null,
    template_language: "en_US",
    template_variables: {},
    media_type: null,
    media_storage_path: null,
    media_filename: null,
    media_file_size: null,
    media_mime_type: null,
    media_caption: null,
    media_meta_id: null,
    scheduled_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    timezone: "Asia/Kolkata",
    status: "scheduled",
    locked_at: null,
    locked_by: null,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    message_id: null,
    meta_message_id: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    cancelled_at: null,
    cancelled_by: null,
    created_by: "user-astro-admin-01",
    updated_by: "user-astro-admin-01",
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: "sched-astro-02",
    business_id: ASTRO_BUSINESS_ID,
    connection_id: "conn-astro-01",
    conversation_id: "conv-astro-02",
    recipient_phone: "+919876543210",
    recipient_name: "Priya Sundaram",
    message_type: "template",
    content: null,
    template_name: "consultation_reminder",
    template_language: "en_US",
    template_variables: { "1": "Priya", "2": "Tomorrow 3:00 PM" },
    media_type: null,
    media_storage_path: null,
    media_filename: null,
    media_file_size: null,
    media_mime_type: null,
    media_caption: null,
    media_meta_id: null,
    scheduled_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    timezone: "Asia/Kolkata",
    status: "scheduled",
    locked_at: null,
    locked_by: null,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    message_id: null,
    meta_message_id: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    cancelled_at: null,
    cancelled_by: null,
    created_by: "user-astro-agent-01",
    updated_by: "user-astro-agent-01",
    created_at: new Date(Date.now() - 7200 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
  {
    id: "sched-astro-03",
    business_id: ASTRO_BUSINESS_ID,
    connection_id: "conn-astro-01",
    conversation_id: "conv-astro-03",
    recipient_phone: "+919123456789",
    recipient_name: "Ramesh Kannan",
    message_type: "text",
    content: "Thank you for your consultation today. May the planetary alignment bring you peace and prosperity.",
    template_name: null,
    template_language: "en_US",
    template_variables: {},
    media_type: null,
    media_storage_path: null,
    media_filename: null,
    media_file_size: null,
    media_mime_type: null,
    media_caption: null,
    media_meta_id: null,
    scheduled_at: new Date(Date.now() - 86400 * 1000).toISOString(),
    timezone: "Asia/Kolkata",
    status: "sent",
    locked_at: null,
    locked_by: null,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    message_id: "msg-astro-hist-01",
    meta_message_id: "wamid.HBgLMDAx",
    sent_at: new Date(Date.now() - 86400 * 1000).toISOString(),
    delivered_at: new Date(Date.now() - 86390 * 1000).toISOString(),
    read_at: new Date(Date.now() - 86000 * 1000).toISOString(),
    cancelled_at: null,
    cancelled_by: null,
    created_by: "user-astro-admin-01",
    updated_by: "user-astro-admin-01",
    created_at: new Date(Date.now() - 90000 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 86000 * 1000).toISOString(),
  },

  // Vivaham Scheduled Messages
  {
    id: "sched-vivaham-01",
    business_id: VIVAHAM_BUSINESS_ID,
    connection_id: "conn-vivaham-01",
    conversation_id: "conv-vivaham-01",
    recipient_phone: "+919444123456",
    recipient_name: "Anand Rajan",
    message_type: "text",
    content: "Vanakkam Anand, we have found 3 verified prospective matrimonial matches matching your profile criteria.",
    template_name: null,
    template_language: "en_US",
    template_variables: {},
    media_type: null,
    media_storage_path: null,
    media_filename: null,
    media_file_size: null,
    media_mime_type: null,
    media_caption: null,
    media_meta_id: null,
    scheduled_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    timezone: "Asia/Kolkata",
    status: "scheduled",
    locked_at: null,
    locked_by: null,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    message_id: null,
    meta_message_id: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    cancelled_at: null,
    cancelled_by: null,
    created_by: "user-vivaham-admin-01",
    updated_by: "user-vivaham-admin-01",
    created_at: new Date(Date.now() - 1800 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
  {
    id: "sched-vivaham-02",
    business_id: VIVAHAM_BUSINESS_ID,
    connection_id: "conn-vivaham-01",
    conversation_id: "conv-vivaham-02",
    recipient_phone: "+919555123456",
    recipient_name: "Deepa Natarajan",
    message_type: "template",
    content: null,
    template_name: "welcome_inquiry",
    template_language: "en_US",
    template_variables: { "1": "Deepa" },
    media_type: null,
    media_storage_path: null,
    media_filename: null,
    media_file_size: null,
    media_mime_type: null,
    media_caption: null,
    media_meta_id: null,
    scheduled_at: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
    timezone: "Asia/Kolkata",
    status: "scheduled",
    locked_at: null,
    locked_by: null,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    message_id: null,
    meta_message_id: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    cancelled_at: null,
    cancelled_by: null,
    created_by: "user-vivaham-agent-01",
    updated_by: "user-vivaham-agent-01",
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];

let inMemoryScheduledMessages: WhatsAppScheduledMessage[] = JSON.parse(
  JSON.stringify(INITIAL_SCHEDULED_MESSAGES)
);

export function resetScheduledMemoryStore(): void {
  inMemoryScheduledMessages = JSON.parse(JSON.stringify(INITIAL_SCHEDULED_MESSAGES));
}

export function seedScheduledMemoryStore(messages: WhatsAppScheduledMessage[]): void {
  inMemoryScheduledMessages = [...messages];
}

export function getInMemoryScheduledMessages(): WhatsAppScheduledMessage[] {
  return inMemoryScheduledMessages;
}

// ==============================================================================
// DATABASE READ & WRITE METHODS (DUAL-MODE: SUPABASE OR LOCAL IN-MEMORY)
// ==============================================================================

/**
 * List scheduled messages for a business tenant with optional filters
 */
export async function listScheduledMessagesDb(
  businessId: string,
  filters: ScheduledMessageFilters = {},
  client?: any
): Promise<WhatsAppScheduledMessage[]> {
  validateTenant(businessId);

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      let query = supabase
        .from("wa_scheduled_messages")
        .select(`
          *,
          connection:wa_connections (
            id, display_name, phone_number, phone_number_id, waba_id, connection_status, is_enabled
          )
        `)
        .eq("business_id", businessId);

      // Tab filter: upcoming vs past
      const nowIso = new Date().toISOString();
      if (filters.tab === "upcoming") {
        query = query
          .in("status", ["scheduled", "draft", "processing"])
          .gte("scheduled_at", nowIso);
      } else if (filters.tab === "past") {
        query = query.or(`status.in.(sent,delivered,read,failed,cancelled),scheduled_at.lt.${nowIso}`);
      }

      // Status filter
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      // Message type filter
      if (filters.messageType && filters.messageType !== "all") {
        query = query.eq("message_type", filters.messageType);
      }

      // Connection filter
      if (filters.connectionId && filters.connectionId !== "all") {
        query = query.eq("connection_id", filters.connectionId);
      }

      // Search filter
      if (filters.search && filters.search.trim()) {
        const q = `%${filters.search.trim()}%`;
        query = query.or(`recipient_phone.ilike.${q},recipient_name.ilike.${q},content.ilike.${q}`);
      }

      // Date range filter
      if (filters.dateFrom) {
        query = query.gte("scheduled_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("scheduled_at", filters.dateTo);
      }

      // Ordering: upcoming messages earliest first; past messages latest first
      if (filters.tab === "upcoming") {
        query = query.order("scheduled_at", { ascending: true });
      } else {
        query = query.order("scheduled_at", { ascending: false });
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data as WhatsAppScheduledMessage[];
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  // In-memory filtering (strict business isolation)
  let items = inMemoryScheduledMessages.filter((m) => m.business_id === businessId);
  const nowMs = Date.now();

  if (filters.tab === "upcoming") {
    items = items.filter(
      (m) =>
        ["scheduled", "draft", "processing"].includes(m.status) &&
        new Date(m.scheduled_at).getTime() >= nowMs
    );
  } else if (filters.tab === "past") {
    items = items.filter(
      (m) =>
        ["sent", "delivered", "read", "failed", "cancelled"].includes(m.status) ||
        new Date(m.scheduled_at).getTime() < nowMs
    );
  }

  if (filters.status && filters.status !== "all") {
    items = items.filter((m) => m.status === filters.status);
  }

  if (filters.messageType && filters.messageType !== "all") {
    items = items.filter((m) => m.message_type === filters.messageType);
  }

  if (filters.connectionId && filters.connectionId !== "all") {
    items = items.filter((m) => m.connection_id === filters.connectionId);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    items = items.filter(
      (m) =>
        m.recipient_phone.toLowerCase().includes(q) ||
        (m.recipient_name && m.recipient_name.toLowerCase().includes(q)) ||
        (m.content && m.content.toLowerCase().includes(q)) ||
        (m.template_name && m.template_name.toLowerCase().includes(q))
    );
  }

  if (filters.dateFrom) {
    const fromMs = new Date(filters.dateFrom).getTime();
    items = items.filter((m) => new Date(m.scheduled_at).getTime() >= fromMs);
  }
  if (filters.dateTo) {
    const toMs = new Date(filters.dateTo).getTime();
    items = items.filter((m) => new Date(m.scheduled_at).getTime() <= toMs);
  }

  if (filters.tab === "upcoming") {
    items.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  } else {
    items.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  }

  if (filters.limit) {
    items = items.slice(0, filters.limit);
  }

  return items;
}

/**
 * Retrieve a specific scheduled message by ID ensuring strict business isolation
 */
export async function getScheduledMessageByIdDb(
  businessId: string,
  id: string,
  client?: any
): Promise<WhatsAppScheduledMessage | null> {
  validateTenant(businessId);

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      const { data, error } = await supabase
        .from("wa_scheduled_messages")
        .select(`
          *,
          connection:wa_connections (
            id, display_name, phone_number, phone_number_id, waba_id, connection_status, is_enabled
          )
        `)
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return data as WhatsAppScheduledMessage;
      }
    } catch {
      // Fallback
    }
  }

  const found = inMemoryScheduledMessages.find(
    (m) => m.business_id === businessId && m.id === id
  );
  return found || null;
}

/**
 * Create a new scheduled message in the database
 */
export async function createScheduledMessageDb(
  businessId: string,
  input: CreateScheduledMessageDbInput,
  userId?: string | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  validateTenant(businessId);

  const now = new Date().toISOString();
  const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newRecord: WhatsAppScheduledMessage = {
    id,
    business_id: businessId,
    connection_id: input.connection_id,
    recipient_phone: input.recipient_phone,
    recipient_name: input.recipient_name || null,
    conversation_id: input.conversation_id || null,
    message_type: input.message_type,
    content: input.content || null,
    template_name: input.template_name || null,
    template_language: input.template_language || "en_US",
    template_variables: input.template_variables || {},
    media_type: input.media_type || null,
    media_storage_path: input.media_storage_path || null,
    media_filename: input.media_filename || null,
    media_file_size: input.media_file_size || null,
    media_mime_type: input.media_mime_type || null,
    media_caption: input.media_caption || null,
    media_meta_id: input.media_meta_id || null,
    scheduled_at: input.scheduled_at,
    timezone: input.timezone || "Asia/Kolkata",
    status: input.status || "scheduled",
    locked_at: null,
    locked_by: null,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    message_id: null,
    meta_message_id: null,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    cancelled_at: null,
    cancelled_by: null,
    created_by: userId || null,
    updated_by: userId || null,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      const { data, error } = await supabase
        .from("wa_scheduled_messages")
        .insert({
          business_id: businessId,
          connection_id: input.connection_id,
          recipient_phone: input.recipient_phone,
          recipient_name: input.recipient_name || null,
          conversation_id: input.conversation_id || null,
          message_type: input.message_type,
          content: input.content || null,
          template_name: input.template_name || null,
          template_language: input.template_language || "en_US",
          template_variables: input.template_variables || {},
          media_type: input.media_type || null,
          media_storage_path: input.media_storage_path || null,
          media_filename: input.media_filename || null,
          media_file_size: input.media_file_size || null,
          media_mime_type: input.media_mime_type || null,
          media_caption: input.media_caption || null,
          media_meta_id: input.media_meta_id || null,
          scheduled_at: input.scheduled_at,
          timezone: input.timezone || "Asia/Kolkata",
          status: input.status || "scheduled",
          created_by: userId || null,
          updated_by: userId || null,
        })
        .select()
        .single();

      if (!error && data) {
        return data as WhatsAppScheduledMessage;
      }
    } catch {
      // Fallback
    }
  }

  inMemoryScheduledMessages.unshift(newRecord);
  return newRecord;
}

/**
 * Update an existing scheduled message (only allowed if status is 'scheduled' or 'draft')
 */
export async function updateScheduledMessageDb(
  businessId: string,
  id: string,
  input: UpdateScheduledMessageDbInput,
  userId?: string | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  validateTenant(businessId);

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      };

      if (input.scheduled_at !== undefined) updatePayload.scheduled_at = input.scheduled_at;
      if (input.content !== undefined) updatePayload.content = input.content;
      if (input.template_variables !== undefined) updatePayload.template_variables = input.template_variables;
      if (input.media_caption !== undefined) updatePayload.media_caption = input.media_caption;
      if (input.status !== undefined) updatePayload.status = input.status;

      // Safe update: only allowed if message has not started processing
      const { data, error } = await supabase
        .from("wa_scheduled_messages")
        .update(updatePayload)
        .eq("id", id)
        .eq("business_id", businessId)
        .in("status", ["scheduled", "draft"])
        .select()
        .single();

      if (error || !data) {
        throw new Error(
          error?.message ||
            "Unable to update message: It may have already started processing, been cancelled, or dispatched."
        );
      }

      return data as WhatsAppScheduledMessage;
    } catch (err: any) {
      if (!err.message?.includes("already started processing")) {
        // Continue to fallback if Supabase not configured
      } else {
        throw err;
      }
    }
  }

  const idx = inMemoryScheduledMessages.findIndex(
    (m) => m.business_id === businessId && m.id === id
  );

  if (idx === -1) {
    throw new Error(`Scheduled message not found: ${id}`);
  }

  const existing = inMemoryScheduledMessages[idx];
  if (!["scheduled", "draft"].includes(existing.status)) {
    throw new Error(
      `Cannot edit message in status "${existing.status}". Only scheduled or draft messages can be modified.`
    );
  }

  const updated: WhatsAppScheduledMessage = {
    ...existing,
    ...(input.scheduled_at !== undefined ? { scheduled_at: input.scheduled_at } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.template_variables !== undefined ? { template_variables: input.template_variables } : {}),
    ...(input.media_caption !== undefined ? { media_caption: input.media_caption } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updated_by: userId || existing.updated_by,
    updated_at: new Date().toISOString(),
  };

  inMemoryScheduledMessages[idx] = updated;
  return updated;
}

/**
 * Safely cancel a scheduled message (strictly prevents race with worker claiming)
 */
export async function cancelScheduledMessageDb(
  businessId: string,
  id: string,
  userId?: string | null,
  reason?: string | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  validateTenant(businessId);

  const now = new Date().toISOString();

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      const { data, error } = await supabase
        .from("wa_scheduled_messages")
        .update({
          status: "cancelled",
          cancelled_at: now,
          cancelled_by: userId || null,
          last_error: reason ? `Cancelled: ${reason}` : "Cancelled by user",
          updated_at: now,
          updated_by: userId || null,
        })
        .eq("id", id)
        .eq("business_id", businessId)
        .in("status", ["scheduled", "draft"])
        .select()
        .single();

      if (error || !data) {
        throw new Error(
          error?.message ||
            "Cannot cancel message: It may have already started processing, been dispatched, or previously cancelled."
        );
      }

      return data as WhatsAppScheduledMessage;
    } catch (err: any) {
      if (!err.message?.includes("Cannot cancel message")) {
        // Fallback
      } else {
        throw err;
      }
    }
  }

  const idx = inMemoryScheduledMessages.findIndex(
    (m) => m.business_id === businessId && m.id === id
  );

  if (idx === -1) {
    throw new Error(`Scheduled message not found: ${id}`);
  }

  const existing = inMemoryScheduledMessages[idx];
  if (!["scheduled", "draft"].includes(existing.status)) {
    throw new Error(
      `Cannot cancel message in status "${existing.status}". Only scheduled or draft messages can be cancelled.`
    );
  }

  const cancelled: WhatsAppScheduledMessage = {
    ...existing,
    status: "cancelled",
    cancelled_at: now,
    cancelled_by: userId || null,
    last_error: reason ? `Cancelled: ${reason}` : "Cancelled by user",
    updated_at: now,
    updated_by: userId || null,
  };

  inMemoryScheduledMessages[idx] = cancelled;
  return cancelled;
}

/**
 * Retry an eligible failed scheduled message
 */
export async function retryScheduledMessageDb(
  businessId: string,
  id: string,
  userId?: string | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  validateTenant(businessId);

  const now = new Date().toISOString();

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      const { data, error } = await supabase
        .from("wa_scheduled_messages")
        .update({
          status: "scheduled",
          scheduled_at: now, // Dispatch immediately on retry
          retry_count: 0,
          last_error: null,
          locked_at: null,
          locked_by: null,
          updated_at: now,
          updated_by: userId || null,
        })
        .eq("id", id)
        .eq("business_id", businessId)
        .eq("status", "failed")
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Only failed messages can be retried.");
      }

      return data as WhatsAppScheduledMessage;
    } catch (err: any) {
      if (!err.message?.includes("Only failed messages")) {
        // Fallback
      } else {
        throw err;
      }
    }
  }

  const idx = inMemoryScheduledMessages.findIndex(
    (m) => m.business_id === businessId && m.id === id
  );

  if (idx === -1) {
    throw new Error(`Scheduled message not found: ${id}`);
  }

  const existing = inMemoryScheduledMessages[idx];
  if (existing.status !== "failed") {
    throw new Error(`Cannot retry message in status "${existing.status}". Only failed messages can be retried.`);
  }

  const retried: WhatsAppScheduledMessage = {
    ...existing,
    status: "scheduled",
    scheduled_at: now,
    retry_count: 0,
    last_error: null,
    locked_at: null,
    locked_by: null,
    updated_at: now,
    updated_by: userId || null,
  };

  inMemoryScheduledMessages[idx] = retried;
  return retried;
}

/**
 * Delete a draft scheduled message
 */
export async function deleteDraftScheduledMessageDb(
  businessId: string,
  id: string,
  client?: any
): Promise<boolean> {
  validateTenant(businessId);

  if (isSupabaseConfigured() || client) {
    try {
      const supabase = client || (await createServerSupabaseClient());
      const { error } = await supabase
        .from("wa_scheduled_messages")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId)
        .eq("status", "draft");

      if (!error) return true;
    } catch {
      // Fallback
    }
  }

  const idx = inMemoryScheduledMessages.findIndex(
    (m) => m.business_id === businessId && m.id === id
  );

  if (idx !== -1 && inMemoryScheduledMessages[idx].status === "draft") {
    inMemoryScheduledMessages.splice(idx, 1);
    return true;
  }

  return false;
}

/**
 * Get summary counters for dashboard
 */
export async function getScheduledMessagesStatsDb(
  businessId: string,
  client?: any
): Promise<ScheduledMessagesSummaryStats> {
  validateTenant(businessId);

  const all = await listScheduledMessagesDb(businessId, {}, client);

  const stats: ScheduledMessagesSummaryStats = {
    upcomingCount: 0,
    sentCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    draftCount: 0,
    totalCount: all.length,
  };

  for (const m of all) {
    if (m.status === "scheduled" || m.status === "processing") {
      stats.upcomingCount++;
    } else if (m.status === "sent" || m.status === "delivered" || m.status === "read") {
      stats.sentCount++;
    } else if (m.status === "failed") {
      stats.failedCount++;
    } else if (m.status === "cancelled") {
      stats.cancelledCount++;
    } else if (m.status === "draft") {
      stats.draftCount++;
    }
  }

  return stats;
}
