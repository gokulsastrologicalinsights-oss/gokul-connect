"use server";

import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  createConnection,
  createConnectionDb,
  disconnectConnection,
  disconnectConnectionDb,
  getBusinessSettings,
  getBusinessSettingsDb,
  getConnectionsForBusiness,
  getConnectionsForBusinessDb,
  testConnection,
  testConnectionDb,
  TestConnectionResult,
  toggleConnectionEnabled,
  toggleConnectionEnabledDb,
  updateBusinessSettings,
  updateBusinessSettingsDb,
  updateConnection,
  updateConnectionDb,
} from "@/lib/connections/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  BusinessSettings,
  CreateWhatsAppConnectionInput,
  SafeWhatsAppConnection,
  UpdateBusinessSettingsInput,
  UpdateWhatsAppConnectionInput,
} from "@/types/database";
import { revalidatePath } from "next/cache";
import { rateLimitSensitiveAction } from "@/lib/rate-limit/rate-limiter";
import {
  CreateWhatsAppConnectionSchema,
  UpdateBusinessSettingsSchema,
  UpdateWhatsAppConnectionSchema,
} from "@/lib/validation/schemas";

/**
 * Fetch WhatsApp connections for a specific business workspace.
 * Server-side validated: Rejects if user does not have active membership.
 */
export async function getConnectionsAction(
  businessSlug: string
): Promise<{ success: boolean; data?: SafeWhatsAppConnection[]; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const connections = isSupabaseConfigured()
      ? await getConnectionsForBusinessDb(business.id)
      : getConnectionsForBusiness(business.id);
    return { success: true, data: connections };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load connections." };
  }
}

/**
 * Add a new WhatsApp connection to the business workspace.
 * Access token is securely stored server-side and never returned to the frontend.
 */
export async function createConnectionAction(
  businessSlug: string,
  input: CreateWhatsAppConnectionInput
): Promise<{ success: boolean; data?: SafeWhatsAppConnection; error?: string }> {
  try {
    const validatedInput = CreateWhatsAppConnectionSchema.parse(input);
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can configure WhatsApp connections.");
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "create_connection");
    if (!rateLimit.success) {
      throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before creating connections.`);
    }

    const created = isSupabaseConfigured()
      ? await createConnectionDb(business.id, validatedInput)
      : createConnection(business.id, validatedInput);
    revalidatePath(`/workspace/${businessSlug}/connections`);
    return { success: true, data: created };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add connection." };
  }
}

/**
 * Update an existing connection's display name or description.
 */
export async function updateConnectionAction(
  businessSlug: string,
  connectionId: string,
  updates: UpdateWhatsAppConnectionInput
): Promise<{ success: boolean; data?: SafeWhatsAppConnection; error?: string }> {
  try {
    const validatedUpdates = UpdateWhatsAppConnectionSchema.parse(updates);
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can modify connections.");
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "update_connection");
    if (!rateLimit.success) {
      throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before updating connections.`);
    }

    const updated = isSupabaseConfigured()
      ? await updateConnectionDb(business.id, connectionId, validatedUpdates)
      : updateConnection(business.id, connectionId, validatedUpdates);
    revalidatePath(`/workspace/${businessSlug}/connections`);
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update connection." };
  }
}

/**
 * Toggle enable / disable on a WhatsApp connection.
 */
export async function toggleConnectionAction(
  businessSlug: string,
  connectionId: string,
  isEnabled: boolean
): Promise<{ success: boolean; data?: SafeWhatsAppConnection; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can enable/disable connections.");
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "toggle_connection");
    if (!rateLimit.success) {
      throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before modifying connection status.`);
    }

    const updated = isSupabaseConfigured()
      ? await toggleConnectionEnabledDb(business.id, connectionId, isEnabled)
      : toggleConnectionEnabled(business.id, connectionId, isEnabled);
    revalidatePath(`/workspace/${businessSlug}/connections`);
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle connection status." };
  }
}

/**
 * Test a WhatsApp connection and retrieve server diagnostics.
 */
export async function testConnectionAction(
  businessSlug: string,
  connectionId: string
): Promise<{ success: boolean; result?: TestConnectionResult; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const result = isSupabaseConfigured()
      ? await testConnectionDb(business.id, connectionId)
      : testConnection(business.id, connectionId);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message || "Connection diagnostic failed." };
  }
}

/**
 * Disconnect (remove) a WhatsApp connection.
 */
export async function disconnectConnectionAction(
  businessSlug: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can disconnect numbers.");
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "disconnect_connection");
    if (!rateLimit.success) {
      throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before disconnecting connections.`);
    }

    if (isSupabaseConfigured()) {
      await disconnectConnectionDb(business.id, connectionId);
    } else {
      disconnectConnection(business.id, connectionId);
    }
    revalidatePath(`/workspace/${businessSlug}/connections`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to disconnect connection." };
  }
}

/**
 * Fetch business-isolated settings.
 */
export async function getBusinessSettingsAction(
  businessSlug: string
): Promise<{ success: boolean; data?: BusinessSettings; error?: string }> {
  try {
    const { business } = await validateBusinessAccess(businessSlug);
    const settings = isSupabaseConfigured()
      ? await getBusinessSettingsDb(business.id)
      : getBusinessSettings(business.id);
    return { success: true, data: settings };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load business settings." };
  }
}

/**
 * Update business-isolated settings.
 */
export async function updateBusinessSettingsAction(
  businessSlug: string,
  updates: UpdateBusinessSettingsInput
): Promise<{ success: boolean; data?: BusinessSettings; error?: string }> {
  try {
    const validatedUpdates = UpdateBusinessSettingsSchema.parse(updates) as UpdateBusinessSettingsInput;
    const { business, membership } = await validateBusinessAccess(businessSlug);

    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Only workspace owners and administrators can update settings.");
    }

    const rateLimit = rateLimitSensitiveAction(business.id, "update_settings");
    if (!rateLimit.success) {
      throw new Error(`Rate limit exceeded: Please wait ${rateLimit.retryAfterSeconds}s before updating settings.`);
    }

    const updated = isSupabaseConfigured()
      ? await updateBusinessSettingsDb(business.id, validatedUpdates)
      : updateBusinessSettings(business.id, validatedUpdates);
    revalidatePath(`/workspace/${businessSlug}/settings`);
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update business settings." };
  }
}
