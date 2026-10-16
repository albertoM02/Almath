import { localDay } from "./daily-goal";
import type { ProgressState, Streak } from "./types";

type Activity = Pick<ProgressState, "attempts" | "streak">;

export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function isStreak(value: unknown): value is Streak {
  if (!value || typeof value !== "object" || !("days" in value)) return false;
  const days = value.days;
  return (
    Array.isArray(days) &&
    days.every(isCalendarDay) &&
    new Set(days).size === days.length
  );
}

// These are calendar labels, not instants. UTC arithmetic avoids 23/25-hour
// daylight-saving days without changing the user's recorded local dates.
export function shiftCalendarDay(day: string, offset: number): string {
  if (!isCalendarDay(day)) throw new Error("Invalid activity date");
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function practiceDays(progress: Activity): string[] {
  // Old saves have timestamps but no ledger. Infer their local dates once;
  // subsequent saves keep the dates fixed even if the device changes timezone.
  if (progress.streak) return [...progress.streak.days].sort();
  return [
    ...new Set(
      progress.attempts
        .filter((attempt) => attempt.correct)
        .map((attempt) => localDay(new Date(attempt.at))),
    ),
  ].sort();
}

export function recordStreakDay(progress: Activity, day: string): Streak {
  if (!isCalendarDay(day)) throw new Error("Invalid activity date");
  return { days: [...new Set([...practiceDays(progress), day])].sort() };
}

export function streakSummary(progress: Activity, today: string) {
  const days = practiceDays(progress).filter((day) => day <= today);
  const completed = new Set(days);
  let best = 0;
  let run = 0;
  let previous: string | undefined;
  for (const day of days) {
    run = previous && shiftCalendarDay(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  const earnedToday = completed.has(today);
  let cursor = earnedToday ? today : shiftCalendarDay(today, -1);
  let current = 0;
  while (completed.has(cursor)) {
    current++;
    cursor = shiftCalendarDay(cursor, -1);
  }
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = shiftCalendarDay(today, -((weekday + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = shiftCalendarDay(monday, index);
    return {
      day,
      completed: completed.has(day),
      today: day === today,
      future: day > today,
    };
  });
  return { current, best, earnedToday, week };
}

export type StreakSummary = ReturnType<typeof streakSummary>;
