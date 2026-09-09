// One set in the Today screen. On a phone there isn't room for weight + reps +
// a checkmark on one line, so the two steppers stack full-width under a header
// row that holds the set number and the done toggle.
//
// Once a set is ticked done it collapses to a single summary line ("135 lb × 8")
// so the next unfinished set is in reach. Tap the row to open it back up for a
// correction; ticking it done again re-collapses it.

import { useEffect, useState } from "react";
import { Stepper } from "./Stepper";
import type { SetLog } from "../types";

interface SetRowProps {
  index: number;
  set: SetLog;
  weightStep: number;
  /** Reps this set hit last session, shown as a ghost value. */
  ghostReps?: number;
  weightSuffix?: string;
  onChange: (patch: Partial<SetLog>) => void;
}

export function SetRow({
  index,
  set,
  weightStep,
  ghostReps,
  weightSuffix = "lb",
  onChange
}: SetRowProps) {
  const [editing, setEditing] = useState(false);
  // Any time the set becomes done, fold it — unless the user has explicitly
  // opened it again (editing). Un-ticking leaves the steppers visible anyway.
  useEffect(() => {
    if (set.done) setEditing(false);
  }, [set.done]);
  const collapsed = Boolean(set.done) && !editing;

  return (
    <div
      className={
        "set-row" + (set.done ? " done" : "") + (collapsed ? " collapsed" : "")
      }
    >
      <div className="set-row-head">
        {set.done ? (
          <button
            type="button"
            className="set-num set-toggle"
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? `Set ${index + 1}, ${set.weight} ${weightSuffix} by ${set.reps} reps — edit`
                : `Collapse set ${index + 1}`
            }
            onClick={() => setEditing((e) => !e)}
          >
            <span>Set {index + 1}</span>
            {collapsed && (
              <span className="set-summary">
                {set.weight} {weightSuffix} × {set.reps}
              </span>
            )}
          </button>
        ) : (
          <span className="set-num">Set {index + 1}</span>
        )}
        <button
          type="button"
          className={set.done ? "check on" : "check"}
          aria-label={set.done ? `Set ${index + 1} done` : `Mark set ${index + 1} done`}
          aria-pressed={set.done ?? false}
          onClick={() => {
            const done = !set.done;
            // A fast "did it" tap with no reps entered yet borrows last
            // session's rep count (the ghost) so something real gets recorded.
            onChange(
              done && set.reps === 0 && ghostReps ? { done, reps: ghostReps } : { done }
            );
          }}
        >
          <span className="check-mark">✓</span>
          <span className="check-label">{set.done ? "Done" : "Done?"}</span>
        </button>
      </div>

      {!collapsed && (
        <>
          <Stepper
            label="Weight"
            value={set.weight}
            step={weightStep}
            onChange={(weight) => onChange({ weight })}
            suffix={weightSuffix}
          />
          <Stepper
            label="Reps"
            value={set.reps}
            step={1}
            mode="numeric"
            ghost={ghostReps}
            onChange={(reps) => onChange({ reps })}
          />
        </>
      )}
    </div>
  );
}
