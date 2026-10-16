import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const applicationId = "io.github.albertom02.almath";
const certificate =
  "23df1c0671743d507aecc8656dc785676f6cdf4e424b8a355085f6d378ce1bc4";

function requireValue(condition, message) {
  if (!condition) throw new Error(`Android release: ${message}`);
}

export function releaseMetadata(root = projectRoot) {
  const read = (path) => readFileSync(join(root, path), "utf8");
  const metadata = JSON.parse(read("package.json"));
  requireValue(
    /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(metadata.version),
    "invalid package version.",
  );
  const gradle = read("android/app/build.gradle");
  const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
  const versionCode = Number(
    gradle.match(/findProperty\('almathVersionCode'\)\s*\?:\s*'(\d+)'/)?.[1],
  );
  requireValue(
    versionName === metadata.version &&
      Number.isSafeInteger(versionCode) &&
      versionCode > 0 &&
      versionCode <= 2_100_000_000,
    "package and Android versions must agree; commit a positive version code.",
  );
  const ui = JSON.parse(read("content/locales/en.json")).ui;
  requireValue(
    ui.version.startsWith(`Version ${metadata.version} · `),
    "the displayed app version does not match package.json.",
  );
  const config = read("capacitor.config.ts");
  requireValue(
    gradle.match(/applicationId\s+"([^"]+)"/)?.[1] === applicationId &&
      config.match(/appId:\s*"([^"]+)"/)?.[1] === applicationId,
    "the official application ID changed; existing installs cannot update.",
  );
  requireValue(
    config.match(/appName:\s*"([^"]+)"/)?.[1] === "Almath" &&
      read("android/app/src/main/res/values/strings.xml").match(
        /<string name="app_name">([^<]+)<\/string>/,
      )?.[1] === "Almath",
    "official APKs must be named Almath.",
  );
  requireValue(
    config.match(/hostname:\s*"([^"]+)"/)?.[1] === "localhost" &&
      config.match(/androidScheme:\s*"([^"]+)"/)?.[1] === "https",
    "the WebView origin changed; existing progress would become inaccessible.",
  );
  // These values locate existing users' saves. Changing them requires an
  // explicit, tested migration and an intentional update to this guard.
  const storage = read("learning/storage.ts");
  const source = ts.createSourceFile(
    "storage.ts",
    storage,
    ts.ScriptTarget.Latest,
    true,
  );
  const functionText = (name) =>
    source.statements
      .find(
        (item) => ts.isFunctionDeclaration(item) && item.name?.text === name,
      )
      ?.getText(source) ?? "";
  const load = functionText("loadProgress");
  const save = functionText("saveProgress");
  requireValue(
    /indexedDB\.open\(\s*"almath-progress"\s*,\s*1\s*\)/.test(storage) &&
      /createObjectStore\(\s*"progress"\s*\)/.test(storage) &&
      /\.get\(\s*"current"\s*\)/.test(load) &&
      /\.put\(\s*progress\s*,\s*"current"\s*\)/.test(save) &&
      [load, save].every(
        (code) =>
          /\.transaction\(\s*"progress"\s*,/.test(code) &&
          /\.objectStore\(\s*"progress"\s*\)/.test(code),
      ) &&
      /schemaVersion:\s*1;/.test(read("learning/types.ts")),
    "progress storage changed; review and test the migration before releasing.",
  );
  requireValue(
    read("android/signing-certificate.sha256").trim() === certificate,
    "the pinned signing certificate changed; restore the original release identity.",
  );
  return {
    version: metadata.version,
    versionCode,
    applicationId,
    appName: "Almath",
    certificate,
  };
}

export function verifyApkMetadata(badging, metadata) {
  const packageLine = badging.match(/^package: .+$/m)?.[0] ?? "";
  const field = (name) =>
    packageLine.match(new RegExp(`\\b${name}='([^']*)'`))?.[1];
  requireValue(
    field("name") === metadata.applicationId &&
      field("versionName") === metadata.version &&
      field("versionCode") === String(metadata.versionCode),
    "the built APK identity or version differs from the checked-in metadata.",
  );
  requireValue(
    /^application-label:'Almath'$/m.test(badging) &&
      [...badging.matchAll(/^application-label(?:-[^:]+)?:'([^']*)'$/gm)].every(
        (match) => match[1] === "Almath",
      ) &&
      !/^application-debuggable(?:\s|$)/m.test(badging),
    "the built APK must be Almath and must not be debuggable.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const metadata = releaseMetadata();
  if (process.argv.includes("--github-output")) {
    requireValue(process.env.GITHUB_OUTPUT, "GITHUB_OUTPUT is required.");
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${metadata.version}\n`);
  }
  console.log(JSON.stringify(metadata));
}
