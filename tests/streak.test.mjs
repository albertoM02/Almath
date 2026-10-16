import assert from "node:assert/strict";
import test from "node:test";
import { bundle } from "./helpers.mjs";

const {
  emptyProgress,
  isProgressState,
  localDay,
  isCalendarDay,
  practiceDays,
  recordStreakDay,
  streakSummary,
} = bundle(`
  export * from "./learning/streak";
  export * from "./learning/progress";
  export * from "./learning/daily-goal";
`);
const progressFor = (...days) => ({ ...emptyProgress(), streak: { days } });

test("Streaks count a calendar day once and retain the longest run after a missed day", () => {
  const original = progressFor("2026-10-12", "2026-10-13", "2026-10-14");
  assert.equal(streakSummary(original, "2026-10-15").current, 3);
  assert.equal(streakSummary(original, "2026-10-15").earnedToday, false);
  const today = {
    ...original,
    streak: recordStreakDay(original, "2026-10-15"),
  };
  assert.equal(streakSummary(today, "2026-10-15").current, 4);
  assert.equal(streakSummary(today, "2026-10-15").earnedToday, true);
  assert.deepEqual(recordStreakDay(today, "2026-10-15"), today.streak);
  assert.equal(
    original.streak.days.length,
    3,
    "The previous save is not mutated",
  );
  assert.equal(streakSummary(today, "2026-10-17").current, 0);
  const restarted = { ...today, streak: recordStreakDay(today, "2026-10-17") };
  assert.equal(streakSummary(restarted, "2026-10-17").current, 1);
  assert.equal(streakSummary(restarted, "2026-10-17").best, 4);
});

test("The weekly tracker spans Monday to Sunday across month and year boundaries", () => {
  const progress = progressFor("2026-12-31", "2027-01-01");
  const result = streakSummary(progress, "2027-01-01");
  assert.deepEqual(
    result.week.map((day) => day.day),
    [
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ],
  );
  assert.equal(result.week.filter((day) => day.completed).length, 2);
  assert.equal(result.week.find((day) => day.today).day, "2027-01-01");
  assert.equal(result.week.filter((day) => day.future).length, 2);
  assert.equal(
    streakSummary(progress, "2027-01-03").week.at(-1).day,
    "2027-01-03",
  );
});

test("Local days remain consecutive across both daylight-saving changes and leap days", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Europe/Madrid";
    for (const [month, day, hours] of [
      [2, 28, 23],
      [9, 24, 25],
    ]) {
      const first = new Date(2026, month, day, 12);
      const second = new Date(2026, month, day + 1, 12);
      assert.equal((second - first) / 3_600_000, hours);
      const progress = progressFor(localDay(first), localDay(second));
      assert.equal(streakSummary(progress, localDay(second)).current, 2);
    }
    assert.equal(
      streakSummary(
        progressFor("2024-02-28", "2024-02-29", "2024-03-01"),
        "2024-03-01",
      ).current,
      3,
    );
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("Legacy correct attempts are credited, and saved local dates survive a timezone change", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Europe/Madrid";
    const original = emptyProgress();
    const attempt = {
      exerciseId: "example",
      version: 1,
      answer: "2",
      correct: true,
      hintUsed: true,
      at: "2026-10-15T23:30:00Z",
    };
    original.attempts = [
      attempt,
      attempt,
      { ...attempt, correct: false, at: "2026-10-14T12:00:00Z" },
    ];
    assert.deepEqual(practiceDays(original), ["2026-10-16"]);
    const saved = { ...original, streak: { days: practiceDays(original) } };
    assert.equal(isProgressState(saved), true);
    process.env.TZ = "America/New_York";
    assert.deepEqual(practiceDays(saved), ["2026-10-16"]);
    assert.equal(streakSummary(saved, "2026-10-16").current, 1);
    assert.deepEqual(
      practiceDays({ ...saved, attempts: [] }),
      ["2026-10-16"],
      "Earned days do not depend on retaining every answer forever",
    );
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("Future clock dates cannot award a current streak or inflate the displayed best", () => {
  const summary = streakSummary(
    progressFor("2026-10-19", "2026-10-20"),
    "2026-10-16",
  );
  assert.equal(summary.current, 0);
  assert.equal(summary.best, 0);
  assert.equal(
    summary.week.some((day) => day.completed),
    false,
  );
});

test("Legacy saves remain valid; malformed activity ledgers cannot overwrite progress", () => {
  assert.equal(isProgressState(emptyProgress()), true);
  assert.equal(isCalendarDay("2024-02-29"), true);
  for (const day of [
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-1-01",
    "2026-10-16T00:00:00Z",
    "invalid",
  ])
    assert.equal(isCalendarDay(day), false, day);
  for (const streak of [
    null,
    [],
    {},
    { days: "2026-10-16" },
    { days: [null] },
    { days: ["2026-02-30"] },
    { days: ["2026-10-16", "2026-10-16"] },
  ])
    assert.equal(isProgressState({ ...emptyProgress(), streak }), false);
  assert.equal(isProgressState(progressFor("2026-10-16")), true);
  assert.throws(() => recordStreakDay(emptyProgress(), "2026-02-30"));
});
