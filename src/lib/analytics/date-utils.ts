import { DateRangeFilter, DateRangePreset } from "./types";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds

/**
 * Returns current timestamp in milliseconds adjusted to Asia/Kolkata date components.
 */
export function getNowInKolkata(referenceDate: Date = new Date()): {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  date: number;  // 1-31
  hours: number;
  minutes: number;
  seconds: number;
} {
  const istTime = new Date(referenceDate.getTime() + IST_OFFSET_MS);
  return {
    year: istTime.getUTCFullYear(),
    month: istTime.getUTCMonth(),
    date: istTime.getUTCDate(),
    hours: istTime.getUTCHours(),
    minutes: istTime.getUTCMinutes(),
    seconds: istTime.getUTCSeconds(),
  };
}

/**
 * Converts IST year, month (0-indexed), date, hour, min, sec to UTC Date object.
 */
export function kolkataToUtc(
  year: number,
  month: number,
  date: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0
): Date {
  const utcMillis = Date.UTC(year, month, date, hours, minutes, seconds, milliseconds) - IST_OFFSET_MS;
  return new Date(utcMillis);
}

/**
 * Format a Date object or ISO string into Asia/Kolkata localized date string.
 */
export function formatKolkataDate(
  dateInput: Date | string | number,
  includeTime = true
): string {
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "Invalid Date";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }
      : {}),
  };

  const formatted = new Intl.DateTimeFormat("en-IN", options).format(d);
  return includeTime ? `${formatted} IST` : formatted;
}

/**
 * Converts a Date to YYYY-MM-DD string in Asia/Kolkata timezone.
 */
export function toKolkataDateString(dateInput: Date | string | number): string {
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Resolves a date preset or custom range into exact ISO UTC strings bound to Asia/Kolkata calendar days.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): DateRangeFilter {
  const now = getNowInKolkata(referenceDate);

  let startUtc: Date;
  let endUtc: Date;
  let label = "";

  switch (preset) {
    case "today": {
      startUtc = kolkataToUtc(now.year, now.month, now.date, 0, 0, 0, 0);
      endUtc = kolkataToUtc(now.year, now.month, now.date, 23, 59, 59, 999);
      label = "Today";
      break;
    }
    case "yesterday": {
      const yDate = new Date(Date.UTC(now.year, now.month, now.date - 1));
      startUtc = kolkataToUtc(yDate.getUTCFullYear(), yDate.getUTCMonth(), yDate.getUTCDate(), 0, 0, 0, 0);
      endUtc = kolkataToUtc(yDate.getUTCFullYear(), yDate.getUTCMonth(), yDate.getUTCDate(), 23, 59, 59, 999);
      label = "Yesterday";
      break;
    }
    case "7d": {
      const sDate = new Date(Date.UTC(now.year, now.month, now.date - 6));
      startUtc = kolkataToUtc(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0, 0);
      endUtc = kolkataToUtc(now.year, now.month, now.date, 23, 59, 59, 999);
      label = "Last 7 Days";
      break;
    }
    case "30d": {
      const sDate = new Date(Date.UTC(now.year, now.month, now.date - 29));
      startUtc = kolkataToUtc(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0, 0);
      endUtc = kolkataToUtc(now.year, now.month, now.date, 23, 59, 59, 999);
      label = "Last 30 Days";
      break;
    }
    case "this_month": {
      startUtc = kolkataToUtc(now.year, now.month, 1, 0, 0, 0, 0);
      endUtc = kolkataToUtc(now.year, now.month, now.date, 23, 59, 59, 999);
      label = "This Month";
      break;
    }
    case "previous_month": {
      const prevMonthYear = now.month === 0 ? now.year - 1 : now.year;
      const prevMonth = now.month === 0 ? 11 : now.month - 1;
      // Last day of previous month
      const lastDayOfPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonth + 1, 0)).getUTCDate();
      startUtc = kolkataToUtc(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
      endUtc = kolkataToUtc(prevMonthYear, prevMonth, lastDayOfPrevMonth, 23, 59, 59, 999);
      label = "Previous Month";
      break;
    }
    case "custom": {
      if (customStart && customEnd) {
        const [sy, sm, sd] = customStart.split("-").map(Number);
        const [ey, em, ed] = customEnd.split("-").map(Number);
        startUtc = kolkataToUtc(sy, sm - 1, sd, 0, 0, 0, 0);
        endUtc = kolkataToUtc(ey, em - 1, ed, 23, 59, 59, 999);
        label = `Custom: ${customStart} to ${customEnd}`;
      } else {
        // Fallback to 7 days
        const sDate = new Date(Date.UTC(now.year, now.month, now.date - 6));
        startUtc = kolkataToUtc(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0, 0);
        endUtc = kolkataToUtc(now.year, now.month, now.date, 23, 59, 59, 999);
        label = "Custom (Default 7 Days)";
      }
      break;
    }
    default: {
      const sDate = new Date(Date.UTC(now.year, now.month, now.date - 6));
      startUtc = kolkataToUtc(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate(), 0, 0, 0, 0);
      endUtc = kolkataToUtc(now.year, now.month, now.date, 23, 59, 59, 999);
      label = "Last 7 Days";
    }
  }

  return {
    preset,
    startDate: startUtc.toISOString(),
    endDate: endUtc.toISOString(),
    timezone: "Asia/Kolkata",
    label,
    istStartFormatted: formatKolkataDate(startUtc, false),
    istEndFormatted: formatKolkataDate(endUtc, false),
  };
}

/**
 * Generate an ordered array of YYYY-MM-DD date strings in Asia/Kolkata
 * between startDate and endDate inclusive.
 */
export function generateDateBuckets(startDate: string, endDate: string): string[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const buckets: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const dStr = toKolkataDateString(current);
    if (!buckets.includes(dStr)) {
      buckets.push(dStr);
    }
    // advance 1 day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Ensure last date is included if not present
  const endStr = toKolkataDateString(end);
  if (!buckets.includes(endStr)) {
    buckets.push(endStr);
  }

  return buckets;
}

/**
 * Format duration in seconds to a user-friendly string (e.g. "3m 42s", "1h 12m", "< 1m", or "N/A").
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return "N/A";
  }

  const s = Math.round(seconds);
  if (s < 60) {
    return `${s}s`;
  }

  const mins = Math.floor(s / 60);
  const remSecs = s % 60;

  if (mins < 60) {
    return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  }

  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}
