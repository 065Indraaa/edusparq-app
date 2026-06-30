/**
 * Date helpers used across the workspace/chat/student APIs.
 *
 * All helpers use the local system timezone because the app currently stores
 * dates as simple YYYY-MM-DD strings and class-schedule `hari` follows the
 * user's local week (1 = Senin .. 7 = Minggu).
 */

/** Map JS getDay() to the ClassSchedule `hari` enum: 1=Senin .. 7=Minggu. */
export function getTodayHari(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days between today and a YYYY-MM-DD date. */
export function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Number.MAX_SAFE_INTEGER;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
