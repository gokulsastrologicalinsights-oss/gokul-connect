"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  listTemplatesDb,
  getTemplateByIdDb,
  createDraftTemplateDb,
  updateDraftTemplateDb,
  archiveTemplateDb,
  deleteTemplateDb,
  syncConnectionTemplates,
} from "@/lib/templates/database";
import {
  WhatsAppMessageTemplate,
  TemplateDraftInput,
  TemplateListFilterOptions,
} from "@/lib/templates/types";

/**
 * List message templates for a business tenant
 */
export async function getTemplatesAction(
  businessSlug: string,
  options?: TemplateListFilterOptions
): Promise<{
  success: boolean;
  templates: WhatsAppMessageTemplate[];
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const templates = await listTemplatesDb(business.id, options);
    return { success: true, templates };
  } catch (err: any) {
    return {
      success: false,
      templates: [],
      error: err.message || "Failed to load templates.",
    };
  }
}

/**
 * Get a specific template by ID
 */
export async function getTemplateByIdAction(
  businessSlug: string,
  templateId: string
): Promise<{
  success: boolean;
  template?: WhatsAppMessageTemplate | null;
  error?: string;
}> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const template = await getTemplateByIdDb(business.id, templateId);
    return { success: true, template };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch template.",
    };
  }
}

/**
 * Create or update a local draft template
 */
export async function saveDraftTemplateAction(
  businessSlug: string,
  draft: TemplateDraftInput,
  templateId?: string
): Promise<{
  success: boolean;
  template?: WhatsAppMessageTemplate;
  error?: string;
}> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Insufficient permissions." };
    }

    let result;
    if (templateId) {
      result = await updateDraftTemplateDb(business.id, templateId, draft);
    } else {
      result = await createDraftTemplateDb(business.id, draft);
    }

    if (result.success) {
      revalidatePath(`/workspace/${businessSlug}/templates`);
      revalidatePath(`/workspace/${businessSlug}/inbox`);
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to save draft template.",
    };
  }
}

/**
 * Archive or unarchive a template
 */
export async function archiveTemplateAction(
  businessSlug: string,
  templateId: string,
  isArchived: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Only managers can archive templates." };
    }

    const result = await archiveTemplateDb(business.id, templateId, isArchived);
    if (result.success) {
      revalidatePath(`/workspace/${businessSlug}/templates`);
    }
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to archive template.",
    };
  }
}

/**
 * Delete a draft template
 */
export async function deleteTemplateAction(
  businessSlug: string,
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Unauthorized: Only managers can delete draft templates." };
    }

    const result = await deleteTemplateDb(business.id, templateId);
    if (result.success) {
      revalidatePath(`/workspace/${businessSlug}/templates`);
    }
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete template.",
    };
  }
}

/**
 * Synchronize WhatsApp templates from Meta Cloud API
 */
export async function syncTemplatesAction(
  businessSlug: string,
  connectionId: string
): Promise<{
  success: boolean;
  count: number;
  added: number;
  updated: number;
  error?: string;
  requiresConnection?: boolean;
}> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return {
        success: false,
        count: 0,
        added: 0,
        updated: 0,
        error: "Unauthorized: Insufficient permissions to synchronize templates.",
      };
    }

    const result = await syncConnectionTemplates(business.id, connectionId);

    if (result.success) {
      revalidatePath(`/workspace/${businessSlug}/templates`);
      revalidatePath(`/workspace/${businessSlug}/inbox`);
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      added: 0,
      updated: 0,
      error: err.message || "Meta template synchronization failed.",
    };
  }
}
