import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bundle } from "./helpers.mjs";

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

test("Opening a course moves it to the top and keeps that order after reopening", async () => {
  const { emptyProgress } = bundle(
    'export { emptyProgress } from "./learning/progress";',
  );
  const factory = new IDBFactory();
  await put(factory, emptyProgress());
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    const cards = [...dom.window.document.querySelectorAll(".course-card")];
    assert.match(cards[1].textContent, /Machine Learning/);
    await act(async () => {
      [...cards[1].querySelectorAll("button")]
        .find((button) => button.textContent.includes("View units"))
        .click();
      await wait();
    });
    assert.equal((await read(factory)).recentCourse.id, "ml");
    await act(async () => {
      dom.window.dispatchEvent(
        new dom.window.PopStateEvent("popstate", {
          state: { view: { screen: "courses" } },
        }),
      );
      await wait();
    });
    assert.match(
      dom.window.document.querySelector(".course-card").textContent,
      /Machine Learning/,
    );
  });
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    assert.match(
      dom.window.document.querySelector(".course-card").textContent,
      /Machine Learning/,
    );
  });
});

test("Cross-course Review starts, resumes after reopening, saves answers and reshuffles after completion", async () => {
  const {
    emptyProgress,
    emptyDraft,
    createSession,
    modules,
    exercises,
    locale,
    MIXED_REVIEW_KEY,
  } = bundle(`
    export * from "./learning/progress";
    export * from "./learning/review";
    export { modules, exercises, locale } from "./learning/content";
  `);
  const factory = new IDBFactory();
  const progress = emptyProgress();
  const cs = modules.find(
    (module) => module.courseId === "cs" && !module.archived,
  );
  const ml = modules.find(
    (module) => module.courseId === "ml" && !module.archived,
  );
  const ids = [...cs.exerciseIds.slice(0, 2), ...ml.exerciseIds.slice(0, 2)];
  for (const id of ids)
    progress.completed[id] = {
      result: "solved",
      completedAt: "2026-10-15T12:00:00Z",
    };
  const learning = createSession(cs, exercises, progress, "learn");
  learning.drafts[learning.exerciseIds[0]] = {
    ...emptyDraft(),
    answer: "existing learning answer",
    hintUsed: true,
  };
  progress.sessions[`${cs.id}:learn`] = learning;
  progress.view = { screen: "review" };
  await put(factory, progress);
  const click = async (dom, text) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (item) => item.textContent.trim() === text,
    );
    assert.ok(button, `Missing button: ${text}`);
    await act(async () => {
      button.click();
      await wait();
    });
  };
  let order;
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    assert.match(
      dom.window.document.querySelector(".mixed-review").textContent,
      new RegExp(`${ids.length} completed questions across 2 courses`),
    );
    await click(dom, "Start shuffled review");
    const saved = await read(factory);
    const session = saved.sessions[MIXED_REVIEW_KEY];
    order = [...session.exerciseIds];
    assert.deepEqual(new Set(order), new Set(ids));
    assert.equal(session.stage, "practice");
    assert.match(
      dom.window.document.body.textContent,
      new RegExp(`Question 1 of ${ids.length}`),
    );
    const sourceModule = modules.find((module) =>
      module.exerciseIds.includes(order[0]),
    );
    assert.equal(
      dom.window.document.querySelector(".lesson-module-title").textContent,
      locale.courses[sourceModule.courseId].category,
    );
    await click(dom, "Exit");
    assert.equal((await read(factory)).view.screen, "review");
    await click(dom, "Resume review");
    assert.deepEqual(
      (await read(factory)).sessions[MIXED_REVIEW_KEY].exerciseIds,
      order,
    );
  });
  // Resume a real saved draft and submit it through the app's normal grading path.
  const pending = await read(factory);
  const session = pending.sessions[MIXED_REVIEW_KEY];
  const first = exercises.find((exercise) => exercise.id === order[0]);
  session.drafts[first.id] = { ...emptyDraft(), answer: String(first.answer) };
  await put(factory, pending);
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    assert.deepEqual(
      (await read(factory)).sessions[MIXED_REVIEW_KEY].exerciseIds,
      order,
    );
    await click(dom, "Check answer");
    const saved = await read(factory);
    assert.equal(saved.attempts.at(-1).exerciseId, first.id);
    assert.equal(saved.attempts.at(-1).correct, true);
    assert.ok(saved.streak.days.length);
    assert.deepEqual(saved.sessions[`${cs.id}:learn`], learning);
    assert.deepEqual(saved.completed, progress.completed);
    await click(dom, "Next question");
    assert.equal((await read(factory)).sessions[MIXED_REVIEW_KEY].index, 1);
    assert.equal(
      (await read(factory)).sessions[MIXED_REVIEW_KEY].stage,
      "practice",
    );
    await click(dom, "Exit");
    assert.match(
      dom.window.document.querySelector(".mixed-review").textContent,
      new RegExp(`1 of ${ids.length} questions reviewed this round`),
    );
    await click(dom, "Resume review");
    assert.equal((await read(factory)).sessions[MIXED_REVIEW_KEY].index, 1);
  });
  const finishing = await read(factory);
  const round = finishing.sessions[MIXED_REVIEW_KEY];
  for (const id of round.exerciseIds)
    round.drafts[id] = { ...emptyDraft(), feedback: "correct" };
  round.index = round.exerciseIds.length - 1;
  await put(factory, finishing);
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    await click(dom, "Finish review");
    assert.equal((await read(factory)).view.screen, "complete");
    assert.match(
      dom.window.document.querySelector(".completion-card").textContent,
      /You’ve reviewed every question in this round/,
    );
    await click(dom, "Shuffle again");
    const saved = await read(factory);
    const next = saved.sessions[MIXED_REVIEW_KEY];
    assert.equal(saved.view.screen, "lesson");
    assert.equal(next.finished, false);
    assert.deepEqual(new Set(next.exerciseIds), new Set(ids));
    assert.notEqual(next.exerciseIds[0], order.at(-1));
    assert.deepEqual(next.drafts, {});
    assert.deepEqual(saved.sessions[`${cs.id}:learn`], learning);
    assert.deepEqual(saved.completed, progress.completed);
  });
});

async function database(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open("almath-progress", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("progress");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function put(factory, value) {
  const db = await database(factory);
  await new Promise((resolve, reject) => {
    const tx = db.transaction("progress", "readwrite");
    tx.objectStore("progress").put(value, "current");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function read(factory) {
  const db = await database(factory);
  const value = await new Promise((resolve, reject) => {
    const request = db
      .transaction("progress")
      .objectStore("progress")
      .get("current");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}
async function withApp(factory, run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "https://localhost",
    pretendToBeVisual: true,
  });
  const saved = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    DocumentFragment: dom.window.DocumentFragment,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    Element: dom.window.Element,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    // JSDOM has no layout engine; radio controls only need the observer API here.
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    indexedDB: factory,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  dom.window.scrollTo = () => {};
  const registered = [];
  dom.window.document.modelContext = {
    registerTool: (tool) => registered.push(tool),
  };
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root"));
  const { AlmathApp } = bundle(
    'export { AlmathApp } from "./components/almath/app";',
  );
  try {
    await act(async () => {
      root.render(React.createElement(AlmathApp));
    });
    await run({ dom, registered });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test("Unsupported or corrupt saves survive Back, invalid history and retry without any overwrite", async () => {
  const { emptyProgress } = bundle(
    'export { emptyProgress } from "./learning/progress";',
  );
  for (const original of [
    { schemaVersion: 999, doNotErase: "existing future progress" },
    { ...emptyProgress(), attempts: [null] },
    { ...emptyProgress(), streak: { days: ["2026-02-30"] } },
  ]) {
    const factory = new IDBFactory();
    await put(factory, original);
    await withApp(factory, async ({ dom, registered }) => {
      await act(async () => wait());
      assert.match(
        dom.window.document.body.textContent,
        /Nothing has been overwritten/,
      );
      assert.equal(
        registered.length,
        0,
        "Mutating tools remain unavailable after a load error",
      );
      await act(async () => {
        for (const state of [null, { view: { screen: "units" } }])
          dom.window.dispatchEvent(
            new dom.window.PopStateEvent("popstate", { state }),
          );
        await wait();
      });
      assert.deepEqual(await read(factory), original);
      await act(async () => {
        dom.window.document.querySelector("button").click();
        await wait();
      });
      assert.deepEqual(await read(factory), original);
      // A valid legacy save can subsequently load and navigation can save again.
      const valid = emptyProgress();
      valid.completed.saved = {
        result: "solved",
        completedAt: "2026-10-10T12:00:00Z",
      };
      await put(factory, valid);
      await act(async () => {
        dom.window.document.querySelector("button").click();
        await wait();
      });
      assert.equal(registered.length, 2);
      await act(async () => {
        dom.window.dispatchEvent(
          new dom.window.PopStateEvent("popstate", {
            state: { view: { screen: "about" } },
          }),
        );
        await wait();
      });
      const restored = await read(factory);
      assert.deepEqual(restored.completed, valid.completed);
      assert.equal(restored.view.screen, "about");
    });
  }
});

test("Back navigation while loading does not write the initial empty state", async () => {
  const factory = new IDBFactory();
  const { emptyProgress } = bundle(
    'export { emptyProgress } from "./learning/progress";',
  );
  const original = emptyProgress();
  original.completed.saved = {
    result: "solved",
    completedAt: "2026-10-10T12:00:00Z",
  };
  await put(factory, original);
  const delayed = {
    open(...args) {
      const request = factory.open(...args),
        facade = {};
      request.onupgradeneeded = () => {
        facade.result = request.result;
        facade.onupgradeneeded?.();
      };
      request.onsuccess = () => {
        facade.result = request.result;
        setTimeout(() => facade.onsuccess?.(), 100);
      };
      request.onerror = () => {
        facade.error = request.error;
        facade.onerror?.();
      };
      return facade;
    },
  };
  await withApp(delayed, async ({ dom, registered }) => {
    assert.equal(registered.length, 0);
    await act(async () => {
      dom.window.dispatchEvent(
        new dom.window.PopStateEvent("popstate", { state: null }),
      );
      await wait(10);
    });
    assert.deepEqual(await read(factory), original);
    await act(async () => wait(140));
    assert.equal(registered.length, 2);
    assert.deepEqual(await read(factory), original);
  });
});

test("Hints stay optional after a wrong answer and appear once when requested", () => {
  const {
    LessonScreen,
    modules,
    exercises,
    locale,
    createSession,
    emptyProgress,
    emptyDraft,
  } = bundle(
    'export { LessonScreen } from "./screens/lesson"; export { modules, exercises, locale } from "./learning/content"; export * from "./learning/progress";',
  );
  const session = createSession(
    modules[0],
    exercises,
    emptyProgress(),
    "learn",
  );
  session.stage = "practice";
  const id = session.exerciseIds[0],
    hint = locale.exercises[id].hint;
  const render = () =>
    new JSDOM(
      renderToStaticMarkup(
        React.createElement(LessonScreen, {
          session,
          saveStatus: "saved",
          validationError: "",
          isLast: false,
          ...Object.fromEntries(
            [
              "onExit",
              "onStage",
              "onAnswer",
              "onHint",
              "onCheck",
              "onSolution",
              "onNext",
              "onPrevious",
            ].map((key) => [key, () => {}]),
          ),
        }),
      ),
    ).window.document;
  session.drafts[id] = { ...emptyDraft(), feedback: "incorrect" };
  let document = render();
  assert.match(
    document.body.textContent,
    /Need a hint\? Tap the hint button below/,
  );
  assert.ok(!document.body.textContent.includes(hint));
  session.drafts[id].hintUsed = true;
  document = render();
  assert.ok(
    !document.body.textContent.includes(
      "Need a hint? Tap the hint button below",
    ),
  );
  assert.equal(document.querySelectorAll(".hint-panel").length, 1);
  assert.ok(
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent.includes("Hint shown") && button.disabled,
    ),
  );
});

test("A correct review answer earns one streak day, persists it, and restores it on reopening", async () => {
  const {
    emptyProgress,
    createSession,
    emptyDraft,
    modules,
    exercises,
    localDay,
    shiftCalendarDay,
  } = bundle(`
    export * from "./learning/progress";
    export * from "./learning/daily-goal";
    export * from "./learning/streak";
    export { modules, exercises } from "./learning/content";
  `);
  const factory = new IDBFactory();
  const original = emptyProgress();
  const today = localDay(new Date());
  const previousDays = [
    shiftCalendarDay(today, -2),
    shiftCalendarDay(today, -1),
  ];
  const session = createSession(modules[0], exercises, original, "review");
  const id = session.exerciseIds[0];
  const exercise = exercises.find((item) => item.id === id);
  session.stage = "practice";
  session.drafts[id] = {
    ...emptyDraft(),
    answer: String(exercise.answer),
    hintUsed: true,
  };
  original.sessions.example = session;
  original.view = { screen: "lesson", sessionKey: "example" };
  original.attempts = previousDays.map((day) => ({
    exerciseId: id,
    version: 1,
    answer: String(exercise.answer),
    correct: true,
    hintUsed: false,
    at: new Date(`${day}T12:00:00`).toISOString(),
  }));
  await put(factory, original);
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    const check = [...dom.window.document.querySelectorAll("button")].find(
      (button) => button.textContent === "Check answer",
    );
    assert.ok(check);
    await act(async () => {
      check.click();
      check.click();
      await wait();
    });
    const saved = await read(factory);
    assert.deepEqual(saved.streak.days, [...previousDays, today]);
    assert.equal(saved.attempts.length, 3);
    await act(async () => {
      dom.window.dispatchEvent(
        new dom.window.PopStateEvent("popstate", {
          state: { view: { screen: "courses" } },
        }),
      );
      await wait();
    });
    assert.match(
      dom.window.document.querySelector(".daily-goal-card").textContent,
      /3-day streak/,
    );
    assert.equal(
      dom.window.document.querySelectorAll(".streak-week li").length,
      7,
    );
    assert.ok(
      !dom.window.document.body.textContent.includes(
        "A little practice, every day.",
      ),
    );
  });
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    assert.match(
      dom.window.document.querySelector(".daily-goal-card").textContent,
      /3-day streak/,
    );
    assert.deepEqual((await read(factory)).streak.days, [
      ...previousDays,
      today,
    ]);
  });
});

test("Incorrect answers and revealing a solution never earn a streak day", async () => {
  const { emptyProgress, createSession, emptyDraft, modules, exercises } =
    bundle(`
    export * from "./learning/progress";
    export { modules, exercises } from "./learning/content";
  `);
  const factory = new IDBFactory();
  const original = emptyProgress();
  const session = createSession(modules[0], exercises, original, "learn");
  const id = session.exerciseIds[0];
  const exercise = exercises.find((item) => item.id === id);
  session.stage = "practice";
  session.drafts[id] = {
    ...emptyDraft(),
    answer:
      exercise.type === "choice"
        ? exercise.optionIds.find((option) => option !== exercise.answer)
        : String(Number(exercise.answer) + 100),
  };
  original.sessions.example = session;
  original.view = { screen: "lesson", sessionKey: "example" };
  await put(factory, original);
  await withApp(factory, async ({ dom }) => {
    await act(async () => wait());
    const buttons = () => [...dom.window.document.querySelectorAll("button")];
    await act(async () => {
      buttons()
        .find((button) => button.textContent === "Check answer")
        .click();
      await wait();
    });
    assert.deepEqual((await read(factory)).streak.days, []);
    await act(async () => {
      buttons()
        .find((button) => button.textContent.includes("Show worked solution"))
        .click();
      await wait();
    });
    const saved = await read(factory);
    assert.deepEqual(saved.streak.days, []);
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.attempts[0].correct, false);
  });
});

test("Backup imports require a valid password and explicit merge confirmation", async () => {
  const { emptyProgress, encryptProgress } = bundle(`
    export { emptyProgress } from './learning/progress';
    export { encryptProgress } from './learning/backup';
  `);
  const original = emptyProgress();
  original.completed.current = {
    result: "solved",
    completedAt: "2026-10-15T12:00:00Z",
  };
  const imported = emptyProgress();
  imported.completed.backup = {
    result: "solved",
    completedAt: "2026-10-14T12:00:00Z",
  };
  const password = "a private backup passphrase";
  const text = await encryptProgress(imported, password);
  const factory = new IDBFactory();
  await put(factory, original);
  await withApp(factory, async ({ dom }) => {
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    dom.window.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    await act(async () => {
      await wait();
      dom.window.dispatchEvent(
        new dom.window.PopStateEvent("popstate", {
          state: { view: { screen: "about" } },
        }),
      );
      await wait();
    });
    const document = dom.window.document;
    await act(async () => {
      [...document.querySelectorAll(".backup-section button")]
        .find((button) => button.textContent.includes("Import progress"))
        .click();
      await wait();
    });
    const fileInput = document.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [
        {
          name: "saved.almathbackup",
          size: text.length,
          text: async () => text,
        },
      ],
    });
    await act(async () => {
      fileInput.dispatchEvent(
        new dom.window.Event("change", { bubbles: true }),
      );
      await wait();
    });
    const input = document.querySelector("#backup-password");
    const setPassword = async (value) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        ).set.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        await wait();
      });
    };
    const submit = async () =>
      act(async () => {
        document
          .querySelector(".backup-form")
          .dispatchEvent(
            new dom.window.Event("submit", { bubbles: true, cancelable: true }),
          );
        await wait(450);
      });
    await setPassword("a wrong long password");
    await submit();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /password is incorrect/,
    );
    assert.deepEqual((await read(factory)).completed, original.completed);
    await setPassword(password);
    await submit();
    assert.ok(document.querySelector(".backup-preview"));
    assert.deepEqual(
      (await read(factory)).completed,
      original.completed,
      "Preview does not write imported progress",
    );
    assert.equal(
      document.querySelector('input[type="password"]'),
      null,
      "The password is cleared before confirmation",
    );
    await submit();
    const restored = await read(factory);
    assert.deepEqual(Object.keys(restored.completed).sort(), [
      "backup",
      "current",
    ]);
    assert.match(
      document.querySelector(".backup-status").textContent,
      /existing progress has been kept/,
    );
    assert.equal(document.querySelector("dialog"), null);
  });
});
