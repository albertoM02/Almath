import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const androidDirectory = fileURLToPath(new URL("../android/", import.meta.url));
const windows = process.platform === "win32";
const build = spawnSync(
  windows ? "gradlew.bat" : "sh",
  [
    ...(windows ? [] : ["./gradlew"]),
    "--no-daemon",
    "assembleDebug",
    ...process.argv.slice(2),
  ],
  {
    cwd: androidDirectory,
    stdio: "inherit",
    shell: windows,
  },
);
if (build.error) throw build.error;
process.exit(build.status ?? 1);
