import assert from "node:assert/strict";
import test from "node:test";
import { bundle } from "./helpers.mjs";

const {
  completedReviewIds,
  createMixedReview,
  refreshMixedReview,
  hasCurrentMixedReview,
  MIXED_REVIEW_KEY,
  emptyProgress,
  emptyDraft,
  isProgressState,
  restoredView,
  modules,
  exercises,
} = bundle(`
  export * from "./learning/review";
  export * from "./learning/progress";
  export * from "./learning/navigation";
  export { modules, exercises } from "./learning/content";
`);
const cs = modules.find(
  (module) => module.courseId === "cs" && !module.archived,
);
const ml = modules.find(
  (module) => module.courseId === "ml" && !module.archived,
);
const selected = [...cs.exerciseIds.slice(0, 2), ...ml.exerciseIds.slice(0, 2)];
function fixture() {
  const progress = emptyProgress();
  for (const [index, id] of selected.entries())
    progress.completed[id] = {
      result: index === 0 ? "reviewed" : "solved",
      completedAt: "2026-10-16T12:00:00Z",
    };
  return progress;
}

test("Review includes individual completions from every course, never unfinished questions or unseen variants", () => {
  const progress = fixture();
  progress.completed.removed = {
    result: "solved",
    completedAt: "2026-10-16T12:00:00Z",
  };
  const before = structuredClone(progress);
  assert.deepEqual(
    new Set(completedReviewIds(modules, exercises, progress)),
    new Set(selected),
  );
  const session = createMixedReview(modules, exercises, progress, () => 0);
  assert.deepEqual(new Set(session.exerciseIds), new Set(selected));
  assert.equal(session.exerciseIds.length, selected.length);
  assert.notDeepEqual(
    session.exerciseIds,
    selected,
    "The pool is shuffled, not left in course order",
  );
  assert.equal(session.stage, "practice");
  assert.deepEqual(session.exerciseIds, session.baseExerciseIds);
  assert.deepEqual(
    progress,
    before,
    "Starting review never changes completion records",
  );
  progress.sessions[MIXED_REVIEW_KEY] = session;
  assert.equal(isProgressState(progress), true);
});

test("Empty pools cannot start; a single completed question stays usable", () => {
  const progress = emptyProgress();
  assert.equal(createMixedReview(modules, exercises, progress), undefined);
  progress.completed[selected[0]] = fixture().completed[selected[0]];
  const session = createMixedReview(modules, exercises, progress);
  assert.deepEqual(session.exerciseIds, [selected[0]]);
  assert.equal(
    hasCurrentMixedReview(session, modules, exercises, progress),
    true,
  );
});

test("Resuming keeps the same order and answer; new completions join the next round", () => {
  const progress = fixture();
  const session = createMixedReview(modules, exercises, progress, () => 0);
  session.index = 1;
  session.drafts[session.exerciseIds[0]] = {
    ...emptyDraft(),
    feedback: "correct",
  };
  session.drafts[session.exerciseIds[1]] = {
    ...emptyDraft(),
    answer: "unfinished answer",
    hintUsed: true,
  };
  progress.sessions[MIXED_REVIEW_KEY] = session;
  const extra = modules
    .flatMap((module) => module.exerciseIds)
    .find((id) => !selected.includes(id));
  progress.completed[extra] = {
    result: "solved",
    completedAt: "2026-10-16T12:00:00Z",
  };
  assert.strictEqual(
    refreshMixedReview(session, modules, exercises, progress),
    session,
  );
  assert.equal(session.exerciseIds.includes(extra), false);
  session.finished = true;
  session.index = session.exerciseIds.length - 1;
  const next = createMixedReview(modules, exercises, progress, () => 0);
  assert.equal(next.exerciseIds.includes(extra), true);
  assert.deepEqual(next.drafts, {});
  assert.equal(next.index, 0);
});

test("A new round does not immediately repeat the preceding round's last question", () => {
  const progress = fixture();
  const previous = createMixedReview(modules, exercises, progress, () => 0);
  // Put the next deterministic shuffle's first question at the end of the old round.
  const [first, ...rest] = previous.exerciseIds;
  previous.exerciseIds = [...rest, first];
  previous.baseExerciseIds = [...previous.exerciseIds];
  previous.finished = true;
  previous.index = previous.exerciseIds.length - 1;
  progress.sessions[MIXED_REVIEW_KEY] = previous;
  const next = createMixedReview(modules, exercises, progress, () => 0);
  assert.notEqual(next.exerciseIds[0], first);
  assert.deepEqual(new Set(next.exerciseIds), new Set(selected));
});

test("Content updates keep the remaining shuffle and compatible drafts without admitting new questions", () => {
  const progress = fixture();
  const session = createMixedReview(modules, exercises, progress, () => 0);
  const [removed, changed, retained] = session.exerciseIds;
  session.index = 2;
  for (const id of session.exerciseIds)
    session.drafts[id] = { ...emptyDraft(), feedback: "correct" };
  session.finished = true;
  const updated = exercises
    .filter((exercise) => exercise.id !== removed)
    .map((exercise) =>
      exercise.id === changed
        ? { ...exercise, version: exercise.version + 1 }
        : exercise,
    );
  const refreshed = refreshMixedReview(session, modules, updated, progress);
  assert.deepEqual(
    refreshed.exerciseIds,
    session.exerciseIds.filter((id) => id !== removed),
  );
  assert.equal(refreshed.exerciseIds[refreshed.index], retained);
  assert.equal(refreshed.drafts[retained].feedback, "correct");
  assert.equal(refreshed.drafts[changed], undefined);
  assert.equal(refreshed.finished, false);
  assert.equal(
    hasCurrentMixedReview(refreshed, modules, updated, progress),
    true,
  );
  assert.deepEqual(progress.completed, fixture().completed);
});

test("Mixed review restores safely and rejects mismatched, duplicate, or uncompleted questions", () => {
  const progress = fixture();
  const session = createMixedReview(modules, exercises, progress);
  progress.sessions[MIXED_REVIEW_KEY] = session;
  const view = { screen: "lesson", sessionKey: MIXED_REVIEW_KEY };
  assert.deepEqual(restoredView(view, progress), view);
  assert.equal(isProgressState(JSON.parse(JSON.stringify(progress))), true);
  const corrupt = structuredClone(progress);
  corrupt.sessions[MIXED_REVIEW_KEY].reviewScope = "unknown";
  assert.equal(isProgressState(corrupt), false);
  corrupt.sessions[MIXED_REVIEW_KEY].reviewScope = "all-courses";
  corrupt.sessions[MIXED_REVIEW_KEY].mode = "learn";
  assert.equal(isProgressState(corrupt), false);
  session.exerciseIds[1] = session.exerciseIds[0];
  session.baseExerciseIds[1] = session.exerciseIds[0];
  assert.deepEqual(restoredView(view, progress), { screen: "review" });
  delete progress.completed[session.exerciseIds[0]];
  assert.equal(
    hasCurrentMixedReview(session, modules, exercises, progress),
    false,
  );
});
