import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const output = resolve("out");
// A GitHub Pages build serves out/ under this prefix, e.g. /Almath.
const basePath = process.env.ALMATH_BASE_PATH ?? "";
assert(
  existsSync(resolve(output, "index.html")),
  "Build the static app first.",
);

for (const name of [
  "index.html",
  "GPL-3.0-only.txt",
  "CC-BY-SA-4.0.txt",
  "third-party-notices.txt",
]) {
  const source = readFileSync(resolve("public/legal", name));
  const bundled = readFileSync(resolve(output, "legal", name));
  assert(source.equals(bundled), `Missing or changed offline license: ${name}`);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

let references = 0;
let fonts = 0;
for (const path of files(output)) {
  if (path.endsWith(".woff2")) fonts++;
  if (!/\.(html|css)$/.test(path)) continue;
  const source = readFileSync(path, "utf8");
  const resources = path.endsWith(".css")
    ? [...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(
        (match) => match[1],
      )
    : [
        ...source.matchAll(
          /<(?:script|img|link)\b[^>]*\b(?:src|href)="([^"]+)"/g,
        ),
      ].map((match) => match[1]);
  for (const resource of resources) {
    if (/^(data:|#)/.test(resource)) continue;
    assert(
      !/^(?:[a-z]+:)?\/\//i.test(resource),
      `Remote runtime asset: ${resource}`,
    );
    let local = decodeURIComponent(resource.split(/[?#]/)[0]);
    // "/" alone is Next's same-origin preconnect hint, not a bundled file.
    if (basePath && local.startsWith("/") && local !== "/") {
      assert(
        local === basePath || local.startsWith(`${basePath}/`),
        `Asset ignores the base path ${basePath}: ${resource}`,
      );
      local = local.slice(basePath.length) || "/";
    }
    const target = local.startsWith("/")
      ? resolve(output, `.${local}`)
      : resolve(dirname(path), local);
    assert(
      target === output || target.startsWith(output + sep),
      `Asset escapes the bundle: ${resource}`,
    );
    assert(existsSync(target), `Missing offline asset: ${resource}`);
    references++;
  }
}
assert(
  fonts >= 20,
  "KaTeX fonts must be bundled for first-launch offline formulas.",
);
console.log(
  `Static bundle verified: ${references} local asset references, ${fonts} bundled fonts.`,
);
