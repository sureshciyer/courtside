// Goal tracker — define a target metric, evaluate it against a rally set.
// Goals are stored in the Zustand store (persisted) and consumed by:
//   · Patterns screen — list / add / delete + show baseline value
//   · Summary screen — green/red indicator per goal, evaluated against
//                       the most-recent completed match's rallies only

import {
  disruptionConversion,
  effectivenessBreakdown,
  serveROI,
  clutchStats,
  pct,
} from "./analytics.js";

// Each metric:
//   key:        stable id stored on the goal
//   label:      display name
//   description:short helper text
//   needsZone:  shows the 1-9 zone picker in the form
//   needsServe: shows the LS/FS/DS picker
//   compute:    (rallies, params) → number | null  (null = no data)
//   unit:       "%" | "shots" | "" — used for value formatting
export const GOAL_METRICS = [
  {
    key: "disruptionConversionPct",
    label: "Disruption conversion",
    description: "% of rallies won when a disruption shot is present (smash / kill / quality net)",
    unit: "%",
    direction: "higher",
    compute: (rallies) => {
      const c = disruptionConversion(rallies);
      if (c.withDisruption.count === 0) return null;
      return Math.round(c.withDisruption.rate * 100);
    },
  },
  {
    key: "uePct",
    label: "Overall UE rate",
    description: "Son's unforced-error rate across the rally set",
    unit: "%",
    direction: "lower",
    compute: (rallies) => {
      if (rallies.length === 0) return null;
      const ue = rallies.filter((r) => r.result === "UE" && r.pointWonBy === "O").length;
      return Math.round((ue / rallies.length) * 100);
    },
  },
  {
    key: "clutchUEPct",
    label: "Clutch UE rate",
    description: "UE rate from 16+ onwards",
    unit: "%",
    direction: "lower",
    compute: (rallies) => {
      const cl = clutchStats(rallies);
      return cl.clutchPoints > 0 ? cl.clutchUEPct : null;
    },
  },
  {
    key: "effectiveEPct",
    label: "Effective shot %",
    description: "Share of all shots tagged Effective during capture",
    unit: "%",
    direction: "higher",
    compute: (rallies) => {
      const e = effectivenessBreakdown(rallies);
      return e.total > 0 ? e.ePct : null;
    },
  },
  {
    key: "zoneLossRate",
    label: "Zone loss rate",
    description: "% of points lost where son's last shot landed in this zone",
    unit: "%",
    direction: "lower",
    needsZone: true,
    compute: (rallies, { zone }) => {
      if (!zone) return null;
      let total = 0;
      let lost = 0;
      for (const r of rallies) {
        const last = r.shots[r.shots.length - 1];
        if (last?.zone !== zone) continue;
        total++;
        if (r.pointWonBy === "O") lost++;
      }
      return total > 0 ? Math.round((lost / total) * 100) : null;
    },
  },
  {
    key: "serveCountTotal",
    label: "Serve count (by type)",
    description: "Total serves of this type",
    unit: "",
    direction: "lower",
    needsServe: true,
    compute: (rallies, { serveType }) => {
      if (!serveType) return null;
      let n = 0;
      for (const r of rallies) {
        if (r.server === "S" && r.shots[0]?.shotType === serveType) n++;
      }
      return n;
    },
  },
  {
    key: "serveWinPct",
    label: "Serve win % (by type)",
    description: "Win rate of son-served rallies for this serve type",
    unit: "%",
    direction: "higher",
    needsServe: true,
    compute: (rallies, { serveType }) => {
      if (!serveType) return null;
      const s = serveROI(rallies)[serveType];
      return s.overall.pts > 0 ? s.overall.pct : null;
    },
  },
  {
    key: "winRate",
    label: "Win rate",
    description: "% of rallies won",
    unit: "%",
    direction: "higher",
    compute: (rallies) => {
      if (rallies.length === 0) return null;
      const won = rallies.filter((r) => r.pointWonBy === "S").length;
      return pct(won, rallies.length);
    },
  },
];

export const findMetric = (key) => GOAL_METRICS.find((m) => m.key === key);

// Compute current value for the goal against a rally pool.
export const goalValue = (goal, rallies) => {
  const metric = findMetric(goal.metricKey);
  if (!metric) return null;
  return metric.compute(rallies, goal.params || {});
};

// Evaluate "is goal met?" — returns { value, met, hasData }.
export const evaluateGoal = (goal, rallies) => {
  const value = goalValue(goal, rallies);
  if (value === null) return { value: null, met: null, hasData: false };
  const met = goal.comparator === "lt" ? value < goal.threshold : value > goal.threshold;
  return { value, met, hasData: true };
};

// Render a "Reduce X to < 50%" type label for a goal.
export const goalLabel = (goal) => {
  const m = findMetric(goal.metricKey);
  if (!m) return "Unknown goal";
  const op = goal.comparator === "lt" ? "<" : ">";
  let target = `${op} ${goal.threshold}${m.unit || ""}`;
  let qualifier = "";
  if (m.needsZone && goal.params?.zone) qualifier = ` (Zone ${goal.params.zone})`;
  if (m.needsServe && goal.params?.serveType) qualifier = ` (${goal.params.serveType})`;
  return `${m.label}${qualifier} ${target}`;
};

// New-goal factory used by the form — assigns a stable id + timestamp.
export const buildGoal = ({ metricKey, comparator, threshold, params }) => ({
  id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  metricKey,
  comparator,           // "lt" | "gt"
  threshold: Number(threshold),
  params: params || {},
  createdAt: Date.now(),
});
