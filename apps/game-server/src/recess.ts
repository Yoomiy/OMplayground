/**
 * Recess windows use Asia/Jerusalem; day_of_week 0 = Sunday … 6 = Saturday.
 * Times are "HH:MM" 24h strings (lexicographic compare works).
 */

export interface RecessWindowRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

function jerusalemParts(d: Date): { dow: number; hm: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  });
  const parts = fmt.formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const hm = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  const dowFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short"
  });
  const wd = dowFmt.format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const dow = map[wd] ?? 0;
  return { dow, hm };
}

export function isWithinRecess(
  now: Date,
  schedules: RecessWindowRow[]
): boolean {
  const { dow, hm } = jerusalemParts(now);
  return schedules.some(
    (s) =>
      s.is_active &&
      s.day_of_week === dow &&
      hm >= s.start_time &&
      hm <= s.end_time
  );
}
