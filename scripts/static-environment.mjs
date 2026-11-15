// Android serves the bundle at https://localhost/, regardless of a caller's
// GitHub Pages environment. Pass this environment to both build and verifier.
export function staticBuildEnvironment(environment, android = false) {
  return {
    ...environment,
    ALMATH_STATIC_EXPORT: "1",
    ...(android ? { ALMATH_BASE_PATH: "", NEXT_PUBLIC_BASE_PATH: "" } : {}),
  };
}
