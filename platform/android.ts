import { App } from "@capacitor/app";
import {
  Capacitor,
  SystemBars,
  SystemBarType,
  SystemBarsStyle,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { View } from "@/learning/types";

export function registerAndroidBackHandler({
  getView,
  getParentView,
  replaceView,
  flushProgress,
  dismissOverlay,
}: {
  getView: () => View;
  getParentView: () => View;
  replaceView: (view: View) => void;
  flushProgress: () => Promise<boolean>;
  dismissOverlay?: () => boolean;
}): () => void {
  if (Capacitor.getPlatform() !== "android") return () => {};

  let disposed = false;
  let handlingBack = false;
  let listener: PluginListenerHandle | undefined;

  // Light navigation icons would disappear against Almath's cream footer.
  void SystemBars.setStyle({
    bar: SystemBarType.NavigationBar,
    style: SystemBarsStyle.Light,
  }).catch((error) =>
    console.error("Could not style Android navigation", error),
  );

  void App.addListener("backButton", async ({ canGoBack }) => {
    if (disposed || handlingBack) return;
    handlingBack = true;
    try {
      if (dismissOverlay?.()) return;
      if (getView().screen === "courses") {
        // Wait for IndexedDB's transaction, not just its write request.
        if (await flushProgress()) await App.exitApp();
      } else if (canGoBack) {
        window.history.back();
      } else {
        // A restored lesson has no browser history yet, but still has a parent.
        replaceView(getParentView());
      }
    } catch (error) {
      console.error("Could not handle Android Back", error);
    } finally {
      handlingBack = false;
    }
  })
    .then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    })
    .catch((error) => console.error("Could not register Android Back", error));

  return () => {
    disposed = true;
    void listener?.remove();
  };
}
