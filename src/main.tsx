import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";

// Auto-update the service worker; App shows a toast when a new build is ready.
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("sw-need-refresh"));
  }
});
// Expose so the toast's "reload" button can trigger it.
(window as unknown as { __updateSW?: (reload?: boolean) => void }).__updateSW = updateSW;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
