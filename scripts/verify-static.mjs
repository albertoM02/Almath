import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

export function verifyStaticBundle(
  directory,
  {
    basePath = "",
    legalDirectory = resolve("public/legal"),
    minimumFonts = 20,
  } = {},
) {
  const output = resolve(directory);
  assert(
    !basePath ||
      (/^\/[A-Za-z0-9._-]+$/.test(basePath) &&
        !["/.", "/.."].includes(basePath)),
    "Invalid base path",
  );
  assert(
    statSync(resolve(output, "index.html")).isFile(),
    "Build the static app first.",
  );
  assert(
    statSync(resolve(output, "logo.png")).isFile(),
    "Missing offline logo",
  );
  for (const name of [
    "index.html",
    "GPL-3.0-only.txt",
    "CC-BY-SA-4.0.txt",
    "third-party-notices.txt",
  ]) {
    assert(
      readFileSync(resolve(legalDirectory, name)).equals(
        readFileSync(resolve(output, "legal", name)),
      ),
      `Missing or changed offline license: ${name}`,
    );
  }

  let references = 0;
  let fonts = 0;
  function resource(path, url, hint = false) {
    if (/^(data:|#)/.test(url)) return;
    assert(
      !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url),
      `Remote runtime asset: ${url}`,
    );
    let local = decodeURIComponent(url.split(/[?#]/)[0]);
    // Next emits a same-origin preconnect hint. A script/iframe pointing to
    // the root is still a broken file reference, never an exempt hint.
    if (hint && local === "/") return;
    if (basePath && local.startsWith("/")) {
      assert(
        local.startsWith(`${basePath}/`),
        `Asset ignores the base path ${basePath}: ${url}`,
      );
      local = local.slice(basePath.length);
    }
    const target = local.startsWith("/")
      ? resolve(output, `.${local}`)
      : resolve(dirname(path), local);
    assert(target.startsWith(output + sep), `Asset escapes the bundle: ${url}`);
    let file = false;
    try {
      file = statSync(target).isFile();
    } catch {
      /* Report the resource URL below. */
    }
    assert(file, `Missing offline asset: ${url}`);
    references++;
  }
  for (const path of files(output)) {
    if (path.endsWith(".woff2")) fonts++;
    if (!/\.(html|css)$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    if (path.endsWith(".css")) {
      for (const match of source.matchAll(
        /url\(\s*["']?([^\s"')]+)["']?\s*\)/gi,
      ))
        resource(path, match[1]);
      for (const match of source.matchAll(/@import\s+["']([^"']+)["']/gi))
        resource(path, match[1]);
    } else {
      const dom = new JSDOM(source);
      for (const node of dom.window.document.querySelectorAll(
        "script[src], img[src], link[href], iframe[src], source[src], video[src], audio[src]",
      )) {
        resource(
          path,
          node.getAttribute(node.hasAttribute("src") ? "src" : "href"),
          node.tagName === "LINK" &&
            /^(preconnect|dns-prefetch)$/.test(node.rel),
        );
      }
      dom.window.close();
    }
  }
  assert(
    fonts >= minimumFonts,
    "KaTeX fonts must be bundled for first-launch offline formulas.",
  );
  return { references, fonts };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { references, fonts } = verifyStaticBundle("out", {
    basePath: process.env.ALMATH_BASE_PATH ?? "",
  });
  console.log(
    `Static bundle verified: ${references} local asset references, ${fonts} bundled fonts.`,
  );
}
