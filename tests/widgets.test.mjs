import assert from "node:assert/strict";
import test from "node:test";
import { bundle } from "./helpers.mjs";

const {
  widgetText,
  widgetConceptPreview,
  WIDGET_TITLE_LIMIT,
  WIDGET_EXCERPT_LIMIT,
  WIDGET_FORMULA_LIMIT,
  widgetSnapshot,
  widgetConceptTarget,
  emptyProgress,
  createSession,
  modules,
  exercises,
  locale,
} = bundle(`
  export * from "./learning/widget";
  export { emptyProgress, createSession } from "./learning/progress";
  export { modules, exercises, locale } from "./learning/content";
`);

test("Widget snapshots reuse completed course theory, stay bounded and do not mutate progress", () => {
  const progress = emptyProgress();
  for (const e of exercises)
    progress.completed[e.id] = {
      result: "solved",
      completedAt: "2026-10-22T12:00:00Z",
    };
  const before = JSON.stringify(progress);
  const snapshot = widgetSnapshot(progress, "2026-10-22");
  assert.equal(snapshot.concepts.length, 30);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 32000);
  for (const c of snapshot.concepts) {
    assert.ok(
      exercises.some((e) => e.conceptId === c.id && progress.completed[e.id]),
    );
    const text = locale.concepts[c.id];
    assert.ok(
      [text.body, text.takeaway, text.example, text.title]
        .map(widgetText)
        .includes(c.excerpt),
    );
    assert.doesNotMatch(c.excerpt, /\\[a-z]+|\\[()[\]]/);
  }
  assert.equal(JSON.stringify(progress), before);
});

test("A new learner sees an existing introductory concept; unknown completions are ignored", () => {
  const progress = emptyProgress();
  progress.completed.deleted = {
    result: "reviewed",
    completedAt: "2026-10-22T12:00:00Z",
  };
  const snapshot = widgetSnapshot(progress, "2026-10-22");
  assert.equal(snapshot.concepts.length, 1);
  assert.ok(locale.concepts[snapshot.concepts[0].id]);
  assert.equal(snapshot.streak, 0);
  assert.equal(snapshot.solved, 0);
  assert.equal(snapshot.target, 5);
});

test("Widget daily progress shares the app rules: unique correct exercises, review and local calendar days", () => {
  const progress = emptyProgress();
  progress.dailyGoal = {
    target: 7,
    reminderEnabled: false,
    reminderTime: "19:00",
  };
  progress.streak = { days: ["2026-10-21", "2026-10-22"] };
  const at = new Date(2026, 9, 22, 12).toISOString();
  const attempt = (id, correct) => ({
    exerciseId: id,
    version: 1,
    answer: "",
    correct,
    hintUsed: false,
    at,
  });
  progress.attempts = [
    attempt("a", true),
    attempt("a", true),
    attempt("b", false),
    attempt("c", true),
  ];
  const today = widgetSnapshot(progress, "2026-10-22");
  assert.equal(today.streak, 2);
  assert.equal(today.earnedToday, true);
  assert.equal(today.solved, 2);
  assert.equal(today.target, 7);
  const tomorrow = widgetSnapshot(progress, "2026-10-23");
  assert.equal(tomorrow.streak, 2);
  assert.equal(tomorrow.earnedToday, false);
  assert.equal(tomorrow.solved, 0);
  assert.equal(widgetSnapshot(progress, "2026-10-24").streak, 0);
});

test("Widget notation converts simple expressions and omits complex LaTeX without corrupting it", () => {
  assert.equal(
    widgetText("\\(a \\cdot b = a_{1}b_{1} + a_{2}b_{2}\\)"),
    "a · b = a₁b₁ + a₂b₂",
  );
  assert.equal(widgetText("\\(P \\to Q\\)"), "P → Q");
  assert.equal(widgetText("\\(\\frac{a}{b}\\)"), null);
  assert.equal(widgetText("\\(\\sum_i x_i\\)"), null);
});

test("Widget concept taps locate existing lessons across all courses without altering saved answers", () => {
  const progress = emptyProgress();
  for (const course of ["cs", "ml", "hardware-security"]) {
    const module = modules.find((m) => m.courseId === course && !m.archived);
    if (!module) {
      assert.fail(`Missing course ${course}`);
    }
    const session = createSession(module, exercises, progress, "learn");
    session.index = Math.min(1, session.exerciseIds.length - 1);
    session.drafts[session.exerciseIds[0]] = {
      answer: "saved",
      feedback: null,
      hintUsed: true,
      solutionRevealed: false,
      attempts: 1,
    };
    progress.sessions[`${module.id}:learn`] = session;
    const concept = exercises.find(
      (e) => e.id === module.exerciseIds[0],
    ).conceptId;
    const before = JSON.stringify(progress);
    const target = widgetConceptTarget(concept, progress);
    assert.equal(target.moduleId, module.id);
    assert.equal(target.index, 0);
    assert.equal(JSON.stringify(progress), before);
  }
  assert.equal(widgetConceptTarget("deleted", progress), undefined);
});

test("Widget previews prefer complete short existing text and never slice long explanations", () => {
  const text = {
    title: "Vectors",
    body: "A".repeat(200),
    takeaway: "Match the component order.",
    example: "A".repeat(180),
    formula: "x = (1, 2)",
    exampleSteps: [],
  };
  const preview = widgetConceptPreview("vectors", text);
  assert.equal(preview.excerpt, text.takeaway);
  assert.equal(preview.title, text.title);
  assert.equal(
    widgetConceptPreview("vectors", { ...text, takeaway: "A".repeat(111) }),
    undefined,
  );
  assert.equal(
    widgetConceptPreview("vectors", { ...text, title: "A".repeat(61) }),
    undefined,
  );
  assert.equal(
    widgetConceptPreview("vectors", { ...text, formula: "x".repeat(37) })
      .formula,
    "",
  );
});

test("Every cached concept stays within the widget display limits across the full curriculum", () => {
  const progress = emptyProgress();
  for (const e of exercises)
    progress.completed[e.id] = {
      result: "solved",
      completedAt: "2026-10-22T12:00:00Z",
    };
  for (const day of [
    "2026-10-24",
    "2026-11-24",
    "2026-12-24",
    "2027-01-24",
    "2027-02-24",
    "2027-03-24",
  ]) {
    const snapshot = widgetSnapshot(progress, day);
    for (const c of snapshot.concepts) {
      assert.ok(c.title.length <= WIDGET_TITLE_LIMIT);
      assert.ok(c.excerpt.length <= WIDGET_EXCERPT_LIMIT);
      assert.ok(c.formula.length <= WIDGET_FORMULA_LIMIT);
    }
  }
});
