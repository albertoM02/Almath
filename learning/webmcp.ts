import { courses, getModule, locale, modules } from "./content";
import type { ProgressState, View } from "./types";

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: object;
  execute: (input: unknown) => unknown;
};

export function registerLearningTools(actions: {
  getProgress: () => ProgressState;
  navigate: (view: View) => void;
  start: (id: string, mode: "learn" | "review") => void;
}) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: Tool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: "get_learning_progress",
      title: "Read Almath progress",
      description:
        "Read available courses, learningModule IDs, completion counts and the current screen. Does not submit answers.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => {
        const progress = actions.getProgress();
        return {
          courses: courses.map((course) => ({
            id: course.id,
            title: locale.courses[course.id].title,
            modules: course.moduleIds.map((id) => ({
              id,
              completed: getModule(id).exerciseIds.filter(
                (exerciseId) => progress.completed[exerciseId],
              ).length,
              total: getModule(id).exerciseIds.length,
            })),
          })),
          view: progress.view,
        };
      },
    },
    {
      name: "start_learning_module",
      title: "Open an Almath learningModule",
      description:
        "Open or resume a learningModule in the visible interface. Saves the current location but does not answer or complete exercises.",
      inputSchema: {
        type: "object",
        properties: {
          moduleId: { type: "string" },
          mode: { type: "string", enum: ["learn", "review"] },
        },
        required: ["moduleId", "mode"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const value = input as { moduleId?: unknown; mode?: unknown };
        if (
          !value ||
          typeof value.moduleId !== "string" ||
          !modules.some(
            (learningModule) => learningModule.id === value.moduleId,
          ) ||
          (value.mode !== "learn" && value.mode !== "review")
        )
          throw new Error("Provide a valid moduleId and mode.");
        actions.start(value.moduleId, value.mode);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return {
          opened: value.moduleId,
          mode: value.mode,
          screen: actions.getProgress().view.screen,
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch((error) =>
        console.warn("Learning tool registration unavailable", error),
      );
    } catch (error) {
      console.warn("Learning tool registration unavailable", error);
    }
  }
  return () => lifecycle.abort();
}
