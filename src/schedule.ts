// Rolling-cycle schedule logic. "Today" is always the next uncompleted day in
// the routine's cycle. Rest days are not scheduled; missing a day changes
// nothing. See build-plan section 7.

import type { AppState, Routine, WorkoutDay } from "./types";

/** Normalise a possibly-out-of-range cyclePosition to 0..len-1. */
export function cycleIndex(state: AppState, routine: Routine): number {
  const len = routine.cycle.length;
  if (len === 0) return 0;
  return ((state.cyclePosition % len) + len) % len;
}

/** The workout to do next. */
export function nextDay(state: AppState, routine: Routine): WorkoutDay | undefined {
  const dayId = routine.cycle[cycleIndex(state, routine)];
  return routine.days.find((d) => d.id === dayId);
}

/** 1-based position in the cycle, for the "Workout N of M" header. */
export function workoutNumber(state: AppState, routine: Routine): number {
  return cycleIndex(state, routine) + 1;
}

/** The next `count` days after today, for the preview strip. */
export function upcomingDays(
  state: AppState,
  routine: Routine,
  count = 3
): WorkoutDay[] {
  const len = routine.cycle.length;
  if (len === 0) return [];
  const start = cycleIndex(state, routine);
  const out: WorkoutDay[] = [];
  for (let i = 1; i <= count; i++) {
    const dayId = routine.cycle[(start + i) % len];
    const day = routine.days.find((d) => d.id === dayId);
    if (day) out.push(day);
  }
  return out;
}

/** cyclePosition after finishing/skipping the current day. */
export function advancedPosition(state: AppState, routine: Routine): number {
  const len = routine.cycle.length;
  if (len === 0) return 0;
  return (cycleIndex(state, routine) + 1) % len;
}

/**
 * cyclePosition to land on after completing an arbitrary day the user picked
 * ("Do a different day"): the slot right after that day in the cycle.
 */
export function positionAfterDay(routine: Routine, dayId: string): number {
  const len = routine.cycle.length;
  if (len === 0) return 0;
  const idx = routine.cycle.indexOf(dayId);
  if (idx === -1) return 0;
  return (idx + 1) % len;
}
