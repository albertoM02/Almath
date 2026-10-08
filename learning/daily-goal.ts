import type { DailyGoalPreferences, ProgressState } from "./types";

export const defaultDailyGoal: DailyGoalPreferences = {
  target: 5,
  reminderEnabled: false,
  reminderTime: "19:00",
};

export function localDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dailyGoalPreferences(
  progress: Pick<ProgressState, "dailyGoal">,
): DailyGoalPreferences {
  const saved = progress.dailyGoal;
  return {
    target:
      saved &&
      Number.isInteger(saved.target) &&
      saved.target >= 1 &&
      saved.target <= 100
        ? saved.target
        : defaultDailyGoal.target,
    reminderEnabled: saved?.reminderEnabled === true,
    reminderTime:
      saved && /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.reminderTime)
        ? saved.reminderTime
        : defaultDailyGoal.reminderTime,
  };
}

export function solvedToday(
  progress: Pick<ProgressState, "attempts">,
  day: string,
): number {
  // Reopening an answer or repeatedly reviewing it must not inflate a day's goal.
  // Correct review answers count again on another day; revealed solutions never
  // produce a correct attempt, so the original learning rules remain untouched.
  return new Set(
    progress.attempts
      .filter(
        (attempt) => attempt.correct && localDay(new Date(attempt.at)) === day,
      )
      .map((attempt) => attempt.exerciseId),
  ).size;
}
