import { useEffect, useMemo, useRef, useState } from "react";
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
  toggleChecklistItem,
  updateSet,
  useAppState
} from "../store";
import { nextDay, upcomingDays, workoutNumber } from "../schedule";
import {
  findExercise,
  getAlternatives,
  resolvedExerciseId,
  slotBlocks,
  slotLabel,
  supersetOf
} from "../routine";
import { targetText, weightUnit } from "../format";
import { exerciseHistory, lastAppearance } from "../history";
import { suggestWeight } from "../suggest";
import { SetRow } from "../components/SetRow";
import {
  CHECKLIST_TITLES,
  type ChecklistKind,
  type Exercise,
  type Pattern,
  type ProgramSlot,
  type Routine,
  type Session,
  type WorkoutDay
} from "../types";

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
function warmupSlots(routine: Routine, day: WorkoutDay): Set<number> {
  const out = new Set<number>();
  // A day with its own warm-up checklist covers this already.
  if (day.warmup?.length) return out;
  const slots: ProgramSlot[] = day.slots;
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
  const warmups = warmupSlots(routine, day);

  const rows = day.slots.map((slot, i) => {
    const exId = resolvedExerciseId(state, day.id, i, slot.exerciseId);
    const ex = findExercise(routine, exId);
    if (!ex) return null;
    const history = exerciseHistory(state.sessions, exId);
    const s = suggestWeight(ex, slot, state.profile, history);
    return {
      slot,
      i,
      ex,
      suggestion: s,
      warmup: warmups.has(i),
      label: slotLabel(day.slots, i)
    };
  });

  const previewCard = (i: number) => {
    const r = rows[i];
    if (!r) return null;
    return (
      <div key={r.i} className="card exercise-preview">
        <button className="link-title" onClick={() => navigate(`#/exercise/${r.ex.id}`)}>
          {r.label && <span className="ss-label">{r.label}</span>}
          {r.ex.name}
        </button>
        <div className="preview-meta">
          {targetText(r.ex, r.slot, r.slot.sets)}
          {!r.ex.noWeight && (
            <>
              {"  ·  "}
              <strong>
                {r.suggestion.weight} {weightUnit(r.ex)}
              </strong>{" "}
              <span className="dim">{r.suggestion.isGuess ? "suggested" : "target"}</span>
            </>
          )}
        </div>
        {r.slot.note && <div className="slot-note">{r.slot.note}</div>}
        <div className="suggest-reason">{r.suggestion.reason}</div>
        {r.warmup && <div className="warmup-note">Warm up first</div>}
      </div>
    );
  };

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

      <Checklist kind="warmup" day={day} />

      <div className="exercise-list">
        {slotBlocks(day.slots).map((b) =>
          b.group ? (
            <div key={`ss-${b.indices[0]}`} className="superset">
              <SupersetHead group={b.group} restSec={day.restSec} />
              {b.indices.map(previewCard)}
            </div>
          ) : (
            previewCard(b.indices[0])
          )
        )}
      </div>

      <Checklist kind="finisher" day={day} />
      <Checklist kind="cooldown" day={day} />

      <div className="action-stack">
        <button className="primary big" onClick={start}>
          Start {day.name}
        </button>
        <div className="secondary-actions">
          <div className="action-row">
            <button className="ghost" onClick={() => skipWorkout(routine)}>
              Skip this workout
            </button>
            <DifferentDay routine={routine} />
          </div>
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

  return (
    <>
      <button
        className="ghost"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Do a different day
      </button>
      {open && (
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
                  // Just start a session for this day. finishSession() notices
                  // the day isn't the current cycle position and resumes the
                  // cycle at the slot right after it.
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
      )}
    </>
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
  // Start with everything collapsed; the user opens what they're working on.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [swapFor, setSwapFor] = useState<number | null>(null);

  const day = routine.days.find((d) => d.id === session.dayId);
  const num = workoutNumber(state, routine);
  // A previously-finished workout reopened from History / "Reopen last workout".
  const editing = Boolean(session.editing);

  const warmups = day ? warmupSlots(routine, day) : new Set<number>();
  const supersets = day ? supersetOf(day.slots) : new Map();
  const blocks = day
    ? slotBlocks(day.slots).filter((b) => b.indices.every((i) => i < session.exercises.length))
    : session.exercises.map((_, i) => ({ group: undefined, indices: [i] }));
  // Slots the session has beyond the day (day edited mid-workout) still show.
  const covered = new Set(blocks.flatMap((b) => b.indices));
  session.exercises.forEach((_, i) => {
    if (!covered.has(i)) blocks.push({ group: undefined, indices: [i] });
  });

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

  // When the last set of an exercise is ticked done, fold that card up so the
  // next exercise is in reach. Fires once on the not-done -> done transition
  // (so a completed exercise can still be reopened by hand), on a short delay
  // so the final tick is visible first. Un-ticking within the delay cancels it.
  const completedBefore = useRef<Set<number>>(new Set());
  useEffect(() => {
    const complete = new Set<number>();
    session.exercises.forEach((log, i) => {
      if (!log.skipped && log.sets.length > 0 && log.sets.every((s) => s.done)) {
        complete.add(i);
      }
    });
    const justFinished = [...complete].filter((i) => !completedBefore.current.has(i));
    completedBefore.current = complete;
    if (justFinished.length === 0) return;
    const t = setTimeout(() => {
      setExpanded((prev) => {
        if (!justFinished.some((i) => prev.has(i))) return prev;
        const next = new Set(prev);
        justFinished.forEach((i) => next.delete(i));
        return next;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [session.exercises]);

  // Tell the floating rest timer to lift clear of the finish-confirm bar.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("finish-confirm", { detail: confirming }));
    return () => {
      window.dispatchEvent(new CustomEvent("finish-confirm", { detail: false }));
    };
  }, [confirming]);

  /**
   * A set was just ticked done. Outside a superset that starts the rest
   * stopwatch. Inside one, open the partner exercise for the same round and
   * only start resting once every exercise in the pair has done this round.
   */
  const onSetDone = (exIndex: number, setIndex: number) => {
    const block = supersets.get(exIndex);
    if (!block) {
      startRest();
      return;
    }
    const members: number[] = block.indices.filter(
      (i: number) => !session.exercises[i]?.skipped
    );
    const isDone = (i: number) =>
      i === exIndex || Boolean(session.exercises[i]?.sets[setIndex]?.done);
    const pending = members.find(
      (i) => !isDone(i) && setIndex < (session.exercises[i]?.sets.length ?? 0)
    );
    if (pending === undefined) {
      startRest();
      // Round finished: open the first exercise of the pair for the next round.
      const first = members.find(
        (i) => session.exercises[i].sets.length > setIndex + 1
      );
      if (first !== undefined) setExpanded((prev) => new Set(prev).add(first));
    } else {
      setExpanded((prev) => new Set(prev).add(pending));
    }
  };

  const renderCard = (exIndex: number) => {
    const log = session.exercises[exIndex];

      const ex = findExercise(routine, log.exerciseId);
      if (!ex) return null;
      const slot = day?.slots[exIndex];
      const isOpen = expanded.has(exIndex);
      const history = exerciseHistory(state.sessions, log.exerciseId);
      const suggestion = slot
        ? suggestWeight(ex, slot, state.profile, history)
        : undefined;
      const last = lastAppearance(state.sessions, log.exerciseId);
      const label = day ? slotLabel(day.slots, exIndex) : undefined;
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
              {label && <span className="ss-label">{label}</span>}
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
                {slot && targetText(ex, slot, log.sets.length)}
                {suggestion && !ex.noWeight && (
                  <>
                    {"  ·  "}
                    {suggestion.weight} {weightUnit(ex)}{" "}
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

          {slot?.note && !skipped && <div className="slot-note">{slot.note}</div>}

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
                  weightSuffix={weightUnit(ex)}
                  exercise={ex}
                  ghostReps={last?.sets[setIndex]?.reps}
                  onChange={(patch) => {
                    updateSet(session.id, exIndex, setIndex, patch);
                    if (patch.done === true) onSetDone(exIndex, setIndex);
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
              slotAlternatives={slot?.alternatives}
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

  };

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

      {day && <Checklist kind="warmup" day={day} session={session} />}

      <div className="exercise-list">
        {blocks.map((b) => {
          if (!b.group) return renderCard(b.indices[0]);
          const rounds = Math.max(...b.indices.map((i) => session.exercises[i].sets.length));
          const round = Math.min(
            rounds,
            1 + Math.min(...b.indices.map((i) => session.exercises[i].sets.filter((st) => st.done).length))
          );
          const allDone = b.indices.every((i) => {
            const l = session.exercises[i];
            return l.skipped || (l.sets.length > 0 && l.sets.every((st) => st.done));
          });
          return (
            <div key={`ss-${b.indices[0]}`} className={"superset" + (allDone ? " done" : "")}>
              <SupersetHead
                group={b.group}
                restSec={day?.restSec}
                round={allDone ? undefined : round}
                rounds={rounds}
              />
              {b.indices.map(renderCard)}
            </div>
          );
        })}
      </div>

      {day && <Checklist kind="finisher" day={day} session={session} />}
      {day && <Checklist kind="cooldown" day={day} session={session} />}

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
  slotAlternatives,
  skipped,
  onToggleSkip,
  onClose,
  onPick
}: {
  routine: Routine;
  currentId: string;
  slotExerciseId: string;
  slotAlternatives?: string[];
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
    list.push(...getAlternatives(routine, slotExerciseId, { alternatives: slotAlternatives }));
    const seen = new Set<string>();
    return list.filter((e) => {
      if (e.id === currentId || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [routine, slotExerciseId, slotAlternatives, currentId, base]);

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

/** Header strip over a superset: what to do and where you are in it. */
function SupersetHead({
  group,
  restSec,
  round,
  rounds
}: {
  group: string;
  restSec?: number;
  round?: number;
  rounds?: number;
}) {
  return (
    <div className="superset-head">
      <span className="superset-title">Superset {group}</span>
      <span className="superset-meta">
        Alternate sets{restSec ? ` · rest ${restSec}s after each round` : ""}
        {round && rounds ? ` · round ${round} of ${rounds}` : ""}
      </span>
    </div>
  );
}

/**
 * Warm-up / finisher / cooldown list. With a session it's a tick-off list
 * (saved on the session, never part of history or progression); without one
 * it's a read-only preview.
 */
function Checklist({
  kind,
  day,
  session
}: {
  kind: ChecklistKind;
  day: WorkoutDay;
  session?: Session;
}) {
  const items = day[kind] ?? [];
  const checked = new Set(session?.checked ?? []);
  const doneCount = items.filter((_, i) => checked.has(`${kind}:${i}`)).length;
  const complete = items.length > 0 && doneCount === items.length;
  // Open the warm-up by default during a workout; everything else starts folded.
  const [open, setOpen] = useState(() => Boolean(session) && kind === "warmup" && !complete);

  // Fold the list once its last item is ticked (same feel as exercise cards).
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      const t = setTimeout(() => setOpen(false), 400);
      wasComplete.current = complete;
      return () => clearTimeout(t);
    }
    wasComplete.current = complete;
  }, [complete]);

  if (items.length === 0) return null;

  return (
    <div className={"card checklist" + (complete ? " done" : "")}>
      <button
        type="button"
        className="disclosure"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={open ? "caret open" : "caret"}>▸</span>
        <span className="ex-name">{CHECKLIST_TITLES[kind]}</span>
        <span className="checklist-count">
          {session ? `${doneCount}/${items.length}` : `${items.length} item${items.length === 1 ? "" : "s"}`}
        </span>
      </button>
      {open && (
        <ul className="checklist-items">
          {items.map((item, i) => {
            const key = `${kind}:${i}`;
            const on = checked.has(key);
            return (
              <li key={key}>
                {session ? (
                  <button
                    type="button"
                    className={"check-item" + (on ? " on" : "")}
                    aria-pressed={on}
                    onClick={() => toggleChecklistItem(session.id, key)}
                  >
                    <span className="check-box" aria-hidden="true">
                      {on ? "✓" : ""}
                    </span>
                    <span className="check-text">{item}</span>
                  </button>
                ) : (
                  <span className="check-item static">
                    <span className="check-text">{item}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
