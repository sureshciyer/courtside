import { describe, it, expect } from "vitest";
import {
  normalizeDrill,
  drillUsage,
  catalogWithUsage,
  orphanDrillKeys,
  trainingSummary,
} from "./training.js";

const drill = (name, over = {}) => ({
  drillKey: normalizeDrill(name), name, sets: "", reps: "", note: "", ...over,
});
const session = (date, type, drills, over = {}) => ({
  id: over.id || `T-${date}`, date, type, coach: over.coach || "", drills, ...over,
});

describe("normalizeDrill", () => {
  it("lowercases, trims, and collapses inner whitespace", () => {
    expect(normalizeDrill("  Net +  Cross   Defense ")).toBe("net + cross defense");
    expect(normalizeDrill("Net + Cross Defense")).toBe(normalizeDrill("net + cross  defense"));
  });
  it("is safe on empty / nullish", () => {
    expect(normalizeDrill(null)).toBe("");
    expect(normalizeDrill("")).toBe("");
  });
});

describe("drillUsage", () => {
  const sessions = [
    session("2026-03-01", "Private", [drill("Net + cross defense", { sets: "4" })]),
    session("2026-04-10", "Group", [drill("Six-corner footwork")]),
    session("2026-05-20", "Private", [drill("Net + cross defense", { sets: "5" }), drill("Six-corner footwork")]),
  ];

  it("counts every session running the drill, newest first, with first/last dates", () => {
    const u = drillUsage(sessions, normalizeDrill("Net + cross defense"));
    expect(u.count).toBe(2);
    expect(u.firstDate).toBe("2026-03-01");
    expect(u.lastDate).toBe("2026-05-20");
    expect(u.rows[0].session.date).toBe("2026-05-20"); // newest first
    expect(u.rows[0].entry.sets).toBe("5");
  });

  it("returns an empty result for a drill never run", () => {
    const u = drillUsage(sessions, "nonexistent");
    expect(u).toEqual({ count: 0, firstDate: null, lastDate: null, rows: [] });
  });
});

describe("catalogWithUsage", () => {
  const catalog = {
    "net + cross defense": { name: "Net + cross defense", category: "Defense", skills: ["Net", "Block"], notes: "" },
    "six-corner footwork": { name: "Six-corner footwork", category: "Footwork", skills: ["Footwork"], notes: "" },
  };
  const sessions = [
    session("2026-03-01", "Private", [drill("Net + cross defense")]),
    session("2026-05-20", "Private", [drill("Net + cross defense"), drill("Six-corner footwork")]),
  ];

  it("decorates catalog with count + lastDate and sorts by frequency", () => {
    const rows = catalogWithUsage(catalog, sessions, "count");
    expect(rows[0].name).toBe("Net + cross defense");
    expect(rows[0].count).toBe(2);
    expect(rows[0].lastDate).toBe("2026-05-20");
    expect(rows[1].count).toBe(1);
  });

  it("can sort by most recent", () => {
    const rows = catalogWithUsage(catalog, sessions, "recent");
    expect(rows[0].lastDate).toBe("2026-05-20");
  });
});

describe("orphanDrillKeys", () => {
  it("finds drill keys referenced by sessions but missing from the catalog", () => {
    const catalog = { "known drill": { name: "Known drill" } };
    const sessions = [session("2026-05-20", "Private", [drill("Known drill"), drill("Mystery drill")])];
    expect(orphanDrillKeys(catalog, sessions)).toEqual(["mystery drill"]);
  });
});

describe("trainingSummary", () => {
  it("tallies totals, per-type counts, and drill references", () => {
    const sessions = [
      session("2026-03-01", "Private", [drill("A"), drill("B")]),
      session("2026-04-01", "Group", [drill("A")]),
    ];
    const s = trainingSummary(sessions);
    expect(s.total).toBe(2);
    expect(s.byType).toEqual({ Private: 1, Group: 1 });
    expect(s.drillRefs).toBe(3);
  });
});
