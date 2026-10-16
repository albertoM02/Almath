import { useEffect, useRef, useState } from "react";
import { Bell, Check, Flame, Settings, X } from "lucide-react";
import { t } from "@/learning/content";
import type { DailyGoalPreferences } from "@/learning/types";
import type { StreakSummary } from "@/learning/streak";
import {
  openReminderSettings,
  type ReminderStatus,
} from "@/platform/reminders";

export function DailyGoalCard({
  preferences,
  solved,
  streak,
  reminderStatus,
  onSettings,
  onContinue,
}: {
  preferences: DailyGoalPreferences;
  solved: number;
  streak: StreakSummary;
  reminderStatus: ReminderStatus;
  onSettings: () => void;
  onContinue: () => void;
}) {
  const complete = solved >= preferences.target;
  const reminderNeedsAttention =
    reminderStatus === "blocked" || reminderStatus === "error";
  const reminderMessage =
    reminderStatus === "blocked"
      ? t("dailyNotificationsBlocked")
      : t("dailyReminderError");
  return (
    <section
      className={`daily-goal-card ${complete ? "goal-complete" : ""}`}
      aria-labelledby="streak-heading"
      aria-describedby="streak-rule"
    >
      <div className="streak-heading">
        <div className="streak-title-block">
          <h2 id="streak-heading">
            <Flame
              size={27}
              className={`streak-icon ${streak.current ? "active" : ""}`}
              aria-hidden="true"
            />
            <span aria-live="polite">
              {t(streak.current === 1 ? "streakCountOne" : "streakCountMany", {
                count: streak.current,
              })}
            </span>
          </h2>
          <span className="streak-best">
            {t(streak.best === 1 ? "streakBestOne" : "streakBestMany", {
              count: streak.best,
            })}
          </span>
        </div>
        <button
          className={`icon-button daily-settings-button ${reminderNeedsAttention ? "needs-attention" : ""}`}
          aria-label={`${t("dailyGoalSettings")}${reminderNeedsAttention ? `. ${reminderMessage}` : ""}`}
          title={
            reminderNeedsAttention ? reminderMessage : t("dailyGoalSettings")
          }
          onClick={onSettings}
        >
          <Settings size={23} aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" id="streak-rule">
        {t("streakRule")}{" "}
        {t(streak.earnedToday ? "streakTodayDone" : "streakTodayPending")}
      </p>
      <ol className="streak-week" aria-label={t("streakWeek")}>
        {streak.week.map((item) => {
          const date = new Date(`${item.day}T12:00:00Z`);
          const weekday = new Intl.DateTimeFormat("en", {
            weekday: "long",
            timeZone: "UTC",
          }).format(date);
          const description = new Intl.DateTimeFormat("en", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          }).format(date);
          const status = t(
            item.completed
              ? "streakDayDone"
              : item.future
                ? "streakDayFuture"
                : item.today
                  ? "streakTodayPending"
                  : "streakDayMissed",
          );
          return (
            <li
              key={item.day}
              aria-current={item.today ? "date" : undefined}
              aria-label={`${description}: ${status}`}
              title={`${description}: ${status}`}
            >
              <span className="streak-weekday" aria-hidden="true">
                {weekday.slice(0, 1)}
              </span>
              <span
                className={`streak-day ${item.completed ? "completed" : ""} ${item.today ? "today" : ""}`}
                aria-hidden="true"
              >
                {item.completed && <Check size={17} strokeWidth={3} />}
                {!item.completed && !item.today && !item.future && (
                  <span className="streak-missed" />
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="daily-goal-summary">
        <h3 id="daily-goal-title">
          {complete && <Check size={18} aria-hidden="true" />}
          {t(complete ? "dailyGoalReached" : "dailyGoal")}
        </h3>
        <strong aria-live="polite">
          {solved} / {preferences.target}
        </strong>
      </div>
      <div
        className="daily-goal-bar"
        role="progressbar"
        aria-labelledby="daily-goal-title"
        aria-valuenow={Math.min(solved, preferences.target)}
        aria-valuemin={0}
        aria-valuemax={preferences.target}
        aria-valuetext={t("dailyGoalProgress", {
          solved,
          target: preferences.target,
        })}
      >
        <span
          style={{
            width: `${Math.min(100, (solved / preferences.target) * 100)}%`,
          }}
        />
      </div>
      <button
        className={complete ? "secondary-button" : "primary-button"}
        onClick={onContinue}
      >
        {t(complete ? "dailyKeepLearning" : "dailyContinueLearning")}
      </button>
    </section>
  );
}

export function DailyGoalSettings({
  preferences,
  android,
  reminderStatus,
  onSave,
  onClose,
}: {
  preferences: DailyGoalPreferences;
  android: boolean;
  reminderStatus: ReminderStatus;
  onSave: (preferences: DailyGoalPreferences) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState(String(preferences.target));
  const [custom, setCustom] = useState(
    ![3, 5, 10].includes(preferences.target),
  );
  const [enabled, setEnabled] = useState(preferences.reminderEnabled);
  const [time, setTime] = useState(preferences.reminderTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(target);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      setError(t("dailyInvalidTarget"));
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError(t("dailyInvalidTime"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        target: value,
        reminderEnabled: android && enabled,
        reminderTime: time,
      });
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t("dailySettingsError"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    // Backdrop click supplements the Close button and native Escape handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      className="daily-goal-dialog"
      aria-labelledby="daily-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) onClose();
      }}
    >
      <form onSubmit={save} className="daily-goal-form">
        <span className="daily-sheet-handle" aria-hidden="true" />
        <div className="daily-goal-heading">
          <h2 id="daily-settings-title">{t("dailyGoalSettings")}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("dailyCloseSettings")}
          >
            <X size={24} />
          </button>
        </div>
        <fieldset disabled={busy} className="daily-target-field">
          <legend>{t("dailyGoal")}</legend>
          <p className="small-note">{t("dailyTargetLabel")}</p>
          <div
            className="daily-target-options"
            role="group"
            aria-label={t("dailyTargetLabel")}
          >
            {[3, 5, 10].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={!custom && target === String(value)}
                onClick={() => {
                  setTarget(String(value));
                  setCustom(false);
                }}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={custom}
              onClick={() => setCustom(true)}
            >
              {t("dailyCustom")}
            </button>
          </div>
          {custom && (
            <label className="daily-custom-label">
              {t("dailyCustomTarget")}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                required
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
          )}
          <p className="small-note">{t("dailyRevealedExcluded")}</p>
          <p className="small-note">{t("streakRule")}</p>
        </fieldset>
        <fieldset disabled={busy} className="daily-reminder-field">
          <div className="daily-toggle-row">
            <label htmlFor="daily-reminder-enabled">
              <Bell size={23} aria-hidden="true" />
              {t("dailyReminder")}
            </label>
            <input
              id="daily-reminder-enabled"
              type="checkbox"
              role="switch"
              checked={android && enabled}
              disabled={!android}
              onChange={(event) => setEnabled(event.target.checked)}
            />
          </div>
          <p className="small-note">
            {t(
              android ? "dailyReminderDescription" : "dailyReminderAndroidOnly",
            )}
          </p>
          {android && (
            <>
              <label className="daily-time-label" htmlFor="daily-reminder-time">
                {t("dailyReminderTime")}
              </label>
              <input
                id="daily-reminder-time"
                type="time"
                required
                value={time}
                disabled={!enabled}
                onChange={(event) => setTime(event.target.value)}
              />
              <p className="small-note">{t("dailyReminderSkip")}</p>
              <p className="small-note">{t("dailyReminderTiming")}</p>
            </>
          )}
          {android && reminderStatus === "error" && (
            <p className="daily-settings-error" role="status">
              {t("dailyReminderError")}
            </p>
          )}
          {android && reminderStatus === "blocked" && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                void openReminderSettings().catch(() =>
                  setError(t("dailySettingsError")),
                );
              }}
            >
              {t("dailyOpenNotifications")}
            </button>
          )}
        </fieldset>
        {error && (
          <p className="daily-settings-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={busy}>
          {t(busy ? "saving" : "dailySavePreferences")}
        </button>
      </form>
    </dialog>
  );
}
