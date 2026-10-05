import type { Draft, Exercise, Module, ProgressState, Session } from "./types";

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

export function isProgressState(value: unknown): value is ProgressState {
  if (!value || typeof value !== "object") return false;
  const state = value as ProgressState;
  return (
    state.schemaVersion === 1 &&
    !!state.sessions &&
    !!state.completed &&
    Array.isArray(state.attempts) &&
    !!state.reviewCounts &&
    !!state.view &&
    typeof state.view.screen === "string"
  );
}
