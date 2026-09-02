// The one place that talks to persistent storage. Everything else calls
// loadState / saveState. v1 uses localStorage; the schema version + migrate()
// hook let us change the shape later without losing data.

import type { AppState, Profile, Session } from "./types";

const STORAGE_KEY = "lift.appstate";
export const SCHEMA_VERSION = 1 as const;

/** Stable id for the single v1 profile. Extra profiles get their own ids later. */
export const DEFAULT_PROFILE_ID = "andrew";

export function newProfile(): Profile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: "Andrew",
    bodyweightLb: 185,
    experience: "intermediate",
    unit: "lb"
  };
}

export function defaultState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: newProfile(),
    sessions: [],
    cyclePosition: 0,
    swaps: {},
    routineOverlay: undefined,
    routineFileVersion: 0
  };
}

/** Short, sortable-ish unique id (uuid when the platform offers one). */
export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- load / save ---------------------------------------------------------------

export function loadState(): AppState {
  let raw: unknown;
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return defaultState();
    raw = JSON.parse(text);
  } catch {
    // Corrupt JSON: start fresh rather than crash. (Nothing to lose yet.)
    return defaultState();
  }
  return migrate(raw);
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // Quota errors are the realistic failure here. Surface it; never swallow
    // silently, because a swallowed save means a lost workout.
    console.error("Failed to save app state", err);
    throw err;
  }
}

/**
 * Bring any older stored shape up to the current schema. Each step upgrades by
 * exactly one version. v1 is the first version, so there is nothing to do yet
 * beyond filling gaps in a partial object.
 */
export function migrate(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;

  // (future) while (obj.schemaVersion < SCHEMA_VERSION) { ...; obj.schemaVersion++ }

  const merged: AppState = {
    schemaVersion: SCHEMA_VERSION,
    profile: { ...base.profile, ...(obj.profile as object) },
    sessions: Array.isArray(obj.sessions) ? (obj.sessions as Session[]) : [],
    cyclePosition: typeof obj.cyclePosition === "number" ? obj.cyclePosition : 0,
    swaps:
      obj.swaps && typeof obj.swaps === "object"
        ? (obj.swaps as Record<string, string>)
        : {},
    routineOverlay: (obj.routineOverlay as AppState["routineOverlay"]) ?? undefined,
    routineFileVersion:
      typeof obj.routineFileVersion === "number" ? obj.routineFileVersion : 0
  };
  return merged;
}

// --- export / import ---------------------------------------------------------

export interface BackupFile {
  app: "lift";
  schemaVersion: number;
  exportedAt: string;
  state: AppState;
}

export function makeBackup(state: AppState): BackupFile {
  return {
    app: "lift",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state
  };
}

export function backupFilename(date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `lift-backup-${d}.json`;
}

/**
 * Save a backup to the user's device. Prefers the Web Share API (so it can go
 * straight to Google Drive / Files on Android); falls back to a normal download.
 * Both paths are Capacitor-WebView compatible.
 */
export async function exportBackup(state: AppState): Promise<void> {
  const json = JSON.stringify(makeBackup(state), null, 2);
  const filename = backupFilename();
  const blob = new Blob([json], { type: "application/json" });

  const file = new File([blob], filename, { type: "application/json" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // User cancelled the share sheet, or it is unavailable: fall through to
      // download. A real cancel still lands here; that's acceptable.
      if ((err as Error).name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  state: AppState;
  sessionCount: number;
}

/**
 * Parse and validate a backup file. Throws on anything that isn't a Lift backup.
 * The caller is responsible for confirming with the user before saving, since
 * import replaces existing data.
 */
export async function readBackupFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const obj = parsed as Partial<BackupFile>;
  if (!obj || obj.app !== "lift" || !obj.state) {
    throw new Error("That file is not a Lift backup.");
  }
  const state = migrate(obj.state);
  return { state, sessionCount: state.sessions.length };
}
