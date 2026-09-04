// A tiny external store around the storage module. One in-memory copy of
// AppState, a subscribe list, and mutators that persist on every change so a
// logged set is never lost. Components read it with useAppState().

import { useSyncExternalStore } from "react";
import type {
  AppState,
  ExerciseLog,
  Profile,
  ProfileSnapshot,
  Routine,
  Session,
  SetLog
} from "./types";
import { loadState, saveState, uid } from "./storage";
import { advancedPosition, cycleIndex, positionAfterDay } from "./schedule";
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

// --- local profiles -----------------------------------------------------
//
// The active profile's data lives in the flat AppState fields; every other
// profile is a ProfileSnapshot parked in `otherProfiles`. Switching just moves
// data between the two. There is no login — this is a local device thing.

function snapshotActive(s: AppState): ProfileSnapshot {
  return {
    profile: s.profile,
    sessions: s.sessions,
    cyclePosition: s.cyclePosition,
    activeProgramId: s.activeProgramId,
    swaps: s.swaps,
    routineOverlays: s.routineOverlays
  };
}

function hydrate(s: AppState, id: string, snap: ProfileSnapshot): AppState {
  return {
    ...s,
    activeProfileId: id,
    profile: snap.profile,
    sessions: snap.sessions,
    cyclePosition: snap.cyclePosition,
    activeProgramId: snap.activeProgramId,
    swaps: snap.swaps,
    routineOverlays: snap.routineOverlays,
    restStartedAt: undefined
  };
}

export interface ProfileListItem {
  id: string;
  name: string;
  active: boolean;
  sessionCount: number;
}

/** All local profiles, active one first. */
export function profileList(s: AppState = state): ProfileListItem[] {
  const active: ProfileListItem = {
    id: s.activeProfileId,
    name: s.profile.name,
    active: true,
    sessionCount: s.sessions.length
  };
  const others = Object.entries(s.otherProfiles).map(([id, p]) => ({
    id,
    name: p.profile.name,
    active: false,
    sessionCount: p.sessions.length
  }));
  return [active, ...others];
}

/** Load a different local profile (parks the current one on the side). */
export function switchProfile(id: string) {
  set((s) => {
    if (id === s.activeProfileId) return s;
    const target = s.otherProfiles[id];
    if (!target) return s;
    const otherProfiles = { ...s.otherProfiles };
    delete otherProfiles[id];
    otherProfiles[s.activeProfileId] = snapshotActive(s);
    return hydrate({ ...s, otherProfiles }, id, target);
  });
}

/** Create a new empty profile and switch to it. Inherits the current split. */
export function createProfile(name: string) {
  set((s) => {
    const id = uid();
    const otherProfiles = { ...s.otherProfiles, [s.activeProfileId]: snapshotActive(s) };
    const fresh: ProfileSnapshot = {
      profile: {
        id,
        name: name.trim() || "New profile",
        bodyweightLb: 160,
        experience: "beginner",
        unit: "lb"
      },
      sessions: [],
      cyclePosition: 0,
      activeProgramId: s.activeProgramId,
      swaps: {},
      routineOverlays: {}
    };
    return hydrate({ ...s, otherProfiles }, id, fresh);
  });
}

/** Delete a non-active profile and everything it logged. */
export function deleteProfile(id: string) {
  set((s) => {
    if (id === s.activeProfileId || !s.otherProfiles[id]) return s;
    const otherProfiles = { ...s.otherProfiles };
    delete otherProfiles[id];
    return { ...s, otherProfiles };
  });
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
  // An unfinished workout, or a finished one currently reopened for editing.
  return s.sessions.find((sess) => !sess.finishedAt || sess.editing);
}

/**
 * Most recently finished session (ignores one reopened for editing). Ties on the
 * timestamp fall back to array order, where later means more recent.
 */
export function lastFinishedSession(s: AppState = state): Session | undefined {
  let latest: Session | undefined;
  for (const sess of s.sessions) {
    if (!sess.finishedAt || sess.editing) continue;
    if (!latest || sess.finishedAt >= latest.finishedAt!) latest = sess;
  }
  return latest;
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

/** Mark an exercise as skipped (or un-skip it) for this session. */
export function setExerciseSkipped(sessionId: string, exIndex: number, skipped: boolean) {
  set((s) =>
    mapSession(s, sessionId, (sess) =>
      mapExerciseLog(sess, exIndex, (log) => ({ ...log, skipped }))
    )
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

/**
 * Advance the cycle for a session that hasn't advanced it yet: one step if it's
 * the current cycle day, otherwise to the slot right after that day ("do a
 * different day"). Records where the cycle was so the finish can be undone.
 */
function advanceCycleFor(s: AppState, routine: Routine, sess: Session): AppState {
  const idx = cycleIndex(s, routine);
  const isCurrent = routine.cycle[idx] === sess.dayId;
  const nextPos = isCurrent
    ? advancedPosition(s, routine)
    : positionAfterDay(routine, sess.dayId);
  return {
    ...mapSession(s, sess.id, (x) => ({
      ...x,
      cycleAdvanced: true,
      prevCyclePosition: idx
    })),
    cyclePosition: nextPos
  };
}

/** Finish a fresh workout: stamp finishedAt and advance the cycle. */
export function finishSession(routine: Routine, sessionId: string) {
  set((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    if (!sess) return s;
    const stamped = mapSession(s, sessionId, (x) => ({
      ...x,
      finishedAt: new Date().toISOString()
    }));
    // If this session already advanced the cycle (it's being re-finished after
    // an edit), leave the schedule alone.
    if (sess.cycleAdvanced) return stamped;
    return advanceCycleFor(stamped, routine, sess);
  });
}

/**
 * Reopen a finished workout for editing. If it's the most recent workout this
 * also undoes the finish: the cycle rewinds to where it was, so finishing again
 * (or discarding) leaves the schedule consistent. Older workouts are edited in
 * place with no schedule change and keep their original date.
 * Throws if another workout is currently in progress.
 */
export function reopenSession(sessionId: string) {
  if (state.sessions.some((x) => (!x.finishedAt || x.editing) && x.id !== sessionId)) {
    throw new Error("Finish the workout you have in progress first.");
  }
  set((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    if (!sess || !sess.finishedAt) return s;
    const isLatest = lastFinishedSession(s)?.id === sessionId;
    const rewind =
      isLatest && sess.cycleAdvanced === true && typeof sess.prevCyclePosition === "number";
    return {
      ...mapSession(s, sessionId, (x) => ({
        ...x,
        editing: true,
        ...(rewind ? { cycleAdvanced: false } : {})
      })),
      cyclePosition: rewind ? (sess.prevCyclePosition as number) : s.cyclePosition
    };
  });
}

/** Finish editing a reopened workout: clear the editing flag, keep the date. */
export function saveEdits(routine: Routine, sessionId: string) {
  set((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    if (!sess) return s;
    const cleared = mapSession(s, sessionId, (x) => ({ ...x, editing: false }));
    // If reopening rewound the cycle (this was the latest workout), re-apply the
    // advance now. Otherwise it's an older workout — leave the schedule alone.
    if (sess.cycleAdvanced) return cleared;
    return advanceCycleFor(cleared, routine, sess);
  });
}

/**
 * Throw away a session. Used for an unfinished workout started by mistake, and
 * (via the session view) to delete a logged workout outright.
 */
export function discardSession(sessionId: string) {
  set((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== sessionId) }));
}

/** Skip today's workout without logging anything. */
export function skipWorkout(routine: Routine) {
  set((s) => ({ ...s, cyclePosition: advancedPosition(s, routine) }));
}

// --- programs + routine overlay + file version --------------------------

/** Switch the active training split. Restarts the cycle at day 1. */
export function setActiveProgram(programId: string) {
  set((s) =>
    s.activeProgramId === programId
      ? s
      : { ...s, activeProgramId: programId, cyclePosition: 0 }
  );
}

/** Set (or clear, with undefined) the in-app edited routine for one program. */
export function setRoutineOverlay(programId: string, routine: Routine | undefined) {
  set((s) => {
    const routineOverlays = { ...s.routineOverlays };
    if (routine) routineOverlays[programId] = routine;
    else delete routineOverlays[programId];
    return { ...s, routineOverlays };
  });
}

export function noteRoutineFileVersion(version: number) {
  set((s) => (s.routineFileVersion === version ? s : { ...s, routineFileVersion: version }));
}

// --- rest stopwatch -----------------------------------------------------

/** Start (or restart) the rest stopwatch from zero. */
export function startRest() {
  set((s) => ({ ...s, restStartedAt: Date.now() }));
}

/** Stop and clear the rest stopwatch. */
export function stopRest() {
  set((s) => (s.restStartedAt == null ? s : { ...s, restStartedAt: undefined }));
}

// --- import / danger zone ----------------------------------------------

export function replaceState(next: AppState) {
  set(() => next);
}
