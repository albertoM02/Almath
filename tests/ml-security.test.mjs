import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { bundle } from "./helpers.mjs";

const {
  CourseScreen,
  LessonScreen,
  courses,
  modules,
  exercises,
  concepts,
  locale,
  outlines,
  getNextModule,
  createSession,
  emptyProgress,
  checkAnswer,
} = bundle(`
  export { CourseScreen } from "./screens/courses";
  export { LessonScreen } from "./screens/lesson";
  export { courses, modules, exercises, concepts, locale, outlines, getNextModule } from "./learning/content";
  export { createSession, emptyProgress } from "./learning/progress";
  export { checkAnswer } from "./learning/grading";
`);

const course = courses.find((item) => item.id === "ml-security");
const courseModules = course.moduleIds.map((id) =>
  modules.find((item) => item.id === id),
);
const ids = courseModules.flatMap((module) => module.exerciseIds);
const exercise = (id) => exercises.find((item) => item.id === id);

function lessonDocument(module, id) {
  const session = createSession(
    module,
    exercises,
    emptyProgress(),
    "learn",
    module.exerciseIds.indexOf(id),
  );
  assert.equal(session.stage, "theory");
  return new JSDOM(
    renderToStaticMarkup(
      React.createElement(LessonScreen, {
        session,
        saveStatus: "saved",
        validationError: "",
        onExit() {},
        onStage() {},
        onAnswer() {},
        onHint() {},
        onCheck() {},
        onSolution() {},
        onNext() {},
        onPrevious() {},
        isLast: false,
      }),
    ),
  );
}

test("ML security sits with Hardware under Other courses", () => {
  assert.equal(course.section, "other");
  const dom = new JSDOM(
    renderToStaticMarkup(
      React.createElement(CourseScreen, {
        progress: emptyProgress(),
        start() {},
        navigate() {},
      }),
    ),
  );
  assert.deepEqual(
    [...dom.window.document.querySelectorAll(".other-courses .course-card h2")]
      .map((node) => node.textContent)
      .sort(),
    ["Hardware Security Foundations", "Machine Learning Security"],
  );
  dom.window.close();
});

test("Each of the 95 ML security questions opens with its own rendered theory", () => {
  assert.equal(ids.length, 95);
  assert.equal(new Set(ids.map((id) => exercise(id).conceptId)).size, 95);
  for (const module of courseModules) {
    for (const id of module.exerciseIds) {
      const item = exercise(id);
      const theory = locale.concepts[item.conceptId];
      assert.equal(
        concepts.find((concept) => concept.id === item.conceptId).courseId,
        course.id,
      );
      const dom = lessonDocument(module, id);
      const document = dom.window.document;
      assert.equal(document.querySelector(".katex-error"), null, id);
      if (theory.formula) assert.ok(document.querySelector(".formula .katex"));
      assert.equal(
        document.querySelector(".theory-content .eyebrow").textContent,
        "ML security",
      );
      dom.window.close();
    }
  }
});

test("Every ML security answer is accepted and every wrong option is rejected", () => {
  for (const id of ids) {
    const item = exercise(id);
    assert.equal(checkAnswer(item, String(item.answer)), true, id);
    if (item.type === "choice")
      for (const option of item.optionIds)
        if (option !== item.answer)
          assert.equal(checkAnswer(item, option), false, id);
  }
});

test("Numeric ML security answers match an independent calculation", () => {
  const expected = {
    "mls-u1-q13": (200 - 46) / 200,
    "mls-u1-q14": (310 / 1000) * 100,
    "mls-u1-q15": 0.02 * 50000,
    "mls-u1-q16": (0.9 * 0.01) / (0.9 * 0.01 + 0.02 * 0.99),
    "mls-u2-q02": Math.hypot(0.03, -0.04),
    "mls-u2-q03": 0.1 * (2 + 1 + 3),
    "mls-u2-q05": 0.5 + 0.1 * Math.sign(-3),
    "mls-u2-q07": Math.min(0.56, 0.5 + 0.03),
    "mls-u2-q10": (0.62 - 0.58) / (2 * 0.01),
    "mls-u2-q11": 2 * 500 * 20,
    "mls-u2-q16": 0.25 * 2,
    "mls-u3-q04": (500 / 50000) * 100,
    "mls-u3-q10": (0.2 + 0.3) / 2,
    "mls-u4-q03": 0.6 - 0.2,
    "mls-u4-q08": 6 / 3,
    "mls-u4-q09": Math.exp(Math.log(3)),
    "mls-u4-q10": 2 / 0.5,
    "mls-u4-q11": 6 * (2 / Math.hypot(6, 8)),
    "mls-u4-q12": 25 * 0.08,
    "mls-u4-q13": 20 + 1,
    "mls-u5-q08": ((1000 * 8000) / 1e6) * 15,
    "mls-u5-q12": 1 * 0.6 + 0 * 0.8,
    "mls-u5-q13": 1 - 0.99 ** 100,
  };
  const numeric = ids.filter((id) => exercise(id).type === "number");
  assert.deepEqual([...numeric].sort(), Object.keys(expected).sort());
  for (const [id, value] of Object.entries(expected))
    assert.ok(
      Math.abs(value - exercise(id).answer) <=
        Math.max(exercise(id).tolerance, 1e-9),
      `${id}: expected about ${value}`,
    );
});

test("Choice answers are not concentrated in one position", () => {
  const counts = { a: 0, b: 0, c: 0 };
  for (const id of ids)
    if (exercise(id).type === "choice") counts[exercise(id).answer]++;
  assert.deepEqual(counts, { a: 24, b: 24, c: 24 });
});

test("ML security units run in order and teach prerequisites first", () => {
  const outline = outlines.find((item) => item.courseId === course.id);
  const units = outline.parts.flatMap((part) => part.units);
  assert.deepEqual(
    units.map((unit) => unit.number),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    units.flatMap((unit) => unit.moduleIds),
    course.moduleIds,
  );
  course.moduleIds.forEach((id, index) => {
    assert.equal(getNextModule(id)?.id, course.moduleIds[index + 1]);
  });
  const learned = new Set();
  for (const id of ids) {
    const concept = concepts.find((item) => item.id === exercise(id).conceptId);
    assert.ok(concept.prerequisites.every((item) => learned.has(item)));
    learned.add(concept.id);
  }
});

test("Adversarial example B agrees with its explanation and worked solution", () => {
  const item = exercise("mls-u2-q01");
  const text = locale.exercises[item.id];
  assert.equal(item.answer, "b");
  assert.match(text.options.b, /deliberately/);
  assert.match(text.explanation, /case B/);
  assert.match(text.solutionSteps[0], /case B/);
  assert.doesNotMatch(
    [text.explanation, ...text.solutionSteps].join(" "),
    /first case/i,
  );
});

test("Smoothing certificate states its distribution, statistical and threat-model conditions", () => {
  const item = exercise("mls-u2-q16");
  const theory = locale.concepts[item.conceptId];
  const text = locale.exercises[item.id];
  assert.match(theory.body, /isotropic noise/);
  assert.match(
    theory.body,
    /lower confidence bound, not the observed vote fraction/,
  );
  assert.match(theory.body, /abstains/);
  assert.match(
    theory.body,
    /does not certify the base classifier, correctness/,
  );
  assert.match(theory.body, /1-\\alpha/);
  assert.match(theory.formula, /underline p_A/);
  assert.match(text.statement, /statistically valid lower bound/);
  assert.equal(item.answer, 0.5);
});
