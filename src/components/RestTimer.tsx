// Rest stopwatch. Counts up, no target, no alarm. Auto-starts when a set is
// ticked done (see Today), and can be reset / stopped by hand here. Persists
// across navigation and app restarts via AppState.restStartedAt.
//
// It's only on screen while it's actually counting. Until the user moves it,
// it places itself: during a workout on the Today screen it floats above the
// sticky "Finish workout" stack; on every other screen it tucks into the
// bottom-right corner, clear of the content.
//
// Draggable: press anywhere on the pill (buttons included) and slide past a
// small threshold to pick it up. On release it snaps to the nearer side edge
// and the spot is remembered on this device (localStorage, not AppState, so
// it's a per-phone layout preference and never ends up in backups). A tap
// that turns into a drag doesn't fire the button underneath. Double-tap the
// time to shrink the pill to just the time, double-tap again to expand.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from "react";
import { useRoute } from "../router";
import { activeSession, startRest, stopRest, useAppState } from "../store";

const PREFS_KEY = "lift.restTimerUi";
const EDGE = 12; // gap to the screen edge once snapped
const DRAG_SLOP = 8; // px of movement before a press becomes a drag
const DOUBLE_TAP_MS = 300;

type Side = "left" | "right";
interface TimerUi {
  pos?: { side: Side; top: number };
  compact?: boolean;
}

function loadUi(): TimerUi {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as TimerUi) : {};
  } catch {
    return {};
  }
}
function saveUi(ui: TimerUi) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(ui));
  } catch {
    /* storage full / blocked: position just won't stick */
  }
}

function navHeight(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--nav-h");
  return parseFloat(v) || 64;
}

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

  const [ui, setUi] = useState<TimerUi>(loadUi);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const liveRef = useRef<{ x: number; y: number } | null>(null);
  const swallowClick = useRef(false);
  const lastTap = useRef(0);

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

  // Rotation / resize: re-render so the saved spot gets re-clamped on screen.
  useEffect(() => {
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Track the pill's own size (changes with compact mode and 9:59 -> 10:00).
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  });

  // Show it only while it's genuinely timing a rest.
  if (!running) return null;

  const elapsed = Date.now() - startedAt!;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minTop = EDGE;
  const maxTop = Math.max(minTop, vh - navHeight() - size.h - EDGE);
  const clampY = (y: number) => Math.min(maxTop, Math.max(minTop, y));
  const clampX = (x: number) => Math.min(vw - size.w - EDGE, Math.max(EDGE, x));
  const sideX = (side: Side) => (side === "left" ? EDGE : vw - size.w - EDGE);

  const updateUi = (next: TimerUi) => {
    setUi(next);
    saveUi(next);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: r.left,
      oy: r.top,
      moved: false,
    };
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    const next = { x: clampX(d.ox + dx), y: clampY(d.oy + dy) };
    liveRef.current = next;
    setLive(next);
  };

  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    const p = liveRef.current;
    liveRef.current = null;
    setLive(null);
    // The click that follows this release must not hit a button.
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 0);
    if (!p) return;
    const side: Side = p.x + size.w / 2 < vw / 2 ? "left" : "right";
    updateUi({ ...ui, pos: { side, top: clampY(p.y) } });
  };

  const onClickCapture = (e: RMouseEvent) => {
    if (swallowClick.current) {
      e.stopPropagation();
      e.preventDefault();
      swallowClick.current = false;
    }
  };

  const onTimeTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      updateUi({ ...ui, compact: !ui.compact });
    } else {
      lastTap.current = now;
    }
  };

  // Placement: a spot the user dragged it to wins. Otherwise the automatic
  // spots: on Today mid-workout the sticky action stack owns the bottom of
  // the screen, so sit above it (higher still when its confirmation is open);
  // anywhere else, drop into the bottom-right corner just above the nav.
  let place = "";
  let style: CSSProperties | undefined;
  if (live) {
    place = " dragging";
    style = { left: live.x, top: live.y, right: "auto", bottom: "auto" };
  } else if (ui.pos) {
    place = " placed";
    style = {
      left: sideX(ui.pos.side),
      top: clampY(ui.pos.top),
      right: "auto",
      bottom: "auto",
    };
  } else {
    const overActionStack = route.name === "today" && activeSession(state) != null;
    place = !overActionStack ? " at-corner" : confirmingFinish ? " raised" : "";
  }

  return (
    <div
      ref={el}
      className={"rest-timer running" + place + (ui.compact ? " compact" : "")}
      role="timer"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      <span className="rest-time" aria-label="rest elapsed" onClick={onTimeTap}>
        {mmss(elapsed)}
      </span>
      {!ui.compact && (
        <>
          <button className="rest-btn" aria-label="Restart rest timer" onClick={startRest}>
            ⟳
          </button>
          <button className="rest-btn" aria-label="Stop rest timer" onClick={stopRest}>
            ✕
          </button>
        </>
      )}
    </div>
  );
}
