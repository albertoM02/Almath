import { useId } from "react";
import { Check, FlaskConical, RotateCcw } from "lucide-react";
import { MathText } from "./math-text";
import { CircuitDiagram } from "./circuit-diagram";
import {
  initialLab,
  questionControls,
  matchesQuestion,
  currentLabel,
  sharedLine,
  type LabState,
  type LabControls,
  type LabKind,
} from "@/learning/circuit-lab";
import type { Draft, Exercise, ExerciseText } from "@/learning/types";

function DeviceControl({
  name,
  low,
  disabled,
  onChange,
}: {
  name: string;
  low: boolean;
  disabled: boolean;
  onChange: (low: boolean) => void;
}) {
  return (
    <fieldset className="lab-device" disabled={disabled}>
      <legend>{name}</legend>
      <div className="lab-toggle-group">
        {[true, false].map((value) => (
          <button
            type="button"
            key={String(value)}
            aria-pressed={low === value}
            onClick={() => onChange(value)}
          >
            {value ? "Pull LOW" : "Release"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The same predict/test/explain frame hosts each independently defined model. */
export function CircuitLab({
  exercise,
  text,
  draft,
  onAnswer,
  onChange,
  onCheck,
}: {
  exercise: Exercise;
  text: ExerciseText;
  draft: Draft;
  onAnswer: (answer: string) => void;
  onChange: (state: LabState) => void;
  onCheck: () => void;
}) {
  const id = useId();
  const kind = exercise.interaction as LabKind;
  const finished = draft.feedback === "correct" || draft.solutionRevealed;
  let lab = draft.lab?.kind === kind ? draft.lab : initialLab(kind);
  if (finished && !lab.hasTested)
    lab = {
      ...initialLab(kind),
      phase: "explain",
      hasTested: true,
      controls: questionControls(kind),
    };
  const revealed = lab.phase === "explain";
  const controls = lab.controls;
  const phaseIndex = ["predict", "test", "explain"].indexOf(lab.phase);
  const readyToTest =
    (finished || !!draft.answer) &&
    (lab.hasTested || matchesQuestion(kind, controls));
  const line = sharedLine(controls);
  const updateControls = (changes: Partial<LabControls>) =>
    onChange({ ...lab, phase: "test", controls: { ...controls, ...changes } });
  const run = () => {
    if (!readyToTest) return;
    onChange({ ...lab, phase: "explain", hasTested: true });
    // Experiments after the prediction has been checked never add attempts or goals.
    if (!lab.hasTested && !finished) onCheck();
  };
  return (
    <section className="interactive-lab" aria-label="Circuit lab">
      <div className="lab-tag">
        <FlaskConical size={16} /> Circuit lab
      </div>
      <ol className="lab-steps" aria-label="Activity stages">
        {["Predict", "Test", "Explain"].map((label, index) => (
          <li
            key={label}
            aria-current={index === phaseIndex ? "step" : undefined}
            className={index < phaseIndex ? "done" : ""}
          >
            <span aria-hidden="true">
              {index < phaseIndex ? <Check size={16} /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div className="lab-canvas">
        <CircuitDiagram kind={kind} controls={controls} revealed={revealed} />
      </div>
      {kind === "ohms-law" ? (
        <fieldset className="lab-controls" disabled={lab.phase === "predict"}>
          <label className="lab-control-label" htmlFor={`${id}-resistance`}>
            Resistance{" "}
            <output htmlFor={`${id}-resistance`}>
              {controls.resistance} kΩ
            </output>
          </label>
          <input
            id={`${id}-resistance`}
            type="range"
            min="1"
            max="5"
            step="1"
            value={controls.resistance}
            aria-valuetext={`${controls.resistance} kilohms`}
            onChange={(event) =>
              updateControls({ resistance: Number(event.target.value) })
            }
          />
          <div className="lab-range-ticks" aria-hidden="true">
            <span>1 kΩ</span>
            <span>3 kΩ</span>
            <span>5 kΩ</span>
          </div>
          <p className="small-note">Reference: at 1 kΩ, the current is 3 mA.</p>
        </fieldset>
      ) : (
        <div className="lab-controls">
          <div className="lab-devices">
            <DeviceControl
              name="Device A"
              low={controls.aLow}
              disabled={lab.phase === "predict"}
              onChange={(aLow) => updateControls({ aLow })}
            />
            <DeviceControl
              name="Device B"
              low={controls.bLow}
              disabled={lab.phase === "predict"}
              onChange={(bLow) => updateControls({ bLow })}
            />
          </div>
          <label className="lab-pullup">
            <span>Pull-up connected</span>
            <input
              type="checkbox"
              checked={controls.pullUp}
              disabled={lab.phase === "predict"}
              onChange={(event) =>
                updateControls({ pullUp: event.target.checked })
              }
            />
          </label>
        </div>
      )}
      {lab.phase === "predict" && (
        <fieldset className="lab-prediction">
          <legend>Your prediction</legend>
          <div className="answer-options">
            {exercise.optionIds!.map((option) => (
              <label
                aria-label={text.options![option]}
                htmlFor={`${id}-${option}`}
                className={`answer-option ${draft.answer === option ? "selected" : ""}`}
                key={option}
              >
                <input
                  id={`${id}-${option}`}
                  type="radio"
                  name={`${id}-prediction`}
                  value={option}
                  checked={draft.answer === option}
                  onChange={() => onAnswer(option)}
                />
                <span>
                  <MathText>{text.options![option]}</MathText>
                </span>
              </label>
            ))}
          </div>
          <p className="small-note">Choose first, then test your idea.</p>
        </fieldset>
      )}
      {lab.phase === "test" && !lab.hasTested && (
        <p className="lab-instruction">
          {kind === "ohms-law"
            ? "Move the slider to 3 kΩ, then run the circuit to test your prediction."
            : "Test the question setup: A pulls LOW, B releases, and the pull-up is connected."}{" "}
          After this test, you can explore freely.
        </p>
      )}
      {revealed && (
        <div className="lab-observation" role="status" aria-live="polite">
          <h2>
            Experiment result{" "}
            <strong>
              {kind === "ohms-law"
                ? currentLabel(controls.resistance)
                : line.state}
            </strong>
          </h2>
          <p>
            {kind === "ohms-law" ? (
              <>
                At a fixed 3 V,{" "}
                <MathText>{`\\(I = V/R = 3/${controls.resistance * 1000}\\) A`}</MathText>{" "}
                = {currentLabel(controls.resistance)}. More resistance means
                less current.
              </>
            ) : line.state === "LOW" ? (
              "A device is pulling the wire to ground. Releasing the other output does not drive it HIGH."
            ) : line.state === "HIGH" ? (
              "Both devices release the wire. The connected pull-up establishes HIGH."
            ) : (
              "Both devices release the wire and the pull-up is disconnected. The receiver has no guaranteed logic level; floating does not mean LOW."
            )}
          </p>
          <p className="small-note">
            {kind === "ohms-law"
              ? "Try another resistance. Keep the voltage fixed and compare the current."
              : "Try releasing both devices, then disconnecting the pull-up. Predict each change before running it."}
          </p>
        </div>
      )}
      <div className="lab-actions">
        {lab.phase === "predict" ? (
          <button
            type="button"
            className="primary-button"
            disabled={!draft.answer}
            onClick={() => onChange({ ...lab, phase: "test" })}
          >
            Test prediction
          </button>
        ) : (
          <button
            type="button"
            className={revealed ? "secondary-button" : "primary-button"}
            disabled={!readyToTest}
            onClick={run}
          >
            <RotateCcw size={18} />
            {revealed ? "Run again" : "Run experiment"}
          </button>
        )}
        {revealed && !finished && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onAnswer("");
              onChange(initialLab(kind));
            }}
          >
            Try another prediction
          </button>
        )}
      </div>
    </section>
  );
}
