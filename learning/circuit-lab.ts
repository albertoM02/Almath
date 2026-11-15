/** Small, deterministic models shared by the activity UI, saves and tests. */
export type LabKind = "ohms-law" | "open-drain";
export type LabControls = {
  resistance: number;
  aLow: boolean;
  bLow: boolean;
  pullUp: boolean;
};
export type LabState = {
  version: 1;
  kind: LabKind;
  phase: "predict" | "test" | "explain";
  controls: LabControls;
  hasTested: boolean;
};

export function initialLab(kind: LabKind): LabState {
  return {
    version: 1,
    kind,
    phase: "predict",
    controls: { resistance: 1, aLow: true, bLow: false, pullUp: true },
    hasTested: false,
  };
}

export function questionControls(kind: LabKind): LabControls {
  return { ...initialLab(kind).controls, resistance: 3 };
}

export function matchesQuestion(kind: LabKind, controls: LabControls) {
  return kind === "ohms-law"
    ? controls.resistance === 3
    : controls.aLow && !controls.bLow && controls.pullUp;
}

export function resistorCurrent(resistanceKOhm: number): number {
  if (!Number.isFinite(resistanceKOhm) || resistanceKOhm <= 0)
    throw new RangeError("Resistance must be positive.");
  // Volts / kilohms gives milliamperes. The ideal source stays at 3 V.
  return 3 / resistanceKOhm;
}

export function sharedLine(controls: LabControls): {
  state: "LOW" | "HIGH" | "Undefined";
  voltage: number | null;
} {
  if (controls.aLow || controls.bLow) return { state: "LOW", voltage: 0 };
  if (controls.pullUp) return { state: "HIGH", voltage: 3.3 };
  // A released, unbiased high-impedance input has no guaranteed logic level.
  return { state: "Undefined", voltage: null };
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.keys(value).every(
      (key) => !["__proto__", "constructor", "prototype"].includes(key),
    )
  );
}

export function isLabState(value: unknown): value is LabState {
  if (
    !record(value) ||
    value.version !== 1 ||
    !["ohms-law", "open-drain"].includes(value.kind as string) ||
    !["predict", "test", "explain"].includes(value.phase as string) ||
    typeof value.hasTested !== "boolean" ||
    !record(value.controls)
  )
    return false;
  const c = value.controls;
  return (
    Number.isInteger(c.resistance) &&
    Number(c.resistance) >= 1 &&
    Number(c.resistance) <= 5 &&
    [c.aLow, c.bLow, c.pullUp].every((item) => typeof item === "boolean")
  );
}

export function currentLabel(resistance: number) {
  return `${Number(resistorCurrent(resistance).toFixed(2))} mA`;
}
