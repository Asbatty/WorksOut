import { useState } from "react";
import { useRoutine } from "../useRoutine";
import { setRoutineOverlay, useAppState } from "../store";
import { validateRoutine } from "../routine";
import { Stepper } from "../components/Stepper";
import { ExercisePicker } from "../components/ExercisePicker";
import type { Equipment, Exercise, Muscle, Pattern, Routine } from "../types";

const EQUIPMENT: Equipment[] = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "bodyweight",
  "ez-bar",
  "kettlebell",
  "band"
];
const MUSCLES: Muscle[] = [
  "chest",
  "lats",
  "upper-back",
  "front-delt",
  "side-delt",
  "rear-delt",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "lower-back"
];
const PATTERNS: Pattern[] = [
  "horizontal-push",
  "vertical-push",
  "horizontal-pull",
  "vertical-pull",
  "squat",
  "hinge",
  "lunge",
  "isolation-arms",
  "isolation-delts",
  "isolation-legs",
  "core"
];

function clone(r: Routine): Routine {
  return JSON.parse(JSON.stringify(r)) as Routine;
}

/** Days are edited as one ordered list; the cycle mirrors that order (one
 *  entry per day). Repeating a day in a cycle isn't exposed in v1. */
function syncCycle(r: Routine): Routine {
  r.cycle = r.days.map((d) => d.id);
  return r;
}

function slugify(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "exercise";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

export function Editor() {
  const { routine } = useRoutine();
  useAppState(); // re-render when the overlay changes
  const [pickerFor, setPickerFor] = useState<
    { dayId: string; slotIndex: number | "add" } | null
  >(null);
  const [showCustom, setShowCustom] = useState(false);

  if (!routine) return <p>Loading routine…</p>;

  const commit = (next: Routine) => setRoutineOverlay(syncCycle(next));
  const problems = validateRoutine(routine);

  // --- day ops ---
  const renameDay = (dayId: string, name: string) => {
    const r = clone(routine);
    const d = r.days.find((x) => x.id === dayId);
    if (d) d.name = name;
    commit(r);
  };
  const moveDay = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= routine.days.length) return;
    const r = clone(routine);
    [r.days[index], r.days[j]] = [r.days[j], r.days[index]];
    commit(r);
  };
  const addDay = () => {
    const r = clone(routine);
    const taken = new Set(r.days.map((d) => d.id));
    const id = slugify(`day ${r.days.length + 1}`, taken);
    r.days.push({ id, name: `Day ${r.days.length + 1}`, slots: [] });
    commit(r);
  };
  const deleteDay = (dayId: string) => {
    if (routine.days.length <= 1) return;
    const r = clone(routine);
    r.days = r.days.filter((d) => d.id !== dayId);
    commit(r);
  };

  // --- slot ops ---
  const moveSlot = (dayId: string, i: number, dir: -1 | 1) => {
    const r = clone(routine);
    const d = r.days.find((x) => x.id === dayId);
    if (!d) return;
    const j = i + dir;
    if (j < 0 || j >= d.slots.length) return;
    [d.slots[i], d.slots[j]] = [d.slots[j], d.slots[i]];
    commit(r);
  };
  const setSlot = (
    dayId: string,
    i: number,
    patch: Partial<{ sets: number; repMin: number; repMax: number; exerciseId: string }>
  ) => {
    const r = clone(routine);
    const d = r.days.find((x) => x.id === dayId);
    if (!d) return;
    d.slots[i] = { ...d.slots[i], ...patch };
    // Keep the rep range coherent.
    if (d.slots[i].repMax < d.slots[i].repMin) d.slots[i].repMax = d.slots[i].repMin;
    commit(r);
  };
  const removeSlot = (dayId: string, i: number) => {
    const r = clone(routine);
    const d = r.days.find((x) => x.id === dayId);
    if (!d) return;
    d.slots.splice(i, 1);
    commit(r);
  };
  const addSlot = (dayId: string, exerciseId: string) => {
    const r = clone(routine);
    const d = r.days.find((x) => x.id === dayId);
    if (!d) return;
    d.slots.push({ exerciseId, sets: 3, repMin: 8, repMax: 12 });
    commit(r);
  };

  const addCustomExercise = (ex: Exercise) => {
    const r = clone(routine);
    r.exercises.push(ex);
    commit(r);
  };

  return (
    <>
      <h1>Routine editor</h1>
      <div className="edit-banner">
        Editing a local copy. Reset to file in Settings to discard.
      </div>
      {problems.length > 0 && (
        <div className="edit-banner warn">
          {problems.length} issue{problems.length === 1 ? "" : "s"}: {problems[0]}
        </div>
      )}

      {routine.days.map((day, di) => (
        <div key={day.id} className="card day-card">
          <div className="day-card-head">
            <input
              className="day-name-input"
              value={day.name}
              onChange={(e) => renameDay(day.id, e.target.value)}
              aria-label="Day name"
            />
            <div className="row-btns">
              <button className="mini" aria-label="Move day up" onClick={() => moveDay(di, -1)}>
                ↑
              </button>
              <button className="mini" aria-label="Move day down" onClick={() => moveDay(di, 1)}>
                ↓
              </button>
              <button
                className="mini danger"
                aria-label="Delete day"
                disabled={routine.days.length <= 1}
                onClick={() => deleteDay(day.id)}
              >
                ✕
              </button>
            </div>
          </div>

          {day.slots.map((slot, si) => {
            const ex = routine.exercises.find((x) => x.id === slot.exerciseId);
            return (
              <div key={si} className="slot-row">
                <div className="slot-top">
                  <button
                    className="slot-ex"
                    onClick={() => setPickerFor({ dayId: day.id, slotIndex: si })}
                  >
                    {ex?.name ?? slot.exerciseId} <span className="dim">change</span>
                  </button>
                  <div className="row-btns">
                    <button className="mini" aria-label="Move up" onClick={() => moveSlot(day.id, si, -1)}>
                      ↑
                    </button>
                    <button className="mini" aria-label="Move down" onClick={() => moveSlot(day.id, si, 1)}>
                      ↓
                    </button>
                    <button
                      className="mini danger"
                      aria-label="Remove slot"
                      onClick={() => removeSlot(day.id, si)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="slot-steppers">
                  <Stepper
                    label="Sets"
                    value={slot.sets}
                    step={1}
                    min={1}
                    onChange={(v) => setSlot(day.id, si, { sets: v })}
                  />
                  <Stepper
                    label="Min reps"
                    value={slot.repMin}
                    step={1}
                    min={1}
                    onChange={(v) => setSlot(day.id, si, { repMin: v })}
                  />
                  <Stepper
                    label="Max reps"
                    value={slot.repMax}
                    step={1}
                    min={1}
                    onChange={(v) => setSlot(day.id, si, { repMax: v })}
                  />
                </div>
              </div>
            );
          })}

          <button
            className="ghost add-slot"
            onClick={() => setPickerFor({ dayId: day.id, slotIndex: "add" })}
          >
            + Add exercise
          </button>
        </div>
      ))}

      <div className="action-stack">
        <button className="ghost" onClick={addDay}>
          + Add day
        </button>
        <button className="ghost" onClick={() => setShowCustom(true)}>
          + Add custom exercise to library
        </button>
      </div>

      {pickerFor && (
        <div className="modal-scrim" onClick={() => setPickerFor(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ExercisePicker
              exercises={routine.exercises}
              title={pickerFor.slotIndex === "add" ? "Add exercise" : "Replace exercise"}
              onCancel={() => setPickerFor(null)}
              onPick={(id) => {
                if (pickerFor.slotIndex === "add") addSlot(pickerFor.dayId, id);
                else setSlot(pickerFor.dayId, pickerFor.slotIndex, { exerciseId: id });
                setPickerFor(null);
              }}
            />
          </div>
        </div>
      )}

      {showCustom && (
        <div className="modal-scrim" onClick={() => setShowCustom(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CustomExerciseForm
              takenIds={new Set(routine.exercises.map((e) => e.id))}
              onCancel={() => setShowCustom(false)}
              onCreateSlug={slugify}
              onAdd={(ex) => {
                addCustomExercise(ex);
                setShowCustom(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function CustomExerciseForm({
  takenIds,
  onAdd,
  onCancel,
  onCreateSlug
}: {
  takenIds: Set<string>;
  onAdd: (ex: Exercise) => void;
  onCancel: () => void;
  onCreateSlug: (name: string, taken: Set<string>) => string;
}) {
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [pattern, setPattern] = useState<Pattern>("isolation-arms");
  const [cue, setCue] = useState("");
  const [increment, setIncrement] = useState(5);

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const valid = name.trim().length > 0 && primary.length > 0 && equipment.length > 0;

  return (
    <div className="sheet">
      <p className="sheet-title">New exercise</p>

      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <span className="field-label">Equipment</span>
      <div className="chip-toggle-grid">
        {EQUIPMENT.map((e) => (
          <button
            key={e}
            className={equipment.includes(e) ? "chip-toggle on" : "chip-toggle"}
            onClick={() => toggle(equipment, e, setEquipment)}
          >
            {e}
          </button>
        ))}
      </div>

      <span className="field-label">Primary muscles</span>
      <div className="chip-toggle-grid">
        {MUSCLES.map((m) => (
          <button
            key={m}
            className={primary.includes(m) ? "chip-toggle on" : "chip-toggle"}
            onClick={() => toggle(primary, m, setPrimary)}
          >
            {m.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Pattern</span>
        <select value={pattern} onChange={(e) => setPattern(e.target.value as Pattern)}>
          {PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p.replace(/-/g, " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Form cue</span>
        <textarea rows={3} value={cue} onChange={(e) => setCue(e.target.value)} />
      </label>

      <div className="field">
        <span>Smallest weight jump (lb)</span>
        <Stepper label="Increment" value={increment} step={5} min={5} onChange={setIncrement} />
      </div>

      <p className="dim small">
        New exercises start with no suggested weight (ratio 0) and load type
        "total" — you just enter the weight each set. Edit routine.json for full
        control.
      </p>

      <div className="confirm-actions">
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={!valid}
          onClick={() =>
            onAdd({
              id: onCreateSlug(name, takenIds),
              name: name.trim(),
              equipment,
              primary,
              secondary: [],
              pattern,
              cue: cue.trim() || "No cue yet.",
              loadType: "total",
              increment,
              ratio: { beginner: 0, intermediate: 0, advanced: 0 },
              alternatives: []
            })
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}
