import { describe, it, expect } from "vitest";
import {
  aggregateMetrics,
  createTrendWindows,
  compareMetric,
  trendReadiness,
  trainingFocusProgress,
  improvementTrendsReport,
  sampleLevel,
} from "./trends.js";
import { match, rally, shot } from "./__fixtures__.js";

// ---- Helpers ----

// Build N matches for a given tournament/date with K rallies each.
const matchesWith = (count, ralliesPerMatch, opts = {}) =>
  Array.from({ length: count }, (_, i) =>
    match({
      id: `M${String(i + 1).padStart(3, "0")}`,
      date: opts.dateFn ? opts.dateFn(i) : `2026-0${(i % 9) + 1}-15`,
      tournament: opts.tournament ?? "Tour",
      rallies: Array.from({ length: ralliesPerMatch }, () =>
        rally({
          server: "S",
          shots: [shot({ shotType: "LS" })],
        }),
      ),
    }),
  );

const ueR = (overrides = {}) =>
  rally({
    server: "S",
    pointWonBy: "O",
    result: "UE",
    shots: [shot({ shotType: "LS", zone: 2 }), shot({ shotType: "DR", zone: 7 })],
    ...overrides,
  });
const winR = (overrides = {}) =>
  rally({
    server: "S",
    pointWonBy: "S",
    result: "W",
    shots: [shot({ shotType: "LS", zone: 2 }), shot({ shotType: "SM", zone: 9 })],
    ...overrides,
  });

// ---- sampleLevel ----

describe("sampleLevel", () => {
  it.each([
    [0, "insufficient"],
    [29, "insufficient"],
    [30, "very_directional"],
    [74, "very_directional"],
    [75, "directional"],
    [149, "directional"],
    [150, "moderate"],
    [299, "moderate"],
    [300, "reliable"],
    [9999, "reliable"],
  ])("%i rallies → %s", (n, expected) => {
    expect(sampleLevel(n)).toBe(expected);
  });
});

// ---- aggregateMetrics ----

describe("aggregateMetrics", () => {
  it("returns zeros for an empty match list", () => {
    const m = aggregateMetrics([]);
    expect(m.matches).toBe(0);
    expect(m.rallies).toBe(0);
    expect(m.ueRate).toBe(0);
    expect(m.sampleLevel).toBe("insufficient");
  });

  it("counts UE rate across all rallies", () => {
    const m = match({
      rallies: [
        ueR(), ueR(),
        winR(), winR(), winR(),
      ],
    });
    const out = aggregateMetrics([m]);
    expect(out.rallies).toBe(5);
    expect(out.ueRate).toBe(40);
  });

  it("derives Z7 UE rate from final-shot landing zones", () => {
    const m = match({
      rallies: [
        // 2 UEs landing at Z7
        ueR(), ueR(),
        // 1 UE landing at Z3
        rally({
          server: "S",
          pointWonBy: "O",
          result: "UE",
          shots: [shot({ shotType: "LS", zone: 2 }), shot({ shotType: "DR", zone: 3 })],
        }),
      ],
    });
    const out = aggregateMetrics([m]);
    expect(out.z7UERate).toBe(67);
  });
});

// ---- createTrendWindows ----

describe("createTrendWindows", () => {
  it("by_tournament groups matches by tournament name", () => {
    const ms = [
      match({ id: "M001", tournament: "Tour A", rallies: [rally()] }),
      match({ id: "M002", tournament: "Tour A", rallies: [rally()] }),
      match({ id: "M003", tournament: "Tour B", rallies: [rally()] }),
    ];
    const windows = createTrendWindows(ms, "by_tournament");
    expect(windows).toHaveLength(2);
    expect(windows.find((w) => w.label === "Tour A").matches).toHaveLength(2);
    expect(windows.find((w) => w.label === "Tour B").matches).toHaveLength(1);
  });

  it("monthly groups by YYYY-MM", () => {
    const ms = [
      match({ id: "M001", date: "2026-01-05", rallies: [rally()] }),
      match({ id: "M002", date: "2026-01-20", rallies: [rally()] }),
      match({ id: "M003", date: "2026-02-10", rallies: [rally()] }),
    ];
    const windows = createTrendWindows(ms, "monthly");
    expect(windows.map((w) => w.label)).toEqual(["2026-01", "2026-02"]);
    expect(windows[0].matches).toHaveLength(2);
  });

  it("rolling_3_months returns sliding 3-month windows", () => {
    const ms = [
      match({ id: "M001", date: "2026-01-05", rallies: [rally()] }),
      match({ id: "M002", date: "2026-02-10", rallies: [rally()] }),
      match({ id: "M003", date: "2026-03-15", rallies: [rally()] }),
      match({ id: "M004", date: "2026-04-20", rallies: [rally()] }),
    ];
    const windows = createTrendWindows(ms, "rolling_3_months");
    expect(windows.length).toBe(2);
    expect(windows[0].label).toBe("2026-01 → 2026-03");
    expect(windows[1].label).toBe("2026-02 → 2026-04");
  });

  it("rolling_100_rallies returns previous 100 + current 100 only when both exist", () => {
    // Build 250 rallies total: 100 prev, 100 current, 50 left over.
    const ms = matchesWith(1, 250);
    const windows = createTrendWindows(ms, "rolling_100_rallies");
    expect(windows).toHaveLength(2);
    expect(windows[0].label).toBe("Previous 100 rallies");
    expect(windows[0].count).toBe(100);
    expect(windows[1].label).toBe("Current 100 rallies");
    expect(windows[1].count).toBe(100);
  });

  it("rolling_100_rallies returns just the current window when fewer than 100 prev rallies exist", () => {
    const ms = matchesWith(1, 50);
    const windows = createTrendWindows(ms, "rolling_100_rallies");
    expect(windows).toHaveLength(1);
    expect(windows[0].label).toBe("Current 100 rallies");
    expect(windows[0].count).toBe(50);
  });

  it("rolling_5_matches splits the latest 10 matches into 5 + 5", () => {
    const ms = matchesWith(12, 10);
    const windows = createTrendWindows(ms, "rolling_5_matches");
    expect(windows).toHaveLength(2);
    expect(windows[0].matches).toHaveLength(5);
    expect(windows[1].matches).toHaveLength(5);
  });

  it("by_match returns one window per match", () => {
    const ms = matchesWith(3, 5);
    expect(createTrendWindows(ms, "by_match")).toHaveLength(3);
  });
});

// ---- compareMetric ----

describe("compareMetric", () => {
  it("lower_is_better: -10pp is strong_improvement", () => {
    expect(compareMetric("ueRate", 30, 20, "lower_is_better").status).toBe("strong_improvement");
  });
  it("lower_is_better: -5pp is improvement", () => {
    expect(compareMetric("ueRate", 30, 25, "lower_is_better").status).toBe("improvement");
  });
  it("lower_is_better: <5pp change is stable", () => {
    expect(compareMetric("ueRate", 30, 28, "lower_is_better").status).toBe("stable");
  });
  it("lower_is_better: +5pp is regression", () => {
    expect(compareMetric("ueRate", 25, 30, "lower_is_better").status).toBe("regression");
  });
  it("lower_is_better: +10pp is strong_regression", () => {
    expect(compareMetric("ueRate", 20, 30, "lower_is_better").status).toBe("strong_regression");
  });

  it("higher_is_better: +10pp is strong_improvement", () => {
    expect(compareMetric("threeShotWinRate", 30, 40, "higher_is_better").status).toBe("strong_improvement");
  });
  it("higher_is_better: -10pp is strong_regression", () => {
    expect(compareMetric("threeShotWinRate", 40, 30, "higher_is_better").status).toBe("strong_regression");
  });

  it("returns insufficient when either value is missing", () => {
    expect(compareMetric("ueRate", null, 30, "lower_is_better").status).toBe("insufficient");
    expect(compareMetric("ueRate", 30, null, "lower_is_better").status).toBe("insufficient");
  });
});

// ---- trendReadiness ----

describe("trendReadiness", () => {
  it("a 41-rally dataset produces a baseline-only / very_directional readiness", () => {
    // 1 match × 41 rallies
    const m = match({ rallies: Array.from({ length: 41 }, () => rally()) });
    const r = trendReadiness([m]);
    expect(r.totalRallies).toBe(41);
    expect(r.level).toBe("very_directional");
    expect(r.message).toMatch(/Baseline established/);
  });

  it("under 30 rallies is insufficient and blocks trend claims", () => {
    const m = match({ rallies: Array.from({ length: 10 }, () => rally()) });
    const r = trendReadiness([m]);
    expect(r.level).toBe("insufficient");
    expect(r.canCompare).toBe(false);
  });

  it("300+ rallies is reliable", () => {
    const m = match({ rallies: Array.from({ length: 350 }, () => rally()) });
    expect(trendReadiness([m]).level).toBe("reliable");
  });
});

// ---- trainingFocusProgress ----

describe("trainingFocusProgress", () => {
  it("emits all four focus areas with metric rows", () => {
    const ms = matchesWith(4, 50);
    const out = trainingFocusProgress(ms);
    expect(out.map((f) => f.id)).toEqual([
      "reduce_ue",
      "more_deceptive",
      "clutch_performance",
      "reduce_predictability",
    ]);
    for (const focus of out) {
      expect(focus.metrics.length).toBeGreaterThan(0);
      expect(focus.metrics[0]).toHaveProperty("status");
      expect(focus.metrics[0]).toHaveProperty("direction");
    }
  });

  it("flags individual metrics as insufficient when one window is too small", () => {
    // 1 match with 50 rallies → split is [], [m1]. Baseline window has 0 rallies.
    const out = trainingFocusProgress(matchesWith(1, 50));
    const ue = out[0].metrics.find((m) => m.name === "ueRate");
    expect(ue.status).toBe("insufficient");
  });
});

// ---- improvementTrendsReport ----

describe("improvementTrendsReport", () => {
  it("returns the documented top-level shape", () => {
    const ms = matchesWith(3, 30);
    const r = improvementTrendsReport(ms);
    expect(r).toHaveProperty("readiness");
    expect(r).toHaveProperty("baseline");
    expect(r).toHaveProperty("byTournament");
    expect(r).toHaveProperty("rolling");
    expect(r).toHaveProperty("trainingFocus");
    expect(r.rolling).toHaveProperty("last100Rallies");
    expect(r.rolling).toHaveProperty("last5Matches");
    expect(r.rolling).toHaveProperty("threeMonth");
  });

  it("for a 41-rally dataset, baseline is established but rolling-window comparisons are not", () => {
    const ms = [match({ rallies: Array.from({ length: 41 }, () => rally()) })];
    const r = improvementTrendsReport(ms);
    expect(r.readiness.level).toBe("very_directional");
    // Only one match → no previous/current 5-match split.
    expect(r.rolling.last5Matches.previous).toBe(null);
  });

  it("does not generate trend claims when rolling rally windows are too small", () => {
    // 60 rallies total → no previous-100, only current.
    const ms = [match({ rallies: Array.from({ length: 60 }, () => rally()) })];
    const r = improvementTrendsReport(ms);
    expect(r.rolling.last100Rallies.previous).toBe(null);
    expect(r.rolling.last100Rallies.comparisons).toEqual([]);
  });

  it("populates rolling 100-rally comparisons once 200+ rallies exist", () => {
    const ms = [match({ rallies: Array.from({ length: 220 }, () => winR()) })];
    const r = improvementTrendsReport(ms);
    expect(r.rolling.last100Rallies.previous?.count).toBe(100);
    expect(r.rolling.last100Rallies.current?.count).toBe(100);
    expect(r.rolling.last100Rallies.comparisons.length).toBeGreaterThan(0);
  });
});
