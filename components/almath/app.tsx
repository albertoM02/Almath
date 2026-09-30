"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, AlertCircle } from "lucide-react";
import {
  courses,
  modules,
  exercises,
  getExercise,
  getModule,
  getNextModule,
  getOutlineSummary,
  locale,
  t,
} from "@/learning/content";
import { checkAnswer } from "@/learning/grading";
import {
  createSession,
  emptyDraft,
  emptyProgress,
  markCompleted,
} from "@/learning/progress";
import { loadProgress, saveProgress } from "@/learning/storage";
import type { Draft, ProgressState, Session, View } from "@/learning/types";
import {
  HomeHeader,
  BackButton,
  BottomNavigation,
  SaveIndicator,
  type SaveStatus,
} from "./shell";
import { CourseScreen } from "@/screens/courses";
import { UnitsScreen } from "@/screens/units";
import { LessonScreen } from "@/screens/lesson";
import { ReviewScreen, CompletionScreen } from "@/screens/review";
import { AboutScreen } from "@/screens/about";
import { registerLearningTools } from "@/learning/webmcp";

export function AlmathApp() {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [validationError, setValidationError] = useState("");
  const state = useRef(progress);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);

  const persist = useCallback((next: ProgressState) => {
    state.current = next;
    setProgress(next);
    setSaveStatus("saving");
    const revision = ++saveRevision.current;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveProgress(next))
      .then(() => {
        if (revision === saveRevision.current) setSaveStatus("saved");
      })
      .catch((error) => {
        console.error("Could not save learning progress", error);
        if (revision === saveRevision.current) setSaveStatus("error");
      });
  }, []);

  const restoreProgress = useCallback((loaded: ProgressState) => {
    // Content edits preserve completions; changed sessions are rebuilt when reopened.
    if (loaded.view.sessionKey && !loaded.sessions[loaded.view.sessionKey])
      loaded.view = { screen: "courses" };
    if (
      loaded.view.courseId &&
      !courses.some((course) => course.id === loaded.view.courseId)
    )
      loaded.view = { screen: "courses" };
    if (loaded.view.sessionKey) {
      const session = loaded.sessions[loaded.view.sessionKey];
      const currentModule = modules.find(
        (item) => item.id === session.moduleId,
      );
      if (
        !currentModule ||
        !exercises.some(
          (exercise) => exercise.id === session.exerciseIds[session.index],
        ) ||
        session.contentVersion !== currentModule.version
      )
        loaded.view = { screen: "courses" };
    }
    state.current = loaded;
    setProgress(loaded);
    setReady(true);
    window.history.replaceState(
      { view: loaded.view },
      "",
      `#${loaded.view.screen}`,
    );
  }, []);

  const reportLoadError = useCallback((error: unknown) => {
    console.error("Could not load learning progress", error);
    setLoadFailed(true);
  }, []);

  useEffect(() => {
    void loadProgress().then(restoreProgress).catch(reportLoadError);
  }, [restoreProgress, reportLoadError]);
  useEffect(() => {
    const onBack = (event: PopStateEvent) => {
      const view = event.state?.view as View | undefined;
      if (view && (!view.sessionKey || state.current.sessions[view.sessionKey]))
        persist({ ...state.current, view });
      else persist({ ...state.current, view: { screen: "courses" } });
      setValidationError("");
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [persist]);

  const navigate = useCallback(
    (view: View) => {
      persist({ ...state.current, view });
      setValidationError("");
      window.history.pushState({ view }, "", `#${view.screen}`);
      window.scrollTo({ top: 0 });
    },
    [persist],
  );

  const start = useCallback(
    (moduleId: string, mode: "learn" | "review", index?: number) => {
      const learningModule = getModule(moduleId);
      const key = `${moduleId}:${mode}`;
      const current = state.current;
      const previous = current.sessions[key];
      const compatible =
        previous &&
        previous.contentVersion === learningModule.version &&
        previous.exerciseIds.every((id) =>
          exercises.some((exercise) => exercise.id === id),
        );
      let session =
        compatible &&
        (!previous.finished || (mode === "learn" && index !== undefined))
          ? { ...previous }
          : createSession(learningModule, exercises, current, mode, index ?? 0);
      if (index !== undefined)
        session = { ...session, index, stage: "theory", finished: false };
      const view: View = {
        screen: "lesson",
        courseId: learningModule.courseId,
        sessionKey: key,
      };
      persist({
        ...current,
        sessions: { ...current.sessions, [key]: session },
        view,
      });
      setValidationError("");
      window.history.pushState({ view }, "", "#lesson");
      window.scrollTo({ top: 0 });
    },
    [persist],
  );

  function changeSession(changes: Partial<Session>) {
    const current = state.current;
    const key = current.view.sessionKey!;
    persist({
      ...current,
      sessions: {
        ...current.sessions,
        [key]: { ...current.sessions[key], ...changes },
      },
    });
  }

  function changeDraft(changes: Partial<Draft>) {
    const session = state.current.sessions[state.current.view.sessionKey!];
    const id = session.exerciseIds[session.index];
    changeSession({
      drafts: {
        ...session.drafts,
        [id]: { ...(session.drafts[id] ?? emptyDraft()), ...changes },
      },
    });
    setValidationError("");
  }

  function submitAnswer() {
    const current = state.current;
    const key = current.view.sessionKey!;
    const session = current.sessions[key];
    const exercise = getExercise(session.exerciseIds[session.index]);
    const draft = session.drafts[exercise.id] ?? emptyDraft();
    if (draft.feedback === "correct" || draft.solutionRevealed) return;
    const correct = checkAnswer(exercise, draft.answer);
    if (correct === null) {
      setValidationError(
        t(exercise.type === "number" ? "invalidNumber" : "selectAnswer"),
      );
      return;
    }
    const now = new Date().toISOString();
    const next = correct
      ? markCompleted(current, session, "solved", now)
      : current;
    persist({
      ...next,
      sessions: {
        ...next.sessions,
        [key]: {
          ...session,
          drafts: {
            ...session.drafts,
            [exercise.id]: {
              ...draft,
              feedback: correct ? "correct" : "incorrect",
              attempts: draft.attempts + 1,
            },
          },
        },
      },
      attempts: [
        ...current.attempts,
        {
          exerciseId: exercise.id,
          version: exercise.version,
          answer: draft.answer,
          correct,
          hintUsed: draft.hintUsed,
          at: now,
        },
      ],
    });
    setValidationError("");
  }

  function revealSolution() {
    const current = state.current;
    const key = current.view.sessionKey!;
    const session = current.sessions[key];
    const id = session.exerciseIds[session.index];
    const draft = session.drafts[id] ?? emptyDraft();
    const next = markCompleted(
      current,
      session,
      "reviewed",
      new Date().toISOString(),
    );
    persist({
      ...next,
      sessions: {
        ...next.sessions,
        [key]: {
          ...session,
          drafts: {
            ...session.drafts,
            [id]: { ...draft, solutionRevealed: true, feedback: null },
          },
        },
      },
    });
  }

  function moveToExercise(index: number) {
    const session = state.current.sessions[state.current.view.sessionKey!];
    const current = getExercise(session.exerciseIds[session.index]);
    const next = getExercise(session.exerciseIds[index]);
    changeSession({
      index,
      stage: current.conceptId === next.conceptId ? "practice" : "theory",
    });
    setValidationError("");
    window.scrollTo({ top: 0 });
  }

  function nextExercise() {
    const current = state.current;
    const key = current.view.sessionKey!;
    const session = current.sessions[key];
    const unresolved = session.exerciseIds.findIndex(
      (id) =>
        !session.drafts[id]?.solutionRevealed &&
        session.drafts[id]?.feedback !== "correct",
    );
    const nextIndex =
      session.index + 1 < session.exerciseIds.length
        ? session.index + 1
        : unresolved;
    if (nextIndex < 0) {
      const view: View = { ...current.view, screen: "complete" };
      persist({
        ...current,
        view,
        sessions: {
          ...current.sessions,
          [key]: { ...session, finished: true },
        },
        reviewCounts:
          session.mode === "review"
            ? {
                ...current.reviewCounts,
                [session.moduleId]:
                  (current.reviewCounts[session.moduleId] ?? 0) + 1,
              }
            : current.reviewCounts,
      });
      window.history.replaceState({ view }, "", "#complete");
    } else moveToExercise(nextIndex);
    setValidationError("");
    window.scrollTo({ top: 0 });
  }

  useEffect(
    () =>
      registerLearningTools({
        getProgress: () => state.current,
        navigate,
        start,
      }),
    [navigate, start],
  );

  if (!ready)
    return (
      <main className="loading-screen">
        <BookOpen size={34} />
        <h1>{t(loadFailed ? "loadError" : "loading")}</h1>
        {loadFailed && (
          <button
            className="primary-button"
            onClick={() => {
              setLoadFailed(false);
              void loadProgress().then(restoreProgress).catch(reportLoadError);
            }}
          >
            {t("retry")}
          </button>
        )}
      </main>
    );
  const view = progress.view;
  const session = view.sessionKey
    ? progress.sessions[view.sessionKey]
    : undefined;
  const lesson = view.screen === "lesson" && session;
  const about = () => navigate({ screen: "about" });
  const allCourses = () => navigate({ screen: "courses" });
  const title =
    view.screen === "review"
      ? t("yourReview")
      : view.screen === "units"
        ? locale.courses[view.courseId!].title
        : view.screen === "about"
          ? t("about")
          : t("chooseCourse");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      {saveStatus === "error" && (
        <div className="save-error-banner" role="alert">
          <AlertCircle size={19} />
          <span>{t("saveError")}</span>
          <button onClick={() => persist(state.current)}>
            {t("retrySave")}
          </button>
        </div>
      )}
      {lesson ? (
        <LessonScreen
          session={session}
          saveStatus={saveStatus}
          validationError={validationError}
          onExit={() =>
            navigate({
              screen: "units",
              courseId: getModule(session.moduleId).courseId,
              moduleId: session.moduleId,
            })
          }
          onStage={(stage) => {
            changeSession({ stage });
            setValidationError("");
          }}
          onAnswer={(answer) => changeDraft({ answer, feedback: null })}
          onHint={() => changeDraft({ hintUsed: true })}
          onCheck={submitAnswer}
          onSolution={revealSolution}
          onNext={nextExercise}
          onPrevious={() => moveToExercise(session.index - 1)}
          isLast={
            session.index === session.exerciseIds.length - 1 &&
            session.exerciseIds.every(
              (id) =>
                session.drafts[id]?.feedback === "correct" ||
                session.drafts[id]?.solutionRevealed,
            )
          }
        />
      ) : (
        <>
          <HomeHeader
            title={
              view.screen === "complete"
                ? locale.modules[session!.moduleId].title
                : title
            }
            subtitle={
              view.screen === "review"
                ? t("reviewIntro")
                : view.screen === "units"
                  ? getOutlineSummary(view.courseId!)
                  : undefined
            }
            onAbout={about}
            onBack={view.screen === "units" ? allCourses : undefined}
          />
          <main
            className={`home-main ${view.screen !== "courses" && view.screen !== "review" ? "narrow" : ""} ${view.screen === "units" ? "units-main" : ""}`}
            id="main-content"
          >
            {view.screen === "about" && (
              <BackButton onClick={allCourses}>{t("courseBack")}</BackButton>
            )}
            {view.screen === "courses" && (
              <CourseScreen
                progress={progress}
                start={start}
                navigate={navigate}
              />
            )}
            {view.screen === "units" && (
              <UnitsScreen
                key={view.courseId}
                courseId={view.courseId!}
                activeModuleId={view.moduleId}
                progress={progress}
                start={start}
              />
            )}
            {view.screen === "review" && (
              <ReviewScreen
                progress={progress}
                start={start}
                onCourses={allCourses}
              />
            )}
            {view.screen === "complete" && session && (
              <CompletionScreen
                moduleId={session.moduleId}
                review={session.mode === "review"}
                progress={progress}
                sessionKey={view.sessionKey!}
                onCourses={allCourses}
                onReview={() => start(session.moduleId, "review")}
                onNextModule={
                  session.mode === "learn" && getNextModule(session.moduleId)
                    ? () => start(getNextModule(session.moduleId)!.id, "learn")
                    : undefined
                }
              />
            )}
            {view.screen === "about" && <AboutScreen />}
            <footer className="content-footer">
              <SaveIndicator status={saveStatus} />
              <button className="text-button" onClick={about}>
                {t("about")}
              </button>
            </footer>
          </main>
          <BottomNavigation view={view} navigate={navigate} />
        </>
      )}
    </div>
  );
}
