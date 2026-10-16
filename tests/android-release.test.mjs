import assert from "node:assert/strict";
import test from "node:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  releaseMetadata,
  verifyApkMetadata,
} from "../scripts/android-release.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "package.json",
  "android/app/build.gradle",
  "android/app/src/main/res/values/strings.xml",
  "android/signing-certificate.sha256",
  "capacitor.config.ts",
  "content/locales/en.json",
  "learning/storage.ts",
  "learning/types.ts",
];

function fixture(t) {
  const directory = mkdtempSync(join(root, "node_modules/.almath-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of files) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    copyFileSync(join(root, file), join(directory, file));
  }
  return directory;
}

function change(directory, file, before, after) {
  const path = join(directory, file);
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(before), `Fixture missing ${before}`);
  writeFileSync(path, text.replace(before, after));
}

test("Official release metadata matches the checked-in app version and original identity", () => {
  const metadata = releaseMetadata();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(metadata.version, pkg.version);
  assert.ok(metadata.versionCode > 0);
  assert.equal(metadata.applicationId, "io.github.albertom02.almath");
  assert.equal(metadata.appName, "Almath");
});

test("Identity and storage changes cannot silently produce an incompatible official update", (t) => {
  const cases = [
    [
      "android/app/build.gradle",
      'applicationId "io.github.albertom02.almath"',
      'applicationId "io.github.albertom02.other"',
    ],
    [
      "capacitor.config.ts",
      "io.github.albertom02.almath",
      "io.github.albertom02.other",
    ],
    ["capacitor.config.ts", 'appName: "Almath"', 'appName: "Almath Test"'],
    [
      "android/app/src/main/res/values/strings.xml",
      ">Almath<",
      ">Almath Test<",
    ],
    ["capacitor.config.ts", 'hostname: "localhost"', 'hostname: "otherhost"'],
    ["capacitor.config.ts", 'androidScheme: "https"', 'androidScheme: "http"'],
    ["learning/storage.ts", '"almath-progress"', '"almath-progress-v2"'],
    [
      "learning/storage.ts",
      'createObjectStore("progress")',
      'createObjectStore("new-progress")',
    ],
    ["learning/storage.ts", '.get("current")', '.get("new-current")'],
    [
      "learning/storage.ts",
      '.put(progress, "current")',
      '.put(progress, "new-current")',
    ],
    [
      "learning/storage.ts",
      '.transaction("progress", "readonly")',
      '.transaction("new-progress", "readonly")',
    ],
    ["learning/types.ts", "schemaVersion: 1;", "schemaVersion: 2;"],
  ];
  for (const [file, before, after] of cases) {
    const directory = fixture(t);
    change(directory, file, before, after);
    assert.throws(() => releaseMetadata(directory), /Android release:/, file);
  }
  const directory = fixture(t);
  writeFileSync(
    join(directory, "android/signing-certificate.sha256"),
    "0".repeat(64),
  );
  assert.throws(
    () => releaseMetadata(directory),
    /signing certificate changed/,
  );
});

test("Inconsistent versions, invalid version codes and injected version text fail before signing", (t) => {
  const metadata = releaseMetadata();
  const cases = [
    [
      "android/app/build.gradle",
      `versionName = "${metadata.version}"`,
      'versionName = "99.0.0"',
    ],
    ["android/app/build.gradle", `?: '${metadata.versionCode}'`, "?: '0'"],
    [
      "android/app/build.gradle",
      `?: '${metadata.versionCode}'`,
      "?: '2147483648'",
    ],
    [
      "content/locales/en.json",
      `Version ${metadata.version} ·`,
      "Version 99.0.0 ·",
    ],
    [
      "package.json",
      `"version": "${metadata.version}"`,
      '"version": "1.0.0\\noutput=injected"',
    ],
  ];
  for (const [file, before, after] of cases) {
    const directory = fixture(t);
    change(directory, file, before, after);
    assert.throws(() => releaseMetadata(directory), /Android release:/);
  }
});

test("The workflow also supports the existing 0.5.1 release metadata without app changes", (t) => {
  const directory = fixture(t);
  const current = releaseMetadata();
  for (const file of [
    "package.json",
    "android/app/build.gradle",
    "content/locales/en.json",
  ])
    writeFileSync(
      join(directory, file),
      readFileSync(join(directory, file), "utf8").replaceAll(
        current.version,
        "0.5.1-beta",
      ),
    );
  change(
    directory,
    "android/app/build.gradle",
    `?: '${current.versionCode}'`,
    "?: '7'",
  );
  assert.equal(releaseMetadata(directory).version, "0.5.1-beta");
  assert.equal(releaseMetadata(directory).versionCode, 7);
});

test("The built APK must carry the expected version and identity without debug or test branding", () => {
  const metadata = releaseMetadata();
  const badging = `package: name='${metadata.applicationId}' versionCode='${metadata.versionCode}' versionName='${metadata.version}'\napplication-label:'Almath'\napplication-label-en:'Almath'\n`;
  assert.doesNotThrow(() => verifyApkMetadata(badging, metadata));
  for (const altered of [
    badging.replace(metadata.applicationId, `${metadata.applicationId}.dev`),
    badging.replace(`versionCode='${metadata.versionCode}'`, "versionCode='1'"),
    badging.replace(metadata.version, "99.0.0"),
    badging.replace(
      "application-label:'Almath'",
      "application-label:'Almath Test'",
    ),
    badging.replace(
      "application-label-en:'Almath'",
      "application-label-en:'Almath Test'",
    ),
    `${badging}application-debuggable\n`,
  ])
    assert.throws(
      () => verifyApkMetadata(altered, metadata),
      /Android release:/,
    );
});
