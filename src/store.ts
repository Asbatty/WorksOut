// A tiny external store around the storage module. One in-memory copy of
// AppState, a subscribe list, and mutators that persist on every change so a
// logged set is never lost. Components read it with useAppState().

import { useSyncExternalStore } from "react";
import type { AppState, ExerciseLog, Profile, Routine, SetLog } from "./types";
import { loadState, saveState, uid } from "./storage";
import { advancedPosition, positionAfterDay } from "./schedule";
import { resolvedExerciseId, slotKey } from "./routine";

let state: AppState = loadState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Replace state via an updater, persist, notify. */
function set(updater: (prev: AppState) => AppState) {
  state = updater(state);
  saveState(state);
  emit();
}

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getState,
    getState
  );
}

// --- profile --------------------------------------------------------------

export function updateProfile(patch: Partial<Profile>) {
  set((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
}

// --- swaps --------------------------------------------------------------

/** Swap the exercise for a slot for good (persists across sessions). */
export function setPersistentSwap(dayId: string, slotIndex: number, exerciseId: string) {
  set((s) => ({ ...s, swaps: { ...s.swaps, [slotKey(dayId, slotIndex)]: exerciseId } }));
}

export function clearPersistentSwap(dayId: string, slotIndex: number) {
  set((s) => {
    const swaps = { ...s.swaps };
    delete swaps[slotKey(dayId, slotIndex)];
    return { ...s, swaps };
  });
}

// --- sessions ----------------------------------------------------------

/** The unfinished session, if the app was closed mid-workout. */
export function activeSession(s: AppState = state) {
  return s.sessions.find((sess) => !sess.finishedAt);
}

export function sessionById(id: string, s: AppState = state) {
  return s.sessions.find((sess) => sess.id === id);
}

/**
 * Start (or resume) a workout for a day. Seeds one ExerciseLog per slot using
 * the resolved (post-swap) exercise, and pre-creates the set rows so the
 * steppers have something to bind to. Weights are filled in by the caller.
 */
export function startSession(
  routine: Routine,
  dayId: string,
  seedWeights: (slotIndex: number, resolvedExerciseId: string) => number
): string {
  const existing = activeSession();
  if (existing) return existing.id;

  const day = routine.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`unknown day ${dayId}`);

  const id = uid();
  const exercises: ExerciseLog[] = day.slots.map((slot, i) => {
    const exId = resolvedExerciseId(state, dayId, i, slot.exerciseId);
    const w = seedWeights(i, exId);
    return {
      exerciseId: exId,
      slotExerciseId: slot.exerciseId,
      sets: Array.from({ length: slot.sets }, () => ({ weight: w, reps: 0 }) as SetLog)
    };
  });

  set((s) => ({
    ...s,
    sessions: [
      ...s.sessions,
      { id, profileId: s.profile.id, dayId, startedAt: new Date().toISOString(), exercises }
    ]
  }));
  return id;
}

function mapSession(s: AppState, id: string, fn: (sess: AppState["sessions"][number]) => AppState["sessions"][number]) {
  return { ...s, sessions: s.sessions.map((sess) => (sess.id === id ? fn(sess) : sess)) };
}

function mapExerciseLog(
  sess: AppState["sessions"][number],
  exIndex: number,
  fn: (log: ExerciseLog) => ExerciseLog
) {
  return { ...sess, exercises: sess.exercises.map((log, i) => (i === exIndex ? fn(log) : log)) };
}

/** Update one set (weight, reps, or done flag). Autosaves. */
export function updateSet(
  sessionId: string,
  exIndex: number,
  setIndex: number,
  patch: Partial<SetLog>
) {
  set((s) =>
    mapSession(s, sessionId, (sess) =>
      mapExerciseLog(sess, exIndex, (log) => ({
        ...log,
        sets: log.sets.map((st, i) => (i === setIndex ? { ...st, ...patch } : st))
      }))
    )
  );
}

export function addSet(sessionId: string, exIndex: number) {
  set((s) =>
    mapSession(s, sessionId, (sess) =>
      mapExerciseLog(sess, exIndex, (log) => {
        const prev = log.sets[log.sets.length - 1];
        return { ...log, sets: [...log.sets, { weight: prev?.weight ?? 0, reps: 0 }] };
      })
    )
  );
}

export function removeSet(sessionId: string, exIndex: number, setIndex: number) {
  set((s) =>
    mapSession(s, sessionId, (sess) =>
      mapExerciseLog(sess, exIndex, (log) => ({
        ...log,
        sets: log.sets.filter((_, i) => i !== setIndex)
      }))
    )
  );
}

export function setExerciseNote(sessionId: string, exIndex: number, note: string) {
  set((s) =>
    mapSession(s, sessionId, (sess) => mapExerciseLog(sess, exIndex, (log) => ({ ...log, note })))
  );
}

/** Swap the exercise for one slot within the current session only. */
export function swapInSession(sessionId: string, exIndex: number, newExerciseId: string, seedWeight: number) {
  set((s) =>
    mapSession(s, sessionId, (sess) =>
      mapExerciseLog(sess, exIndex, (log) => ({
        ...log,
        exerciseId: newExerciseId,
        // Fresh sets at the new exercise's suggested weight; never carry a
        // weight across different exercises (build-plan section 6).
        sets: log.sets.map(() => ({ weight: seedWeight, reps: 0 }) as SetLog),
        note: undefined
      }))
    )
  );
}

/** Finish the workout: stamp finishedAt and advance the cycle. */
export function finishSession(routine: Routine, sessionId: string) {
  set((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    if (!sess) return s;
    const isCurrent = routine.cycle[
      ((s.cyclePosition % routine.cycle.length) + routine.cycle.length) % routine.cycle.length
    ] === sess.dayId;
    const nextPos = isCurrent
      ? advancedPosition(s, routine)
      : positionAfterDay(routine, sess.dayId);
    return {
      ...mapSession(s, sessionId, (x) => ({ ...x, finishedAt: new Date().toISOString() })),
      cyclePosition: nextPos
    };
  });
}

/** Throw away an unfinished session (e.g. started by mistake). */
export function discardSession(sessionId: string) {
  set((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== sessionId) }));
}

/** Skip today's workout without logging anything. */
export function skipWorkout(routine: Routine) {
  set((s) => ({ ...s, cyclePosition: advancedPosition(s, routine) }));
}

// --- routine overlay + file version --------------------------------------

export function setRoutineOverlay(routine: Routine | undefined) {
  set((s) => ({ ...s, routineOverlay: routine }));
}

export function noteRoutineFileVersion(version: number) {
  set((s) => (s.routineFileVersion === version ? s : { ...s, routineFileVersion: version }));
}

// --- import / danger zone ----------------------------------------------

export function replaceState(next: AppState) {
  set(() => next);
}
