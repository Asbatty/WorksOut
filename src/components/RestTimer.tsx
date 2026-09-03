// Rest stopwatch. Counts up, no target, no alarm. Auto-starts when a set is
// ticked done (see Today), and can be started / reset / stopped by hand here.
// Persists across navigation and app restarts via AppState.restStartedAt.

import { useEffect, useState } from "react";
import { activeSession, startRest, stopRest, useAppState } from "../store";

function mmss(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RestTimer() {
  const state = useAppState();
  const startedAt = state.restStartedAt;
  const running = startedAt != null;
  const [, force] = useState(0);

  // Re-render once a second while the stopwatch is running.
  useEffect(() => {
    if (!running) return;
    const iv = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(iv);
  }, [running]);

  // Only clutter the screen during a workout, or whenever it's actually running.
  if (!running && !activeSession(state)) return null;

  const elapsed = running ? Date.now() - startedAt! : 0;

  return (
    <div className={running ? "rest-timer running" : "rest-timer"} role="timer">
      {running ? (
        <>
          <span className="rest-time" aria-label="rest elapsed">
            {mmss(elapsed)}
          </span>
          <button className="rest-btn" aria-label="Restart rest timer" onClick={startRest}>
            ⟳
          </button>
          <button className="rest-btn" aria-label="Stop rest timer" onClick={stopRest}>
            ✕
          </button>
        </>
      ) : (
        <button className="rest-start" onClick={startRest}>
          ⏱ Start rest
        </button>
      )}
    </div>
  );
}
