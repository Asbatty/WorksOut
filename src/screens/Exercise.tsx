import { navigate } from "../router";
import { useRoutine } from "../useRoutine";
import { useAppState } from "../store";
import { findExercise, getAlternatives } from "../routine";
import { exerciseHistory, topSet } from "../history";
import { Chart } from "../components/Chart";
import type { Equipment } from "../types";

const EQUIP_LABEL: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine: "Machine",
  smith: "Smith",
  bodyweight: "Bodyweight",
  "ez-bar": "EZ-bar",
  kettlebell: "Kettlebell",
  band: "Band"
};

function muscleLabel(m: string) {
  return m.replace(/-/g, " ");
}

function youtubeSearch(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " form")}`;
}

export function Exercise({ id }: { id: string }) {
  const { routine, loading } = useRoutine();
  const state = useAppState();

  if (!routine) return <p>{loading ? "Loading…" : "Routine unavailable."}</p>;

  const ex = findExercise(routine, id);
  if (!ex) {
    return (
      <>
        <BackLink />
        <h1>Unknown exercise</h1>
        <p className="mono">{id}</p>
      </>
    );
  }

  const history = exerciseHistory(state.sessions, id);
  const chartPoints = history.map((h) => ({
    date: h.date,
    value: topSet(h.sets).weight
  }));
  const alternatives = getAlternatives(routine, id);
  const unit = ex.loadType === "assisted" ? " assist" : " lb";

  return (
    <>
      <BackLink />
      <h1>{ex.name}</h1>

      <div className="tag-row">
        {ex.equipment.map((e) => (
          <span key={e} className="chip">
            {EQUIP_LABEL[e]}
          </span>
        ))}
      </div>

      <h2>Muscles</h2>
      <div className="tag-row">
        {ex.primary.map((m) => (
          <span key={m} className="chip strong">
            {muscleLabel(m)}
          </span>
        ))}
        {(ex.secondary ?? []).map((m) => (
          <span key={m} className="chip">
            {muscleLabel(m)}
          </span>
        ))}
      </div>

      <h2>Form cue</h2>
      <p className="cue">{ex.cue}</p>

      <button
        className="primary"
        onClick={() => window.open(youtubeSearch(ex.name), "_blank", "noopener,noreferrer")}
      >
        Watch on YouTube
      </button>

      <h2>History</h2>
      {history.length === 0 ? (
        <p className="dim">No logged sessions for this exercise yet.</p>
      ) : (
        <>
          <Chart points={chartPoints} unit="lb" />
          <ul className="history-list">
            {[...history].reverse().map((h) => (
              <li key={h.sessionId} className="history-item">
                <button
                  className="history-date"
                  onClick={() => navigate(`#/session/${h.sessionId}`)}
                >
                  {new Date(h.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                  })}
                </button>
                <span className="history-sets">
                  {h.sets.map((s, i) => (
                    <span key={i} className="set-pill">
                      {s.weight}
                      {unit} × {s.reps}
                    </span>
                  ))}
                </span>
                {h.note && <span className="history-note">{h.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {alternatives.length > 0 && (
        <>
          <h2>Alternatives</h2>
          <ul className="alt-list">
            {alternatives.map((a) => (
              <li key={a.id}>
                <button className="alt-item" onClick={() => navigate(`#/exercise/${a.id}`)}>
                  <span>{a.name}</span>
                  <span className="equip-tags">
                    {a.equipment.map((e) => (
                      <span key={e} className="equip-tag">
                        {e}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function BackLink() {
  return (
    <button
      className="back-link"
      onClick={() => (window.history.length > 1 ? window.history.back() : navigate("#/today"))}
    >
      ‹ Back
    </button>
  );
}
