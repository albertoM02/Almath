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
  createSession,
  emptyProgress,
  checkAnswer,
  outlines,
  getNextModule,
  refreshSession,
  emptyDraft,
  createMixedReview,
} = bundle(`
  export { CourseScreen } from "./screens/courses";
  export { LessonScreen } from "./screens/lesson";
  export { courses, modules, exercises, concepts, locale, outlines, getNextModule } from "./learning/content";
  export { createSession, emptyProgress, refreshSession, emptyDraft } from "./learning/progress";
  export { createMixedReview } from "./learning/review";
  export { checkAnswer } from "./learning/grading";
`);

test("Hardware stays below the original courses under Other courses after recent use", () => {
  const progress = emptyProgress();
  progress.recentCourse = {
    id: "hardware-security",
    at: "2026-10-19T12:00:00Z",
  };
  const dom = new JSDOM(
    renderToStaticMarkup(
      React.createElement(CourseScreen, {
        progress,
        start() {},
        navigate() {},
      }),
    ),
  );
  const document = dom.window.document;
  assert.deepEqual(
    [...document.querySelectorAll(".course-card h2")].map(
      (node) => node.textContent,
    ),
    courses.map((course) => locale.courses[course.id].title),
  );
  assert.equal(
    document.querySelector("#other-courses-title").textContent,
    "Other courses",
  );
  assert.equal(
    document.querySelectorAll(".other-courses .course-card").length,
    1,
  );
  assert.match(
    document.querySelector(".other-courses").textContent,
    /Hardware Security Foundations/,
  );
  dom.window.close();
});

test("Each of the 89 hardware questions opens with its own theory and worked example", () => {
  const course = courses.find((item) => item.id === "hardware-security");
  const ids = course.moduleIds.flatMap(
    (id) => modules.find((item) => item.id === id).exerciseIds,
  );
  assert.equal(ids.length, 89);
  assert.equal(ids.filter((id) => id.startsWith("hw-u1-")).length, 20);
  assert.equal(ids.filter((id) => id.startsWith("hw-u2-")).length, 27);
  assert.equal(ids.filter((id) => id.startsWith("hw-u3-")).length, 24);
  assert.equal(ids.filter((id) => id.startsWith("hw-u4-")).length, 18);
  assert.equal(
    new Set(ids.map((id) => exercises.find((item) => item.id === id).conceptId))
      .size,
    89,
  );
  for (const id of ids) {
    const module = modules.find((item) => item.exerciseIds.includes(id));
    const exercise = exercises.find((item) => item.id === id);
    assert.equal(
      concepts.find((item) => item.id === exercise.conceptId).courseId,
      course.id,
    );
    const session = createSession(
      module,
      exercises,
      emptyProgress(),
      "learn",
      module.exerciseIds.indexOf(id),
    );
    assert.equal(session.stage, "theory");
    const dom = new JSDOM(
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
          isLast: session.index === session.exerciseIds.length - 1,
        }),
      ),
    );
    const document = dom.window.document;
    assert.equal(
      document.querySelector(".theory-body").textContent,
      locale.concepts[exercise.conceptId].body,
    );
    if (locale.concepts[exercise.conceptId].formula) {
      assert.ok(document.querySelector(".formula .katex"));
      assert.equal(document.querySelector(".katex-error"), null);
    }
    assert.equal(
      document.querySelector(".example-panel p").textContent,
      locale.concepts[exercise.conceptId].example,
    );
    assert.equal(
      document.querySelector(".theory-content .eyebrow").textContent,
      "Hardware security",
    );
    assert.ok(
      locale.exercises[id].hint &&
        locale.exercises[id].explanation &&
        locale.exercises[id].solutionSteps.length,
    );
    assert.equal(checkAnswer(exercise, exercise.answer), true);
    assert.ok(
      exercise.optionIds
        .filter((answer) => answer !== exercise.answer)
        .every((answer) => checkAnswer(exercise, answer) === false),
    );
    dom.window.close();
  }
});

test("The four hardware units are reachable in order without changing existing question IDs", () => {
  const course = courses.find((item) => item.id === "hardware-security");
  const outline = outlines.find((item) => item.courseId === course.id);
  const units = outline.parts.flatMap((part) => part.units);
  assert.deepEqual(
    units.map((unit) => unit.number),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    units.flatMap((unit) => unit.moduleIds),
    course.moduleIds,
  );
  for (const [index, unit] of units.entries()) {
    const ids = unit.moduleIds.flatMap(
      (id) => modules.find((item) => item.id === id).exerciseIds,
    );
    assert.deepEqual(
      [...ids].sort(),
      Array.from(
        { length: [20, 27, 24, 18][index] },
        (_, i) => `hw-u${index + 1}-q${String(i + 1).padStart(2, "0")}`,
      ),
    );
  }
  course.moduleIds.forEach((id, index) => {
    assert.equal(getNextModule(id)?.id, course.moduleIds[index + 1]);
  });
});

test("New hardware lessons follow their prerequisites in the actual learning sequence", () => {
  const course = courses.find((item) => item.id === "hardware-security");
  const ids = course.moduleIds.flatMap(
    (id) => modules.find((item) => item.id === id).exerciseIds,
  );
  const before = (first, second) => {
    assert.ok(ids.includes(first) && ids.includes(second));
    assert.ok(
      ids.indexOf(first) < ids.indexOf(second),
      `${first} before ${second}`,
    );
  };
  before("hw-u1-q09", "hw-u1-q17"); // Signatures before roots of trust.
  before("hw-u1-q17", "hw-u1-q18");
  before("hw-u2-q05", "hw-u2-q16"); // Power before energy storage.
  before("hw-u2-q16", "hw-u2-q17");
  before("hw-u2-q17", "hw-u2-q18");
  before("hw-u2-q18", "hw-u2-q23");
  before("hw-u2-q10", "hw-u2-q25"); // High impedance before shared drivers.
  before("hw-u2-q13", "hw-u2-q26");
  before("hw-u2-q26", "hw-u2-q27");
  before("hw-u2-q23", "hw-u3-q01");
  before("hw-u3-q03", "hw-u3-q19");
  before("hw-u3-q10", "hw-u3-q22");
  before("hw-u3-q16", "hw-u3-q23");
  before("hw-u4-q01", "hw-u4-q13");
  before("hw-u4-q16", "hw-u4-q06");
  before("hw-u4-q17", "hw-u4-q09");
  before("hw-u4-q18", "hw-u4-q11");
  const learned = new Set();
  for (const id of ids) {
    const exercise = exercises.find((item) => item.id === id);
    const concept = concepts.find((item) => item.id === exercise.conceptId);
    assert.ok(concept.prerequisites.every((item) => learned.has(item)));
    learned.add(concept.id);
  }
});

test("Updating a 0.5.6 session teaches inserted lessons without losing saved answers", () => {
  const progress = emptyProgress();
  const module = modules.find((item) => item.id === "hw-u3-uart");
  const legacyModule = {
    ...module,
    version: 1,
    exerciseIds: ["hw-u3-q01", "hw-u3-q02", "hw-u3-q03", "hw-u3-q04"],
  };
  const previous = createSession(legacyModule, exercises, progress, "learn", 3);
  previous.stage = "practice";
  previous.drafts["hw-u3-q03"] = {
    ...emptyDraft(),
    answer: "c",
    feedback: "correct",
    attempts: 1,
  };
  previous.drafts["hw-u3-q04"] = {
    ...emptyDraft(),
    answer: "a",
    hintUsed: true,
    attempts: 1,
  };
  progress.completed["hw-u3-q03"] = {
    result: "solved",
    completedAt: "2026-10-19T12:00:00Z",
  };
  const snapshot = structuredClone(progress);
  const refreshed = refreshSession(module, exercises, progress, previous);
  assert.equal(refreshed.exerciseIds[refreshed.index], "hw-u3-q20");
  assert.equal(refreshed.stage, "theory");
  assert.deepEqual(refreshed.drafts, previous.drafts);
  assert.equal(refreshed.finished, false);
  assert.equal(refreshed.contentVersion, module.version);
  assert.deepEqual(progress, snapshot);
  const review = createMixedReview(modules, exercises, progress, () => 0);
  assert.deepEqual(review.exerciseIds, ["hw-u3-q03"]);

  previous.finished = true;
  for (const id of previous.exerciseIds) {
    previous.drafts[id] = { ...emptyDraft(), feedback: "correct" };
  }
  const reopened = refreshSession(module, exercises, progress, previous);
  assert.equal(reopened.finished, false);
  assert.equal(reopened.exerciseIds[reopened.index], "hw-u3-q20");
  assert.equal(reopened.stage, "theory");
});
