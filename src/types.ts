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

/**
 * One training split (Upper/Lower, Full Body, Push/Pull/Legs, ...). All programs
 * in a file share one exercise library.
 */
export interface Program {
  id: string;
  name: string;
  description: string; // one line: who it's for
  daysPerWeek: string; // "3", "4", "3-6"
  cycle: string[]; // ordered WorkoutDay ids
  days: WorkoutDay[];
}

/** The shape of public/routine.json (schema v2). */
export interface RoutineFile {
  version: number;
  defaultProgramId: string;
  exercises: Exercise[];
  programs: Program[];
}

/**
 * The active program flattened with the shared library — what schedule.ts,
 * suggest.ts and the screens actually consume. An in-app edit (overlay) is a
 * full Routine that replaces this for one program.
 */
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
  skipped?: boolean; // user chose not to do this exercise this session
}

export interface Session {
  id: string; // uuid
  profileId: string;
  dayId: string;
  startedAt: string; // ISO
  finishedAt?: string;
  exercises: ExerciseLog[];
  // cyclePosition just before finishing this session advanced it. Lets a
  // finish be undone (reopen the latest workout rewinds the schedule to here).
  prevCyclePosition?: number;
  // True once finishing this session has advanced the cycle.
  cycleAdvanced?: boolean;
  // True while a previously-finished session is reopened for editing. It keeps
  // its finishedAt (so it still shows in History/Calendar) but also counts as
  // the active session on Today.
  editing?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  bodyweightLb: number;
  experience: Experience;
  unit: "lb"; // kg support later
}

/** Everything that belongs to one local profile. */
export interface ProfileSnapshot {
  profile: Profile;
  sessions: Session[];
  cyclePosition: number;
  activeProgramId: string;
  swaps: Record<string, string>;
  routineOverlays: Record<string, Routine>;
}

export interface AppState {
  schemaVersion: 3;
  // --- which profile is loaded, and the others kept on the side ---
  activeProfileId: string;
  otherProfiles: Record<string, ProfileSnapshot>;
  // --- the active profile's data, kept flat so the rest of the app is
  //     profile-agnostic (switching swaps these out) ---
  profile: Profile;
  sessions: Session[];
  cyclePosition: number; // index into the active program's cycle
  activeProgramId: string; // which Program is selected
  swaps: Record<string, string>; // "dayId:slotIndex" -> exerciseId, persistent swaps
  routineOverlays: Record<string, Routine>; // programId -> in-app edited routine
  // --- device-global ---
  routineFileVersion: number; // last version of routine.json seen
  restStartedAt?: number; // epoch ms the rest stopwatch started; absent = stopped
}
