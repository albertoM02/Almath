import type { Exercise } from "./types";

export function checkAnswer(
  exercise: Exercise,
  answer: string,
): boolean | null {
  if (exercise.type === "choice") {
    if (!exercise.optionIds?.includes(answer)) return null;
    return answer === exercise.answer;
  }
  // Accept decimal commas for future Spanish input, without evaluating expressions.
  const normalized = answer.trim().replace(/−/g, "-").replace(",", ".");
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.abs(value - Number(exercise.answer)) <= (exercise.tolerance ?? 0);
}
