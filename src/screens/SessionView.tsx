import { navigate } from "../router";
import { useRoutine } from "../useRoutine";
import { sessionById, useAppState } from "../store";
import { findDay, findExercise } from "../routine";

export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function SessionView({ id }: { id: string }) {
  const { routine } = useRoutine();
  const state = useAppState();
  const session = sessionById(id, state);

  if (!session) {
    return (
      <>
        <BackLink />
        <h1>Session not found</h1>
      </>
    );
  }

  const day = routine ? findDay(routine, session.dayId) : undefined;
  const totalSets = session.exercises.reduce((n, l) => n + l.sets.length, 0);

  return (
    <>
      <BackLink />
      <h1>{day?.name ?? session.dayId}</h1>
      <p className="dim">
        {formatSessionDate(session.finishedAt ?? session.startedAt)}
        {!session.finishedAt && " · not finished"}
        {" · "}
        {totalSets} set{totalSets === 1 ? "" : "s"}
      </p>

      {session.exercises.map((log, i) => {
        const ex = routine ? findExercise(routine, log.exerciseId) : undefined;
        return (
          <div key={i} className="card">
            <button
              className="link-title"
              onClick={() => navigate(`#/exercise/${log.exerciseId}`)}
            >
              {ex?.name ?? log.exerciseId}
            </button>
            {log.exerciseId !== log.slotExerciseId && (
              <span className="swapped-tag">swapped</span>
            )}
            <div className="history-sets session-sets">
              {log.sets.map((s, j) => (
                <span key={j} className="set-pill">
                  {s.weight}
                  {ex?.loadType === "assisted" ? " assist" : " lb"} × {s.reps}
                </span>
              ))}
            </div>
            {log.note && <p className="history-note">{log.note}</p>}
          </div>
        );
      })}
    </>
  );
}

function BackLink() {
  return (
    <button
      className="back-link"
      onClick={() =>
        window.history.length > 1 ? window.history.back() : navigate("#/history")
      }
    >
      ‹ Back
    </button>
  );
}
