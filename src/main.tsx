import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./platform"; // registers the install-prompt listener before the event fires
import { requestPersistentStorage } from "./persistence";
import "./index.css";

// Ask to keep our data across storage pressure (granted automatically for an
// installed PWA on Chromium; a no-op on iOS). Fire and forget.
void requestPersistentStorage();

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
