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
 */
export function findMatchingSocialRule(
  rules: MetaSocialRule[],
  text: string,
  platform: MetaSocialPlatform,
  eventType: MetaSocialEventType
): MetaSocialRule | null {
  // Sort by priority ASC (1 is higher priority than 100)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (matchSocialRule(rule, text, platform, eventType)) {
      return rule;
    }
  }

  return null;
}
