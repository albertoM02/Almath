import { courses, exercises, modules } from "./content";
import { isView } from "./progress";
import { hasCurrentMixedReview, isMixedReview } from "./review";
import type { ProgressState, Session, View } from "./types";

export function hasCurrentSessionContent(
  session: Session,
  progress?: ProgressState,
): boolean {
  if (isMixedReview(session))
    return (
      !!progress && hasCurrentMixedReview(session, modules, exercises, progress)
    );
  const currentModule = modules.find((item) => item.id === session.moduleId);
  return (
    !!currentModule &&
    session.contentVersion === currentModule.version &&
    session.exerciseIds.length === currentModule.exerciseIds.length &&
    session.baseExerciseIds.every(
      (id, index) => id === currentModule.exerciseIds[index],
    ) &&
    session.exerciseIds.every((id, index) =>
      exercises.some(
        (exercise) =>
          exercise.id === id &&
          (id === session.baseExerciseIds[index] ||
            (session.mode === "review" &&
              exercise.variantOf === session.baseExerciseIds[index])),
      ),
    )
  );
}

export function restoredView(value: unknown, progress: ProgressState): View {
  const home: View = { screen: "courses" };
  if (!isView(value)) return home;
  if (value.courseId && !courses.some((course) => course.id === value.courseId))
    return home;
  if (value.sessionKey) {
    const session = progress.sessions[value.sessionKey];
    if (!session) return home;
    if (!hasCurrentSessionContent(session, progress))
      return isMixedReview(session) ? { screen: "review" } : home;
    if (value.screen === "complete" && !session.finished)
      return { ...value, screen: "lesson" };
  }
  return value;
}
