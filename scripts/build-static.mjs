import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    stdio: "inherit",
    env: { ...process.env, ALMATH_STATIC_EXPORT: "1" },
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const verify = spawnSync(process.execPath, ["scripts/verify-static.mjs"], {
  stdio: "inherit",
});
if (verify.error) throw verify.error;
process.exit(verify.status ?? 1);
