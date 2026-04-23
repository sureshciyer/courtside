// Pure analytics helpers for the Patterns dashboard and the Report screen.
// No React, no store — everything here consumes the plain `matches` array.

import { DISRUPTION_SHOTS, SHOT_NAMES } from "../constants/badminton.js";

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

// Deception Index: Holds (HS) + Slices (SL) use across captured matches.
export const deceptionStats = (matches) => {
  let holds = 0, slices = 0, total = 0;
  for (const m of matches) for (const r of m.rallies) for (const s of r.shots) {
    if (s.shotType === "HS") holds++;
    if (s.shotType === "SL") slices++;
    total++;
  }
  const n = matches.length || 1;
  return {
    holds, slices, total,
    perMatch: +((holds + slices) / n).toFixed(1),
    indexPct: pct(holds + slices, total),
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

// Win rate bucketed by rally length.
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

  const errZ = zoneTallies(rallies, "error");
  const errTotal = Object.values(errZ).reduce((a, v) => a + v, 0);
  const bhErr = (errZ[7] || 0) + (errZ[4] || 0) + (errZ[1] || 0);
  if (errTotal >= 4 && pct(bhErr, errTotal) >= 30) {
    recs.push({
      priority: 2,
      tone: "warn",
      title: "Priority 2: Backhand rear court",
      body: `Left-column zones (1/4/7) account for ${pct(bhErr, errTotal)}% of all unforced errors. Drills: backhand clear to Zone 9 cross, round-the-head forehand from the BH corner.`,
    });
  }

  const dec = deceptionStats(matches);
  if (matches.length >= 2 && dec.perMatch < 3) {
    recs.push({
      priority: 3,
      tone: "info",
      title: "Priority 3: Add deception to clears",
      body: `Only ${dec.perMatch} deception shots per match (${dec.holds} holds, ${dec.slices} slices). Introduce hold-and-vary: pause 0.3s, then alternate clear/drop.`,
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
    serveReturn: serveReturnStats(rallies),
    clutch: clutchStats(rallies),
    fatigue: fatigueStats(matches),
    deception: deceptionStats(matches),
    effectiveness: effectivenessBreakdown(rallies),
    winnerZones: zoneTallies(rallies, "winner"),
    errorZonesAll: zoneTallies(rallies, "error"),
    allZones: zoneTallies(rallies, "all"),
    recs: recommendations(matches),
  };
};
