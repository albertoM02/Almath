import type {
  Draft,
  Exercise,
  Module,
  ProgressState,
  Session,
  View,
} from "./types";
import { isStreak } from "./streak";
import { MIXED_REVIEW_MODULE_ID } from "./review";

export function emptyProgress(): ProgressState {
  return {
    schemaVersion: 1,
    sessions: {},
    completed: {},
    attempts: [],
    reviewCounts: {},
    view: { screen: "courses" },
  };
}

export function emptyDraft(): Draft {
  return {
    answer: "",
    feedback: null,
    hintUsed: false,
    solutionRevealed: false,
    attempts: 0,
  };
}

export function getConceptPosition(conceptIds: string[], index: number) {
  const starts: number[] = [];
  for (let i = 0; i < conceptIds.length; i++) {
    if (i === 0 || conceptIds[i] !== conceptIds[i - 1]) starts.push(i);
  }
  const current = starts.filter((start) => start <= index).length;
  const start = starts[current - 1];
  const end = starts[current] ?? conceptIds.length;
  return {
    current,
    total: starts.length,
    question: index - start + 1,
    questionCount: end - start,
  };
}

export function completedCount(
  learningModule: Module,
  progress: ProgressState,
): number {
  return learningModule.exerciseIds.filter((id) => progress.completed[id])
    .length;
}

export function createSession(
  learningModule: Module,
  exercises: Exercise[],
  progress: ProgressState,
  mode: "learn" | "review",
  startAt = 0,
): Session {
  const exerciseIds = learningModule.exerciseIds.map((id) => {
    if (mode === "learn") return id;
    const alternatives = exercises
      .filter((exercise) => exercise.variantOf === id)
      .map((exercise) => exercise.id);
    const pool = [...alternatives, id];
    return pool[(progress.reviewCounts[learningModule.id] ?? 0) % pool.length];
  });
  return {
    moduleId: learningModule.id,
    contentVersion: learningModule.version,
    mode,
    exerciseIds,
    baseExerciseIds: [...learningModule.exerciseIds],
    exerciseVersions: Object.fromEntries(
      exerciseIds.map((id) => [
        id,
        exercises.find((exercise) => exercise.id === id)!.version,
      ]),
    ),
    index: startAt,
    stage: "theory",
    drafts: {},
    finished: false,
  };
}

export function refreshSession(
  learningModule: Module,
  exercises: Exercise[],
  progress: ProgressState,
  previous: Session,
): Session {
  if (previous.contentVersion === learningModule.version) return previous;
  const next = createSession(
    learningModule,
    exercises,
    progress,
    previous.mode,
  );
  for (const id of next.exerciseIds) {
    // Sessions saved before version tracking contain the original version-one questions.
    const previousVersion = previous.exerciseVersions?.[id] ?? 1;
    if (previous.drafts[id] && previousVersion === next.exerciseVersions![id])
      next.drafts[id] = previous.drafts[id];
  }
  const currentId = previous.exerciseIds[previous.index];
  const currentIndex = next.exerciseIds.indexOf(currentId);
  const firstUnfinished = next.exerciseIds.findIndex(
    (id) =>
      next.drafts[id]?.feedback !== "correct" &&
      !next.drafts[id]?.solutionRevealed,
  );
  next.index =
    !previous.finished && currentIndex >= 0
      ? currentIndex
      : Math.max(0, firstUnfinished);
  const previousConcept = exercises.find(
    (exercise) => exercise.id === currentId,
  )?.conceptId;
  const nextConcept = exercises.find(
    (exercise) => exercise.id === next.exerciseIds[next.index],
  )?.conceptId;
  next.stage = previousConcept === nextConcept ? previous.stage : "theory";
  next.finished = previous.finished && firstUnfinished === -1;
  return next;
}

export function markCompleted(
  progress: ProgressState,
  session: Session,
  result: "solved" | "reviewed",
  now: string,
): ProgressState {
  const id = session.baseExerciseIds[session.index];
  // Revisiting a solution must not erase an earlier successful answer.
  const previous = progress.completed[id];
  const completion =
    previous?.result === "solved" ? previous : { result, completedAt: now };
  return {
    ...progress,
    completed: { ...progress.completed, [id]: completion },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.keys(value).every(
      (key) => !["__proto__", "constructor", "prototype"].includes(key),
    )
  );
}

const isId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  !["__proto__", "constructor", "prototype"].includes(value);
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isVersion = (value: unknown): value is number =>
  isCount(value) && value > 0;
const isDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isId);

export function isView(value: unknown): value is View {
  if (
    !isRecord(value) ||
    !["courses", "units", "lesson", "review", "complete", "about"].includes(
      value.screen as string,
    )
  )
    return false;
  if (
    !["courseId", "sessionKey", "moduleId"].every(
      (key) => value[key] === undefined || isId(value[key]),
    )
  )
    return false;
  if (value.screen === "units" && !isId(value.courseId)) return false;
  if (
    ["lesson", "complete"].includes(value.screen as string) &&
    !isId(value.sessionKey)
  )
    return false;
  return true;
}

function isDraft(value: unknown): value is Draft {
  return (
    isRecord(value) &&
    typeof value.answer === "string" &&
    [null, "correct", "incorrect"].includes(value.feedback as null | string) &&
    typeof value.hintUsed === "boolean" &&
    typeof value.solutionRevealed === "boolean" &&
    isCount(value.attempts)
  );
}

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    isId(value.moduleId) &&
    isVersion(value.contentVersion) &&
    ["learn", "review"].includes(value.mode as string) &&
    (value.reviewScope === undefined ||
      (value.reviewScope === "all-courses" &&
        value.mode === "review" &&
        value.moduleId === MIXED_REVIEW_MODULE_ID)) &&
    isIds(value.exerciseIds) &&
    value.exerciseIds.length > 0 &&
    isIds(value.baseExerciseIds) &&
    value.baseExerciseIds.length === value.exerciseIds.length &&
    isCount(value.index) &&
    value.index < value.exerciseIds.length &&
    ["theory", "practice"].includes(value.stage as string) &&
    typeof value.finished === "boolean" &&
    isRecord(value.drafts) &&
    Object.values(value.drafts).every(isDraft) &&
    (value.exerciseVersions === undefined ||
      (isRecord(value.exerciseVersions) &&
        Object.values(value.exerciseVersions).every(isVersion)))
  );
}

export function isProgressState(value: unknown): value is ProgressState {
  // Keep legacy optional fields optional; reject malformed data without replacing it.
  if (!isRecord(value) || value.schemaVersion !== 1 || !isView(value.view))
    return false;
  if (
    !isRecord(value.sessions) ||
    !Object.values(value.sessions).every(isSession)
  )
    return false;
  if (
    !isRecord(value.completed) ||
    !Object.values(value.completed).every(
      (item) =>
        isRecord(item) &&
        ["solved", "reviewed"].includes(item.result as string) &&
        isDate(item.completedAt),
    )
  )
    return false;
  if (
    !Array.isArray(value.attempts) ||
    !value.attempts.every(
      (item) =>
        isRecord(item) &&
        isId(item.exerciseId) &&
        isVersion(item.version) &&
        typeof item.answer === "string" &&
        typeof item.correct === "boolean" &&
        typeof item.hintUsed === "boolean" &&
        isDate(item.at),
    )
  )
    return false;
  if (
    !isRecord(value.reviewCounts) ||
    !Object.values(value.reviewCounts).every(isCount)
  )
    return false;
  const goal = value.dailyGoal;
  if (value.streak !== undefined && !isStreak(value.streak)) return false;
  if (
    value.recentCourse !== undefined &&
    (!isRecord(value.recentCourse) ||
      !isId(value.recentCourse.id) ||
      !isDate(value.recentCourse.at))
  )
    return false;
  return (
    goal === undefined ||
    (isRecord(goal) &&
      isCount(goal.target) &&
      goal.target >= 1 &&
      goal.target <= 100 &&
      typeof goal.reminderEnabled === "boolean" &&
      typeof goal.reminderTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(goal.reminderTime))
  );
}
