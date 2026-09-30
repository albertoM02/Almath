import {
  Lightbulb,
  BookOpen,
  Check,
  ChevronLeft,
  HelpCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { SaveIndicator, type SaveStatus } from "@/components/almath/shell";
import { getExercise, locale, t } from "@/learning/content";
import { emptyDraft, getConceptPosition } from "@/learning/progress";
import type { Session } from "@/learning/types";

export function LessonScreen({
  session,
  saveStatus,
  validationError,
  onExit,
  onStage,
  onAnswer,
  onHint,
  onCheck,
  onSolution,
  onNext,
  onPrevious,
  isLast,
}: {
  session: Session;
  saveStatus: SaveStatus;
  validationError: string;
  onExit: () => void;
  onStage: (stage: "theory" | "practice") => void;
  onAnswer: (answer: string) => void;
  onHint: () => void;
  onCheck: () => void;
  onSolution: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isLast: boolean;
}) {
  const exercise = getExercise(session.exerciseIds[session.index]);
  const text = locale.exercises[exercise.id];
  const theory = locale.concepts[exercise.conceptId];
  const position = getConceptPosition(
    session.exerciseIds.map((id) => getExercise(id).conceptId),
    session.index,
  );
  const draft = session.drafts[exercise.id] ?? emptyDraft();
  const finished = draft.feedback === "correct" || draft.solutionRevealed;
  const completed = session.exerciseIds.filter(
    (id) =>
      session.drafts[id]?.feedback === "correct" ||
      session.drafts[id]?.solutionRevealed,
  ).length;
  return (
    <div className="lesson-layout">
      <header className="lesson-header">
        <div className="lesson-header-inner">
          <div className="lesson-top-row">
            <button className="text-button light" onClick={onExit}>
              <ChevronLeft size={20} />
              {t("exit")}
            </button>
            <span className="lesson-module-title">
              {locale.modules[session.moduleId].title}
            </span>
            <SaveIndicator status={saveStatus} />
          </div>
          <div className="lesson-progress-caption">
            <span>
              {t(
                session.mode === "review"
                  ? "reviewPosition"
                  : "conceptPosition",
                {
                  current: position.current,
                  total: position.total,
                },
              )}
            </span>
            <span>
              {completed}/{session.exerciseIds.length}
            </span>
          </div>
          <Progress
            className="header-progress"
            value={(completed / session.exerciseIds.length) * 100}
            aria-label={t("completedCount", {
              done: completed,
              total: session.exerciseIds.length,
            })}
          />
        </div>
      </header>
      <main className="lesson-main" id="main-content">
        <Tabs
          className="lesson-tabs"
          value={session.stage}
          onValueChange={(value) => onStage(value as "theory" | "practice")}
        >
          <TabsList aria-label={t("lessonStage")}>
            <TabsTrigger value="theory">{t("theory")}</TabsTrigger>
            <TabsTrigger value="practice">{t("practice")}</TabsTrigger>
          </TabsList>
          <TabsContent value="theory" className="theory-content">
            <span className="eyebrow">
              {session.mode === "review"
                ? t("reviewTag")
                : locale.courses[
                    exercise.conceptId.startsWith("cs") ? "cs" : "ml"
                  ].category}
            </span>
            <h1 tabIndex={-1}>{theory.title}</h1>
            <p className="theory-body">{theory.body}</p>
            {theory.formula && <div className="formula">{theory.formula}</div>}
            <section className="example-panel">
              <h2>{t("example")}</h2>
              <p>{theory.example}</p>
              {theory.exampleSteps.length > 0 && (
                <ul>
                  {theory.exampleSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              )}
            </section>
            <aside className="takeaway">
              <span>
                <Lightbulb size={24} strokeWidth={1.5} />
              </span>
              <div>
                <h2>{t("takeaway")}</h2>
                <p>{theory.takeaway}</p>
              </div>
            </aside>
            <div className="lesson-actions">
              <button
                className="primary-button"
                onClick={() => onStage("practice")}
              >
                {t("tryExercise")}
              </button>
            </div>
          </TabsContent>
          <TabsContent value="practice" className="practice-content">
            <span className="eyebrow">
              {t("questionPosition", {
                current: position.question,
                total: position.questionCount,
              })}
            </span>
            <h1 tabIndex={-1}>{text.title}</h1>
            <div className="question-statement">{text.statement}</div>
            <p className="question-prompt" id="question-prompt">
              {text.prompt}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!finished) onCheck();
              }}
            >
              {exercise.type === "choice" ? (
                <RadioGroup
                  aria-labelledby="question-prompt"
                  value={draft.answer}
                  disabled={finished}
                  onValueChange={onAnswer}
                  className="answer-options"
                >
                  {exercise.optionIds!.map((id) => (
                    <label
                      key={id}
                      className={`answer-option ${draft.answer === id ? "selected" : ""} ${finished ? "answered" : ""}`}
                      htmlFor={`answer-${exercise.id}-${id}`}
                    >
                      <RadioGroupItem
                        value={id}
                        id={`answer-${exercise.id}-${id}`}
                      />
                      <span>
                        {id.toUpperCase()}. {text.options![id]}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="number-answer">
                  <label htmlFor="number-answer">{t("answerLabel")}</label>
                  <div className="numeric-input-row">
                    <button
                      type="button"
                      className="sign-button"
                      aria-label={t("changeSign")}
                      disabled={finished}
                      onClick={() =>
                        onAnswer(
                          draft.answer.startsWith("-")
                            ? draft.answer.slice(1)
                            : `-${draft.answer}`,
                        )
                      }
                    >
                      ±
                    </button>
                    <input
                      id="number-answer"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={draft.answer}
                      disabled={finished}
                      placeholder={t("answerPlaceholder")}
                      aria-describedby="number-help"
                      onChange={(event) => onAnswer(event.target.value)}
                    />
                  </div>
                  <p id="number-help" className="small-note">
                    {t("numericalHelp")}
                  </p>
                </div>
              )}
              {validationError && (
                <p className="validation-message" role="alert">
                  {validationError}
                </p>
              )}
              {draft.feedback && (
                <div className={`feedback ${draft.feedback}`} role="status">
                  <h2>
                    {draft.feedback === "correct" && <Check size={21} />}
                    {t(draft.feedback)}
                  </h2>
                  <p>
                    {draft.feedback === "correct"
                      ? text.explanation
                      : text.hint}
                  </p>
                </div>
              )}
              {draft.hintUsed &&
                draft.feedback !== "incorrect" &&
                !finished && (
                  <aside className="hint-panel">
                    <h2>
                      <Lightbulb size={19} />
                      {t("hint")}
                    </h2>
                    <p>{text.hint}</p>
                  </aside>
                )}
              {draft.solutionRevealed && (
                <section className="solution-panel">
                  <h2>{t("solutionTitle")}</h2>
                  <ol>
                    {text.solutionSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="small-note">{t("solutionNote")}</p>
                </section>
              )}
              <div className="support-actions">
                {!finished && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={onHint}
                    disabled={draft.hintUsed}
                  >
                    <HelpCircle size={19} />
                    {t("needHint")}
                  </button>
                )}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onStage("theory")}
                >
                  <BookOpen size={19} />
                  {t("reviewTheory")}
                </button>
              </div>
              {!finished && draft.attempts > 0 && (
                <button
                  className="text-button solution-link"
                  type="button"
                  onClick={onSolution}
                >
                  {t("solution")}
                </button>
              )}
              <div className="lesson-actions">
                {finished ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={onNext}
                  >
                    {t(isLast ? "finishModule" : "nextExercise")}
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!draft.answer.trim()}
                  >
                    {t("checkAnswer")}
                  </button>
                )}
              </div>
            </form>
          </TabsContent>
        </Tabs>
        {session.index > 0 && (
          <button
            className="text-button previous-exercise"
            onClick={onPrevious}
          >
            <ChevronLeft size={17} />
            {t("previous")}
          </button>
        )}
      </main>
    </div>
  );
}
