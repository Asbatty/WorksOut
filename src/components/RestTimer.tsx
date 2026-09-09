// Rest stopwatch. Counts up, no target, no alarm. Auto-starts when a set is
// ticked done (see Today), and can be reset / stopped by hand here. Persists
// across navigation and app restarts via AppState.restStartedAt.
//
// It's only on screen while it's actually counting. During a workout on the
// Today screen it floats above the sticky "Finish workout" stack; on every
// other screen it tucks into the bottom-right corner, clear of the content.

import { useEffect, useState } from "react";
import { useRoute } from "../router";
import { activeSession, startRest, stopRest, useAppState } from "../store";

function mmss(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RestTimer() {
  const state = useAppState();
  const route = useRoute();
  const startedAt = state.restStartedAt;
  const running = startedAt != null;
  const [, force] = useState(0);
  const [confirmingFinish, setConfirmingFinish] = useState(false);

  // Re-render once a second while the stopwatch is running.
  useEffect(() => {
    if (!running) return;
    const iv = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(iv);
  }, [running]);

  // Lift clear of the finish-workout confirmation bar while it's open.
  useEffect(() => {
    const onConfirm = (e: Event) =>
      setConfirmingFinish(Boolean((e as CustomEvent).detail));
    window.addEventListener("finish-confirm", onConfirm);
    return () => window.removeEventListener("finish-confirm", onConfirm);
  }, []);

  // Show it only while it's genuinely timing a rest.
  if (!running) return null;

  const elapsed = Date.now() - startedAt!;

  // Placement: on Today mid-workout the sticky action stack owns the bottom of
  // the screen, so sit above it (higher still when its confirmation is open).
  // Anywhere else, drop into the bottom-right corner just above the nav.
  const overActionStack = route.name === "today" && activeSession(state) != null;
  const place = !overActionStack
    ? " at-corner"
    : confirmingFinish
      ? " raised"
      : "";

  return (
    <div className={"rest-timer running" + place} role="timer">
      <span className="rest-time" aria-label="rest elapsed">
        {mmss(elapsed)}
      </span>
      <button className="rest-btn" aria-label="Restart rest timer" onClick={startRest}>
        ⟳
      </button>
      <button className="rest-btn" aria-label="Stop rest timer" onClick={stopRest}>
        ✕
      </button>
    </div>
  );
}
