import { concepts, exercises, locale, modules } from "./content";
import { dailyGoalPreferences, solvedToday } from "./daily-goal";
import { streakSummary } from "./streak";
import type { ConceptText, ProgressState } from "./types";

export type WidgetConcept = {
  id: string;
  title: string;
  excerpt: string;
  formula: string;
};

// Native widgets cannot render KaTeX. Only convert notation with an unambiguous
// plain-text equivalent; leave complex expressions for the full lesson.
export function widgetText(value: string): string | null {
  let text = value.replace(/\\[()[\]]/g, "");
  const symbols: Record<string, string> = {
    cdot: "·",
    times: "×",
    to: "→",
    implies: "⇒",
    iff: "⇔",
    le: "≤",
    leq: "≤",
    ge: "≥",
    geq: "≥",
    ne: "≠",
    neq: "≠",
    in: "∈",
    notin: "∉",
    subset: "⊂",
    subseteq: "⊆",
    cup: "∪",
    cap: "∩",
    land: "∧",
    lor: "∨",
    neg: "¬",
    alpha: "α",
    beta: "β",
    theta: "θ",
    lambda: "λ",
    mu: "μ",
    sigma: "σ",
    pi: "π",
    epsilon: "ε",
    infty: "∞",
  };
  text = text.replace(/\\(?:mathrm|text|mathbf|mathit)\{([^{}]*)\}/g, "$1");
  text = text.replace(
    /\\([a-zA-Z]+)/g,
    (command, name) => symbols[name] ?? command,
  );
  text = text.replace(/\\[,;! ]/g, " ");
  if (/\\|[{}]/.test(text.replace(/([_^])\{([a-zA-Z0-9]+)\}/g, "$1$2")))
    return null;
  text = text.replace(/([_^])\{([a-zA-Z0-9]+)\}/g, "$1$2");
  const subscripts = "₀₁₂₃₄₅₆₇₈₉";
  text = text.replace(/_(\d+)/g, (_, digits: string) =>
    [...digits].map((d) => subscripts[Number(d)]).join(""),
  );
  return text.replace(/\s+/g, " ").trim();
}

export const WIDGET_TITLE_LIMIT = 60;
export const WIDGET_EXCERPT_LIMIT = 110;
export const WIDGET_FORMULA_LIMIT = 36;

export function widgetConceptPreview(
  id: string,
  text: ConceptText,
): WidgetConcept | undefined {
  const title = widgetText(text.title);
  const excerpt = [text.body, text.takeaway, text.example]
    .map(widgetText)
    .find((value) => value && value.length <= WIDGET_EXCERPT_LIMIT);
  if (!title || title.length > WIDGET_TITLE_LIMIT || !excerpt) return undefined;
  const formula = widgetText(text.formula);
  return {
    id,
    title,
    excerpt,
    formula: formula && formula.length <= WIDGET_FORMULA_LIMIT ? formula : "",
  };
}

export function widgetSnapshot(progress: ProgressState, day: string) {
  const completed = new Set(
    exercises.filter((e) => progress.completed[e.id]).map((e) => e.conceptId),
  );
  const active = new Set(
    modules.filter((m) => !m.archived).flatMap((m) => m.exerciseIds),
  );
  const available = new Set(
    exercises.filter((e) => active.has(e.id)).map((e) => e.conceptId),
  );
  const pool = concepts.filter(
    (c) => available.has(c.id) && completed.has(c.id),
  );
  // First-time users get one existing introductory concept until they have
  // completed lessons. No additional authored learning content is introduced.
  const eligible = (
    pool.length ? pool : concepts.filter((c) => available.has(c.id)).slice(0, 1)
  )
    .map((concept) =>
      widgetConceptPreview(concept.id, locale.concepts[concept.id]),
    )
    .filter((concept): concept is WidgetConcept => concept !== undefined);
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const offset = Math.floor(ordinal / 30) * 30;
  const cached: WidgetConcept[] = Array.from(
    { length: Math.min(30, eligible.length) },
    (_, i) => eligible[(offset + i) % eligible.length],
  );
  const streak = streakSummary(progress, day);
  return {
    day,
    streak: streak.current,
    earnedToday: streak.earnedToday,
    solved: solvedToday(progress, day),
    target: dailyGoalPreferences(progress).target,
    concepts: cached,
  };
}

export function widgetConceptTarget(
  conceptId: string,
  progress: ProgressState,
) {
  const learningModule = modules.find(
    (m) =>
      !m.archived &&
      m.exerciseIds.some((id) => {
        const e = exercises.find((item) => item.id === id);
        return e?.conceptId === conceptId;
      }),
  );
  if (!learningModule) return undefined;
  const saved = progress.sessions[`${learningModule.id}:learn`];
  // Route by stable exercise identity; start() refreshes old saved sessions.
  const index = learningModule.exerciseIds.findIndex(
    (id) => exercises.find((e) => e.id === id)?.conceptId === conceptId,
  );
  return { moduleId: learningModule.id, index, previousIndex: saved?.index };
}
