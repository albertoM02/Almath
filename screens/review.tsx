import { BookOpen, Shuffle, Check } from "lucide-react";
import { exercises, modules, locale, t } from "@/learning/content";
import {
  completedReviewIds,
  hasCurrentMixedReview,
  isMixedReview,
  MIXED_REVIEW_KEY,
} from "@/learning/review";
import type { ProgressState } from "@/learning/types";

export function ReviewScreen({
  progress,
  onStart,
  onCourses,
}: {
  progress: ProgressState;
  onStart: () => void;
  onCourses: () => void;
}) {
  const available = completedReviewIds(modules, exercises, progress);
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
  const ids = new Set(available);
  const courseCount = new Set(
    modules
      .filter((module) => module.exerciseIds.some((id) => ids.has(id)))
      .map((module) => module.courseId),
  ).size;
  const saved = progress.sessions[MIXED_REVIEW_KEY];
  const resume =
    saved &&
    !saved.finished &&
    hasCurrentMixedReview(saved, modules, exercises, progress);
  const done = resume
    ? saved.exerciseIds.filter(
        (id) =>
          saved.drafts[id]?.feedback === "correct" ||
          saved.drafts[id]?.solutionRevealed,
      ).length
    : 0;
  return (
    <section className="review-card mixed-review">
      <Shuffle size={30} aria-hidden="true" />
      <span className="eyebrow">{t("mixedReviewCourses")}</span>
      <h2>{t("mixedReviewTitle")}</h2>
      <p>
        {t("mixedReviewPool", {
          questions: t(
            available.length === 1
              ? "mixedReviewQuestionOne"
              : "mixedReviewQuestionMany",
            { count: available.length },
          ),
          courses: t(
            courseCount === 1
              ? "mixedReviewCourseOne"
              : "mixedReviewCourseMany",
            { count: courseCount },
          ),
        })}
      </p>
      <p className="small-note">{t("mixedReviewHint")}</p>
      {resume && (
        <p className="small-note">
          {t("mixedReviewProgress", { done, total: saved.exerciseIds.length })}
        </p>
      )}
      <button className="primary-button" onClick={onStart}>
        {t(resume ? "resumeReview" : "mixedReviewStart")}
      </button>
    </section>
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
  const mixed = isMixedReview(session);
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
      <span className="eyebrow">
        {mixed ? t("mixedReviewCourses") : locale.modules[moduleId].title}
      </span>
      <h1>{t(review ? "reviewComplete" : "moduleComplete")}</h1>
      <p>{t(mixed ? "mixedReviewComplete" : "completedMessage")}</p>
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
        {t(mixed ? "mixedReviewAgain" : "reviewAgain")}
      </button>
      <button className="secondary-button" onClick={onCourses}>
        {t(mixed ? "mixedReviewBack" : "backCourses")}
      </button>
      <p className="small-note">{t("restartLater")}</p>
    </section>
  );
}
