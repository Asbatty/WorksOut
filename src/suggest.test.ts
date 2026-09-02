import { describe, it, expect } from "vitest";
import {
  correctAfterFirstSession,
  floorToIncrement,
  mostCommonWeight,
  roundToIncrement,
  startingWeight,
  suggestWeight
} from "./suggest";
import type { Exercise, Profile, ProgramSlot, SetLog } from "./types";
import type { HistoryEntry } from "./history";

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: "andrew",
  name: "Andrew",
  bodyweightLb: 185,
  experience: "intermediate",
  unit: "lb",
  ...over
});

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: "barbell-bench-press",
  name: "Barbell Bench Press",
  equipment: ["barbell"],
  primary: ["chest"],
  pattern: "horizontal-push",
  cue: "…",
  loadType: "total",
  increment: 5,
  ratio: { beginner: 0.5, intermediate: 0.75, advanced: 1.0 },
  alternatives: [],
  ...over
});

const slot: Pick<ProgramSlot, "repMin" | "repMax"> = { repMin: 6, repMax: 10 };

const entry = (weights: number[], reps: number[]): HistoryEntry => ({
  sessionId: `s${Math.random()}`,
  date: "2026-01-01T00:00:00.000Z",
  sets: weights.map((w, i) => ({ weight: w, reps: reps[i] }) as SetLog)
});

describe("rounding", () => {
  it("rounds to the nearest increment, never below zero", () => {
    expect(roundToIncrement(138.75, 5)).toBe(140);
    expect(roundToIncrement(136, 5)).toBe(135);
    expect(roundToIncrement(-10, 5)).toBe(0);
  });
  it("floors to the increment", () => {
    expect(floorToIncrement(138.75, 5)).toBe(135);
    expect(floorToIncrement(140, 5)).toBe(140);
    expect(floorToIncrement(3, 5)).toBe(0);
  });
});

describe("startingWeight", () => {
  it("is ratio x bodyweight, floored to the increment", () => {
    // 185 * 0.75 = 138.75 -> floor to 5 -> 135
    expect(startingWeight(exercise(), profile())).toBe(135);
    expect(startingWeight(exercise(), profile({ experience: "beginner" }))).toBe(90);
  });
  it("treats a per-side ratio as the per-hand number", () => {
    const curl = exercise({
      loadType: "per-side",
      increment: 5,
      ratio: { beginner: 0.08, intermediate: 0.13, advanced: 0.17 }
    });
    // 185 * 0.13 = 24.05 -> floor 5 -> 20
    expect(startingWeight(curl, profile())).toBe(20);
  });
  it("is zero for a bodyweight movement with a zero ratio", () => {
    const pullup = exercise({
      loadType: "bodyweight",
      ratio: { beginner: 0, intermediate: 0, advanced: 0 }
    });
    expect(startingWeight(pullup, profile())).toBe(0);
  });
});

describe("correctAfterFirstSession", () => {
  const ex = exercise();
  it("jumps 10% when reps blew past repMax + 2", () => {
    expect(correctAfterFirstSession(ex, slot, 100, 13)).toBe(110);
  });
  it("adds one increment when reps were a little over repMax", () => {
    expect(correctAfterFirstSession(ex, slot, 100, 11)).toBe(105);
  });
  it("drops 10% (floored) when reps fell below repMin - 1", () => {
    expect(correctAfterFirstSession(ex, slot, 100, 4)).toBe(90);
  });
  it("keeps the weight when reps landed in range", () => {
    expect(correctAfterFirstSession(ex, slot, 100, 8)).toBe(100);
  });
});

describe("suggestWeight", () => {
  it("with no history, returns the starting guess", () => {
    const s = suggestWeight(exercise(), slot, profile(), []);
    expect(s.weight).toBe(135);
    expect(s.isGuess).toBe(true);
  });

  it("with one session, applies the first-session correction", () => {
    const s = suggestWeight(exercise(), slot, profile(), [entry([100, 100, 100], [11, 11, 11])]);
    expect(s.weight).toBe(105);
    expect(s.isGuess).toBe(false);
  });

  it("double progression: every set hit repMax -> add an increment, aim for repMin", () => {
    const history = [
      entry([135, 135, 135], [8, 8, 8]),
      entry([135, 135, 135], [10, 11, 10])
    ];
    const s = suggestWeight(exercise(), slot, profile(), history);
    expect(s.weight).toBe(140);
    expect(s.repTarget).toBe("repMin");
  });

  it("double progression: one set below repMin -> hold the weight", () => {
    const history = [
      entry([135, 135, 135], [8, 8, 8]),
      entry([135, 135, 135], [8, 7, 5])
    ];
    const s = suggestWeight(exercise(), slot, profile(), history);
    expect(s.weight).toBe(135);
    expect(s.repTarget).toBe("hold");
  });

  it("double progression: below repMin two sessions running -> deload one increment", () => {
    const history = [
      entry([135, 135, 135], [5, 5, 4]),
      entry([135, 135, 135], [6, 5, 5])
    ];
    const s = suggestWeight(exercise(), slot, profile(), history);
    expect(s.weight).toBe(130);
    expect(s.repTarget).toBe("hold");
  });

  it("double progression: mid-range -> same weight, beat last time", () => {
    const history = [
      entry([135, 135, 135], [8, 8, 8]),
      entry([135, 135, 135], [8, 7, 7])
    ];
    const s = suggestWeight(exercise(), slot, profile(), history);
    expect(s.weight).toBe(135);
    expect(s.repTarget).toBe("beat-last");
  });
});

describe("mostCommonWeight", () => {
  it("picks the weight used on the most sets", () => {
    expect(mostCommonWeight(entry([100, 100, 95], [8, 8, 6]))).toBe(100);
  });
  it("breaks ties toward the heavier weight", () => {
    expect(mostCommonWeight(entry([100, 105], [8, 6]))).toBe(105);
  });
});
