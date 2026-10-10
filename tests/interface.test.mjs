import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { bundle } from "./helpers.mjs";

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
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
    Element: dom.window.Element,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
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
