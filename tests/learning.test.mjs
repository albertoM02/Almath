import assert from "node:assert/strict";
import test from "node:test";
import { bundle } from "./helpers.mjs";

const {
  emptyProgress,
  emptyDraft,
  createSession,
  refreshSession,
  markCompleted,
  isProgressState,
  checkAnswer,
  dailyGoalPreferences,
  solvedToday,
  localDay,
  modules,
  exercises,
  restoredView,
} = bundle(
  `export * from "./learning/progress"; export * from "./learning/grading"; export * from "./learning/daily-goal"; export * from "./learning/navigation"; export { modules, exercises } from "./learning/content";`,
);

test("Every declared answer is accepted; expression input is never evaluated", () => {
  for (const exercise of exercises)
    assert.equal(
      checkAnswer(exercise, String(exercise.answer)),
      true,
      exercise.id,
    );
  const exercise = { type: "number", answer: 1.5, tolerance: 0.01 };
  assert.equal(checkAnswer(exercise, "1,5"), true);
  for (const input of ["", "1+0.5", "Infinity", "NaN", "1e1000", "<script>"])
    assert.equal(checkAnswer(exercise, input), null);
  assert.equal(checkAnswer(exercise, "2"), false);
});

test("Deep progress validation retains legacy saves and rejects malformed nested fields", () => {
  const valid = emptyProgress();
  const session = createSession(modules[0], exercises, valid, "learn");
  delete session.exerciseVersions;
  valid.sessions.example = session;
  assert.equal(isProgressState(valid), true);
  const mutate = (change) => {
    const state = structuredClone(valid);
    change(state);
    assert.equal(isProgressState(state), false);
  };
  for (const field of ["sessions", "completed", "reviewCounts"])
    mutate((s) => {
      s[field] = [];
    });
  mutate((s) => {
    s.attempts = [null];
  });
  mutate((s) => {
    s.sessions.example.drafts.bad = {};
  });
  mutate((s) => {
    s.sessions.example.index = -1;
  });
  mutate((s) => {
    s.sessions.example.index = session.exerciseIds.length;
  });
  mutate((s) => {
    s.sessions.example.baseExerciseIds = [];
  });
  mutate((s) => {
    s.sessions.example.exerciseVersions = { x: NaN };
  });
  mutate((s) => {
    s.view = { screen: "units" };
  });
  mutate((s) => {
    s.view = { screen: "complete" };
  });
  mutate((s) => {
    s.view.screen = "unexpected";
  });
  mutate((s) => {
    s.completed.x = { result: "solved", completedAt: "not a date" };
  });
  mutate((s) => {
    s.reviewCounts.x = -1;
  });
  mutate((s) => {
    s.dailyGoal = { target: 5, reminderEnabled: true, reminderTime: "25:00" };
  });
  mutate((s) => {
    s.schemaVersion = 2;
  });
  mutate((s) => {
    Object.defineProperty(s.sessions, "__proto__", {
      value: session,
      enumerable: true,
    });
  });
  valid.dailyGoal = {
    target: 5,
    reminderEnabled: false,
    reminderTime: "19:00",
  };
  valid.attempts = [
    {
      exerciseId: exercises[0].id,
      version: 1,
      answer: "1",
      correct: false,
      hintUsed: true,
      at: new Date().toISOString(),
    },
  ];
  valid.sessions.example.drafts[session.exerciseIds[0]] = emptyDraft();
  assert.equal(isProgressState(valid), true);
});

test("Content refresh retains compatible drafts and completed answers", () => {
  const progress = emptyProgress(),
    module = modules[0];
  const session = createSession(module, exercises, progress, "learn");
  session.contentVersion = module.version - 1;
  session.drafts[session.exerciseIds[0]] = {
    ...emptyDraft(),
    feedback: "correct",
  };
  const refreshed = refreshSession(module, exercises, progress, session);
  assert.equal(refreshed.drafts[session.exerciseIds[0]].feedback, "correct");
  const solved = markCompleted(
    progress,
    refreshed,
    "solved",
    "2026-10-10T10:00:00Z",
  );
  assert.deepEqual(
    markCompleted(solved, refreshed, "reviewed", "2026-10-10T11:00:00Z")
      .completed,
    solved.completed,
  );
});

test("Daily goals count unique correct answers for the local day", () => {
  const now = new Date(2026, 9, 10, 12),
    day = localDay(now);
  const attempt = { exerciseId: "a", correct: true, at: now.toISOString() };
  assert.equal(
    solvedToday(
      {
        attempts: [
          attempt,
          attempt,
          { ...attempt, exerciseId: "b", correct: false },
          {
            ...attempt,
            exerciseId: "c",
            at: new Date(2026, 9, 9, 12).toISOString(),
          },
        ],
      },
      day,
    ),
    1,
  );
  assert.equal(dailyGoalPreferences(emptyProgress()).target, 5);
});

test("History views cannot restore missing courses or incomplete completion screens", () => {
  const progress = emptyProgress();
  for (const view of [
    null,
    { screen: "units" },
    { screen: "complete" },
    { screen: "units", courseId: "missing" },
    { screen: "lesson", sessionKey: "missing" },
  ])
    assert.deepEqual(restoredView(view, progress), { screen: "courses" });
  progress.sessions.example = createSession(
    modules[0],
    exercises,
    progress,
    "learn",
  );
  assert.equal(
    restoredView({ screen: "complete", sessionKey: "example" }, progress)
      .screen,
    "lesson",
  );
  progress.sessions.example.exerciseIds[
    progress.sessions.example.exerciseIds.length - 1
  ] = "removed-exercise";
  assert.deepEqual(
    restoredView({ screen: "lesson", sessionKey: "example" }, progress),
    { screen: "courses" },
  );
});
