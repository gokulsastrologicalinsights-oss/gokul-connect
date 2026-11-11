"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  deleteFlowDb,
  getFlowByIdDb,
  getFlowsForBusinessDb,
  saveFlowDb,
} from "@/lib/flows/database";
import { PREBUILT_FLOW_TEMPLATES } from "@/lib/flows/templates";
import { VisualFlow } from "@/types/flows";

/**
 * List all visual flows for a business workspace.
 */
export async function getFlowsAction(businessSlug: string) {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const flows = await getFlowsForBusinessDb(business.id, business.slug);
    return { success: true, data: flows };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load flows." };
  }
}

/**
 * Get a specific flow by ID.
 */
export async function getFlowByIdAction(businessSlug: string, flowId: string) {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const flow = await getFlowByIdDb(business.id, business.slug, flowId);
    if (!flow) {
      return { success: false, error: "Flow not found." };
    }
    return { success: true, data: flow };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load flow." };
  }
}

/**
 * Save or update a visual conversation flow.
 */
export async function saveFlowAction(
  businessSlug: string,
  flowData: Partial<VisualFlow> & { name: string }
) {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Insufficient permissions to edit flows." };
    }

    const saved = await saveFlowDb(business.id, business.slug, flowData);
    revalidatePath(`/workspace/${businessSlug}/flows`);
    return { success: true, data: saved };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save flow." };
  }
}

/**
 * Toggle a flow active/inactive.
 */
export async function toggleFlowStatusAction(
  businessSlug: string,
  flowId: string,
  isActive: boolean
) {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Only owners or admins can toggle flow status." };
    }

    const flow = await getFlowByIdDb(business.id, business.slug, flowId);
    if (!flow) {
      return { success: false, error: "Flow not found." };
    }

    const updated = await saveFlowDb(business.id, business.slug, {
      ...flow,
      is_active: isActive,
      status: isActive ? "published" : "draft",
    });

    revalidatePath(`/workspace/${businessSlug}/flows`);
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update flow status." };
  }
}

/**
 * Delete a visual flow.
 */
export async function deleteFlowAction(businessSlug: string, flowId: string) {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { success: false, error: "Only owners or admins can delete flows." };
    }

    await deleteFlowDb(business.id, flowId);
    revalidatePath(`/workspace/${businessSlug}/flows`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete flow." };
  }
}

/**
 * Load a prebuilt template into a business workspace as a new flow.
 */
export async function loadFlowTemplateAction(
  businessSlug: string,
  templateId: string
) {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);
    if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
      return { success: false, error: "Insufficient permissions to load templates." };
    }

    const template = PREBUILT_FLOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return { success: false, error: "Template not found." };
    }

    const newFlow = await saveFlowDb(business.id, business.slug, {
      name: `${template.name} (Copy)`,
      description: template.description,
      flow_type: template.flow_type,
      nodes: template.nodes,
      edges: template.edges,
      status: "draft",
      is_active: false,
    });

    revalidatePath(`/workspace/${businessSlug}/flows`);
    return { success: true, data: newFlow };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load flow template." };
  }
}
