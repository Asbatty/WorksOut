import { describe, it, expect } from "vitest";
import { normalizeGroups, slotBlocks, slotLabel, validateRoutine } from "./routine";
import type { ProgramSlot, Routine } from "./types";

const s = (exerciseId: string, group?: string): ProgramSlot => ({
  exerciseId,
  sets: 3,
  repMin: 8,
  repMax: 12,
  ...(group ? { group } : {})
});

describe("supersets", () => {
  it("group neighbouring slots that share a label", () => {
    const blocks = slotBlocks([s("a", "A"), s("b", "A"), s("c"), s("d", "B"), s("e", "B")]);
    expect(blocks).toEqual([
      { group: "A", indices: [0, 1] },
      { indices: [2] },
      { group: "B", indices: [3, 4] }
    ]);
  });

  it("treat a lone labelled slot as a normal slot", () => {
    expect(slotBlocks([s("a", "A"), s("b")])).toEqual([{ indices: [0] }, { indices: [1] }]);
  });

  it("label A1 / A2", () => {
    const slots = [s("x"), s("a", "A"), s("b", "A")];
    expect(slotLabel(slots, 0)).toBeUndefined();
    expect(slotLabel(slots, 1)).toBe("A1");
    expect(slotLabel(slots, 2)).toBe("A2");
  });

  it("normalise: re-letter in order, drop singletons, split broken runs", () => {
    const out = normalizeGroups([
      s("a", "Z"),
      s("b", "Z"),
      s("c", "Q"),
      s("d", "Z"),
      s("e", "Z")
    ]);
    expect(out.map((x) => x.group)).toEqual(["A", "A", undefined, "B", "B"]);
  });

  it("validation flags a split or single-exercise superset", () => {
    const routine: Routine = {
      version: 1,
      name: "t",
      cycle: ["d"],
      days: [{ id: "d", name: "D", slots: [s("a", "A"), s("b"), s("c", "A"), s("e", "B")] }],
      exercises: ["a", "b", "c", "e"].map((id) => ({
        id,
        name: id,
        equipment: ["cable"],
        primary: ["chest"],
        pattern: "core",
        cue: "",
        loadType: "total",
        increment: 5,
        ratio: { beginner: 0, intermediate: 0, advanced: 0 },
        alternatives: []
      }))
    };
    const problems = validateRoutine(routine);
    expect(problems.some((p) => p.includes('"A" has only one'))).toBe(true);
    expect(problems.some((p) => p.includes('"B" has only one'))).toBe(true);
  });
});
