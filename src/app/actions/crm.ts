"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { rateLimitSensitiveAction } from "@/lib/rate-limit/rate-limiter";
import {
  AddContactNoteSchema,
  BulkImportContactsSchema,
  CreateContactSchema,
  CreateCrmCategorySchema,
  CreateCrmSegmentSchema,
  UpdateContactSchema,
  BulkUpdateStageSchema,
  CancelFollowUpSchema,
  CompleteFollowUpSchema,
  CreateFollowUpSchema,
  CreateLifecycleStageSchema,
  RescheduleFollowUpSchema,
  UpdateContactStageSchema,
  UpdateFollowUpSchema,
} from "@/lib/validation/schemas";
import {
  addContactNote,
  archiveContact,
  bulkImportContacts,
  createContact,
  createCrmCategory,
  createCrmSegment,
  deleteCrmSegment,
  exportContactsToCsvString,
  getCrmCategories,
  getCrmContactById,
  getCrmContacts,
  getCrmDashboardMetrics,
  getCrmSegments,
  getOrCreateConversationForContact,
  updateContact,
  bulkUpdateContactsLifecycleStage,
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  createLifecycleStage,
  generateFollowUpReminders,
  getCrmLifecycleReport,
  getContactLifecycleHistory,
  getFollowUpById,
  getFollowUpMetrics,
  getFollowUps,
  getLifecycleStages,
  getUserReminders,
  markReminderRead,
  rescheduleFollowUp,
  updateContactLifecycleStage,
  updateFollowUp,
} from "@/lib/crm/store";
import {
  CrmCategory,
  CrmContactFilter,
  CrmMetrics,
  CrmSegment,
  ContactNote,
  CsvContactImportRow,
  WhatsAppContact,
  ContactLifecycleHistory,
  CrmFollowUp,
  CrmFollowUpReminder,
  CrmLifecycleReport,
  CrmLifecycleStage,
  FollowUpFilterOptions,
  FollowUpMetrics,
} from "@/types/database";

export type GetCrmContactsResult =
  | { success: true; contacts: WhatsAppContact[]; totalCount: number; page: number; totalPages: number }
  | { success: false; error: string; contacts?: never; totalCount?: never; page?: never; totalPages?: never };

export type GetCrmContactByIdResult =
  | { success: true; contact: WhatsAppContact }
  | { success: false; error: string; contact?: never };

export type MutateContactResult =
  | { success: true; contact: WhatsAppContact }
  | { success: false; error: string; contact?: never };

export type AddContactNoteResult =
  | { success: true; note: ContactNote }
  | { success: false; error: string; note?: never };

export type GetCrmCategoriesResult =
  | { success: true; categories: CrmCategory[] }
  | { success: false; error: string; categories?: never };

export type CreateCrmCategoryResult =
  | { success: true; category: CrmCategory }
  | { success: false; error: string; category?: never };

export type GetCrmSegmentsResult =
  | { success: true; segments: CrmSegment[] }
  | { success: false; error: string; segments?: never };

export type CreateCrmSegmentResult =
  | { success: true; segment: CrmSegment }
  | { success: false; error: string; segment?: never };

export type BulkImportContactsResult =
  | { success: true; importedCount: number; duplicateCount: number; errors: Array<{ phone: string; error: string }> }
  | { success: false; error: string; importedCount?: never; duplicateCount?: never; errors?: never };

export type ExportContactsCsvResult =
  | { success: true; csvContent: string; filename: string; count: number }
  | { success: false; error: string; csvContent?: never; filename?: never; count?: never };

export type GetCrmDashboardMetricsResult =
  | { success: true; metrics: CrmMetrics }
  | { success: false; error: string; metrics?: never };

export type OpenContactInInboxResult =
  | { success: true; conversationId: string }
  | { success: false; error: string; conversationId?: never };

/**
 * 1. Get CRM Contacts with Filters & Pagination
 */
export async function getCrmContactsAction(
  businessSlug: string,
  filters: CrmContactFilter = {}
): Promise<GetCrmContactsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const result = await getCrmContacts(business.id, filters);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load contacts." };
  }
}

/**
 * 2. Get Single Contact Profile by ID
 */
export async function getCrmContactByIdAction(
  businessSlug: string,
  contactId: string
): Promise<GetCrmContactByIdResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const contact = await getCrmContactById(business.id, contactId);
    if (!contact) {
      return { success: false, error: "Contact not found." };
    }

    return { success: true, contact };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to retrieve contact." };
  }
}

/**
 * 3. Create Contact
 */
export async function createContactAction(
  businessSlug: string,
  rawInput: unknown
): Promise<MutateContactResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "create_contact");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const validated = CreateContactSchema.parse(rawInput);
    const newContact = await createContact(business.id, {
      ...validated,
      assigned_agent_id: user.id,
      assigned_agent_name: user.email?.split("@")[0] || "Agent",
    });

    revalidatePath(`/workspace/${businessSlug}/crm`);
    revalidatePath(`/workspace/${businessSlug}/inbox`);
    return { success: true, contact: newContact };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create contact." };
  }
}

/**
 * 4. Update Contact
 */
export async function updateContactAction(
  businessSlug: string,
  contactId: string,
  rawInput: unknown
): Promise<MutateContactResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "update_contact");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const validated = UpdateContactSchema.parse(rawInput);
    const updated = await updateContact(business.id, contactId, validated);

    revalidatePath(`/workspace/${businessSlug}/crm`);
    revalidatePath(`/workspace/${businessSlug}/inbox`);
    return { success: true, contact: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update contact." };
  }
}

/**
 * 5. Archive or Unarchive Contact
 */
export async function archiveContactAction(
  businessSlug: string,
  contactId: string,
  archive: boolean = true
) {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    await archiveContact(business.id, contactId, archive);

    revalidatePath(`/workspace/${businessSlug}/crm`);
    revalidatePath(`/workspace/${businessSlug}/inbox`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update archive status." };
  }
}

/**
 * 6. Add Contact Note
 */
export async function addContactNoteAction(
  businessSlug: string,
  contactId: string,
  rawInput: unknown
): Promise<AddContactNoteResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const validated = AddContactNoteSchema.parse(rawInput);
    const note = await addContactNote(
      business.id,
      contactId,
      validated.note,
      user.id,
      validated.author_name || user.email?.split("@")[0] || "Staff"
    );

    revalidatePath(`/workspace/${businessSlug}/crm`);
    return { success: true, note };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add note." };
  }
}

/**
 * 7. Get Configurable Categories for Business
 */
export async function getCrmCategoriesAction(
  businessSlug: string
): Promise<GetCrmCategoriesResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const categories = await getCrmCategories(business.id);
    return { success: true, categories };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load categories." };
  }
}

/**
 * 8. Create Custom Business Category
 */
export async function createCrmCategoryAction(
  businessSlug: string,
  rawInput: unknown
): Promise<CreateCrmCategoryResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Only owners and admins can configure categories." };
    }

    const validated = CreateCrmCategorySchema.parse(rawInput);
    const category = await createCrmCategory(business.id, validated);

    revalidatePath(`/workspace/${businessSlug}/crm`);
    return { success: true, category };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create category." };
  }
}

/**
 * 9. Saved Segments Actions
 */
export async function getCrmSegmentsAction(
  businessSlug: string
): Promise<GetCrmSegmentsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const segments = await getCrmSegments(business.id);
    return { success: true, segments };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load segments." };
  }
}

export async function createCrmSegmentAction(
  businessSlug: string,
  rawInput: unknown
): Promise<CreateCrmSegmentResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const validated = CreateCrmSegmentSchema.parse(rawInput);
    const segment = await createCrmSegment(business.id, validated);

    revalidatePath(`/workspace/${businessSlug}/crm`);
    return { success: true, segment };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save segment." };
  }
}

export async function deleteCrmSegmentAction(
  businessSlug: string,
  segmentId: string
) {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Only owners and admins can delete segments." };
    }

    await deleteCrmSegment(business.id, segmentId);
    revalidatePath(`/workspace/${businessSlug}/crm`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete segment." };
  }
}

/**
 * 10. Bulk Import Contacts
 */
export async function bulkImportContactsAction(
  businessSlug: string,
  contacts: CsvContactImportRow[]
): Promise<BulkImportContactsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Only owners and admins can bulk import contacts." };
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "bulk_import_contacts");
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    const validated = BulkImportContactsSchema.parse({ contacts });
    const result = await bulkImportContacts(business.id, validated.contacts);

    revalidatePath(`/workspace/${businessSlug}/crm`);
    revalidatePath(`/workspace/${businessSlug}/inbox`);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || "Bulk import failed." };
  }
}

/**
 * 11. Export Contacts CSV
 */
export async function exportContactsCsvAction(
  businessSlug: string,
  filters: CrmContactFilter = {}
): Promise<ExportContactsCsvResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    // Retrieve matching contacts up to 5,000 for export
    const res = await getCrmContacts(business.id, { ...filters, limit: 5000, page: 1 });
    const csvContent = exportContactsToCsvString(res.contacts);

    return {
      success: true,
      csvContent,
      filename: `${businessSlug}-contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      count: res.contacts.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to export contacts." };
  }
}

/**
 * 12. CRM Dashboard Metrics
 */
export async function getCrmDashboardMetricsAction(
  businessSlug: string
): Promise<GetCrmDashboardMetricsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const metrics = await getCrmDashboardMetrics(business.id);
    return { success: true, metrics };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load CRM metrics." };
  }
}

/**
 * 13. Open Contact in WhatsApp Inbox
 */
export async function openContactInInboxAction(
  businessSlug: string,
  contactId: string
): Promise<OpenContactInInboxResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const { conversationId } = await getOrCreateConversationForContact(business.id, contactId);
    return { success: true, conversationId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to link conversation." };
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-fatal if invoked in test context
  }
}

/**
 * ============================================================================
 * Phase 12.5: Customer Lifecycle & Follow-up Management Server Actions
 * ============================================================================
 */

export type LifecycleStageResult =
  | { success: true; stages: CrmLifecycleStage[] }
  | { success: false; error: string; stages?: never };

export type CreateLifecycleStageResult =
  | { success: true; stage: CrmLifecycleStage }
  | { success: false; error: string; stage?: never };

export type UpdateContactStageResult =
  | { success: true; contact: WhatsAppContact; history: ContactLifecycleHistory }
  | { success: false; error: string; contact?: never; history?: never };

export type BulkUpdateStageResult =
  | { success: true; updatedCount: number; errors: Array<{ contactId: string; error: string }> }
  | { success: false; error: string; updatedCount?: never; errors?: never };

export type FollowUpResult =
  | { success: true; followUp: CrmFollowUp }
  | { success: false; error: string; followUp?: never };

export type FollowUpsListResult =
  | { success: true; followUps: CrmFollowUp[]; totalCount: number }
  | { success: false; error: string; followUps?: never; totalCount?: never };

export type FollowUpMetricsResult =
  | { success: true; metrics: FollowUpMetrics }
  | { success: false; error: string; metrics?: never };

export type RemindersListResult =
  | { success: true; reminders: CrmFollowUpReminder[] }
  | { success: false; error: string; reminders?: never };

export type LifecycleReportResult =
  | { success: true; report: CrmLifecycleReport }
  | { success: false; error: string; report?: never };

/**
 * 14. Get Lifecycle Stages for a Business
 */
export async function getLifecycleStagesAction(
  businessSlug: string
): Promise<LifecycleStageResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const stages = await getLifecycleStages(business.id);
    return { success: true, stages };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load lifecycle stages." };
  }
}

/**
 * 15. Create a Lifecycle Stage
 */
export async function createLifecycleStageAction(
  businessSlug: string,
  input: unknown
): Promise<CreateLifecycleStageResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Permission denied: Only owners and admins can configure lifecycle stages." };
    }

    const validated = CreateLifecycleStageSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid lifecycle stage data." };
    }

    const stage = await createLifecycleStage(business.id, validated.data);
    safeRevalidatePath(`/workspace/${businessSlug}/crm`);
    return { success: true, stage };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create lifecycle stage." };
  }
}

/**
 * 16. Update a Contact's Lifecycle Stage
 */
export async function updateContactStageAction(
  businessSlug: string,
  contactId: string,
  stageSlug: string,
  reason?: string
): Promise<UpdateContactStageResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = UpdateContactStageSchema.safeParse({ contactId, stageSlug, reason });
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid stage update data." };
    }

    const res = await updateContactLifecycleStage(
      business.id,
      contactId,
      stageSlug,
      user.id,
      reason
    );

    safeRevalidatePath(`/workspace/${businessSlug}/crm`);
    safeRevalidatePath(`/workspace/${businessSlug}/crm/follow-ups`);
    return { success: true, contact: res.contact, history: res.history };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update contact lifecycle stage." };
  }
}

/**
 * 17. Bulk Update Contacts Lifecycle Stage
 */
export async function bulkUpdateStageAction(
  businessSlug: string,
  contactIds: string[],
  stageSlug: string,
  reason?: string
): Promise<BulkUpdateStageResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = BulkUpdateStageSchema.safeParse({ contactIds, stageSlug, reason });
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid bulk stage data." };
    }

    const res = await bulkUpdateContactsLifecycleStage(
      business.id,
      contactIds,
      stageSlug,
      user.id,
      reason
    );

    safeRevalidatePath(`/workspace/${businessSlug}/crm`);
    return { success: true, updatedCount: res.updatedCount, errors: res.errors };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to bulk update lifecycle stages." };
  }
}

/**
 * 18. Get Contact Lifecycle History
 */
export async function getContactLifecycleHistoryAction(
  businessSlug: string,
  contactId: string
): Promise<{ success: boolean; history?: ContactLifecycleHistory[]; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const history = await getContactLifecycleHistory(business.id, contactId);
    return { success: true, history };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load contact lifecycle history." };
  }
}

/**
 * 19. Create Follow-up Task
 */
export async function createFollowUpAction(
  businessSlug: string,
  input: unknown
): Promise<FollowUpResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = CreateFollowUpSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid follow-up input data." };
    }

    const followUp = await createFollowUp(
      business.id,
      validated.data,
      { id: user.id, name: user.email }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/crm`);
    safeRevalidatePath(`/workspace/${businessSlug}/crm/follow-ups`);
    return { success: true, followUp };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create follow-up task." };
  }
}

/**
 * 20. Update Follow-up Task
 */
export async function updateFollowUpAction(
  businessSlug: string,
  followUpId: string,
  input: unknown
): Promise<FollowUpResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = UpdateFollowUpSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid update data." };
    }

    const followUp = await updateFollowUp(
      business.id,
      followUpId,
      validated.data,
      { id: user.id }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/crm/follow-ups`);
    return { success: true, followUp };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update follow-up task." };
  }
}

/**
 * 21. Complete Follow-up Task
 */
export async function completeFollowUpAction(
  businessSlug: string,
  followUpId: string,
  completionNotes?: string,
  updateStageSlug?: string
): Promise<FollowUpResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = CompleteFollowUpSchema.safeParse({ completionNotes, updateStageSlug });
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid completion data." };
    }

    const followUp = await completeFollowUp(
      business.id,
      followUpId,
      validated.data.completionNotes || undefined,
      { id: user.id, name: user.email }
    );

    // If updateStageSlug requested, update the contact's lifecycle stage
    if (validated.data.updateStageSlug && followUp.contact_id) {
      await updateContactLifecycleStage(
        business.id,
        followUp.contact_id,
        validated.data.updateStageSlug,
        user.id,
        `Stage transitioned upon completing follow-up: "${followUp.title}"`
      ).catch(() => {});
    }

    safeRevalidatePath(`/workspace/${businessSlug}/crm`);
    safeRevalidatePath(`/workspace/${businessSlug}/crm/follow-ups`);
    return { success: true, followUp };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to complete follow-up task." };
  }
}

/**
 * 22. Reschedule Follow-up Task
 */
export async function rescheduleFollowUpAction(
  businessSlug: string,
  followUpId: string,
  newDueAt: string,
  reason?: string
): Promise<FollowUpResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = RescheduleFollowUpSchema.safeParse({ newDueAt, reason });
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid reschedule data." };
    }

    const followUp = await rescheduleFollowUp(
      business.id,
      followUpId,
      validated.data.newDueAt,
      validated.data.reason || undefined,
      { id: user.id }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/crm/follow-ups`);
    return { success: true, followUp };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reschedule follow-up task." };
  }
}

/**
 * 23. Cancel Follow-up Task
 */
export async function cancelFollowUpAction(
  businessSlug: string,
  followUpId: string,
  reason?: string
): Promise<FollowUpResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted to mutate follow-ups or lifecycle stages." };
    }

    const validated = CancelFollowUpSchema.safeParse({ reason });
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid cancellation data." };
    }

    const followUp = await cancelFollowUp(
      business.id,
      followUpId,
      validated.data.reason || undefined,
      { id: user.id }
    );

    safeRevalidatePath(`/workspace/${businessSlug}/crm/follow-ups`);
    return { success: true, followUp };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel follow-up task." };
  }
}

/**
 * 24. List Follow-ups with Filters & Tabs
 */
export async function getFollowUpsAction(
  businessSlug: string,
  filters: FollowUpFilterOptions = {}
): Promise<FollowUpsListResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    // If tab is assigned_to_me and assignedTo not provided, default to active user
    const resolvedFilters = {
      ...filters,
      assignedTo: filters.tab === "assigned_to_me" && !filters.assignedTo ? user.id : filters.assignedTo,
    };

    const res = await getFollowUps(business.id, resolvedFilters);
    return { success: true, followUps: res.followUps, totalCount: res.totalCount };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load follow-up tasks." };
  }
}

/**
 * 25. Get Single Follow-up by ID
 */
export async function getFollowUpByIdAction(
  businessSlug: string,
  followUpId: string
): Promise<FollowUpResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const followUp = await getFollowUpById(business.id, followUpId);
    if (!followUp) {
      return { success: false, error: "Follow-up not found." };
    }
    return { success: true, followUp };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load follow-up." };
  }
}

/**
 * 26. Get Follow-up Metrics (Counters & Completion Rate)
 */
export async function getFollowUpMetricsAction(
  businessSlug: string
): Promise<FollowUpMetricsResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const metrics = await getFollowUpMetrics(business.id);
    return { success: true, metrics };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load follow-up metrics." };
  }
}

/**
 * 27. Get Internal User Reminders
 */
export async function getUserRemindersAction(
  businessSlug: string,
  unreadOnly = false
): Promise<RemindersListResult> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const reminders = await getUserReminders(business.id, user.id, unreadOnly);
    return { success: true, reminders };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load reminders." };
  }
}

/**
 * 28. Mark Reminder as Read
 */
export async function markReminderReadAction(
  businessSlug: string,
  reminderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership, user } = await validateBusinessAccess(businessSlug);
    if (!membership) {
      return { success: false, error: "Unauthorized." };
    }

    const marked = await markReminderRead(business.id, reminderId, user.id);
    return { success: marked };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark reminder as read." };
  }
}

/**
 * 29. Generate Follow-up Reminders (Internal trigger / cron / admin)
 */
export async function generateFollowUpRemindersAction(
  businessSlug: string
): Promise<{ success: boolean; generatedCount?: number; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Permission denied: viewer role is not permitted." };
    }

    const res = await generateFollowUpReminders(business.id);
    return { success: true, generatedCount: res.generatedCount };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate reminders." };
  }
}

/**
 * 30. Get CRM Customer Lifecycle Report
 */
export async function getCrmLifecycleReportAction(
  businessSlug: string
): Promise<LifecycleReportResult> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent", "viewer"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    const report = await getCrmLifecycleReport(business.id);
    return { success: true, report };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load CRM lifecycle report." };
  }
}

