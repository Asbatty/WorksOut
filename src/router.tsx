import { useEffect, useState } from "react";

/**
 * Tiny hash-based router. We use the URL hash (e.g. "#/today") instead of real
 * paths so deep links work on GitHub Pages with no server rewrite rules, and so
 * the same build runs unchanged inside a Capacitor WebView later.
 */

export type Route =
  | { name: "today" }
  | { name: "calendar" }
  | { name: "history" }
  | { name: "editor" }
  | { name: "settings" }
  | { name: "exercise"; id: string }
  | { name: "session"; id: string };

function parseHash(hash: string): Route {
  // Strip leading "#" and "/", then split into segments.
  const path = hash.replace(/^#\/?/, "");
  const [head, arg] = path.split("/");
  switch (head) {
    case "calendar":
      return { name: "calendar" };
    case "history":
      return { name: "history" };
    case "editor":
      return { name: "editor" };
    case "settings":
      return { name: "settings" };
    case "exercise":
      return arg ? { name: "exercise", id: arg } : { name: "today" };
    case "session":
      return arg ? { name: "session", id: arg } : { name: "history" };
    case "today":
    case "":
    default:
      return { name: "today" };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    // Normalise an empty hash to "#/today" on first load.
    if (!window.location.hash) window.location.hash = "#/today";
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  window.location.hash = to.startsWith("#") ? to : `#${to}`;
}
