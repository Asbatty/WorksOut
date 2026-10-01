// Big +/- numeric input. The whole thing is operable with the two buttons
// alone; typing is optional and opens the numeric keypad. Min target 48px.

import { useRef, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from "react";

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
  // Where the finger went down, and whether this press has turned into a
  // scroll (moved / cancelled) or a hold. A press only changes the value on
  // release, so a scroll that starts on a button does nothing.
  const press = useRef<{ x: number; y: number; moved: boolean; held: boolean } | null>(null);
  // Latest value, so the hold-repeat interval doesn't keep adding to a stale one.
  const valueRef = useRef(value);
  valueRef.current = value;

  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    // Avoid floating point crumbs from repeated adds (e.g. 0.1 + 0.2).
    return Math.round(v * 100) / 100;
  };

  const bump = (dir: 1 | -1) => {
    const next = clamp(valueRef.current + dir * step);
    valueRef.current = next;
    onChange(next);
  };

  const stopTimers = () => {
    window.clearTimeout(holdTimer.current);
    window.clearInterval(holdInterval.current);
  };

  // Finger down: arm a hold, but don't change anything yet.
  const onDown = (dir: 1 | -1) => (e: RPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY, moved: false, held: false };
    stopTimers();
    // Press-and-hold to repeat, so dialling from 45 to 185 isn't 28 taps.
    holdTimer.current = window.setTimeout(() => {
      const p = press.current;
      if (!p || p.moved) return;
      p.held = true;
      bump(dir);
      holdInterval.current = window.setInterval(() => bump(dir), 90);
    }, 450);
  };

  // More than a small wobble means the user is scrolling: drop the press.
  const onMove = (e: RPointerEvent) => {
    const p = press.current;
    if (!p || p.moved) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
      p.moved = true;
      stopTimers();
    }
  };

  // Finger up: a clean tap bumps once; a hold already did its work.
  const onUp = (dir: 1 | -1) => () => {
    const p = press.current;
    stopTimers();
    press.current = null;
    if (p && !p.moved && !p.held) bump(dir);
  };

  // The browser took the gesture over (scroll) or the finger slid off.
  const cancel = () => {
    if (press.current) press.current.moved = true;
    stopTimers();
    press.current = null;
  };

  // Keyboard activation (Enter/Space) arrives as a click with detail 0.
  const onKeyClick = (dir: 1 | -1) => (e: RMouseEvent) => {
    if (e.detail === 0) bump(dir);
  };

  const buttonProps = (dir: 1 | -1) => ({
    onPointerDown: onDown(dir),
    onPointerMove: onMove,
    onPointerUp: onUp(dir),
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick: onKeyClick(dir),
    onContextMenu: (e: RMouseEvent) => e.preventDefault()
  });

  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          {...buttonProps(-1)}
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
          {...buttonProps(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
