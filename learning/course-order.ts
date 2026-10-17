import type { Course, Exercise, Module, ProgressState } from "./types";

export function coursesByRecentUse(
  courses: Course[],
  modules: Module[],
  exercises: Exercise[],
  progress: ProgressState,
): Course[] {
  const known = new Set(courses.map((course) => course.id));
  let recent = progress.recentCourse?.id;
  if (!recent || !known.has(recent)) {
    recent = progress.view.courseId;
    if (!recent || !known.has(recent)) {
      const attempts = [...progress.attempts].sort(
        (a, b) => Date.parse(b.at) - Date.parse(a.at),
      );
      recent = undefined;
      for (const attempt of attempts) {
        const exercise = exercises.find(
          (item) => item.id === attempt.exerciseId,
        );
        const id = exercise?.variantOf ?? attempt.exerciseId;
        const module = modules.find((item) => item.exerciseIds.includes(id));
        if (module && known.has(module.courseId)) {
          recent = module.courseId;
          break;
        }
      }
    }
  }
  return [
    ...courses.filter((course) => course.id === recent),
    ...courses.filter((course) => course.id !== recent),
  ];
}
