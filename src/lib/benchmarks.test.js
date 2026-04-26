import { describe, it, expect } from "vitest";
import {
  BENCHMARKS,
  UE_SEVERITY_BANDS,
  uePctSeverity,
  SAMPLE_CONFIDENCE,
  PATTERN_MIN_COUNT,
} from "./benchmarks.js";

describe("BENCHMARKS constants", () => {
  it("UE target is 18%", () => {
    expect(BENCHMARKS.UE_TARGET_PCT).toBe(18);
  });
  it("Effective target is 35%", () => {
    expect(BENCHMARKS.EFFECTIVE_TARGET_PCT).toBe(35);
  });
  it("3-shot win target is 55%", () => {
    expect(BENCHMARKS.THREE_SHOT_WIN_TARGET_PCT).toBe(55);
  });
  it("Clutch deficit warn is 10 pp", () => {
    expect(BENCHMARKS.CLUTCH_DEFICIT_WARN_PP).toBe(10);
  });
  it("Neutral high threshold is > 60%", () => {
    expect(BENCHMARKS.NEUTRAL_HIGH_PCT).toBe(60);
  });
});

describe("uePctSeverity", () => {
  it.each([
    [10, "low"],
    [18, "low"],
    [20, "medium"],
    [25, "medium"],
    [27, "high"],
    [30, "high"],
    [33, "critical"],
    [50, "critical"],
  ])("classifies UE %i%% as %s", (uePct, expected) => {
    expect(uePctSeverity(uePct)).toBe(expected);
  });
});

describe("UE_SEVERITY_BANDS", () => {
  it("includes the 4 documented bands", () => {
    expect(UE_SEVERITY_BANDS.map((b) => b.code).sort()).toEqual([
      "critical", "high", "low", "medium",
    ]);
  });
});

describe("SAMPLE_CONFIDENCE thresholds", () => {
  it("very_low max matches < 3, max rallies < 100", () => {
    expect(SAMPLE_CONFIDENCE.VERY_LOW_MAX_MATCHES).toBe(3);
    expect(SAMPLE_CONFIDENCE.VERY_LOW_MAX_RALLIES).toBe(100);
  });
});

describe("PATTERN_MIN_COUNT", () => {
  it("requires at least 3 occurrences", () => {
    expect(PATTERN_MIN_COUNT).toBe(3);
  });
});
