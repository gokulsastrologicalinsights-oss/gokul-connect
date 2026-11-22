import type {
  MetaSocialRule,
  MetaSocialPlatform,
  MetaSocialEventType,
} from "./types";

/**
 * Normalizes text for deterministic Tamil & English matching.
 * Preserves Tamil Unicode syllables while lowercasing ASCII and collapsing whitespace.
 */
export function normalizeSocialText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove zero-width spaces
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?\[\]"'+|\\<>@]/g, " ") // replace punctuation, quotes, brackets with spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Evaluates whether a rule matches the given inbound text.
 */
export function matchSocialRule(
  rule: MetaSocialRule,
  text: string,
  platform: MetaSocialPlatform,
  eventType: MetaSocialEventType
): boolean {
  if (!rule.is_active) return false;

  // Platform check
  if (rule.platform !== "both" && rule.platform !== platform) {
    return false;
  }

  // Target type check: 'message' vs 'comment'
  const isMessage = eventType === "message";
  const isComment = eventType === "comment" || eventType === "mention";

  if (rule.target_type === "message" && !isMessage) return false;
  if (rule.target_type === "comment" && !isComment) return false;

  const normalizedInput = normalizeSocialText(text);

  if (rule.match_type === "any") {
    return true;
  }

  const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
  if (keywords.length === 0) {
    return false;
  }

  for (const rawKw of keywords) {
    const kw = normalizeSocialText(rawKw);
    if (!kw) continue;

    switch (rule.match_type) {
      case "exact":
        if (normalizedInput === kw) return true;
        break;
      case "contains":
        if (normalizedInput.includes(kw)) return true;
        break;
      case "starts_with":
        if (normalizedInput.startsWith(kw)) return true;
        break;
      default:
        if (normalizedInput.includes(kw)) return true;
    }
  }

  return false;
}

/**
 * Finds the highest-priority matching rule from a list of candidate rules.
 * Enforces a strictly deterministic priority policy:
 * 1. Priority number ascending (1 is higher priority than 100)
 * 2. Earliest created timestamp (older rule takes precedence)
 * 3. Rule ID ascending as a stable tie-breaker
 */
export function findMatchingSocialRule(
  rules: MetaSocialRule[],
  text: string,
  platform: MetaSocialPlatform,
  eventType: MetaSocialEventType
): MetaSocialRule | null {
  const sorted = [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  for (const rule of sorted) {
    if (matchSocialRule(rule, text, platform, eventType)) {
      return rule;
    }
  }

  return null;
}

/**
 * Returns the exact keyword that triggered a match in the rule.
 */
export function getMatchedSocialKeyword(
  rule: MetaSocialRule,
  text: string
): string | null {
  if (!rule.is_active) return null;
  const normalizedInput = normalizeSocialText(text);

  if (rule.match_type === "any") {
    return Array.isArray(rule.keywords) && rule.keywords.length > 0 ? rule.keywords[0] : "*";
  }

  const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
  for (const rawKw of keywords) {
    const kw = normalizeSocialText(rawKw);
    if (!kw) continue;

    let isMatch = false;
    switch (rule.match_type) {
      case "exact":
        isMatch = normalizedInput === kw;
        break;
      case "contains":
        isMatch = normalizedInput.includes(kw);
        break;
      case "starts_with":
        isMatch = normalizedInput.startsWith(kw);
        break;
      default:
        isMatch = normalizedInput.includes(kw);
    }
    if (isMatch) return rawKw;
  }
  return null;
}

/**
 * Detects whether the input text is predominantly Tamil or English.
 * Tamil Unicode block is U+0B80 to U+0BFF.
 */
export function detectLanguage(text: string | null | undefined): "ta" | "en" {
  if (!text) return "en";
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  return hasTamil ? "ta" : "en";
}

/**
 * Resolves the public reply text from a rule's predefined reply.
 * Supports:
 * 1. Plain text string (backward compatible with all existing rules).
 * 2. Bilingual JSON string formatted as { "ta": "...", "en": "..." },
 *    selecting the appropriate reply based on the comment text or matched keyword.
 */
export function resolvePublicReplyText(
  predefinedReply: string,
  commentText: string,
  matchedKeyword?: string
): string {
  if (!predefinedReply) return "";
  const trimmed = predefinedReply.trim();

  if (trimmed.startsWith("{") && (trimmed.includes('"ta"') || trimmed.includes('"en"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const isTamil = detectLanguage(commentText) === "ta" || (matchedKeyword && detectLanguage(matchedKeyword) === "ta");
      if (isTamil && parsed.ta) {
        return parsed.ta;
      }
      if (!isTamil && parsed.en) {
        return parsed.en;
      }
      return parsed.ta || parsed.en || trimmed;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}
