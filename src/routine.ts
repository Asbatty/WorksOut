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
  ProgramSlot,
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

/** Ordered list of alternative exercises for an exercise (best first). A
 *  slot's own `alternatives` list, when given, replaces the exercise's. */
export function getAlternatives(
  routine: Routine,
  exerciseId: string,
  slot?: Pick<ProgramSlot, "alternatives">
): Exercise[] {
  const ex = findExercise(routine, exerciseId);
  if (!ex) return [];
  const map = exerciseMap(routine);
  return (slot?.alternatives ?? ex.alternatives)
    .map((id) => map.get(id))
    .filter((e): e is Exercise => Boolean(e));
}

// --- supersets -------------------------------------------------------------

/** A run of slots done together. `group` is set only for real supersets (2+). */
export interface SlotBlock {
  group?: string;
  indices: number[];
}

/**
 * Split a day's slots into blocks: consecutive slots with the same non-empty
 * `group` form one superset; everything else is its own single-slot block.
 */
export function slotBlocks(slots: ProgramSlot[]): SlotBlock[] {
  const blocks: SlotBlock[] = [];
  slots.forEach((slot, i) => {
    const prev = blocks[blocks.length - 1];
    if (slot.group && prev?.group === slot.group && prev.indices[prev.indices.length - 1] === i - 1) {
      prev.indices.push(i);
    } else {
      blocks.push({ group: slot.group || undefined, indices: [i] });
    }
  });
  // A "group" of one isn't a superset.
  for (const b of blocks) if (b.indices.length < 2) delete b.group;
  return blocks;
}

/** Index -> superset block, for slots that are in one. */
export function supersetOf(slots: ProgramSlot[]): Map<number, SlotBlock> {
  const out = new Map<number, SlotBlock>();
  for (const b of slotBlocks(slots)) if (b.group) for (const i of b.indices) out.set(i, b);
  return out;
}

/**
 * Re-letter supersets A, B, C... in order and drop the group from any slot left
 * on its own (after a move or delete in the editor). Returns new slot objects.
 */
export function normalizeGroups(slots: ProgramSlot[]): ProgramSlot[] {
  const out = slots.map((s) => {
    const copy = { ...s };
    delete copy.group;
    return copy;
  });
  let n = 0;
  for (const b of slotBlocks(slots)) {
    if (!b.group) continue;
    const letter = String.fromCharCode(65 + (n++ % 26));
    for (const i of b.indices) out[i].group = letter;
  }
  return out;
}

/** "A1", "A2"... for slots in a superset, undefined otherwise. */
export function slotLabel(slots: ProgramSlot[], index: number): string | undefined {
  const b = supersetOf(slots).get(index);
  if (!b?.group) return undefined;
  return `${b.group}${b.indices.indexOf(index) + 1}`;
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
      for (const altId of slot.alternatives ?? []) {
        if (!ids.has(altId)) {
          problems.push(`day "${day.id}" slot ${i} lists unknown alternative "${altId}"`);
        }
      }
    });
    // A superset label must mark one run of 2+ neighbouring slots.
    const seen = new Set<string>();
    for (const b of slotBlocks(day.slots)) {
      const label = day.slots[b.indices[0]].group;
      if (!label) continue;
      if (!b.group) problems.push(`day "${day.id}" superset "${label}" has only one exercise`);
      else if (seen.has(label)) problems.push(`day "${day.id}" superset "${label}" is split up`);
      seen.add(label);
    }
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
