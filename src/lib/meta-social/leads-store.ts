import { validateBusinessTenant } from "@/lib/auth/tenant-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MetaSocialPlatform,
  MetaSocialEventType,
  MetaSocialEventStatus,
} from "./types";

export type MetaSocialLeadClassification =
  | "high_intent"
  | "new_enquiry"
  | "general"
  | "followup_needed";

export interface MetaSocialLead {
  id: string;
  business_id: string;
  connection_id: string;
  connection_name: string;
  platform: MetaSocialPlatform;
  event_type: MetaSocialEventType;
  meta_event_id: string;
  sender_id: string;
  sender_name?: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  content: string;
  matched_rule_id?: string | null;
  matched_rule_name?: string | null;
  matched_keyword?: string | null;
  processing_status: MetaSocialEventStatus;
  // Note: Migration 027 dedicated columns (public_reply_status, private_reply_status)
  // are projected deterministically from 026 schema (status, reply_type)
  public_reply_status: "replied" | "pending" | "failed" | "none" | "skipped";
  private_reply_status: "replied" | "pending" | "failed" | "none" | "skipped";
  reply_content?: string | null;
  lead_status: MetaSocialLeadClassification;
  created_at: string;
}

export interface SocialLeadFilters {
  platform?: "all" | "facebook" | "instagram";
  dateRange?: "all" | "today" | "7d" | "30d";
  processingStatus?: "all" | "received" | "processed" | "replied" | "failed" | "ignored";
  leadStatus?: "all" | "high_intent" | "new_enquiry" | "general" | "followup_needed";
  search?: string;
  limit?: number;
  offset?: number;
}

// High intent keyword dictionary for deterministic lead classification
const HIGH_INTENT_KEYWORDS = [
  "ஜாதகம்",
  "பொருத்தம்",
  "கட்டணம்",
  "விலை",
  "திருமணம்",
  "வரன்",
  "பெண் தேவை",
  "மாப்பிள்ளை தேவை",
  "horoscope",
  "astrology",
  "matching",
  "price",
  "fee",
  "cost",
  "matrimony",
  "bride",
  "groom",
  "register",
  "booking",
  "appointment",
  "consultation",
];

export function classifyLead(
  content: string,
  status: MetaSocialEventStatus,
  hasMatchedRule: boolean
): MetaSocialLeadClassification {
  if (status === "failed") return "followup_needed";
  const normalized = content.toLowerCase();
  const isHighIntent = HIGH_INTENT_KEYWORDS.some((kw) => normalized.includes(kw));

  if (isHighIntent || hasMatchedRule) {
    return status === "replied" ? "high_intent" : "new_enquiry";
  }

  return "general";
}

/**
 * Projects Migration 026 event row into unified lead representation.
 * Handles the absence of Migration 027 columns gracefully.
 */
export function projectEventToLead(
  event: any,
  connectionNameMap?: Map<string, string>,
  ruleNameMap?: Map<string, string>
): MetaSocialLead {
  const status: MetaSocialEventStatus = event.status || "received";
  const replyType = event.reply_type || "none";

  // Derive public & private reply statuses from 026 status and reply_type
  let pubStatus: "replied" | "pending" | "failed" | "none" | "skipped" = "none";
  let pvtStatus: "replied" | "pending" | "failed" | "none" | "skipped" = "none";

  if (status === "replied") {
    if (replyType === "comment_public_reply") {
      pubStatus = "replied";
      pvtStatus = "none";
    } else if (replyType === "comment_private_dm" || replyType === "dm_reply") {
      pubStatus = "none";
      pvtStatus = "replied";
    } else if (replyType === "both") {
      pubStatus = "replied";
      pvtStatus = "replied";
    }
  } else if (status === "failed") {
    pubStatus = "failed";
    pvtStatus = "failed";
  } else if (status === "received" || status === "processing") {
    pubStatus = "pending";
    pvtStatus = "pending";
  } else if (status === "ignored") {
    pubStatus = "skipped";
    pvtStatus = "skipped";
  }

  const connName =
    connectionNameMap?.get(event.connection_id) ||
    event.meta_social_connections?.account_name ||
    (event.platform === "instagram" ? "Instagram Business" : "Facebook Page");

  const ruleName =
    ruleNameMap?.get(event.matched_rule_id) ||
    event.meta_social_rules?.rule_name ||
    null;

  const leadClassification = classifyLead(
    event.content || "",
    status,
    Boolean(event.matched_rule_id)
  );

  return {
    id: event.id,
    business_id: event.business_id,
    connection_id: event.connection_id,
    connection_name: connName,
    platform: event.platform,
    event_type: event.event_type,
    meta_event_id: event.meta_event_id,
    sender_id: event.sender_id,
    sender_name: event.sender_name || null,
    post_id: event.post_id || null,
    comment_id: event.comment_id || null,
    content: event.content || "",
    matched_rule_id: event.matched_rule_id || null,
    matched_rule_name: ruleName,
    matched_keyword: event.metadata?.matched_keyword || null,
    processing_status: status,
    public_reply_status: pubStatus,
    private_reply_status: pvtStatus,
    reply_content: event.reply_content || null,
    lead_status: leadClassification,
    created_at: event.created_at,
  };
}

// ============================================================================
// IN-MEMORY LEADS STORE (Used for test isolation and fallback)
// ============================================================================
const memorySocialLeads = new Map<string, MetaSocialLead>();

export function resetMemoryLeadsStore(): void {
  memorySocialLeads.clear();
}

export function filterLeadsList(
  leads: MetaSocialLead[],
  filters: SocialLeadFilters
): MetaSocialLead[] {
  let filtered = [...leads];

  // 1. Platform filter
  if (filters.platform && filters.platform !== "all") {
    filtered = filtered.filter((l) => l.platform === filters.platform);
  }

  // 2. Processing status filter
  if (filters.processingStatus && filters.processingStatus !== "all") {
    filtered = filtered.filter((l) => l.processing_status === filters.processingStatus);
  }

  // 3. Lead status filter
  if (filters.leadStatus && filters.leadStatus !== "all") {
    filtered = filtered.filter((l) => l.lead_status === filters.leadStatus);
  }

  // 4. Date range filter
  if (filters.dateRange && filters.dateRange !== "all") {
    const now = Date.now();
    let cutoff = 0;
    if (filters.dateRange === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoff = d.getTime();
    } else if (filters.dateRange === "7d") {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (filters.dateRange === "30d") {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }
    filtered = filtered.filter((l) => new Date(l.created_at).getTime() >= cutoff);
  }

  // 5. Search filter
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        l.content.toLowerCase().includes(q) ||
        (l.sender_name && l.sender_name.toLowerCase().includes(q)) ||
        (l.matched_rule_name && l.matched_rule_name.toLowerCase().includes(q)) ||
        (l.matched_keyword && l.matched_keyword.toLowerCase().includes(q))
    );
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return filtered;
}

export function getSocialLeadsMemory(
  businessId: string,
  filters: SocialLeadFilters = {}
): { leads: MetaSocialLead[]; totalCount: number } {
  validateBusinessTenant(businessId);
  const tenantLeads: MetaSocialLead[] = [];
  for (const lead of memorySocialLeads.values()) {
    if (lead.business_id === businessId) {
      tenantLeads.push({ ...lead });
    }
  }

  const filtered = filterLeadsList(tenantLeads, filters);
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  const paged = filtered.slice(offset, offset + limit);

  return {
    leads: paged,
    totalCount: filtered.length,
  };
}

export function saveSocialLeadMemory(lead: MetaSocialLead): void {
  validateBusinessTenant(lead.business_id);
  memorySocialLeads.set(lead.id, lead);
}

// ============================================================================
// SUPABASE DATABASE METHODS (Migration 026 Schema Compatible)
// ============================================================================
export async function getSocialLeadsDb(
  businessId: string,
  filters: SocialLeadFilters = {}
): Promise<{ leads: MetaSocialLead[]; totalCount: number }> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  // Query events from Migration 026 table: meta_social_events
  let query = supabase
    .from("meta_social_events")
    .select(
      `
      id,
      business_id,
      connection_id,
      platform,
      event_type,
      meta_event_id,
      sender_id,
      sender_name,
      post_id,
      comment_id,
      parent_comment_id,
      content,
      status,
      matched_rule_id,
      reply_type,
      reply_content,
      error_message,
      created_at,
      meta_social_connections(account_name),
      meta_social_rules(rule_name)
    `,
      { count: "exact" }
    )
    .eq("business_id", businessId);

  // Platform filter
  if (filters.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }

  // Processing status filter
  if (filters.processingStatus && filters.processingStatus !== "all") {
    query = query.eq("status", filters.processingStatus);
  }

  // Date range filter
  if (filters.dateRange && filters.dateRange !== "all") {
    const now = Date.now();
    let cutoffDate: string | null = null;
    if (filters.dateRange === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoffDate = d.toISOString();
    } else if (filters.dateRange === "7d") {
      cutoffDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (filters.dateRange === "30d") {
      cutoffDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (cutoffDate) {
      query = query.gte("created_at", cutoffDate);
    }
  }

  query = query.order("created_at", { ascending: false });

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Database error fetching social leads: ${error.message}`);
  }

  const leads = (data || []).map((row: any) => projectEventToLead(row));

  // If search filter or leadStatus filter is applied in memory
  let filtered = leads;
  if (filters.leadStatus && filters.leadStatus !== "all") {
    filtered = filtered.filter((l) => l.lead_status === filters.leadStatus);
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        l.content.toLowerCase().includes(q) ||
        (l.sender_name && l.sender_name.toLowerCase().includes(q))
    );
  }

  return {
    leads: filtered,
    totalCount: count ?? filtered.length,
  };
}

// ============================================================================
// SAMPLE SEEDING FOR DEMONSTRATION & TESTING
// ============================================================================
export function seedSampleLeadsMemory(businessId: string, businessSlug: string): MetaSocialLead[] {
  validateBusinessTenant(businessId);
  const isAstrology = businessSlug === "astrology";
  const now = Date.now();

  const leads: MetaSocialLead[] = isAstrology
    ? [
        {
          id: `lead_astro_1_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: `conn_astro_ig_${businessId.slice(0, 8)}`,
          connection_name: "gokuls_astrology (Instagram)",
          platform: "instagram",
          event_type: "comment",
          meta_event_id: "ig_comment_1789123456",
          sender_id: "igsid_998124",
          sender_name: "Vignesh K.R.",
          post_id: "ig_post_88129",
          comment_id: "ig_comment_1789123456",
          content: "ஜாதகம் பார்க்க கட்டணம் எவ்வளவு? நேரடி ஆலோசனை கிடைக்குமா?",
          matched_rule_id: `seed_astro_rule_1_${businessId.slice(0, 8)}`,
          matched_rule_name: "Horoscope & Astrology Consultation",
          matched_keyword: "ஜாதகம்",
          processing_status: "replied",
          public_reply_status: "replied",
          private_reply_status: "replied",
          reply_content: "வணக்கம்! உங்கள் ஜாதக ஆலோசனை மற்றும் விவரங்கள் உங்கள் இன்பாக்ஸில் (DM) அனுப்பப்பட்டுள்ளன.",
          lead_status: "high_intent",
          created_at: new Date(now - 15 * 60 * 1000).toISOString(),
        },
        {
          id: `lead_astro_2_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: `conn_astro_fb_${businessId.slice(0, 8)}`,
          connection_name: "Gokul Astrological Insights (FB Page)",
          platform: "facebook",
          event_type: "comment",
          meta_event_id: "fb_comment_447812993",
          sender_id: "psid_771829",
          sender_name: "Dr. Anbarasu M.",
          post_id: "fb_post_3391",
          comment_id: "fb_comment_447812993",
          content: "Marriage matching horoscope consultation details please. திருமண பொருத்தம் தேவை.",
          matched_rule_id: `seed_astro_rule_1_${businessId.slice(0, 8)}`,
          matched_rule_name: "Horoscope & Astrology Consultation",
          matched_keyword: "திருமண பொருத்தம்",
          processing_status: "replied",
          public_reply_status: "replied",
          private_reply_status: "replied",
          reply_content: "Details sent to DM",
          lead_status: "high_intent",
          created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: `lead_astro_3_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: `conn_astro_ig_${businessId.slice(0, 8)}`,
          connection_name: "gokuls_astrology (Instagram)",
          platform: "instagram",
          event_type: "message",
          meta_event_id: "ig_mid_1109923",
          sender_id: "igsid_44901",
          sender_name: "Sangeetha Raman",
          content: "வணக்கம் சார், உங்கள் அலுவலக முகவரி எங்கே உள்ளது?",
          matched_rule_id: null,
          matched_rule_name: null,
          matched_keyword: null,
          processing_status: "received",
          public_reply_status: "none",
          private_reply_status: "pending",
          reply_content: null,
          lead_status: "new_enquiry",
          created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
        },
      ]
    : [
        {
          id: `lead_viv_1_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: `conn_viv_ig_${businessId.slice(0, 8)}`,
          connection_name: "gokul_vivaham (Instagram)",
          platform: "instagram",
          event_type: "comment",
          meta_event_id: "ig_comment_9918234",
          sender_id: "igsid_330129",
          sender_name: "Meenakshi Sundaram",
          post_id: "ig_post_7712",
          comment_id: "ig_comment_9918234",
          content: "வரன் பதிவு செய்ய என்ன செய்ய வேண்டும்? பெண் தேவை.",
          matched_rule_id: `seed_viv_rule_1_${businessId.slice(0, 8)}`,
          matched_rule_name: "Matrimony Registration & Match Search",
          matched_keyword: "பெண் தேவை",
          processing_status: "replied",
          public_reply_status: "replied",
          private_reply_status: "replied",
          reply_content: "வணக்கம்! கோகுல் விவாஹம் வரன் பதிவு மற்றும் விவரங்களை உங்கள் தனிப்பட்ட மெசேஜில் பகிர்ந்துள்ளோம்.",
          lead_status: "high_intent",
          created_at: new Date(now - 25 * 60 * 1000).toISOString(),
        },
        {
          id: `lead_viv_2_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: `conn_viv_fb_${businessId.slice(0, 8)}`,
          connection_name: "Gokul Vivaham Page (Facebook)",
          platform: "facebook",
          event_type: "comment",
          meta_event_id: "fb_comment_881923",
          sender_id: "psid_119283",
          sender_name: "Kalyani Raman",
          post_id: "fb_post_662",
          comment_id: "fb_comment_881923",
          content: "Looking for Iyer bride and groom matrimony plans. திருமணம் மற்றும் கட்டண விவரம்.",
          matched_rule_id: `seed_viv_rule_1_${businessId.slice(0, 8)}`,
          matched_rule_name: "Matrimony Registration & Match Search",
          matched_keyword: "திருமணம்",
          processing_status: "replied",
          public_reply_status: "replied",
          private_reply_status: "replied",
          reply_content: "Sent details to your DM",
          lead_status: "high_intent",
          created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        },
      ];

  for (const lead of leads) {
    memorySocialLeads.set(lead.id, lead);
  }

  return leads;
}
