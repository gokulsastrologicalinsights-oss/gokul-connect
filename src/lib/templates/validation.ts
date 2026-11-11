import {
  TemplateDraftInput,
  TemplateComponent,
  TemplateVariableExtraction,
  TemplateButton,
  TemplateHeaderFormat,
} from "./types";
import {
  detectPlaceholders,
  identifyMissingVariables,
  validateVariableCount,
  generateTemplatePreview,
  rejectUnresolvedPlaceholders,
} from "./variable-engine";

export {
  detectPlaceholders,
  identifyMissingVariables,
  validateVariableCount,
  generateTemplatePreview,
  rejectUnresolvedPlaceholders,
};

/**
 * Extract variable tokens from text (e.g. {{1}}, {{2}} -> ["1", "2"])
 */
export function extractVariables(text?: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];

  const seen = new Set<string>();
  const vars: string[] = [];

  for (const m of matches) {
    const num = m.replace(/[\{\}]/g, "");
    if (!seen.has(num)) {
      seen.add(num);
      vars.push(num);
    }
  }

  return vars.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

/**
 * Extract all variables across Header and Body components
 */
export function extractTemplateVariables(
  components?: TemplateComponent[] | Array<Record<string, unknown>> | null
): TemplateVariableExtraction {
  if (!components || !Array.isArray(components)) {
    return {
      headerVariables: [],
      bodyVariables: [],
      allVariables: [],
      totalCount: 0,
    };
  }

  let headerVariables: string[] = [];
  let bodyVariables: string[] = [];

  for (const comp of components) {
    const c = comp as any;
    if (c.type === "HEADER" && c.format === "TEXT" && typeof c.text === "string") {
      headerVariables = extractVariables(c.text);
    } else if (c.type === "BODY" && typeof c.text === "string") {
      bodyVariables = extractVariables(c.text);
    }
  }

  const allSet = new Set([...headerVariables, ...bodyVariables]);
  const allVariables = Array.from(allSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  return {
    headerVariables,
    bodyVariables,
    allVariables,
    totalCount: allVariables.length,
  };
}

/**
 * Replace {{1}}, {{2}} tokens in text with provided variable values.
 * If a value is missing or empty, keeps the {{n}} placeholder.
 */
export function replaceVariables(
  text: string,
  variables: Record<string, string> | string[]
): string {
  if (!text) return "";

  return text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
    if (Array.isArray(variables)) {
      const idx = parseInt(index, 10) - 1;
      const val = variables[idx];
      return val !== undefined && val !== "" ? val : match;
    } else {
      const val = variables[index];
      return val !== undefined && val !== "" ? val : match;
    }
  });
}

/**
 * Validates a template draft according to Meta WhatsApp Cloud API guidelines.
 */
export function validateTemplateDraft(draft: TemplateDraftInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Template name: lowercase alphanumeric and underscores only
  if (!draft.template_name || !draft.template_name.trim()) {
    errors.push("Template name is required.");
  } else {
    const name = draft.template_name.trim();
    if (!/^[a-z0-9_]+$/.test(name)) {
      errors.push("Template name must contain only lowercase letters, numbers, and underscores (e.g. order_update_01).");
    }
    if (name.length > 512) {
      errors.push("Template name cannot exceed 512 characters.");
    }
  }

  // Category
  if (!["UTILITY", "MARKETING", "AUTHENTICATION"].includes(draft.category)) {
    errors.push("Invalid category. Must be UTILITY, MARKETING, or AUTHENTICATION.");
  }

  // Language
  if (!draft.language || !draft.language.trim()) {
    errors.push("Language code is required (e.g. en, en_US, ta).");
  }

  // Body text: required, max 1024 chars
  if (!draft.body_text || !draft.body_text.trim()) {
    errors.push("Template body text is required.");
  } else {
    if (draft.body_text.length > 1024) {
      errors.push(`Body text exceeds maximum allowed length of 1024 characters (current: ${draft.body_text.length}).`);
    }

    // Verify variable formatting
    const bodyVars = extractVariables(draft.body_text);
    for (let i = 0; i < bodyVars.length; i++) {
      const expected = (i + 1).toString();
      if (bodyVars[i] !== expected) {
        errors.push(`Body variables must be sequential starting at {{1}}. Found missing or out-of-order variable {{${bodyVars[i]}}}.`);
        break;
      }
    }
  }

  // Header text: optional, max 60 chars
  if (draft.header_format === "TEXT" && draft.header_text) {
    if (draft.header_text.length > 60) {
      errors.push(`Header text exceeds maximum length of 60 characters (current: ${draft.header_text.length}).`);
    }
    const headerVars = extractVariables(draft.header_text);
    if (headerVars.length > 1) {
      errors.push("Header text can contain at most one variable {{1}}.");
    }
  }

  // Footer text: optional, max 60 chars, no variables allowed
  if (draft.footer_text) {
    if (draft.footer_text.length > 60) {
      errors.push(`Footer text exceeds maximum length of 60 characters (current: ${draft.footer_text.length}).`);
    }
    if (/\{\{\d+\}\}/.test(draft.footer_text)) {
      errors.push("Footer text cannot contain dynamic variables.");
    }
  }

  // Buttons validation
  if (draft.buttons && draft.buttons.length > 0) {
    if (draft.buttons.length > 3) {
      errors.push("Standard message templates support at most 3 interactive buttons.");
    }

    let quickReplyCount = 0;
    let urlCount = 0;
    let phoneCount = 0;

    draft.buttons.forEach((btn, idx) => {
      const num = idx + 1;
      if (!btn.text || !btn.text.trim()) {
        errors.push(`Button #${num} label is required.`);
      } else if (btn.text.length > 25) {
        errors.push(`Button #${num} label exceeds maximum length of 25 characters.`);
      }

      if (btn.type === "QUICK_REPLY") {
        quickReplyCount++;
      } else if (btn.type === "URL") {
        urlCount++;
        if (!btn.url || !btn.url.trim()) {
          errors.push(`Button #${num} requires a valid URL.`);
        } else if (!/^https?:\/\//i.test(btn.url.trim())) {
          errors.push(`Button #${num} URL must start with http:// or https://.`);
        }
      } else if (btn.type === "PHONE_NUMBER") {
        phoneCount++;
        if (!btn.phone_number || !btn.phone_number.trim()) {
          errors.push(`Button #${num} requires a phone number.`);
        }
      }
    });

    if (urlCount > 2) {
      errors.push("At most 2 URL buttons are allowed.");
    }
    if (phoneCount > 1) {
      errors.push("At most 1 Phone Number button is allowed.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Builds standard Meta components array from user draft inputs
 */
export function buildComponentsFromDraft(draft: TemplateDraftInput): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  // Header
  if (draft.header_format && draft.header_format !== "NONE") {
    if (draft.header_format === "TEXT") {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: draft.header_text?.trim() || "",
      });
    } else {
      components.push({
        type: "HEADER",
        format: draft.header_format,
      });
    }
  }

  // Body (always required)
  components.push({
    type: "BODY",
    text: draft.body_text.trim(),
  });

  // Footer (optional)
  if (draft.footer_text && draft.footer_text.trim()) {
    components.push({
      type: "FOOTER",
      text: draft.footer_text.trim(),
    });
  }

  // Buttons (optional)
  if (draft.buttons && draft.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: draft.buttons.map((b) => ({
        type: b.type,
        text: b.text.trim(),
        ...(b.url ? { url: b.url.trim() } : {}),
        ...(b.phone_number ? { phone_number: b.phone_number.trim() } : {}),
      })),
    });
  }

  return components;
}

/**
 * Parses components array back into editable draft fields
 */
export function parseComponentsToDraft(
  components?: TemplateComponent[] | Array<Record<string, unknown>> | null
): {
  header_format: TemplateHeaderFormat | "NONE";
  header_text: string;
  body_text: string;
  footer_text: string;
  buttons: TemplateButton[];
} {
  const result = {
    header_format: "NONE" as TemplateHeaderFormat | "NONE",
    header_text: "",
    body_text: "",
    footer_text: "",
    buttons: [] as TemplateButton[],
  };

  if (!components || !Array.isArray(components)) {
    return result;
  }

  for (const comp of components) {
    const c = comp as any;
    if (c.type === "HEADER") {
      result.header_format = c.format || "TEXT";
      result.header_text = c.text || "";
    } else if (c.type === "BODY") {
      result.body_text = c.text || "";
    } else if (c.type === "FOOTER") {
      result.footer_text = c.text || "";
    } else if (c.type === "BUTTONS" && Array.isArray(c.buttons)) {
      result.buttons = c.buttons.map((b: any) => ({
        type: b.type,
        text: b.text || "",
        url: b.url || "",
        phone_number: b.phone_number || "",
      }));
    }
  }

  return result;
}
