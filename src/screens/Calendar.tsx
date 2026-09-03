import { useMemo, useState } from "react";
import { navigate } from "../router";
import { useRoutine } from "../useRoutine";
import { useAppState } from "../store";
import type { Session } from "../types";

/** Local YYYY-MM-DD key for a date. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "Upper A" -> "UA" */
function abbrev(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function Calendar() {
  const { dayName } = useRoutine();
  const state = useAppState();
  const [view, setView] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // date key -> first session finished that day
  const byDay = useMemo(() => {
    const m = new Map<string, Session>();
    for (const s of state.sessions) {
      if (!s.finishedAt) continue;
      const k = dayKey(new Date(s.finishedAt));
      if (!m.has(k)) m.set(k, s);
    }
    return m;
  }, [state.sessions]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = Sunday
  const todayKey = dayKey(new Date());

  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) => setView(new Date(year, month + delta, 1));

  return (
    <>
      <div className="cal-head">
        <button className="ghost" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <h1>
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h1>
        <button className="ghost" aria-label="Next month" onClick={() => shift(1)}>
          ›
        </button>
      </div>

      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="cal-weekday">
            {d}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} className="cal-cell empty" />;
          const k = dayKey(new Date(year, month, day));
          const session = byDay.get(k);
          const label = session ? dayName(session.dayId) : undefined;
          return (
            <button
              key={i}
              className={
                "cal-cell" + (k === todayKey ? " today" : "") + (session ? " has-session" : "")
              }
              disabled={!session}
              onClick={() => session && navigate(`#/session/${session.id}`)}
            >
              <span className="cal-daynum">{day}</span>
              {session && (
                <>
                  <span className="cal-dot" />
                  {label && <span className="cal-tag">{abbrev(label)}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="dim small cal-legend">
        <span className="cal-dot inline" /> completed workout · tap to view
      </p>
    </>
  );
}
