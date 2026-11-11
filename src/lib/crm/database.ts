import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant, ASTRO_BUSINESS_ID, VIVAHAM_BUSINESS_ID } from "@/lib/inbox/database";
import {
  CrmCategory,
  CrmContactFilter,
  CrmMetrics,
  CrmSegment,
  ContactActivityLog,
  ContactActivityType,
  ContactNote,
  ContactSource,
  ContactStatus,
  CsvContactImportRow,
  CsvImportValidationResult,
  WhatsAppContact,
} from "@/types/database";

/**
 * Standard Phone Number Normalizer for E.164 without leading plus
 * e.g. "+91 94445 59071" -> "919444559071"
 */
import {
  normalizePhoneNumber,
  parseAndValidateCsv,
  parseCsvLine,
} from "./csv-parser";

export { normalizePhoneNumber, parseAndValidateCsv, parseCsvLine };

/**
 * Default categories seeded per business
 */
export const DEFAULT_ASTRO_CATEGORIES: Array<Omit<CrmCategory, "id" | "business_id" | "created_at" | "updated_at">> = [
  { name: "New Enquiry", slug: "new-enquiry", color: "blue", description: "New incoming enquiry awaiting initial assessment", sort_order: 1, is_default: true },
  { name: "Astrology Consultation", slug: "astrology-consultation", color: "purple", description: "Personal astrology horoscope reading and consultation", sort_order: 2, is_default: false },
  { name: "Horoscope Matching", slug: "horoscope-matching", color: "amber", description: "Kundali / Porutham compatibility matching", sort_order: 3, is_default: false },
  { name: "Numerology", slug: "numerology", color: "emerald", description: "Name and date-of-birth numerology analysis", sort_order: 4, is_default: false },
  { name: "Existing Customer", slug: "existing-customer", color: "teal", description: "Verified repeat astrology customer", sort_order: 5, is_default: false },
  { name: "Follow-up Required", slug: "follow-up-required", color: "rose", description: "Pending follow-up or report delivery", sort_order: 6, is_default: false },
];

export const DEFAULT_VIVAHAM_CATEGORIES: Array<Omit<CrmCategory, "id" | "business_id" | "created_at" | "updated_at">> = [
  { name: "New Registration", slug: "new-registration", color: "blue", description: "Newly submitted matrimony registration", sort_order: 1, is_default: true },
  { name: "Groom", slug: "groom", color: "sky", description: "Groom matrimony profile candidate", sort_order: 2, is_default: false },
  { name: "Bride", slug: "bride", color: "pink", description: "Bride matrimony profile candidate", sort_order: 3, is_default: false },
  { name: "Membership Enquiry", slug: "membership-enquiry", color: "amber", description: "Matrimony plan or membership fee enquiry", sort_order: 4, is_default: false },
  { name: "Active Member", slug: "active-member", color: "emerald", description: "Active paid matrimonial service member", sort_order: 5, is_default: false },
  { name: "Follow-up Required", slug: "follow-up-required", color: "rose", description: "Pending document verification or family contact", sort_order: 6, is_default: false },
];

// In-memory mock store for unit testing and offline development
interface MockCrmStore {
  contacts: Map<string, WhatsAppContact>;
  notes: Map<string, ContactNote>;
  segments: Map<string, CrmSegment>;
  activityLogs: Map<string, ContactActivityLog>;
  categories: Map<string, CrmCategory>;
}

const mockStore: MockCrmStore = {
  contacts: new Map(),
  notes: new Map(),
  segments: new Map(),
  activityLogs: new Map(),
  categories: new Map(),
};

/**
 * Resets the in-memory mock store (for testing clean state)
 */
export function resetMockCrmStore(): void {
  mockStore.contacts.clear();
  mockStore.notes.clear();
  mockStore.segments.clear();
  mockStore.activityLogs.clear();
  mockStore.categories.clear();
}

/**
 * Maps database contact record ensuring both explicit columns and JSONB metadata fallback
 */
function mapContactRow(row: any): WhatsAppContact {
  const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata : {};
  return {
    id: row.id,
    business_id: row.business_id,
    phone_number: row.phone_number,
    display_name: row.display_name ?? null,
    profile_photo_url: row.profile_photo_url ?? null,
    email: row.email ?? meta.email ?? null,
    status: (row.status ?? meta.status ?? "lead") as ContactStatus,
    category: row.category ?? meta.category ?? null,
    source: (row.source ?? meta.source ?? "whatsapp") as ContactSource,
    is_archived: Boolean(row.is_archived ?? meta.is_archived ?? false),
    assigned_agent_id: row.assigned_agent_id ?? meta.assigned_agent_id ?? null,
    assigned_agent_name: row.assigned_agent_name ?? meta.assigned_agent_name ?? null,
    tags: Array.isArray(row.tags) ? row.tags : Array.isArray(meta.tags) ? meta.tags : [],
    custom_fields: (row.custom_fields && typeof row.custom_fields === "object") ? row.custom_fields : (meta.custom_fields ?? {}),
    metadata: meta,
    is_opted_out: Boolean(row.is_opted_out),
    opted_out_at: row.opted_out_at ?? null,
    opted_out_reason: row.opted_out_reason ?? null,
    last_welcome_sent_at: row.last_welcome_sent_at ?? null,
    last_inbound_at: row.last_inbound_at ?? null,
    total_inbound_count: Number(row.total_inbound_count ?? 0),
    lifecycle_stage_id: row.lifecycle_stage_id ?? meta.lifecycle_stage_id ?? null,
    lifecycle_stage_slug: row.lifecycle_stage_slug ?? meta.lifecycle_stage_slug ?? null,
    next_follow_up_at: row.next_follow_up_at ?? meta.next_follow_up_at ?? null,
    last_interaction_at: row.last_interaction_at ?? meta.last_interaction_at ?? null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Fetch contacts with search, filters, pagination, and multi-tenant isolation.
 */
export async function getCrmContactsDb(
  businessId: string,
  filter: CrmContactFilter = {},
  client?: any
): Promise<{ contacts: WhatsAppContact[]; totalCount: number; page: number; totalPages: number }> {
  await validateTenant(businessId, { client });

  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.max(1, Math.min(100, filter.limit ?? 20));
  const offset = (page - 1) * limit;

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    let query = supabase
      .from("wa_contacts")
      .select("*", { count: "exact" })
      .eq("business_id", businessId);

    // Filter archived (default: exclude archived unless explicitly requested)
    if (filter.is_archived !== undefined) {
      query = query.eq("is_archived", filter.is_archived);
    } else {
      query = query.eq("is_archived", false);
    }

    if (filter.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }

    if (filter.category && filter.category !== "all") {
      query = query.eq("category", filter.category);
    }

    if (filter.source && filter.source !== "all") {
      query = query.eq("source", filter.source);
    }

    if (filter.is_opted_out !== undefined) {
      query = query.eq("is_opted_out", filter.is_opted_out);
    }

    if (filter.tag && filter.tag !== "all") {
      query = query.contains("tags", [filter.tag]);
    }

    if (filter.lifecycle_stage && filter.lifecycle_stage !== "all") {
      query = query.eq("lifecycle_stage_slug", filter.lifecycle_stage);
    }

    if (filter.assigned_agent_id && filter.assigned_agent_id !== "all") {
      query = query.eq("assigned_agent_id", filter.assigned_agent_id);
    }

    if (filter.has_overdue_followups) {
      query = query.lt("next_follow_up_at", new Date().toISOString());
    }

    if (filter.has_upcoming_followups) {
      query = query.gte("next_follow_up_at", new Date().toISOString());
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim();
      query = query.or(`display_name.ilike.%${q}%,phone_number.ilike.%${q}%,email.ilike.%${q}%`);
    }

    query = query
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    let { data, count, error } = await query;

    if (error) {
      // Pre-migration schema fallback: query base wa_contacts columns and filter in memory
      let baseQuery = supabase
        .from("wa_contacts")
        .select("*", { count: "exact" })
        .eq("business_id", businessId);

      if (filter.is_opted_out !== undefined) {
        baseQuery = baseQuery.eq("is_opted_out", filter.is_opted_out);
      }

      baseQuery = baseQuery
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const baseRes = await baseQuery;
      if (!baseRes.error && baseRes.data) {
        data = baseRes.data;
        count = baseRes.count;
        error = null;
      }
    }

    if (!error && data) {
      let contacts: WhatsAppContact[] = data.map(mapContactRow);
      if (filter.is_archived !== undefined) {
        contacts = contacts.filter((c: WhatsAppContact) => Boolean(c.is_archived) === filter.is_archived);
      } else {
        contacts = contacts.filter((c: WhatsAppContact) => !c.is_archived);
      }
      if (filter.status && filter.status !== "all") {
        contacts = contacts.filter((c: WhatsAppContact) => c.status === filter.status);
      }
      if (filter.category && filter.category !== "all") {
        contacts = contacts.filter((c: WhatsAppContact) => c.category === filter.category);
      }
      if (filter.lifecycle_stage && filter.lifecycle_stage !== "all") {
        contacts = contacts.filter((c: WhatsAppContact) => c.lifecycle_stage_slug === filter.lifecycle_stage);
      }
      if (filter.assigned_agent_id && filter.assigned_agent_id !== "all") {
        contacts = contacts.filter((c: WhatsAppContact) => c.assigned_agent_id === filter.assigned_agent_id);
      }
      if (filter.has_overdue_followups) {
        const nowIso = new Date().toISOString();
        contacts = contacts.filter((c: WhatsAppContact) => Boolean(c.next_follow_up_at && c.next_follow_up_at < nowIso));
      }
      if (filter.has_upcoming_followups) {
        const nowIso = new Date().toISOString();
        contacts = contacts.filter((c: WhatsAppContact) => Boolean(c.next_follow_up_at && c.next_follow_up_at >= nowIso));
      }
      const totalCount = count ?? contacts.length;
      return {
        contacts,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit) || 1,
      };
    }
  }

  // Fallback to in-memory store
  let list = Array.from(mockStore.contacts.values()).filter(
    (c) => c.business_id === businessId
  );

  if (filter.is_archived !== undefined) {
    list = list.filter((c) => Boolean(c.is_archived) === filter.is_archived);
  } else {
    list = list.filter((c) => !c.is_archived);
  }

  if (filter.status && filter.status !== "all") {
    list = list.filter((c) => c.status === filter.status);
  }

  if (filter.category && filter.category !== "all") {
    list = list.filter((c) => c.category === filter.category);
  }

  if (filter.lifecycle_stage && filter.lifecycle_stage !== "all") {
    list = list.filter((c) => c.lifecycle_stage_slug === filter.lifecycle_stage);
  }

  if (filter.assigned_agent_id && filter.assigned_agent_id !== "all") {
    list = list.filter((c) => c.assigned_agent_id === filter.assigned_agent_id);
  }

  if (filter.has_overdue_followups) {
    const nowIso = new Date().toISOString();
    list = list.filter((c) => Boolean(c.next_follow_up_at && c.next_follow_up_at < nowIso));
  }

  if (filter.has_upcoming_followups) {
    const nowIso = new Date().toISOString();
    list = list.filter((c) => Boolean(c.next_follow_up_at && c.next_follow_up_at >= nowIso));
  }

  if (filter.source && filter.source !== "all") {
    list = list.filter((c) => c.source === filter.source);
  }

  if (filter.is_opted_out !== undefined) {
    list = list.filter((c) => Boolean(c.is_opted_out) === filter.is_opted_out);
  }

  if (filter.tag && filter.tag !== "all") {
    list = list.filter((c) => (c.tags || []).includes(filter.tag!));
  }

  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        (c.display_name?.toLowerCase() || "").includes(q) ||
        c.phone_number.includes(q) ||
        (c.email?.toLowerCase() || "").includes(q)
    );
  }

  list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const totalCount = list.length;
  const paginated = list.slice(offset, offset + limit);

  return {
    contacts: paginated,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}

/**
 * Fetch a single contact with notes, activity logs, and conversation history.
 */
export async function getCrmContactByIdDb(
  businessId: string,
  contactId: string,
  client?: any
): Promise<WhatsAppContact | null> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  let contact: WhatsAppContact | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("wa_contacts")
      .select("*")
      .eq("id", contactId)
      .eq("business_id", businessId)
      .single();

    if (!error && data) {
      contact = mapContactRow(data);
    }
  }

  if (!contact) {
    const cached = mockStore.contacts.get(contactId);
    if (cached && cached.business_id === businessId) {
      contact = { ...cached };
    }
  }

  if (!contact) return null;

  // Load notes
  contact.notes = await getContactNotesDb(businessId, contactId, client);

  // Load activity logs
  contact.activity_logs = await getContactActivityLogsDb(businessId, contactId, client);

  return contact;
}

/**
 * Create a new contact with duplicate detection within the same business.
 */
export async function createContactDb(
  businessId: string,
  input: {
    display_name: string;
    phone_number: string;
    email?: string | null;
    status?: ContactStatus;
    category?: string | null;
    source?: ContactSource;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
    assigned_agent_id?: string | null;
    assigned_agent_name?: string | null;
    note?: string;
  },
  client?: any
): Promise<WhatsAppContact> {
  await validateTenant(businessId, { client });

  const normalizedPhone = normalizePhoneNumber(input.phone_number);
  if (!normalizedPhone || normalizedPhone.length < 5) {
    throw new Error("Invalid WhatsApp phone number format. Minimum 5 digits required.");
  }

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  // 1. Duplicate detection within the same business
  if (supabase) {
    const { data: existing } = await supabase
      .from("wa_contacts")
      .select("id, phone_number, display_name")
      .eq("business_id", businessId)
      .eq("phone_number", normalizedPhone)
      .maybeSingle();

    if (existing) {
      throw new Error(`A contact with WhatsApp number "${normalizedPhone}" already exists in this business (${existing.display_name || "Existing Contact"}).`);
    }
  } else {
    for (const c of mockStore.contacts.values()) {
      if (c.business_id === businessId && c.phone_number === normalizedPhone) {
        throw new Error(`A contact with WhatsApp number "${normalizedPhone}" already exists in this business (${c.display_name || "Existing Contact"}).`);
      }
    }
  }

  const now = new Date().toISOString();
  const contactId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cnt-${Date.now()}`;

  const metadata: Record<string, unknown> = {
    email: input.email || null,
    status: input.status || "lead",
    category: input.category || null,
    source: input.source || "manual",
    is_archived: false,
    assigned_agent_id: input.assigned_agent_id || null,
    assigned_agent_name: input.assigned_agent_name || null,
    tags: input.tags || [],
    custom_fields: input.custom_fields || {},
  };

  const insertPayload = {
    id: contactId,
    business_id: businessId,
    phone_number: normalizedPhone,
    display_name: input.display_name.trim(),
    email: input.email?.trim() || null,
    status: input.status || "lead",
    category: input.category || null,
    source: input.source || "manual",
    is_archived: false,
    assigned_agent_id: input.assigned_agent_id || null,
    assigned_agent_name: input.assigned_agent_name || null,
    tags: input.tags || [],
    custom_fields: input.custom_fields || {},
    metadata,
    created_at: now,
    updated_at: now,
  };

  let createdContact: WhatsAppContact;

  if (supabase) {
    // Attempt insert with explicit columns, fall back to metadata if schema migration pending
    let { data, error } = await supabase
      .from("wa_contacts")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // Fallback for pre-migration schema: insert core columns only with rich metadata
      const corePayload = {
        id: contactId,
        business_id: businessId,
        phone_number: normalizedPhone,
        display_name: input.display_name.trim(),
        metadata,
        created_at: now,
        updated_at: now,
      };
      const res = await supabase.from("wa_contacts").insert(corePayload).select().single();
      if (res.error) {
        throw new Error(`Failed to create contact: ${res.error.message}`);
      }
      data = res.data;
    }
    createdContact = mapContactRow(data);
  } else {
    createdContact = mapContactRow(insertPayload);
    mockStore.contacts.set(contactId, createdContact);
  }

  // Log creation activity
  await logContactActivityDb(
    businessId,
    contactId,
    "created",
    "Contact Created",
    `Contact created via ${input.source || "manual"} entry.`,
    { source: input.source || "manual", status: input.status || "lead" },
    client
  );

  // Add initial note if provided
  if (input.note && input.note.trim()) {
    await addContactNoteDb(businessId, contactId, input.note.trim(), null, "Staff", client);
  }

  return createdContact;
}

/**
 * Update contact details.
 */
export async function updateContactDb(
  businessId: string,
  contactId: string,
  input: {
    display_name?: string;
    phone_number?: string;
    email?: string | null;
    status?: ContactStatus;
    category?: string | null;
    source?: ContactSource;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
    is_opted_out?: boolean;
    is_archived?: boolean;
  },
  client?: any
): Promise<WhatsAppContact> {
  await validateTenant(businessId, { client });

  const existing = await getCrmContactByIdDb(businessId, contactId, client);
  if (!existing) {
    throw new Error(`Contact not found for ID "${contactId}".`);
  }

  // If phone number is updated, check for duplicate within the same business
  let newPhone = existing.phone_number;
  if (input.phone_number) {
    newPhone = normalizePhoneNumber(input.phone_number);
    if (newPhone !== existing.phone_number) {
      const dupFilter = await getCrmContactsDb(businessId, { search: newPhone, limit: 10 }, client);
      const isDup = dupFilter.contacts.some((c) => c.id !== contactId && c.phone_number === newPhone);
      if (isDup) {
        throw new Error(`A contact with WhatsApp number "${newPhone}" already exists in this business.`);
      }
    }
  }

  const now = new Date().toISOString();
  const updatedMetadata: Record<string, unknown> = {
    ...existing.metadata,
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.custom_fields !== undefined ? { custom_fields: input.custom_fields } : {}),
    ...(input.is_archived !== undefined ? { is_archived: input.is_archived } : {}),
  };

  const updatePayload: Record<string, unknown> = {
    ...(input.display_name !== undefined ? { display_name: input.display_name.trim() } : {}),
    phone_number: newPhone,
    ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.custom_fields !== undefined ? { custom_fields: input.custom_fields } : {}),
    ...(input.is_opted_out !== undefined ? { is_opted_out: input.is_opted_out } : {}),
    ...(input.is_archived !== undefined ? { is_archived: input.is_archived } : {}),
    metadata: updatedMetadata,
    updated_at: now,
  };

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  let updatedContact: WhatsAppContact;

  if (supabase) {
    let { data, error } = await supabase
      .from("wa_contacts")
      .update(updatePayload)
      .eq("id", contactId)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      // Fallback update core columns only
      const coreUpdate: Record<string, unknown> = {
        ...(input.display_name !== undefined ? { display_name: input.display_name.trim() } : {}),
        phone_number: newPhone,
        ...(input.is_opted_out !== undefined ? { is_opted_out: input.is_opted_out } : {}),
        metadata: updatedMetadata,
        updated_at: now,
      };
      const res = await supabase
        .from("wa_contacts")
        .update(coreUpdate)
        .eq("id", contactId)
        .eq("business_id", businessId)
        .select()
        .single();
      if (res.error) {
        throw new Error(`Failed to update contact: ${res.error.message}`);
      }
      data = res.data;
    }
    updatedContact = mapContactRow(data);
  } else {
    updatedContact = {
      ...existing,
      ...updatePayload,
      display_name: input.display_name !== undefined ? input.display_name.trim() : existing.display_name,
      phone_number: newPhone,
      email: input.email !== undefined ? input.email?.trim() || null : existing.email,
      status: input.status !== undefined ? input.status : existing.status,
      category: input.category !== undefined ? input.category : existing.category,
      source: input.source !== undefined ? input.source : existing.source,
      tags: input.tags !== undefined ? input.tags : existing.tags,
      custom_fields: input.custom_fields !== undefined ? input.custom_fields : existing.custom_fields,
      is_opted_out: input.is_opted_out !== undefined ? input.is_opted_out : existing.is_opted_out,
      is_archived: input.is_archived !== undefined ? input.is_archived : existing.is_archived,
      metadata: updatedMetadata,
      updated_at: now,
    };
    mockStore.contacts.set(contactId, updatedContact);
  }

  // Log status change or update activity
  if (input.status && input.status !== existing.status) {
    await logContactActivityDb(
      businessId,
      contactId,
      "status_changed",
      "Status Changed",
      `Status changed from ${existing.status} to ${input.status}`,
      { oldStatus: existing.status, newStatus: input.status },
      client
    );
  } else if (input.category && input.category !== existing.category) {
    await logContactActivityDb(
      businessId,
      contactId,
      "category_changed",
      "Category Changed",
      `Category changed from "${existing.category || "None"}" to "${input.category}"`,
      { oldCategory: existing.category, newCategory: input.category },
      client
    );
  } else {
    await logContactActivityDb(
      businessId,
      contactId,
      "updated",
      "Contact Details Updated",
      "Profile information updated.",
      {},
      client
    );
  }

  return updatedContact;
}

/**
 * Archive or unarchive contact.
 */
export async function archiveContactDb(
  businessId: string,
  contactId: string,
  archive: boolean = true,
  client?: any
): Promise<void> {
  await updateContactDb(businessId, contactId, { is_archived: archive }, client);
  await logContactActivityDb(
    businessId,
    contactId,
    archive ? "archived" : "unarchived",
    archive ? "Contact Archived" : "Contact Restored",
    archive ? "Contact archived from active view." : "Contact restored to active view.",
    {},
    client
  );
}

/**
 * Notes DB methods
 */
export async function getContactNotesDb(
  businessId: string,
  contactId: string,
  client?: any
): Promise<ContactNote[]> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("contact_notes")
      .select("*")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data;
    }
  }

  // Fallback to in-memory store (most recent first)
  return Array.from(mockStore.notes.values())
    .filter((n) => n.business_id === businessId && n.contact_id === contactId)
    .reverse();
}

export async function addContactNoteDb(
  businessId: string,
  contactId: string,
  noteText: string,
  authorId?: string | null,
  authorName: string = "Staff",
  client?: any
): Promise<ContactNote> {
  await validateTenant(businessId, { client });

  const now = new Date().toISOString();
  const noteId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}`;

  const payload: ContactNote = {
    id: noteId,
    business_id: businessId,
    contact_id: contactId,
    author_id: authorId || null,
    author_name: authorName,
    note: noteText.trim(),
    created_at: now,
    updated_at: now,
  };

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("contact_notes")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      await logContactActivityDb(
        businessId,
        contactId,
        "note_added",
        "Note Added",
        noteText.length > 50 ? `${noteText.substring(0, 50)}...` : noteText,
        { author: authorName },
        client
      );
      return data;
    }
  }

  mockStore.notes.set(noteId, payload);
  await logContactActivityDb(
    businessId,
    contactId,
    "note_added",
    "Note Added",
    noteText.length > 50 ? `${noteText.substring(0, 50)}...` : noteText,
    { author: authorName },
    client
  );
  return payload;
}

/**
 * Activity Logs DB methods
 */
export async function getContactActivityLogsDb(
  businessId: string,
  contactId: string,
  client?: any
): Promise<ContactActivityLog[]> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("contact_activity_logs")
      .select("*")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data;
    }
  }

  // Fallback to in-memory store
  return Array.from(mockStore.activityLogs.values())
    .filter((a) => a.business_id === businessId && a.contact_id === contactId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function logContactActivityDb(
  businessId: string,
  contactId: string,
  activityType: ContactActivityType,
  title: string,
  description?: string,
  metadata: Record<string, unknown> = {},
  client?: any
): Promise<ContactActivityLog> {
  const now = new Date().toISOString();
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}`;

  const payload: ContactActivityLog = {
    id,
    business_id: businessId,
    contact_id: contactId,
    activity_type: activityType,
    title,
    description: description || null,
    metadata,
    created_at: now,
  };

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("contact_activity_logs")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return data;
    }
  }

  mockStore.activityLogs.set(id, payload);
  return payload;
}

/**
 * Configurable Categories DB methods
 */
export async function getCrmCategoriesDb(businessId: string, client?: any): Promise<CrmCategory[]> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_categories")
      .select("*")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
  }

  // In-memory or default seeds
  const mockCats = Array.from(mockStore.categories.values()).filter(
    (c) => c.business_id === businessId
  );
  if (mockCats.length > 0) {
    return mockCats.sort((a, b) => a.sort_order - b.sort_order);
  }

  // Return default seeded categories for the business
  const defaults = businessId === VIVAHAM_BUSINESS_ID ? DEFAULT_VIVAHAM_CATEGORIES : DEFAULT_ASTRO_CATEGORIES;
  return defaults.map((d, idx) => ({
    ...d,
    id: `cat-${businessId}-${d.slug}`,
    business_id: businessId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

export async function createCrmCategoryDb(
  businessId: string,
  input: {
    name: string;
    slug: string;
    color?: string;
    description?: string | null;
    sort_order?: number;
    is_default?: boolean;
  },
  client?: any
): Promise<CrmCategory> {
  await validateTenant(businessId, { client });

  const now = new Date().toISOString();
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`;

  const payload: CrmCategory = {
    id,
    business_id: businessId,
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    color: input.color || "indigo",
    description: input.description || null,
    sort_order: input.sort_order ?? 0,
    is_default: Boolean(input.is_default),
    created_at: now,
    updated_at: now,
  };

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_categories")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return data;
    }
    if (error) {
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  mockStore.categories.set(id, payload);
  return payload;
}

/**
 * Saved Segments DB methods
 */
export async function getCrmSegmentsDb(businessId: string, client?: any): Promise<CrmSegment[]> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_segments")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data;
    }
  }

  return Array.from(mockStore.segments.values())
    .filter((s) => s.business_id === businessId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createCrmSegmentDb(
  businessId: string,
  input: {
    name: string;
    description?: string | null;
    filters: Record<string, unknown>;
  },
  client?: any
): Promise<CrmSegment> {
  await validateTenant(businessId, { client });

  const now = new Date().toISOString();
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `seg-${Date.now()}`;

  const payload: CrmSegment = {
    id,
    business_id: businessId,
    name: input.name.trim(),
    description: input.description || null,
    filters: input.filters,
    is_system: false,
    created_at: now,
    updated_at: now,
  };

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("crm_segments")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return data;
    }
    if (error) {
      throw new Error(`Failed to save segment: ${error.message}`);
    }
  }

  mockStore.segments.set(id, payload);
  return payload;
}

export async function deleteCrmSegmentDb(
  businessId: string,
  segmentId: string,
  client?: any
): Promise<void> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    await supabase
      .from("crm_segments")
      .delete()
      .eq("id", segmentId)
      .eq("business_id", businessId);
  }

  mockStore.segments.delete(segmentId);
}

/**
 * Evaluates segment filters in-memory over contacts
 */
export function filterContactsBySegmentFilters(
  contacts: WhatsAppContact[],
  filters: Record<string, any>
): WhatsAppContact[] {
  if (!filters || Object.keys(filters).length === 0) return contacts;

  return contacts.filter((c) => {
    // 1. Status
    if (filters.status && filters.status !== "all" && c.status !== filters.status) {
      return false;
    }

    // 2. Category
    if (filters.category && filters.category !== "all" && c.category !== filters.category) {
      return false;
    }

    // 3. Lifecycle stage
    if (filters.lifecycle_stage && filters.lifecycle_stage !== "all" && c.lifecycle_stage_slug !== filters.lifecycle_stage) {
      return false;
    }

    // 4. Assigned team member
    if (filters.assigned_agent_id && filters.assigned_agent_id !== "all" && c.assigned_agent_id !== filters.assigned_agent_id) {
      return false;
    }

    // 5. Follow-up status
    const nowIso = new Date().toISOString();
    if (filters.has_overdue_followups && (!c.next_follow_up_at || c.next_follow_up_at >= nowIso)) {
      return false;
    }
    if (filters.has_upcoming_followups && (!c.next_follow_up_at || c.next_follow_up_at < nowIso)) {
      return false;
    }

    // 6. Last interaction
    if (filters.last_interaction_days && filters.last_interaction_days > 0) {
      const threshold = Date.now() - filters.last_interaction_days * 24 * 60 * 60 * 1000;
      const lastInt = c.last_interaction_at || c.last_inbound_at || c.created_at;
      if (new Date(lastInt).getTime() < threshold) {
        return false;
      }
    }

    // 7. Consent status
    if (filters.consent_status && filters.consent_status !== "all" && c.consent_status !== filters.consent_status) {
      return false;
    }

    // 8. Opt-out
    if (filters.is_opted_out !== undefined && Boolean(c.is_opted_out) !== filters.is_opted_out) {
      return false;
    }

    // 9. Tags
    if (filters.tag && filters.tag !== "all" && !(c.tags || []).includes(filters.tag)) {
      return false;
    }

    // 10. Creation date range
    if (filters.created_date_from && new Date(c.created_at).getTime() < new Date(filters.created_date_from).getTime()) {
      return false;
    }
    if (filters.created_date_to && new Date(c.created_at).getTime() > new Date(filters.created_date_to).getTime()) {
      return false;
    }

    return true;
  });
}

/**
 * Fetch dynamic contacts belonging to a saved segment
 */
export async function getContactsForSegmentDb(
  businessId: string,
  segmentId: string,
  client?: any
): Promise<WhatsAppContact[]> {
  await validateTenant(businessId, { client });
  const segments = await getCrmSegmentsDb(businessId, client);
  const segment = segments.find((s) => s.id === segmentId);
  if (!segment) {
    throw new Error(`Segment with ID "${segmentId}" not found.`);
  }

  const { contacts } = await getCrmContactsDb(businessId, { limit: 1000 }, client);
  return filterContactsBySegmentFilters(contacts, segment.filters || {});
}

/**
 * Calculate CRM summary metrics.
 */
export async function getCrmDashboardMetricsDb(
  businessId: string,
  client?: any
): Promise<CrmMetrics> {
  await validateTenant(businessId, { client });

  const allContactsRes = await getCrmContactsDb(businessId, { limit: 1000 }, client);
  const contacts = allContactsRes.contacts;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let leads = 0;
  let activeCustomers = 0;
  let inactive = 0;
  let optedOut = 0;
  let newThisMonth = 0;

  for (const c of contacts) {
    if (c.is_opted_out) optedOut++;
    if (c.status === "lead") leads++;
    else if (c.status === "active" || c.status === "customer") activeCustomers++;
    else if (c.status === "inactive") inactive++;

    if (new Date(c.created_at).getTime() >= startOfMonth) {
      newThisMonth++;
    }
  }

  return {
    totalContacts: contacts.length,
    leads,
    activeCustomers,
    inactive,
    optedOut,
    newThisMonth,
  };
}

/**
 * Batch import contacts with duplicate detection within the same business.
 */
export async function bulkImportContactsDb(
  businessId: string,
  rows: CsvContactImportRow[],
  client?: any
): Promise<{ importedCount: number; duplicateCount: number; errors: Array<{ phone: string; error: string }> }> {
  await validateTenant(businessId, { client });

  let importedCount = 0;
  let duplicateCount = 0;
  const errors: Array<{ phone: string; error: string }> = [];

  for (const row of rows) {
    try {
      await createContactDb(
        businessId,
        {
          display_name: row.name,
          phone_number: row.phone,
          email: row.email || null,
          category: row.category || null,
          status: row.status || "lead",
          source: row.source || "csv_import",
          tags: row.tags || ["csv-import"],
          note: row.notes,
        },
        client
      );
      importedCount++;
    } catch (err: any) {
      if (err.message && err.message.includes("already exists")) {
        duplicateCount++;
      } else {
        errors.push({ phone: row.phone, error: err.message || "Failed to import" });
      }
    }
  }

  return { importedCount, duplicateCount, errors };
}

/**
 * Open contact in WhatsApp Inbox:
 * Finds an existing conversation or creates one if needed.
 */
export async function getOrCreateConversationForContactDb(
  businessId: string,
  contactId: string,
  optionsOrClient?: { connectionId?: string; client?: any } | any
): Promise<{ conversationId: string; connectionId?: string }> {
  // Support both (businessId, contactId, client) and (businessId, contactId, { connectionId, client })
  let connectionId: string | undefined;
  let client: any;

  if (optionsOrClient && typeof optionsOrClient === "object" && ("connectionId" in optionsOrClient || "client" in optionsOrClient)) {
    connectionId = optionsOrClient.connectionId;
    client = optionsOrClient.client;
  } else {
    client = optionsOrClient;
  }

  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  if (supabase) {
    // 0. If connectionId is explicitly supplied, reject cross-business connection mismatches
    let targetConnectionId = connectionId;
    if (targetConnectionId) {
      const { data: connCheck, error: connCheckErr } = await supabase
        .from("wa_connections")
        .select("id, business_id, is_enabled")
        .eq("id", targetConnectionId)
        .maybeSingle();

      if (connCheckErr || !connCheck || connCheck.business_id !== businessId) {
        throw new Error(
          `Cross-business connection violation: WhatsApp connection "${targetConnectionId}" does not belong to business "${businessId}".`
        );
      }
    }

    // 1. Connection-aware conversation lookup
    let query = supabase
      .from("wa_conversations")
      .select("id, connection_id")
      .eq("business_id", businessId)
      .eq("contact_id", contactId);

    if (targetConnectionId) {
      query = query.eq("connection_id", targetConnectionId);
    } else {
      query = query.order("last_message_at", { ascending: false, nullsFirst: false });
    }

    const { data: convs, error: fetchErr } = await query.limit(1);
    const existingConv = !fetchErr && convs && convs.length > 0 ? convs[0] : null;

    if (existingConv) {
      return { conversationId: existingConv.id, connectionId: existingConv.connection_id };
    }

    // 2. If no connection was provided, resolve default or active connection for this business
    if (!targetConnectionId) {
      const { data: conn } = await supabase
        .from("wa_connections")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_enabled", true)
        .limit(1)
        .maybeSingle();

      if (!conn) {
        throw new Error("No active WhatsApp connection configured for this business. Please configure one in WhatsApp Connections.");
      }
      targetConnectionId = conn.id;
    }

    // 3. Create new conversation bound to the specific connection and contact
    const newConvId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `conv-${Date.now()}`;
    const { data: created, error } = await supabase
      .from("wa_conversations")
      .upsert(
        {
          id: newConvId,
          business_id: businessId,
          connection_id: targetConnectionId,
          contact_id: contactId,
          status: "open",
          unread_count: 0,
        },
        { onConflict: "connection_id, contact_id" }
      )
      .select("id")
      .single();

    if (error) {
      // If concurrent insert occurred, query for the existing record
      const { data: retryData } = await supabase
        .from("wa_conversations")
        .select("id")
        .eq("business_id", businessId)
        .eq("connection_id", targetConnectionId)
        .eq("contact_id", contactId)
        .maybeSingle();

      if (retryData) {
        return { conversationId: retryData.id, connectionId: targetConnectionId };
      }
      throw new Error(`Failed to initialize conversation for contact: ${error.message}`);
    }

    return { conversationId: created.id, connectionId: targetConnectionId };
  }

  // Mock / offline fallback
  const suffix = connectionId ? `-${connectionId}` : "";
  return { conversationId: `mock-conv-${contactId}${suffix}`, connectionId: connectionId || "mock-conn-01" };
}

/**
 * Escapes a single CSV value, neutralizing formula injection vectors (=, +, -, @)
 */
export function escapeCsvValue(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let s = String(val);
  const trimmed = s.trimStart();
  if (trimmed.length > 0) {
    const first = trimmed[0];
    if (first === "=" || first === "@" || first === "\t" || first === "\r") {
      s = "'" + s;
    } else if (first === "+" || first === "-") {
      const isPureNumber = /^[+-]?\d+(\.\d+)?$/.test(trimmed);
      const isStandardPhone = /^\+\d[\d\s\-()]{6,16}$/.test(trimmed);
      if (!isPureNumber && !isStandardPhone) {
        s = "'" + s;
      }
    }
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export const escapeCsv = escapeCsvValue;

/**
 * Generate RFC 4180 CSV with UTF-8 BOM
 */
export function exportContactsToCsvString(contacts: WhatsAppContact[]): string {
  const headers = [
    "Contact Name",
    "WhatsApp Number",
    "Email",
    "Status",
    "Category",
    "Source",
    "Tags",
    "Opt Out",
    "Registration Date",
    "Last Inbound Interaction",
  ];

  const rows = contacts.map((c) => [
    escapeCsvValue(c.display_name || "Unknown"),
    escapeCsv(c.phone_number),
    escapeCsv(c.email || ""),
    escapeCsv(c.status || "lead"),
    escapeCsv(c.category || "Unassigned"),
    escapeCsv(c.source || "whatsapp"),
    escapeCsv((c.tags || []).join(", ")),
    escapeCsv(c.is_opted_out ? "Yes (Opted Out)" : "No (Opted In)"),
    escapeCsv(c.created_at ? new Date(c.created_at).toLocaleDateString() : ""),
    escapeCsv(c.last_inbound_at ? new Date(c.last_inbound_at).toLocaleString() : "None"),
  ]);

  // UTF-8 BOM (\uFEFF) ensures Excel renders Tamil/Unicode correctly
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  return csvContent;
}
