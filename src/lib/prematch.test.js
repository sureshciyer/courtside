import { describe, it, expect } from "vitest";
import {
  emptyPreMatch,
  hasPreMatch,
  CONTROLLABLES,
  BODY_READINESS,
} from "../constants/prematch.js";
import { matchAnalysisMarkdown } from "./markdown.js";

describe("emptyPreMatch", () => {
  it("returns all fields empty / null", () => {
    const p = emptyPreMatch();
    expect(p.gamePlan).toBe("");
    expect(p.controllables).toEqual([]);
    expect(p.planB).toBe("");
    expect(p.focusWord).toBe("");
    expect(p.confidence).toBeNull();
    expect(p.nerves).toBeNull();
    expect(p.bodyReadiness).toBeNull();
    expect(p.bodyNote).toBe("");
  });
});

describe("hasPreMatch", () => {
  const withPre = (patch) => ({ preMatch: { ...emptyPreMatch(), ...patch } });

  it("is false for a match without a plan or an untouched plan", () => {
    expect(hasPreMatch({})).toBe(false);
    expect(hasPreMatch(withPre({}))).toBe(false);
  });
  it("detects any meaningful field", () => {
    expect(hasPreMatch(withPre({ gamePlan: "attack backhand" }))).toBe(true);
    expect(hasPreMatch(withPre({ controllables: [CONTROLLABLES[0]] }))).toBe(true);
    expect(hasPreMatch(withPre({ planB: "slow it down" }))).toBe(true);
    expect(hasPreMatch(withPre({ focusWord: "Fight" }))).toBe(true);
    expect(hasPreMatch(withPre({ confidence: 4 }))).toBe(true);
    expect(hasPreMatch(withPre({ nerves: 2 }))).toBe(true);
    expect(hasPreMatch(withPre({ bodyReadiness: BODY_READINESS[0] }))).toBe(true);
    expect(hasPreMatch(withPre({ bodyNote: "sore knee" }))).toBe(true);
  });
  it("ignores whitespace-only text fields", () => {
    expect(hasPreMatch(withPre({ gamePlan: "   " }))).toBe(false);
    expect(hasPreMatch(withPre({ planB: "  ", focusWord: " " }))).toBe(false);
  });
});

describe("pre-match markdown export", () => {
  const base = {
    id: "M010", opponent: "Sahir", date: "2026-07-21",
    quickLog: true, rallies: [], matchType: "Tournament", format: "Singles",
    sets: [{ sonScore: 0, oppScore: 0 }], resultLabel: "won",
  };

  it("renders the pre-match plan block with game plan, controllables, plan B, focus word and state", () => {
    const md = matchAnalysisMarkdown({
      ...base,
      preMatch: {
        ...emptyPreMatch(),
        gamePlan: "Attack his backhand corner",
        controllables: ["Tight net shots", "Stay positive after mistakes"],
        planB: "Slow it down and lift high",
        focusWord: "Fight",
        confidence: 4,
        nerves: 2,
        bodyReadiness: "Fresh",
      },
    });
    expect(md).toMatch(/🎯 Pre-match plan/);
    expect(md).toContain("**Game plan:** Attack his backhand corner");
    expect(md).toContain("Tight net shots, Stay positive after mistakes");
    expect(md).toContain("**Plan B:** Slow it down and lift high");
    expect(md).toContain("**Focus word:** Fight");
    expect(md).toContain("confidence 4/5 · nerves 2/5");
    expect(md).toContain("**Body check:** Fresh");
  });

  it("includes the post-match stuck-to-plan self-grade next to the plan", () => {
    const md = matchAnalysisMarkdown({
      ...base,
      preMatch: { ...emptyPreMatch(), gamePlan: "Be patient" },
      reflection: { ...({ ratings: {}, styleTags: [], strengths: [], weaknesses: [] }), stuckToPlan: 3 },
    });
    expect(md).toContain("**Stuck to the plan (self-grade):** 3/5");
  });

  it("emits nothing for a match with no pre-match plan", () => {
    const md = matchAnalysisMarkdown(base);
    expect(md).not.toMatch(/Pre-match plan/);
  });
});
