import { BookOpen, Check, Circle, Play } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { getExercise, getModule, locale, t } from "@/learning/content";
import { completedCount } from "@/learning/progress";
import type { ProgressState } from "@/learning/types";

export function ModuleEntry({
  moduleId,
  progress,
  start,
}: {
  moduleId: string;
  progress: ProgressState;
  start: (id: string, mode: "learn" | "review", index?: number) => void;
}) {
  const learningModule = getModule(moduleId);
  const done = completedCount(learningModule, progress);
  const total = learningModule.exerciseIds.length;
  const complete = done === total;
  const started = !!progress.sessions[`${moduleId}:learn`];
  const Icon = complete ? Check : started ? Play : Circle;

  return (
    <section
      className={`module-entry ${started && !complete ? "in-progress" : ""}`}
      aria-label={locale.modules[moduleId].title}
    >
      <div className="module-entry-row">
        <span className={`module-state ${complete ? "complete" : ""}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="module-entry-info">
          <h4>{locale.modules[moduleId].title}</h4>
          <p>{locale.modules[moduleId].description}</p>
        </div>
        <button
          className="primary-button module-start"
          onClick={() => start(moduleId, complete ? "review" : "learn")}
        >
          {complete
            ? t("reviewModule")
            : started
              ? t("continue")
              : t("startModule")}
        </button>
      </div>
      <div className="module-entry-progress">
        <p>{t("availableModuleProgress", { done, total })}</p>
        <Progress
          value={(done / total) * 100}
          aria-label={t("availableModuleProgress", { done, total })}
        />
      </div>
      <Accordion type="single" collapsible className="module-questions">
        <AccordionItem value={`${moduleId}-questions`}>
          <AccordionTrigger>{t("viewQuestions")}</AccordionTrigger>
          <AccordionContent>
            <ol className="exercise-list">
              {learningModule.exerciseIds.map((exerciseId, index) => {
                const exercise = getExercise(exerciseId);
                const status = progress.completed[exerciseId]?.result;
                const current =
                  progress.sessions[`${moduleId}:learn`]?.index === index &&
                  !status;
                const StatusIcon =
                  status === "solved"
                    ? Check
                    : status === "reviewed"
                      ? BookOpen
                      : Circle;
                return (
                  <li key={exerciseId}>
                    <button onClick={() => start(moduleId, "learn", index)}>
                      <span
                        className={`exercise-number ${status || (current ? "current" : "")}`}
                      >
                        {status ? (
                          <StatusIcon size={18} aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span>
                        <strong>{locale.exercises[exerciseId].title}</strong>
                        <small>
                          {locale.concepts[exercise.conceptId].title}
                        </small>
                      </span>
                      <span className="exercise-status">
                        {t(status || (current ? "current" : "ready"))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
