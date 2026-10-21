// Sanity-checks public/routine.json (schema v2): shared exercise library, one or
// more programs, every referenced id resolvable, rep ranges valid, alternatives
// chain, day ids unique across programs. Run: node scripts/validate-routine.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "routine.json");
const routine = JSON.parse(readFileSync(file, "utf8"));

const problems = [];
const ids = new Set(routine.exercises.map((e) => e.id));

if (!Array.isArray(routine.programs) || routine.programs.length === 0) {
  problems.push("no programs");
}
if (!routine.programs?.some((p) => p.id === routine.defaultProgramId)) {
  problems.push(`defaultProgramId "${routine.defaultProgramId}" is not a program`);
}

const seenDayIds = new Set();
let dayCount = 0;
for (const prog of routine.programs ?? []) {
  if (!prog.id || !prog.name) problems.push(`a program is missing id/name`);
  if (!prog.cycle?.length) problems.push(`program "${prog.id}" has an empty cycle`);
  for (const dayId of prog.cycle ?? []) {
    if (!prog.days.some((d) => d.id === dayId))
      problems.push(`program "${prog.id}" cycle references unknown day "${dayId}"`);
  }
  for (const day of prog.days ?? []) {
    dayCount++;
    if (seenDayIds.has(day.id)) problems.push(`duplicate day id "${day.id}"`);
    seenDayIds.add(day.id);
    if (!day.slots?.length) problems.push(`day "${day.id}" has no slots`);
    day.slots.forEach((slot, i) => {
      if (!ids.has(slot.exerciseId))
        problems.push(`${prog.id}/${day.id} slot ${i}: unknown exercise "${slot.exerciseId}"`);
      if (slot.repMin < 1 || slot.repMax < slot.repMin)
        problems.push(`${prog.id}/${day.id} slot ${i}: bad rep range ${slot.repMin}-${slot.repMax}`);
      if (slot.sets < 1) problems.push(`${prog.id}/${day.id} slot ${i}: ${slot.sets} sets`);
      for (const altId of slot.alternatives ?? []) {
        if (!ids.has(altId))
          problems.push(`${prog.id}/${day.id} slot ${i}: unknown alternative "${altId}"`);
      }
    });
    // Supersets: each group label marks one run of 2+ neighbouring slots.
    const runs = [];
    day.slots.forEach((slot, i) => {
      const last = runs[runs.length - 1];
      if (slot.group && last?.group === slot.group) last.size++;
      else runs.push({ group: slot.group, size: 1 });
    });
    const seenGroups = new Set();
    for (const r of runs) {
      if (!r.group) continue;
      if (r.size < 2) problems.push(`${prog.id}/${day.id}: superset "${r.group}" has one exercise`);
      if (seenGroups.has(r.group)) problems.push(`${prog.id}/${day.id}: superset "${r.group}" is split up`);
      seenGroups.add(r.group);
    }
    for (const k of ["warmup", "finisher", "cooldown"]) {
      if (day[k] !== undefined && !(Array.isArray(day[k]) && day[k].every((x) => typeof x === "string" && x.trim())))
        problems.push(`${prog.id}/${day.id}: ${k} must be a list of non-empty strings`);
    }
  }
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
  if (ex.measure !== undefined && !["reps", "seconds"].includes(ex.measure))
    problems.push(`exercise "${ex.id}": bad measure "${ex.measure}"`);
}

if (problems.length) {
  console.error(`routine.json: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(
  `routine.json OK: ${routine.exercises.length} exercises, ` +
    `${routine.programs.length} programs, ${dayCount} days`
);
