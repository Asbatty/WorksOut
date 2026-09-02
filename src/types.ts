// Shared data model for the whole app. Kept free of any browser API so the same
// types work in tests, in the PWA, and in a future Capacitor build.

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "smith"
  | "bodyweight"
  | "ez-bar"
  | "kettlebell"
  | "band";

export type Muscle =
  | "chest"
  | "lats"
  | "upper-back"
  | "front-delt"
  | "side-delt"
  | "rear-delt"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "lower-back";

export type Pattern =
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "isolation-arms"
  | "isolation-delts"
  | "isolation-legs"
  | "core";

export type Experience = "beginner" | "intermediate" | "advanced";

/**
 * How the number the user logs relates to the actual load:
 *  - "total": one number is the whole load (barbell, machine, cable, EZ-bar).
 *  - "per-side": the number is one dumbbell / one side (both hands loaded equally).
 *  - "bodyweight": the movement is bodyweight; the number is *added* weight (0 = none).
 *  - "assisted": machine assistance; the number is how much weight is *taken off*.
 */
export type LoadType = "total" | "per-side" | "bodyweight" | "assisted";

/** Starting-load ratios as a fraction of bodyweight, one per experience level. */
export interface RatioSet {
  beginner: number;
  intermediate: number;
  advanced: number;
}

export interface Exercise {
  id: string; // slug, e.g. "db-incline-press"
  name: string;
  equipment: Equipment[]; // everything required
  primary: Muscle[];
  secondary?: Muscle[];
  pattern: Pattern;
  cue: string; // 1-2 sentences
  loadType: LoadType;
  increment: number; // smallest sensible weight jump in lb
  // Starting-weight ratio to bodyweight for the midpoint of this exercise's rep
  // range, per experience level. See suggest.ts / build-plan section 6.
  ratio: RatioSet;
  alternatives: string[]; // ordered exercise ids, best substitute first
}

export interface ProgramSlot {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface WorkoutDay {
  id: string; // "upper-a"
  name: string; // "Upper A"
  slots: ProgramSlot[];
}

export interface Routine {
  version: number;
  name: string;
  cycle: string[]; // ordered WorkoutDay ids
  days: WorkoutDay[];
  exercises: Exercise[];
}

export interface SetLog {
  weight: number;
  reps: number;
  done?: boolean; // user ticked this set off during the workout
}

export interface ExerciseLog {
  exerciseId: string; // the exercise actually performed (after any swap)
  slotExerciseId: string; // the exercise the slot originally called for
  sets: SetLog[];
  note?: string;
}

export interface Session {
  id: string; // uuid
  profileId: string;
  dayId: string;
  startedAt: string; // ISO
  finishedAt?: string;
  exercises: ExerciseLog[];
}

export interface Profile {
  id: string;
  name: string;
  bodyweightLb: number;
  experience: Experience;
  unit: "lb"; // kg support later
}

export interface AppState {
  schemaVersion: 1;
  profile: Profile;
  sessions: Session[];
  cyclePosition: number; // index into routine.cycle of the next workout
  swaps: Record<string, string>; // "dayId:slotIndex" -> exerciseId, persistent swaps
  routineOverlay?: Routine; // in-app edited routine, wins over routine.json
  routineFileVersion: number; // last version of routine.json seen
}
