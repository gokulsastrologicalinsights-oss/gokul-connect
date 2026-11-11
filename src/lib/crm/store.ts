import {
  CrmCategory,
  CrmContactFilter,
  CrmMetrics,
  CrmSegment,
  ContactNote,
  ContactActivityLog,
  CsvContactImportRow,
  CsvImportValidationResult,
  WhatsAppContact,
} from "@/types/database";
import {
  getCrmContactsDb,
  getCrmContactByIdDb,
  createContactDb,
  updateContactDb,
  archiveContactDb,
  getContactNotesDb,
  addContactNoteDb,
  getContactActivityLogsDb,
  logContactActivityDb,
  getCrmCategoriesDb,
  createCrmCategoryDb,
  getCrmSegmentsDb,
  createCrmSegmentDb,
  deleteCrmSegmentDb,
  getCrmDashboardMetricsDb,
  bulkImportContactsDb,
  getOrCreateConversationForContactDb,
  exportContactsToCsvString,
  escapeCsvValue,
  parseAndValidateCsv,
  normalizePhoneNumber,
  resetMockCrmStore,
  DEFAULT_ASTRO_CATEGORIES,
  DEFAULT_VIVAHAM_CATEGORIES,
  filterContactsBySegmentFilters,
  getContactsForSegmentDb,
} from "./database";

import {
  DEFAULT_ASTRO_LIFECYCLE_STAGES,
  DEFAULT_VIVAHAM_LIFECYCLE_STAGES,
  getDefaultLifecycleStages,
  getLifecycleStagesDb,
  createLifecycleStageDb,
  updateContactLifecycleStageDb,
  bulkUpdateContactsLifecycleStageDb,
  getContactLifecycleHistoryDb,
  resetMockLifecycleStore,
} from "./lifecycle";

import {
  createFollowUpDb,
  updateFollowUpDb,
  completeFollowUpDb,
  rescheduleFollowUpDb,
  cancelFollowUpDb,
  getFollowUpsDb,
  getFollowUpByIdDb,
  getFollowUpMetricsDb,
  resetMockFollowUpsStore,
  isTodayKolkata,
  isOverdue,
} from "./follow-ups";

import {
  generateFollowUpRemindersDb,
  getUserRemindersDb,
  markReminderReadDb,
  resetMockRemindersStore,
} from "./reminders";

import {
  handleContactCreatedAutomation,
  handleFollowUpCompletedAutomation,
  runOverdueRemindersAutomation,
  DEFAULT_AUTOMATION_CONFIG,
} from "./lifecycle-automation";

import { getCrmLifecycleReportDb } from "./lifecycle-reports";

export {
  DEFAULT_ASTRO_LIFECYCLE_STAGES,
  DEFAULT_VIVAHAM_LIFECYCLE_STAGES,
  getDefaultLifecycleStages,
  getLifecycleStagesDb,
  createLifecycleStageDb,
  updateContactLifecycleStageDb,
  bulkUpdateContactsLifecycleStageDb,
  getContactLifecycleHistoryDb,
  resetMockLifecycleStore,
  createFollowUpDb,
  updateFollowUpDb,
  completeFollowUpDb,
  rescheduleFollowUpDb,
  cancelFollowUpDb,
  getFollowUpsDb,
  getFollowUpByIdDb,
  getFollowUpMetricsDb,
  resetMockFollowUpsStore,
  isTodayKolkata,
  isOverdue,
  generateFollowUpRemindersDb,
  getUserRemindersDb,
  markReminderReadDb,
  resetMockRemindersStore,
  handleContactCreatedAutomation,
  handleFollowUpCompletedAutomation,
  runOverdueRemindersAutomation,
  DEFAULT_AUTOMATION_CONFIG,
  getCrmLifecycleReportDb,
  filterContactsBySegmentFilters,
  getContactsForSegmentDb,
};

export {
  getCrmContactsDb,
  getCrmContactByIdDb,
  createContactDb,
  updateContactDb,
  archiveContactDb,
  getContactNotesDb,
  addContactNoteDb,
  getContactActivityLogsDb,
  logContactActivityDb,
  getCrmCategoriesDb,
  createCrmCategoryDb,
  getCrmSegmentsDb,
  createCrmSegmentDb,
  deleteCrmSegmentDb,
  getCrmDashboardMetricsDb,
  bulkImportContactsDb,
  getOrCreateConversationForContactDb,
  exportContactsToCsvString,
  escapeCsvValue,
  parseAndValidateCsv,
  normalizePhoneNumber,
  resetMockCrmStore,
  DEFAULT_ASTRO_CATEGORIES,
  DEFAULT_VIVAHAM_CATEGORIES,
};

/**
 * High-level CRM Store API
 * All functions enforce strict multi-tenant boundaries.
 */

export async function getCrmContacts(
  businessId: string,
  filter: CrmContactFilter = {},
  client?: any
) {
  return getCrmContactsDb(businessId, filter, client);
}

export async function getCrmContactById(
  businessId: string,
  contactId: string,
  client?: any
) {
  return getCrmContactByIdDb(businessId, contactId, client);
}

export async function createContact(
  businessId: string,
  input: Parameters<typeof createContactDb>[1],
  client?: any
) {
  return createContactDb(businessId, input, client);
}

export async function updateContact(
  businessId: string,
  contactId: string,
  input: Parameters<typeof updateContactDb>[2],
  client?: any
) {
  return updateContactDb(businessId, contactId, input, client);
}

export async function archiveContact(
  businessId: string,
  contactId: string,
  archive: boolean = true,
  client?: any
) {
  return archiveContactDb(businessId, contactId, archive, client);
}

export async function getContactNotes(
  businessId: string,
  contactId: string,
  client?: any
) {
  return getContactNotesDb(businessId, contactId, client);
}

export async function addContactNote(
  businessId: string,
  contactId: string,
  note: string,
  authorId?: string | null,
  authorName?: string,
  client?: any
) {
  return addContactNoteDb(businessId, contactId, note, authorId, authorName, client);
}

export async function getContactActivityLogs(
  businessId: string,
  contactId: string,
  client?: any
) {
  return getContactActivityLogsDb(businessId, contactId, client);
}

export async function getCrmCategories(businessId: string, client?: any) {
  return getCrmCategoriesDb(businessId, client);
}

export async function createCrmCategory(
  businessId: string,
  input: Parameters<typeof createCrmCategoryDb>[1],
  client?: any
) {
  return createCrmCategoryDb(businessId, input, client);
}

export async function getCrmSegments(businessId: string, client?: any) {
  return getCrmSegmentsDb(businessId, client);
}

export async function createCrmSegment(
  businessId: string,
  input: Parameters<typeof createCrmSegmentDb>[1],
  client?: any
) {
  return createCrmSegmentDb(businessId, input, client);
}

export async function deleteCrmSegment(
  businessId: string,
  segmentId: string,
  client?: any
) {
  return deleteCrmSegmentDb(businessId, segmentId, client);
}

export async function getCrmDashboardMetrics(businessId: string, client?: any) {
  return getCrmDashboardMetricsDb(businessId, client);
}

export async function bulkImportContacts(
  businessId: string,
  rows: CsvContactImportRow[],
  client?: any
) {
  return bulkImportContactsDb(businessId, rows, client);
}

export async function getOrCreateConversationForContact(
  businessId: string,
  contactId: string,
  optionsOrClient?: { connectionId?: string; client?: any } | any
) {
  return getOrCreateConversationForContactDb(businessId, contactId, optionsOrClient);
}

// --- Lifecycle & Follow-ups API ---

export async function getLifecycleStages(businessId: string, client?: any) {
  return getLifecycleStagesDb(businessId, client);
}

export async function createLifecycleStage(
  businessId: string,
  input: Parameters<typeof createLifecycleStageDb>[1],
  client?: any
) {
  return createLifecycleStageDb(businessId, input, client);
}

export async function updateContactLifecycleStage(
  businessId: string,
  contactId: string,
  stageSlug: string,
  changedBy?: string,
  reason?: string,
  client?: any
) {
  return updateContactLifecycleStageDb(businessId, contactId, stageSlug, changedBy, reason, client);
}

export async function bulkUpdateContactsLifecycleStage(
  businessId: string,
  contactIds: string[],
  stageSlug: string,
  changedBy?: string,
  reason?: string,
  client?: any
) {
  return bulkUpdateContactsLifecycleStageDb(businessId, contactIds, stageSlug, changedBy, reason, client);
}

export async function getContactLifecycleHistory(
  businessId: string,
  contactId: string,
  client?: any
) {
  return getContactLifecycleHistoryDb(businessId, contactId, client);
}

export async function createFollowUp(
  businessId: string,
  input: Parameters<typeof createFollowUpDb>[1],
  actor?: { id: string; name?: string },
  client?: any
) {
  return createFollowUpDb(businessId, input, actor, client);
}

export async function updateFollowUp(
  businessId: string,
  followUpId: string,
  input: Parameters<typeof updateFollowUpDb>[2],
  actor?: { id: string },
  client?: any
) {
  return updateFollowUpDb(businessId, followUpId, input, actor, client);
}

export async function completeFollowUp(
  businessId: string,
  followUpId: string,
  completionNotes?: string,
  actor?: { id: string; name?: string },
  client?: any
) {
  return completeFollowUpDb(businessId, followUpId, completionNotes, actor, client);
}

export async function rescheduleFollowUp(
  businessId: string,
  followUpId: string,
  newDueAt: string,
  reason?: string,
  actor?: { id: string },
  client?: any
) {
  return rescheduleFollowUpDb(businessId, followUpId, newDueAt, reason, actor, client);
}

export async function cancelFollowUp(
  businessId: string,
  followUpId: string,
  reason?: string,
  actor?: { id: string },
  client?: any
) {
  return cancelFollowUpDb(businessId, followUpId, reason, actor, client);
}

export async function getFollowUps(
  businessId: string,
  filters?: Parameters<typeof getFollowUpsDb>[1],
  client?: any
) {
  return getFollowUpsDb(businessId, filters, client);
}

export async function getFollowUpById(
  businessId: string,
  followUpId: string,
  client?: any
) {
  return getFollowUpByIdDb(businessId, followUpId, client);
}

export async function getFollowUpMetrics(businessId: string, client?: any) {
  return getFollowUpMetricsDb(businessId, client);
}

export async function generateFollowUpReminders(businessId: string, client?: any) {
  return generateFollowUpRemindersDb(businessId, client);
}

export async function getUserReminders(
  businessId: string,
  userId: string,
  unreadOnly = false,
  client?: any
) {
  return getUserRemindersDb(businessId, userId, unreadOnly, client);
}

export async function markReminderRead(
  businessId: string,
  reminderId: string,
  userId: string,
  client?: any
) {
  return markReminderReadDb(businessId, reminderId, userId, client);
}

export async function getCrmLifecycleReport(businessId: string, client?: any) {
  return getCrmLifecycleReportDb(businessId, client);
}

export async function getContactsForSegment(
  businessId: string,
  segmentId: string,
  client?: any
) {
  return getContactsForSegmentDb(businessId, segmentId, client);
}

