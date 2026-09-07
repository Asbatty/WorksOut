// Ask the browser to keep our storage even under pressure. On Chromium an
// installed / engaged PWA is granted this automatically, which exempts
// localStorage from eviction. Safari doesn't implement it (and ignores the
// request), so on iOS the real protection is adding the app to the home screen.
// Best-effort: never throws, safe to call on every launch.

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return false;
    if (storage.persisted && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
