// =============================================================
//  IMPROVEMENT TRENDS
//
//  Deterministic over-time analytics. No LLM, no extrapolation —
//  every trend label comes from a formula in this file.
//
//  Core building blocks:
//    aggregateMetrics(matches, options)   — bundle of metrics for a slice
//    createTrendWindows(matches, mode)    — split matches into ordered windows
//    compareMetric(name, prev, curr, ...) — classify delta as
//                                           strong_improvement | improvement |
//                                           stable | regression |
//                                           strong_regression | insufficient
//    trendReadiness(matches)              — gate; emits baseline message
//    trainingFocusProgress(matches)       — focus-area roll-up
//    improvementTrendsReport(matches)     — top-level bundle for the report
//
//  Perspective conventions (full notes at the top of ./rally.js):
//    - Zones are always Son's-court.
//    - E/N/I quality is from the hitter's perspective.
//    - Rally `score` is the pre-rally score.
//
//  Sample confidence (rallies):
//    < 30        → insufficient
//    30 – 74     → very_directional
//    75 – 149    → directional
//    150 – 299   → moderate
//    300+        → reliable
// =============================================================

import {
  pct,
  clutchStats,
  fatigueStats,
  serveReturnStats,
  effectivenessBreakdown,
  deceptionStats,
  momentumChunks,
  analyzeResponsePredictability,
} from "./analytics.js";

// ---------- sample confidence ----------

export const SAMPLE_BANDS = [
  { code: "insufficient",      maxRallies: 29 },
  { code: "very_directional",  maxRallies: 74 },
  { code: "directional",       maxRallies: 149 },
  { code: "moderate",          maxRallies: 299 },
  { code: "reliable",          maxRallies: Infinity },
];

export const sampleLevel = (rallies) => {
  for (const band of SAMPLE_BANDS) {
    if (rallies <= band.maxRallies) return band.code;
  }
  return "reliable";
};

// ---------- threshold defaults ----------

const DEFAULT_PP_THRESHOLDS = {
  strongImprovement: 10,
  improvement: 5,
  // anything strictly less than improvement is "stable"
};

// Minimum rallies a window needs before its metric can be compared.
const MIN_RALLIES_FOR_TREND = 30;

// ---------- low-level helpers ----------

const safeRallies = (matches) =>
  (matches || []).flatMap((m) => m.rallies || []);

const matchEarliestDate = (m) => m.date || "";
const matchSorted = (matches) =>
  [...(matches || [])].sort((a, b) =>
    matchEarliestDate(a).localeCompare(matchEarliestDate(b)),
  );

// Shannon-style diversity index, normalised to 0–1. 0 = single shot type
// dominates; 1 = perfectly even distribution across all shots present.
const diversityIndex = (counts) => {
  const total = counts.reduce((a, n) => a + n, 0);
  if (total === 0 || counts.length <= 1) return 0;
  let h = 0;
  for (const n of counts) {
    if (n === 0) continue;
    const p = n / total;
    h += -p * Math.log2(p);
  }
  const max = Math.log2(counts.filter((n) => n > 0).length);
  return max > 0 ? +(h / max).toFixed(3) : 0;
};

// Pre-rally score parser — defensive against bad data.
const parseScore = (score) => {
  if (!score) return [0, 0];
  const [son, opp] = score.split("-").map((n) => Number(n) || 0);
  return [son, opp];
};

// Whether Son was leading 16+ at the start of this rally.
const wasLeadingAt16 = (rally) => {
  const [son, opp] = parseScore(rally.score);
  return son >= 16 && son > opp;
};

// ---------- aggregateMetrics ----------

// Compute the canonical metric bundle for a slice of matches. All rate
// values are integer percentages (0–100) for easy diffing; counts come
// pre-normalised per 100 rallies where the spec asks.
//
// `options.predictability` lets the caller pre-compute the response
// patterns (helpful when iterating windows so we don't recompute).
export const aggregateMetrics = (matches, options = {}) => {
  const safeMatches = matches || [];
  const rallies = safeRallies(safeMatches);
  const ralliesCount = rallies.length;

  const dates = safeMatches
    .map((m) => m.date)
    .filter(Boolean)
    .sort();
  const earliestDate = dates[0] || null;
  const latestDate = dates[dates.length - 1] || null;
  const tournaments = [
    ...new Set(safeMatches.map((m) => (m.tournament || "").trim()).filter(Boolean)),
  ];

  const ueCount = rallies.filter(
    (r) => r.result === "UE" && r.pointWonBy === "O",
  ).length;
  const ueRate = pct(ueCount, ralliesCount);

  const fatigue = fatigueStats(safeMatches);
  const clutch = clutchStats(rallies);
  const sr = serveReturnStats(rallies);
  const eff = effectivenessBreakdown(rallies);
  const dec = deceptionStats(safeMatches);
  const momentum = momentumChunks(rallies);

  // Z7 UE rate — share of *all* Son UEs whose final landing zone was 7.
  const ueRallies = rallies.filter(
    (r) => r.result === "UE" && r.pointWonBy === "O",
  );
  const z7UEs = ueRallies.filter(
    (r) => r.shots?.[r.shots.length - 1]?.zone === 7,
  ).length;
  const z7UERate = pct(z7UEs, ueRallies.length);

  // Drop-final UE rate — when the rally ended with Son's drop and it was UE.
  const allFinalDrops = rallies.filter(
    (r) => r.shots?.[r.shots.length - 1]?.shotType === "DR",
  ).length;
  const dropFinalUEs = ueRallies.filter(
    (r) => r.shots?.[r.shots.length - 1]?.shotType === "DR",
  ).length;
  const dropFinalUERate = pct(dropFinalUEs, allFinalDrops);

  // Shot-mix diversity over Son's own shots only.
  const sonShotCounts = new Map();
  for (const r of rallies) {
    const server = r.server;
    if (!server) continue;
    const shots = r.shots || [];
    for (let i = 0; i < shots.length; i++) {
      const isSon = (server === "S" && i % 2 === 0) || (server === "O" && i % 2 === 1);
      if (!isSon) continue;
      const k = shots[i].shotType;
      if (!k) continue;
      sonShotCounts.set(k, (sonShotCounts.get(k) || 0) + 1);
    }
  }
  const shotMixDiversity = diversityIndex([...sonShotCounts.values()]);

  // Variation usage / UE rate.
  let variationShots = 0;
  let variationUEs = 0;
  let totalSonShots = 0;
  for (const r of rallies) {
    const server = r.server;
    if (!server) continue;
    const shots = r.shots || [];
    const lastIdx = shots.length - 1;
    const isSonUE = r.result === "UE" && r.pointWonBy === "O";
    for (let i = 0; i < shots.length; i++) {
      const isSon = (server === "S" && i % 2 === 0) || (server === "O" && i % 2 === 1);
      if (!isSon) continue;
      totalSonShots++;
      const t = shots[i].shotType;
      const dt = shots[i].deceptionType;
      const isVariation =
        t === "HS" || t === "SL" || t === "PS" ||
        (dt && dt !== "none" && dt !== "unknown");
      if (isVariation) {
        variationShots++;
        if (i === lastIdx && isSonUE) variationUEs++;
      }
    }
  }
  const variationUsageRate = pct(variationShots, totalSonShots);
  const variationUERate = pct(variationUEs, variationShots);

  // Loss streaks per 100 rallies.
  const lossStreaksPer100 = ralliesCount > 0
    ? +((momentum.total / ralliesCount) * 100).toFixed(2)
    : 0;

  // Lead leakage: rallies where Son was leading at 16+ but lost the rally.
  const leadingClutchRallies = rallies.filter(wasLeadingAt16);
  const leakedRallies = leadingClutchRallies.filter(
    (r) => r.pointWonBy === "O",
  ).length;
  const leadLeakageRate = pct(leakedRallies, leadingClutchRallies.length);

  // Predictability — top response frequency of the most-frequent stimulus,
  // and a coarse response-diversity index across Son responses.
  const predictability = options.predictability ||
    analyzeResponsePredictability(safeMatches);
  const major = predictability.filter((p) => p.total >= 5);
  const topPattern = major[0] || null;
  const topPredictabilityFrequency = topPattern?.topResponsePct ?? 0;

  // Response diversity = average number of distinct responses observed
  // across all major patterns (more = less predictable). Normalised
  // against total events seen so it's bounded 0–1.
  const distinctResponseCounts = predictability.map((p) => p.responses.length);
  const totalEvents = predictability.reduce((a, p) => a + p.total, 0);
  const responseDiversityIndex = totalEvents === 0
    ? 0
    : +(distinctResponseCounts.reduce((a, n) => a + n, 0) / Math.max(1, totalEvents)).toFixed(3);

  // Z7-specific cross-drop pattern: Son responding to any incoming Z7 with
  // F-DR-CR-Z3 (forehand cross drop). Frequency = share of all Z7-incoming
  // responses; UE rate = share of those that ended in Son UE. Computed from
  // the predictability response aggregates (no raw events needed).
  let z7Incoming = 0;
  let z7CrossDrop = 0;
  let z7CrossDropUEs = 0;
  for (const p of predictability) {
    if (p.incomingZone !== 7) continue;
    z7Incoming += p.total;
    for (const resp of p.responses) {
      if (
        resp.responseShotType === "DR" &&
        resp.responseDirection === "CR" &&
        resp.responseTargetZone === 3 &&
        resp.responseGrip === "F"
      ) {
        z7CrossDrop += resp.count;
        z7CrossDropUEs += resp.ues;
      }
    }
  }
  const z7CrossDropFrequency = pct(z7CrossDrop, z7Incoming);
  const z7CrossDropUERate = pct(z7CrossDropUEs, z7CrossDrop);

  return {
    matches: safeMatches.length,
    rallies: ralliesCount,
    dates: { earliest: earliestDate, latest: latestDate },
    tournaments,
    ueRate,
    latePhaseUERate: fatigue.secondHalf?.rate ?? 0,
    clutchUERate: clutch.clutchUEPct,
    clutchWinRate: clutch.clutchWinPct,
    serveWinRate: sr.serveWinPct,
    returnWinRate: sr.returnWinPct,
    threeShotWinRate: sr.threeShotWinPct,
    effectivePct: eff.ePct,
    neutralPct: eff.nPct,
    ineffectivePct: eff.iPct,
    z7UERate,
    z7CrossDropFrequency,
    z7CrossDropUERate,
    dropFinalUERate,
    shotMixDiversity,
    variationUsageRate,
    variationUERate,
    lossStreaksPer100,
    leadLeakageRate,
    topPredictabilityFrequency,
    responseDiversityIndex,
    // Convenience derivations (used by training focus tracker).
    explicitDeceptionTagRate: pct(dec.trackedDeception, dec.total),
    sampleLevel: sampleLevel(ralliesCount),
  };
};

// ---------- createTrendWindows ----------

const monthKey = (date) => (date || "").slice(0, 7); // "YYYY-MM"

export const createTrendWindows = (matches, mode) => {
  const sorted = matchSorted(matches);
  if (sorted.length === 0) return [];

  switch (mode) {
    case "by_match": {
      return sorted.map((m, i) => ({
        label: `${m.id}${m.opponent ? ` vs ${m.opponent}` : ""}`,
        matches: [m],
        rallies: m.rallies || [],
        count: (m.rallies || []).length,
        dates: { from: m.date || null, to: m.date || null },
        index: i,
      }));
    }

    case "by_tournament": {
      const groups = new Map();
      for (const m of sorted) {
        const key = (m.tournament || "Other").trim() || "Other";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
      }
      return [...groups.entries()].map(([name, ms], i) => {
        const rallies = ms.flatMap((m) => m.rallies || []);
        const dates = ms.map((m) => m.date).filter(Boolean).sort();
        return {
          label: name,
          matches: ms,
          rallies,
          count: rallies.length,
          dates: { from: dates[0] || null, to: dates[dates.length - 1] || null },
          index: i,
        };
      });
    }

    case "monthly": {
      const groups = new Map();
      for (const m of sorted) {
        const key = monthKey(m.date) || "unknown";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
      }
      return [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, ms], i) => {
          const rallies = ms.flatMap((m) => m.rallies || []);
          return {
            label: month,
            matches: ms,
            rallies,
            count: rallies.length,
            dates: { from: month, to: month },
            index: i,
          };
        });
    }

    case "rolling_3_months": {
      // For each unique month, build a window covering [m, m+1, m+2].
      const months = [...new Set(sorted.map((m) => monthKey(m.date)).filter(Boolean))]
        .sort();
      const windows = [];
      for (let i = 0; i + 2 < months.length; i++) {
        const span = [months[i], months[i + 1], months[i + 2]];
        const ms = sorted.filter((m) => span.includes(monthKey(m.date)));
        const rallies = ms.flatMap((m) => m.rallies || []);
        windows.push({
          label: `${span[0]} → ${span[2]}`,
          matches: ms,
          rallies,
          count: rallies.length,
          dates: { from: span[0], to: span[2] },
          index: i,
        });
      }
      return windows;
    }

    case "rolling_100_rallies": {
      // Returns up to two windows: previous 100 and current 100.
      const allRallies = sorted.flatMap((m) => m.rallies || []);
      if (allRallies.length === 0) return [];
      const current = allRallies.slice(-100);
      const previous = allRallies.slice(-200, -100);
      const out = [];
      if (previous.length > 0) {
        out.push({
          label: "Previous 100 rallies",
          matches: [], // approximate — multiple matches may overlap
          rallies: previous,
          count: previous.length,
          dates: { from: null, to: null },
          index: 0,
        });
      }
      out.push({
        label: "Current 100 rallies",
        matches: [],
        rallies: current,
        count: current.length,
        dates: { from: null, to: null },
        index: out.length,
      });
      return out;
    }

    case "rolling_5_matches": {
      const current = sorted.slice(-5);
      const previous = sorted.slice(-10, -5);
      const buildFrom = (ms, label, idx) => {
        const rallies = ms.flatMap((m) => m.rallies || []);
        const dates = ms.map((m) => m.date).filter(Boolean).sort();
        return {
          label,
          matches: ms,
          rallies,
          count: rallies.length,
          dates: { from: dates[0] || null, to: dates[dates.length - 1] || null },
          index: idx,
        };
      };
      const out = [];
      if (previous.length > 0) {
        out.push(buildFrom(previous, "Previous 5 matches", 0));
      }
      if (current.length > 0) {
        out.push(buildFrom(current, "Current 5 matches", out.length));
      }
      return out;
    }

    default:
      return [];
  }
};

// ---------- compareMetric ----------

// Classify a delta into status. `direction` is the metric's "better
// direction": lower_is_better, higher_is_better, or target_range.
//
// For pp metrics: positive `delta = curr − prev` means the value went up.
// For lower-is-better metrics, that is *worse*.
//
// `thresholds` overrides the pp cut-offs. Callers using count metrics
// should normalise to per-100-rally rates first.
export const compareMetric = (
  metricName,
  previousValue,
  currentValue,
  direction = "lower_is_better",
  thresholds = DEFAULT_PP_THRESHOLDS,
) => {
  const result = {
    metricName,
    previousValue,
    currentValue,
    delta: 0,
    direction,
    status: "stable",
  };

  if (
    previousValue == null || currentValue == null ||
    Number.isNaN(previousValue) || Number.isNaN(currentValue)
  ) {
    result.status = "insufficient";
    return result;
  }

  const delta = currentValue - previousValue;
  result.delta = +delta.toFixed(2);

  if (direction === "target_range") {
    // Treat target_range as: any move toward 0 magnitude of |delta| is fine;
    // only a move away from prev that exceeds 'improvement' counts.
    const abs = Math.abs(delta);
    if (abs >= thresholds.strongImprovement) result.status = "regression";
    else if (abs >= thresholds.improvement) result.status = "regression";
    else result.status = "stable";
    return result;
  }

  // For higher_is_better, flip the sign so the rules below read as
  // "good = positive delta".
  const goodDelta = direction === "higher_is_better" ? delta : -delta;

  if (goodDelta >= thresholds.strongImprovement) result.status = "strong_improvement";
  else if (goodDelta >= thresholds.improvement) result.status = "improvement";
  else if (goodDelta <= -thresholds.strongImprovement) result.status = "strong_regression";
  else if (goodDelta <= -thresholds.improvement) result.status = "regression";
  else result.status = "stable";

  return result;
};

// Helper that adds the sample-confidence gate before classifying.
export const compareWithGate = (
  metricName,
  prevWindow,
  currWindow,
  prevValue,
  currValue,
  direction,
  thresholds,
) => {
  const insufficient =
    (prevWindow?.count ?? 0) < MIN_RALLIES_FOR_TREND ||
    (currWindow?.count ?? 0) < MIN_RALLIES_FOR_TREND;
  if (insufficient) {
    return {
      metricName,
      previousValue: prevValue ?? null,
      currentValue: currValue ?? null,
      delta: 0,
      direction,
      status: "insufficient",
      previousSample: prevWindow?.count ?? 0,
      currentSample: currWindow?.count ?? 0,
    };
  }
  const cmp = compareMetric(metricName, prevValue, currValue, direction, thresholds);
  return {
    ...cmp,
    previousSample: prevWindow.count,
    currentSample: currWindow.count,
  };
};

// ---------- trendReadiness ----------

const READINESS_MESSAGES = {
  insufficient:
    "Not enough rally data to establish a baseline. Capture at least 30 rallies.",
  very_directional:
    "Baseline established. More notated matches are needed before trend claims are reliable.",
  directional:
    "Directional baseline. Treat trend signals as preliminary — more matches will sharpen them.",
  moderate:
    "Trend signals are moderately reliable. Two windows of 75+ rallies each can be compared.",
  reliable:
    "Sample size supports reliable trend claims across windows.",
};

export const trendReadiness = (matches) => {
  const safeMatches = matches || [];
  const rallies = safeRallies(safeMatches);
  const totalMatches = safeMatches.length;
  const totalRallies = rallies.length;
  const level = sampleLevel(totalRallies);
  return {
    totalMatches,
    totalRallies,
    level,
    message: READINESS_MESSAGES[level],
    canCompare: level !== "insufficient",
  };
};

// ---------- training focus tracker ----------

// Each focus area lists its sub-metrics with direction. The status of a
// focus is the worst status across its rated sub-metrics.
const TRAINING_FOCUS = [
  {
    id: "reduce_ue",
    title: "Reduce unforced errors",
    metrics: [
      { name: "ueRate",            label: "Overall UE rate",     direction: "lower_is_better" },
      { name: "latePhaseUERate",   label: "Late-phase UE rate",  direction: "lower_is_better" },
      { name: "clutchUERate",      label: "Clutch UE rate",      direction: "lower_is_better" },
      { name: "z7UERate",          label: "Z7 UE rate",          direction: "lower_is_better" },
      { name: "dropFinalUERate",   label: "Drop final UE rate",  direction: "lower_is_better" },
    ],
  },
  {
    id: "more_deceptive",
    title: "More deceptive / less honest play",
    metrics: [
      { name: "variationUsageRate",      label: "Variation usage",         direction: "higher_is_better" },
      { name: "explicitDeceptionTagRate", label: "Explicit deception tag rate", direction: "higher_is_better" },
      { name: "shotMixDiversity",        label: "Shot mix diversity",      direction: "higher_is_better", scale: 100 },
      { name: "variationUERate",         label: "Variation UE rate",       direction: "lower_is_better" },
    ],
  },
  {
    id: "clutch_performance",
    title: "Clutch-period performance",
    metrics: [
      { name: "clutchWinRate",    label: "Clutch win rate",       direction: "higher_is_better" },
      { name: "clutchUERate",     label: "Clutch UE rate",        direction: "lower_is_better" },
      { name: "lossStreaksPer100", label: "Loss streaks per 100", direction: "lower_is_better" },
      { name: "leadLeakageRate",  label: "Lead leakage at 16+",   direction: "lower_is_better" },
    ],
  },
  {
    id: "reduce_predictability",
    title: "Reduce predictability",
    metrics: [
      { name: "topPredictabilityFrequency", label: "Top response frequency", direction: "lower_is_better" },
      { name: "z7CrossDropFrequency",       label: "Z7 F-DR-CR → Z3 use",    direction: "lower_is_better" },
      { name: "z7CrossDropUERate",          label: "Z7 F-DR-CR → Z3 UE",     direction: "lower_is_better" },
      { name: "responseDiversityIndex",     label: "Response diversity",     direction: "higher_is_better", scale: 100 },
    ],
  },
];

const STATUS_RANK = {
  insufficient: 0,
  strong_improvement: 5,
  improvement: 4,
  stable: 3,
  regression: 2,
  strong_regression: 1,
};

const worstStatus = (statuses) => {
  let worst = null;
  let rank = Infinity;
  for (const s of statuses) {
    if (s === "insufficient") continue;
    const r = STATUS_RANK[s] ?? 3;
    if (r < rank) { worst = s; rank = r; }
  }
  return worst || "insufficient";
};

// Split matches into baseline (oldest 50%) and latest (newest 50%) by date.
const splitBaselineLatest = (matches) => {
  const sorted = matchSorted(matches);
  if (sorted.length === 0) return { baseline: [], latest: [] };
  if (sorted.length === 1) return { baseline: [], latest: sorted };
  const mid = Math.floor(sorted.length / 2);
  return {
    baseline: sorted.slice(0, mid),
    latest: sorted.slice(mid),
  };
};

export const trainingFocusProgress = (matches) => {
  const { baseline, latest } = splitBaselineLatest(matches);
  const baselineMetrics = aggregateMetrics(baseline);
  const latestMetrics = aggregateMetrics(latest);

  const baselineWindow = { count: baselineMetrics.rallies };
  const latestWindow = { count: latestMetrics.rallies };

  return TRAINING_FOCUS.map((focus) => {
    const metricRows = focus.metrics.map((m) => {
      const scale = m.scale || 1;
      const prev = baselineMetrics[m.name] != null
        ? baselineMetrics[m.name] * scale : null;
      const curr = latestMetrics[m.name] != null
        ? latestMetrics[m.name] * scale : null;
      return {
        name: m.name,
        label: m.label,
        direction: m.direction,
        ...compareWithGate(m.name, baselineWindow, latestWindow, prev, curr, m.direction),
      };
    });
    const focusStatus = worstStatus(metricRows.map((r) => r.status));
    const confidence = Math.min(
      sampleLevel(baselineMetrics.rallies) === "insufficient"
        || sampleLevel(latestMetrics.rallies) === "insufficient"
        ? 0 : 1,
      1,
    ) === 1 ? sampleLevel(Math.min(baselineMetrics.rallies, latestMetrics.rallies))
            : "insufficient";
    return {
      id: focus.id,
      title: focus.title,
      status: focusStatus,
      confidence,
      metrics: metricRows,
      baselineRallies: baselineMetrics.rallies,
      latestRallies: latestMetrics.rallies,
    };
  });
};

// ---------- top-level report ----------

const COMPARISON_METRICS = [
  { name: "ueRate",          label: "UE %",          direction: "lower_is_better" },
  { name: "z7UERate",        label: "Z7 UE %",       direction: "lower_is_better" },
  { name: "clutchUERate",    label: "Clutch UE %",   direction: "lower_is_better" },
  { name: "effectivePct",    label: "Effective %",   direction: "higher_is_better" },
  { name: "threeShotWinRate", label: "3-shot win %", direction: "higher_is_better" },
];

const buildComparisons = (prevWindow, currWindow) => {
  if (!prevWindow || !currWindow) return [];
  // For rolling-rally windows we have rallies but no match objects, so
  // fall back to building a synthetic single-match wrapper for metric calc.
  const synth = (rallies) => [{ id: "_w", date: null, sets: [], rallies }];
  const prevAgg = prevWindow.matches?.length
    ? aggregateMetrics(prevWindow.matches)
    : aggregateMetrics(synth(prevWindow.rallies));
  const currAgg = currWindow.matches?.length
    ? aggregateMetrics(currWindow.matches)
    : aggregateMetrics(synth(currWindow.rallies));
  return COMPARISON_METRICS.map((m) =>
    compareWithGate(
      m.name,
      { count: prevWindow.count },
      { count: currWindow.count },
      prevAgg[m.name],
      currAgg[m.name],
      m.direction,
    ),
  );
};

export const improvementTrendsReport = (matches) => {
  const safeMatches = matches || [];
  const readiness = trendReadiness(safeMatches);
  const baseline = aggregateMetrics(safeMatches);
  const byTournament = createTrendWindows(safeMatches, "by_tournament").map(
    (w) => ({ window: w, metrics: aggregateMetrics(w.matches) }),
  );

  const rolling100 = createTrendWindows(safeMatches, "rolling_100_rallies");
  const rolling5m = createTrendWindows(safeMatches, "rolling_5_matches");
  const rolling3mo = createTrendWindows(safeMatches, "rolling_3_months");

  const last100 = rolling100.length === 2
    ? { previous: rolling100[0], current: rolling100[1], comparisons: buildComparisons(rolling100[0], rolling100[1]) }
    : { previous: null, current: rolling100[0] || null, comparisons: [] };

  const last5 = rolling5m.length === 2
    ? { previous: rolling5m[0], current: rolling5m[1], comparisons: buildComparisons(rolling5m[0], rolling5m[1]) }
    : { previous: null, current: rolling5m[0] || null, comparisons: [] };

  const trainingFocus = readiness.canCompare ? trainingFocusProgress(safeMatches) : [];

  return {
    readiness,
    baseline,
    byTournament,
    monthly: createTrendWindows(safeMatches, "monthly"),
    rolling: {
      last100Rallies: last100,
      last5Matches: last5,
      threeMonth: rolling3mo,
    },
    trainingFocus,
  };
};
