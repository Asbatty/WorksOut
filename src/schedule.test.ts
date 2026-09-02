import { describe, it, expect } from "vitest";
import {
  advancedPosition,
  cycleIndex,
  nextDay,
  positionAfterDay,
  upcomingDays,
  workoutNumber
} from "./schedule";
import type { AppState, Routine } from "./types";

const routine: Routine = {
  version: 1,
  name: "test",
  cycle: ["upper-a", "lower-a", "upper-b", "lower-b"],
  days: [
    { id: "upper-a", name: "Upper A", slots: [] },
    { id: "lower-a", name: "Lower A", slots: [] },
    { id: "upper-b", name: "Upper B", slots: [] },
    { id: "lower-b", name: "Lower B", slots: [] }
  ],
  exercises: []
};

const state = (cyclePosition: number): AppState => ({
  schemaVersion: 1,
  profile: { id: "a", name: "A", bodyweightLb: 185, experience: "intermediate", unit: "lb" },
  sessions: [],
  cyclePosition,
  swaps: {},
  routineFileVersion: 1
});

describe("cycleIndex", () => {
  it("passes through an in-range position", () => {
    expect(cycleIndex(state(2), routine)).toBe(2);
  });
  it("wraps a position past the end of the cycle", () => {
    expect(cycleIndex(state(5), routine)).toBe(1);
  });
  it("wraps a negative position", () => {
    expect(cycleIndex(state(-1), routine)).toBe(3);
  });
});

describe("nextDay", () => {
  it("returns the day at the current cycle position", () => {
    expect(nextDay(state(0), routine)?.id).toBe("upper-a");
    expect(nextDay(state(3), routine)?.id).toBe("lower-b");
    expect(nextDay(state(4), routine)?.id).toBe("upper-a");
  });
});

describe("workoutNumber", () => {
  it("is the 1-based cycle position", () => {
    expect(workoutNumber(state(0), routine)).toBe(1);
    expect(workoutNumber(state(3), routine)).toBe(4);
    expect(workoutNumber(state(4), routine)).toBe(1);
  });
});

describe("upcomingDays", () => {
  it("lists the next days after today, wrapping the cycle", () => {
    expect(upcomingDays(state(2), routine, 3).map((d) => d.id)).toEqual([
      "lower-b",
      "upper-a",
      "lower-a"
    ]);
  });
});

describe("advancedPosition", () => {
  it("moves to the next slot and wraps", () => {
    expect(advancedPosition(state(0), routine)).toBe(1);
    expect(advancedPosition(state(3), routine)).toBe(0);
  });
});

describe("positionAfterDay", () => {
  it("is the index right after the named day", () => {
    expect(positionAfterDay(routine, "upper-a")).toBe(1);
    expect(positionAfterDay(routine, "lower-b")).toBe(0);
  });
  it("is 0 for an unknown day", () => {
    expect(positionAfterDay(routine, "nope")).toBe(0);
  });
});
