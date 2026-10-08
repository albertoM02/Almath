import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The hosted web build keeps its server; Android ships the same app as files.
  ...(process.env.ALMATH_STATIC_EXPORT === "1"
    ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
