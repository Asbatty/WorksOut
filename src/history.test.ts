import { describe, it, expect } from "vitest";
import { workoutsSinceBackup } from "./history";
import type { Session } from "./types";

const sess = (over: Partial<Session>): Session => ({
  id: "s",
  profileId: "me",
  dayId: "d",
  startedAt: "2026-01-01T00:00:00.000Z",
  exercises: [],
  ...over
});

describe("workoutsSinceBackup", () => {
  it("counts every finished workout when there is no backup yet", () => {
    const sessions = [
      sess({ id: "a", finishedAt: "2026-02-01T00:00:00.000Z" }),
      sess({ id: "b", finishedAt: "2026-02-03T00:00:00.000Z" }),
      sess({ id: "c" }) // still in progress
    ];
    expect(workoutsSinceBackup(sessions, undefined)).toBe(2);
  });

  it("counts only workouts finished after the last backup", () => {
    const sessions = [
      sess({ id: "a", finishedAt: "2026-02-01T00:00:00.000Z" }),
      sess({ id: "b", finishedAt: "2026-02-10T00:00:00.000Z" })
    ];
    expect(workoutsSinceBackup(sessions, "2026-02-05T00:00:00.000Z")).toBe(1);
  });

  it("ignores a finished workout that is reopened for editing", () => {
    const sessions = [
      sess({ id: "a", finishedAt: "2026-02-10T00:00:00.000Z", editing: true })
    ];
    expect(workoutsSinceBackup(sessions, undefined)).toBe(0);
  });

  it("is zero when the newest backup is after every workout", () => {
    const sessions = [sess({ id: "a", finishedAt: "2026-02-01T00:00:00.000Z" })];
    expect(workoutsSinceBackup(sessions, "2026-03-01T00:00:00.000Z")).toBe(0);
  });
});
