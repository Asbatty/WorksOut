// Browser-shell facts the first-run wizard needs: which phone OS this is, whether
// the app is already running installed, and (Android/Chromium only) a captured
// install prompt. Importing this module registers the `beforeinstallprompt`
// listener straight away — it must beat the event, which can fire before React
// mounts. Everything here is a no-op in the Capacitor WebView, which is fine.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The last un-consumed install prompt Chromium handed us, if any. */
let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Stop Chrome's mini-infobar; we drive the prompt from the wizard instead.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("install-available"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("app-installed"));
  });
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as "MacIntel" but is a touch device.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

/** A desktop browser — no "add to home screen" story worth showing. */
export function isDesktop(): boolean {
  return !isIOS() && !isAndroid();
}

/** True when launched from the home screen / as an installed PWA. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Chromium has offered us a one-tap install prompt. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** Fire the captured install prompt. Returns what the user chose, or
 *  "unavailable" if there was no prompt to show (iOS, or not yet offered). */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  deferredPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome;
}
