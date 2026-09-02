// Read-only helpers for pulling an exercise's past performance out of the
// session log. Used by suggest.ts, the Exercise screen chart, and History.

import type { Session, SetLog } from "./types";

export interface HistoryEntry {
  sessionId: string;
  date: string; // ISO, the session's finish time (or start if unfinished)
  sets: SetLog[];
  note?: string;
}

/** A set counts as "working" once it has real reps on it. */
export function isWorkingSet(s: SetLog): boolean {
  return s.reps > 0;
}

/** Heaviest set; ties broken by most reps. Assumes at least one set. */
export function topSet(sets: SetLog[]): SetLog {
  return sets.reduce((best, s) =>
    s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best
  );
}

export function averageReps(sets: SetLog[]): number {
  const working = sets.filter(isWorkingSet);
  if (!working.length) return 0;
  return working.reduce((sum, s) => sum + s.reps, 0) / working.length;
}

/**
 * Every logged appearance of an exercise, oldest first. Only finished sessions
 * are included so an in-progress workout never skews a suggestion.
 */
export function exerciseHistory(
  sessions: Session[],
  exerciseId: string
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const session of sessions) {
    if (!session.finishedAt) continue;
    for (const log of session.exercises) {
      if (log.exerciseId !== exerciseId) continue;
      const sets = log.sets.filter(isWorkingSet);
      if (!sets.length) continue;
      out.push({
        sessionId: session.id,
        date: session.finishedAt ?? session.startedAt,
        sets,
        note: log.note
      });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Most recent logged appearance of an exercise, or undefined. */
export function lastAppearance(
  sessions: Session[],
  exerciseId: string
): HistoryEntry | undefined {
  const all = exerciseHistory(sessions, exerciseId);
  return all[all.length - 1];
}
