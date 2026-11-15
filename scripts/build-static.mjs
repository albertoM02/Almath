import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import "./prepare-licenses.mjs";
import { staticBuildEnvironment } from "./static-environment.mjs";

const env = staticBuildEnvironment(
  process.env,
  process.argv.includes("--android"),
);

const require = createRequire(import.meta.url);
const build = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    stdio: "inherit",
    env,
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const verify = spawnSync(process.execPath, ["scripts/verify-static.mjs"], {
  stdio: "inherit",
  env,
});
if (verify.error) throw verify.error;
process.exit(verify.status ?? 1);
