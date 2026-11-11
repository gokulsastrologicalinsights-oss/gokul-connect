/**
 * Gokul Connect — Template Variable Engine
 * PHASE 11: Reusable variable processing, detection, validation, preview and Unicode support.
 *
 * Supports:
 * - Detect sequential placeholders {{1}}, {{2}}, etc.
 * - Detect malformed placeholders: {{}}, {{abc}}, {{ 1 }}, {1}, {{1
 * - Identify missing variables
 * - Validate variable count and ordering
 * - Safe preview generation with Tamil & English Unicode support
 * - Reject unresolved placeholders before dispatch
 */

export interface PlaceholderDetectionResult {
  valid: string[];
  malformed: string[];
  duplicates: string[];
  ordered: string[];
  totalPlaceholders: number;
}

export interface VariableValidationResult {
  isValid: boolean;
  expectedCount: number;
  providedCount: number;
  missing: string[];
  errors: string[];
}

export interface TemplatePreviewResult {
  preview: string;
  unresolved: string[];
  isComplete: boolean;
}

/**
 * Detect all valid, duplicate, and malformed placeholders in a text string.
 */
export function detectPlaceholders(text?: string | null): PlaceholderDetectionResult {
  if (!text) {
    return {
      valid: [],
      malformed: [],
      duplicates: [],
      ordered: [],
      totalPlaceholders: 0,
    };
  }

  // 1. Valid placeholders {{1}}, {{2}}, etc.
  const validRegex = /\{\{(\d+)\}\}/g;
  const ordered: string[] = [];
  const validSet = new Set<string>();
  const duplicateSet = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = validRegex.exec(text)) !== null) {
    const num = match[1];
    ordered.push(num);
    if (validSet.has(num)) {
      duplicateSet.add(num);
    } else {
      validSet.add(num);
    }
  }

  // 2. Malformed placeholders:
  // e.g. {{}}, {{abc}}, {{ 1 }}, {1}, etc.
  const malformed: string[] = [];

  // Match any {{...}} that is NOT purely digits
  const anyDoubleBraces = /\{\{([^}]+)\}\}/g;
  while ((match = anyDoubleBraces.exec(text)) !== null) {
    const inner = match[1];
    if (!/^\d+$/.test(inner)) {
      malformed.push(`{{${inner}}}`);
    }
  }

  // Match empty double braces {{}}
  const emptyBraces = /\{\{\s*\}\}/g;
  while ((match = emptyBraces.exec(text)) !== null) {
    if (!malformed.includes(match[0])) {
      malformed.push(match[0]);
    }
  }

  // Match single braces with numbers like {1} where not surrounded by another brace
  const singleBrace = /(?<!\{)\{(\d+)\}(?!\})/g;
  while ((match = singleBrace.exec(text)) !== null) {
    malformed.push(match[0]);
  }

  const valid = Array.from(validSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  return {
    valid,
    malformed,
    duplicates: Array.from(duplicateSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
    ordered,
    totalPlaceholders: ordered.length,
  };
}

/**
 * Identify missing variables given a text string and a key-value or array parameter set.
 */
export function identifyMissingVariables(
  text: string,
  values: Record<string, string> | string[]
): string[] {
  const { valid } = detectPlaceholders(text);
  const missing: string[] = [];

  for (const v of valid) {
    if (Array.isArray(values)) {
      const idx = parseInt(v, 10) - 1;
      const val = values[idx];
      if (val === undefined || val === null || val.trim() === "") {
        missing.push(v);
      }
    } else {
      const val = values[v];
      if (val === undefined || val === null || val.trim() === "") {
        missing.push(v);
      }
    }
  }

  return missing;
}

/**
 * Validate variable counts, ensuring all required tokens are supplied.
 */
export function validateVariableCount(
  text: string,
  values: Record<string, string> | string[]
): VariableValidationResult {
  const { valid, malformed } = detectPlaceholders(text);
  const missing = identifyMissingVariables(text, values);
  const errors: string[] = [];

  if (malformed.length > 0) {
    errors.push(`Malformed placeholders detected: ${malformed.join(", ")}`);
  }

  if (missing.length > 0) {
    errors.push(`Missing required variables: ${missing.map((m) => `{{${m}}}`).join(", ")}`);
  }

  const providedCount = Array.isArray(values)
    ? values.filter((v) => v !== undefined && v !== null && v.trim() !== "").length
    : Object.values(values).filter((v) => v !== undefined && v !== null && v.trim() !== "").length;

  return {
    isValid: errors.length === 0,
    expectedCount: valid.length,
    providedCount,
    missing,
    errors,
  };
}

/**
 * Generate template preview with user-provided values.
 * Preserves unresolved placeholders if not provided.
 * Fully supports Unicode (Tamil, Hindi, Telugu, English).
 */
export function generateTemplatePreview(
  text: string,
  values: Record<string, string> | string[]
): TemplatePreviewResult {
  if (!text) {
    return { preview: "", unresolved: [], isComplete: true };
  }

  const unresolved: string[] = [];

  const preview = text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
    let val: string | undefined;

    if (Array.isArray(values)) {
      const idx = parseInt(index, 10) - 1;
      val = values[idx];
    } else {
      val = values[index];
    }

    if (val !== undefined && val !== null && val.trim() !== "") {
      return val;
    }

    unresolved.push(index);
    return match;
  });

  return {
    preview,
    unresolved: Array.from(new Set(unresolved)),
    isComplete: unresolved.length === 0,
  };
}

/**
 * Validate and format template text for dispatch.
 * Strictly rejects unresolved placeholders before dispatch.
 */
export function rejectUnresolvedPlaceholders(
  text: string,
  values: Record<string, string> | string[]
): string {
  const result = generateTemplatePreview(text, values);
  if (!result.isComplete) {
    throw new Error(
      `Cannot dispatch template: unresolved placeholders remaining: ${result.unresolved
        .map((u) => `{{${u}}}`)
        .join(", ")}`
    );
  }
  return result.preview;
}
