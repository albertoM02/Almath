import assert from "node:assert/strict";
import test from "node:test";
import { bundle } from "./helpers.mjs";

const {
  coursesByRecentUse,
  courses,
  modules,
  exercises,
  emptyProgress,
  isProgressState,
  mergeProgress,
} = bundle(`
  export * from "./learning/course-order";
  export * from "./learning/progress";
  export { mergeProgress } from "./learning/backup";
  export { courses, modules, exercises } from "./learning/content";
`);
const order = (progress) =>
  coursesByRecentUse(courses, modules, exercises, progress).map(
    (course) => course.id,
  );

test("Recent course order preserves legacy saves, resolves variants and never mutates course content", () => {
  const progress = emptyProgress();
  const original = courses.map((course) => course.id);
  assert.deepEqual(order(progress), original);
  const ml = modules.find((module) => module.courseId === "ml");
  const exercise =
    exercises.find((item) => item.variantOf === ml.exerciseIds[0]) ??
    exercises.find((item) => item.id === ml.exerciseIds[0]);
  progress.attempts.push({
    exerciseId: exercise.id,
    version: exercise.version,
    answer: "0",
    correct: false,
    hintUsed: false,
    at: "2026-10-16T12:00:00Z",
  });
  assert.equal(order(progress)[0], "ml");
  progress.recentCourse = { id: "cs", at: "2026-10-17T12:00:00Z" };
  assert.equal(order(progress)[0], "cs");
  progress.recentCourse.id = "removed-course";
  assert.equal(order(progress)[0], "ml");
  assert.deepEqual(
    courses.map((course) => course.id),
    original,
  );
  assert.equal(isProgressState(emptyProgress()), true);
});

test("Recent course metadata is validated and the newest choice survives backup merging", () => {
  const current = emptyProgress();
  const imported = emptyProgress();
  current.recentCourse = { id: "cs", at: "2026-10-15T12:00:00Z" };
  imported.recentCourse = { id: "ml", at: "2026-10-16T12:00:00Z" };
  assert.equal(isProgressState(current), true);
  assert.deepEqual(
    mergeProgress(current, imported).recentCourse,
    imported.recentCourse,
  );
  assert.deepEqual(
    mergeProgress(imported, current).recentCourse,
    imported.recentCourse,
  );
  current.recentCourse.at = "invalid";
  assert.equal(isProgressState(current), false);
  current.recentCourse = { id: "", at: "2026-10-15T12:00:00Z" };
  assert.equal(isProgressState(current), false);
});
