// Searchable single-select list of exercises from the library. Used by the
// Editor to replace or add a slot's exercise.

import { useMemo, useState } from "react";
import type { Exercise } from "../types";

interface Props {
  exercises: Exercise[];
  onPick: (id: string) => void;
  onCancel: () => void;
  title?: string;
}

export function ExercisePicker({ exercises, onPick, onCancel, title = "Choose exercise" }: Props) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? exercises.filter(
          (e) =>
            e.name.toLowerCase().includes(needle) ||
            e.primary.some((m) => m.includes(needle)) ||
            e.equipment.some((eq) => eq.includes(needle))
        )
      : exercises;
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
  }, [q, exercises]);

  return (
    <div className="sheet">
      <p className="sheet-title">{title}</p>
      <input
        className="search-input"
        placeholder="Search name, muscle, equipment"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="picker-list">
        {results.map((e) => (
          <button key={e.id} className="sheet-item" onClick={() => onPick(e.id)}>
            <span className="ex-name">{e.name}</span>
            <span className="equip-tags">
              {e.equipment.map((eq) => (
                <span key={eq} className="equip-tag">
                  {eq}
                </span>
              ))}
            </span>
          </button>
        ))}
        {results.length === 0 && <p className="dim small">No matches.</p>}
      </div>
      <button className="ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
