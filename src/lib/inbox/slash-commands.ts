import { CannedResponse } from "@/types/database";

export interface SlashCommandMatch {
  query: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Normalize a slash command shortcut into lowercase slug without leading slash.
 * e.g. "/Pricing Info!" -> "pricing-info"
 */
export function normalizeShortcut(raw: string): string {
  return (raw || "")
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

/**
 * Detect an active `/shortcut` trigger immediately before the cursor position.
 * Only triggers at the beginning of input or immediately following whitespace.
 */
export function extractSlashCommandQuery(
  text: string,
  cursorPos?: number
): SlashCommandMatch | null {
  if (!text) return null;
  const pos = cursorPos === undefined ? text.length : Math.max(0, Math.min(cursorPos, text.length));
  const beforeCursor = text.slice(0, pos);
  const match = beforeCursor.match(/(^|\s)\/([a-zA-Z0-9_-]*)$/);
  if (!match) return null;

  const leadingWhitespace = match[1] || "";
  const slashStart = (match.index ?? 0) + leadingWhitespace.length;

  return {
    query: match[2] || "",
    startIndex: slashStart,
    endIndex: pos,
  };
}

/**
 * Replace the active `/query` token with the chosen canned response content.
 */
export function applySlashCommandReplacement(
  text: string,
  match: SlashCommandMatch,
  snippetContent: string
): { nextText: string; nextCursorPos: number } {
  const before = text.slice(0, match.startIndex);
  const after = text.slice(match.endIndex);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);
  const inserted = needsTrailingSpace ? `${snippetContent} ` : snippetContent;
  const nextText = `${before}${inserted}${after}`;
  const nextCursorPos = before.length + inserted.length;

  return { nextText, nextCursorPos };
}

/**
 * Filter canned responses by shortcut, title, category, or content.
 */
export function filterCannedResponses(
  responses: CannedResponse[],
  query: string
): CannedResponse[] {
  const q = (query || "").trim().toLowerCase().replace(/^\/+/, "");
  if (!q) return responses;

  return [...responses]
    .filter(
      (r) =>
        r.shortcut.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const aStarts = a.shortcut.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.shortcut.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.shortcut.localeCompare(b.shortcut);
    });
}
