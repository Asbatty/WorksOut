import { beforeEach, describe, it, expect } from "vitest";

// Minimal localStorage so the store's saveState() works under the node test env.
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size;
  }
} as Storage;

const {
  replaceState,
  startSession,
  finishSession,
  reopenSession,
  saveEdits,
  getState,
  activeSession,
  lastFinishedSession,
  updateProfile,
  createProfile,
  switchProfile,
  deleteProfile,
  profileList,
  updateSet,
  setExerciseSkipped
} = await import("./store");
const { defaultState } = await import("./storage");
const { cycleIndex } = await import("./schedule");
const { exerciseHistory } = await import("./history");
import type { Routine } from "./types";

const routine: Routine = {
  version: 1,
  name: "t",
  cycle: ["upper-a", "lower-a", "upper-b", "lower-b"],
  days: [
    { id: "upper-a", name: "Upper A", slots: [{ exerciseId: "x", sets: 1, repMin: 6, repMax: 10 }] },
    { id: "lower-a", name: "Lower A", slots: [{ exerciseId: "x", sets: 1, repMin: 6, repMax: 10 }] },
    { id: "upper-b", name: "Upper B", slots: [{ exerciseId: "x", sets: 1, repMin: 6, repMax: 10 }] },
    { id: "lower-b", name: "Lower B", slots: [{ exerciseId: "x", sets: 1, repMin: 6, repMax: 10 }] }
  ],
  exercises: [
    {
      id: "x",
      name: "X",
      equipment: ["barbell"],
      primary: ["chest"],
      pattern: "horizontal-push",
      cue: "",
      loadType: "total",
      increment: 5,
      ratio: { beginner: 0, intermediate: 0, advanced: 0 },
      alternatives: []
    }
  ]
};

beforeEach(() => {
  replaceState(defaultState());
});

function logAndFinish() {
  const id = startSession(routine, routine.cycle[cycleIndex(getState(), routine)], () => 100);
  finishSession(routine, id);
  return id;
}

describe("finish + undo", () => {
  it("finishing advances the cycle and records where it was", () => {
    expect(getState().cyclePosition).toBe(0);
    const id = logAndFinish();
    const s = getState();
    expect(s.cyclePosition).toBe(1);
    const sess = s.sessions.find((x) => x.id === id)!;
    expect(sess.finishedAt).toBeTruthy();
    expect(sess.cycleAdvanced).toBe(true);
    expect(sess.prevCyclePosition).toBe(0);
  });

  it("reopening the latest workout rewinds the cycle and marks it editing", () => {
    const id = logAndFinish();
    const finishedAt = getState().sessions[0].finishedAt;
    reopenSession(id);
    const s = getState();
    expect(s.cyclePosition).toBe(0); // rewound
    const sess = s.sessions[0];
    expect(sess.editing).toBe(true);
    expect(sess.cycleAdvanced).toBe(false);
    expect(sess.finishedAt).toBe(finishedAt); // date preserved
    expect(activeSession(s)?.id).toBe(id); // counts as the active workout
  });

  it("saving edits re-advances the cycle and keeps the original date", () => {
    const id = logAndFinish();
    const finishedAt = getState().sessions[0].finishedAt;
    reopenSession(id);
    saveEdits(routine, id);
    const s = getState();
    expect(s.cyclePosition).toBe(1);
    expect(s.sessions[0].editing).toBe(false);
    expect(s.sessions[0].finishedAt).toBe(finishedAt);
    expect(activeSession(s)).toBeUndefined();
  });

  it("editing an older workout leaves the schedule untouched", () => {
    logAndFinish(); // upper-a, cycle -> 1
    const older = getState().sessions[0].id;
    logAndFinish(); // lower-a, cycle -> 2
    expect(getState().cyclePosition).toBe(2);

    reopenSession(older);
    expect(getState().cyclePosition).toBe(2); // unchanged
    expect(getState().sessions.find((x) => x.id === older)!.editing).toBe(true);

    saveEdits(routine, older);
    expect(getState().cyclePosition).toBe(2); // still unchanged
    expect(lastFinishedSession(getState())?.dayId).toBe("lower-a");
  });

  it("refuses to reopen while another workout is in progress", () => {
    logAndFinish();
    const first = getState().sessions[0].id;
    startSession(routine, "lower-a", () => 100); // in progress, not finished
    expect(() => reopenSession(first)).toThrow(/in progress/);
  });
});

describe("local profiles", () => {
  it("creates a fresh profile, parks the old one, and switches back", () => {
    updateProfile({ name: "Andrew" });
    logAndFinish(); // Andrew has 1 workout
    const andrewId = getState().activeProfileId;

    createProfile("Sam");
    expect(getState().profile.name).toBe("Sam");
    expect(getState().sessions).toHaveLength(0); // Sam starts empty
    expect(getState().cyclePosition).toBe(0);
    expect(profileList().map((p) => p.name).sort()).toEqual(["Andrew", "Sam"]);

    const samId = getState().activeProfileId;
    logAndFinish(); // Sam has 1 workout

    switchProfile(andrewId);
    expect(getState().profile.name).toBe("Andrew");
    expect(getState().sessions).toHaveLength(1); // Andrew's data came back
    expect(getState().cyclePosition).toBe(1);
    expect(getState().otherProfiles[samId].sessions).toHaveLength(1);
  });

  it("won't delete the active profile, will delete an inactive one", () => {
    const andrewId = getState().activeProfileId;
    createProfile("Sam");
    deleteProfile(getState().activeProfileId); // no-op on active
    expect(profileList()).toHaveLength(2);
    deleteProfile(andrewId);
    expect(profileList().map((p) => p.name)).toEqual(["Sam"]);
  });
});

describe("skipped exercises", () => {
  it("are kept out of an exercise's history", () => {
    const id = startSession(routine, "upper-a", () => 100);
    updateSet(id, 0, 0, { weight: 100, reps: 8 });
    setExerciseSkipped(id, 0, true);
    finishSession(routine, id);
    expect(exerciseHistory(getState().sessions, "x")).toHaveLength(0);
  });

  it("un-skipping restores the exercise to history", () => {
    const id = startSession(routine, "upper-a", () => 100);
    updateSet(id, 0, 0, { weight: 100, reps: 8 });
    setExerciseSkipped(id, 0, true);
    setExerciseSkipped(id, 0, false);
    finishSession(routine, id);
    expect(exerciseHistory(getState().sessions, "x")).toHaveLength(1);
  });
});
