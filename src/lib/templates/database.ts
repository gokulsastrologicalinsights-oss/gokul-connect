import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  WhatsAppMessageTemplate,
  TemplateDraftInput,
  TemplateListFilterOptions,
  TemplateStatus,
  TemplateCategory,
} from "./types";
import {
  validateTemplateDraft,
  buildComponentsFromDraft,
} from "./validation";
import { getDefaultBusinessTemplates } from "./default-templates";
import { MetaRawTemplate, fetchMetaTemplatesFromWaba } from "./meta-sync";
import { getDecryptedConnectionCredentials } from "@/lib/whatsapp/service";

/**
 * Validates tenant identity to enforce strict RLS and business boundary
 */
async function validateTenant(businessId: string, client?: any) {
  if (!businessId || typeof businessId !== "string" || !businessId.trim()) {
    throw new Error("Tenant isolation violation: businessId is strictly required.");
  }
}

/**
 * List message templates for a business tenant with optional search & filter criteria.
 * Independent template library per business tenant.
 */
export async function listTemplatesDb(
  businessId: string,
  options: TemplateListFilterOptions = {},
  client?: any
): Promise<WhatsAppMessageTemplate[]> {
  await validateTenant(businessId, client);

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  let query = supabase
    .from("wa_message_templates")
    .select("*")
    .eq("business_id", businessId);

  // Status Filter
  if (options.status && options.status !== "ALL") {
    query = query.eq("status", options.status);
  }

  // Category Filter
  if (options.category && options.category !== "ALL") {
    query = query.eq("category", options.category);
  }

  // Language Filter
  if (options.language && options.language !== "ALL") {
    query = query.eq("language", options.language);
  }

  // Connection Filter
  if (options.connectionId && options.connectionId !== "ALL") {
    query = query.or(
      `connection_id.is.null,connection_id.eq.${options.connectionId}`
    );
  }

  // Search Filter (template name)
  if (options.search && options.search.trim()) {
    query = query.ilike("template_name", `%${options.search.trim().toLowerCase()}%`);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  const dbTemplates = (!error && data) ? (data as WhatsAppMessageTemplate[]) : [];

  // Always merge isolated default templates for any templates not yet in DB
  const defaults = getDefaultBusinessTemplates(businessId);
  const dbKeys = new Set(dbTemplates.map((t) => `${t.template_name}__${t.language}`));
  const unseededDefaults = defaults.filter((d) => !dbKeys.has(`${d.template_name}__${d.language}`));

  let results = [...dbTemplates, ...unseededDefaults];

  // Apply in-memory filters to merged template collection
  if (options.category && options.category !== "ALL") {
    results = results.filter((t) => t.category === options.category);
  }
  if (options.status && options.status !== "ALL") {
    results = results.filter((t) => t.status === options.status);
  }
  if (options.language && options.language !== "ALL") {
    results = results.filter((t) => t.language === options.language);
  }
  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    results = results.filter((t) => t.template_name.toLowerCase().includes(q));
  }
  if (!options.includeArchived) {
    results = results.filter((t) => !t.is_archived && t.status !== "ARCHIVED");
  }

  return results;
}

/**
 * Retrieve a single template by ID for a specific business tenant.
 */
export async function getTemplateByIdDb(
  businessId: string,
  templateId: string,
  client?: any
): Promise<WhatsAppMessageTemplate | null> {
  await validateTenant(businessId, client);

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  const { data, error } = await supabase
    .from("wa_message_templates")
    .select("*")
    .eq("id", templateId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) {
    // Check default business templates
    const defaults = getDefaultBusinessTemplates(businessId);
    return defaults.find((t) => t.id === templateId) || null;
  }

  return data as WhatsAppMessageTemplate;
}

/**
 * Create a new local draft template for a business tenant.
 */
export async function createDraftTemplateDb(
  businessId: string,
  draft: TemplateDraftInput,
  client?: any
): Promise<{ success: boolean; template?: WhatsAppMessageTemplate; error?: string }> {
  await validateTenant(businessId, client);

  const validation = validateTemplateDraft(draft);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(" ") };
  }

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  const cleanName = draft.template_name.trim().toLowerCase();
  const cleanLang = draft.language.trim();
  const components = buildComponentsFromDraft(draft);

  // Check for duplicate name and language within this business tenant
  const { data: existing } = await supabase
    .from("wa_message_templates")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("template_name", cleanName)
    .eq("language", cleanLang)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `A template named "${cleanName}" with language "${cleanLang}" already exists for this business.`,
    };
  }

  const insertPayload = {
    business_id: businessId,
    connection_id: draft.connection_id || null,
    template_name: cleanName,
    language: cleanLang,
    category: draft.category,
    status: "DRAFT" as TemplateStatus,
    components,
    is_archived: false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("wa_message_templates")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message || "Failed to create draft template in database.",
    };
  }

  return { success: true, template: data as WhatsAppMessageTemplate };
}

/**
 * Update an existing local draft template.
 */
export async function updateDraftTemplateDb(
  businessId: string,
  templateId: string,
  draft: Partial<TemplateDraftInput>,
  client?: any
): Promise<{ success: boolean; template?: WhatsAppMessageTemplate; error?: string }> {
  await validateTenant(businessId, client);

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  // Ensure template exists, belongs to business, and is a draft
  const { data: current, error: fetchErr } = await supabase
    .from("wa_message_templates")
    .select("*")
    .eq("id", templateId)
    .eq("business_id", businessId)
    .single();

  if (fetchErr || !current) {
    return {
      success: false,
      error: "Template not found or access denied.",
    };
  }

  if (current.status !== "DRAFT") {
    return {
      success: false,
      error: `Only draft templates can be modified locally. This template has status "${current.status}".`,
    };
  }

  const mergedInput: TemplateDraftInput = {
    template_name: draft.template_name || current.template_name,
    category: draft.category || (current.category as TemplateCategory),
    language: draft.language || current.language,
    connection_id: draft.connection_id !== undefined ? draft.connection_id : current.connection_id,
    header_format: draft.header_format || "NONE",
    header_text: draft.header_text || "",
    body_text: draft.body_text || "",
    footer_text: draft.footer_text || "",
    buttons: draft.buttons || [],
  };

  const validation = validateTemplateDraft(mergedInput);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(" ") };
  }

  const components = buildComponentsFromDraft(mergedInput);

  const { data: updated, error: updateErr } = await supabase
    .from("wa_message_templates")
    .update({
      template_name: mergedInput.template_name.trim().toLowerCase(),
      category: mergedInput.category,
      language: mergedInput.language.trim(),
      connection_id: mergedInput.connection_id || null,
      components,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updateErr || !updated) {
    return {
      success: false,
      error: updateErr?.message || "Failed to update draft template.",
    };
  }

  return { success: true, template: updated as WhatsAppMessageTemplate };
}

/**
 * Archive or unarchive a template.
 */
export async function archiveTemplateDb(
  businessId: string,
  templateId: string,
  isArchived: boolean,
  client?: any
): Promise<{ success: boolean; error?: string }> {
  await validateTenant(businessId, client);

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  const updateFields: any = {
    is_archived: isArchived,
    updated_at: new Date().toISOString(),
  };

  if (isArchived) {
    updateFields.status = "ARCHIVED";
  } else {
    updateFields.status = "DRAFT";
  }

  const { error } = await supabase
    .from("wa_message_templates")
    .update(updateFields)
    .eq("id", templateId)
    .eq("business_id", businessId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a template (draft only).
 */
export async function deleteTemplateDb(
  businessId: string,
  templateId: string,
  client?: any
): Promise<{ success: boolean; error?: string }> {
  await validateTenant(businessId, client);

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  const { data: current, error: fetchErr } = await supabase
    .from("wa_message_templates")
    .select("id, status")
    .eq("id", templateId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (fetchErr || !current) {
    return { success: false, error: "Template not found or access denied." };
  }

  if (current.status !== "DRAFT" && current.status !== "ARCHIVED") {
    return {
      success: false,
      error: "Only draft or archived templates can be deleted locally.",
    };
  }

  const { error } = await supabase
    .from("wa_message_templates")
    .delete()
    .eq("id", templateId)
    .eq("business_id", businessId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Upsert Meta synchronized templates into database.
 * Requirement: Preserve local draft templates and prevent duplicates.
 */
export async function syncMetaTemplatesDb(
  businessId: string,
  connectionId: string | null,
  metaTemplates: MetaRawTemplate[],
  client?: any
): Promise<{ count: number; added: number; updated: number }> {
  await validateTenant(businessId, client);

  if (!metaTemplates || metaTemplates.length === 0) {
    return { count: 0, added: 0, updated: 0 };
  }

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const raw of metaTemplates) {
    const templateName = raw.name.toLowerCase();
    const language = raw.language;

    // Check existing template in database for this business
    const { data: existing } = await supabase
      .from("wa_message_templates")
      .select("id, status, is_archived")
      .eq("business_id", businessId)
      .eq("template_name", templateName)
      .eq("language", language)
      .maybeSingle();

    // Preserve local draft templates!
    if (existing && existing.status === "DRAFT") {
      continue;
    }

    const payload = {
      business_id: businessId,
      connection_id: connectionId,
      meta_template_id: raw.id,
      template_name: templateName,
      language: language,
      category: (raw.category?.toUpperCase() || "UTILITY") as TemplateCategory,
      status: (raw.status?.toUpperCase() || "APPROVED") as TemplateStatus,
      components: raw.components || [],
      rejection_reason: raw.rejected_reason || null,
      last_synced_at: now,
      updated_at: now,
    };

    if (existing) {
      await supabase
        .from("wa_message_templates")
        .update(payload)
        .eq("id", existing.id)
        .eq("business_id", businessId);
      updated++;
    } else {
      await supabase.from("wa_message_templates").insert(payload);
      added++;
    }
  }

  return { count: added + updated, added, updated };
}

/**
 * Execute Meta sync for a business connection
 */
export async function syncConnectionTemplates(
  businessId: string,
  connectionId: string,
  client?: any
): Promise<{
  success: boolean;
  count: number;
  added: number;
  updated: number;
  error?: string;
  requiresConnection?: boolean;
}> {
  await validateTenant(businessId, client);

  let supabase = client;
  if (!supabase) {
    supabase = await createServerSupabaseClient();
  }

  // 1. Fetch connection and check tenant isolation
  const { data: conn, error: connErr } = await supabase
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number_id, waba_id, connection_status")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();

  if (connErr || !conn) {
    return {
      success: false,
      count: 0,
      added: 0,
      updated: 0,
      error: "WhatsApp connection not found or cross-tenant access denied.",
    };
  }

  if (!conn.waba_id) {
    return {
      success: false,
      count: 0,
      added: 0,
      updated: 0,
      requiresConnection: true,
      error: "WABA ID is not configured on this WhatsApp connection.",
    };
  }

  // 2. Retrieve credentials safely
  let accessToken: string;
  try {
    const creds = await getDecryptedConnectionCredentials(businessId, connectionId, supabase);
    accessToken = creds.accessToken;
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      added: 0,
      updated: 0,
      requiresConnection: true,
      error: `Meta connection required: ${err.message || "Missing credentials in secure vault."}`,
    };
  }

  // 3. Fetch from Meta Cloud API
  try {
    const rawTemplates = await fetchMetaTemplatesFromWaba(conn.waba_id, accessToken);
    const syncRes = await syncMetaTemplatesDb(businessId, connectionId, rawTemplates, supabase);

    return {
      success: true,
      count: syncRes.count,
      added: syncRes.added,
      updated: syncRes.updated,
    };
  } catch (apiErr: any) {
    // If token expired or auth failed, present clear connection-required state
    const isAuthError =
      apiErr.code === 190 ||
      apiErr.message?.includes("OAuth") ||
      apiErr.message?.includes("expired") ||
      apiErr.message?.includes("token");

    return {
      success: false,
      count: 0,
      added: 0,
      updated: 0,
      requiresConnection: isAuthError,
      error: `Meta API Synchronization failed: ${apiErr.message}`,
    };
  }
}
