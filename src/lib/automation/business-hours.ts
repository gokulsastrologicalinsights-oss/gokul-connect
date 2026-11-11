import { BusinessHoursConfig } from "@/types/database";

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: "Asia/Kolkata",
  weekly_schedule: {
    monday:    { is_open: true,  open_time: "09:00", close_time: "18:00" },
    tuesday:   { is_open: true,  open_time: "09:00", close_time: "18:00" },
    wednesday: { is_open: true,  open_time: "09:00", close_time: "18:00" },
    thursday:  { is_open: true,  open_time: "09:00", close_time: "18:00" },
    friday:    { is_open: true,  open_time: "09:00", close_time: "18:00" },
    saturday:  { is_open: true,  open_time: "10:00", close_time: "16:00" },
    sunday:    { is_open: false, open_time: "00:00", close_time: "00:00" },
  },
  holiday_dates: [],
};

export interface BusinessHoursEvaluationResult {
  isWithinHours: boolean;
  dayOfWeek: string;
  currentTimeString: string;
  currentDateString: string;
  timezone: string;
  scheduleForDay?: {
    is_open: boolean;
    open_time: string;
    close_time: string;
  };
  reason: "open" | "closed_day" | "before_open" | "after_close" | "holiday" | "schedule_missing";
}

/**
 * Evaluates whether a given date (or now) falls within the business's operating hours.
 * Uses Intl.DateTimeFormat with the configured timezone (e.g. Asia/Kolkata).
 */
export function evaluateBusinessHours(
  date: Date = new Date(),
  config: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS
): BusinessHoursEvaluationResult {
  const timezone = config.timezone || "Asia/Kolkata";

  // Format date parts in target timezone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const dayOfWeek = (partMap.weekday || "monday").toLowerCase();
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = partMap.hour;
  const minute = partMap.minute;

  const currentDateString = `${year}-${month}-${day}`;
  const currentTimeString = `${hour}:${minute}`;

  // Check holiday dates
  if (config.holiday_dates && config.holiday_dates.includes(currentDateString)) {
    return {
      isWithinHours: false,
      dayOfWeek,
      currentTimeString,
      currentDateString,
      timezone,
      reason: "holiday",
    };
  }

  const schedule = config.weekly_schedule?.[dayOfWeek as keyof typeof config.weekly_schedule];

  if (!schedule) {
    return {
      isWithinHours: false,
      dayOfWeek,
      currentTimeString,
      currentDateString,
      timezone,
      reason: "schedule_missing",
    };
  }

  if (!schedule.is_open) {
    return {
      isWithinHours: false,
      dayOfWeek,
      currentTimeString,
      currentDateString,
      timezone,
      scheduleForDay: schedule,
      reason: "closed_day",
    };
  }

  const [openHour, openMin] = schedule.open_time.split(":").map(Number);
  const [closeHour, closeMin] = schedule.close_time.split(":").map(Number);
  const currentMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);
  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;

  if (currentMinutes < openMinutes) {
    return {
      isWithinHours: false,
      dayOfWeek,
      currentTimeString,
      currentDateString,
      timezone,
      scheduleForDay: schedule,
      reason: "before_open",
    };
  }

  if (currentMinutes >= closeMinutes) {
    return {
      isWithinHours: false,
      dayOfWeek,
      currentTimeString,
      currentDateString,
      timezone,
      scheduleForDay: schedule,
      reason: "after_close",
    };
  }

  return {
    isWithinHours: true,
    dayOfWeek,
    currentTimeString,
    currentDateString,
    timezone,
    scheduleForDay: schedule,
    reason: "open",
  };
}
