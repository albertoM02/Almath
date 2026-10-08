import { useEffect, useRef, useState } from "react";
import { Bell, Check, Settings, X } from "lucide-react";
import { t } from "@/learning/content";
import type { DailyGoalPreferences } from "@/learning/types";
import {
  openReminderSettings,
  type ReminderStatus,
} from "@/platform/reminders";

export function DailyGoalCard({
  preferences,
  solved,
  reminderStatus,
  onSettings,
  onContinue,
}: {
  preferences: DailyGoalPreferences;
  solved: number;
  reminderStatus: ReminderStatus;
  onSettings: () => void;
  onContinue: () => void;
}) {
  const complete = solved >= preferences.target;
  const reminderText =
    reminderStatus === "blocked"
      ? t("dailyNotificationsBlocked")
      : reminderStatus === "error"
        ? t("dailyReminderError")
        : reminderStatus === "ready"
          ? complete
            ? t("dailyReminderCancelled")
            : t("dailyReminderAt", { time: preferences.reminderTime })
          : t("dailySetReminder");
  return (
    <section
      className={`daily-goal-card ${complete ? "goal-complete" : ""}`}
      aria-labelledby="daily-goal-title"
    >
      <div className="daily-goal-heading">
        <h2 id="daily-goal-title">
          {complete ? (
            <>
              <Check size={24} aria-hidden="true" />
              {t("dailyGoalReached")}
            </>
          ) : (
            t("dailyGoal")
          )}
        </h2>
        <button
          className="icon-button"
          aria-label={t("dailyGoalSettings")}
          onClick={onSettings}
        >
          <Settings size={23} />
        </button>
      </div>
      <div className="daily-goal-count" aria-live="polite">
        <strong>
          {solved} / {preferences.target}
        </strong>
        <span>{t("dailySolvedToday")}</span>
      </div>
      <div
        className="daily-goal-bar"
        role="progressbar"
        aria-label={t("dailyGoal")}
        aria-valuenow={Math.min(solved, preferences.target)}
        aria-valuemin={0}
        aria-valuemax={preferences.target}
      >
        <span
          style={{
            width: `${Math.min(100, (solved / preferences.target) * 100)}%`,
          }}
        />
      </div>
      <p className="daily-goal-note">
        {complete
          ? t("dailyGoalCompleteNote")
          : t("dailyGoalRemaining", { count: preferences.target - solved })}
      </p>
      <button
        className={complete ? "secondary-button" : "primary-button"}
        onClick={onContinue}
      >
        {t(complete ? "dailyKeepLearning" : "dailyContinueLearning")}
      </button>
      {reminderStatus !== "unavailable" && (
        <button className="daily-reminder-link" onClick={onSettings}>
          <Bell size={18} aria-hidden="true" />
          {reminderText}
        </button>
      )}
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
