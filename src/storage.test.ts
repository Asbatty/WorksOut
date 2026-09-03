import { describe, it, expect } from "vitest";
import { migrate, LEGACY_PROGRAM_ID, SCHEMA_VERSION } from "./storage";
import type { Routine } from "./types";

const fakeRoutine: Routine = {
  version: 1,
  name: "old edit",
  cycle: ["upper-a"],
  days: [{ id: "upper-a", name: "Upper A", slots: [] }],
  exercises: []
};

describe("migrate v1 -> v2", () => {
  it("keeps sessions, swaps and cycle position", () => {
    const v1 = {
      schemaVersion: 1,
      profile: { id: "andrew", name: "Andrew", bodyweightLb: 190, experience: "advanced", unit: "lb" },
      sessions: [
        { id: "s1", profileId: "andrew", dayId: "upper-a", startedAt: "x", finishedAt: "y", exercises: [] }
      ],
      cyclePosition: 3,
      swaps: { "upper-a:2": "cable-seated-row" },
      routineFileVersion: 1
    };
    const out = migrate(v1);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.sessions).toHaveLength(1);
    expect(out.sessions[0].cycleAdvanced).toBe(true); // backfilled for finished
    expect(out.cyclePosition).toBe(3);
    expect(out.swaps["upper-a:2"]).toBe("cable-seated-row");
    expect(out.profile.bodyweightLb).toBe(190);
  });

  it("moves a single routineOverlay under the legacy program id", () => {
    const out = migrate({ schemaVersion: 1, routineOverlay: fakeRoutine });
    expect(out.routineOverlays[LEGACY_PROGRAM_ID]).toEqual(fakeRoutine);
    expect(out.activeProgramId).toBe(LEGACY_PROGRAM_ID);
  });

  it("defaults activeProgramId and keeps an existing routineOverlays map", () => {
    const out = migrate({ schemaVersion: 2, routineOverlays: { "full-body-3": fakeRoutine } });
    expect(out.routineOverlays["full-body-3"]).toEqual(fakeRoutine);
    expect(out.activeProgramId).toBe(LEGACY_PROGRAM_ID);
  });

  it("drops a stale rest stopwatch but keeps a fresh one", () => {
    const stale = migrate({ restStartedAt: Date.now() - 3 * 60 * 60 * 1000 });
    expect(stale.restStartedAt).toBeUndefined();
    const fresh = Date.now() - 30_000;
    expect(migrate({ restStartedAt: fresh }).restStartedAt).toBe(fresh);
  });

  it("returns a clean default for junk input", () => {
    expect(migrate(null).sessions).toEqual([]);
    expect(migrate("nope").activeProgramId).toBe(LEGACY_PROGRAM_ID);
  });
});
