import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { widgetSnapshot } from "@/learning/widget";

type OpenRequest = { action?: "continue" | "concept"; conceptId?: string };
interface HomeWidgetPlugin {
  sync(options: ReturnType<typeof widgetSnapshot>): Promise<void>;
  consumeOpen(): Promise<OpenRequest>;
  addListener(
    event: "openWidget",
    callback: () => void,
  ): Promise<PluginListenerHandle>;
}
const HomeWidget = registerPlugin<HomeWidgetPlugin>("HomeWidget");
let queue = Promise.resolve();

export function syncHomeWidgets(
  snapshot: ReturnType<typeof widgetSnapshot>,
): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return Promise.resolve();
  queue = queue.catch(() => undefined).then(() => HomeWidget.sync(snapshot));
  return queue;
}

export function registerWidgetOpen(
  onOpen: (request: OpenRequest) => void,
): () => void {
  if (Capacitor.getPlatform() !== "android") return () => {};
  let disposed = false;
  let handle: PluginListenerHandle | undefined;
  const consume = () => {
    if (disposed) return;
    void HomeWidget.consumeOpen()
      .then((request) => {
        if (!disposed && request.action) onOpen(request);
      })
      .catch((error) => console.error("Could not open widget lesson", error));
  };
  void HomeWidget.addListener("openWidget", consume)
    .then((listener) => {
      if (disposed) void listener.remove();
      else {
        handle = listener;
        consume();
      }
    })
    .catch((error) => console.error("Could not listen for widget taps", error));
  return () => {
    disposed = true;
    void handle?.remove();
  };
}
