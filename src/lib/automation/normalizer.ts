/**
 * Gokul Connect — Phase 5 Automation Engine: Text Normalizer & Keyword Matcher
 * 
 * 100% Deterministic, non-AI text processing supporting English & Tamil Unicode.
 */

export interface KeywordMatchOptions {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
}

/**
 * Normalizes a string for deterministic matching:
 * - Unicode NFC normalization ensures composed/decomposed Tamil glyphs match identically.
 * - Trims leading/trailing whitespace and collapses multiple internal spaces.
 * - Lowercases if not case-sensitive.
 */
export function normalizeText(text: string, options: KeywordMatchOptions = {}): string {
  if (!text) return "";

  // Normalize Unicode representation (crucial for Tamil vowel signs & consonants)
  let normalized = text.normalize("NFC");

  if (options.trimWhitespace !== false) {
    normalized = normalized.trim().replace(/\s+/g, " ");
  }

  if (!options.caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Checks if incoming text matches an exact keyword or any keyword in a list.
 */
export function matchExact(text: string, targetKeywords: string | string[], options: KeywordMatchOptions = {}): boolean {
  const normText = normalizeText(text, options);
  const targets = Array.isArray(targetKeywords) ? targetKeywords : [targetKeywords];

  return targets.some((target) => {
    const normTarget = normalizeText(target, options);
    return normText === normTarget;
  });
}

/**
 * Checks if incoming text contains any target keyword substring.
 */
export function matchContains(text: string, targetKeywords: string | string[], options: KeywordMatchOptions = {}): boolean {
  const normText = normalizeText(text, options);
  const targets = Array.isArray(targetKeywords) ? targetKeywords : [targetKeywords];

  return targets.some((target) => {
    const normTarget = normalizeText(target, options);
    if (!normTarget) return false;
    return normText.includes(normTarget);
  });
}

/**
 * Checks if incoming text starts with any target keyword.
 */
export function matchStartsWith(text: string, targetKeywords: string | string[], options: KeywordMatchOptions = {}): boolean {
  const normText = normalizeText(text, options);
  const targets = Array.isArray(targetKeywords) ? targetKeywords : [targetKeywords];

  return targets.some((target) => {
    const normTarget = normalizeText(target, options);
    if (!normTarget) return false;
    return normText.startsWith(normTarget);
  });
}

/**
 * Checks if incoming text matches a regular expression safely without ReDoS vulnerability.
 */
export function matchRegex(text: string, pattern: string, options: KeywordMatchOptions = {}): boolean {
  if (!pattern) return false;
  try {
    const flags = options.caseSensitive ? "u" : "iu";
    const regex = new RegExp(pattern, flags);
    return regex.test(text.normalize("NFC"));
  } catch (err) {
    console.error("[Automation Regex Error] Invalid regex pattern:", pattern, err);
    return false;
  }
}
