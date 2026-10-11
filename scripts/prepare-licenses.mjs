// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Alberto Moro Carrera.
import assert from "node:assert/strict";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(root, "public/legal");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
assert.equal(pkg.license, "GPL-3.0-only");

const sections = [
  ["GNU GPL version 3", "LICENSE", "GPL-3.0-only.txt"],
  ["Creative Commons BY-SA 4.0", "content/LICENSE", "CC-BY-SA-4.0.txt"],
  ["Third-party notices", "THIRD_PARTY_NOTICES.md", "third-party-notices.txt"],
].map(([title, source, target]) => ({
  title,
  target,
  text: readFileSync(resolve(root, source), "utf8"),
}));

assert(sections[0].text.includes("Version 3, 29 June 2007"));
assert(sections[1].text.includes("Attribution-ShareAlike 4.0 International"));
assert(sections[2].text.includes("SIL OPEN FONT LICENSE"));

const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

mkdirSync(destination, { recursive: true });
for (const entry of readdirSync(destination, { withFileTypes: true })) {
  if (entry.isFile()) unlinkSync(resolve(destination, entry.name));
}
for (const section of sections) {
  writeFileSync(resolve(destination, section.target), section.text);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Almath — Open-source licenses</title>
<style>
body{margin:0;padding:20px;background:#fffdf3;color:#222b36;font-family:system-ui,sans-serif;line-height:1.55}
h1{font-size:1.5rem;color:#0f5a42}h2{font-size:1.1rem}a{color:#0f5a42}
summary{padding:12px 0;font-weight:600;cursor:pointer}details{border-top:1px solid #d7ddcf}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:0;padding-bottom:16px}
</style></head><body>
<h1>Almath ${escape(pkg.version)} — Open-source licenses</h1>
<p>Copyright (c) 2026 Alberto Moro Carrera.</p>
<p>Code: GNU GPL version 3 only. Original lessons and documentation: CC BY-SA 4.0.
Third-party works retain their own licenses.</p>
<p>You may redistribute and modify Almath under the applicable licenses.
Almath is provided without warranty. Full terms are included below.</p>
<p>Source code and build instructions: https://github.com/albertoM02/Almath</p>
${sections.map((section) => `<details><summary>${escape(section.title)}</summary><pre>${escape(section.text)}</pre></details>`).join("\n")}
</body></html>`;
writeFileSync(resolve(destination, "index.html"), html);
console.log("Prepared offline licenses and notices.");
