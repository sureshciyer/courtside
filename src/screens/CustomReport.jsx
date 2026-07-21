import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import {
  reportBundle,
  matchSummary,
  pct,
  listTournaments,
} from "../lib/analytics.js";
import { Screen, TopBar, Card, BigBtn } from "../components/ui.jsx";
import {
  ShotMixEffectivenessSection,
  UnforcedErrorBreakdown,
  MomentumChunksView,
  RollingWindowBlock,
  TrainingFocusBlock,
  RallyLengthInsight,
  ConfidenceChip,
  ZoneDiagram,
  PartHeader,
  SH,
  SubSection,
  Stat,
  Grid,
  Empty,
  Flag,
  EffSlice,
  Ring,
  PrintBtn,
  ScopePill,
} from "./Report.jsx";

// =============================================================
//  CUSTOM REPORT
//
//  A trimmed-down report with only the sections the user asked for.
//  The full Performance Report is unchanged — this is an additional
//  surface that reuses the same section components (named-exported
//  from Report.jsx) so the two surfaces never drift.
//
//  Designed to be configurable later: the section list lives in a
//  single CONFIG object below, and the renderer reads it. A future
//  Settings screen can let the user toggle entries on/off.
// =============================================================

const CONFIG = {
  // Top-level sections, in render order. Each entry maps to a render
  // helper below. Edit this list (or expose it via UI) to reshape.
  sections: [
    "tournament_overview",
    "shot_mix_ab",          // ShotMixEffectivenessSection limited to A & B
    "rally_length",
    "serve_return",
    "clutch",
    "fatigue",              // includes UE breakdown but with origin/pattern omitted
    "effectiveness_index",
    "momentum_chunks",      // single sub-block from section 10
    "rolling_window",       // 13.C only
    "training_focus",       // 13.D filtered to reduce_ue + more_deceptive
    "baseline_metrics",     // 13.E
    "court_zone_layout",    // appendix B
  ],
  trainingFocusKeep: ["reduce_ue", "more_deceptive"],
  shotMixSubsections: ["A", "B"],
  ueOmit: ["origin_zone", "top_patterns"],
};

export default function CustomReport({ setScreen }) {
  const allMatches = useMatchStore((s) => s.matches);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";

  // Same scope toggle UX as the full Report so the user isn't surprised.
  const [scope, setScope] = useState("career");
  const allTournaments = useMemo(() => listTournaments(allMatches), [allMatches]);

  const matches = useMemo(() => {
    if (scope === "career") return allMatches;
    if (scope.startsWith("match:")) return allMatches.filter((m) => m.id === scope.slice(6));
    if (scope.startsWith("tour:")) return allMatches.filter((m) => (m.tournament || "Other") === scope.slice(5));
    return allMatches;
  }, [allMatches, scope]);

  const bundle = useMemo(() => reportBundle(matches), [matches]);

  if (allMatches.length === 0) {
    return (
      <Screen>
        <TopBar title="Custom report" onBack={() => setScreen("insights")} />
        <Card className="text-center py-10">
          <div className="text-4xl mb-2">📋</div>
          <div className="font-bold text-white mb-1">No match data yet</div>
          <div className="text-sm text-neutral-400 mb-4">
            Capture a match and the custom report fills in.
          </div>
          <BigBtn tone="primary" onClick={() => setScreen("setup")}>Start first match</BigBtn>
        </Card>
      </Screen>
    );
  }

  const scopeLabel = scope === "career" ? "Full career"
    : scope.startsWith("tour:") ? `Tournament: ${scope.slice(5)}`
    : scope.startsWith("match:") ? `Match ${scope.slice(6)}`
    : "Full career";

  const printReport = () => window.print();

  // Renderer registry — keeps the top-level JSX flat and editable.
  const renderers = {
    tournament_overview:  () => <TournamentOverview matches={matches} bundle={bundle} />,
    shot_mix_ab:          () => <ShotMixABSection bundle={bundle} />,
    rally_length:         () => <RallyLengthSection bundle={bundle} />,
    serve_return:         () => <ServeReturnSection bundle={bundle} />,
    clutch:               () => <ClutchSection bundle={bundle} />,
    fatigue:              () => <FatigueSection bundle={bundle} />,
    effectiveness_index:  () => <EffectivenessIndexSection bundle={bundle} />,
    momentum_chunks:      () => <MomentumChunksSection bundle={bundle} />,
    rolling_window:       () => <RollingWindowSection bundle={bundle} />,
    training_focus:       () => <TrainingFocusSection bundle={bundle} />,
    baseline_metrics:     () => <BaselineMetricsSection bundle={bundle} />,
    court_zone_layout:    () => <CourtZoneLayoutSection playerName={playerName} />,
  };

  const wonMatches = matches.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;

  return (
    <Screen wide className="report-root">
      <TopBar
        title="Custom report"
        subtitle={`${playerName} · ${scopeLabel} · ${matches.length} match${matches.length !== 1 ? "es" : ""} · ${bundle.agg.rallies} rallies`}
        onBack={() => setScreen("insights")}
        right={<PrintBtn onClick={printReport} />}
      />

      {/* Header */}
      <div className="border-b-2 border-emerald-700 pb-3 mb-4 print:border-black">
        <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-500">Custom performance report</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 print:text-black">
          {playerName} — Selected sections
        </h1>
        <div className="text-xs text-neutral-400 mt-1">
          {scopeLabel} · {wonMatches}W-{matches.length - wonMatches}L · {bundle.agg.rallies} rallies ·{" "}
          Generated {new Date().toLocaleDateString()}
        </div>
        <div className="text-[11px] text-neutral-500 mt-1 italic">
          A focused subset of the Full Performance Report. Sections are configurable —
          a UI control will land here in a future version.
        </div>
      </div>

      {/* Scope selector */}
      <Card className="mb-3 print:hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-semibold">Scope</div>
          {matches.length === 0 && <span className="text-[11px] text-amber-400">No matches in this scope</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ScopePill active={scope === "career"} onClick={() => setScope("career")}>
            Full career ({allMatches.length})
          </ScopePill>
          {allTournaments.length > 0 && (
            <div className="w-full my-1 text-[10px] text-neutral-600 uppercase tracking-wider">Tournaments</div>
          )}
          {allTournaments.map((t) => (
            <ScopePill key={t.name} active={scope === `tour:${t.name}`} onClick={() => setScope(`tour:${t.name}`)}>
              {t.name} ({t.matches.length})
            </ScopePill>
          ))}
          {allMatches.length > 0 && (
            <div className="w-full my-1 text-[10px] text-neutral-600 uppercase tracking-wider">Single match</div>
          )}
          {[...allMatches].reverse().slice(0, 8).map((m) => (
            <ScopePill key={m.id} active={scope === `match:${m.id}`} onClick={() => setScope(`match:${m.id}`)}>
              {m.id} · {m.opponent}
            </ScopePill>
          ))}
        </div>
      </Card>

      {/* Sections */}
      <PartHeader label="A" title="Selected sections" />
      {CONFIG.sections.map((key) => {
        const render = renderers[key];
        if (!render) return null;
        return <div key={key}>{render()}</div>;
      })}

      <div className="text-center py-6 text-[10px] text-neutral-600 border-t border-neutral-800 mt-6 print:border-neutral-400">
        Custom Report · {playerName} · Generated {new Date().toLocaleDateString()}
      </div>
      <div className="h-4" />
    </Screen>
  );
}

// ===================== Section blocks =====================

function TournamentOverview({ matches, bundle }) {
  const wonMatches = matches.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;
  const { agg } = bundle;
  return (
    <>
      <SH id="c1" n="1" t="Tournament overview" />
      <Grid c={5}>
        <Stat l="Matches" v={`${wonMatches}W-${matches.length - wonMatches}L`} />
        <Stat l="Points won" v={agg.won} s={`/ ${agg.rallies}`} tone="good" />
        <Stat l="Win rate" v={`${pct(agg.won, agg.rallies)}%`} tone={agg.won > agg.rallies / 2 ? "good" : "bad"} />
        <Stat l="Winners" v={agg.w} tone="good" />
        <Stat l="Unforced err" v={agg.ue_son} tone="bad" />
      </Grid>
      <div className="mt-3 flex flex-col gap-0.5">
        {matches.map((m, i) => {
          const summary = matchSummary(m);
          const scores = m.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", ");
          return (
            <div
              key={m.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs print:bg-white ${i % 2 === 0 ? "bg-neutral-900" : "bg-neutral-900/40"}`}
            >
              <span className="font-mono text-neutral-500 w-14">{m.id}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${summary.won ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="flex-1 font-semibold text-neutral-200 truncate">
                {m.tournament ? `${m.tournament} — ` : ""}vs {m.opponent}
              </span>
              <span className={`font-mono font-semibold ${summary.won ? "text-emerald-400" : "text-red-400"}`}>
                {scores}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ShotMixABSection({ bundle }) {
  return (
    <>
      <SH id="c2" n="2" t="Son shot mix & effectiveness" />
      <ShotMixEffectivenessSection data={bundle.shotMix} sections={CONFIG.shotMixSubsections} />
    </>
  );
}

function RallyLengthSection({ bundle }) {
  return (
    <>
      <SH id="c3" n="3" t="Rally length profile" />
      <Grid c={4}>
        {Object.entries(bundle.lengthProfile).map(([bucket, { w, l }]) => {
          const total = w + l;
          const p = pct(w, total);
          return (
            <div key={bucket} className="text-center">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{bucket} shots</div>
              <Ring pct={p} />
              <div className="text-[10px] text-neutral-500 mt-1">{w}W / {l}L</div>
            </div>
          );
        })}
      </Grid>
      <RallyLengthInsight best={bundle.bestLengthBucket} />
    </>
  );
}

function ServeReturnSection({ bundle }) {
  const { serveReturn, confidence } = bundle;
  return (
    <>
      <SH id="c4" n="4" t="Serve & return game" />
      <div className="mb-2"><ConfidenceChip confidence={confidence} /></div>
      <Grid c={3}>
        <Stat
          l="Serve win %"
          v={`${serveReturn.serveWinPct}%`}
          s={`${serveReturn.serveWon}/${serveReturn.servePoints}`}
          tone={serveReturn.serveWinPct >= 55 ? "good" : "warn"}
        />
        <Stat
          l="Return win %"
          v={`${serveReturn.returnWinPct}%`}
          s={`${serveReturn.returnWon}/${serveReturn.returnPoints}`}
          tone={serveReturn.returnWinPct >= 43 ? "good" : "warn"}
        />
        <Stat
          l="3-shot opening win %"
          v={`${serveReturn.threeShotWinPct}%`}
          s={`${serveReturn.threeShotWon}/${serveReturn.threeShotPoints}`}
          tone={serveReturn.threeShotWinPct >= 55 ? "good" : "warn"}
        />
      </Grid>
    </>
  );
}

function ClutchSection({ bundle }) {
  const { clutch, confidence } = bundle;
  return (
    <>
      <SH id="c5" n="5" t="Clutch performance (16–21)" />
      <div className="mb-2"><ConfidenceChip confidence={confidence} /></div>
      <Grid c={3}>
        <Stat l="Clutch points" v={clutch.clutchPoints} />
        <Stat l="Clutch win %" v={`${clutch.clutchWinPct}%`} tone={clutch.clutchWinPct >= 50 ? "good" : "bad"} />
        <Stat
          l="Clutch UE rate"
          v={`${clutch.clutchUEPct}%`}
          s={`vs ${clutch.overallUEPct}% overall`}
          tone={clutch.deficit >= 3 ? "bad" : "default"}
        />
      </Grid>
      {clutch.clutchPoints >= 4 && clutch.deficit >= 3 && (
        <Flag>
          Clutch UE rate exceeds overall by {clutch.deficit}pp — under pressure, shot selection
          gets riskier. Drill 18-18 scenarios.
        </Flag>
      )}
    </>
  );
}

function FatigueSection({ bundle }) {
  const { fatigue, unforcedErrors } = bundle;
  return (
    <>
      <SH id="c6" n="6" t="Fatigue & endurance" />
      <Grid c={2}>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 print:border-neutral-400">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">UE rate: first half of sets (pts 1–11)</div>
          <div className="text-3xl font-extrabold text-emerald-400">{fatigue.firstHalf.rate}%</div>
          <div className="text-[11px] text-neutral-500">{fatigue.firstHalf.ue} UE in {fatigue.firstHalf.points} points</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 print:border-neutral-400">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">UE rate: second half of sets (pts 12–21)</div>
          <div className={`text-3xl font-extrabold ${fatigue.secondHalf.rate > fatigue.firstHalf.rate ? "text-red-400" : "text-emerald-400"}`}>
            {fatigue.secondHalf.rate}%
          </div>
          <div className="text-[11px] text-neutral-500">{fatigue.secondHalf.ue} UE in {fatigue.secondHalf.points} points</div>
        </div>
      </Grid>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">Per-set UE rate</div>
        <div className="flex flex-wrap gap-2">
          {fatigue.perSet.map((s, i) => (
            <div
              key={i}
              className={`px-3 py-1.5 rounded-md border text-xs ${s.uePct > 20 ? "bg-red-950/40 border-red-800 text-red-300" : "bg-neutral-900 border-neutral-800 text-neutral-300"}`}
            >
              <span className="font-mono">{s.matchId}</span>
              <span className="text-neutral-500"> · Set {s.set} </span>
              <span className="font-bold">{s.uePct}%</span>
              <span className="text-neutral-500 ml-1">({s.ue}/{s.rallies})</span>
            </div>
          ))}
        </div>
      </div>
      {fatigue.ratio >= 1.5 && (
        <Flag>
          UE rate jumps {fatigue.ratio}× from first to second half of sets — fatigue signal.
          Prioritize endurance conditioning.
        </Flag>
      )}

      {/* Unforced error breakdown — insight only; tables omitted per spec. */}
      <div className="mt-4">
        <div className="text-sm font-bold text-emerald-400 mb-2 print:text-black">Unforced error breakdown</div>
        <UnforcedErrorBreakdown data={unforcedErrors} omit={CONFIG.ueOmit} />
      </div>
    </>
  );
}

function EffectivenessIndexSection({ bundle }) {
  const { effectiveness } = bundle;
  return (
    <>
      <SH id="c7" n="7" t="Effectiveness index" />
      {effectiveness.total === 0 ? (
        <Empty>Tag shots with quality (E/N/I) during capture to power this index.</Empty>
      ) : (
        <>
          <div className="flex h-7 rounded-lg overflow-hidden border border-neutral-800 print:border-neutral-400">
            <EffSlice pct={effectiveness.ePct} label={`E ${effectiveness.ePct}%`} className="bg-emerald-500 text-white" />
            <EffSlice pct={effectiveness.nPct} label={`N ${effectiveness.nPct}%`} className="bg-amber-500 text-white" />
            <EffSlice pct={effectiveness.iPct} label={`I ${effectiveness.iPct}%`} className="bg-red-500 text-white" />
          </div>
          <div className="flex justify-center gap-4 text-[10px] text-neutral-500 mt-2">
            <span>Pro target: E ≥ 35%</span>
            <span>N ~ 50%</span>
            <span>I ≤ 15%</span>
          </div>
        </>
      )}
    </>
  );
}

function MomentumChunksSection({ bundle }) {
  return (
    <>
      <SH id="c8" n="8" t="Momentum chunks (loss streaks of 3+)" />
      <MomentumChunksView data={bundle.advanced.momentum} />
    </>
  );
}

function RollingWindowSection({ bundle }) {
  const trends = bundle.trends;
  if (!trends) return null;
  return (
    <>
      <SH id="c9" n="9" t="Rolling window comparison" />
      <RollingWindowBlock title="Last 100 rallies vs previous 100" window={trends.rolling.last100Rallies} />
      <RollingWindowBlock title="Last 5 matches vs previous 5" window={trends.rolling.last5Matches} />
    </>
  );
}

function TrainingFocusSection({ bundle }) {
  const trends = bundle.trends;
  if (!trends) return null;
  const filtered = (trends.trainingFocus || []).filter((f) =>
    CONFIG.trainingFocusKeep.includes(f.id)
  );
  return (
    <>
      <SH id="c10" n="10" t="Training focus progress" />
      {filtered.length === 0 ? (
        <Empty>Need at least two windows of data to track training focus progress.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((focus) => <TrainingFocusBlock key={focus.id} focus={focus} />)}
        </div>
      )}
    </>
  );
}

function BaselineMetricsSection({ bundle }) {
  const trends = bundle.trends;
  if (!trends?.baseline) return null;
  const { baseline } = trends;
  return (
    <>
      <SH id="c11" n="11" t="Current baseline metrics" />
      <SubSection label="A" title="Baseline">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat l="UE %"          v={`${baseline.ueRate}%`}          tone={baseline.ueRate >= 25 ? "bad" : "default"} />
          <Stat l="Late UE %"     v={`${baseline.latePhaseUERate}%`} tone={baseline.latePhaseUERate >= 25 ? "bad" : "default"} />
          <Stat l="Clutch UE %"   v={`${baseline.clutchUERate}%`}    tone={baseline.clutchUERate >= 25 ? "bad" : "default"} />
          <Stat l="Z7 UE %"       v={`${baseline.z7UERate}%`}        tone={baseline.z7UERate >= 25 ? "bad" : "default"} />
          <Stat l="3-shot win %"  v={`${baseline.threeShotWinRate}%`} tone={baseline.threeShotWinRate >= 55 ? "good" : "warn"} />
          <Stat l="Effective %"   v={`${baseline.effectivePct}%`}    tone={baseline.effectivePct >= 35 ? "good" : "warn"} />
          <Stat l="Z7 cross-drop" v={`${baseline.z7CrossDropFrequency}%`} />
          <Stat l="Variation %"   v={`${baseline.variationUsageRate}%`} />
        </div>
        <div className="text-[11px] text-neutral-500 mt-2">
          Baseline metrics are deterministic counts from currently captured rallies.
        </div>
      </SubSection>
    </>
  );
}

function CourtZoneLayoutSection({ playerName }) {
  return (
    <>
      <SH id="c12" n="12" t="Court zone layout" />
      <p className="text-xs text-neutral-400 mb-3">
        Zone numbering is identical on both sides of the net — the grid moves with the player.
        Zone 1 is Front-Left from the player's own perspective, Zone 9 is Back-Right.
      </p>
      <div className="max-w-xs mx-auto">
        <ZoneDiagram playerName={playerName} />
      </div>
    </>
  );
}
