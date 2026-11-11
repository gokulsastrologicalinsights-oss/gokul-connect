import {
  ContactSource,
  ContactStatus,
  CsvContactImportRow,
  CsvImportValidationResult,
} from "@/types/database";

export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  // Strip all non-digit characters
  const digits = rawPhone.replace(/\D/g, "");
  return digits;
}

/**
 * Splits a CSV row respecting quotes and commas
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuote && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === "," && !insideQuote) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * CSV Parser and Validator for bulk import
 */
export function parseAndValidateCsv(
  csvText: string,
  existingPhones: Set<string> = new Set()
): CsvImportValidationResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    return {
      totalRows: 0,
      validRows: [],
      duplicateCount: 0,
      invalidCount: 0,
      errors: [{ row: 0, error: "CSV file is empty or missing data rows." }],
    };
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

  // Find column indices
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("whatsapp") || h.includes("number"));
  const emailIdx = headers.findIndex((h) => h.includes("email"));
  const categoryIdx = headers.findIndex((h) => h.includes("category"));
  const statusIdx = headers.findIndex((h) => h.includes("status"));
  const sourceIdx = headers.findIndex((h) => h.includes("source"));
  const tagsIdx = headers.findIndex((h) => h.includes("tag"));
  const notesIdx = headers.findIndex((h) => h.includes("note"));

  if (phoneIdx === -1) {
    return {
      totalRows: 0,
      validRows: [],
      duplicateCount: 0,
      invalidCount: lines.length - 1,
      errors: [{ row: 0, error: 'Could not find a phone number column (expected header containing "phone", "mobile", or "whatsapp").' }],
    };
  }

  const validRows: CsvContactImportRow[] = [];
  const errors: Array<{ row: number; phone?: string; error: string }> = [];
  const seenInBatch = new Set<string>();
  let duplicateCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = parseCsvLine(rawLine);
    const rawPhone = cols[phoneIdx] || "";
    const phone = normalizePhoneNumber(rawPhone);
    const name = (nameIdx !== -1 && cols[nameIdx]?.trim()) || `Contact ${phone.slice(-4)}`;

    if (!phone || phone.length < 5) {
      errors.push({ row: i + 1, phone: rawPhone, error: "Invalid phone number format (min 5 digits required)." });
      continue;
    }

    if (seenInBatch.has(phone)) {
      duplicateCount++;
      errors.push({ row: i + 1, phone, error: "Duplicate phone number found within the same CSV upload." });
      continue;
    }

    if (existingPhones.has(phone)) {
      duplicateCount++;
      errors.push({ row: i + 1, phone, error: `Contact with number ${phone} already exists in this business.` });
      continue;
    }

    seenInBatch.add(phone);

    const email = (emailIdx !== -1 && cols[emailIdx]?.trim()) || undefined;
    const category = (categoryIdx !== -1 && cols[categoryIdx]?.trim()) || undefined;
    let status: ContactStatus = "lead";
    if (statusIdx !== -1 && cols[statusIdx]) {
      const s = cols[statusIdx].toLowerCase().trim();
      if (["lead", "active", "inactive", "customer"].includes(s)) {
        status = s as ContactStatus;
      }
    }

    let source: ContactSource = "csv_import";
    if (sourceIdx !== -1 && cols[sourceIdx]) {
      const src = cols[sourceIdx].toLowerCase().trim();
      if (["whatsapp", "website", "referral", "walk_in", "csv_import", "manual", "other"].includes(src)) {
        source = src as ContactSource;
      }
    }

    const tags = tagsIdx !== -1 && cols[tagsIdx]
      ? cols[tagsIdx].split(";").map((t) => t.trim()).filter(Boolean)
      : undefined;

    const notes = notesIdx !== -1 ? cols[notesIdx]?.trim() : undefined;

    validRows.push({
      name,
      phone,
      email,
      category,
      status,
      source,
      tags,
      notes,
    });
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    duplicateCount,
    invalidCount: errors.length,
    errors,
  };
}
