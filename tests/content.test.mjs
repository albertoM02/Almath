import test from "node:test";
import assert from "node:assert/strict";
import { checkContent } from "../scripts/check-content.mjs";

test("Published content has valid references, answers, translations, outlines and formulas", () => {
  const result = checkContent();
  assert.ok(result.exercises > 0 && result.formulas > 0);
});
