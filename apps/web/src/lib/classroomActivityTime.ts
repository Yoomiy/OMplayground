export function formatClassroomFullDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
}

function calendarDayDistance(earlier: Date, later: Date): number {
  const earlierDay = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const laterDay = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((laterDay.getTime() - earlierDay.getTime()) / 86_400_000);
}

export function formatClassroomActivity(value: string | null, now = new Date()): string {
  if (!value) return "—";

  const activity = new Date(value);
  if (Number.isNaN(activity.getTime()) || activity > now) return Number.isNaN(activity.getTime()) ? "—" : formatClassroomFullDate(value);

  const elapsedSeconds = Math.floor((now.getTime() - activity.getTime()) / 1_000);
  const dayDistance = calendarDayDistance(activity, now);

  if (dayDistance === 0) {
    if (elapsedSeconds < 60) return "עכשיו";

    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return minutes === 1 ? "לפני דקה" : `לפני ${minutes} דקות`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "לפני שעה";
    if (hours === 2) return "לפני שעתיים";
    return `לפני ${hours} שעות`;
  }

  if (dayDistance === 1) return `אתמול, ${formatTime(activity)}`;
  if (dayDistance <= 7) return dayDistance === 2 ? "לפני יומיים" : `לפני ${dayDistance} ימים`;

  return formatClassroomFullDate(value);
}
