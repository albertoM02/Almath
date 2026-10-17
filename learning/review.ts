import type { Exercise, Module, ProgressState, Session } from "./types";

export const MIXED_REVIEW_MODULE_ID = "all-courses-review";
export const MIXED_REVIEW_KEY = `${MIXED_REVIEW_MODULE_ID}:review`;

export function isMixedReview(session: Session): boolean {
  return (
    session.reviewScope === "all-courses" &&
    session.mode === "review" &&
    session.moduleId === MIXED_REVIEW_MODULE_ID
  );
}

export function completedReviewIds(
  modules: Module[],
  exercises: Exercise[],
  progress: ProgressState,
): string[] {
  const known = new Set(exercises.map((exercise) => exercise.id));
  return [...new Set(modules.flatMap((module) => module.exerciseIds))].filter(
    (id) => known.has(id) && Object.hasOwn(progress.completed, id),
  );
}

export function createMixedReview(
  modules: Module[],
  exercises: Exercise[],
  progress: ProgressState,
  random: () => number = Math.random,
): Session | undefined {
  const ids = completedReviewIds(modules, exercises, progress);
  if (!ids.length) return undefined;
  // Fisher–Yates samples each completed question exactly once per round.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const previous = progress.sessions[MIXED_REVIEW_KEY];
  if (
    previous &&
    isMixedReview(previous) &&
    previous.finished &&
    ids.length > 1 &&
    ids[0] === previous.exerciseIds[previous.index]
  ) {
    const j = 1 + Math.floor(random() * (ids.length - 1));
    [ids[0], ids[j]] = [ids[j], ids[0]];
  }
  const versions = new Map(
    exercises.map((exercise) => [exercise.id, exercise.version]),
  );
  return {
    moduleId: MIXED_REVIEW_MODULE_ID,
    contentVersion: 1,
    mode: "review",
    reviewScope: "all-courses",
    exerciseIds: ids,
    baseExerciseIds: [...ids],
    exerciseVersions: Object.fromEntries(
      ids.map((id) => [id, versions.get(id)!]),
    ),
    index: 0,
    stage: "practice",
    drafts: {},
    finished: false,
  };
}

export function hasCurrentMixedReview(
  session: Session,
  modules: Module[],
  exercises: Exercise[],
  progress: ProgressState,
): boolean {
  const eligible = new Set(completedReviewIds(modules, exercises, progress));
  const versions = new Map(
    exercises.map((exercise) => [exercise.id, exercise.version]),
  );
  return (
    isMixedReview(session) &&
    session.contentVersion === 1 &&
    session.exerciseIds.length > 0 &&
    new Set(session.exerciseIds).size === session.exerciseIds.length &&
    session.exerciseIds.length === session.baseExerciseIds.length &&
    session.exerciseIds.every(
      (id, index) =>
        eligible.has(id) &&
        id === session.baseExerciseIds[index] &&
        session.exerciseVersions?.[id] === versions.get(id),
    )
  );
}

export function refreshMixedReview(
  session: Session,
  modules: Module[],
  exercises: Exercise[],
  progress: ProgressState,
): Session | undefined {
  if (!isMixedReview(session)) return undefined;
  if (hasCurrentMixedReview(session, modules, exercises, progress))
    return session;
  const eligible = new Set(completedReviewIds(modules, exercises, progress));
  const ids = [...new Set(session.exerciseIds)].filter((id) =>
    eligible.has(id),
  );
  if (!ids.length) return undefined;
  const versions = new Map(
    exercises.map((exercise) => [exercise.id, exercise.version]),
  );
  const drafts = Object.fromEntries(
    ids
      .filter(
        (id) =>
          session.drafts[id] &&
          session.exerciseVersions?.[id] === versions.get(id),
      )
      .map((id) => [id, session.drafts[id]]),
  );
  const currentIndex = ids.indexOf(session.exerciseIds[session.index]);
  const unfinished = ids.findIndex(
    (id) => drafts[id]?.feedback !== "correct" && !drafts[id]?.solutionRevealed,
  );
  return {
    ...session,
    contentVersion: 1,
    exerciseIds: ids,
    baseExerciseIds: [...ids],
    exerciseVersions: Object.fromEntries(
      ids.map((id) => [id, versions.get(id)!]),
    ),
    drafts,
    index: currentIndex >= 0 ? currentIndex : Math.max(0, unfinished),
    stage: currentIndex >= 0 ? session.stage : "practice",
    finished: session.finished && unfinished < 0,
  };
}
