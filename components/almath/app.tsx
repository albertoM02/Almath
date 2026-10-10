"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  refreshSession,
} from "@/learning/progress";
import { loadProgress, saveProgress } from "@/learning/storage";
import { hasCurrentSessionContent, restoredView } from "@/learning/navigation";
import type {
  DailyGoalPreferences,
  Draft,
  ProgressState,
  Session,
  View,
} from "@/learning/types";
import {
  dailyGoalPreferences,
  localDay,
  solvedToday,
} from "@/learning/daily-goal";
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
import { registerAndroidBackHandler } from "@/platform/android";
import {
  androidRemindersAvailable,
  registerReminderOpen,
  registerReminderResume,
  requestReminderPermission,
  syncDailyReminder,
  type ReminderStatus,
} from "@/platform/reminders";
import { DailyGoalCard, DailyGoalSettings } from "./daily-goal";

export function AlmathApp() {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [validationError, setValidationError] = useState("");
  const state = useRef(progress);
  const canPersist = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  const saveFailed = useRef(false);
  const [day, setDay] = useState(() => localDay(new Date()));
  const [goalSettingsOpen, setGoalSettingsOpen] = useState(false);
  const goalOverlay = useRef(false);
  const goalSaving = useRef(false);
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus>("off");
  const [reminderRefresh, setReminderRefresh] = useState(0);
  const syncedReminder = useRef("");
  const goalPreferences = useMemo(
    () => dailyGoalPreferences({ dailyGoal: progress.dailyGoal }),
    [progress.dailyGoal],
  );
  const dailySolved = useMemo(
    () => solvedToday({ attempts: progress.attempts }, day),
    [progress.attempts, day],
  );

  useEffect(() => {
    goalOverlay.current = goalSettingsOpen;
  }, [goalSettingsOpen]);

  const persist = useCallback((next: ProgressState) => {
    // Loading errors and early navigation must never overwrite existing data.
    if (!canPersist.current) return;
    state.current = next;
    setProgress(next);
    setSaveStatus("saving");
    saveFailed.current = false;
    const revision = ++saveRevision.current;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveProgress(next))
      .then(() => {
        if (revision === saveRevision.current) setSaveStatus("saved");
      })
      .catch((error) => {
        console.error("Could not save learning progress", error);
        if (revision === saveRevision.current) {
          saveFailed.current = true;
          setSaveStatus("error");
        }
      });
  }, []);

  const restoreProgress = useCallback((loaded: ProgressState) => {
    for (const [key, session] of Object.entries(loaded.sessions)) {
      const learningModule = modules.find(
        (item) => item.id === session.moduleId,
      );
      if (learningModule)
        loaded.sessions[key] = refreshSession(
          learningModule,
          exercises,
          loaded,
          session,
        );
    }
    loaded.view = restoredView(loaded.view, loaded);
    state.current = loaded;
    setProgress(loaded);
    window.history.replaceState(
      { view: loaded.view },
      "",
      `#${loaded.view.screen}`,
    );
    canPersist.current = true;
    setReady(true);
  }, []);

  const reportLoadError = useCallback((error: unknown) => {
    canPersist.current = false;
    setReady(false);
    console.error("Could not load learning progress", error);
    setLoadFailed(true);
  }, []);

  useEffect(() => {
    void loadProgress().then(restoreProgress).catch(reportLoadError);
  }, [restoreProgress, reportLoadError]);
  useEffect(() => {
    const onBack = (event: PopStateEvent) => {
      if (!canPersist.current) return;
      const view = restoredView(event.state?.view, state.current);
      persist({ ...state.current, view });
      setValidationError("");
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [persist]);

  const navigate = useCallback(
    (view: View) => {
      if (!canPersist.current) return;
      persist({ ...state.current, view });
      setValidationError("");
      window.history.pushState({ view }, "", `#${view.screen}`);
      window.scrollTo({ top: 0 });
    },
    [persist],
  );

  useEffect(() => {
    const refresh = () => {
      setDay(localDay(new Date()));
      setReminderRefresh((value) => value + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    // Also covers a web tab left open across midnight, without writing progress.
    const timer = window.setInterval(
      () => setDay(localDay(new Date())),
      30_000,
    );
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const removeResume = registerReminderResume(refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      removeResume();
    };
  }, []);

  useEffect(() => {
    if (!ready || saveStatus !== "saved") return;
    const completedDay = dailySolved >= goalPreferences.target ? day : "";
    const signature = `${goalPreferences.target}:${goalPreferences.reminderEnabled}:${goalPreferences.reminderTime}:${day}:${completedDay}:${reminderRefresh}`;
    if (syncedReminder.current === signature) return;
    let disposed = false;
    // The native receiver needs only a small mirror of the committed preferences
    // and completed day. IndexedDB remains the source of learning progress.
    void syncDailyReminder(goalPreferences, completedDay)
      .then((status) => {
        if (!disposed) {
          syncedReminder.current = signature;
          setReminderStatus(status);
        }
      })
      .catch((error) => {
        console.error("Could not schedule daily reminder", error);
        if (!disposed) setReminderStatus("error");
      });
    return () => {
      disposed = true;
    };
  }, [ready, saveStatus, goalPreferences, dailySolved, day, reminderRefresh]);

  useEffect(() => {
    if (!ready) return;
    return registerReminderOpen(() => {
      setGoalSettingsOpen(false);
      navigate({ screen: "courses" });
    });
  }, [ready, navigate]);

  async function saveGoalPreferences(preferences: DailyGoalPreferences) {
    goalSaving.current = true;
    try {
      if (preferences.reminderEnabled && !(await requestReminderPermission())) {
        setReminderStatus("blocked");
        throw new Error(t("dailyNotificationPermission"));
      }
      persist({ ...state.current, dailyGoal: preferences });
      await saveQueue.current;
      if (saveFailed.current) throw new Error(t("dailySettingsError"));
    } finally {
      goalSaving.current = false;
    }
  }

  function continueDailyLearning() {
    const current = state.current;
    const lastExercise = current.attempts.at(-1)?.exerciseId;
    const lastModule = modules.find((item) =>
      item.exerciseIds.includes(lastExercise ?? ""),
    );
    const unfinished = Object.values(current.sessions).filter(
      (session) => !session.finished,
    );
    const resume =
      unfinished.find((session) => session.moduleId === lastModule?.id) ??
      unfinished.at(-1);
    if (resume) {
      start(resume.moduleId, resume.mode);
      return;
    }
    const available = courses.flatMap((course) =>
      course.moduleIds.map(getModule),
    );
    const next = available.find(
      (item) =>
        !item.archived && item.exerciseIds.some((id) => !current.completed[id]),
    );
    start((next ?? available[0]).id, next ? "learn" : "review");
  }

  useEffect(() => {
    if (!ready) return;
    return registerAndroidBackHandler({
      dismissOverlay: () => {
        if (!goalOverlay.current) return false;
        if (!goalSaving.current) setGoalSettingsOpen(false);
        return true;
      },
      getView: () => state.current.view,
      getParentView: () => {
        const view = state.current.view;
        const session = view.sessionKey
          ? state.current.sessions[view.sessionKey]
          : undefined;
        if (session) {
          const learningModule = getModule(session.moduleId);
          return {
            screen: "units",
            courseId: learningModule.courseId,
            moduleId: learningModule.id,
          };
        }
        return { screen: "courses" };
      },
      replaceView: (view) => {
        persist({ ...state.current, view });
        setValidationError("");
        window.history.replaceState({ view }, "", `#${view.screen}`);
        window.scrollTo({ top: 0 });
      },
      flushProgress: async () => {
        // A later keystroke may enqueue another save while the first finishes.
        let pending;
        do {
          pending = saveQueue.current;
          await pending;
        } while (pending !== saveQueue.current);
        return !saveFailed.current;
      },
    });
  }, [persist, ready]);

  const start = useCallback(
    (moduleId: string, mode: "learn" | "review", index?: number) => {
      if (!canPersist.current) return;
      const learningModule = getModule(moduleId);
      const key = `${moduleId}:${mode}`;
      const current = state.current;
      const saved = current.sessions[key];
      const previous = saved
        ? refreshSession(learningModule, exercises, current, saved)
        : undefined;
      const compatible = previous && hasCurrentSessionContent(previous);
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

  useEffect(() => {
    if (!ready) return;
    return registerLearningTools({
      getProgress: () => state.current,
      navigate,
      start,
    });
  }, [navigate, start, ready]);

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
                  : view.screen === "courses"
                    ? t("dailyCourseIntro")
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
              <DailyGoalCard
                preferences={goalPreferences}
                solved={dailySolved}
                reminderStatus={reminderStatus}
                onSettings={() => {
                  setGoalSettingsOpen(true);
                  setReminderRefresh((value) => value + 1);
                }}
                onContinue={continueDailyLearning}
              />
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
      {goalSettingsOpen && (
        <DailyGoalSettings
          preferences={goalPreferences}
          android={androidRemindersAvailable()}
          reminderStatus={reminderStatus}
          onSave={saveGoalPreferences}
          onClose={() => setGoalSettingsOpen(false)}
        />
      )}
    </div>
  );
}
