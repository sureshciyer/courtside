// Pure analytics helpers for the Patterns dashboard. No React, no store.

import { DISRUPTION_SHOTS } from "../constants/badminton.js";

// Frequency map of N-gram shot-type sequences from rallies where `son` won.
// Returns [{ seq: "LS→NT→SM", count: 4 }, ...] sorted desc.
export const winningSequences = (rallies, n = 3) => {
  const counts = new Map();
  for (const r of rallies) {
    if (r.pointWonBy !== "S" || r.shots.length < n) continue;
    for (let i = 0; i <= r.shots.length - n; i++) {
      const seq = r.shots
        .slice(i, i + n)
        .map((s) => {
          const parts = [s.shotType || s.code];
          if (s.dir) parts.push(s.dir);
          return parts.join("-");
        })
        .join("→");
      counts.set(seq, (counts.get(seq) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([seq, count]) => ({ seq, count }))
    .sort((a, b) => b.count - a.count);
};

// Shot-type frequency across all captured shots. Useful for a simple breakdown.
export const shotTypeFrequency = (rallies) => {
  const counts = new Map();
  for (const r of rallies) {
    for (const s of r.shots) {
      const k = s.shotType || s.code;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
};

// Aggregate role distribution — shows if rallies are "finish-heavy".
export const roleDistribution = (rallies) => {
  const counts = { opening: 0, neutral: 0, disruption: 0, finish: 0 };
  for (const r of rallies) {
    for (const s of r.shots) {
      if (counts[s.role] !== undefined) counts[s.role] += 1;
    }
  }
  return counts;
};

// Disruption conversion: how often does Son win a rally that contains a
// disruption-tagged shot vs. one that does not?
export const disruptionConversion = (rallies) => {
  let wdCount = 0, wdWon = 0, woCount = 0, woWon = 0;
  for (const r of rallies) {
    const hasD =
      r.shots.some((s) => s.role === "disruption") ||
      r.shots.some((s) => DISRUPTION_SHOTS.has(s.shotType));
    if (hasD) { wdCount++; if (r.pointWonBy === "S") wdWon++; }
    else { woCount++; if (r.pointWonBy === "S") woWon++; }
  }
  return {
    withDisruption: { count: wdCount, won: wdWon, rate: wdCount ? wdWon / wdCount : 0 },
    withoutDisruption: { count: woCount, won: woWon, rate: woCount ? woWon / woCount : 0 },
  };
};

// Critical return: where does the opponent return Son's serves, and which
// return zones lead to Son losing the point most often?
// Only considers rallies where Son served (so shots[1] is opponent's return).
export const criticalReturn = (rallies) => {
  const zoneFreq = new Array(10).fill(0);
  const zoneLoss = new Array(10).fill(0);
  let total = 0, totalLoss = 0;
  for (const r of rallies) {
    if (r.server !== "S" || r.shots.length < 2) continue;
    const z = r.shots[1]?.zone;
    if (!z) continue;
    total++;
    zoneFreq[z]++;
    if (r.pointWonBy === "O") { zoneLoss[z]++; totalLoss++; }
  }
  const losingRates = zoneFreq.map((f, i) => (f > 0 ? zoneLoss[i] / f : 0));
  return { zoneFreq, zoneLoss, losingRates, total, totalLoss };
};

// Shot effectiveness heatmap data. `kind` selects which landing zones to
// tally across all rallies:
//   "winners"   — final shot of rallies Son won as a Winner
//   "effective" — every shot Son marked Effective
//   "errors"    — every Ineffective shot + final shot of UE losses
export const effectivenessZones = (rallies, kind) => {
  const z = new Array(10).fill(0);
  for (const r of rallies) {
    if (kind === "winners") {
      if (r.pointWonBy === "S" && r.result === "W") {
        const last = r.shots[r.shots.length - 1];
        if (last?.zone) z[last.zone]++;
      }
    } else if (kind === "effective") {
      for (const s of r.shots) if (s.quality === "Effective" && s.zone) z[s.zone]++;
    } else if (kind === "errors") {
      if (r.result === "UE" && r.pointWonBy === "O") {
        const last = r.shots[r.shots.length - 1];
        if (last?.zone) z[last.zone]++;
      }
      for (const s of r.shots) if (s.quality === "Ineffective" && s.zone) z[s.zone]++;
    }
  }
  return z;
};

// Back-compat alias used by older Patterns screen.
export const errorZones = (rallies) => effectivenessZones(rallies, "errors");

// Generate up to three coaching tips from the rally set. Each tip has a
// priority (higher = more prominent) so we can sort and slice.
// Tips are only surfaced when the sample size supports them.
export const coachingTips = (rallies) => {
  const tips = [];
  if (rallies.length < 4) return tips;

  const conv = disruptionConversion(rallies);
  if (conv.withDisruption.count >= 3) {
    const pct = Math.round(conv.withDisruption.rate * 100);
    const base = Math.round(conv.withoutDisruption.rate * 100);
    const delta = pct - base;
    if (pct >= 55) {
      tips.push({
        priority: 70 + delta,
        kind: "disruption",
        headline: `Disruption wins ${pct}% of rallies`,
        detail: `With a smash/kill/net in play you convert ${pct}%${delta > 0 ? ` (+${delta}pp vs neutral rallies)` : ""}. Hunt for the opening to attack.`,
      });
    } else if (pct < 40 && conv.withDisruption.count >= 5) {
      tips.push({
        priority: 65,
        kind: "disruption",
        headline: `Disruption shots aren't converting (${pct}%)`,
        detail: `Smashes and kills are going in but rallies are still lost. Tighten the follow-up — finish at the net, not from the rear.`,
      });
    }
  }

  const winSeqs = winningSequences(rallies, 3);
  const winSeq = winSeqs[0];
  if (winSeq && winSeq.count >= 2) {
    tips.push({
      priority: 50 + winSeq.count * 6,
      kind: "sequence",
      headline: `Deadliest 3-shot: ${winSeq.seq}`,
      detail: `${winSeq.seq} has won ${winSeq.count} rall${winSeq.count === 1 ? "y" : "ies"}. Set it up deliberately — it's your highest-percentage pattern.`,
    });
  }

  const ret = criticalReturn(rallies);
  if (ret.total >= 4) {
    let worst = { zone: 0, rate: 0, freq: 0 };
    for (let i = 1; i <= 9; i++) {
      if (ret.zoneFreq[i] >= 2 && ret.losingRates[i] > worst.rate) {
        worst = { zone: i, rate: ret.losingRates[i], freq: ret.zoneFreq[i] };
      }
    }
    if (worst.zone && worst.rate >= 0.5) {
      const pct = Math.round(worst.rate * 100);
      tips.push({
        priority: 40 + pct,
        kind: "return",
        headline: `Opponent attacks Zone ${worst.zone} after your serve`,
        detail: `${pct}% of rallies lost when return lands at Zone ${worst.zone} (${worst.freq} occurrences). Drill the counter to that return.`,
      });
    }
  }

  const errZ = effectivenessZones(rallies, "errors");
  const totalErr = errZ.reduce((a, b) => a + b, 0);
  if (totalErr >= 4) {
    let top = { zone: 0, count: 0 };
    for (let i = 1; i <= 9; i++) if (errZ[i] > top.count) top = { zone: i, count: errZ[i] };
    if (top.count >= 3) {
      tips.push({
        priority: 30 + top.count * 3,
        kind: "error",
        headline: `Error hotspot: Zone ${top.zone}`,
        detail: `${top.count} errors land at Zone ${top.zone}. Clean this area — it's costing points repeatedly.`,
      });
    }
  }

  const clutch = rallies.filter((r) => r.phase === "Clutch");
  if (clutch.length >= 4) {
    const won = clutch.filter((r) => r.pointWonBy === "S").length;
    const pct = Math.round((won / clutch.length) * 100);
    if (pct < 45) {
      tips.push({
        priority: 55,
        kind: "clutch",
        headline: `Clutch conversion is ${pct}%`,
        detail: `${won}/${clutch.length} points won from 16-all onwards. Build a clutch script — your best service + safest return pattern.`,
      });
    }
  }

  return tips.sort((a, b) => b.priority - a.priority).slice(0, 3);
};
