import { useId, type ReactNode } from "react";
import {
  currentLabel,
  sharedLine,
  type LabControls,
  type LabKind,
} from "@/learning/circuit-lab";

function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x},${y - 10} v10 m-14,0 h28 m-23,6 h18 m-14,6 h10`} />
    </g>
  );
}

function Diagram({
  label,
  children,
  height = 240,
}: {
  label: string;
  children: ReactNode;
  height?: number;
}) {
  const id = useId();
  return (
    <svg
      className="lab-diagram"
      viewBox={`0 0 360 ${height}`}
      role="img"
      aria-labelledby={id}
    >
      <title id={id}>{label}</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </svg>
  );
}

function Switch({
  x,
  low,
  revealed,
}: {
  x: number;
  low: boolean;
  revealed: boolean;
}) {
  return (
    <g className={low && revealed ? "lab-active-wire" : undefined}>
      <path d={`M${x},102 V154 M${x},190 V210`} />
      <circle cx={x} cy="158" r="4" />
      <circle cx={x} cy="186" r="4" />
      <path d={low ? `M${x},162 V182` : `M${x},182 l17,-24`} />
      <Ground x={x} y={220} />
    </g>
  );
}

export function CircuitDiagram({
  kind,
  controls,
  revealed,
}: {
  kind: LabKind;
  controls: LabControls;
  revealed: boolean;
}) {
  if (kind === "ohms-law")
    return (
      <Diagram
        label={`Ideal 3 V source and ${controls.resistance} kilohm resistor in series with an ammeter. ${revealed ? `Current: ${currentLabel(controls.resistance)}.` : "Run the experiment to reveal the current."}`}
      >
        <path d="M58,99 V64 H139 M241,64 H304 V101 M58,147 V184 H304 V145" />
        <path d="M139,64 l8,-10 12,20 12,-20 12,20 12,-20 12,20 12,-20 12,20 10,-10" />
        <circle cx="58" cy="123" r="24" />
        <path d="M52,114 h12 M58,108 v12 M52,134 h12" />
        <circle cx="304" cy="123" r="22" />
        <text x="304" y="130" className="lab-svg-meter">
          A
        </text>
        <text x="22" y="130" className="lab-svg-text">
          3 V
        </text>
        <text x="190" y="37" className="lab-svg-label">
          {controls.resistance} kΩ
        </text>
        <text x="304" y="166" className="lab-svg-label">
          {revealed ? currentLabel(controls.resistance) : "?"}
        </text>
        {revealed && (
          <path className="lab-active-wire" d="M210,184 H156 m7,-5 -7,5 7,5" />
        )}
        <text x="180" y="223" className="lab-svg-caption">
          Ideal source · fixed 3 V
        </text>
      </Diagram>
    );
  const result = sharedLine(controls);
  return (
    <Diagram
      height={278}
      label={`Two open-drain outputs share a receiver. A: ${controls.aLow ? "pull LOW" : "release"}. B: ${controls.bLow ? "pull LOW" : "release"}. Pull-up ${controls.pullUp ? "connected" : "disconnected"}. ${revealed ? `Receiver: ${result.state}. ${result.voltage === null ? "No guaranteed voltage." : `${result.voltage} V in this ideal model.`}` : "Run the experiment to reveal the receiver state."}`}
    >
      <text x="172" y="19" className="lab-svg-label">
        3.3 V
      </text>
      <g className={controls.pullUp ? undefined : "lab-disconnected"}>
        <path d={controls.pullUp ? "M172,29 V43" : "M172,29 V33 m0,10 7,-10"} />
        <path d="M172,43 v4 l-7,5 14,8 -14,8 14,8 -7,5 V102" />
        <text x="214" y="65" className="lab-svg-caption">
          Pull-up
        </text>
      </g>
      <path
        className={revealed ? "lab-active-wire" : undefined}
        d="M68,102 H276"
      />
      <circle cx="172" cy="102" r="3" fill="currentColor" />
      <rect x="276" y="79" width="78" height="66" rx="10" />
      <text x="315" y="68" className="lab-svg-caption">
        Receiver
      </text>
      <text
        x="315"
        y="106"
        className={
          revealed && result.state === "Undefined"
            ? "lab-svg-caption"
            : "lab-svg-label"
        }
      >
        {revealed ? result.state : "?"}
      </text>
      <text x="315" y="128" className="lab-svg-caption">
        {revealed
          ? result.voltage === null
            ? "Floating"
            : `${result.voltage} V`
          : "High-Z"}
      </text>
      <Switch x={68} low={controls.aLow} revealed={revealed} />
      <Switch x={216} low={controls.bLow} revealed={revealed} />
      <text x="68" y="250" className="lab-svg-caption">
        Device A
      </text>
      <text x="216" y="250" className="lab-svg-caption">
        Device B
      </text>
      <text x="180" y="273" className="lab-svg-caption">
        Open-drain outputs · ideal model
      </text>
    </Diagram>
  );
}
