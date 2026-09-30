export type Exercise = {
  id: string;
  conceptId: string;
  version: number;
  type: "choice" | "number";
  optionIds?: string[];
  answer: string | number;
  tolerance?: number;
  variantOf?: string;
  sourceId: string;
};
export type Course = {
  id: string;
  icon: "logic" | "vectors";
  moduleIds: string[];
};
export type CourseUnit = {
  id: string;
  number: number;
  moduleIds: string[];
};
export type CoursePart = {
  id: string;
  label: string;
  units: CourseUnit[];
};
export type CourseOutline = {
  courseId: string;
  parts: CoursePart[];
};
export type Module = {
  id: string;
  courseId: string;
  version: number;
  exerciseIds: string[];
  archived?: boolean;
};
export type Concept = {
  id: string;
  courseId: string;
  prerequisites: string[];
  sourceId: string;
};
export type ConceptText = {
  title: string;
  body: string;
  formula: string;
  example: string;
  exampleSteps: string[];
  takeaway: string;
};
export type ExerciseText = {
  title: string;
  statement: string;
  prompt: string;
  options?: Record<string, string>;
  hint: string;
  explanation: string;
  solutionSteps: string[];
};
export type Draft = {
  answer: string;
  feedback: "correct" | "incorrect" | null;
  hintUsed: boolean;
  solutionRevealed: boolean;
  attempts: number;
};
export type Session = {
  moduleId: string;
  contentVersion: number;
  mode: "learn" | "review";
  exerciseIds: string[];
  baseExerciseIds: string[];
  index: number;
  stage: "theory" | "practice";
  drafts: Record<string, Draft>;
  finished: boolean;
};
export type View = {
  screen: "courses" | "units" | "lesson" | "review" | "complete" | "about";
  courseId?: string;
  sessionKey?: string;
  moduleId?: string;
};
export type Completion = { result: "solved" | "reviewed"; completedAt: string };
export type Attempt = {
  exerciseId: string;
  version: number;
  answer: string;
  correct: boolean;
  hintUsed: boolean;
  at: string;
};
export type ProgressState = {
  schemaVersion: 1;
  sessions: Record<string, Session>;
  completed: Record<string, Completion>;
  attempts: Attempt[];
  reviewCounts: Record<string, number>;
  view: View;
};
