// Weight suggestion logic. Every rule here comes straight from build-plan
// section 6. Kept deliberately verbose and side-effect free so it's easy to
// read and easy to unit test.
//
// Vocabulary:
//   - "the number" = the value the user types/steps in the app. What it means
//     physically depends on exercise.loadType (see types.ts).
//   - BW = the profile's bodyweight in lb.
//   - rep range = the slot's repMin..repMax.

import type { Exercise, Profile, ProgramSlot, SetLog } from "./types";
import { averageReps, isWorkingSet, type HistoryEntry } from "./history";

// --- rounding ---------------------------------------------------------------

/** Nearest multiple of `inc` (never below 0). */
export function roundToIncrement(weight: number, inc: number): number {
  if (inc <= 0) return Math.max(0, Math.round(weight));
  return Math.max(0, Math.round(weight / inc) * inc);
}

/** Largest multiple of `inc` that is <= weight (never below 0). */
export function floorToIncrement(weight: number, inc: number): number {
  if (inc <= 0) return Math.max(0, Math.floor(weight));
  return Math.max(0, Math.floor(weight / inc) * inc);
}

// --- starting weight (no history for this exercise yet) --------------------

/**
 * First-ever suggestion for an exercise: the experience-level ratio times
 * bodyweight, then floored to the exercise's increment. For bodyweight and
 * assisted movements the ratio expresses added / removed load respectively, so
 * the maths is the same and the UI label ("+X" / "-X assist") does the rest.
 */
export function startingWeight(exercise: Exercise, profile: Profile): number {
  const ratio = exercise.ratio[profile.experience];
  const raw = ratio * profile.bodyweightLb;
  return floorToIncrement(raw, exercise.increment);
}

// --- correction after the very first logged session -----------------------

/**
 * After one real session we replace the guess with something grounded in what
 * actually happened. `w` is the weight used, `r` the average reps across the
 * working sets. (build-plan section 6, "After the first logged session".)
 */
export function correctAfterFirstSession(
  exercise: Exercise,
  slot: Pick<ProgramSlot, "repMin" | "repMax">,
  w: number,
  r: number
): number {
  const inc = exercise.increment;
  if (r > slot.repMax + 2) return roundToIncrement(w * 1.1, inc); // way too easy
  if (r > slot.repMax) return w + inc; // a bit too easy
  if (r < slot.repMin - 1) return floorToIncrement(w * 0.9, inc); // too heavy
  return w; // about right
}

// --- double progression (build-plan section 6) ---------------------------

export interface WeightSuggestion {
  weight: number;
  /** What to aim for on reps this session. */
  repTarget: "repMin" | "beat-last" | "hold";
  /** Short explanation shown under the number in the UI. */
  reason: string;
  /** True until the exercise has a real logged session behind it. */
  isGuess: boolean;
}

/** Did every working set reach at least `target` reps? */
function allWorkingSetsReached(sets: SetLog[], target: number): boolean {
  const working = sets.filter(isWorkingSet);
  return working.length > 0 && working.every((s) => s.reps >= target);
}

/** Did any working set come in under `min` reps? */
function anyWorkingSetBelow(sets: SetLog[], min: number): boolean {
  return sets.filter(isWorkingSet).some((s) => s.reps < min);
}

/**
 * The suggestion to show for a slot's exercise, given that exercise's own
 * history (oldest first) and the current profile.
 *
 *   0 sessions  -> starting guess from the ratio.
 *   1 session   -> one-off correction from how that session went.
 *   2+ sessions -> double progression: hold the weight and chase reps within
 *                  repMin..repMax; add a plate once every set hits repMax; drop
 *                  a plate only after two sessions running below repMin.
 */
export function suggestWeight(
  exercise: Exercise,
  slot: Pick<ProgramSlot, "repMin" | "repMax">,
  profile: Profile,
  history: HistoryEntry[]
): WeightSuggestion {
  if (exercise.noWeight) return suggestNoWeight(exercise, slot, history);

  if (history.length === 0) {
    return {
      weight: startingWeight(exercise, profile),
      repTarget: "hold",
      reason: "Starting guess from bodyweight and experience",
      isGuess: true
    };
  }

  const last = history[history.length - 1];
  const lastWeight = mostCommonWeight(last);

  if (history.length === 1) {
    const lastAvgReps = averageReps(last.sets);
    const corrected = correctAfterFirstSession(exercise, slot, lastWeight, lastAvgReps);
    return {
      weight: corrected,
      repTarget: corrected > lastWeight ? "repMin" : "beat-last",
      reason:
        corrected === lastWeight
          ? "Matched your first session"
          : corrected > lastWeight
            ? "First session went well, nudging up"
            : "First session was heavy, easing off",
      isGuess: false
    };
  }

  const inc = exercise.increment;

  // Every set reached the top of the range: add load, reset reps to the bottom.
  // Unless the jump is too big to land inside the range (light dumbbell / cable
  // work, where +5 lb can be +33%): then keep the weight and build reps past
  // repMax until the heavier weight is reachable. Without this the app loops
  // 15 -> 20 -> miss, miss -> 15 -> 20 ...
  if (allWorkingSetsReached(last.sets, slot.repMax)) {
    const gate = jumpGate(exercise, slot, lastWeight, minWorkingReps(last.sets));
    if (gate) {
      return {
        weight: lastWeight,
        repTarget: "beat-last",
        reason: `+${inc} is a big jump here — build to ${gate.repsNeeded} reps first`,
        isGuess: false
      };
    }
    return {
      weight: lastWeight + inc,
      repTarget: "repMin",
      reason: `Hit ${slot.repMax} on every set — adding ${inc}`,
      isGuess: false
    };
  }

  // A set fell below the range. Repeat the weight; only deload if it also
  // happened the session before.
  if (anyWorkingSetBelow(last.sets, slot.repMin)) {
    const prev = history[history.length - 2];
    if (anyWorkingSetBelow(prev.sets, slot.repMin)) {
      return {
        weight: floorToIncrement(Math.max(0, lastWeight - inc), inc),
        repTarget: "hold",
        reason: `Below ${slot.repMin} reps two sessions running — dropping ${inc}`,
        isGuess: false
      };
    }
    return {
      weight: lastWeight,
      repTarget: "hold",
      reason: `A set dipped below ${slot.repMin} — repeat this weight`,
      isGuess: false
    };
  }

  // Somewhere inside the range: same weight, try to beat last time's reps.
  return {
    weight: lastWeight,
    repTarget: "beat-last",
    reason: "Same weight — beat last session's reps",
    isGuess: false
  };
}

// --- big-jump gate ----------------------------------------------------------

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Reps Epley predicts at `weight` for a given e1RM (may be fractional / negative). */
export function predictedReps(oneRm: number, weight: number): number {
  return 30 * (oneRm / weight - 1);
}

function minWorkingReps(sets: SetLog[]): number {
  return Math.min(...sets.filter(isWorkingSet).map((s) => s.reps));
}

/**
 * Should we hold off adding an increment? Uses the weakest working set's e1RM:
 * if it predicts fewer than repMin - 1 reps at the next weight, the jump is too
 * big. Returns the reps needed at the current weight before jumping, or null
 * if the jump is fine. Only applies to loaded movements ("total" / "per-side")
 * with a non-zero weight.
 */
export function jumpGate(
  exercise: Exercise,
  slot: Pick<ProgramSlot, "repMin" | "repMax">,
  weight: number,
  reps: number
): { repsNeeded: number } | null {
  if (exercise.loadType !== "total" && exercise.loadType !== "per-side") return null;
  const next = weight + exercise.increment;
  if (weight <= 0 || exercise.increment <= 0) return null;
  const target = slot.repMin - 1;
  if (predictedReps(e1rm(weight, reps), next) >= target) return null;
  // Smallest whole rep count at `weight` whose e1RM supports `target` at `next`.
  const repsNeeded = Math.ceil(predictedReps(e1rm(next, target), weight) - 1e-9);
  return { repsNeeded: Math.max(repsNeeded, reps + 1) };
}

/**
 * Moves with no load to log (dead bug, bird dog, side plank, band work). The
 * weight is always 0; progress means chasing reps/seconds through the range,
 * then moving to a harder version once every set hits the top.
 */
function suggestNoWeight(
  exercise: Exercise,
  slot: Pick<ProgramSlot, "repMin" | "repMax">,
  history: HistoryEntry[]
): WeightSuggestion {
  const unit = exercise.measure === "seconds" ? "s" : " reps";
  if (history.length === 0) {
    return {
      weight: 0,
      repTarget: "hold",
      reason: `No weight — aim for ${slot.repMin}–${slot.repMax}${unit} with clean form`,
      isGuess: true
    };
  }
  const last = history[history.length - 1];
  if (allWorkingSetsReached(last.sets, slot.repMax)) {
    return {
      weight: 0,
      repTarget: "hold",
      reason: `Hit ${slot.repMax}${unit} on every set — ready for a harder version`,
      isGuess: false
    };
  }
  return {
    weight: 0,
    repTarget: "beat-last",
    reason: exercise.measure === "seconds" ? "Beat last session's hold" : "Beat last session's reps",
    isGuess: false
  };
}

/**
 * The weight the user actually worked with in a session. Sets in one session are
 * usually the same weight; if they differ we take the one used most (ties -> the
 * heaviest) so a light back-off set doesn't drag the number down.
 */
export function mostCommonWeight(entry: HistoryEntry): number {
  const counts = new Map<number, number>();
  for (const s of entry.sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  let bestWeight = 0;
  let bestCount = -1;
  for (const [weight, count] of counts) {
    if (count > bestCount || (count === bestCount && weight > bestWeight)) {
      bestWeight = weight;
      bestCount = count;
    }
  }
  return bestWeight;
}
