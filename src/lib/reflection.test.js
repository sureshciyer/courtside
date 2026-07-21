import { describe, it, expect } from "vitest";
import {
  normalizeMatchType,
  emptyReflection,
  hasReflection,
  MATCH_TYPES,
  ERROR_TOPICS,
  FEELING_TAGS,
  BIG_POINT_MINDSETS,
} from "../constants/reflection.js";

describe("normalizeMatchType", () => {
  it("collapses legacy club types into Casual Game", () => {
    expect(normalizeMatchType("Club casual")).toBe("Casual Game");
    expect(normalizeMatchType("Club league")).toBe("Casual Game");
  });
  it("keeps Tournament and defaults missing values to Casual Game", () => {
    expect(normalizeMatchType("Tournament")).toBe("Tournament");
    expect(normalizeMatchType(null)).toBe("Casual Game");
    expect(normalizeMatchType(undefined)).toBe("Casual Game");
  });
  it("every normalized value is a current MATCH_TYPES entry", () => {
    for (const t of ["Club casual", "Club league", "Tournament", "Casual Game", null]) {
      expect(MATCH_TYPES).toContain(normalizeMatchType(t));
    }
  });
});

describe("emptyReflection", () => {
  it("includes the mindset and notes fields with empty defaults", () => {
    const r = emptyReflection();
    expect(r.feelings).toEqual([]);
    expect(r.bigPointMindset).toBeNull();
    expect(r.selfTalk).toBe("");
    expect(r.errorNotes).toEqual({});
    expect(r.notes).toBe("");
  });
});

describe("hasReflection with the newer fields", () => {
  const withReflection = (patch) => ({ reflection: { ...emptyReflection(), ...patch } });

  it("is false for an untouched reflection", () => {
    expect(hasReflection(withReflection({}))).toBe(false);
    expect(hasReflection({})).toBe(false);
  });
  it("counts feelings, big-point mindset, self-talk, error notes, and misc notes", () => {
    expect(hasReflection(withReflection({ feelings: [FEELING_TAGS[0]] }))).toBe(true);
    expect(hasReflection(withReflection({ bigPointMindset: BIG_POINT_MINDSETS[0] }))).toBe(true);
    expect(hasReflection(withReflection({ selfTalk: "kept smashing harder" }))).toBe(true);
    expect(hasReflection(withReflection({ errorNotes: { [ERROR_TOPICS[0]]: "3 in set 2" } }))).toBe(true);
    expect(hasReflection(withReflection({ notes: "opponent was very tall" }))).toBe(true);
  });
  it("ignores whitespace-only text fields", () => {
    expect(hasReflection(withReflection({ selfTalk: "   " }))).toBe(false);
    expect(hasReflection(withReflection({ notes: "  " }))).toBe(false);
    expect(hasReflection(withReflection({ errorNotes: { [ERROR_TOPICS[0]]: "  " } }))).toBe(false);
  });
});
