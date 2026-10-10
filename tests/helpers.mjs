import { buildSync } from "esbuild";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export function bundle(contents) {
  const { outputFiles } = buildSync({
    stdin: { contents, resolveDir: root, loader: "tsx" },
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    tsconfig: `${root}tsconfig.json`,
  });
  const filename = `${root}tests/bundled-test.cjs`;
  const module = new Module(filename);
  module.filename = filename;
  module.paths = createRequire(filename).resolve.paths("react");
  module._compile(outputFiles[0].text, filename);
  return module.exports;
}
