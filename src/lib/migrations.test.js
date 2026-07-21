import { describe, it, expect } from "vitest";
import { migratePersisted } from "./migrations.js";

const m = (over = {}) => ({ id: "M001", opponent: "Rahul", sets: [], rallies: [], ...over });

describe("migratePersisted v3 -> v4 (match type simplification)", () => {
  it("remaps Club casual and Club league to Casual Game", () => {
    const out = migratePersisted(
      {
        schemaVersion: 3,
        matches: [m({ matchType: "Club casual" }), m({ id: "M002", matchType: "Club league" })],
        pausedMatches: [m({ id: "M003", matchType: "Club casual" })],
        currentMatch: m({ id: "M004", matchType: "Club league" }),
      },
      3
    );
    expect(out.schemaVersion).toBe(4);
    expect(out.matches.map((x) => x.matchType)).toEqual(["Casual Game", "Casual Game"]);
    expect(out.pausedMatches[0].matchType).toBe("Casual Game");
    expect(out.currentMatch.matchType).toBe("Casual Game");
  });

  it("preserves Tournament and leaves matches without a matchType untouched", () => {
    const out = migratePersisted(
      { schemaVersion: 3, matches: [m({ matchType: "Tournament" }), m({ id: "M002" })], pausedMatches: [], currentMatch: null },
      3
    );
    expect(out.matches[0].matchType).toBe("Tournament");
    expect(out.matches[1].matchType).toBeUndefined();
    expect(out.currentMatch).toBeNull();
  });

  it("is a no-op on already-v4 snapshots", () => {
    const snap = { schemaVersion: 4, matches: [m({ matchType: "Casual Game" })], pausedMatches: [], currentMatch: null };
    expect(migratePersisted(snap, 4)).toEqual(snap);
  });
});

describe("migratePersisted full chain from v1", () => {
  it("walks v1 data through counter seeding, opponent profiles, and type remap", () => {
    const out = migratePersisted(
      { matches: [m({ id: "M007", matchType: "Club casual" })], currentMatch: null },
      1
    );
    expect(out.schemaVersion).toBe(4);
    expect(out.matchCounter).toBe(7);
    expect(out.pausedMatches).toEqual([]);
    expect(out.opponents.rahul.name).toBe("Rahul");
    expect(out.matches[0].matchType).toBe("Casual Game");
  });

  it("passes null/undefined snapshots through untouched", () => {
    expect(migratePersisted(null, 1)).toBeNull();
    expect(migratePersisted(undefined, 1)).toBeUndefined();
  });
});
