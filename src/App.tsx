import { useEffect, useState } from "react";
import { navigate, useRoute } from "./router";
import { Today } from "./screens/Today";
import { Exercise } from "./screens/Exercise";
import { Calendar } from "./screens/Calendar";
import { History } from "./screens/History";
import { Editor } from "./screens/Editor";
import { Settings } from "./screens/Settings";
import { SessionView } from "./screens/SessionView";

const NAV: { hash: string; label: string; icon: string; match: string[] }[] = [
  { hash: "#/today", label: "Today", icon: "🏋", match: ["today"] },
  { hash: "#/calendar", label: "Calendar", icon: "📅", match: ["calendar"] },
  { hash: "#/history", label: "History", icon: "📜", match: ["history", "session"] },
  { hash: "#/editor", label: "Editor", icon: "✏", match: ["editor"] },
  { hash: "#/settings", label: "Settings", icon: "⚙", match: ["settings"] }
];

export function App() {
  const route = useRoute();

  return (
    <div className="app">
      <main className="screen">
        {route.name === "today" && <Today />}
        {route.name === "exercise" && <Exercise id={route.id} />}
        {route.name === "calendar" && <Calendar />}
        {route.name === "history" && <History />}
        {route.name === "editor" && <Editor />}
        {route.name === "settings" && <Settings />}
        {route.name === "session" && <SessionView id={route.id} />}
      </main>

      <UpdateToast />

      <nav className="bottom-nav">
        {NAV.map((item) => {
          const active = item.match.includes(route.name);
          return (
            <button
              key={item.hash}
              className={active ? "nav-btn active" : "nav-btn"}
              onClick={() => navigate(item.hash)}
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** Toast shown when the service worker has a new build ready (see main.tsx). */
function UpdateToast() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onRefresh = () => setShow(true);
    window.addEventListener("sw-need-refresh", onRefresh);
    return () => window.removeEventListener("sw-need-refresh", onRefresh);
  }, []);
  if (!show) return null;
  return (
    <div className="toast" role="status">
      <span>Update available</span>
      <button
        onClick={() => {
          const w = window as unknown as { __updateSW?: (reload?: boolean) => void };
          w.__updateSW?.(true);
        }}
      >
        Reload
      </button>
    </div>
  );
}
