import courseData from "@/content/courses.json";
import moduleData from "@/content/modules.json";
import conceptData from "@/content/concepts.json";
import exerciseData from "@/content/exercises.json";
import outlineData from "@/content/outlines.json";
import english from "@/content/locales/en.json";
import type {
  Course,
  CourseOutline,
  Module,
  Concept,
  Exercise,
  ConceptText,
  ExerciseText,
} from "./types";

export const courses = courseData as Course[];
export const outlines = outlineData as CourseOutline[];
export const modules = moduleData as Module[];
export const concepts = conceptData as Concept[];
export const exercises = exerciseData as Exercise[];
export const locale = english as {
  ui: Record<string, string>;
  courses: Record<
    string,
    { title: string; description: string; category: string }
  >;
  modules: Record<string, { title: string; description: string }>;
  parts: Record<string, { title: string }>;
  units: Record<string, { title: string }>;
  concepts: Record<string, ConceptText>;
  exercises: Record<string, ExerciseText>;
};

export function t(
  key: string,
  values: Record<string, string | number> = {},
): string {
  let text = locale.ui[key] ?? key;
  for (const [name, value] of Object.entries(values))
    text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export function getModule(id: string): Module {
  const learningModule = modules.find((item) => item.id === id);
  if (!learningModule) throw new Error(`Unknown module: ${id}`);
  return learningModule;
}

export function getNextModule(moduleId: string): Module | undefined {
  const current = getModule(moduleId);
  const course = courses.find((item) => item.id === current.courseId)!;
  const index = course.moduleIds.indexOf(moduleId);
  if (index < 0 || index + 1 === course.moduleIds.length) return undefined;
  return getModule(course.moduleIds[index + 1]);
}

export function getOutline(courseId: string): CourseOutline {
  const outline = outlines.find((item) => item.courseId === courseId);
  if (!outline) throw new Error(`Unknown course outline: ${courseId}`);
  return outline;
}

export function getOutlineSummary(courseId: string): string {
  const outline = getOutline(courseId);
  const units = outline.parts.reduce(
    (total, part) => total + part.units.length,
    0,
  );
  return t("outlineSummary", {
    units: t(units === 1 ? "unitCountOne" : "unitCountMany", { count: units }),
    parts: t(outline.parts.length === 1 ? "partCountOne" : "partCountMany", {
      count: outline.parts.length,
    }),
  });
}

export function getExercise(id: string): Exercise {
  const exercise = exercises.find((item) => item.id === id);
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return exercise;
}
