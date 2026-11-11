import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant, VIVAHAM_BUSINESS_ID } from "@/lib/inbox/database";
import { normalizeShortcut } from "@/lib/inbox/slash-commands";
import { CannedResponse } from "@/types/database";

const mockCannedResponsesStore = new Map<string, CannedResponse>();
const initializedMockTenants = new Set<string>();

export function resetMockCannedResponsesStore(): void {
  mockCannedResponsesStore.clear();
  initializedMockTenants.clear();
}

/**
 * Business-specific default canned responses for local/offline & unmigrated fallback.
 */
export function getDefaultCannedResponses(
  businessId: string,
  businessSlug?: string
): CannedResponse[] {
  const isVivaham = businessId === VIVAHAM_BUSINESS_ID || businessSlug === "vivaham";
  const now = new Date().toISOString();

  if (isVivaham) {
    return [
      {
        id: `canned-vivaham-greeting-${businessId}`,
        business_id: businessId,
        shortcut: "greeting",
        title: "Vanakkam Greeting",
        content:
          "Vanakkam! Welcome to Gokul Vivaham Tamil Matrimony. Please let us know if you are looking for a Bride or Groom profile.",
        category: "general",
        created_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: `canned-vivaham-plans-${businessId}`,
        business_id: businessId,
        shortcut: "plans",
        title: "Membership Plans",
        content:
          "Gokul Vivaham offers Silver, Gold, and Diamond assisted matchmaking plans with verified horoscope matching. Would you like our coordinator to call and explain?",
        category: "pricing",
        created_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: `canned-vivaham-register-${businessId}`,
        business_id: businessId,
        shortcut: "register",
        title: "New Profile Registration",
        content:
          "To register a new matrimony profile, please share:\n1. Candidate Name & Gender\n2. Date, Time & Place of Birth\n3. Education & Occupation\n4. Preferred Star / Community",
        category: "intake",
        created_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: `canned-vivaham-verify-${businessId}`,
        business_id: businessId,
        shortcut: "verify",
        title: "Profile Verification Steps",
        content:
          "Thank you for submitting your profile! Our verification team reviews ID proof and family details within 24 hours before activating your profile.",
        category: "verification",
        created_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: `canned-vivaham-hours-${businessId}`,
        business_id: businessId,
        shortcut: "hours",
        title: "Member Desk Hours",
        content: "Gokul Vivaham Member Desk is open Monday to Saturday, 9:30 AM - 6:30 PM IST.",
        category: "info",
        created_by: null,
        created_at: now,
        updated_at: now,
      },
    ];
  }

  return [
    {
      id: `canned-astro-greeting-${businessId}`,
      business_id: businessId,
      shortcut: "greeting",
      title: "Namaste Greeting",
      content:
        "Namaste! Welcome to Gokul's Astrological Insights. How may we assist you with your horoscope or consultation today?",
      category: "general",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `canned-astro-pricing-${businessId}`,
      business_id: businessId,
      shortcut: "pricing",
      title: "Consultation Fee Details",
      content:
        "Our Vedic & KP Astrology consultation fee is Rs. 1,500 (detailed chart reading + remedies). Reply to confirm your preferred slot!",
      category: "pricing",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `canned-astro-bank-${businessId}`,
      business_id: businessId,
      shortcut: "bank",
      title: "Payment / UPI Details",
      content:
        "You can complete your consultation payment via UPI or Bank Transfer. Please share the payment screenshot here once completed for immediate confirmation.",
      category: "billing",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `canned-astro-hours-${businessId}`,
      business_id: businessId,
      shortcut: "hours",
      title: "Consultation Hours",
      content:
        "Our consultation hours are Monday to Saturday, 9:30 AM - 7:00 PM IST. Let us know your preferred time slot.",
      category: "info",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `canned-astro-birthdetails-${businessId}`,
      business_id: businessId,
      shortcut: "birthdetails",
      title: "Required Birth Details",
      content:
        "To prepare your birth chart accurately, please share:\n1. Full Name\n2. Date of Birth\n3. Exact Time of Birth (AM/PM)\n4. Place of Birth",
      category: "intake",
      created_by: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

function ensureMockTenantSeeded(businessId: string, businessSlug?: string): void {
  if (initializedMockTenants.has(businessId)) return;
  initializedMockTenants.add(businessId);
  for (const item of getDefaultCannedResponses(businessId, businessSlug)) {
    mockCannedResponsesStore.set(item.id, item);
  }
}

function isMissingTableError(error: any): boolean {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

async function resolveSupabaseClient(client?: any) {
  if (client) return client;
  if (!isSupabaseConfigured()) return null;
  try {
    return await createServerSupabaseClient();
  } catch {
    return null;
  }
}

export async function listCannedResponsesDb(
  businessId: string,
  options: {
    businessSlug?: string;
    search?: string;
    category?: string;
    client?: any;
  } = {}
): Promise<CannedResponse[]> {
  await validateTenant(businessId, { client: options.client });
  const supabase = await resolveSupabaseClient(options.client);

  if (supabase) {
    let query = supabase
      .from("wa_canned_responses")
      .select("*")
      .eq("business_id", businessId)
      .order("shortcut", { ascending: true });

    if (options.category && options.category !== "all") {
      query = query.eq("category", options.category);
    }

    const { data, error } = await query;

    if (!error && data) {
      let rows = (data as CannedResponse[]).filter((r) => r.business_id === businessId);
      if (options.search && options.search.trim()) {
        const q = options.search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r.shortcut.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.content.toLowerCase().includes(q)
        );
      }
      return rows;
    }

    if (error && !isMissingTableError(error)) {
      throw new Error(`Failed to fetch canned responses: ${error.message}`);
    }
  }

  ensureMockTenantSeeded(businessId, options.businessSlug);
  let items = Array.from(mockCannedResponsesStore.values()).filter(
    (r) => r.business_id === businessId
  );

  if (options.category && options.category !== "all") {
    items = items.filter((r) => r.category === options.category);
  }
  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    items = items.filter(
      (r) =>
        r.shortcut.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q)
    );
  }

  return items.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
}

export async function createCannedResponseDb(
  businessId: string,
  input: {
    shortcut: string;
    title: string;
    content: string;
    category?: string;
    createdBy?: string | null;
    businessSlug?: string;
  },
  client?: any
): Promise<CannedResponse> {
  await validateTenant(businessId, { client });

  const cleanShortcut = normalizeShortcut(input.shortcut);
  if (!cleanShortcut) {
    throw new Error("Shortcut must contain letters or numbers (e.g. pricing, hours).");
  }

  const cleanTitle = input.title.trim();
  const cleanContent = input.content.trim();
  const cleanCategory = (input.category || "general").trim().toLowerCase() || "general";
  const now = new Date().toISOString();

  const supabase = await resolveSupabaseClient(client);

  if (supabase) {
    const { data: existing } = await supabase
      .from("wa_canned_responses")
      .select("id")
      .eq("business_id", businessId)
      .eq("shortcut", cleanShortcut)
      .maybeSingle();

    if (existing) {
      throw new Error(`A quick reply with shortcut "/${cleanShortcut}" already exists.`);
    }

    const { data, error } = await supabase
      .from("wa_canned_responses")
      .insert({
        business_id: businessId,
        shortcut: cleanShortcut,
        title: cleanTitle,
        content: cleanContent,
        category: cleanCategory,
        created_by: input.createdBy || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (!error && data) {
      return data as CannedResponse;
    }

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message || "Failed to create canned response.");
    }
  }

  ensureMockTenantSeeded(businessId, input.businessSlug);
  for (const item of mockCannedResponsesStore.values()) {
    if (item.business_id === businessId && item.shortcut === cleanShortcut) {
      throw new Error(`A quick reply with shortcut "/${cleanShortcut}" already exists.`);
    }
  }

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `canned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const created: CannedResponse = {
    id,
    business_id: businessId,
    shortcut: cleanShortcut,
    title: cleanTitle,
    content: cleanContent,
    category: cleanCategory,
    created_by: input.createdBy || null,
    created_at: now,
    updated_at: now,
  };
  mockCannedResponsesStore.set(id, created);
  return created;
}

export async function updateCannedResponseDb(
  businessId: string,
  responseId: string,
  updates: {
    shortcut?: string;
    title?: string;
    content?: string;
    category?: string;
  },
  client?: any
): Promise<CannedResponse> {
  await validateTenant(businessId, { client });

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.shortcut !== undefined) {
    const cleanShortcut = normalizeShortcut(updates.shortcut);
    if (!cleanShortcut) {
      throw new Error("Shortcut must contain letters or numbers.");
    }
    patch.shortcut = cleanShortcut;
  }
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.content !== undefined) patch.content = updates.content.trim();
  if (updates.category !== undefined) {
    patch.category = updates.category.trim().toLowerCase() || "general";
  }

  const supabase = await resolveSupabaseClient(client);

  if (supabase) {
    if (patch.shortcut) {
      const { data: conflict } = await supabase
        .from("wa_canned_responses")
        .select("id")
        .eq("business_id", businessId)
        .eq("shortcut", patch.shortcut)
        .neq("id", responseId)
        .maybeSingle();

      if (conflict) {
        throw new Error(`Shortcut "/${patch.shortcut}" is already used by another quick reply.`);
      }
    }

    const { data, error } = await supabase
      .from("wa_canned_responses")
      .update(patch)
      .eq("id", responseId)
      .eq("business_id", businessId)
      .select()
      .maybeSingle();

    if (!error && data) {
      return data as CannedResponse;
    }

    if (!error && !data) {
      throw new Error("Canned response not found or access denied.");
    }

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message || "Failed to update canned response.");
    }
  }

  const existing = mockCannedResponsesStore.get(responseId);
  if (!existing || existing.business_id !== businessId) {
    throw new Error("Canned response not found or access denied.");
  }

  if (patch.shortcut) {
    for (const item of mockCannedResponsesStore.values()) {
      if (
        item.business_id === businessId &&
        item.id !== responseId &&
        item.shortcut === patch.shortcut
      ) {
        throw new Error(`Shortcut "/${patch.shortcut}" is already used by another quick reply.`);
      }
    }
  }

  const updated: CannedResponse = {
    ...existing,
    ...patch,
    business_id: businessId,
  };
  mockCannedResponsesStore.set(responseId, updated);
  return updated;
}

export async function deleteCannedResponseDb(
  businessId: string,
  responseId: string,
  client?: any
): Promise<{ success: boolean }> {
  await validateTenant(businessId, { client });

  const supabase = await resolveSupabaseClient(client);

  if (supabase) {
    const { data, error } = await supabase
      .from("wa_canned_responses")
      .delete()
      .eq("id", responseId)
      .eq("business_id", businessId)
      .select("id")
      .maybeSingle();

    if (!error && data) {
      return { success: true };
    }

    if (!error && !data) {
      throw new Error("Canned response not found or access denied.");
    }

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message || "Failed to delete canned response.");
    }
  }

  const existing = mockCannedResponsesStore.get(responseId);
  if (!existing || existing.business_id !== businessId) {
    throw new Error("Canned response not found or access denied.");
  }

  mockCannedResponsesStore.delete(responseId);
  return { success: true };
}
