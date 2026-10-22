import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToString } from "katex";

export function checkContent(root = new URL("../", import.meta.url)) {
  const read = (name) =>
    JSON.parse(readFileSync(new URL(`content/${name}.json`, root), "utf8"));
  const hardware = read("hardware-security/course");
  const courses = [...read("courses"), ...hardware.courses],
    modules = [...read("modules"), ...hardware.modules],
    concepts = [...read("concepts"), ...hardware.concepts],
    exercises = [...read("exercises"), ...hardware.exercises],
    outlines = [...read("outlines"), ...hardware.outlines],
    sources = [...read("sources"), ...hardware.sources];
  const english = read("locales/en");
  const locale = Object.fromEntries(
    Object.entries(english).map(([key, value]) => [
      key,
      { ...value, ...hardware.locale[key] },
    ]),
  );
  const index = (items, kind) => {
    assert.ok(
      Array.isArray(items) && items.length,
      `${kind} must be a nonempty array`,
    );
    const map = new Map();
    for (const item of items) {
      assert.ok(
        item && typeof item.id === "string" && item.id && !map.has(item.id),
        `${kind}: invalid or duplicate ID`,
      );
      map.set(item.id, item);
    }
    return map;
  };
  const c = index(courses, "courses"),
    m = index(modules, "modules"),
    k = index(concepts, "concepts"),
    e = index(exercises, "exercises"),
    s = index(sources, "sources");
  const text = (item, fields, label) => {
    assert.ok(
      item && typeof item === "object",
      `${label}: missing English text`,
    );
    for (const field of fields)
      assert.ok(
        typeof item[field] === "string" && item[field].trim(),
        `${label}: missing ${field}`,
      );
  };
  const strings = (values, label) =>
    assert.ok(
      Array.isArray(values) &&
        values.every((v) => typeof v === "string" && v.trim()),
      `${label}: expected strings`,
    );
  for (const course of courses) {
    text(
      locale.courses[course.id],
      ["title", "description", "category"],
      course.id,
    );
    strings(course.moduleIds, course.id);
    assert.equal(
      new Set(course.moduleIds).size,
      course.moduleIds.length,
      `${course.id}: repeated module`,
    );
    for (const id of course.moduleIds)
      assert.equal(
        m.get(id)?.courseId,
        course.id,
        `${course.id}: missing or mismatched module ${id}`,
      );
  }
  for (const module of modules) {
    assert.ok(c.has(module.courseId), `${module.id}: unknown course`);
    assert.ok(
      Number.isSafeInteger(module.version) && module.version > 0,
      `${module.id}: invalid version`,
    );
    strings(module.exerciseIds, module.id);
    assert.ok(
      module.exerciseIds.length &&
        new Set(module.exerciseIds).size === module.exerciseIds.length,
      `${module.id}: empty or repeated exercise`,
    );
    text(locale.modules[module.id], ["title", "description"], module.id);
    for (const id of module.exerciseIds)
      assert.equal(
        k.get(e.get(id)?.conceptId)?.courseId,
        module.courseId,
        `${module.id}: unknown or mismatched exercise ${id}`,
      );
  }
  for (const concept of concepts) {
    assert.ok(
      c.has(concept.courseId) && s.has(concept.sourceId),
      `${concept.id}: unknown course/source`,
    );
    strings(concept.prerequisites, concept.id);
    for (const id of concept.prerequisites)
      assert.ok(k.has(id), `${concept.id}: unknown prerequisite ${id}`);
    text(
      locale.concepts[concept.id],
      ["title", "body", "example", "takeaway"],
      concept.id,
    );
    assert.equal(
      typeof locale.concepts[concept.id].formula,
      "string",
      `${concept.id}: invalid formula`,
    );
    strings(
      locale.concepts[concept.id].exampleSteps,
      `${concept.id}: example steps`,
    );
  }
  const visit = (id, active = new Set(), done = new Set()) => {
    assert.ok(!active.has(id), `${id}: cyclic prerequisites`);
    if (done.has(id)) return;
    active.add(id);
    for (const next of k.get(id).prerequisites) visit(next, active, done);
    active.delete(id);
    done.add(id);
  };
  for (const id of k.keys()) visit(id);
  for (const exercise of exercises) {
    assert.ok(
      k.has(exercise.conceptId) && s.has(exercise.sourceId),
      `${exercise.id}: unknown concept/source`,
    );
    assert.ok(
      Number.isSafeInteger(exercise.version) && exercise.version > 0,
      `${exercise.id}: invalid version`,
    );
    const translated = locale.exercises[exercise.id];
    text(
      translated,
      ["title", "statement", "prompt", "hint", "explanation"],
      exercise.id,
    );
    strings(translated.solutionSteps, `${exercise.id}: solution steps`);
    if (exercise.type === "choice") {
      strings(exercise.optionIds, exercise.id);
      assert.ok(
        exercise.optionIds.length >= 2 &&
          new Set(exercise.optionIds).size === exercise.optionIds.length &&
          exercise.optionIds.includes(exercise.answer),
        `${exercise.id}: invalid choice answer/options`,
      );
      text(translated.options, exercise.optionIds, exercise.id);
    } else {
      assert.equal(
        exercise.type,
        "number",
        `${exercise.id}: unknown exercise type`,
      );
      assert.ok(
        typeof exercise.answer === "number" && Number.isFinite(exercise.answer),
        `${exercise.id}: invalid numeric answer`,
      );
      assert.ok(
        exercise.tolerance === undefined ||
          (Number.isFinite(exercise.tolerance) && exercise.tolerance >= 0),
        `${exercise.id}: invalid tolerance`,
      );
    }
    if (exercise.variantOf)
      assert.ok(
        e.has(exercise.variantOf) && exercise.variantOf !== exercise.id,
        `${exercise.id}: invalid review variant`,
      );
  }
  assert.equal(outlines.length, courses.length, "Each course needs an outline");
  const outlined = new Set();
  for (const outline of outlines) {
    assert.ok(
      c.has(outline.courseId) && !outlined.has(outline.courseId),
      "Invalid or duplicate course outline",
    );
    outlined.add(outline.courseId);
    const ids = [];
    for (const part of outline.parts) {
      text(locale.parts[part.id], ["title"], part.id);
      for (const unit of part.units) {
        text(locale.units[unit.id], ["title"], unit.id);
        assert.ok(
          Number.isSafeInteger(unit.number) && unit.number > 0,
          `${unit.id}: invalid unit number`,
        );
        ids.push(...unit.moduleIds);
      }
    }
    assert.deepEqual(
      [...ids].sort(),
      [...c.get(outline.courseId).moduleIds].sort(),
      `${outline.courseId}: outline must cover every course module exactly once`,
    );
  }
  let formulas = 0;
  const scan = (value) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(
        /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g,
      )) {
        renderToString(match[1] ?? match[2], {
          displayMode: match[2] !== undefined,
          throwOnError: true,
          trust: false,
        });
        formulas++;
      }
    } else if (value && typeof value === "object")
      for (const item of Object.values(value)) scan(item);
  };
  scan(locale);
  return {
    courses: c.size,
    modules: m.size,
    concepts: k.size,
    exercises: e.size,
    formulas,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log("Content checks passed:", checkContent());
