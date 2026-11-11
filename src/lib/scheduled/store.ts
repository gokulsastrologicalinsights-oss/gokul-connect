import {
  ScheduledMessageFilters,
  ScheduledMessagesSummaryStats,
  WhatsAppScheduledMessage,
} from "@/types/database";
import {
  cancelScheduledMessageDb,
  createScheduledMessageDb,
  CreateScheduledMessageDbInput,
  deleteDraftScheduledMessageDb,
  getScheduledMessageByIdDb,
  getScheduledMessagesStatsDb,
  listScheduledMessagesDb,
  resetScheduledMemoryStore,
  retryScheduledMessageDb,
  seedScheduledMemoryStore,
  updateScheduledMessageDb,
  UpdateScheduledMessageDbInput,
} from "./database";
import { logTeamActivity } from "@/lib/team/store";

export { resetScheduledMemoryStore, seedScheduledMemoryStore };

export async function listScheduledMessages(
  businessId: string,
  filters: ScheduledMessageFilters = {},
  client?: any
): Promise<WhatsAppScheduledMessage[]> {
  return listScheduledMessagesDb(businessId, filters, client);
}

export async function getScheduledMessageById(
  businessId: string,
  id: string,
  client?: any
): Promise<WhatsAppScheduledMessage | null> {
  return getScheduledMessageByIdDb(businessId, id, client);
}

export async function getScheduledMessagesStats(
  businessId: string,
  client?: any
): Promise<ScheduledMessagesSummaryStats> {
  return getScheduledMessagesStatsDb(businessId, client);
}

export async function createScheduledMessage(
  businessId: string,
  input: CreateScheduledMessageDbInput,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  const result = await createScheduledMessageDb(businessId, input, actor?.id, client);

  // Log Team Activity
  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_created",
    description: `Scheduled a ${input.message_type} message for ${input.recipient_phone} on ${new Date(input.scheduled_at).toLocaleString()}`,
    metadata: {
      scheduled_message_id: result.id,
      recipient_phone: input.recipient_phone,
      message_type: input.message_type,
      scheduled_at: input.scheduled_at,
    },
  }).catch(() => {});

  return result;
}

export async function updateScheduledMessage(
  businessId: string,
  id: string,
  input: UpdateScheduledMessageDbInput,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  const result = await updateScheduledMessageDb(businessId, id, input, actor?.id, client);

  // Log Team Activity
  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_edited",
    description: `Updated scheduled message ${id}`,
    metadata: {
      scheduled_message_id: id,
      new_scheduled_at: input.scheduled_at,
    },
  }).catch(() => {});

  return result;
}

export async function rescheduleMessage(
  businessId: string,
  id: string,
  newScheduledAt: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  const result = await updateScheduledMessageDb(
    businessId,
    id,
    { scheduled_at: newScheduledAt },
    actor?.id,
    client
  );

  // Log Team Activity
  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_rescheduled",
    description: `Rescheduled message ${id} to ${new Date(newScheduledAt).toLocaleString()}`,
    metadata: {
      scheduled_message_id: id,
      new_scheduled_at: newScheduledAt,
    },
  }).catch(() => {});

  return result;
}

export async function cancelScheduledMessage(
  businessId: string,
  id: string,
  actor?: { id: string; name: string } | null,
  reason?: string | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  const result = await cancelScheduledMessageDb(businessId, id, actor?.id, reason, client);

  // Log Team Activity
  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_cancelled",
    description: `Cancelled scheduled message ${id}: ${reason || "User requested"}`,
    metadata: {
      scheduled_message_id: id,
      reason,
    },
  }).catch(() => {});

  return result;
}

export async function retryScheduledMessage(
  businessId: string,
  id: string,
  actor?: { id: string; name: string } | null,
  client?: any
): Promise<WhatsAppScheduledMessage> {
  const result = await retryScheduledMessageDb(businessId, id, actor?.id, client);

  // Log Team Activity
  await logTeamActivity(businessId, {
    actor_id: actor?.id || null,
    actor_name: actor?.name || "System",
    activity_type: "scheduled_message_retried",
    description: `Retried failed scheduled message ${id}`,
    metadata: {
      scheduled_message_id: id,
    },
  }).catch(() => {});

  return result;
}

export async function deleteDraftScheduledMessage(
  businessId: string,
  id: string,
  client?: any
): Promise<boolean> {
  return deleteDraftScheduledMessageDb(businessId, id, client);
}
