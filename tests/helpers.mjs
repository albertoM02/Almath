import { build, buildSync } from "esbuild";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function options(contents) {
  return {
    stdin: { contents, resolveDir: root, loader: "tsx" },
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    tsconfig: `${root}tsconfig.json`,
  };
}

export function bundle(contents) {
  return evaluate(buildSync(options(contents)));
}

export async function bundleAsync(contents, plugins = []) {
  return evaluate(await build({ ...options(contents), plugins }));
}

function evaluate({ outputFiles }) {
  const filename = `${root}tests/bundled-test.cjs`;
  const module = new Module(filename);
  module.filename = filename;
  module.paths = createRequire(filename).resolve.paths("react");
  module._compile(outputFiles[0].text, filename);
  return module.exports;
}
