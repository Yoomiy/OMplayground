export type RecessMode = "recess" | "class_time";

export interface RecessWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface ClassRecessException extends RecessWindow {
  mode: RecessMode;
}

export interface ClassRecessSchedule {
  overrideEnabled: boolean;
  exceptions: ClassRecessException[];
}

export interface RecessScheduleSnapshot {
  defaultWindows: RecessWindow[];
  classSchedule?: ClassRecessSchedule | null;
}

export interface EffectiveScheduleSegment {
  start_time: string;
  end_time: string;
  mode: RecessMode;
}

function jerusalemParts(now: Date): { dayOfWeek: number; minuteOfDay: number } {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short"
  }).format(now);
  const dayOfWeek = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const)[weekday as "Sun"] ?? 0;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { dayOfWeek, minuteOfDay: hour * 60 + minute };
}

export function minutesFromTime(value: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function timeFromMinutes(value: number): string {
  const bounded = Math.max(0, Math.min(24 * 60, value));
  return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`;
}

function includesMinute(window: RecessWindow, dayOfWeek: number, minuteOfDay: number): boolean {
  const start = minutesFromTime(window.start_time);
  const end = minutesFromTime(window.end_time);
  return window.is_active && window.day_of_week === dayOfWeek && start <= minuteOfDay && minuteOfDay < end;
}

/** Resolves a child's access. Class exceptions override the school default. */
export function isWithinEffectiveRecess(now: Date, snapshot: RecessScheduleSnapshot): boolean {
  const { dayOfWeek, minuteOfDay } = jerusalemParts(now);
  const exceptions = snapshot.classSchedule;
  if (exceptions?.overrideEnabled) {
    const match = exceptions.exceptions.find((window) => includesMinute(window, dayOfWeek, minuteOfDay));
    if (match) return match.mode === "recess";
  }
  return snapshot.defaultWindows.some((window) => includesMinute(window, dayOfWeek, minuteOfDay));
}

/** Computes coalesced recess/class-time segments for the selected day. */
export function buildEffectiveDaySchedule(dayOfWeek: number, snapshot: RecessScheduleSnapshot): EffectiveScheduleSegment[] {
  const boundaries = new Set<number>([0, 24 * 60]);
  for (const window of snapshot.defaultWindows) {
    if (window.is_active && window.day_of_week === dayOfWeek) {
      boundaries.add(minutesFromTime(window.start_time));
      boundaries.add(minutesFromTime(window.end_time));
    }
  }
  if (snapshot.classSchedule?.overrideEnabled) {
    for (const window of snapshot.classSchedule.exceptions) {
      if (window.is_active && window.day_of_week === dayOfWeek) {
        boundaries.add(minutesFromTime(window.start_time));
        boundaries.add(minutesFromTime(window.end_time));
      }
    }
  }
  const points = [...boundaries].filter(Number.isFinite).sort((a, b) => a - b);
  const segments: EffectiveScheduleSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    if (start === end) continue;
    const defaultRecess = snapshot.defaultWindows.some((window) => window.is_active && window.day_of_week === dayOfWeek && minutesFromTime(window.start_time) <= start && start < minutesFromTime(window.end_time));
    const exception = snapshot.classSchedule?.overrideEnabled
      ? snapshot.classSchedule.exceptions.find((window) => window.is_active && window.day_of_week === dayOfWeek && minutesFromTime(window.start_time) <= start && start < minutesFromTime(window.end_time))
      : undefined;
    const nextMode: RecessMode = exception ? exception.mode : defaultRecess ? "recess" : "class_time";
    const previous = segments.at(-1);
    if (previous && previous.mode === nextMode && previous.end_time === timeFromMinutes(start)) {
      previous.end_time = timeFromMinutes(end);
    } else {
      segments.push({ start_time: timeFromMinutes(start), end_time: timeFromMinutes(end), mode: nextMode });
    }
  }
  return segments;
}
