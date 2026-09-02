// Sanity-checks public/routine.json: every referenced id exists, rep ranges are
// valid, alternatives chain. Run: node scripts/validate-routine.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "routine.json");
const routine = JSON.parse(readFileSync(file, "utf8"));

const problems = [];
const ids = new Set(routine.exercises.map((e) => e.id));

if (!routine.cycle?.length) problems.push("cycle is empty");
for (const dayId of routine.cycle) {
  if (!routine.days.some((d) => d.id === dayId)) problems.push(`cycle references unknown day "${dayId}"`);
}
for (const day of routine.days) {
  if (!day.slots?.length) problems.push(`day "${day.id}" has no slots`);
  day.slots.forEach((slot, i) => {
    if (!ids.has(slot.exerciseId)) problems.push(`day "${day.id}" slot ${i}: unknown exercise "${slot.exerciseId}"`);
    if (slot.repMin < 1 || slot.repMax < slot.repMin) problems.push(`day "${day.id}" slot ${i}: bad rep range ${slot.repMin}-${slot.repMax}`);
    if (slot.sets < 1) problems.push(`day "${day.id}" slot ${i}: ${slot.sets} sets`);
  });
}
const LOAD_TYPES = new Set(["total", "per-side", "bodyweight", "assisted"]);
for (const ex of routine.exercises) {
  for (const altId of ex.alternatives) {
    if (!ids.has(altId)) problems.push(`exercise "${ex.id}": unknown alternative "${altId}"`);
  }
  if (!LOAD_TYPES.has(ex.loadType)) problems.push(`exercise "${ex.id}": bad loadType "${ex.loadType}"`);
  for (const lvl of ["beginner", "intermediate", "advanced"]) {
    if (typeof ex.ratio?.[lvl] !== "number") problems.push(`exercise "${ex.id}": ratio.${lvl} missing`);
  }
  if (!(ex.increment > 0)) problems.push(`exercise "${ex.id}": increment must be > 0`);
}

if (problems.length) {
  console.error(`routine.json: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`routine.json OK: ${routine.exercises.length} exercises, ${routine.days.length} days, cycle of ${routine.cycle.length}`);
