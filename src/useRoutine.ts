// Loads routine.json once on startup and hands back the routine the app should
// use (overlay wins). While the fetch is in flight we fall back to the overlay
// if there is one, so an offline launch with local edits still works.

import { useEffect, useState } from "react";
import type { Routine } from "./types";
import { fetchRoutineFile, getActiveRoutine } from "./routine";
import { noteRoutineFileVersion, useAppState } from "./store";

interface RoutineState {
  routine: Routine | undefined;
  loading: boolean;
  error: string | undefined;
  /** Version of routine.json last fetched, if any. */
  fileVersion: number | undefined;
}

export function useRoutine(): RoutineState {
  const state = useAppState();
  const [file, setFile] = useState<Routine | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchRoutineFile()
      .then((r) => {
        if (cancelled) return;
        setFile(r);
        noteRoutineFileVersion(r.version);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const routine = file
    ? getActiveRoutine(state, file)
    : state.routineOverlay; // offline, no cached file, but we have local edits

  return { routine, loading, error, fileVersion: file?.version };
}
