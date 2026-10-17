import { Network, Box, Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  courses,
  exercises,
  modules,
  getModule,
  locale,
  t,
} from "@/learning/content";
import { coursesByRecentUse } from "@/learning/course-order";
import { completedCount } from "@/learning/progress";
import type { ProgressState, View } from "@/learning/types";

export function CourseScreen({
  progress,
  start,
  navigate,
}: {
  progress: ProgressState;
  start: (moduleId: string, mode: "learn" | "review") => void;
  navigate: (view: View) => void;
}) {
  return (
    <div className="course-grid">
      {coursesByRecentUse(courses, modules, exercises, progress).map(
        (course) => {
          const available = course.moduleIds.map(getModule);
          const learningModule =
            available.find(
              (item) =>
                completedCount(item, progress) < item.exerciseIds.length,
            ) ?? available[0];
          const done = completedCount(learningModule, progress);
          const started = !!progress.sessions[`${learningModule.id}:learn`];
          const complete = done === learningModule.exerciseIds.length;
          const courseDone = available.reduce(
            (total, item) => total + completedCount(item, progress),
            0,
          );
          const courseTotal = available.reduce(
            (total, item) => total + item.exerciseIds.length,
            0,
          );
          const Icon = course.icon === "logic" ? Network : Box;
          return (
            <article className="course-card" key={course.id}>
              <div className="course-card-heading">
                <span className={`course-icon ${course.id}`}>
                  <Icon strokeWidth={1.3} size={36} aria-hidden="true" />
                </span>
                <div>
                  <span className="eyebrow">
                    {locale.courses[course.id].category}
                  </span>
                  <h2>{locale.courses[course.id].title}</h2>
                </div>
              </div>
              <p className="course-description">
                {locale.courses[course.id].description}
              </p>
              <p className="small-note">
                {t(
                  available.length === 1
                    ? "modulesReadyOne"
                    : "modulesReadyMany",
                  { count: available.length },
                )}
              </p>
              <div className="module-preview">
                <Layers size={17} aria-hidden="true" />
                <span>{locale.modules[learningModule.id].title}</span>
                <span className="exercise-total">
                  {t("exerciseCount", {
                    count: learningModule.exerciseIds.length,
                  })}
                </span>
              </div>
              <div className="course-progress">
                <p>
                  {courseDone
                    ? t("availableCourseProgress", {
                        done: courseDone,
                        total: courseTotal,
                      })
                    : t("notStarted")}
                </p>
                <Progress
                  value={(courseDone / courseTotal) * 100}
                  aria-label={t("availableCourseProgress", {
                    done: courseDone,
                    total: courseTotal,
                  })}
                />
              </div>
              <button
                className="primary-button"
                onClick={() =>
                  start(learningModule.id, complete ? "review" : "learn")
                }
              >
                {complete
                  ? t("reviewModule")
                  : started
                    ? t("continue")
                    : t("startModule")}
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  navigate({ screen: "units", courseId: course.id })
                }
              >
                {t("viewUnits")}
              </button>
            </article>
          );
        },
      )}
    </div>
  );
}
