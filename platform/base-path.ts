/** Prefixes a public file path with the deployment base path (e.g. /Almath on GitHub Pages). */
export const withBasePath = (path: `/${string}`) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
