// Big +/- numeric input. The whole thing is operable with the two buttons
// alone; typing is optional and opens the numeric keypad. Min target 48px.

import { useRef } from "react";

interface StepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  max?: number;
  /** Faint value shown when the field is empty (e.g. last session's reps). */
  ghost?: number | string;
  /** Small text after the number, e.g. "lb". */
  suffix?: string;
  /** Keyboard to open when typing. "decimal" (weights) or "numeric" (reps). */
  mode?: "decimal" | "numeric";
}

export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  max,
  ghost,
  suffix,
  mode = "decimal"
}: StepperProps) {
  const holdTimer = useRef<number | undefined>(undefined);
  const holdInterval = useRef<number | undefined>(undefined);

  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    // Avoid floating point crumbs from repeated adds (e.g. 0.1 + 0.2).
    return Math.round(v * 100) / 100;
  };

  const bump = (dir: 1 | -1) => onChange(clamp(value + dir * step));

  // Press-and-hold to repeat, so dialling from 45 to 185 isn't 28 taps.
  const startHold = (dir: 1 | -1) => {
    bump(dir);
    holdTimer.current = window.setTimeout(() => {
      holdInterval.current = window.setInterval(() => bump(dir), 90);
    }, 450);
  };
  const endHold = () => {
    window.clearTimeout(holdTimer.current);
    window.clearInterval(holdInterval.current);
  };

  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onPointerDown={() => startHold(-1)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          &minus;
        </button>
        <label className="stepper-value">
          <input
            inputMode={mode}
            pattern="[0-9]*"
            value={value === 0 && ghost != null ? "" : String(value)}
            placeholder={ghost != null ? String(ghost) : "0"}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              if (raw === "") return onChange(0);
              const n = Number(raw);
              if (!Number.isNaN(n)) onChange(clamp(n));
            }}
            aria-label={label}
          />
          {suffix && <span className="stepper-suffix">{suffix}</span>}
        </label>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onPointerDown={() => startHold(1)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          +
        </button>
      </div>
    </div>
  );
}
