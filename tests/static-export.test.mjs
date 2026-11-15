import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { verifyStaticBundle } from "../scripts/verify-static.mjs";
import { staticBuildEnvironment } from "../scripts/static-environment.mjs";
import { bundle } from "./helpers.mjs";

function fixture(t, prefix = "/Almath") {
  const root = mkdtempSync(join(tmpdir(), "almath-export-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function put(name, text) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  put(
    "index.html",
    `<link rel="preconnect" href="/"><script src="${prefix}/app.js"></script><link href="${prefix}/app.css" rel="stylesheet"><img src="${prefix}/logo.png"><iframe src="${prefix}/legal/index.html"></iframe>`,
  );
  put("app.js", "console.log('local')");
  put(
    "app.css",
    `@import 'theme.css'; @font-face {font-family: test;src:url('${prefix}/font.woff2')}`,
  );
  put("theme.css", "body{color:green}");
  put("font.woff2", "test-font");
  put("logo.png", "test-logo");
  for (const name of [
    "index.html",
    "GPL-3.0-only.txt",
    "CC-BY-SA-4.0.txt",
    "third-party-notices.txt",
  ])
    put(`legal/${name}`, name);
  return {
    put,
    root,
    verify: () =>
      verifyStaticBundle(root, {
        basePath: prefix,
        minimumFonts: 1,
        legalDirectory: join(root, "legal"),
      }),
  };
}

test("Static verification follows prefixed JS, CSS, fonts, logo, imports and license iframe", (t) => {
  const f = fixture(t);
  assert.deepEqual(f.verify(), { references: 6, fonts: 1 });
});

test("Root export uses the same local resources for Android", (t) => {
  assert.equal(fixture(t, "").verify().fonts, 1);
});

for (const [name, html, error] of [
  [
    "unprefixed JavaScript",
    '<script src="/app.js"></script>',
    /ignores the base path/,
  ],
  ["unprefixed logo", '<img src="/logo.png">', /ignores the base path/],
  [
    "unprefixed license iframe",
    '<iframe src="/legal/index.html"></iframe>',
    /ignores the base path/,
  ],
  [
    "missing iframe document",
    '<iframe src="/Almath/legal/missing.html"></iframe>',
    /Missing offline asset/,
  ],
  [
    "root script disguised as a hint",
    '<script src="/"></script>',
    /ignores the base path/,
  ],
  [
    "directory instead of an asset",
    '<script src="/Almath/legal/"></script>',
    /Missing offline asset/,
  ],
  [
    "remote runtime resource",
    '<script src="https://cdn.example/app.js"></script>',
    /Remote runtime asset/,
  ],
  [
    "escaped path",
    '<img src="/Almath/%2e%2e/outside.png">',
    /escapes the bundle/,
  ],
])
  test(`Static verification rejects ${name}`, (t) => {
    const f = fixture(t);
    f.put("index.html", html);
    assert.throws(f.verify, error);
  });

test("Static verification checks CSS font references and quoted imports", (t) => {
  const f = fixture(t);
  f.put("app.css", "@font-face{src:url('/font.woff2')}");
  assert.throws(f.verify, /ignores the base path/);
  f.put("app.css", '@import "missing.css";');
  assert.throws(f.verify, /Missing offline asset/);
});

test("Android build clears inherited web prefixes without changing the caller", () => {
  const input = {
    ALMATH_BASE_PATH: "/Almath",
    NEXT_PUBLIC_BASE_PATH: "/Almath",
    OTHER: "retained",
  };
  assert.equal(staticBuildEnvironment(input).ALMATH_BASE_PATH, "/Almath");
  assert.deepEqual(staticBuildEnvironment(input, true), {
    ALMATH_STATIC_EXPORT: "1",
    ALMATH_BASE_PATH: "",
    NEXT_PUBLIC_BASE_PATH: "",
    OTHER: "retained",
  });
  assert.equal(input.ALMATH_BASE_PATH, "/Almath");
});

test("Logo and dynamically opened license iframe render at root and under /Almath", () => {
  const { Brand } = bundle(
    'export { Brand } from "./components/almath/brand";',
  );
  const { AboutScreen } = bundle(
    'export { AboutScreen } from "./screens/about";',
  );
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    for (const prefix of ["", "/Almath"]) {
      process.env.NEXT_PUBLIC_BASE_PATH = prefix;
      const dom = new JSDOM(
        renderToStaticMarkup(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(Brand, {}),
            React.createElement(AboutScreen, { backup: {} }),
          ),
        ),
      );
      assert.equal(
        dom.window.document.querySelector("img").getAttribute("src"),
        `${prefix}/logo.png`,
      );
      assert.equal(
        dom.window.document.querySelector("iframe").getAttribute("src"),
        `${prefix}/legal/index.html`,
      );
      assert.equal(
        dom.window.document.querySelector("iframe").getAttribute("sandbox"),
        "",
      );
      dom.window.close();
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});
