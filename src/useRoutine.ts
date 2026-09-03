// Loads routine.json once on startup and hands back the routine the app should
// use for the active program (overlay wins). While the fetch is in flight we
// fall back to that program's overlay if there is one, so an offline launch
// with local edits still works.

import { useEffect, useState } from "react";
import type { Program, Routine, RoutineFile } from "./types";
import {
  activeProgram,
  allProgramDays,
  fetchRoutineFile,
  getActiveRoutine
} from "./routine";
import { noteRoutineFileVersion, useAppState } from "./store";

interface RoutineState {
  routine: Routine | undefined;
  programs: Program[];
  activeProgramId: string;
  loading: boolean;
  error: string | undefined;
  fileVersion: number | undefined;
  /** Human name for a day id, resolved across every program (and any overlay). */
  dayName: (dayId: string) => string;
}

export function useRoutine(): RoutineState {
  const state = useAppState();
  const [file, setFile] = useState<RoutineFile | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchRoutineFile()
      .then((f) => {
        if (cancelled) return;
        setFile(f);
        noteRoutineFileVersion(f.version);
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

  const prog = file ? activeProgram(state, file) : undefined;
  const routine = file
    ? getActiveRoutine(state, file)
    : state.routineOverlays[state.activeProgramId]; // offline, local edits only

  const dayName = (dayId: string): string => {
    const fromOverlay = routine?.days.find((d) => d.id === dayId);
    if (fromOverlay) return fromOverlay.name;
    const fromFile = file && allProgramDays(file).find((d) => d.id === dayId);
    return fromFile?.name ?? dayId;
  };

  return {
    routine,
    programs: file?.programs ?? [],
    activeProgramId: prog?.id ?? state.activeProgramId,
    loading,
    error,
    fileVersion: file?.version,
    dayName
  };
}
