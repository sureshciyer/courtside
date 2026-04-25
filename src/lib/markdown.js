// Markdown generators for two export flavours:
//   1. matchAnalysisMarkdown(match, {playerName}) — deep-dive for one match
//   2. battlePlanMarkdown(dossier, {playerName})  — pre-match scouting doc
// Both produce ready-to-paste Markdown (tables, headings, code fences) that
// Claude / Gemini / any other LLM can consume directly.

import { reportBundle, setAggregate, pct, winningSequences } from "./analytics.js";
import { SHOT_NAMES, ZONE_LABELS } from "../constants/badminton.js";

// Local helper — tally landing zones for shots tagged with a given quality.
// Used by Patterns Markdown so the "Effective-tagged" heatmap mirrors the
// Patterns screen toggle.
const zoneTalliesByQuality = (rallies, quality) => {
  const z = {};
  for (const r of rallies) {
    for (const s of r.shots) {
      if (s.quality === quality && s.zone) z[s.zone] = (z[s.zone] || 0) + 1;
    }
  }
  return z;
};

// Thin alias so the Patterns Markdown reads cleanly.
const winningSequencesFromBundle = (rallies, n) => winningSequences(rallies, n);

// ---------- tiny formatting helpers ----------

const H1 = (t) => `# ${t}\n\n`;
const H2 = (t) => `## ${t}\n\n`;
const H3 = (t) => `### ${t}\n\n`;
const P  = (t) => `${t}\n\n`;

const table = (header, rows) => {
  if (!rows.length) return "";
  const head = `| ${header.join(" | ")} |`;
  const sep  = `| ${header.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n\n`;
};

const codeBlock = (content, lang = "json") =>
  "```" + lang + "\n" + content + "\n```\n\n";

// 3×3 zone-tally table formatted with labels from ZONE_LABELS.
const zoneTable = (zones) => {
  const at = (n) => zones[n] || 0;
  return [
    "| Front L | T-Junc | Front R |",
    "| --- | --- | --- |",
    `| ${at(1)} (Z1) | ${at(2)} (Z2) | ${at(3)} (Z3) |`,
    `| ${at(4)} (Z4) | ${at(5)} (Z5) | ${at(6)} (Z6) |`,
    `| ${at(7)} (Z7) | ${at(8)} (Z8) | ${at(9)} (Z9) |`,
    "",
    "",
  ].join("\n");
};

const ZONE_HINT = {
  1: "front-left", 2: "T-junction", 3: "front-right",
  4: "mid-left", 5: "body", 6: "mid-right",
  7: "back-left", 8: "back-centre", 9: "back-right",
};

// ===================================================================
//  1. MATCH ANALYSIS
// ===================================================================
export const matchAnalysisMarkdown = (match, { playerName = "Player" } = {}) => {
  if (!match) return "";
  const rallies = match.rallies || [];
  const setsWon = (match.sets || []).filter((s) => s.sonScore > s.oppScore).length;
  const matchWon = setsWon > (match.sets?.length || 0) / 2;

  let md = "";
  md += H1(`🏸 Match analysis — ${playerName} vs ${match.opponent || "Unknown"}`);
  md += P(
    `**Date:** ${match.date || "—"}  \n` +
    `**Match ID:** \`${match.id}\`  \n` +
    (match.tournament ? `**Tournament:** ${match.tournament}  \n` : "") +
    (match.playerStyle && match.playerStyle !== "Unknown"
      ? `**Opponent style:** ${match.playerStyle}  \n` : "") +
    `**Result:** ${matchWon ? "✅ Won" : "❌ Lost"} ${
      (match.sets || []).map((s) => `${s.sonScore}-${s.oppScore}`).join(", ")
    }`
  );

  if (!rallies.length) {
    md += H2("No rally data captured");
    md += P("_This match was ended without any shot-level data._");
    md += rawDataBlock(match);
    return md;
  }

  const bundle = reportBundle([match]);
  const { agg, distribution, lengthProfile, serveReturn, clutch, fatigue,
          deception, effectiveness, winnerZones, errorZonesAll, allZones,
          recs, advanced } = bundle;

  // Headline
  md += H2("Headline stats");
  md += table(["Metric", "Value"], [
    ["Rallies", agg.rallies],
    ["Won / Lost", `${agg.won} / ${agg.lost}`],
    ["Win rate", `${pct(agg.won, agg.rallies)}%`],
    ["Winners (W)", agg.w],
    ["Unforced errors (son)", agg.ue_son],
    ["Avg rally length", `${agg.avgLen} shots`],
  ]);

  // Per-set
  md += H2("Set-by-set");
  const setRows = (match.sets || []).map((s, i) => {
    const setRallies = rallies.filter((r) => r.set === i + 1);
    const a = setAggregate(setRallies);
    const topShot = Object.entries(a.shots)
      .filter(([k]) => !["LS", "FS", "DS"].includes(k))
      .sort((x, y) => y[1] - x[1])[0];
    const setWon = s.sonScore > s.oppScore;
    return [
      `Set ${i + 1}`,
      `${s.sonScore}-${s.oppScore} ${setWon ? "✅" : "❌"}`,
      a.rallies, a.w, a.fe, a.ue_son,
      `${pct(a.ue_son, a.rallies)}%`,
      a.avgLen,
      topShot ? `${SHOT_NAMES[topShot[0]] || topShot[0]} (${topShot[1]})` : "—",
    ];
  });
  md += table(
    ["Set", "Score", "Rallies", "W", "FE", "UE", "UE%", "Avg len", "Top shot"],
    setRows
  );

  // Shot distribution
  if (distribution.length) {
    md += H2("Shot distribution");
    md += table(
      ["Shot", "Count", "Share"],
      distribution.slice(0, 12).map((s) => [s.name, s.count, `${s.pct}%`])
    );
  }

  // Zone heatmaps
  md += H2("Zone heatmaps");
  md += H3("Winner zones");
  md += zoneTable(winnerZones);
  md += H3("Unforced-error zones");
  md += zoneTable(errorZonesAll);
  md += H3("All shot targets");
  md += zoneTable(allZones);

  // Serve & return
  md += H2("Serve & return");
  md += table(
    ["Metric", "Value", "Pts"],
    [
      ["Serve win %", `${serveReturn.serveWinPct}%`, `${serveReturn.serveWon}/${serveReturn.servePoints}`],
      ["Return win %", `${serveReturn.returnWinPct}%`, `${serveReturn.returnWon}/${serveReturn.returnPoints}`],
      ["3-shot opening win %", `${serveReturn.threeShotWinPct}%`, `${serveReturn.threeShotWon}/${serveReturn.threeShotPoints}`],
    ]
  );

  // Rally length
  md += H2("Rally length profile");
  md += table(
    ["Bucket", "Won", "Lost", "Win %"],
    Object.entries(lengthProfile).map(([b, { w, l }]) => [`${b} shots`, w, l, `${pct(w, w + l)}%`])
  );

  // Clutch
  md += H2("Clutch performance (16+)");
  md += table(["Metric", "Value"], [
    ["Clutch points", clutch.clutchPoints],
    ["Clutch win %", `${clutch.clutchWinPct}%`],
    ["Clutch UE rate", `${clutch.clutchUEPct}%`],
    ["Overall UE rate", `${clutch.overallUEPct}%`],
    ["Deficit", `${clutch.deficit >= 0 ? "+" : ""}${clutch.deficit}pp`],
  ]);

  // Fatigue
  md += H2("Fatigue & endurance");
  md += table(
    ["Half", "UE", "Points", "Rate"],
    [
      ["First (pts 1–11)", fatigue.firstHalf.ue, fatigue.firstHalf.points, `${fatigue.firstHalf.rate}%`],
      ["Second (pts 12–21)", fatigue.secondHalf.ue, fatigue.secondHalf.points, `${fatigue.secondHalf.rate}%`],
    ]
  );
  md += P(`**Fatigue ratio:** ${fatigue.ratio}× _(≥ 2.0 flags a concern)_`);

  // Effectiveness
  md += H2("Effectiveness index");
  md += P(
    `**E:** ${effectiveness.ePct}% · **N:** ${effectiveness.nPct}% · **I:** ${effectiveness.iPct}%  ` +
    `_(Pro target: E ≥ 35 %, I ≤ 15 %)_`
  );

  // Deception
  md += H2("Predictability & deception");
  md += P(`Holds: ${deception.holds} · Slices: ${deception.slices} · Per-match: ${deception.perMatch}`);

  // Tactical cleverness
  md += H2("🧠 Tactical cleverness");
  md += tacticalClevernessMarkdown(advanced);

  // Coaching recs
  md += H2("Coaching recommendations");
  if (recs.length) {
    recs.forEach((r, i) => { md += H3(`${i + 1}. ${r.title}`); md += P(r.body); });
  } else {
    md += P("_Not enough data to generate recommendations._");
  }

  // AI critique
  md += H2("🧠 AI critique");
  md += P(match.aiInsights?.trim() || "_Paste Claude / Gemini tactical analysis here, then re-export._");

  md += rawDataBlock(match);
  return md;
};

// ===================================================================
//  2. BATTLE PLAN (per opponent)
// ===================================================================
export const battlePlanMarkdown = (dossier, { playerName = "Player" } = {}) => {
  if (!dossier) return "";
  const name = dossier.name || "Opponent";

  let md = "";
  md += H1(`🏸 BATTLE PLAN: ${playerName} vs ${name}`);

  if (!dossier.matchesPlayed) {
    md += P(`_No previous encounter captured against ${name}._`);
    if (dossier.notes?.trim()) { md += H2("📝 Scouting notes"); md += P(dossier.notes); }
    if (dossier.aiInsights?.trim()) { md += H2("🧠 AI insights"); md += P(dossier.aiInsights); }
    return md;
  }

  md += P(
    `_Career: **${dossier.wins}W - ${dossier.losses}L** (${dossier.winRate}% win rate) ` +
    `across ${dossier.matchesPlayed} match${dossier.matchesPlayed !== 1 ? "es" : ""}._`
  );

  const b = dossier.bundle;
  const adv = b.advanced;

  // 🎯 TOP 3 KEYS TO WIN
  md += H2("🎯 TOP 3 KEYS TO WIN");
  deriveKeysToWin(b).forEach((k, i) => {
    md += H3(`${i + 1}. ${k.title}`);
    md += P(k.body);
  });

  // ⚠️ OPPONENT TRAPS
  md += H2("⚠️ OPPONENT TRAPS");
  const traps = deriveOpponentTraps(b);
  if (!traps.length) {
    md += P("_Not enough opp-winner data to identify traps yet. Capture more encounters._");
  } else {
    md += traps.map((t) => `- **${t.label}** — ${t.body}`).join("\n") + "\n\n";
  }

  // 🛠️ STRATEGY
  md += H2("🛠️ STRATEGY (serve selection)");
  const strategyRows = [];
  for (const code of ["LS", "FS", "DS"]) {
    const r = adv.serveROI[code];
    if (!r || r.overall.pts === 0) continue;
    const note =
      r.decay === null     ? "small sample" :
      r.decay >= 20        ? `⚠️ drops ${r.decay}pp late — switch after 11` :
      r.decay <= -10       ? `↗ improves ${Math.abs(r.decay)}pp late — trust at clutch` :
      "holds from early to late";
    strategyRows.push([`**${code}**`, `${r.overall.pct}% (${r.overall.won}/${r.overall.pts})`, note]);
  }
  if (strategyRows.length) {
    md += table(["Serve", "Overall ROI", "Note"], strategyRows);
  } else {
    md += P("_No serves recorded against this opponent._");
  }

  // 🏃 RECOVERY
  md += H2("🏃 RECOVERY");
  if (adv.recoveryLeak.total === 0) {
    md += P("_No opponent-winner patterns yet._");
  } else {
    md += P(
      `**${adv.recoveryLeak.longDiagonalPct}%** of opp winners are long diagonals ` +
      `(recovery gap ≥ 2.5 zones). Prioritise re-centering after corner shots.`
    );
    const rows = adv.recoveryLeak.top.slice(0, 5).map((p) => [
      `Z${p.sonZone} → Z${p.oppZone}`,
      p.dist.toFixed(2),
      p.count,
      p.dist >= 2.5 ? "long diagonal" : "",
    ]);
    md += table(["Pattern", "Gap", "Count", "Flag"], rows);
  }

  // ⏱ MOMENTUM
  if (adv.momentum.total > 0) {
    md += H2("⏱️ MOMENTUM WATCHPOINTS");
    if (adv.momentum.physical > 0) {
      md += P(
        `**${adv.momentum.physical} physical collapse${adv.momentum.physical !== 1 ? "s" : ""}** ` +
        `(after rallies > 15 shots). Countermeasure: high defensive clears to lower heart rate.`
      );
    }
    if (adv.momentum.mental > 0) {
      md += P(
        `**${adv.momentum.mental} mental collapse${adv.momentum.mental !== 1 ? "s" : ""}** ` +
        `(after short rallies). Countermeasure: point-by-point reset routine.`
      );
    }
  }

  // 🧠 AI INSIGHTS (opponent-level)
  md += H2("🧠 AI INSIGHTS");
  md += P(dossier.aiInsights?.trim() || "_Paste Claude/Gemini cross-match critique here._");

  // 📝 Scouting notes (manual)
  md += H2("📝 Scouting notes");
  md += P(dossier.notes?.trim() || "_No manual notes yet._");

  // 📅 Past encounters
  md += H2("📅 Past encounters");
  md += table(
    ["Match", "Date", "Tournament", "Score", "Result"],
    dossier.matches.map((m) => {
      const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
      const won = setsWon > m.sets.length / 2;
      return [
        `\`${m.id}\``,
        m.date || "—",
        m.tournament || "—",
        m.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", "),
        won ? "✅ Won" : "❌ Lost",
      ];
    })
  );

  // Raw data
  md += H2("📦 Raw data for AI");
  md += P("Paste into Claude / Gemini for deeper scouting analysis:");
  md += codeBlock(JSON.stringify({
    opponent: dossier.name,
    career: {
      wins: dossier.wins,
      losses: dossier.losses,
      matchesPlayed: dossier.matchesPlayed,
      winRate: dossier.winRate,
    },
    scoutingNotes: dossier.notes,
    matches: dossier.matches,
  }, null, 2));

  return md;
};

// ---------- internal derivations ----------

const tacticalClevernessMarkdown = (adv) => {
  let md = "";

  md += H3("Displacement Index");
  md += P(
    `Won rallies: **${adv.displacement.won}** · Lost rallies: **${adv.displacement.lost}** ` +
    `(max ${adv.displacement.max}). Verdict: **${adv.displacement.verdict}**.`
  );

  md += H3("Kill Chain (top setup → finish)");
  if (adv.killChains.top.length) {
    md += table(
      ["Setup", "Finish", "Count"],
      adv.killChains.top.map((k) => [
        "`" + k.setupLabel + "`",
        "`" + k.winnerLabel + "`",
        `×${k.count}`,
      ])
    );
  } else {
    md += P("_No qualifying winning sequences yet._");
  }

  md += H3("Serve ROI");
  const rows = ["LS", "FS", "DS"].map((code) => {
    const r = adv.serveROI[code];
    return [
      `**${code}**`,
      r.early.pts ? `${r.early.pct}% (${r.early.won}/${r.early.pts})` : "—",
      r.late.pts  ? `${r.late.pct}% (${r.late.won}/${r.late.pts})`    : "—",
      r.decay === null ? "—" : `${r.decay > 0 ? "↘" : "↗"} ${Math.abs(r.decay)}pp`,
      r.overall.pts ? `${r.overall.pct}% (${r.overall.won}/${r.overall.pts})` : "—",
    ];
  });
  md += table(["Serve", "Early (<12)", "Late (12–21)", "Decay", "Overall"], rows);

  md += H3("Recovery Leak");
  if (adv.recoveryLeak.total > 0) {
    md += P(
      `**${adv.recoveryLeak.total}** opp winners · ${adv.recoveryLeak.longDiagonal} ` +
      `(${adv.recoveryLeak.longDiagonalPct}%) long diagonals · avg gap ${adv.recoveryLeak.avgDist}`
    );
    md += table(
      ["Pattern", "Gap", "Count"],
      adv.recoveryLeak.top.map((p) => [`Z${p.sonZone} → Z${p.oppZone}`, p.dist.toFixed(2), `×${p.count}`])
    );
  } else {
    md += P("_No opponent-winner rallies._");
  }

  md += H3("Momentum chunks");
  if (adv.momentum.total > 0) {
    md += P(
      `**${adv.momentum.total}** streaks (3+ consecutive losses) · ` +
      `Physical: ${adv.momentum.physical} · Mental: ${adv.momentum.mental}`
    );
    md += table(
      ["Set", "Length", "Prev rally", "Avg len", "UE rate", "Type"],
      adv.momentum.chunks.map((c) => [c.set, c.length, `${c.prevLen} shots`, c.avgLen, `${c.ueRate}%`, c.classification])
    );
  } else {
    md += P("_No 3+ consecutive-loss streaks._");
  }

  return md;
};

const deriveKeysToWin = (bundle) => {
  const keys = [];
  const adv = bundle.advanced;

  // Key 1 — deadliest kill chain
  if (adv.killChains.top.length > 0) {
    const k = adv.killChains.top[0];
    keys.push({
      title: `Hunt the "${k.setupLabel} → ${k.winnerLabel}" pattern`,
      body:
        `This sequence has produced **${k.count}** winner${k.count !== 1 ? "s" : ""} historically. ` +
        `Set up with ${SHOT_NAMES[k.setupShot] || k.setupShot} to Zone ${k.setupZone}, ` +
        `then finish with ${SHOT_NAMES[k.winnerShot] || k.winnerShot} to Zone ${k.winnerZone}.`,
    });
  }

  // Key 2 — best serve ROI
  const serves = ["LS", "FS", "DS"]
    .map((c) => ({ code: c, ...adv.serveROI[c] }))
    .filter((s) => s.overall.pts >= 3)
    .sort((a, b) => b.overall.pct - a.overall.pct);
  if (serves.length > 0) {
    const best = serves[0];
    const decayNote = best.decay === null
      ? "Sample small but promising."
      : best.decay >= 20
      ? `Drops ${best.decay}pp after 11 — mix in a second option late.`
      : best.decay <= -10
      ? `Actually improves late (${-best.decay}pp). Trust it at clutch points.`
      : "Holds consistently from early to late.";
    keys.push({
      title: `Lead with the ${best.code}`,
      body: `**${best.overall.pct}%** win rate (${best.overall.won}/${best.overall.pts}). ${decayNote}`,
    });
  }

  // Key 3 — top winner zone
  const winnerZones = Object.entries(bundle.winnerZones)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
  if (winnerZones.length) {
    const [zone, count] = winnerZones[0];
    keys.push({
      title: `Finish at Zone ${zone} (${ZONE_HINT[zone]})`,
      body: `**${count}** winner${count !== 1 ? "s" : ""} have landed at ${ZONE_LABELS[zone]}. Keep rehearsing attack patterns that terminate here.`,
    });
  }

  // Pad to 3 if data is thin.
  while (keys.length < 3) {
    keys.push({
      title: "Capture more encounters",
      body: "A few more matches will unlock additional tactical keys. Keep scouting.",
    });
  }

  return keys.slice(0, 3);
};

const deriveOpponentTraps = (bundle) => {
  const traps = [];
  const adv = bundle.advanced;

  adv.recoveryLeak.top.slice(0, 4).forEach((p) => {
    traps.push({
      label: `Z${p.sonZone} → Z${p.oppZone}`,
      body:
        `After your shot to Zone ${p.sonZone} (${ZONE_HINT[p.sonZone]}), opp has finished ` +
        `**${p.count}** time${p.count !== 1 ? "s" : ""} at Zone ${p.oppZone}` +
        `${p.dist >= 2.5 ? " — long diagonal, recovery to base is too slow" : ""}.`,
    });
  });

  if (adv.momentum.physical > 0) {
    traps.push({
      label: "Long-rally chain reactions",
      body: `${adv.momentum.physical} historic collapse${adv.momentum.physical !== 1 ? "s" : ""} after rallies > 15 shots. Opp may extend rallies on purpose to break your fitness.`,
    });
  }

  return traps;
};

const rawDataBlock = (match) => {
  return H2("📦 Raw data for LLM analysis") +
    P("Paste the JSON below into Claude / Gemini for deeper pattern analysis.") +
    codeBlock(JSON.stringify(match, null, 2));
};

// ===================================================================
//  3. PERFORMANCE REPORT (career / scope)
// ===================================================================
//
// Aggregate Markdown over a set of matches. Same content shape as the
// on-screen Report: headline, per-match table, distributions, heatmaps,
// serve/return, length profile, clutch, fatigue, effectiveness,
// deception, full Tactical Cleverness block, coaching recs, raw JSON.
export const performanceReportMarkdown = (matches, { playerName = "Player", scopeLabel = "Full career" } = {}) => {
  if (!matches || !matches.length) {
    return H1(`🏸 Performance report — ${playerName}`) +
      P(`_No matches in scope (${scopeLabel})._`);
  }

  const totalRallies = matches.reduce((a, m) => a + (m.rallies?.length || 0), 0);
  const wonMatches = matches.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;

  let md = H1(`🏸 Performance report — ${playerName}`);
  md += P(
    `**Scope:** ${scopeLabel}  \n` +
    `**Matches:** ${matches.length} (${wonMatches}W - ${matches.length - wonMatches}L)  \n` +
    `**Rallies:** ${totalRallies}  \n` +
    `**Generated:** ${new Date().toLocaleDateString()}`
  );

  if (totalRallies === 0) {
    md += H2("No rally data");
    md += P("_Matches have no shot-level data captured._");
    return md;
  }

  const bundle = reportBundle(matches);
  const { agg, distribution, lengthProfile, serveReturn, clutch, fatigue,
          deception, effectiveness, winnerZones, errorZonesAll, allZones,
          recs, advanced } = bundle;

  // Per-match rollup
  md += H2("Match list");
  md += table(
    ["Match", "Date", "Opponent", "Tournament", "Score", "Result"],
    matches.map((m) => {
      const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
      const won = setsWon > m.sets.length / 2;
      return [
        `\`${m.id}\``,
        m.date || "—",
        m.opponent || "—",
        m.tournament || "—",
        m.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", "),
        won ? "✅ Won" : "❌ Lost",
      ];
    })
  );

  // Headline
  md += H2("Headline stats");
  md += table(["Metric", "Value"], [
    ["Total rallies", agg.rallies],
    ["Won / Lost", `${agg.won} / ${agg.lost}`],
    ["Win rate", `${pct(agg.won, agg.rallies)}%`],
    ["Winners", agg.w],
    ["Unforced errors", agg.ue_son],
    ["Avg rally length", `${agg.avgLen} shots`],
  ]);

  // Shot distribution
  if (distribution.length) {
    md += H2("Shot distribution");
    md += table(
      ["Shot", "Count", "Share"],
      distribution.slice(0, 15).map((s) => [s.name, s.count, `${s.pct}%`])
    );
  }

  // Heatmaps
  md += H2("Zone heatmaps");
  md += H3("Winner zones");
  md += zoneTable(winnerZones);
  md += H3("Unforced-error zones");
  md += zoneTable(errorZonesAll);
  md += H3("All shot targets");
  md += zoneTable(allZones);

  // Serve / return
  md += H2("Serve & return");
  md += table(
    ["Metric", "Value", "Pts"],
    [
      ["Serve win %", `${serveReturn.serveWinPct}%`, `${serveReturn.serveWon}/${serveReturn.servePoints}`],
      ["Return win %", `${serveReturn.returnWinPct}%`, `${serveReturn.returnWon}/${serveReturn.returnPoints}`],
      ["3-shot opening win %", `${serveReturn.threeShotWinPct}%`, `${serveReturn.threeShotWon}/${serveReturn.threeShotPoints}`],
    ]
  );

  // Length
  md += H2("Rally length profile");
  md += table(
    ["Bucket", "Won", "Lost", "Win %"],
    Object.entries(lengthProfile).map(([b, { w, l }]) => [`${b} shots`, w, l, `${pct(w, w + l)}%`])
  );

  // Clutch
  md += H2("Clutch performance (16+)");
  md += table(["Metric", "Value"], [
    ["Clutch points", clutch.clutchPoints],
    ["Clutch win %", `${clutch.clutchWinPct}%`],
    ["Clutch UE rate", `${clutch.clutchUEPct}%`],
    ["Overall UE rate", `${clutch.overallUEPct}%`],
    ["Deficit", `${clutch.deficit >= 0 ? "+" : ""}${clutch.deficit}pp`],
  ]);

  // Fatigue
  md += H2("Fatigue & endurance");
  md += table(
    ["Half", "UE", "Points", "Rate"],
    [
      ["First (pts 1–11)", fatigue.firstHalf.ue, fatigue.firstHalf.points, `${fatigue.firstHalf.rate}%`],
      ["Second (pts 12–21)", fatigue.secondHalf.ue, fatigue.secondHalf.points, `${fatigue.secondHalf.rate}%`],
    ]
  );
  md += P(`**Fatigue ratio:** ${fatigue.ratio}× _(≥ 2.0 flags a concern)_`);

  // Effectiveness
  md += H2("Effectiveness index");
  md += P(
    `**E:** ${effectiveness.ePct}% · **N:** ${effectiveness.nPct}% · **I:** ${effectiveness.iPct}%  ` +
    `_(Pro target: E ≥ 35 %, I ≤ 15 %)_`
  );

  // Deception
  md += H2("Predictability & deception");
  md += P(`Holds: ${deception.holds} · Slices: ${deception.slices} · Per-match: ${deception.perMatch}`);

  // Tactical cleverness (full)
  md += H2("🧠 Tactical cleverness");
  md += tacticalClevernessMarkdown(advanced);

  // Coaching recs
  md += H2("Coaching recommendations");
  if (recs.length) {
    recs.forEach((r, i) => { md += H3(`${i + 1}. ${r.title}`); md += P(r.body); });
  } else {
    md += P("_Not enough data to generate recommendations._");
  }

  // Raw payload
  md += H2("📦 Raw data for LLM analysis");
  md += P("Trimmed match list — paste into Claude/Gemini for follow-up analysis.");
  md += codeBlock(JSON.stringify(matches, null, 2));

  return md;
};

// ===================================================================
//  4. PATTERNS INTELLIGENCE
// ===================================================================
//
// Same content as the Patterns screen — coaching tips, disruption
// conversion, effectiveness heatmaps, critical return, winning sequences.
// Optionally filtered by opponent style (e.g. "only against Attacking").
export const patternsMarkdown = (matches, { playerName = "Player", styleFilter = "All" } = {}) => {
  const filtered = styleFilter === "All"
    ? matches
    : matches.filter((m) => (m.playerStyle || "Unknown") === styleFilter);

  let md = H1(`🎯 Patterns intelligence — ${playerName}`);
  md += P(
    `**Style filter:** ${styleFilter}  \n` +
    `**Matches in scope:** ${filtered.length}  \n` +
    `**Generated:** ${new Date().toLocaleDateString()}`
  );

  if (!filtered.length) {
    md += P(`_No matches captured against the "${styleFilter}" style yet._`);
    return md;
  }

  const rallies = filtered.flatMap((m) => m.rallies);
  const bundle = reportBundle(filtered);
  const adv = bundle.advanced;

  // Coaching tips (priority output)
  md += H2("🧠 Coaching summary (auto-generated)");
  if (bundle.recs.length) {
    bundle.recs.forEach((r, i) => {
      md += `### ${i + 1}. ${r.title}\n\n${r.body}\n\n`;
    });
  } else {
    md += P("_Not enough rallies yet — keep capturing to unlock tips._");
  }

  // Disruption conversion
  md += H2("Disruption conversion");
  md += P(
    `Disruption shots (smashes, half-smashes, kills, net shots past the opening) ` +
    `appear in ${bundle.advanced.killChains.totalWinners > 0 ? `at least ${bundle.advanced.killChains.totalWinners} winning rall${bundle.advanced.killChains.totalWinners !== 1 ? "ies" : "y"}` : "limited rallies so far"}.`
  );

  // Effectiveness heatmaps (3 versions)
  md += H2("Shot effectiveness heatmaps");
  md += H3("Winner zones");
  md += zoneTable(bundle.winnerZones);
  md += H3("Effective-tagged shot zones");
  md += zoneTable(zoneTalliesByQuality(rallies, "Effective"));
  md += H3("Error zones (UE + Ineffective)");
  md += zoneTable(bundle.errorZonesAll);

  // Critical return
  md += H2("Critical return analysis");
  if (adv.recoveryLeak.total > 0) {
    md += P(
      `Of ${adv.recoveryLeak.total} opponent winners against ${playerName}, ` +
      `${adv.recoveryLeak.longDiagonalPct}% are long diagonals (gap ≥ 2.5).`
    );
    md += table(
      ["Pattern", "Gap", "Count"],
      adv.recoveryLeak.top.map((p) => [`Z${p.sonZone} → Z${p.oppZone}`, p.dist.toFixed(2), `×${p.count}`])
    );
  } else {
    md += P("_No opponent-winner rallies in this scope._");
  }

  // Winning sequences (3-shot)
  md += H2("Top winning sequences");
  for (const n of [2, 3, 4]) {
    const seqs = winningSequencesFromBundle(rallies, n).slice(0, 8);
    md += H3(`${n}-shot`);
    if (seqs.length) {
      md += table(
        ["Sequence", "Count"],
        seqs.map((s) => [`\`${s.seq}\``, `×${s.count}`])
      );
    } else {
      md += P(`_Not enough winning rallies of length ≥ ${n}._`);
    }
  }

  // Tactical Cleverness block (the deep one)
  md += H2("🧠 Tactical cleverness deep-dive");
  md += tacticalClevernessMarkdown(adv);

  return md;
};

// ===================================================================
//  IO helpers (side-effectful — intended for UI button handlers)
// ===================================================================
export const downloadMarkdown = (content, filename) => {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const copyMarkdown = async (content) => {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
};

// Filename-safe string. Kept to ASCII + underscores so OS-level downloads
// don't choke on opponent names with punctuation.
export const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "untitled";
