import { describe, it, expect } from "vitest";
import { makeBackup, mergeBackup } from "./backup.js";
import { match, rally, shot } from "./__fixtures__.js";

// makeBackup snapshot tests — make sure the envelope carries the in-progress
// live match too, otherwise mid-match downloads silently drop work.

describe("makeBackup", () => {
  it("includes currentMatch and currentRally in the envelope", () => {
    const live = match({ id: "M010", completed: false });
    const liveRally = rally({ matchId: "M010", shots: [shot({ shotType: "DR" })] });
    const out = makeBackup({
      matches: [match({ id: "M001" })],
      pausedMatches: [],
      currentMatch: live,
      currentRally: liveRally,
      matchCounter: 10,
      opponents: {},
      settings: { playerName: "Pranav", handedness: "R" },
    });
    expect(out.currentMatch).toEqual(live);
    expect(out.currentRally).toEqual(liveRally);
    expect(out.matches).toHaveLength(1);
    expect(out.matchCounter).toBe(10);
  });

  it("currentMatch is null when no live capture is active", () => {
    const out = makeBackup({
      matches: [],
      pausedMatches: [],
      currentMatch: null,
      currentRally: null,
      matchCounter: 0,
      opponents: {},
      settings: { playerName: "Pranav", handedness: "R" },
    });
    expect(out.currentMatch).toBeNull();
    expect(out.currentRally).toBeNull();
  });
});

describe("planned (prepared) matches in backup", () => {
  it("makeBackup carries plannedMatches in the envelope", () => {
    const planned = match({ id: "M005", completed: false, planned: true });
    const out = makeBackup({
      matches: [], pausedMatches: [], plannedMatches: [planned],
      currentMatch: null, currentRally: null, matchCounter: 5, opponents: {},
      settings: { playerName: "Pranav" },
    });
    expect(out.plannedMatches).toHaveLength(1);
    expect(out.plannedMatches[0].id).toBe("M005");
  });

  it("mergeBackup unions planned matches by id and reports addedPlanned", () => {
    const local = {
      matches: [], pausedMatches: [], opponents: {}, matchCounter: 5,
      plannedMatches: [match({ id: "M005", planned: true })],
    };
    const incoming = {
      matches: [], pausedMatches: [], opponents: {},
      plannedMatches: [
        match({ id: "M005", planned: true }), // dup — skipped
        match({ id: "M006", planned: true }), // new — added
      ],
    };
    const { patch, stats } = mergeBackup(local, incoming);
    expect(stats.addedPlanned).toBe(1);
    expect(patch.plannedMatches.map((m) => m.id)).toEqual(["M005", "M006"]);
  });

  it("does not drop local planned matches absent from the backup", () => {
    const local = {
      matches: [], pausedMatches: [], opponents: {}, matchCounter: 3,
      plannedMatches: [match({ id: "M003", planned: true })],
    };
    const incoming = { matches: [], pausedMatches: [], opponents: {}, plannedMatches: [] };
    const { patch } = mergeBackup(local, incoming);
    expect(patch.plannedMatches.map((m) => m.id)).toEqual(["M003"]);
  });
});

// mergeBackup: live-match handling. Three outcomes — restored / parked / skipped.

describe("mergeBackup live-match handling", () => {
  const baseLocal = {
    matches: [],
    pausedMatches: [],
    opponents: {},
    matchCounter: 0,
    currentMatch: null,
    currentRally: null,
  };

  it("restores backup currentMatch when local has no live match", () => {
    const incoming = {
      matches: [],
      pausedMatches: [],
      opponents: {},
      currentMatch: match({ id: "M042", completed: false }),
      currentRally: rally({ matchId: "M042" }),
    };
    const { patch, stats } = mergeBackup(baseLocal, incoming);
    expect(stats.liveOutcome).toBe("restored");
    expect(patch.currentMatch.id).toBe("M042");
    expect(patch.currentRally.matchId).toBe("M042");
  });

  it("parks backup currentMatch when local already has a live one", () => {
    const local = {
      ...baseLocal,
      currentMatch: match({ id: "M001", completed: false }),
      currentRally: rally({ matchId: "M001" }),
    };
    const incoming = {
      matches: [],
      pausedMatches: [],
      opponents: {},
      currentMatch: match({ id: "M042", completed: false }),
      currentRally: rally({ matchId: "M042" }),
    };
    const { patch, stats } = mergeBackup(local, incoming);
    expect(stats.liveOutcome).toBe("parked");
    // patch should NOT touch currentMatch (local wins).
    expect(patch.currentMatch).toBeUndefined();
    // The backup's live match is now in pausedMatches.
    expect(patch.pausedMatches).toHaveLength(1);
    expect(patch.pausedMatches[0].id).toBe("M042");
    expect(patch.pausedMatches[0]._pausedRally?.matchId).toBe("M042");
  });

  it("skips backup currentMatch when its id already exists locally (in matches)", () => {
    const local = {
      ...baseLocal,
      matches: [match({ id: "M042", completed: true })],
    };
    const incoming = {
      matches: [],
      pausedMatches: [],
      opponents: {},
      currentMatch: match({ id: "M042", completed: false }),
      currentRally: rally({ matchId: "M042" }),
    };
    const { patch, stats } = mergeBackup(local, incoming);
    expect(stats.liveOutcome).toBe("skipped");
    expect(patch.currentMatch).toBeUndefined();
    expect(patch.pausedMatches).toEqual([]);
    // matches preserved as-is — local wins.
    expect(patch.matches).toHaveLength(1);
  });

  it("liveOutcome is 'none' when backup has no currentMatch", () => {
    const incoming = {
      matches: [match({ id: "M001" })],
      pausedMatches: [],
      opponents: {},
      currentMatch: null,
      currentRally: null,
    };
    const { stats } = mergeBackup(baseLocal, incoming);
    expect(stats.liveOutcome).toBe("none");
  });

  it("does not overwrite local currentMatch when backup has no live", () => {
    const local = {
      ...baseLocal,
      currentMatch: match({ id: "M050", completed: false }),
      currentRally: rally({ matchId: "M050" }),
    };
    const incoming = {
      matches: [],
      pausedMatches: [],
      opponents: {},
      currentMatch: null,
    };
    const { patch } = mergeBackup(local, incoming);
    // Patch should not contain currentMatch — caller's spread keeps local.
    expect(patch.currentMatch).toBeUndefined();
    expect(patch.currentRally).toBeUndefined();
  });
});
