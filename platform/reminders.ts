import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { App } from "@capacitor/app";
import type { DailyGoalPreferences } from "@/learning/types";
import { t } from "@/learning/content";

export type ReminderStatus =
  "off" | "ready" | "blocked" | "unavailable" | "error";

interface DailyReminderPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  configure(options: {
    enabled: boolean;
    hour: number;
    minute: number;
    completedDay: string;
    title: string;
    body: string;
    channelName: string;
  }): Promise<void>;
  openSettings(): Promise<void>;
  addListener(
    event: "openReminder",
    callback: () => void,
  ): Promise<PluginListenerHandle>;
}

const DailyReminder = registerPlugin<DailyReminderPlugin>("DailyReminder");
let syncQueue = Promise.resolve<ReminderStatus>("off");

export function androidRemindersAvailable(): boolean {
  return Capacitor.getPlatform() === "android";
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!androidRemindersAvailable()) return false;
  return (await DailyReminder.requestPermission()).granted;
}

export async function openReminderSettings(): Promise<void> {
  if (androidRemindersAvailable()) await DailyReminder.openSettings();
}

export function syncDailyReminder(
  preferences: DailyGoalPreferences,
  completedDay: string,
): Promise<ReminderStatus> {
  if (!androidRemindersAvailable()) return Promise.resolve("unavailable");
  // Native scheduling is serial so a slower earlier call cannot undo cancellation.
  syncQueue = syncQueue
    .catch(() => "error" as const)
    .then(async () => {
      const { granted } = await DailyReminder.checkPermission();
      const [hour, minute] = preferences.reminderTime.split(":").map(Number);
      await DailyReminder.configure({
        enabled: preferences.reminderEnabled,
        hour,
        minute,
        completedDay,
        title: t("dailyReminderTitle"),
        body: t("dailyReminderBody"),
        channelName: t("dailyReminderChannel"),
      });
      return !preferences.reminderEnabled
        ? "off"
        : granted
          ? "ready"
          : "blocked";
    });
  return syncQueue;
}

export function registerReminderOpen(onOpen: () => void): () => void {
  if (!androidRemindersAvailable()) return () => {};
  let disposed = false;
  let handle: PluginListenerHandle | undefined;
  void DailyReminder.addListener("openReminder", () => {
    if (!disposed) onOpen();
  })
    .then((listener) => {
      if (disposed) void listener.remove();
      else handle = listener;
    })
    .catch((error) =>
      console.error("Could not listen for reminder taps", error),
    );
  return () => {
    disposed = true;
    void handle?.remove();
  };
}

export function registerReminderResume(onResume: () => void): () => void {
  if (!androidRemindersAvailable()) return () => {};
  let disposed = false;
  let handle: PluginListenerHandle | undefined;
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive && !disposed) onResume();
  })
    .then((listener) => {
      if (disposed) void listener.remove();
      else handle = listener;
    })
    .catch((error) => console.error("Could not listen for app resume", error));
  return () => {
    disposed = true;
    void handle?.remove();
  };
}
