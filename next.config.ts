import type { NextConfig } from "next";

// GitHub Pages serves the project under /<repository>; local, hosted and
// Android builds stay at the root.
const basePath = process.env.ALMATH_BASE_PATH ?? "";
if (
  basePath &&
  (!/^\/[A-Za-z0-9._-]+$/.test(basePath) || ["/.", "/.."].includes(basePath))
) {
  throw new Error(`ALMATH_BASE_PATH must look like /Almath, got ${basePath}`);
}

const nextConfig: NextConfig = {
  // The hosted web build keeps its server; Android ships the same app as files.
  ...(process.env.ALMATH_STATIC_EXPORT === "1"
    ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
    : {}),
  ...(basePath ? { basePath } : {}),
  // Plain <img>, <iframe> and metadata URLs are not rewritten by basePath.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
