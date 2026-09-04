import { useMemo, useState } from "react";
import { navigate } from "../router";
import { useRoutine } from "../useRoutine";
import {
  activeSession,
  discardSession,
  finishSession,
  lastFinishedSession,
  reopenSession,
  saveEdits,
  setExerciseNote,
  setExerciseSkipped,
  setPersistentSwap,
  skipWorkout,
  startRest,
  startSession,
  swapInSession,
  updateSet,
  useAppState
} from "../store";
import { nextDay, upcomingDays, workoutNumber } from "../schedule";
import { findExercise, getAlternatives, resolvedExerciseId } from "../routine";
import { exerciseHistory, lastAppearance } from "../history";
import { suggestWeight } from "../suggest";
import { SetRow } from "../components/SetRow";
import type { Exercise, Pattern, ProgramSlot, Routine, Session } from "../types";

/** Paper-plane icon: opens the exercise detail page (cue, muscles, video). */
function PaperPlane() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  );
}

const COMPOUND_PATTERNS: Pattern[] = [
  "horizontal-push",
  "vertical-push",
  "horizontal-pull",
  "vertical-pull",
  "squat",
  "hinge",
  "lunge"
];

/** Slot indices that should show a "warm up first" note: the first two
 *  compound lifts of the day. */
function warmupSlots(routine: Routine, slots: ProgramSlot[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < slots.length && out.size < 2; i++) {
    const ex = findExercise(routine, slots[i].exerciseId);
    if (ex && COMPOUND_PATTERNS.includes(ex.pattern)) out.add(i);
  }
  return out;
}

const LOAD_HINT: Record<Exercise["loadType"], string> = {
  total: "",
  "per-side": "per hand",
  bodyweight: "added",
  assisted: "assist"
};

export function Today() {
  const { routine, loading, error, dayName } = useRoutine();
  const state = useAppState();

  if (!routine) {
    return (
      <>
        <h1>Today</h1>
        {loading ? (
          <p>Loading routine…</p>
        ) : (
          <div className="card">
            <p>Couldn't load the routine.</p>
            {error && <p className="mono">{error}</p>}
          </div>
        )}
      </>
    );
  }

  const session = activeSession(state);
  if (session)
    return <ActiveWorkout routine={routine} session={session} dayName={dayName} />;
  return <PlannedDay routine={routine} />;
}

// --- before the workout starts ------------------------------------------------

function PlannedDay({ routine }: { routine: Routine }) {
  const state = useAppState();
  const day = nextDay(state, routine);
  if (!day) return <p>No workout days in this routine.</p>;

  const num = workoutNumber(state, routine);
  const upcoming = upcomingDays(state, routine, 3);
  const warmups = warmupSlots(routine, day.slots);

  const rows = day.slots.map((slot, i) => {
    const exId = resolvedExerciseId(state, day.id, i, slot.exerciseId);
    const ex = findExercise(routine, exId);
    if (!ex) return null;
    const history = exerciseHistory(state.sessions, exId);
    const s = suggestWeight(ex, slot, state.profile, history);
    return { slot, i, ex, suggestion: s, warmup: warmups.has(i) };
  });

  const start = () => {
    startSession(routine, day.id, (slotIndex, exId) => {
      const ex = findExercise(routine, exId);
      if (!ex) return 0;
      return suggestWeight(
        ex,
        day.slots[slotIndex],
        state.profile,
        exerciseHistory(state.sessions, exId)
      ).weight;
    });
  };

  return (
    <>
      <header className="day-head">
        <h1>{day.name}</h1>
        <span className="sub">
          {routine.name} · workout {num} of {routine.cycle.length}
        </span>
      </header>

      {upcoming.length > 0 && (
        <div className="preview-strip">
          <span className="preview-label">Next:</span>
          {upcoming.map((d, idx) => (
            <span key={`${d.id}-${idx}`} className="chip">
              {d.name}
            </span>
          ))}
        </div>
      )}

      <div className="exercise-list">
        {rows.map(
          (r) =>
            r && (
              <div key={r.i} className="card exercise-preview">
                <button
                  className="link-title"
                  onClick={() => navigate(`#/exercise/${r.ex.id}`)}
                >
                  {r.ex.name}
                </button>
                <div className="preview-meta">
                  {r.slot.sets} × {r.slot.repMin}–{r.slot.repMax}
                  {"  ·  "}
                  <strong>
                    {r.suggestion.weight}
                    {r.ex.loadType === "assisted" ? " assist" : " lb"}
                  </strong>{" "}
                  <span className="dim">
                    {r.suggestion.isGuess ? "suggested" : "target"}
                  </span>
                </div>
                <div className="suggest-reason">{r.suggestion.reason}</div>
                {r.warmup && <div className="warmup-note">Warm up first</div>}
              </div>
            )
        )}
      </div>

      <div className="action-stack">
        <button className="primary big" onClick={start}>
          Start {day.name}
        </button>
        <div className="secondary-actions">
          <button className="ghost" onClick={() => skipWorkout(routine)}>
            Skip this workout
          </button>
          <DifferentDay routine={routine} />
          <ReopenLast routine={routine} />
        </div>
      </div>
    </>
  );
}

/** "Undo" the last finished workout: reopen it for editing and rewind the
 *  cycle to where it was. Only shown when nothing is in progress. */
function ReopenLast({ routine }: { routine: Routine }) {
  const state = useAppState();
  const last = lastFinishedSession(state);
  if (!last) return null;
  const dayName = routine.days.find((d) => d.id === last.dayId)?.name ?? "workout";
  const when = new Date(last.finishedAt!).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  return (
    <button className="ghost" onClick={() => reopenSession(last.id)}>
      Reopen last workout · {dayName}, {when}
    </button>
  );
}

function DifferentDay({ routine }: { routine: Routine }) {
  const [open, setOpen] = useState(false);
  const state = useAppState();
  const todayId = nextDay(state, routine)?.id;

  if (!open)
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        Do a different day
      </button>
    );

  return (
    <div className="sheet inline">
      <p className="sheet-title">Which day?</p>
      {routine.cycle.map((dayId, idx) => {
        const d = routine.days.find((x) => x.id === dayId);
        if (!d) return null;
        return (
          <button
            key={`${dayId}-${idx}`}
            className="sheet-item"
            onClick={() => {
              // Just start a session for this day. finishSession() notices the
              // day isn't the current cycle position and resumes the cycle at
              // the slot right after it.
              startSession(routine, dayId, (slotIndex, exId) => {
                const ex = findExercise(routine, exId);
                if (!ex) return 0;
                return suggestWeight(
                  ex,
                  d.slots[slotIndex],
                  state.profile,
                  exerciseHistory(state.sessions, exId)
                ).weight;
              });
              setOpen(false);
            }}
          >
            {d.name}
            {dayId === todayId ? " · today" : ""}
          </button>
        );
      })}
      <button className="ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

// --- during the workout ----------------------------------------------------

function ActiveWorkout({
  routine,
  session,
  dayName
}: {
  routine: Routine;
  session: Session;
  dayName: (id: string) => string;
}) {
  const state = useAppState();
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [confirming, setConfirming] = useState(false);
  const [swapFor, setSwapFor] = useState<number | null>(null);

  const day = routine.days.find((d) => d.id === session.dayId);
  const num = workoutNumber(state, routine);
  // A previously-finished workout reopened from History / "Reopen last workout".
  const editing = Boolean(session.editing);

  const warmups = day ? warmupSlots(routine, day.slots) : new Set<number>();

  const completedSets = session.exercises.reduce(
    (sum, log) =>
      log.skipped ? sum : sum + log.sets.filter((s) => s.done || s.reps > 0).length,
    0
  );
  const doneExercises = session.exercises.filter(
    (log) => !log.skipped && log.sets.some((s) => s.done || s.reps > 0)
  ).length;
  const plannedExercises = session.exercises.filter((log) => !log.skipped).length;

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <>
      <header className="day-head">
        <h1>{dayName(session.dayId)}</h1>
        <span className="sub">
          {editing
            ? `Editing · ${new Date(session.finishedAt ?? session.startedAt).toLocaleDateString()}`
            : `${routine.name} · workout ${num} of ${routine.cycle.length}`}
        </span>
      </header>

      <div className="resume-banner">
        {editing
          ? "Editing a finished workout · changes save automatically"
          : "In progress · every set is saved automatically"}
        {!editing && (
          <button
            className="ghost small"
            onClick={() => {
              if (confirm("Discard this workout? Nothing will be logged.")) {
                discardSession(session.id);
              }
            }}
          >
            Discard
          </button>
        )}
      </div>

      <div className="exercise-list">
        {session.exercises.map((log, exIndex) => {
          const ex = findExercise(routine, log.exerciseId);
          if (!ex) return null;
          const slot = day?.slots[exIndex];
          const isOpen = expanded.has(exIndex);
          const history = exerciseHistory(state.sessions, log.exerciseId);
          const suggestion = slot
            ? suggestWeight(ex, slot, state.profile, history)
            : undefined;
          const last = lastAppearance(state.sessions, log.exerciseId);
          const allDone = log.sets.length > 0 && log.sets.every((s) => s.done);
          const skipped = Boolean(log.skipped);
          const open = isOpen && !skipped;

          return (
            <div
              key={exIndex}
              className={
                "card exercise" + (skipped ? " skipped" : allDone ? " done" : "")
              }
            >
              <div className="exercise-head">
                <button
                  className="disclosure"
                  aria-expanded={open}
                  disabled={skipped}
                  onClick={() => toggle(exIndex)}
                >
                  <span className={open ? "caret open" : "caret"}>▸</span>
                  <span className="ex-name">{ex.name}</span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Form cue and video for ${ex.name}`}
                  onClick={() => navigate(`#/exercise/${ex.id}`)}
                >
                  <PaperPlane />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Options for ${ex.name}`}
                  onClick={() => setSwapFor(exIndex)}
                >
                  ⋯
                </button>
              </div>

              <div className="exercise-subline">
                {skipped ? (
                  <span className="skipped-tag">Skipped this session</span>
                ) : (
                  <>
                    {slot && (
                      <>
                        {log.sets.length} × {slot.repMin}–{slot.repMax}
                      </>
                    )}
                    {suggestion && (
                      <>
                        {"  ·  "}
                        {suggestion.weight}
                        {ex.loadType === "assisted" ? " assist" : " lb"}{" "}
                        <span className="dim">
                          {suggestion.isGuess ? "suggested" : "target"}
                          {LOAD_HINT[ex.loadType] ? ` (${LOAD_HINT[ex.loadType]})` : ""}
                        </span>
                      </>
                    )}
                    {log.exerciseId !== log.slotExerciseId && (
                      <span className="swapped-tag">swapped</span>
                    )}
                  </>
                )}
              </div>

              {suggestion && open && (
                <div className="suggest-reason">
                  {suggestion.reason}
                  {suggestion.repTarget === "repMin" && slot
                    ? ` · aim for ${slot.repMin} reps`
                    : suggestion.repTarget === "beat-last"
                      ? " · beat last time"
                      : ""}
                </div>
              )}

              {warmups.has(exIndex) && !allDone && !skipped && (
                <div className="warmup-note">Warm up first — these sets aren't logged</div>
              )}

              {open && (
                <>
                  {log.sets.map((set, setIndex) => (
                    <SetRow
                      key={setIndex}
                      index={setIndex}
                      set={set}
                      weightStep={ex.increment}
                      weightSuffix={ex.loadType === "assisted" ? "assist" : "lb"}
                      ghostReps={last?.sets[setIndex]?.reps}
                      onChange={(patch) => {
                        updateSet(session.id, exIndex, setIndex, patch);
                        // Ticking a set done kicks off the rest stopwatch.
                        if (patch.done === true) startRest();
                      }}
                    />
                  ))}

                  <label className="note-field">
                    <span>Notes</span>
                    <textarea
                      rows={2}
                      value={log.note ?? ""}
                      placeholder="How it felt, form cues, pain…"
                      onChange={(e) =>
                        setExerciseNote(session.id, exIndex, e.target.value)
                      }
                    />
                  </label>
                </>
              )}

              {swapFor === exIndex && (
                <OptionsSheet
                  routine={routine}
                  currentId={log.exerciseId}
                  slotExerciseId={log.slotExerciseId}
                  skipped={skipped}
                  onToggleSkip={() => {
                    setExerciseSkipped(session.id, exIndex, !skipped);
                    setSwapFor(null);
                  }}
                  onClose={() => setSwapFor(null)}
                  onPick={(newId, persist) => {
                    const newEx = findExercise(routine, newId);
                    const seed = newEx
                      ? suggestWeight(
                          newEx,
                          slot ?? { repMin: 8, repMax: 12 },
                          state.profile,
                          exerciseHistory(state.sessions, newId)
                        ).weight
                      : 0;
                    swapInSession(session.id, exIndex, newId, seed);
                    if (persist) setPersistentSwap(session.dayId, exIndex, newId);
                    setSwapFor(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="action-stack">
        {editing ? (
          <button
            className="primary big"
            onClick={() => {
              saveEdits(routine, session.id);
              navigate("#/today");
            }}
          >
            Save changes
          </button>
        ) : !confirming ? (
          <button className="primary big" onClick={() => setConfirming(true)}>
            Finish workout
          </button>
        ) : (
          <div className="confirm-bar">
            <span>
              Finish? <strong>{doneExercises}</strong> of{" "}
              <strong>{plannedExercises}</strong> exercise
              {plannedExercises === 1 ? "" : "s"} done, {completedSets} set
              {completedSets === 1 ? "" : "s"} logged.
            </span>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setConfirming(false)}>
                Not yet
              </button>
              <button
                className="primary"
                onClick={() => {
                  finishSession(routine, session.id);
                  navigate("#/today");
                }}
              >
                Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function OptionsSheet({
  routine,
  currentId,
  slotExerciseId,
  skipped,
  onToggleSkip,
  onClose,
  onPick
}: {
  routine: Routine;
  currentId: string;
  slotExerciseId: string;
  skipped: boolean;
  onToggleSkip: () => void;
  onClose: () => void;
  onPick: (exerciseId: string, persist: boolean) => void;
}) {
  const [persist, setPersist] = useState(false);
  // Alternatives of the ORIGINAL slot exercise, plus the original itself so you
  // can swap back. De-dupe and drop the current pick.
  const base = findExercise(routine, slotExerciseId);
  const options = useMemo(() => {
    const list: Exercise[] = [];
    if (base) list.push(base);
    list.push(...getAlternatives(routine, slotExerciseId));
    const seen = new Set<string>();
    return list.filter((e) => {
      if (e.id === currentId || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [routine, slotExerciseId, currentId, base]);

  return (
    <div className="sheet">
      <p className="sheet-title">Exercise options</p>

      <button className="sheet-item" onClick={onToggleSkip}>
        <span className="ex-name">
          {skipped ? "Put this exercise back" : "Skip this exercise today"}
        </span>
      </button>

      {!skipped && (
        <>
          <p className="sheet-title small">Swap for</p>
          <label className="persist-toggle">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
            />
            Always use this instead
          </label>
          {options.map((e) => (
            <button
              key={e.id}
              className="sheet-item"
              onClick={() => onPick(e.id, persist)}
            >
              <span className="ex-name">{e.name}</span>
              <span className="equip-tags">
                {e.equipment.map((eq) => (
                  <span key={eq} className="equip-tag">
                    {eq}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </>
      )}

      <button className="ghost" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
