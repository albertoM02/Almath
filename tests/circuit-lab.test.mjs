import assert from "node:assert/strict";
import test from "node:test";
import { bundle } from "./helpers.mjs";

const {
  initialLab,
  questionControls,
  matchesQuestion,
  resistorCurrent,
  sharedLine,
  isLabState,
  emptyProgress,
  emptyDraft,
  createSession,
  refreshSession,
  isProgressState,
  modules,
  exercises,
  encryptProgress,
  decryptProgress,
  createMixedReview,
} = bundle(`
  export * from './learning/circuit-lab';
  export * from './learning/progress';
  export { modules, exercises } from './learning/content';
  export { encryptProgress, decryptProgress } from './learning/backup';
  export { createMixedReview } from './learning/review';
`);

test("Circuit models use fixed voltage and all eight open-drain combinations", () => {
  assert.equal(resistorCurrent(1), 3);
  assert.equal(resistorCurrent(3), 1);
  assert.equal(resistorCurrent(5), 0.6);
  for (const bad of [0, -1, NaN, Infinity])
    assert.throws(() => resistorCurrent(bad));
  for (const aLow of [false, true])
    for (const bLow of [false, true])
      for (const pullUp of [false, true]) {
        const result = sharedLine({ resistance: 3, aLow, bLow, pullUp });
        assert.deepEqual(
          result,
          aLow || bLow
            ? { state: "LOW", voltage: 0 }
            : pullUp
              ? { state: "HIGH", voltage: 3.3 }
              : { state: "Undefined", voltage: null },
        );
      }
});

test("Question setups are distinct from freely explored settings", () => {
  for (const kind of ["ohms-law", "open-drain"]) {
    assert.equal(matchesQuestion(kind, questionControls(kind)), true);
    assert.equal(isLabState(initialLab(kind)), true);
  }
  assert.equal(
    matchesQuestion("ohms-law", {
      ...questionControls("ohms-law"),
      resistance: 1,
    }),
    false,
  );
  assert.equal(
    matchesQuestion("open-drain", {
      ...questionControls("open-drain"),
      aLow: false,
    }),
    false,
  );
});

test("Legacy progress remains valid; optional lab drafts validate and survive encrypted backups", async () => {
  const p = emptyProgress();
  assert.equal(isProgressState(p), true);
  const m = modules.find((m) => m.id === "hw-u2-electricity");
  const session = createSession(m, exercises, p, "learn");
  const lab = {
    ...initialLab("ohms-law"),
    phase: "test",
    controls: questionControls("ohms-law"),
  };
  session.drafts["hw-u2-q28"] = { ...emptyDraft(), answer: "a", lab };
  p.sessions.lab = session;
  assert.equal(isProgressState(p), true);
  const password = "a long private test passphrase";
  assert.deepEqual(
    await decryptProgress(await encryptProgress(p, password), password),
    p,
  );
  for (const changes of [
    { version: 2 },
    { phase: "broken" },
    { controls: { ...lab.controls, resistance: 0 } },
    { controls: { ...lab.controls, pullUp: "yes" } },
  ]) {
    const bad = structuredClone(p);
    bad.sessions.lab.drafts["hw-u2-q28"].lab = { ...lab, ...changes };
    assert.equal(isProgressState(bad), false);
  }
});

test("Both 0.6.2 modules retain existing drafts and history when labs are inserted", () => {
  const p = emptyProgress();
  for (const [moduleId, labId, nextId, legacyVersion] of [
    ["hw-u2-electricity", "hw-u2-q28", "hw-u2-q05", 1],
    ["hw-u2-signals", "hw-u2-q29", "hw-u2-q25", 2],
  ]) {
    const m = modules.find((m) => m.id === moduleId);
    const old = {
      ...m,
      version: legacyVersion,
      exerciseIds: m.exerciseIds.filter((id) => id !== labId),
    };
    const previous = createSession(
      old,
      exercises,
      p,
      "learn",
      old.exerciseIds.indexOf(nextId),
    );
    previous.stage = "practice";
    previous.drafts[nextId] = {
      ...emptyDraft(),
      answer: "saved",
      hintUsed: true,
      attempts: 2,
    };
    p.completed[old.exerciseIds[0]] = {
      result: "solved",
      completedAt: "2026-10-24T12:00:00Z",
    };
    const snapshot = structuredClone(p);
    const next = refreshSession(m, exercises, p, previous);
    assert.equal(next.exerciseIds[next.index], labId);
    assert.deepEqual(next.drafts, previous.drafts);
    assert.deepEqual(p, snapshot);
    previous.finished = true;
    for (const id of old.exerciseIds)
      previous.drafts[id] = { ...emptyDraft(), feedback: "correct" };
    const reopened = refreshSession(m, exercises, p, previous);
    assert.equal(reopened.finished, false);
    assert.equal(reopened.exerciseIds[reopened.index], labId);
  }
  const review = createMixedReview(modules, exercises, p, () => 0);
  assert.ok(review.exerciseIds.every((id) => p.completed[id]));
  assert.ok(!review.exerciseIds.includes("hw-u2-q28"));
});
