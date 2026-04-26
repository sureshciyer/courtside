// Pure analytics helpers for the Patterns dashboard and the Report screen.
// No React, no store — everything here consumes the plain `matches` array.
//
// Perspective conventions (full notes at the top of ./rally.js):
//   - Zones are always Son's court. Same number means same place for
//     every shot, regardless of who hit it.
//   - E/N/I quality is from the hitter's perspective. Opp E → pressure
//     against Son; Opp I → opportunity for Son. Use
//     `deriveShotContext(...).qualityForSonPerspective` when you need the
//     Son-relative reading.
//   - Rally `score` is the pre-rally score (set at rally open).

import { DISRUPTION_SHOTS, SHOT_NAMES } from "../constants/badminton.js";
import { deriveShotContext, shotHitter } from "./rally.js";
import {
  BENCHMARKS,
  PATTERN_MIN_COUNT,
  SAMPLE_CONFIDENCE,
  uePctSeverity,
} from "./benchmarks.js";

// ---------- tiny math helpers ----------
export const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
export const sum = (arr, f) =>
  arr.reduce((a, x) => a + (typeof f === "function" ? f(x) : f ? x[f] : x), 0);
// Merge many {k: v} histograms into one summed histogram.
export const merge = (objs, field) => {
  const r = {};
  for (const o of objs) {
    const d = field ? o[field] : o;
    if (!d) continue;
    for (const [k, v] of Object.entries(d)) r[k] = (r[k] || 0) + v;
  }
  return r;
};

// Classify playing style from an aggregated shot histogram.
// Returns { style, desc, tone } where tone is one of our dark-theme keys.
export const classifyStyle = (shots) => {
  const total = Object.values(shots).reduce((a, v) => a + v, 0);
  if (total === 0) return { style: "Unknown", desc: "No shots recorded", tone: "muted" };
  const atk = (shots.SM || 0) + (shots.HS || 0) + (shots.KL || 0) + (shots.PS || 0);
  const def = (shots.LF || 0) + (shots.BL || 0) + (shots.LB || 0);
  const net = (shots.NT || 0) + (shots.KL || 0);
  const atkP = pct(atk, total), defP = pct(def, total), netP = pct(net, total);
  if (atkP > 25) return { style: "Aggressive", desc: `${atkP}% attacking shots (smash/kill/push)`, tone: "danger" };
  if (defP > 20) return { style: "Defensive", desc: `${defP}% defensive shots (lift/block/lob)`, tone: "info" };
  if (netP > 15) return { style: "Net-dominant", desc: `${netP}% net play`, tone: "violet" };
  return { style: "Baseline rally", desc: "Balanced clear/drop pattern", tone: "warn" };
};

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

// ===================================================================
//  Report helpers — aggregate Son's raw rally data into the shapes the
//  Report screen needs. Each helper is pure: rallies in, shape out.
// ===================================================================

// Per-rally flags we reuse a lot.
const isSonUE  = (r) => r.result === "UE" && r.pointWonBy === "O";
const isSonW   = (r) => r.result === "W"  && r.pointWonBy === "S";
const isSonFE  = (r) => r.result === "FE" && r.pointWonBy === "S";

// Tally landing zones for Son's shots that "ended" a rally a certain way.
// kind: "winner" (W wins) | "error" (UE losses) | "all" (every shot)
export const zoneTallies = (rallies, kind) => {
  const z = {};
  for (const r of rallies) {
    if (kind === "all") {
      for (const s of r.shots) if (s.zone) z[s.zone] = (z[s.zone] || 0) + 1;
      continue;
    }
    if (kind === "winner" && !isSonW(r)) continue;
    if (kind === "error" && !isSonUE(r)) continue;
    const last = r.shots[r.shots.length - 1];
    if (last?.zone) z[last.zone] = (z[last.zone] || 0) + 1;
  }
  return z;
};

// Aggregate a slice of rallies (typically one set's worth) into the
// legacy report shape: { rallies, won, lost, w, fe, ue_son, ue_opp,
// avgLen, shots, zones, errZones, winZones }.
export const setAggregate = (rallies) => {
  const shots = {};
  for (const r of rallies) for (const s of r.shots) {
    const k = s.shotType || s.code;
    if (!k) continue;
    shots[k] = (shots[k] || 0) + 1;
  }
  return {
    rallies: rallies.length,
    won:   rallies.filter((r) => r.pointWonBy === "S").length,
    lost:  rallies.filter((r) => r.pointWonBy === "O").length,
    w:     rallies.filter(isSonW).length,
    fe:    rallies.filter(isSonFE).length,
    ue_son: rallies.filter(isSonUE).length,
    ue_opp: rallies.filter((r) => r.result === "UE" && r.pointWonBy === "S").length,
    avgLen: rallies.length
      ? +(rallies.reduce((a, r) => a + r.shots.length, 0) / rallies.length).toFixed(1)
      : 0,
    shots,
    zones:    zoneTallies(rallies, "all"),
    errZones: zoneTallies(rallies, "error"),
    winZones: zoneTallies(rallies, "winner"),
  };
};

// Group matches by tournament label (matches with no tournament land in
// a bucket called "Other"). Returns a stable-ordered array.
export const groupByTournament = (matches) => {
  const map = new Map();
  for (const m of matches) {
    const key = (m.tournament || "Other").trim() || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return [...map.entries()].map(([name, matches]) => {
    const rallies = matches.flatMap((m) => m.rallies);
    return {
      name,
      date: matches[0]?.date || "",
      matches,
      rallies,
      wins: matches.filter((m) => {
        const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
        return setsWon > m.sets.length / 2;
      }).length,
    };
  });
};

// Fatigue: first half vs second half of each set, by rally index.
export const fatigueStats = (matches) => {
  let fhP = 0, fhUE = 0, shP = 0, shUE = 0;
  const perSet = []; // per set summary across all matches
  for (const m of matches) {
    // group rallies by set (within this match), preserving capture order
    const bySet = new Map();
    for (const r of m.rallies) {
      if (!bySet.has(r.set)) bySet.set(r.set, []);
      bySet.get(r.set).push(r);
    }
    for (const [setNum, rs] of bySet) {
      const mid = Math.floor(rs.length / 2);
      const fh = rs.slice(0, mid);
      const sh = rs.slice(mid);
      const fhSetUE = fh.filter(isSonUE).length;
      const shSetUE = sh.filter(isSonUE).length;
      fhP += fh.length; fhUE += fhSetUE;
      shP += sh.length; shUE += shSetUE;
      perSet.push({
        matchId: m.id, set: setNum, rallies: rs.length,
        ue: rs.filter(isSonUE).length,
        uePct: pct(rs.filter(isSonUE).length, rs.length),
      });
    }
  }
  const fRate = pct(fhUE, fhP);
  const sRate = pct(shUE, shP);
  const ratio = fhP && fhUE ? (shUE / shP) / (fhUE / fhP) : 0;
  return {
    firstHalf: { points: fhP, ue: fhUE, rate: fRate },
    secondHalf: { points: shP, ue: shUE, rate: sRate },
    perSet,
    ratio: +ratio.toFixed(2),
  };
};

// Clutch deficit: UE rate at 16+ vs overall, and clutch win rate.
export const clutchStats = (rallies) => {
  const clutch = rallies.filter((r) => r.phase === "Clutch");
  const clutchUE = clutch.filter(isSonUE).length;
  const overallUE = rallies.filter(isSonUE).length;
  const clutchWon = clutch.filter((r) => r.pointWonBy === "S").length;
  const clutchUEPct = pct(clutchUE, clutch.length);
  const overallUEPct = pct(overallUE, rallies.length);
  return {
    clutchPoints: clutch.length,
    clutchWon,
    clutchWinPct: pct(clutchWon, clutch.length),
    clutchUE, clutchUEPct,
    overallUE, overallUEPct,
    deficit: clutchUEPct - overallUEPct,
  };
};

// ---------- Deception (Phase 5) ----------
// HS is Half-Smash — that's a *power-deception* shot, not a hold.
// Holds / delays / disguised shots can only be counted if the user has
// explicitly tagged a shot with `deceptionType`. Anything else is unknown.
//
// Shape:
//   {
//     halfSmashes,        // HS shotType count
//     slices,             // SL shotType count
//     holds,              // shots with deceptionType === "hold"
//     delays,             // ... === "delay"
//     doubleMotion,       // ... === "double_motion"
//     disguised,          // ... === "disguised"
//     taggedTotal,        // any deceptionType set (incl. "none")
//     trackedDeception,   // any deceptionType not in {none, unknown}
//     unknown,            // shots with deceptionType missing or "unknown"
//     total,              // every shot
//     perMatch,           // (halfSmashes + slices + trackedDeception) / matches — back-compat shape
//     indexPct,           // share of total shots that show variation
//     hasAdvancedTagging, // true only if at least one trackedDeception shot exists
//   }
//
// Back-compat note: the old shape exposed `holds` + `slices` keys. Both
// remain in the output but `holds` now means "hold-tagged shots" instead
// of "Half-Smash shots".
export const TRACKED_DECEPTION_TYPES = new Set([
  "hold", "delay", "double_motion", "disguised",
]);

export const normaliseDeceptionType = (t) =>
  t && typeof t === "string" ? t : "unknown";

export const deceptionStats = (matches) => {
  let halfSmashes = 0, slices = 0;
  let holds = 0, delays = 0, doubleMotion = 0, disguised = 0;
  let taggedTotal = 0, trackedDeception = 0, unknown = 0, total = 0;

  for (const m of matches || []) {
    for (const r of m.rallies || []) {
      for (const s of r.shots || []) {
        total++;
        if (s.shotType === "HS") halfSmashes++;
        if (s.shotType === "SL") slices++;

        const dt = normaliseDeceptionType(s.deceptionType);
        if (dt === "unknown") unknown++;
        else taggedTotal++;
        switch (dt) {
          case "hold":          holds++;          trackedDeception++; break;
          case "delay":         delays++;         trackedDeception++; break;
          case "double_motion": doubleMotion++;   trackedDeception++; break;
          case "disguised":     disguised++;      trackedDeception++; break;
          default: break;
        }
      }
    }
  }

  const n = (matches || []).length || 1;
  // Variation share = HS + SL + any tracked deception. We keep this name
  // (perMatch / indexPct) for the existing UI cards.
  const variationCount = halfSmashes + slices + trackedDeception;
  return {
    halfSmashes, slices,
    holds, delays, doubleMotion, disguised,
    taggedTotal, trackedDeception, unknown, total,
    perMatch: +(variationCount / n).toFixed(1),
    indexPct: pct(variationCount, total),
    hasAdvancedTagging: trackedDeception > 0,
  };
};

// Effectiveness index: E/N/I percentages across every captured shot.
export const effectivenessBreakdown = (rallies) => {
  let e = 0, n = 0, i = 0;
  for (const r of rallies) for (const s of r.shots) {
    const q = s.quality || "Neutral";
    if (q === "Effective") e++;
    else if (q === "Ineffective") i++;
    else n++;
  }
  const total = e + n + i;
  return {
    e, n, i, total,
    ePct: pct(e, total),
    nPct: pct(n, total),
    iPct: pct(i, total),
  };
};

// Win rate bucketed by rally length. Buckets are stable order: 1-3, 4-8,
// 9-15, 16+. Each entry exposes raw won/lost counts; callers compute
// percentages via pct() so we don't double-truncate.
export const rallyLengthProfile = (rallies) => {
  const buckets = { "1-3": { w: 0, l: 0 }, "4-8": { w: 0, l: 0 }, "9-15": { w: 0, l: 0 }, "16+": { w: 0, l: 0 } };
  for (const r of rallies) {
    const len = r.shots.length;
    const b = len <= 3 ? "1-3" : len <= 8 ? "4-8" : len <= 15 ? "9-15" : "16+";
    if (r.pointWonBy === "S") buckets[b].w++;
    else if (r.pointWonBy === "O") buckets[b].l++;
  }
  return buckets;
};

// Pick the rally-length bucket with the best win rate. Buckets below
// `minSample` total points are ignored — a 1/1 bucket should not beat a
// 13/22 bucket. Ties broken by sample size (more = more trustworthy).
//
// Returns: { bucket, winPct, won, lost, total, strong }
//   strong = true when total >= strongSample (claim is safe)
//   bucket = null when no bucket has >= minSample
export const bestRallyLengthBucket = (rallies, { minSample = 5, strongSample = 8 } = {}) => {
  const profile = rallyLengthProfile(rallies);
  const candidates = Object.entries(profile)
    .map(([bucket, { w, l }]) => ({
      bucket,
      won: w,
      lost: l,
      total: w + l,
      winPct: w + l > 0 ? (w / (w + l)) * 100 : 0,
    }))
    .filter((b) => b.total >= minSample);

  if (candidates.length === 0) {
    return { bucket: null, winPct: 0, won: 0, lost: 0, total: 0, strong: false };
  }
  candidates.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.total - a.total;
  });
  const top = candidates[0];
  return {
    bucket: top.bucket,
    winPct: Math.round(top.winPct),
    won: top.won,
    lost: top.lost,
    total: top.total,
    strong: top.total >= strongSample,
  };
};

// Shot distribution with human names + percentages, sorted desc.
export const shotDistribution = (rallies) => {
  const counts = new Map();
  let total = 0;
  for (const r of rallies) for (const s of r.shots) {
    const k = s.shotType || s.code;
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count, pct: pct(count, total), name: SHOT_NAMES[code] || code }))
    .sort((a, b) => b.count - a.count);
};

// Serve / return / 3-shot opening efficiency.
export const serveReturnStats = (rallies) => {
  let sP = 0, sW = 0, rP = 0, rW = 0, tP = 0, tW = 0;
  for (const r of rallies) {
    if (r.server === "S") {
      sP++;
      if (r.pointWonBy === "S") sW++;
      if (r.shots.length <= 3) { tP++; if (r.pointWonBy === "S") tW++; }
    } else if (r.server === "O") {
      rP++;
      if (r.pointWonBy === "S") rW++;
    }
  }
  return {
    servePoints: sP, serveWon: sW, serveWinPct: pct(sW, sP),
    returnPoints: rP, returnWon: rW, returnWinPct: pct(rW, rP),
    threeShotPoints: tP, threeShotWon: tW, threeShotWinPct: pct(tW, tP),
  };
};

// ---------- Serve + third-shot table (Phase 7, refactored) ----------
// Per (serveType, target) bucket, with return-quality columns derived
// from the existing shot data — no new capture fields required.
//
// Derivations (see deriveShotContext in rally.js):
//   returnType         = shots[1].shotType
//   returnTargetZone   = shots[1].zone
//   returnQualityForSon = sonPerspectiveQuality of shots[1].quality
//                        (Opp E → "pressuring", Opp I → "weak", Opp N → "neutral")
//
// `serveTarget` remains an optional explicit field on the serve (body /
// T / wide etc.). When not captured, the row shows target "unknown".
//
// Output rows:
//   [{ serveType, target, count, won, winPct, returns,
//      weakReturns, pressuringReturns, neutralReturns,
//      weakReturnPct, pressuringReturnPct,
//      thirdShotPts, thirdShotWon, thirdShotWinPct }]
export const SERVE_TYPES = ["LS", "FS", "DS"];

export const serveThirdShotTable = (rallies) => {
  const buckets = new Map();
  const key = (st, tgt) => `${st}::${tgt || "unknown"}`;

  for (const r of rallies) {
    if (r.server !== "S" || !r.shots?.length) continue;
    const serve = r.shots[0];
    if (!SERVE_TYPES.includes(serve.shotType)) continue;
    const target = serve.serveTarget || "unknown";
    const k = key(serve.shotType, target);
    if (!buckets.has(k)) {
      buckets.set(k, {
        serveType: serve.shotType,
        target,
        count: 0,
        won: 0,
        returns: 0,
        weakReturns: 0,
        pressuringReturns: 0,
        neutralReturns: 0,
        thirdShotPts: 0,
        thirdShotWon: 0,
      });
    }
    const row = buckets.get(k);
    row.count++;
    if (r.pointWonBy === "S") row.won++;
    if (r.shots.length <= 3) {
      row.thirdShotPts++;
      if (r.pointWonBy === "S") row.thirdShotWon++;
    }

    // Opponent's return is shots[1] (rally is Son-served, so even index =
    // Son, odd = Opp). Derive Son's view of that quality.
    if (r.shots.length > 1) {
      const ctx = deriveShotContext(r, 1);
      if (ctx?.hitBy === "O") {
        row.returns++;
        const q = ctx.qualityForSonPerspective;
        if (q === "weak") row.weakReturns++;
        else if (q === "pressuring") row.pressuringReturns++;
        else if (q === "neutral") row.neutralReturns++;
      }
    }
  }

  return [...buckets.values()]
    .map((row) => ({
      ...row,
      winPct: pct(row.won, row.count),
      weakReturnPct: pct(row.weakReturns, row.returns),
      pressuringReturnPct: pct(row.pressuringReturns, row.returns),
      thirdShotWinPct: pct(row.thirdShotWon, row.thirdShotPts),
    }))
    .sort((a, b) => {
      const t = SERVE_TYPES.indexOf(a.serveType) - SERVE_TYPES.indexOf(b.serveType);
      return t !== 0 ? t : (a.target || "").localeCompare(b.target || "");
    });
};

// Per-match summary used in the drill-down — adds playerStyle + opponent style.
export const matchSummary = (match) => {
  const agg = setAggregate(match.rallies);
  const style = classifyStyle(agg.shots);
  const setsWon = match.sets.filter((s) => s.sonScore > s.oppScore).length;
  return {
    ...match,
    won: setsWon > match.sets.length / 2,
    setsWon,
    agg,
    style,
  };
};

// Dynamic "Priority 1/2/3" coaching recommendations driven by real data.
// Each rec: { priority, tone, title, body }.
export const recommendations = (matches) => {
  const recs = [];
  const rallies = matches.flatMap((m) => m.rallies);
  if (rallies.length < 6) return recs;

  const fat = fatigueStats(matches);
  if (fat.firstHalf.points >= 3 && fat.secondHalf.points >= 3) {
    if (fat.ratio >= 1.5 && fat.secondHalf.rate > fat.firstHalf.rate) {
      recs.push({
        priority: 1,
        tone: "danger",
        title: "Priority 1: Reduce late-set errors",
        body: `UE rate jumps from ${fat.firstHalf.rate}% in the first half to ${fat.secondHalf.rate}% in the second half of sets (ratio ${fat.ratio}×). Prioritize endurance conditioning; default to safer shots (clears to corners) when fatigued.`,
      });
    }
  }

  // Zone weakness — only claim a *backhand* problem when origin/contact
  // data supports it. Otherwise note the target-zone concentration without
  // the technical attribution (Phase 8).
  const errZ = zoneTallies(rallies, "error");
  const errTotal = Object.values(errZ).reduce((a, v) => a + v, 0);
  const bhErr = (errZ[7] || 0) + (errZ[4] || 0) + (errZ[1] || 0);
  const zw = analyzeZoneWeakness(rallies);
  if (errTotal >= 4 && pct(bhErr, errTotal) >= 30) {
    if (zw.supportedBackhandClaim) {
      recs.push({
        priority: 2,
        tone: "warn",
        title: "Priority 2: Backhand rear court",
        body:
          `Left-column zones (1/4/7) account for ${pct(bhErr, errTotal)}% of all unforced errors, ` +
          `with origin/contact evidence supporting the technical cause. ` +
          `Drills: backhand clear to Zone 9 cross, round-the-head forehand from the BH corner.`,
      });
    } else {
      recs.push({
        priority: 2,
        tone: "warn",
        title: "Priority 2: Validate left-side error pattern",
        body:
          `Left-column zones (1/4/7) account for ${pct(bhErr, errTotal)}% of unforced errors, ` +
          `but origin/contact data is missing — capture originZone, bodySide, and contactQuality ` +
          `during a session to confirm whether this is a backhand technical issue or a ` +
          `positional/recovery one.`,
      });
    }
  }

  const dec = deceptionStats(matches);
  if (matches.length >= 2 && dec.perMatch < 3) {
    const taggedNote = dec.hasAdvancedTagging
      ? ` (${dec.halfSmashes} HS, ${dec.slices} SL, ${dec.trackedDeception} tagged hold/delay)`
      : ` (${dec.halfSmashes} HS, ${dec.slices} SL — tagged hold/delay not captured)`;
    recs.push({
      priority: 3,
      tone: "info",
      title: "Priority 3: Add deception to clears",
      body:
        `Only ${dec.perMatch} variation shots per match${taggedNote}. ` +
        `Introduce hold-and-vary: pause 0.3s, then alternate clear/drop. ` +
        `Tag shots with deceptionType to track hold/delay separately.`,
    });
  }

  const winZ = zoneTallies(rallies, "winner");
  const winTotal = Object.values(winZ).reduce((a, v) => a + v, 0);
  if (winTotal >= 3) {
    const bestZone = +Object.entries(winZ).sort((a, b) => b[1] - a[1])[0][0];
    if (bestZone === 3 || bestZone === 9) {
      recs.push({
        priority: 4,
        tone: "good",
        title: "Maintain: Forehand attack pattern",
        body: `Zone ${bestZone} is the top winner zone (${winZ[bestZone]} winners). Keep building this pattern — it's his competitive edge.`,
      });
    }
  }

  const cl = clutchStats(rallies);
  if (cl.clutchPoints >= 4 && cl.deficit >= 5) {
    recs.push({
      priority: 5,
      tone: "violet",
      title: "Long-term: Clutch mental training",
      body: `Clutch UE rate (${cl.clutchUEPct}%) exceeds overall (${cl.overallUEPct}%) by ${cl.deficit}pp. Practice pressure scenarios starting at 18-18.`,
    });
  }

  // ---- Advanced-signal triggers (driven by the Tactical Cleverness engine) ----
  const sroi = serveROI(rallies);

  // Drive Serve (DS) decay — if it drops hard late, switch after point 11.
  const ds = sroi.DS;
  if (ds.decay !== null && ds.decay > 20 && ds.late.pts >= 2) {
    recs.push({
      priority: 6,
      tone: "warn",
      title: "Serve ROI: swap away from Drive Serve after 11",
      body: `Drive Serve win rate ${ds.early.pct}% early → ${ds.late.pct}% late (Δ ${ds.decay}pp). Opponents adapt once they've seen it. Open with DS for surprise, then rotate to LS after point 11.`,
    });
  }

  // Any serve with heavy late decay → generic mix-up reco.
  const worstDecayServe = ["LS", "FS", "DS"]
    .map((c) => ({ code: c, ...sroi[c] }))
    .filter((s) => s.decay !== null && s.decay >= 25 && s.late.pts >= 2)
    .sort((a, b) => b.decay - a.decay)[0];
  if (worstDecayServe && worstDecayServe.code !== "DS") {
    recs.push({
      priority: 6,
      tone: "warn",
      title: `Serve ROI: ${worstDecayServe.code} loses bite late`,
      body: `${worstDecayServe.code} win rate ${worstDecayServe.early.pct}% → ${worstDecayServe.late.pct}% (Δ ${worstDecayServe.decay}pp). Mix in another serve type once the opponent has seen it ~5 times.`,
    });
  }

  // Recovery Leak — long-diagonal finish patterns.
  const leak = recoveryLeak(rallies);
  if (leak.total >= 4 && leak.avgDist >= 2.5) {
    recs.push({
      priority: 7,
      tone: "info",
      title: "Recovery: faster return to base after corner shots",
      body: `Avg recovery gap is ${leak.avgDist} zones (${leak.longDiagonalPct}% long diagonals). Opp is exploiting the corner you just vacated. Drill the split-step + cross-court recovery routine.`,
    });
  }

  // Momentum chunks — physical vs mental collapse remediation.
  const mom = momentumChunks(rallies);
  if (mom.physical >= 1) {
    recs.push({
      priority: 8,
      tone: "danger",
      title: `Physical collapse detected ×${mom.physical}`,
      body: `You lost 3+ consecutive points after rallies longer than 15 shots. Insert a reset shot — high defensive clear to the back corner — immediately after any rally > 15 shots to lower heart rate before the next point.`,
    });
  }
  if (mom.mental >= 2) {
    recs.push({
      priority: 9,
      tone: "warn",
      title: `Mental collapse cluster ×${mom.mental}`,
      body: `${mom.mental} collapse clusters after short rallies — focus issue, not fatigue. Build a point-by-point reset routine: breathe, bounce the shuttle twice, look at the back line, then serve.`,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
};

// Top-level report bundler. Accepts the full `matches` array, returns
// everything the Report screen needs in one call.
export const reportBundle = (matches) => {
  const rallies = matches.flatMap((m) => m.rallies);
  const agg = setAggregate(rallies); // reuse — the numbers roll up cleanly
  const style = classifyStyle(agg.shots);
  return {
    matches,
    rallies,
    tournaments: groupByTournament(matches),
    agg,
    style,
    distribution: shotDistribution(rallies),
    lengthProfile: rallyLengthProfile(rallies),
    bestLengthBucket: bestRallyLengthBucket(rallies),
    serveReturn: serveReturnStats(rallies),
    clutch: clutchStats(rallies),
    fatigue: fatigueStats(matches),
    deception: deceptionStats(matches),
    effectiveness: effectivenessBreakdown(rallies),
    winnerZones: zoneTallies(rallies, "winner"),
    errorZonesAll: zoneTallies(rallies, "error"),
    allZones: zoneTallies(rallies, "all"),
    recs: recommendations(matches),
    advanced: advancedInsights(rallies),
    confidence: computeSampleConfidence(matches),
    leaks: analyzePerformanceLeaks(matches),
    serveThirdShot: serveThirdShotTable(rallies),
    zoneWeakness: analyzeZoneWeakness(rallies),
    trainingPlan: generateTrainingPlan(matches),
    predictability: analyzeResponsePredictability(matches),
  };
};

// ===================================================================
//  ZONE WEAKNESS ANALYSIS (Phase 8)
//  Don't claim "backhand rear-court weakness" from target zone alone.
//  Only claim a backhand issue if originZone / bodySide / contactQuality
//  support it. Otherwise return a neutral, evidence-aware finding.
// ===================================================================

// Optional shot fields used here:
//   originZone               (1-9) — where Son was when he hit
//   targetZone               (1-9) — where the shot landed (alias of `zone`)
//   contactQuality           "clean" | "late" | "stretched" | "offbalance"
//   bodySide                 "forehand" | "backhand"
//   recoveryQuality          "good" | "slow" | "lost"
//   previousOpponentShotType (string)
//   previousOpponentShotZone (1-9)

const REAR_TARGET_ZONES = new Set([7, 8, 9]); // back-row landings

// "Backhand rear corner" target zones (left rear for right-handers).
// We use the layout in src/lib/rally.js — Zone 7 is back-left.
const BACKHAND_REAR_TARGETS = new Set([7]);

const isPoorContact = (q) => q === "late" || q === "stretched" || q === "offbalance";

// Aggregate Son's *errors* by target zone, then check origin / body-side /
// contact evidence (most of which is now derivable from the previous shot
// thanks to deriveShotContext) to decide whether a backhand-rear weakness
// claim is supported.
//
// Only Son shots are considered (Son's technical issue, by definition).
//
// Output:
//   {
//     totalErrors,                  // # of Son UE losses with a final shot
//     rearTargetErrors,             // errors landing in 7/8/9
//     backhandTargetErrors,         // errors landing in 7 (BH rear corner)
//     inferredOriginErrors,         // errors with a derivable origin zone
//     errorsWithCapturedOrigin,     // errors with explicit shot.originZone
//     errorsWithContactData,        // errors with a contactQuality tag
//     supportedBackhandClaim,       // true only if evidence supports it
//     originSourceMix:              // breakdown for transparency
//       { captured, derived, serve, unknown },
//     finding:                      // human string, used by report + markdown
//   }
export const analyzeZoneWeakness = (rallies) => {
  // Collect Son's error shots along with their derived context.
  const sonErrors = [];
  for (const r of rallies) {
    if (r.result !== "UE" || r.pointWonBy !== "O") continue;
    const idx = r.shots.length - 1;
    const last = r.shots[idx];
    if (!last) continue;
    const ctx = deriveShotContext(r, idx);
    // Be permissive: if we can't determine the hitter (e.g. no server set
    // on legacy data), assume it's Son since a UE loss is by Son's hand.
    if (ctx?.hitBy === "O") continue;
    sonErrors.push({ shot: last, ctx });
  }

  const totalErrors = sonErrors.length;
  let rearTargetErrors = 0;
  let backhandTargetErrors = 0;
  let bhRearWithOriginEvidence = 0;
  let bhRearWithContactEvidence = 0;
  let bhRearWithBodySideEvidence = 0;
  let inferredOriginErrors = 0;
  let errorsWithCapturedOrigin = 0;
  let errorsWithContactData = 0;
  const originSourceMix = { captured: 0, derived: 0, serve: 0, unknown: 0 };

  for (const { shot: s, ctx } of sonErrors) {
    const target = ctx?.targetZone ?? s.zone;
    const origin = ctx?.inferredOriginZone;
    const source = ctx?.originZoneSource || "unknown";

    if (source === "captured") {
      originSourceMix.captured++;
      errorsWithCapturedOrigin++;
      inferredOriginErrors++;
    } else if (source === "derived_from_previous_opponent_shot") {
      originSourceMix.derived++;
      inferredOriginErrors++;
    } else if (source === "serve") {
      originSourceMix.serve++;
    } else {
      originSourceMix.unknown++;
    }

    if (REAR_TARGET_ZONES.has(target)) rearTargetErrors++;
    if (BACKHAND_REAR_TARGETS.has(target)) {
      backhandTargetErrors++;
      if (origin === 7) bhRearWithOriginEvidence++;
      if (isPoorContact(s.contactQuality)) bhRearWithContactEvidence++;
      if (ctx?.bodySide === "backhand") bhRearWithBodySideEvidence++;
    }
    if (s.contactQuality) errorsWithContactData++;
  }

  // Need at least 2 backhand-rear errors AND supporting evidence on a
  // majority of them before we'll make the technical claim.
  const supportingEvidenceCount =
    bhRearWithOriginEvidence + bhRearWithContactEvidence + bhRearWithBodySideEvidence;
  const supportedBackhandClaim =
    backhandTargetErrors >= 2 &&
    supportingEvidenceCount >= Math.ceil(backhandTargetErrors / 2);

  let finding;
  if (totalErrors === 0) {
    finding = "No unforced errors captured yet — zone weakness analysis pending.";
  } else if (backhandTargetErrors === 0) {
    finding = "Errors are spread across the court; no backhand-rear concentration.";
  } else if (supportedBackhandClaim) {
    const originNote =
      originSourceMix.captured > 0 && originSourceMix.derived === 0
        ? "captured origin"
        : originSourceMix.derived > 0 && originSourceMix.captured === 0
        ? "origin inferred from previous opponent shot"
        : "origin from a mix of captured and inferred data";
    finding =
      `Backhand rear court appears genuinely weak — ${backhandTargetErrors} errors at Z7 ` +
      `with origin / contact / body-side evidence (${originNote}).`;
  } else {
    finding =
      "Target-zone errors suggest a possible weakness. Inferred origin is " +
      "available from prior-shot context but body-side or contact-quality " +
      "data is still needed to confirm the technical cause.";
  }

  return {
    totalErrors,
    rearTargetErrors,
    backhandTargetErrors,
    inferredOriginErrors,
    errorsWithCapturedOrigin,
    errorsWithContactData,
    supportedBackhandClaim,
    originSourceMix,
    finding,
  };
};

// ===================================================================
//  RESPONSE PREDICTABILITY (pattern mining)
//
//  For every Son shot that follows an Opponent shot, build:
//    stimulusKey = `<oppShotType>-Z<oppZone>`
//    responseKey = `<grip>-<shotType>-<dir>-Z<zone>`  (Son's response)
//
//  Group events by stimulus, compute response distribution, win/UE rates
//  per response, classify the dominant response, and surface alternative
//  response recommendations when the most-common response underperforms a
//  less-used option.
//
//  Pure deterministic counts — no LLM, no extrapolation. Sample-size
//  gating built in (5 minimum to surface as a major insight).
//
//  Phase filter: { phase: "all" | "clutch" | "leading" | "trailing" |
//                          "after_lost_point" }
// ===================================================================

const RESP_KEY = (s) =>
  `${s.grip || "?"}-${s.shotType || "?"}-${s.dir || "?"}-Z${s.zone ?? "?"}`;

// Format a stimulus / response into a readable, terse string.
const formatStimulus = (oppShot) =>
  `Opp ${oppShot.shotType}-Z${oppShot.zone}`;
const formatResponse = (sonShot) =>
  `Son ${sonShot.grip || "?"}-${sonShot.shotType}-${sonShot.dir || "?"}-Z${sonShot.zone}`;

// Whether a rally satisfies the requested pressure phase.
//
// Score-based phases (clutch / leading / trailing) read `r.score`, which
// is the *pre-rally* score recorded by initRally() at the moment the rally
// began (e.g. "16-15" → Son leading, in clutch).
//
// `after_lost_point` requires `prevRally` to be the immediately preceding
// rally *within the same match and the same set*. The caller is
// responsible for resetting `prevRally` at set/match boundaries.
const matchPhaseFilter = (r, prevRally, phase) => {
  if (!phase || phase === "all") return true;
  const [son, opp] = (r.score || "0-0").split("-").map((n) => Number(n) || 0);
  if (phase === "clutch") return Math.max(son, opp) >= 16;
  if (phase === "leading") return son > opp;
  if (phase === "trailing") return son < opp;
  if (phase === "after_lost_point") return prevRally?.pointWonBy === "O";
  return true;
};

// Classify a stimulus group given its top-response stats.
const classifyPredictability = ({ total, topPct, topWinPct, topUePct }) => {
  const labels = [];
  if (total < 5) {
    labels.push("directional_only");
    return labels;
  }
  if (topPct >= 75) labels.push("strong_predictability");
  else if (topPct >= 60) labels.push("moderate_predictability");
  if (topWinPct >= 60 && topUePct <= 15) labels.push("weapon");
  if (topWinPct <= 40 || topUePct >= 25) labels.push("liability");
  return labels;
};

// Build the alternative-response recommendation for a stimulus. If a less-
// used option (count >= 3) outperforms the top response by >= 20 pp on
// win rate, return a recommendation; else null.
const computeAlternativeRecommendation = (responses) => {
  if (!responses || responses.length < 2) return null;
  const top = responses[0];
  for (let i = 1; i < Math.min(3, responses.length); i++) {
    const alt = responses[i];
    if (alt.count < 3) continue;
    if (alt.winPct - top.winPct >= 20) {
      return {
        altResponseKey: alt.responseKey,
        altWinPct: alt.winPct,
        altUePct: alt.uePct,
        altCount: alt.count,
        topWinPct: top.winPct,
        deltaPct: alt.winPct - top.winPct,
        note: "Consider varying response; less-used option is outperforming the predictable response.",
      };
    }
  }
  return null;
};

export const analyzeResponsePredictability = (matches, options = {}) => {
  const { phase = "all", maxEvidence = 5 } = options;

  const groups = new Map();

  // Walk per-match per-set so "after_lost_point" never crosses a set or
  // match boundary, and so rallyIndex is the *within-match* (1-based)
  // position the user expects to see in evidence ("M001 R12").
  for (const m of matches || []) {
    let prevRally = null;
    let prevSet = null;
    for (let rIdx = 0; rIdx < (m.rallies || []).length; rIdx++) {
      const r = m.rallies[rIdx];

      // Reset prevRally when the set changes (or first rally).
      if (prevSet !== null && prevSet !== r.set) prevRally = null;

      if (!matchPhaseFilter(r, prevRally, phase)) {
        prevRally = r;
        prevSet = r.set;
        continue;
      }

      const shots = r.shots || [];
      for (let i = 1; i < shots.length; i++) {
        if (shotHitter(r, i) !== "S") continue;
        const son = shots[i];
        const prev = shots[i - 1];
        if (!prev?.shotType || prev.zone == null) continue;
        if (!son?.shotType || son.zone == null) continue;

        const stimulusKey = `${prev.shotType}-Z${prev.zone}`;
        const responseKey = RESP_KEY(son);

        if (!groups.has(stimulusKey)) {
          groups.set(stimulusKey, {
            stimulusKey,
            incomingShotType: prev.shotType,
            incomingZone: prev.zone,
            events: [],
          });
        }
        const g = groups.get(stimulusKey);
        g.events.push({
          responseKey,
          responseShotType: son.shotType,
          responseGrip: son.grip,
          responseDirection: son.dir,
          responseTargetZone: son.zone,
          responseQuality: son.quality,
          rallyResult: r.result,
          sonWonRally: r.pointWonBy === "S",
          sonUE: r.result === "UE" && r.pointWonBy === "O",
          score: r.score,
          clutch: r.phase === "Clutch",
          evidence: {
            matchId: r.matchId,
            tournamentName: m.tournament || null,
            opponent: m.opponent || null,
            set: r.set,
            rallyIndex: rIdx + 1, // 1-based within-match index
            score: r.score,
            sequenceText: `${formatStimulus(prev)} → ${formatResponse(son)}`,
            pointWonBy: r.pointWonBy,
            result: r.result,
          },
        });
      }

      prevRally = r;
      prevSet = r.set;
    }
  }

  // Build patterns from groups.
  const patterns = [];
  for (const g of groups.values()) {
    const total = g.events.length;
    const dist = new Map();
    for (const e of g.events) {
      if (!dist.has(e.responseKey)) {
        dist.set(e.responseKey, {
          responseKey: e.responseKey,
          responseShotType: e.responseShotType,
          responseGrip: e.responseGrip,
          responseDirection: e.responseDirection,
          responseTargetZone: e.responseTargetZone,
          count: 0,
          wins: 0,
          ues: 0,
        });
      }
      const d = dist.get(e.responseKey);
      d.count++;
      if (e.sonWonRally) d.wins++;
      if (e.sonUE) d.ues++;
    }
    const responses = [...dist.values()]
      .map((d) => ({
        ...d,
        frequencyPct: pct(d.count, total),
        winPct: pct(d.wins, d.count),
        uePct: pct(d.ues, d.count),
      }))
      .sort((a, b) => b.count - a.count || a.responseKey.localeCompare(b.responseKey));

    const topResponse = responses[0];
    const topPct = topResponse ? pct(topResponse.count, total) : 0;
    const classifications = classifyPredictability({
      total,
      topPct,
      topWinPct: topResponse?.winPct ?? 0,
      topUePct: topResponse?.uePct ?? 0,
    });

    // First N events become evidence.
    const evidence = g.events.slice(0, maxEvidence).map((e) => e.evidence);

    patterns.push({
      stimulusKey: g.stimulusKey,
      stimulusLabel: `Opp ${g.incomingShotType} to Z${g.incomingZone}`,
      incomingShotType: g.incomingShotType,
      incomingZone: g.incomingZone,
      total,
      responses,
      topResponse,
      topResponsePct: topPct,
      topResponseWinPct: topResponse?.winPct ?? 0,
      topResponseUePct: topResponse?.uePct ?? 0,
      classifications,
      alternativeRecommendation: computeAlternativeRecommendation(responses),
      evidence,
    });
  }

  return patterns.sort((a, b) => b.total - a.total);
};

// ===================================================================
//  TRAINING PRESCRIPTION GENERATOR (Phase 10)
//  Pulls from the leak engine, score-pressure analysis, serve+3rd-shot
//  table, effectiveness breakdown, and zone weakness to generate up to 5
//  prescriptions in priority order:
//    1. Reduce UE
//    2. Closing-game routine
//    3. Serve + third shot
//    4. Neutral-to-pressure conversion
//    5. Validate zone weakness
//
//  Each prescription: { id, priority, title, why, drills: [string],
//                       severity: "critical"|"high"|"medium"|"low",
//                       confidence: <level from computeSampleConfidence> }
// ===================================================================
export const generateTrainingPlan = (matches) => {
  const rallies = (matches || []).flatMap((m) => m.rallies || []);
  const leaks = analyzePerformanceLeaks(matches);
  const eff = effectivenessBreakdown(rallies);
  const sp = analyzeScorePressure(rallies);
  const zw = analyzeZoneWeakness(rallies);
  const conf = computeSampleConfidence(matches);

  const findLeak = (id) => leaks.find((l) => l.id === id) || { severity: "low", value: 0 };

  const plan = [];

  // 1. Reduce UE — always present; severity from the leak engine.
  const ueLeak = findLeak("ue_rate");
  plan.push({
    id: "reduce_ue",
    priority: 1,
    title: "Reduce unforced errors",
    why:
      `Unforced-error rate is ${ueLeak.value}% (target ≤ ${BENCHMARKS.UE_TARGET_PCT}%). ` +
      `UE is the single biggest scoreboard leak.`,
    drills: [
      "20-shot consistency rallies — clear/drop only, count UE in real time.",
      "Cross-court drop ladder: 5 in a row to one zone, then switch.",
      "Pressure-free serve return to a target funnel — keep the next shot inside the singles tramline.",
    ],
    severity: ueLeak.severity,
    confidence: conf.level,
  });

  // 2. Closing-game routine
  const clutchLeak = findLeak("clutch_ue");
  plan.push({
    id: "closing_game",
    priority: 2,
    title: "Closing-game routine (16+)",
    why:
      clutchLeak.valueLabel === "—"
        ? "Build a default closing-game script before pressure data is available."
        : `Clutch UE deficit: ${clutchLeak.valueLabel}. Risk creeps up with the score.`,
    drills: [
      "Start sets at 18-18 in practice; play to 21 — three rounds, log UE rate.",
      "Define a 'safe serve + 3rd shot' you'll always play at 19+.",
      "Deep-breath + bounce-shuttle reset before every clutch serve.",
    ],
    severity: clutchLeak.severity,
    confidence: conf.level,
  });

  // 3. Serve + third shot
  const threeShotLeak = findLeak("three_shot_win");
  plan.push({
    id: "serve_third",
    priority: 3,
    title: "Serve + third-shot pattern",
    why:
      threeShotLeak.valueLabel === "—"
        ? "Capture more service points to pin down the best serve→3rd-shot combo."
        : `3-shot win rate is ${threeShotLeak.value}% (target ≥ ${BENCHMARKS.THREE_SHOT_WIN_TARGET_PCT}%). ` +
          `Closing the rally inside three shots is the easiest free point.`,
    drills: [
      "Serve to T → expect lift → SM cross. Run 30 reps.",
      "Drive serve once a set as a surprise weapon, no more.",
      "Tag every serve's height + depth quality during a session — find the variant the opponent struggles with.",
    ],
    severity: threeShotLeak.severity,
    confidence: conf.level,
  });

  // 4. Neutral-to-pressure conversion (effectiveness gap)
  const effLeak = findLeak("effective_gap");
  const neutralHigh = eff.total > 0 && eff.nPct > BENCHMARKS.NEUTRAL_HIGH_PCT;
  plan.push({
    id: "neutral_to_pressure",
    priority: 4,
    title: "Convert neutral exchanges into pressure",
    why:
      eff.total === 0
        ? "Tag shot quality (E/N/I) during capture to expose where the rally goes neutral."
        : neutralHigh
        ? `Neutral share is ${eff.nPct}% (>${BENCHMARKS.NEUTRAL_HIGH_PCT}%). Too many rallies stay flat instead of building pressure.`
        : `Effective share is ${eff.ePct}% (target ≥ ${BENCHMARKS.EFFECTIVE_TARGET_PCT}%). Push more shots into Effective.`,
    drills: [
      "Mid-court slice or push to break the neutral pattern; reward yourself for tagging the next shot Effective.",
      "Half-smash from the rear corner once per long rally — force opponent into a lift.",
      "Net-shot + recovery split-step routine to get to the front first.",
    ],
    severity: effLeak.severity,
    confidence: conf.level,
  });

  // 5. Validate zone weakness — emphasis on data capture, not the claim itself.
  plan.push({
    id: "zone_weakness",
    priority: 5,
    title: zw.supportedBackhandClaim
      ? "Drill backhand rear court (evidence supported)"
      : "Validate suspected zone weakness",
    why: zw.finding,
    drills: zw.supportedBackhandClaim
      ? [
          "Round-the-head forehand from BH corner — 3 sets of 10.",
          "Backhand clear to Z9 cross — partner feeds drops to Z7.",
          "Footwork ladder: BH-corner recovery to mid-court within 2 steps.",
        ]
      : [
          "During next session, capture originZone for every error.",
          "Tag bodySide (forehand / backhand) on the last shot of each lost rally.",
          "Add a contactQuality tag (clean / late / stretched / offbalance) so technical attribution is possible.",
        ],
    severity: zw.totalErrors === 0 ? "low" : "medium",
    confidence: conf.level,
  });

  // Add an extra prescription only if score-pressure has a non-trivial signal.
  if (sp.total >= 1) {
    const dom = ["mental", "physical", "tactical", "mixed"]
      .map((k) => ({ k, n: sp.counts[k] }))
      .sort((a, b) => b.n - a.n)[0];
    if (dom && dom.n >= 1) {
      plan.push({
        id: `pressure_${dom.k}`,
        priority: 6,
        title: `Score-pressure follow-up: ${dom.k} collapses`,
        why:
          `${dom.n} loss-streak chunk${dom.n !== 1 ? "s" : ""} classified ${dom.k}. Targeted reset routine.`,
        drills:
          dom.k === "physical"
            ? ["Insert a high defensive clear after rallies > 15 shots.", "Conditioning ladder: 6×400m + footwork sets."]
            : dom.k === "tactical"
            ? ["Drill counter-attack from defensive postures.", "Watch tape: identify which shot the opponent hits clean."]
            : dom.k === "mixed"
            ? ["Two-week mix of conditioning + reset routines.", "Re-evaluate after next 3 matches."]
            : [
                "Point-by-point reset: breathe, bounce shuttle, look at back line, serve.",
                "Pre-serve cue word — pick one and use it on every clutch point.",
              ],
        severity:
          dom.k === "tactical" || dom.k === "mixed"
            ? "high"
            : dom.n >= 2 ? "high" : "medium",
        confidence: conf.level,
      });
    }
  }

  return plan;
};

// ===================================================================
//  ADVANCED / CONTEXTUAL ANALYTICS  (Tactical Cleverness section)
// ===================================================================

// (x, y) layout — x = 1/2/3 across (L/C/R), y = 1/2/3 from front to back.
// Max diagonal distance is sqrt(8) ≈ 2.83 (zone 1 → zone 9).
export const ZONE_XY = {
  1: [1, 1], 2: [2, 1], 3: [3, 1],
  4: [1, 2], 5: [2, 2], 6: [3, 2],
  7: [1, 3], 8: [2, 3], 9: [3, 3],
};
export const MAX_ZONE_DIST = Math.sqrt(8);

export const zoneDistance = (z1, z2) => {
  const A = ZONE_XY[z1], B = ZONE_XY[z2];
  if (!A || !B) return 0;
  const dx = A[0] - B[0], dy = A[1] - B[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// ---------- 1. Displacement Index ----------
// Average Euclidean distance between consecutive shot zones, split between
// rallies Son won and rallies he lost. >2.0 on wins = winning through
// movement; <1.2 = winning through raw power.
export const displacementIndex = (rallies) => {
  let wSum = 0, wRallies = 0, wPairs = 0;
  let lSum = 0, lRallies = 0, lPairs = 0;
  for (const r of rallies) {
    if (r.shots.length < 2) continue;
    let sum = 0, pairs = 0;
    for (let i = 1; i < r.shots.length; i++) {
      const a = r.shots[i - 1].zone, b = r.shots[i].zone;
      if (!a || !b) continue;
      sum += zoneDistance(a, b); pairs++;
    }
    if (pairs === 0) continue;
    const avg = sum / pairs;
    if (r.pointWonBy === "S") { wSum += avg; wRallies++; wPairs += pairs; }
    else if (r.pointWonBy === "O") { lSum += avg; lRallies++; lPairs += pairs; }
  }
  const won = wRallies ? +(wSum / wRallies).toFixed(2) : 0;
  const lost = lRallies ? +(lSum / lRallies).toFixed(2) : 0;
  let verdict = "insufficient";
  if (wRallies >= 3) {
    if (won > 2.0) verdict = "movement-driven";
    else if (won < 1.2) verdict = "power-driven";
    else verdict = "balanced";
  }
  return {
    won, lost,
    wonRallies: wRallies, lostRallies: lRallies,
    wonPairs: wPairs, lostPairs: lPairs,
    delta: +(won - lost).toFixed(2),
    max: +MAX_ZONE_DIST.toFixed(2),
    verdict,
  };
};

// ---------- 2. Kill Chain ----------
// For rallies Son won as Winners, find the setup shot: shots[n-3] (his own
// shot two turns before the winner, assuming perfectly alternating hits).
// Group by "setup shotType+zone → winner shotType+zone" and sort desc.
export const killChain = (rallies) => {
  const counts = new Map();
  let total = 0;
  for (const r of rallies) {
    if (r.result !== "W" || r.pointWonBy !== "S") continue;
    if (r.shots.length < 3) continue;
    const n = r.shots.length;
    const setup = r.shots[n - 3];
    const winner = r.shots[n - 1];
    if (!setup?.shotType || !winner?.shotType) continue;
    total++;
    const setupLabel = `${setup.shotType}${setup.zone ? `·Z${setup.zone}` : ""}`;
    const winnerLabel = `${winner.shotType}${winner.zone ? `·Z${winner.zone}` : ""}`;
    const key = `${setupLabel} → ${winnerLabel}`;
    const row = counts.get(key) || {
      key, setupLabel, winnerLabel,
      setupShot: setup.shotType, setupZone: setup.zone,
      winnerShot: winner.shotType, winnerZone: winner.zone,
      count: 0,
    };
    row.count++;
    counts.set(key, row);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  return { totalWinners: total, top };
};

// ---------- 3. Serve ROI ----------
// Win % per Son serve type, split by early phase (both scores < 12) and
// late phase (either score >= 12). "Decay" = early% − late%; positive values
// suggest the opponent has figured the serve out as the set progressed.
export const serveROI = (rallies) => {
  const mk = () => ({ pts: 0, won: 0, pct: 0 });
  const tab = {
    LS: { early: mk(), late: mk() },
    FS: { early: mk(), late: mk() },
    DS: { early: mk(), late: mk() },
  };
  for (const r of rallies) {
    if (r.server !== "S" || r.shots.length === 0) continue;
    const serve = r.shots[0];
    const type = serve.shotType;
    if (!tab[type]) continue;
    const [son, opp] = (r.score || "0-0").split("-").map(Number);
    const phase = Math.max(son || 0, opp || 0) >= 11 ? "late" : "early";
    const bucket = tab[type][phase];
    bucket.pts++;
    if (r.pointWonBy === "S") bucket.won++;
  }
  const out = {};
  for (const [type, phases] of Object.entries(tab)) {
    phases.early.pct = pct(phases.early.won, phases.early.pts);
    phases.late.pct = pct(phases.late.won, phases.late.pts);
    const totalPts = phases.early.pts + phases.late.pts;
    const totalWon = phases.early.won + phases.late.won;
    out[type] = {
      ...phases,
      overall: { pts: totalPts, won: totalWon, pct: pct(totalWon, totalPts) },
      // `decay` is meaningful only when both phases have data.
      decay: phases.early.pts >= 2 && phases.late.pts >= 2
        ? phases.early.pct - phases.late.pct
        : null,
    };
  }
  return out;
};

// ---------- 4. Recovery Leak ----------
// Rallies opp won as a Winner. Look at the gap between Son's last shot
// zone (shots[n-2]) and opp's finisher zone (shots[n-1]). Large diagonals
// (>= 2.5) mean Son was recovering to the wrong base.
export const recoveryLeak = (rallies) => {
  const patterns = new Map();
  let total = 0;
  let longDiagonal = 0;
  const dists = [];
  for (const r of rallies) {
    if (r.pointWonBy !== "O" || r.result !== "W") continue;
    if (r.shots.length < 2) continue;
    const n = r.shots.length;
    const sonLast = r.shots[n - 2];
    const oppWinner = r.shots[n - 1];
    if (!sonLast?.zone || !oppWinner?.zone) continue;
    total++;
    const dist = zoneDistance(sonLast.zone, oppWinner.zone);
    dists.push(dist);
    if (dist >= 2.5) longDiagonal++;
    const key = `Z${sonLast.zone} → Z${oppWinner.zone}`;
    const row = patterns.get(key) || {
      key,
      sonZone: sonLast.zone,
      oppZone: oppWinner.zone,
      dist: +dist.toFixed(2),
      count: 0,
    };
    row.count++;
    patterns.set(key, row);
  }
  const avgDist = dists.length ? +(dists.reduce((a, b) => a + b, 0) / dists.length).toFixed(2) : 0;
  const top = [...patterns.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  return {
    total,
    longDiagonal,
    longDiagonalPct: pct(longDiagonal, total),
    avgDist,
    top,
    maxDist: +MAX_ZONE_DIST.toFixed(2),
  };
};

// ---------- 5. Momentum Chunks ----------
// Walk the rallies in capture order. Any run of 3+ consecutive son losses
// is a "chunk". Preceding rally length classifies: prev > 15 shots =>
// physical collapse (he was gassed); else mental/focus collapse.
export const momentumChunks = (rallies) => {
  const chunks = [];
  let i = 0;
  while (i < rallies.length) {
    if (rallies[i].pointWonBy !== "O") { i++; continue; }
    const start = i;
    while (i < rallies.length && rallies[i].pointWonBy === "O") i++;
    const end = i - 1;
    const length = end - start + 1;
    if (length < 3) continue;
    const chunkRallies = rallies.slice(start, end + 1);
    const avgLen = +(chunkRallies.reduce((a, r) => a + r.shots.length, 0) / chunkRallies.length).toFixed(1);
    const ueCount = chunkRallies.filter(isSonUE).length;
    const ueRate = pct(ueCount, chunkRallies.length);
    const prev = start > 0 ? rallies[start - 1] : null;
    const prevLen = prev?.shots.length || 0;
    const classification = prevLen > 15 ? "physical" : prevLen > 0 ? "mental" : "unclassified";
    chunks.push({
      startIdx: start, endIdx: end, length,
      set: chunkRallies[0].set,
      scores: chunkRallies.map((r) => r.score),
      avgLen, ueRate,
      prevLen,
      classification,
    });
  }
  return {
    chunks,
    physical: chunks.filter((c) => c.classification === "physical").length,
    mental: chunks.filter((c) => c.classification === "mental").length,
    unclassified: chunks.filter((c) => c.classification === "unclassified").length,
    total: chunks.length,
  };
};

// ---------- 6. Score-pressure / loss-streak classification (Phase 6) ----------
// Walks rallies in capture order, finds runs of 3+ son losses (same shape
// as momentumChunks), but classifies each chunk into:
//
//   mental   — focus/decision collapse (avg rally <= 10, UE >= 50%, length >= 3)
//   physical — fitness collapse (avg rally > 12 OR previous rally > 15)
//   tactical — opponent winners/forced errors dominate (opp W/FE >= 60%)
//   mixed    — multiple of the above true
//   unclassified — none triggered
//
// Returns: { chunks: [...], counts: {mental, physical, tactical, mixed, unclassified}, total }
export const analyzeScorePressure = (rallies) => {
  const chunks = [];
  let i = 0;
  while (i < rallies.length) {
    if (rallies[i].pointWonBy !== "O") { i++; continue; }
    const start = i;
    while (i < rallies.length && rallies[i].pointWonBy === "O") i++;
    const end = i - 1;
    const length = end - start + 1;
    if (length < 3) continue;
    const chunkRallies = rallies.slice(start, end + 1);

    const avgLen = +(
      chunkRallies.reduce((a, r) => a + r.shots.length, 0) / chunkRallies.length
    ).toFixed(1);

    const ueCount = chunkRallies.filter(isSonUE).length;
    const ueRate = pct(ueCount, chunkRallies.length);

    // Opp dominance: rallies opponent won as W or where Son's last shot was
    // a forced error against him (FE with opp winning).
    const oppDominated = chunkRallies.filter(
      (r) => (r.result === "W" && r.pointWonBy === "O") ||
             (r.result === "FE" && r.pointWonBy === "O"),
    ).length;
    const oppDomRate = pct(oppDominated, chunkRallies.length);

    const prev = start > 0 ? rallies[start - 1] : null;
    const prevLen = prev?.shots.length || 0;

    // Rule application — a chunk can fire multiple rules.
    const reasons = [];
    if (length >= 3 && ueRate >= 50 && avgLen <= 10) reasons.push("mental");
    if (avgLen > 12 || prevLen > 15) reasons.push("physical");
    if (oppDomRate >= 60) reasons.push("tactical");

    const classification =
      reasons.length === 0 ? "unclassified"
      : reasons.length === 1 ? reasons[0]
      : "mixed";

    chunks.push({
      startIdx: start,
      endIdx: end,
      length,
      set: chunkRallies[0].set,
      scores: chunkRallies.map((r) => r.score),
      avgLen,
      ueRate,
      ueCount,
      oppDominated,
      oppDomRate,
      prevLen,
      classification,
      reasons,
    });
  }

  const countBy = (k) => chunks.filter((c) => c.classification === k).length;
  return {
    chunks,
    counts: {
      mental: countBy("mental"),
      physical: countBy("physical"),
      tactical: countBy("tactical"),
      mixed: countBy("mixed"),
      unclassified: countBy("unclassified"),
    },
    total: chunks.length,
  };
};

// ---------- 7. Kill-chain analysis (Phase 9) ----------
// For rallies Son ended as Winner OR rallies Son won via opponent forced
// error, group setups of length 1, 2, or 3 leading to the finish. Patterns
// are only labelled "repeatable" when their count >= PATTERN_MIN_COUNT.
//
// Caller can ask for a single setup length via `setupLen`, or the bundled
// version via analyzeKillChains() which returns all three.
export const killChainSetups = (rallies, setupLen = 3) => {
  const counts = new Map();
  let totalFinishes = 0;

  for (const r of rallies) {
    const finish = r.shots[r.shots.length - 1];
    if (!finish) continue;
    // Son finished the rally via Winner (W with pointWonBy S) or by Opp's
    // forced error (FE with pointWonBy S).
    const sonFinished =
      r.pointWonBy === "S" && (r.result === "W" || r.result === "FE");
    if (!sonFinished) continue;
    if (r.shots.length < setupLen + 1) continue;

    totalFinishes++;
    const setupShots = r.shots.slice(-1 - setupLen, -1);
    const setupKey = setupShots
      .map((s) => `${s.shotType || "?"}${s.zone ? `·Z${s.zone}` : ""}`)
      .join(" → ");
    const finishKey = `${finish.shotType || "?"}${finish.zone ? `·Z${finish.zone}` : ""}`;
    const key = `${setupKey} → ${finishKey}`;
    if (!counts.has(key)) {
      counts.set(key, {
        key,
        setup: setupKey,
        finish: finishKey,
        finishShot: finish.shotType,
        finishZone: finish.zone,
        finishResult: r.result, // "W" or "FE"
        count: 0,
      });
    }
    counts.get(key).count++;
  }

  const all = [...counts.values()].sort((a, b) => b.count - a.count);
  const repeatable = all.filter((p) => p.count >= PATTERN_MIN_COUNT);
  return {
    setupLen,
    totalFinishes,
    all,
    repeatable,
    // Convenience: the dominant pattern, if it's repeatable.
    top: all[0] || null,
    hasRepeatable: repeatable.length > 0,
  };
};

export const analyzeKillChains = (rallies) => {
  const oneShot   = killChainSetups(rallies, 1);
  const twoShot   = killChainSetups(rallies, 2);
  const threeShot = killChainSetups(rallies, 3);
  const anyRepeatable =
    oneShot.hasRepeatable || twoShot.hasRepeatable || threeShot.hasRepeatable;
  return {
    oneShot,
    twoShot,
    threeShot,
    anyRepeatable,
    finding: anyRepeatable
      ? "Repeatable point-construction patterns detected — these are reliable setups."
      : oneShot.totalFinishes + twoShot.totalFinishes + threeShot.totalFinishes > 0
      ? "Winners exist, but repeatable point-construction patterns are not yet established."
      : "No winning finishes captured yet.",
  };
};

// One-shot bundler for the report.
export const advancedInsights = (rallies) => ({
  displacement: displacementIndex(rallies),
  killChains: killChain(rallies),
  serveROI: serveROI(rallies),
  recoveryLeak: recoveryLeak(rallies),
  momentum: momentumChunks(rallies),
  scorePressure: analyzeScorePressure(rallies),
  killChainAnalysis: analyzeKillChains(rallies),
});

// ===================================================================
//  SAMPLE CONFIDENCE
//  How much should the reader trust a finding given the data we've got?
//  Returns a coarse band so we can annotate every section that's
//  sensitive to small N: zone findings, serve findings, playing style,
//  clutch findings, cross-tournament trends.
// ===================================================================
export const computeSampleConfidence = (matches) => {
  const matchesCount = matches?.length || 0;
  const ralliesCount = (matches || []).reduce(
    (a, m) => a + (m.rallies?.length || 0),
    0,
  );

  let level;
  if (
    matchesCount < SAMPLE_CONFIDENCE.VERY_LOW_MAX_MATCHES ||
    ralliesCount < SAMPLE_CONFIDENCE.VERY_LOW_MAX_RALLIES
  ) {
    level = "very_low";
  } else if (
    matchesCount < SAMPLE_CONFIDENCE.LOW_MAX_MATCHES ||
    ralliesCount < SAMPLE_CONFIDENCE.LOW_MAX_RALLIES
  ) {
    level = "low";
  } else if (
    matchesCount < SAMPLE_CONFIDENCE.MEDIUM_MAX_MATCHES ||
    ralliesCount < SAMPLE_CONFIDENCE.MEDIUM_MAX_RALLIES
  ) {
    level = "medium";
  } else {
    level = "high";
  }

  // Per spec: "very low" must surface as "directional only" so we never
  // over-claim from a single match.
  const labels = {
    very_low: "directional only",
    low: "low confidence",
    medium: "medium confidence",
    high: "high confidence",
  };
  const tones = {
    very_low: "warn",
    low: "warn",
    medium: "info",
    high: "good",
  };

  return {
    level,
    label: labels[level],
    tone: tones[level],
    matches: matchesCount,
    rallies: ralliesCount,
    // Convenience flags for callers.
    isDirectional: level === "very_low",
    isStrong: level === "high",
  };
};

// Map a confidence level to the wording suffix we use on a single finding.
export const confidenceSuffix = (level) => {
  switch (level) {
    case "very_low": return "directional only";
    case "low":      return "low confidence";
    case "medium":   return "medium confidence";
    case "high":     return "high confidence";
    default:         return "";
  }
};

// ===================================================================
//  PERFORMANCE LEAK ENGINE
//  Ranks the five most actionable leaks for the player. Output is a
//  stable-shape array of { id, title, value, valueLabel, severity,
//  detail }, sorted in priority order:
//    1. UE rate
//    2. Clutch UE deficit (clutch UE% − overall UE%)
//    3. Late-set UE increase (second-half rate vs first-half)
//    4. 3-shot win rate (must beat THREE_SHOT_WIN_TARGET_PCT)
//    5. Effectiveness gap (E% vs target)
//
//  Severity bands re-use uePctSeverity for the UE-rate leak, and use
//  comparable thresholds for the others so the report colouring stays
//  consistent.
// ===================================================================

const overallUePct = (rallies) => {
  if (!rallies.length) return 0;
  const ue = rallies.filter((r) => r.result === "UE" && r.pointWonBy === "O").length;
  return Math.round((ue / rallies.length) * 100);
};

// Severity for non-UE-rate leaks: deficit / gap measured in percentage
// points where bigger = worse.
const ppSeverity = (deltaPp) => {
  if (deltaPp >= 15) return "critical";
  if (deltaPp >= 10) return "high";
  if (deltaPp >= 5)  return "medium";
  return "low";
};

// 3-shot win rate severity: distance below target.
const threeShotSeverity = (winPct) => {
  const gap = BENCHMARKS.THREE_SHOT_WIN_TARGET_PCT - winPct;
  if (gap >= 25) return "critical";
  if (gap >= 15) return "high";
  if (gap >= 5)  return "medium";
  return "low";
};

// Effectiveness gap severity: distance below target.
const effectivenessSeverity = (ePct) => {
  const gap = BENCHMARKS.EFFECTIVE_TARGET_PCT - ePct;
  if (gap >= 20) return "critical";
  if (gap >= 10) return "high";
  if (gap >= 3)  return "medium";
  return "low";
};

export const analyzePerformanceLeaks = (matches) => {
  const rallies = (matches || []).flatMap((m) => m.rallies || []);
  const leaks = [];

  // 1. UE rate
  const uePct = overallUePct(rallies);
  leaks.push({
    id: "ue_rate",
    rank: 1,
    title: "Unforced-error rate",
    value: uePct,
    valueLabel: `${uePct}%`,
    target: `≤ ${BENCHMARKS.UE_TARGET_PCT}%`,
    severity: uePctSeverity(uePct),
    detail:
      `${rallies.filter((r) => r.result === "UE" && r.pointWonBy === "O").length} ` +
      `unforced errors across ${rallies.length} rallies. ` +
      `Target ${BENCHMARKS.UE_TARGET_PCT}% — keep risky finish patterns rare and tighten last-shot quality.`,
  });

  // 2. Clutch UE deficit
  const clutch = clutchStats(rallies);
  leaks.push({
    id: "clutch_ue",
    rank: 2,
    title: "Clutch UE deficit (16+ vs overall)",
    value: clutch.deficit,
    valueLabel: `${clutch.clutchUEPct}% vs ${clutch.overallUEPct}% (Δ ${clutch.deficit >= 0 ? "+" : ""}${clutch.deficit}pp)`,
    target: `≤ ${BENCHMARKS.CLUTCH_DEFICIT_WARN_PP}pp`,
    severity: ppSeverity(Math.max(0, clutch.deficit)),
    detail:
      clutch.clutchPoints === 0
        ? "No clutch points captured yet."
        : `Under 16+ pressure, UE rate is ${clutch.clutchUEPct}% vs ${clutch.overallUEPct}% baseline ` +
          `(${clutch.clutchPoints} clutch points). Drill closing-game scripts to keep risk constant.`,
  });

  // 3. Late-set UE increase (first vs second half of each set)
  const fatigue = fatigueStats(matches || []);
  const lateDelta = (fatigue.secondHalf.rate || 0) - (fatigue.firstHalf.rate || 0);
  leaks.push({
    id: "late_ue",
    rank: 3,
    title: "Late-set UE increase",
    value: lateDelta,
    valueLabel:
      fatigue.firstHalf.points && fatigue.secondHalf.points
        ? `${fatigue.firstHalf.rate}% → ${fatigue.secondHalf.rate}% (Δ ${lateDelta >= 0 ? "+" : ""}${lateDelta}pp)`
        : "—",
    target: "no rise in 2nd half",
    severity: ppSeverity(Math.max(0, lateDelta)),
    detail:
      fatigue.firstHalf.points && fatigue.secondHalf.points
        ? `Second-half UE rate is ${lateDelta >= 0 ? "up" : "down"} ${Math.abs(lateDelta)}pp ` +
          `vs first half. Conditioning + safe-shot defaults late.`
        : "Need both halves of a set with rallies to assess.",
  });

  // 4. 3-shot win rate
  const sr = serveReturnStats(rallies);
  leaks.push({
    id: "three_shot_win",
    rank: 4,
    title: "3-shot opening win rate",
    value: sr.threeShotWinPct,
    valueLabel:
      sr.threeShotPoints === 0
        ? "—"
        : `${sr.threeShotWinPct}% (${sr.threeShotWon}/${sr.threeShotPoints})`,
    target: `≥ ${BENCHMARKS.THREE_SHOT_WIN_TARGET_PCT}%`,
    severity: sr.threeShotPoints === 0 ? "low" : threeShotSeverity(sr.threeShotWinPct),
    detail:
      sr.threeShotPoints === 0
        ? "No service points captured yet."
        : `Closing serves in ≤ 3 shots wins ${sr.threeShotWinPct}% — target ` +
          `${BENCHMARKS.THREE_SHOT_WIN_TARGET_PCT}%. Build a deliberate serve→3rd-shot pattern.`,
  });

  // 5. Effectiveness gap (E% vs target)
  const eff = effectivenessBreakdown(rallies);
  leaks.push({
    id: "effective_gap",
    rank: 5,
    title: "Effective-shot share vs target",
    value: eff.ePct,
    valueLabel: eff.total === 0 ? "—" : `E ${eff.ePct}% · N ${eff.nPct}% · I ${eff.iPct}%`,
    target: `≥ ${BENCHMARKS.EFFECTIVE_TARGET_PCT}% Effective`,
    severity: eff.total === 0 ? "low" : effectivenessSeverity(eff.ePct),
    detail:
      eff.total === 0
        ? "Quality tagging (E/N/I) not yet captured."
        : `Pro target is ${BENCHMARKS.EFFECTIVE_TARGET_PCT}% Effective; player at ${eff.ePct}%. ` +
          `If Neutral > ${BENCHMARKS.NEUTRAL_HIGH_PCT}% the player is rallying passively — convert neutral exchanges into pressure.`,
  });

  return leaks;
};

// ===================================================================
//  OPPONENT / SCOUTING DERIVATIONS
//  Pure helpers — combine the completed-matches archive with the
//  opponent-profile map from the store (notes + AI insights) and return
//  shapes the Scouting screen and Markdown exports can render directly.
// ===================================================================

export const normalizeOpponentKey = (name) => (name || "").trim().toLowerCase();

// List every opponent we've played, most recent first. Rows carry aggregate
// career numbers plus the profile blob (notes / aiInsights) if one exists.
// Profiles without any matches are included too — user may register a
// dossier before the first encounter.
export const listOpponents = (matches, opponents = {}) => {
  const byKey = new Map();
  for (const m of matches) {
    const key = normalizeOpponentKey(m.opponent);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, { key, name: m.opponent, matches: [] });
    byKey.get(key).matches.push(m);
  }
  for (const [key, prof] of Object.entries(opponents || {})) {
    if (!byKey.has(key)) byKey.set(key, { key, name: prof.name, matches: [] });
  }

  return [...byKey.values()]
    .map((row) => {
      const prof = opponents[row.key] || null;
      const wins = row.matches.filter((m) => {
        const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
        return setsWon > m.sets.length / 2;
      }).length;
      const rallies = row.matches.flatMap((m) => m.rallies);
      const lastPlayed = row.matches
        .map((m) => m.date || "")
        .sort()
        .reverse()[0] || null;
      const tournaments = [...new Set(row.matches.map((m) => m.tournament).filter(Boolean))];
      return {
        key: row.key,
        name: prof?.name || row.name,
        notes: prof?.notes || "",
        aiInsights: prof?.aiInsights || "",
        profile: prof,
        matchesPlayed: row.matches.length,
        wins,
        losses: row.matches.length - wins,
        rallies: rallies.length,
        lastPlayed,
        tournaments,
        winRate: row.matches.length > 0 ? pct(wins, row.matches.length) : 0,
      };
    })
    .sort((a, b) => {
      // Most recent first, then by name for stability.
      const d = (b.lastPlayed || "").localeCompare(a.lastPlayed || "");
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
};

// Full dossier for one opponent: every match, every rally, the full
// reportBundle of career analytics filtered to this opponent, plus the
// raw profile fields (notes, AI insights) for Markdown / UI consumption.
export const opponentDossier = (matches, opponentName, opponents = {}) => {
  const key = normalizeOpponentKey(opponentName);
  const filtered = matches.filter((m) => normalizeOpponentKey(m.opponent) === key);
  const rallies = filtered.flatMap((m) => m.rallies);
  const prof = opponents[key] || null;
  const wins = filtered.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;
  return {
    key,
    name: prof?.name || opponentName,
    notes: prof?.notes || "",
    aiInsights: prof?.aiInsights || "",
    profile: prof,
    matches: filtered,
    rallies,
    matchesPlayed: filtered.length,
    wins,
    losses: filtered.length - wins,
    winRate: filtered.length > 0 ? pct(wins, filtered.length) : 0,
    tournaments: [...new Set(filtered.map((m) => m.tournament).filter(Boolean))],
    bundle: filtered.length > 0 ? reportBundle(filtered) : null,
  };
};

// Tournament-level grouping: unique tournament names + their match counts.
// Used by the Report screen's future Tournament/Career toggle.
export const listTournaments = (matches) => {
  const map = new Map();
  for (const m of matches) {
    const name = (m.tournament || "").trim() || "Other";
    if (!map.has(name)) {
      map.set(name, { name, matches: [], firstDate: m.date, lastDate: m.date });
    }
    const t = map.get(name);
    t.matches.push(m);
    if ((m.date || "") < (t.firstDate || "")) t.firstDate = m.date;
    if ((m.date || "") > (t.lastDate || "")) t.lastDate = m.date;
  }
  return [...map.values()].sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
};
