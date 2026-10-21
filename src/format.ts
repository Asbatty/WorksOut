// Display helpers shared by every screen that prints a set or a rep target, so
// timed holds ("25 s") and no-weight moves ("8 reps") read right everywhere.

import type { Exercise, ProgramSlot, SetLog } from "./types";

/** What the reps number counts: "reps" or "s". */
export function repUnit(ex: Exercise | undefined): string {
  return ex?.measure === "seconds" ? "s" : "reps";
}

/** Stepper label for the reps field. */
export function repLabel(ex: Exercise | undefined): string {
  return ex?.measure === "seconds" ? "Seconds" : "Reps";
}

export function weightUnit(ex: Exercise | undefined): string {
  return ex?.loadType === "assisted" ? "assist" : "lb";
}

/** "3 × 8–12", "3 × 20–30 s /side", "3 × 8 /side". */
export function targetText(
  ex: Exercise | undefined,
  slot: Pick<ProgramSlot, "repMin" | "repMax">,
  sets: number
): string {
  const range = slot.repMin === slot.repMax ? `${slot.repMin}` : `${slot.repMin}–${slot.repMax}`;
  const unit = ex?.measure === "seconds" ? " s" : "";
  const side = ex?.eachSide ? " /side" : "";
  return `${sets} × ${range}${unit}${side}`;
}

/** One logged set: "135 lb × 8", "8 reps", "25 s", "20 lb × 10". */
export function formatSet(ex: Exercise | undefined, set: Pick<SetLog, "weight" | "reps">): string {
  const count = ex?.measure === "seconds" ? `${set.reps} s` : `${set.reps}`;
  if (ex?.noWeight) return ex.measure === "seconds" ? count : `${set.reps} reps`;
  return `${set.weight} ${weightUnit(ex)} × ${count}`;
}
