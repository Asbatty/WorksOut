// Loads the routine file and exposes small helpers for working with it.
//
// The file (public/routine.json, schema v2) holds one shared exercise library
// plus several programs (Upper/Lower, Full Body, Push/Pull/Legs). The active
// program is flattened with the library into a Routine for the rest of the app.
// A per-program in-app edit (AppState.routineOverlays) takes precedence.

import type {
  AppState,
  Exercise,
  Program,
  Routine,
  RoutineFile,
  WorkoutDay
} from "./types";

export const ROUTINE_URL = `${import.meta.env.BASE_URL}routine.json`;

/** Fetch routine.json. Rejects if offline with no cached copy. */
export async function fetchRoutineFile(): Promise<RoutineFile> {
  const res = await fetch(ROUTINE_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`routine.json: HTTP ${res.status}`);
  const file = (await res.json()) as RoutineFile;
  for (const prog of file.programs ?? []) {
    const problems = validateRoutine(programToRoutine(prog, file));
    if (problems.length) {
      // Don't hard-fail the app over a bad file; log loudly so it's noticed.
      console.warn(`routine.json program "${prog.id}":\n` + problems.join("\n"));
    }
  }
  return file;
}

/** The program the user has selected (falls back to the file default). */
export function activeProgram(state: AppState, file: RoutineFile): Program {
  return (
    file.programs.find((p) => p.id === state.activeProgramId) ??
    file.programs.find((p) => p.id === file.defaultProgramId) ??
    file.programs[0]
  );
}

/** Every day across every program (for naming sessions from any split). */
export function allProgramDays(file: RoutineFile): WorkoutDay[] {
  return file.programs.flatMap((p) => p.days);
}

/** Flatten a program with the shared library into a Routine. */
export function programToRoutine(prog: Program, file: RoutineFile): Routine {
  return {
    version: file.version,
    name: prog.name,
    cycle: prog.cycle,
    days: prog.days,
    exercises: file.exercises
  };
}

/** The routine the app should actually use right now (overlay wins). */
export function getActiveRoutine(state: AppState, file: RoutineFile): Routine {
  const prog = activeProgram(state, file);
  return state.routineOverlays[prog.id] ?? programToRoutine(prog, file);
}

// --- lookup helpers ---------------------------------------------------------

export function exerciseMap(routine: Routine): Map<string, Exercise> {
  return new Map(routine.exercises.map((e) => [e.id, e]));
}

export function findExercise(routine: Routine, id: string): Exercise | undefined {
  return routine.exercises.find((e) => e.id === id);
}

export function findDay(routine: Routine, id: string): WorkoutDay | undefined {
  return routine.days.find((d) => d.id === id);
}

/** Key for AppState.swaps: identifies one slot within one day. */
export function slotKey(dayId: string, slotIndex: number): string {
  return `${dayId}:${slotIndex}`;
}

/**
 * The exercise id to actually perform for a slot, honouring any persistent swap
 * the user set for that slot.
 */
export function resolvedExerciseId(
  state: AppState,
  dayId: string,
  slotIndex: number,
  slotExerciseId: string
): string {
  return state.swaps[slotKey(dayId, slotIndex)] ?? slotExerciseId;
}

/** Ordered list of alternative exercises for an exercise (best first). */
export function getAlternatives(routine: Routine, exerciseId: string): Exercise[] {
  const ex = findExercise(routine, exerciseId);
  if (!ex) return [];
  const map = exerciseMap(routine);
  return ex.alternatives
    .map((id) => map.get(id))
    .filter((e): e is Exercise => Boolean(e));
}

// --- validation -----------------------------------------------------------

/**
 * Returns a list of human-readable problems with a routine, or [] if it's fine.
 * Used at load time (warn only) and by the editor before saving an overlay.
 */
export function validateRoutine(routine: Routine): string[] {
  const problems: string[] = [];
  const ids = new Set(routine.exercises.map((e) => e.id));

  if (!routine.cycle.length) problems.push("cycle is empty");
  for (const dayId of routine.cycle) {
    if (!routine.days.some((d) => d.id === dayId)) {
      problems.push(`cycle references unknown day "${dayId}"`);
    }
  }

  for (const day of routine.days) {
    if (!day.slots.length) problems.push(`day "${day.id}" has no slots`);
    day.slots.forEach((slot, i) => {
      if (!ids.has(slot.exerciseId)) {
        problems.push(`day "${day.id}" slot ${i} references unknown exercise "${slot.exerciseId}"`);
      }
      if (slot.repMin < 1 || slot.repMax < slot.repMin) {
        problems.push(`day "${day.id}" slot ${i} has an invalid rep range ${slot.repMin}-${slot.repMax}`);
      }
      if (slot.sets < 1) problems.push(`day "${day.id}" slot ${i} has ${slot.sets} sets`);
    });
  }

  for (const ex of routine.exercises) {
    for (const altId of ex.alternatives) {
      if (!ids.has(altId)) {
        problems.push(`exercise "${ex.id}" lists unknown alternative "${altId}"`);
      }
    }
  }

  return problems;
}
