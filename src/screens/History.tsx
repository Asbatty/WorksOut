import { useState } from "react";
import { navigate } from "../router";
import { useRoutine } from "../useRoutine";
import { useAppState } from "../store";
import { findDay, findExercise } from "../routine";
import { formatSessionDate } from "./SessionView";

export function History() {
  const { routine } = useRoutine();
  const state = useAppState();
  const [open, setOpen] = useState<string | null>(null);

  // Newest first. Include unfinished (there is at most one) so it isn't hidden.
  const sessions = [...state.sessions].sort((a, b) =>
    (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt)
  );

  if (sessions.length === 0) {
    return (
      <>
        <h1>History</h1>
        <p className="dim">No workouts logged yet.</p>
      </>
    );
  }

  return (
    <>
      <h1>History</h1>
      <p className="dim small">
        {sessions.filter((s) => s.finishedAt).length} completed
      </p>

      <div className="exercise-list">
        {sessions.map((s) => {
          const day = routine ? findDay(routine, s.dayId) : undefined;
          const isOpen = open === s.id;
          const totalSets = s.exercises.reduce((n, l) => n + l.sets.length, 0);
          return (
            <div key={s.id} className="card">
              <button
                className="disclosure"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.id)}
              >
                <span className={isOpen ? "caret open" : "caret"}>▸</span>
                <span>
                  <span className="ex-name">{day?.name ?? s.dayId}</span>
                  <span className="dim small block">
                    {formatSessionDate(s.finishedAt ?? s.startedAt)}
                    {!s.finishedAt && " · in progress"}
                    {" · "}
                    {totalSets} set{totalSets === 1 ? "" : "s"}
                  </span>
                </span>
              </button>

              {isOpen && (
                <>
                  {s.exercises.map((log, i) => {
                    const ex = routine ? findExercise(routine, log.exerciseId) : undefined;
                    return (
                      <div key={i} className="history-item">
                        <span className="ex-name small">
                          {ex?.name ?? log.exerciseId}
                          {log.exerciseId !== log.slotExerciseId && (
                            <span className="swapped-tag">swapped</span>
                          )}
                        </span>
                        <span className="history-sets">
                          {log.sets.map((st, j) => (
                            <span key={j} className="set-pill">
                              {st.weight}
                              {ex?.loadType === "assisted" ? " assist" : " lb"} × {st.reps}
                            </span>
                          ))}
                        </span>
                        {log.note && <span className="history-note">{log.note}</span>}
                      </div>
                    );
                  })}
                  <button
                    className="ghost small"
                    onClick={() => navigate(`#/session/${s.id}`)}
                  >
                    Open full view
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
