import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { releaseMetadata, verifyApkMetadata } from "./android-release.mjs";

const androidDirectory = fileURLToPath(new URL("../android/", import.meta.url));
const windows = process.platform === "win32";
const debug = process.argv.includes("--debug");
const extra = process.argv
  .slice(2)
  .filter((argument) => argument !== "--debug");
let buildTools;
let metadata;
if (!debug) {
  metadata = releaseMetadata();
  for (const name of [
    "ALMATH_RELEASE_KEYSTORE",
    "ALMATH_RELEASE_KEY_ALIAS",
    "ALMATH_RELEASE_STORE_PASSWORD",
    "ALMATH_RELEASE_KEY_PASSWORD",
  ])
    if (!process.env[name])
      throw new Error(
        `Missing ${name}. Official APKs require the existing private release key.`,
      );
  let sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!sdk) {
    const properties = readFileSync(
      join(androidDirectory, "local.properties"),
      "utf8",
    );
    sdk = properties
      .match(/^sdk\.dir=(.+)$/m)?.[1]
      .trim()
      .replace(/\\:/g, ":")
      .replace(/\\\\/g, "\\");
  }
  if (!sdk) throw new Error("Set ANDROID_HOME to the Android SDK directory.");
  // Use the same tested verification tools locally and on hosted runners.
  const version = "36.0.0";
  if (!readdirSync(join(sdk, "build-tools")).includes(version))
    throw new Error(`Android build tools ${version} are required.`);
  buildTools = join(sdk, "build-tools", version);
}
const build = spawnSync(
  windows ? "gradlew.bat" : "sh",
  [
    ...(windows ? [] : ["./gradlew"]),
    "--no-daemon",
    debug ? "assembleDebug" : "assembleRelease",
    ...extra,
  ],
  {
    cwd: androidDirectory,
    stdio: "inherit",
    shell: windows,
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
if (!debug) {
  const apk = join(
    androidDirectory,
    "app/build/outputs/apk/release/app-release.apk",
  );
  const verification = spawnSync(
    join(buildTools, windows ? "apksigner.bat" : "apksigner"),
    ["verify", "--print-certs", apk],
    { encoding: "utf8", shell: windows },
  );
  if (verification.error) throw verification.error;
  const certificate = verification.stdout?.match(
    /Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/,
  )?.[1];
  const expected = metadata.certificate;
  if (verification.status !== 0 || certificate !== expected)
    throw new Error(
      [
        "APK signature verification failed. No distributable APK was created.",
        `Build tools: 36.0.0; exit status: ${verification.status}; expected certificate: ${expected}; actual certificate: ${certificate ?? "not reported"}.`,
        verification.stdout?.trim(),
        verification.stderr?.trim(),
      ].filter(Boolean).join("\n"),
    );
  const badging = spawnSync(
    join(buildTools, windows ? "aapt.exe" : "aapt"),
    ["dump", "badging", apk],
    { encoding: "utf8" },
  );
  if (badging.error) throw badging.error;
  if (badging.status !== 0)
    throw new Error("Could not inspect the release APK.");
  verifyApkMetadata(badging.stdout, metadata);
  const destination = fileURLToPath(new URL("../dist/", import.meta.url));
  mkdirSync(destination, { recursive: true });
  copyFileSync(apk, join(destination, `Almath-${metadata.version}.apk`));
  console.log(`Verified official APK: dist/Almath-${metadata.version}.apk`);
}
