import { validateBusinessTenant } from "@/lib/auth/tenant-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MetaSocialRule,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "./types";

export interface SaveSocialRuleInput {
  id?: string;
  connectionId?: string | null;
  platform: MetaSocialRulePlatform;
  targetType: MetaSocialRuleTarget;
  ruleName: string;
  description?: string | null;
  keywords: string[];
  matchType: MetaSocialMatchType;
  responseAction: MetaSocialResponseAction;
  predefinedReply: string;
  predefinedReplyTa?: string;
  predefinedReplyEn?: string;
  predefinedDm?: string | null;
  priority?: number;
  isActive?: boolean;
  stopProcessingOnMatch?: boolean;
}

export interface MetaSocialReplyTemplate {
  id: string;
  name: string;
  templateType: "public_comment" | "private_dm";
  platform: MetaSocialRulePlatform;
  content: string;
  language: "ta" | "en" | "both";
  description?: string;
  isDefault?: boolean;
}

// ============================================================================
// IN-MEMORY RULES STORE (Used for test isolation and fallback)
// ============================================================================
const memorySocialRules = new Map<string, MetaSocialRule>();

export function resetMemorySocialRulesStore(): void {
  memorySocialRules.clear();
}

export function getSocialRulesMemory(businessId: string): MetaSocialRule[] {
  validateBusinessTenant(businessId);
  const rules: MetaSocialRule[] = [];
  for (const rule of memorySocialRules.values()) {
    if (rule.business_id === businessId) {
      rules.push({ ...rule });
    }
  }
  return rules.sort((a, b) => a.priority - b.priority);
}

export function getSocialRuleByIdMemory(
  businessId: string,
  ruleId: string
): MetaSocialRule | null {
  validateBusinessTenant(businessId);
  const rule = memorySocialRules.get(ruleId);
  if (!rule || rule.business_id !== businessId) return null;
  return { ...rule };
}

export function saveSocialRuleMemory(
  businessId: string,
  input: SaveSocialRuleInput
): MetaSocialRule {
  validateBusinessTenant(businessId);

  if (!input.ruleName?.trim()) {
    throw new Error("Rule name is required.");
  }
  if (!input.predefinedReply?.trim()) {
    throw new Error("Predefined reply content is required.");
  }
  if (!Array.isArray(input.keywords) || input.keywords.length === 0) {
    if (input.matchType !== "any") {
      throw new Error("At least one keyword is required for non-wildcard rules.");
    }
  }

  // Prevent reusing public reply as private DM automatically
  if (
    input.responseAction === "both_public_and_private" &&
    input.predefinedDm &&
    input.predefinedDm.trim() === input.predefinedReply.trim()
  ) {
    throw new Error(
      "Public reply and Private DM must be distinct. Reusing a public reply as a private reply directly is prohibited."
    );
  }

  const now = new Date().toISOString();
  const ruleId = input.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const existing = input.id ? memorySocialRules.get(input.id) : null;

  if (existing && existing.business_id !== businessId) {
    throw new Error("Tenant mismatch: Cannot modify a rule belonging to another business.");
  }

  const cleanKeywords = Array.isArray(input.keywords)
    ? input.keywords.map((k) => k.trim()).filter(Boolean)
    : [];

  const finalPredefinedReply =
    input.predefinedReplyTa?.trim() && input.predefinedReplyEn?.trim()
      ? JSON.stringify({ ta: input.predefinedReplyTa.trim(), en: input.predefinedReplyEn.trim() })
      : input.predefinedReply.trim();

  const savedRule: MetaSocialRule = {
    id: ruleId,
    business_id: businessId,
    connection_id: input.connectionId || null,
    platform: input.platform,
    target_type: input.targetType,
    rule_name: input.ruleName.trim(),
    description: input.description?.trim() || null,
    keywords: cleanKeywords,
    match_type: input.matchType,
    response_action: input.responseAction,
    predefined_reply: finalPredefinedReply,
    predefined_dm: input.predefinedDm?.trim() || null,
    priority: typeof input.priority === "number" ? input.priority : 100,
    is_active: input.isActive !== undefined ? input.isActive : false,
    stop_processing_on_match:
      input.stopProcessingOnMatch !== undefined ? input.stopProcessingOnMatch : true,
    created_at: existing ? existing.created_at : now,
    updated_at: now,
  };

  memorySocialRules.set(ruleId, savedRule);
  return { ...savedRule };
}

export function toggleSocialRuleMemory(
  businessId: string,
  ruleId: string,
  isActive: boolean
): MetaSocialRule {
  validateBusinessTenant(businessId);
  const rule = memorySocialRules.get(ruleId);
  if (!rule || rule.business_id !== businessId) {
    throw new Error("Rule not found or tenant mismatch.");
  }

  rule.is_active = isActive;
  rule.updated_at = new Date().toISOString();
  memorySocialRules.set(ruleId, rule);
  return { ...rule };
}

export function deleteSocialRuleMemory(businessId: string, ruleId: string): boolean {
  validateBusinessTenant(businessId);
  const rule = memorySocialRules.get(ruleId);
  if (!rule || rule.business_id !== businessId) {
    throw new Error("Rule not found or tenant mismatch.");
  }

  return memorySocialRules.delete(ruleId);
}

// ============================================================================
// SUPABASE DATABASE METHODS (Migration 026 Schema Compatible)
// ============================================================================
export async function getSocialRulesDb(businessId: string): Promise<MetaSocialRule[]> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("meta_social_rules")
    .select("*")
    .eq("business_id", businessId)
    .order("priority", { ascending: true });

  if (error) {
    throw new Error(`Database error fetching social rules: ${error.message}`);
  }

  return data || [];
}

export async function getSocialRuleByIdDb(
  businessId: string,
  ruleId: string
): Promise<MetaSocialRule | null> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("meta_social_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("business_id", businessId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Database error fetching social rule: ${error.message}`);
  }

  return data;
}

export async function saveSocialRuleDb(
  businessId: string,
  input: SaveSocialRuleInput
): Promise<MetaSocialRule> {
  validateBusinessTenant(businessId);

  if (!input.ruleName?.trim()) {
    throw new Error("Rule name is required.");
  }
  if (!input.predefinedReply?.trim()) {
    throw new Error("Predefined reply content is required.");
  }
  if (!Array.isArray(input.keywords) || input.keywords.length === 0) {
    if (input.matchType !== "any") {
      throw new Error("At least one keyword is required for non-wildcard rules.");
    }
  }

  // Prevent reusing public reply as private DM automatically
  if (
    input.responseAction === "both_public_and_private" &&
    input.predefinedDm &&
    input.predefinedDm.trim() === input.predefinedReply.trim()
  ) {
    throw new Error(
      "Public reply and Private DM must be distinct. Reusing a public reply as a private reply directly is prohibited."
    );
  }

  const supabase = createAdminClient();
  const cleanKeywords = Array.isArray(input.keywords)
    ? input.keywords.map((k) => k.trim()).filter(Boolean)
    : [];

  const finalPredefinedReply =
    input.predefinedReplyTa?.trim() && input.predefinedReplyEn?.trim()
      ? JSON.stringify({ ta: input.predefinedReplyTa.trim(), en: input.predefinedReplyEn.trim() })
      : input.predefinedReply.trim();

  const payload = {
    business_id: businessId,
    connection_id: input.connectionId || null,
    platform: input.platform,
    target_type: input.targetType,
    rule_name: input.ruleName.trim(),
    description: input.description?.trim() || null,
    keywords: cleanKeywords,
    match_type: input.matchType,
    response_action: input.responseAction,
    predefined_reply: finalPredefinedReply,
    predefined_dm: input.predefinedDm?.trim() || null,
    priority: typeof input.priority === "number" ? input.priority : 100,
    is_active: input.isActive !== undefined ? input.isActive : false,
    stop_processing_on_match:
      input.stopProcessingOnMatch !== undefined ? input.stopProcessingOnMatch : true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("meta_social_rules")
      .update(payload)
      .eq("id", input.id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Database error updating social rule: ${error.message}`);
    }
    return data;
  } else {
    const { data, error } = await supabase
      .from("meta_social_rules")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Database error inserting social rule: ${error.message}`);
    }
    return data;
  }
}

export async function toggleSocialRuleDb(
  businessId: string,
  ruleId: string,
  isActive: boolean
): Promise<MetaSocialRule> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("meta_social_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Database error toggling rule: ${error.message}`);
  }
  return data;
}

export async function deleteSocialRuleDb(
  businessId: string,
  ruleId: string
): Promise<boolean> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("meta_social_rules")
    .delete()
    .eq("id", ruleId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Database error deleting rule: ${error.message}`);
  }
  return true;
}

// ============================================================================
// PRESET TEMPLATES & SAMPLE KEYWORDS (Tamil & English)
// ============================================================================
export function getPresetTemplates(businessSlug: string): {
  publicTemplates: MetaSocialReplyTemplate[];
  privateTemplates: MetaSocialReplyTemplate[];
} {
  const isAstrology = businessSlug === "astrology";

  if (isAstrology) {
    return {
      publicTemplates: [
        {
          id: "astro_pub_1",
          name: "Horoscope Acknowledgment (Tamil)",
          templateType: "public_comment",
          platform: "both",
          language: "ta",
          content:
            "வணக்கம்! உங்கள் ஜாதக ஆலோசனை மற்றும் கட்டண விவரங்களை உங்கள் இன்ஸ்டாகிராம் / முகநூல் இன்பாக்ஸில் (DM) அனுப்பியுள்ளோம். சரிபார்க்கவும்.",
          description: "Public response acknowledging horoscope / astrology comment",
          isDefault: true,
        },
        {
          id: "astro_pub_2",
          name: "Consultation Booking Acknowledgment (English)",
          templateType: "public_comment",
          platform: "both",
          language: "en",
          content:
            "Thank you for reaching out! We have sent complete horoscope consultation and appointment details directly to your inbox.",
          description: "English public acknowledgment for astrology enquiries",
        },
        {
          id: "astro_pub_3",
          name: "Marriage Matching Info (Bilingual)",
          templateType: "public_comment",
          platform: "both",
          language: "both",
          content:
            "வணக்கம்! திருமண பொருத்தம் மற்றும் ஜாதக கணிப்பு கட்டண விவரங்கள் உங்கள் DM-க்கு அனுப்பப்பட்டுள்ளது. Details sent to your inbox!",
          description: "Bilingual public comment reply for marriage matching",
        },
      ],
      privateTemplates: [
        {
          id: "astro_pvt_1",
          name: "Vedic & KP Horoscope Consultation Guide (Tamil)",
          templateType: "private_dm",
          platform: "both",
          language: "ta",
          content:
            "வணக்கம்! Gokul's Astrological Insights-க்கு தங்களை அன்புடன் வரவேற்கிறோம். எங்களின் ஜோதிட சேவைகள்:\n1. விரிவான பிறந்த ஜாதக கட்ட கணிப்பு\n2. திருமண பொருத்தம் & தோஷ நிவர்த்தி\n3. KP மற்றும் பிரசன்ன முறை ஆலோசனை\nஆலோசனை பெற உங்கள் பிறந்த தேதி, பிறந்த நேரம் மற்றும் பிறந்த இடத்தை இங்கே பகிரவும். கட்டண விவரங்கள்: ₹500 / ₹1000.",
          description: "Detailed private DM response for horoscope queries",
          isDefault: true,
        },
        {
          id: "astro_pvt_2",
          name: "Astrology Consultation Fee & Booking (English)",
          templateType: "private_dm",
          platform: "both",
          language: "en",
          content:
            "Hello! Welcome to Gokul's Astrological Insights. Our consultation services include Birth Chart Analysis, Marriage Compatibility, and Career Predictions. To book a phone or in-person consultation, please reply with your Date of Birth, Time of Birth, and Place of Birth.",
          description: "English private DM consultation details",
        },
      ],
    };
  }

  // Gokul Vivaham
  return {
    publicTemplates: [
      {
        id: "viv_pub_1",
        name: "Matrimony Registration Acknowledgment (Tamil)",
        templateType: "public_comment",
        platform: "both",
        language: "ta",
        content:
          "வணக்கம்! கோகுல் விவாஹம் வரன் பதிவு மற்றும் கட்டண விவரங்களை உங்கள் இன்ஸ்டாகிராம் / பேஸ்புக் மெசேஜில் (DM) அனுப்பியுள்ளோம். தயவுசெய்து பார்க்கவும்.",
        description: "Public response acknowledging matrimony registration comment",
        isDefault: true,
      },
      {
        id: "viv_pub_2",
        name: "Bride / Groom Enquiry Acknowledgment (English)",
        templateType: "public_comment",
        platform: "both",
        language: "en",
        content:
          "Thank you for contacting Gokul Vivaham! We have sent verified bride/groom registration details directly to your inbox.",
        description: "English public acknowledgment for matrimony queries",
      },
    ],
    privateTemplates: [
      {
        id: "viv_pvt_1",
        name: "Vivaham Profile Registration & Plans (Tamil)",
        templateType: "private_dm",
        platform: "both",
        language: "ta",
        content:
          "வணக்கம்! Gokul Vivaham வரன் சேவையில் தங்களை அன்புடன் வரவேற்கிறோம். ஆயிரக்கணக்கான சரிபார்க்கப்பட்ட வரன்களிலிருந்து உங்கள் குடும்பத்திற்கு ஏற்ற வரனை தேர்ந்தெடுக்கலாம்.\n1. இலவச சுயவிவர பதிவு\n2. பிரீமியம் மேட்சிங் பேக்கேஜ்\nபதிவு செய்ய அல்லது வரன் விவரங்கள் அறிய உங்கள் தொடர்பு எண் மற்றும் வரன் தேவையை இங்கே பகிரவும்.",
        description: "Detailed private DM response for matrimony enquiries",
        isDefault: true,
      },
      {
        id: "viv_pvt_2",
        name: "Matrimony Membership & Verification Guide (English)",
        templateType: "private_dm",
        platform: "both",
        language: "en",
        content:
          "Hello! Welcome to Gokul Vivaham Tamil Matrimony. To explore matching verified bride and groom profiles, please share your mobile number or click our registration link. Our matrimony team will connect with you within 24 hours.",
        description: "English private DM matrimony registration guide",
      },
    ],
  };
}

/**
 * Seed initial sample preset rules in memory for test or preview purposes.
 * Note: These are NOT automatically saved to production DB.
 */
export function seedPresetSocialRulesMemory(businessId: string, businessSlug: string): MetaSocialRule[] {
  validateBusinessTenant(businessId);
  const isAstrology = businessSlug === "astrology";
  const now = new Date().toISOString();

  const rules: MetaSocialRule[] = isAstrology
    ? [
        {
          id: `seed_astro_rule_1_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: null,
          platform: "both",
          target_type: "both",
          rule_name: "Horoscope & Astrology Consultation",
          description: "Matches Tamil and English keywords for horoscope consultations",
          keywords: [
            "ஜாதகம்",
            "ராசி பலன்",
            "திருமண பொருத்தம்",
            "horoscope",
            "astrology",
            "marriage matching",
          ],
          match_type: "contains",
          response_action: "both_public_and_private",
          predefined_reply:
            "வணக்கம்! உங்கள் ஜாதக ஆலோசனை மற்றும் விவரங்கள் உங்கள் இன்பாக்ஸில் (DM) அனுப்பப்பட்டுள்ளன.",
          predefined_dm:
            "வணக்கம்! Gokul's Astrological Insights-க்கு தங்களை அன்புடன் வரவேற்கிறோம். எங்களின் ஜாதகம் மற்றும் திருமண பொருத்த ஆலோசனை விவரங்கள் உங்கள் பார்வைக்கு அனுப்பப்பட்டுள்ளது. பிறந்த தேதி மற்றும் நேரத்தை இங்கே பகிரவும்.",
          priority: 10,
          is_active: true,
          stop_processing_on_match: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: `seed_astro_rule_2_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: null,
          platform: "both",
          target_type: "comment",
          rule_name: "Consultation Fee Enquiry",
          description: "Handles fee queries on comments with private DM",
          keywords: ["கட்டணம்", "fee", "cost", "price", "விலை"],
          match_type: "contains",
          response_action: "reply_comment_private_dm",
          predefined_reply: "Details sent to your DM",
          predefined_dm:
            "வணக்கம்! ஜோதிட ஆலோசனை கட்டணங்கள்: பொது ஜாதக கணிப்பு ₹500, திருமண பொருத்தம் ₹750. தொலைபேசி அல்லது நேரடி ஆலோசனைக்கு தொடர்பு கொள்ளவும்.",
          priority: 20,
          is_active: true,
          stop_processing_on_match: true,
          created_at: now,
          updated_at: now,
        },
      ]
    : [
        {
          id: `seed_viv_rule_1_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: null,
          platform: "both",
          target_type: "both",
          rule_name: "Matrimony Registration & Match Search",
          description: "Matches Tamil and English matrimony registration keywords",
          keywords: [
            "திருமணம்",
            "வரன்",
            "பெண் தேவை",
            "மாப்பிள்ளை தேவை",
            "matrimony",
            "bride",
            "groom",
          ],
          match_type: "contains",
          response_action: "both_public_and_private",
          predefined_reply:
            "வணக்கம்! கோகுல் விவாஹம் வரன் பதிவு மற்றும் விவரங்களை உங்கள் தனிப்பட்ட மெசேஜில் (DM) பகிர்ந்துள்ளோம்.",
          predefined_dm:
            "வணக்கம்! Gokul Vivaham வரன் சேவையில் தங்களை அன்புடன் வரவேற்கிறோம். பெண் தேவை / மாப்பிள்ளை தேவை விவரங்களை அறிய உங்கள் தொடர்பு எண்ணை இங்கே பகிரவும்.",
          priority: 10,
          is_active: true,
          stop_processing_on_match: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: `seed_viv_rule_2_${businessId.slice(0, 8)}`,
          business_id: businessId,
          connection_id: null,
          platform: "both",
          target_type: "comment",
          rule_name: "Membership Package Enquiry",
          description: "Private reply for membership and registration cost",
          keywords: ["membership", "பதிவு", "கட்டணம்", "plan", "register"],
          match_type: "contains",
          response_action: "reply_comment_private_dm",
          predefined_reply: "Sent registration guide to DM",
          predefined_dm:
            "வணக்கம்! Gokul Vivaham உறுப்பினர் திட்டங்கள்: Silver, Gold மற்றும் VIP Assisted. பதிவு படிவத்தைப் பெற எங்கள் குழுவை அழைக்கவும்.",
          priority: 20,
          is_active: true,
          stop_processing_on_match: true,
          created_at: now,
          updated_at: now,
        },
      ];

  for (const rule of rules) {
    memorySocialRules.set(rule.id, rule);
  }

  return rules;
}
