import { supabase } from "./supabase";

// day_of_week follows JS Date.getDay(): 0 = Sunday ... 6 = Saturday.
export type OperatingHoursRow = {
  day_of_week: number;
  is_closed: boolean;
  open_time: string;
  close_time: string;
  last_registration_time: string;
};

export type PublicHoliday = {
  holiday_date: string; // "YYYY-MM-DD"
  label: string | null;
};

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Manager settings UI lists Monday first; this is display order only —
// lookups always key off day_of_week (0 = Sunday), matching JS Date.getDay().
export const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatHHMM(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!match) return time;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export type ScheduleEvaluation = {
  schedule: OperatingHoursRow | null;
  isHolidayToday: boolean;
  canRegister: boolean;
  isWithinOperatingHours: boolean;
  message: string;
};

// Public holidays always borrow Sunday's (day_of_week 0) schedule,
// regardless of what weekday they actually fall on.
export function evaluateSchedule(
  rows: OperatingHoursRow[],
  holidays: PublicHoliday[],
  now: Date = new Date(),
): ScheduleEvaluation {
  const todayKey = toDateKey(now);
  const isHolidayToday = holidays.some((h) => h.holiday_date === todayKey);
  const effectiveDay = isHolidayToday ? 0 : now.getDay();
  const schedule = rows.find((r) => r.day_of_week === effectiveDay) || null;

  if (!schedule || schedule.is_closed) {
    return {
      schedule,
      isHolidayToday,
      canRegister: false,
      isWithinOperatingHours: false,
      message: isHolidayToday
        ? "Closed today for a public holiday."
        : "Closed today.",
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTimeToMinutes(schedule.open_time) ?? 0;
  const closeMinutes = parseTimeToMinutes(schedule.close_time) ?? 1440;
  const lastRegMinutes =
    parseTimeToMinutes(schedule.last_registration_time) ?? closeMinutes;

  const isWithinOperatingHours =
    nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  const canRegister = nowMinutes >= openMinutes && nowMinutes < lastRegMinutes;

  let message: string;
  if (nowMinutes < openMinutes) {
    message = `Queue registration start ${formatHHMM(schedule.open_time)}.`;
  } else if (nowMinutes >= closeMinutes) {
    message = `Closed for today. Closing time was ${formatHHMM(schedule.close_time)}.`;
  } else if (nowMinutes >= lastRegMinutes) {
    message = `No new queue is allowed at this moment. Last registration was at ${formatHHMM(schedule.last_registration_time)}. Showroom closes at ${formatHHMM(schedule.close_time)}.`;
  } else {
    message = `Open until ${formatHHMM(schedule.close_time)}. Last registration at ${formatHHMM(schedule.last_registration_time)}.`;
  }

  return { schedule, isHolidayToday, canRegister, isWithinOperatingHours, message };
}

// The "operating day" starts at that weekday's open_time rather than
// calendar midnight, so showrooms whose hours run past midnight (or simply
// don't want the daily plate limit to reset while they're still open at
// 12:01am) get one window per continuous business day instead of per
// calendar date.
function operatingDayStartFor(
  date: Date,
  hoursRows: OperatingHoursRow[],
  holidays: PublicHoliday[],
): Date | null {
  const key = toDateKey(date);
  const isHoliday = holidays.some((h) => h.holiday_date === key);
  const effectiveDay = isHoliday ? 0 : date.getDay();
  const schedule = hoursRows.find((r) => r.day_of_week === effectiveDay);
  if (!schedule || schedule.is_closed) return null;

  const openMinutes = parseTimeToMinutes(schedule.open_time) ?? 0;
  const start = new Date(date);
  start.setHours(0, openMinutes, 0, 0);
  return start;
}

export function getOperatingDayRange(
  hoursRows: OperatingHoursRow[],
  holidays: PublicHoliday[],
  now: Date = new Date(),
): { start: Date; end: Date } {
  let start = operatingDayStartFor(now, hoursRows, holidays);

  // "now" earlier than today's opening time means either we're before
  // opening, or the still-current operating day actually began yesterday
  // (overnight hours) — either way, yesterday's opening time is the correct
  // window start.
  if (!start || now < start) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = operatingDayStartFor(yesterday, hoursRows, holidays);
    if (yesterdayStart) start = yesterdayStart;
  }

  // No usable schedule at all (not yet loaded, or fully closed) — fall back
  // to calendar midnight rather than blocking the check entirely.
  if (!start) {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export async function fetchOperatingHours(): Promise<OperatingHoursRow[]> {
  const { data, error } = await supabase
    .from("operating_hours")
    .select(
      "day_of_week, is_closed, open_time, close_time, last_registration_time",
    )
    .order("day_of_week", { ascending: true });
  if (error) throw error;
  return (data as OperatingHoursRow[]) || [];
}

export async function fetchUpcomingHolidays(): Promise<PublicHoliday[]> {
  const { data, error } = await supabase
    .from("public_holidays")
    .select("holiday_date, label")
    .order("holiday_date", { ascending: true });
  if (error) throw error;
  return (data as PublicHoliday[]) || [];
}
