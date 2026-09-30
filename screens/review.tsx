import { BookOpen, RotateCcw, Check } from "lucide-react";
import { modules, locale, t } from "@/learning/content";
import { completedCount } from "@/learning/progress";
import type { ProgressState } from "@/learning/types";

export function ReviewScreen({
  progress,
  start,
  onCourses,
}: {
  progress: ProgressState;
  start: (id: string, mode: "learn" | "review") => void;
  onCourses: () => void;
}) {
  const available = modules.filter(
    (learningModule) =>
      completedCount(learningModule, progress) > 0 ||
      (learningModule.archived &&
        !!progress.sessions[`${learningModule.id}:learn`]),
  );
  if (!available.length)
    return (
      <section className="empty-state">
        <span className="empty-icon">
          <BookOpen size={34} />
        </span>
        <h2>{t("reviewEmpty")}</h2>
        <p>{t("reviewEmptyBody")}</p>
        <button className="primary-button" onClick={onCourses}>
          {t("reviewStart")}
        </button>
      </section>
    );
  return (
    <div className="review-grid">
      {available.map((learningModule) => {
        const resume =
          progress.sessions[`${learningModule.id}:review`] &&
          !progress.sessions[`${learningModule.id}:review`].finished;
        const previousLearning =
          progress.sessions[`${learningModule.id}:learn`];
        const resumeEarlier =
          learningModule.archived &&
          previousLearning &&
          !previousLearning.finished;
        return (
          <article className="review-card" key={learningModule.id}>
            <RotateCcw size={27} />
            <span className="eyebrow">
              {locale.courses[learningModule.courseId].category}
            </span>
            <h2>{locale.modules[learningModule.id].title}</h2>
            {learningModule.archived && (
              <p className="small-note">{t("legacyModule")}</p>
            )}
            <p>{locale.modules[learningModule.id].description}</p>
            <p className="small-note">{t("reviewHint")}</p>
            <button
              className="primary-button"
              onClick={() =>
                start(learningModule.id, resumeEarlier ? "learn" : "review")
              }
            >
              {t(
                resumeEarlier
                  ? "resumeEarlierModule"
                  : resume
                    ? "resumeReview"
                    : "reviewModule",
              )}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function CompletionScreen({
  moduleId,
  review,
  progress,
  sessionKey,
  onCourses,
  onReview,
  onNextModule,
}: {
  moduleId: string;
  review: boolean;
  progress: ProgressState;
  sessionKey: string;
  onCourses: () => void;
  onReview: () => void;
  onNextModule?: () => void;
}) {
  const session = progress.sessions[sessionKey];
  const solved = session.exerciseIds.filter(
    (id) => session.drafts[id]?.feedback === "correct",
  ).length;
  const reviewed = session.exerciseIds.filter(
    (id) =>
      session.drafts[id]?.solutionRevealed &&
      session.drafts[id]?.feedback !== "correct",
  ).length;
  return (
    <section className="completion-card">
      <span className="completion-icon">
        <Check size={38} strokeWidth={1.5} />
      </span>
      <span className="eyebrow">{locale.modules[moduleId].title}</span>
      <h1>{t(review ? "reviewComplete" : "moduleComplete")}</h1>
      <p>{t("completedMessage")}</p>
      <div className="completion-summary">
        {t("solvedSummary", { solved, reviewed })}
      </div>
      {onNextModule && (
        <button className="primary-button" onClick={onNextModule}>
          {t("nextModule")}
        </button>
      )}
      <button
        className={onNextModule ? "secondary-button" : "primary-button"}
        onClick={onReview}
      >
        {t("reviewAgain")}
      </button>
      <button className="secondary-button" onClick={onCourses}>
        {t("backCourses")}
      </button>
      <p className="small-note">{t("restartLater")}</p>
    </section>
  );
}
