import {
  ConversationStatus,
  InboxCounts,
  InboxFolder,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/types/database";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  validateTenant,
  getConversationsForBusinessDb,
  getInboxCountsDb,
  getConversationByIdDb,
  updateConversationStatusDb,
  resumeConversationAutomationDb,
  toggleConversationReadDb,
  assignConversationAgentDb,
  getConversationMessagesDb,
  getConversationMessagingWindowDb,
  getApprovedTemplatesDb,
  updateConversationLabelsDb,
  GetConversationsOptions,
  GetConversationMessagesOptions,
  GetConversationMessagesResult,
} from "./database";
import { MessagingWindowStatus } from "@/lib/whatsapp/service";

export {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  validateTenant,
  getConversationsForBusinessDb,
  getInboxCountsDb,
  getConversationByIdDb,
  updateConversationStatusDb,
  resumeConversationAutomationDb,
  toggleConversationReadDb,
  assignConversationAgentDb,
  getConversationMessagesDb,
  getConversationMessagingWindowDb,
  getApprovedTemplatesDb,
  updateConversationLabelsDb,
};

/**
 * Fetch conversations for a specific business tenant from Supabase.
 * Strictly guarantees multi-tenant isolation: Astrology conversations are never returned to Vivaham.
 * In production, if Supabase has 0 rows, it returns [] (never leaks demo/mock customers).
 */
export async function getConversationsForBusiness(
  businessId: string,
  options: GetConversationsOptions = {}
): Promise<WhatsAppConversation[]> {
  return getConversationsForBusinessDb(businessId, options);
}

/**
 * Calculate conversation counts for each navigation folder for a business tenant from Supabase.
 */
export async function getInboxCounts(
  businessId: string,
  connectionId?: string,
  currentUserId?: string,
  client?: any
): Promise<InboxCounts> {
  return getInboxCountsDb(businessId, { connectionId, currentUserId, client });
}

/**
 * Get a single conversation by ID with strict tenant boundary enforcement from Supabase.
 */
export async function getConversationById(
  businessId: string,
  conversationId: string,
  client?: any
): Promise<WhatsAppConversation | null> {
  return getConversationByIdDb(businessId, conversationId, client);
}

/**
 * Update conversation status (open, closed, archived, pending_human) in Supabase.
 */
export async function updateConversationStatus(
  businessId: string,
  conversationId: string,
  status: ConversationStatus,
  client?: any
): Promise<void> {
  return updateConversationStatusDb(businessId, conversationId, status, client);
}

/**
 * Explicitly resume bot automation for a conversation and set status to open.
 */
export async function resumeConversationAutomation(
  businessId: string,
  conversationId: string,
  client?: any
): Promise<void> {
  return resumeConversationAutomationDb(businessId, conversationId, client);
}

/**
 * Mark a conversation as read (resets unread_count to 0) or unread in Supabase.
 */
export async function toggleConversationRead(
  businessId: string,
  conversationId: string,
  isRead: boolean,
  client?: any
): Promise<void> {
  return toggleConversationReadDb(businessId, conversationId, isRead, client);
}

/**
 * Assign conversation to an agent.
 */
export async function assignConversationAgent(
  businessId: string,
  conversationId: string,
  agentId: string | null,
  agentName: string | null,
  client?: any
): Promise<void> {
  await validateTenant(businessId, client);
  // Verify conversation belongs to tenant
  const conv = await getConversationByIdDb(businessId, conversationId, client);
  if (!conv) {
    throw new Error(`Conversation not found for tenant "${businessId}".`);
  }
  await assignConversationAgentDb(businessId, conversationId, agentId, agentName, client);
}

/**
 * Retrieve chronological message history for a conversation from Supabase with pagination.
 */
export async function getConversationMessages(
  businessId: string,
  conversationId: string,
  options: GetConversationMessagesOptions = {}
): Promise<GetConversationMessagesResult> {
  return getConversationMessagesDb(businessId, conversationId, options);
}

/**
 * Retrieve 24-hour customer service window status for a conversation from Supabase.
 */
export async function getConversationMessagingWindow(
  businessId: string,
  conversationId: string,
  client?: any
): Promise<MessagingWindowStatus> {
  return getConversationMessagingWindowDb(businessId, conversationId, client);
}

/**
 * Retrieve approved WhatsApp templates for a business tenant from Supabase.
 */
export async function getApprovedTemplates(
  businessId: string,
  connectionId?: string,
  client?: any
) {
  return getApprovedTemplatesDb(businessId, connectionId, client);
}

export async function updateConversationLabels(
  businessId: string,
  conversationId: string,
  labels: string[],
  client?: any
): Promise<string[]> {
  return updateConversationLabelsDb(businessId, conversationId, labels, client);
}
