import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { reportBundle, matchSummary, classifyStyle, setAggregate, pct, listTournaments, computeSampleConfidence } from "../lib/analytics.js";
import { SHOT_NAMES, ZONE_LABELS } from "../constants/badminton.js";
import { Screen, TopBar, Card, BigBtn, Badge } from "../components/ui.jsx";
import { performanceReportMarkdown, copyMarkdown, downloadMarkdown, slugify } from "../lib/markdown.js";

// ===== Pro-level performance report. Each section is driven by the real
// matches array from the Zustand store — no sample data, all deterministic.
// Layout is print-friendly: body turns white on @media print (index.css),
// cards lose shadows/borders to render cleanly to a single PDF.

export default function Report({ setScreen }) {
  const completedMatches = useMatchStore((s) => s.matches);
  const currentMatch     = useMatchStore((s) => s.currentMatch);
  const pausedMatchesRaw = useMatchStore((s) => s.pausedMatches);
  const pausedMatches    = useMemo(() => pausedMatchesRaw || [], [pausedMatchesRaw]);
  const playerName       = useMatchStore((s) => s.settings?.playerName) || "Player";

  // Scope selector: "career" (all matches), "match" (one selected), or a
  // tournament key. Defaults to career.
  const [scope, setScope] = useState("career");

  // Live-preview toggle — opt in to include the live (currentMatch) and any
  // paused matches in the report. Off by default so the report is the
  // canonical archive view.
  const [includeInProgress, setIncludeInProgress] = useState(false);

  // The merged match list used by every analytics call below. We stash the
  // in-progress matches at the END of the array so capture-order analyses
  // (predictability after_lost_point, momentum chunks, trends) see them as
  // the "latest" entries — matching how the user thinks about them.
  const allMatches = useMemo(() => {
    if (!includeInProgress) return completedMatches;
    const inProgress = [
      ...pausedMatches.map((m) => stripPausedFields(m)),
      ...(currentMatch ? [currentMatch] : []),
    ].filter((m) => m && (m.rallies?.length || 0) > 0);
    return [...completedMatches, ...inProgress];
  }, [completedMatches, currentMatch, pausedMatches, includeInProgress]);

  const inProgressCount =
    (currentMatch ? 1 : 0) + (pausedMatches?.length || 0);
  const inProgressRallyCount =
    (currentMatch?.rallies?.length || 0) +
    pausedMatches.reduce((a, m) => a + (m.rallies?.length || 0), 0);

  const allTournaments = useMemo(() => listTournaments(allMatches), [allMatches]);

  const matches = useMemo(() => {
    if (scope === "career") return allMatches;
    if (scope.startsWith("match:")) {
      const id = scope.slice(6);
      return allMatches.filter((m) => m.id === id);
    }
    if (scope.startsWith("tour:")) {
      const name = scope.slice(5);
      return allMatches.filter((m) => (m.tournament || "Other") === name);
    }
    return allMatches;
  }, [allMatches, scope]);

  const bundle = useMemo(() => reportBundle(matches), [matches]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const printReport = () => window.print();

  // Markdown export honours the current scope (career / tournament / match).
  const [mdFlash, setMdFlash] = useState(null);
  const flash = (s) => { setMdFlash(s); setTimeout(() => setMdFlash(null), 1800); };
  const buildScopedMarkdown = () => {
    const label =
      scope === "career"
        ? "Full career"
        : scope.startsWith("tour:")
        ? `Tournament: ${scope.slice(5)}`
        : scope.startsWith("match:")
        ? `Match ${scope.slice(6)}`
        : "Full career";
    return performanceReportMarkdown(matches, { playerName, scopeLabel: label });
  };
  const handleCopyMd = async () => {
    const ok = await copyMarkdown(buildScopedMarkdown());
    flash(ok ? "Markdown copied" : "Copy failed");
  };
  const handleDownloadMd = () => {
    const stamp = new Date().toISOString().split("T")[0];
    const scopeSlug = scope === "career" ? "career" : slugify(scope.replace(/^(tour:|match:)/, ""));
    downloadMarkdown(buildScopedMarkdown(), `courtside_report_${scopeSlug}_${stamp}.md`);
    flash("Report downloaded");
  };

  if (allMatches.length === 0) {
    return (
      <Screen>
        <TopBar title="Performance report" onBack={() => setScreen("insights")} />
        <Card className="text-center py-10">
          <div className="text-4xl mb-2">📋</div>
          <div className="font-bold text-white mb-1">No match data yet</div>
          <div className="text-sm text-neutral-400 mb-4">
            {inProgressCount > 0
              ? <>You have {inProgressCount} in-progress match{inProgressCount !== 1 ? "es" : ""} ({inProgressRallyCount} rallies). End a match to archive it, or enable live preview below to see draft numbers.</>
              : <>Capture a few matches and the full report generates automatically.</>}
          </div>
          {inProgressCount > 0 && (
            <BigBtn
              tone="warn"
              onClick={() => setIncludeInProgress(true)}
            >
              ● Show live preview
            </BigBtn>
          )}
          {inProgressCount === 0 && (
            <BigBtn tone="primary" onClick={() => setScreen("setup")}>Start first match</BigBtn>
          )}
        </Card>
      </Screen>
    );
  }

  // Scope label used in the header + subtitle.
  const scopeLabel = scope === "career"
    ? "Full career"
    : scope.startsWith("tour:")
    ? `Tournament: ${scope.slice(5)}`
    : scope.startsWith("match:")
    ? `Match ${scope.slice(6)}`
    : "Full career";

  const { agg, tournaments, distribution, lengthProfile, bestLengthBucket, serveReturn,
          clutch, fatigue, deception, effectiveness,
          winnerZones, errorZonesAll, allZones, recs, advanced, confidence,
          leaks, serveThirdShot, zoneWeakness, trainingPlan,
          unforcedErrors, shotMix, predictability, pressurePredictability, trends } = bundle;
  const wonMatches = matches.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;

  return (
    <Screen wide className="report-root">
      <TopBar
        title="Performance report"
        subtitle={`${playerName} · ${scopeLabel} · ${matches.length} match${matches.length !== 1 ? "es" : ""} · ${agg.rallies} rallies`}
        onBack={() => setScreen("insights")}
        right={<PrintBtn onClick={printReport} />}
      />

      {mdFlash && (
        <div className="cs-toast fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {mdFlash}
        </div>
      )}

      {/* Scope selector */}
      <Card className="mb-3 print:hidden">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-semibold">Scope</div>
          <div className="flex items-center gap-2">
            {matches.length === 0 && <span className="text-[11px] text-amber-400">No matches in this scope</span>}
            {inProgressCount > 0 && (
              <button
                onClick={() => setIncludeInProgress((v) => !v)}
                className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition active:scale-95 ${
                  includeInProgress
                    ? "bg-amber-600 border-amber-400 text-white"
                    : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                }`}
                title="Include the live match and any paused matches in the report"
              >
                {includeInProgress ? "● Live preview ON" : "○ Live preview OFF"}
                <span className="ml-1 opacity-80 font-mono">
                  ({inProgressCount}m / {inProgressRallyCount}r)
                </span>
              </button>
            )}
          </div>
        </div>
        {includeInProgress && (
          <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-md px-2 py-1 mb-2">
            Live preview includes {inProgressCount} in-progress match{inProgressCount !== 1 ? "es" : ""}{" "}
            ({inProgressRallyCount} rallies). Numbers will change as you keep capturing.
            Treat trend / sample-size signals as draft.
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <ScopePill active={scope === "career"} onClick={() => setScope("career")}>
            Full career ({allMatches.length})
          </ScopePill>
          {allTournaments.length > 0 && (
            <div className="w-full my-1 text-[10px] text-neutral-600 uppercase tracking-wider">Tournaments</div>
          )}
          {allTournaments.map((t) => (
            <ScopePill
              key={t.name}
              active={scope === `tour:${t.name}`}
              onClick={() => setScope(`tour:${t.name}`)}
            >
              {t.name} ({t.matches.length})
            </ScopePill>
          ))}
          {allMatches.length > 0 && (
            <div className="w-full my-1 text-[10px] text-neutral-600 uppercase tracking-wider">Single match</div>
          )}
          {[...allMatches].reverse().slice(0, 8).map((m) => (
            <ScopePill
              key={m.id}
              active={scope === `match:${m.id}`}
              onClick={() => setScope(`match:${m.id}`)}
            >
              {m.id} · {m.opponent}
            </ScopePill>
          ))}
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-800">
          <button
            onClick={handleCopyMd}
            className="flex-1 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold active:scale-95"
          >
            📋 Copy Markdown ({scopeLabel})
          </button>
          <button
            onClick={handleDownloadMd}
            className="flex-1 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-bold active:scale-95"
          >
            ⬇ Download .md
          </button>
        </div>
      </Card>

      {/* ---------- HEADER ---------- */}
      <div className="border-b-2 border-emerald-700 pb-3 mb-4 print:border-black">
        <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-500">Player performance report</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 print:text-black">
          {playerName} — Comprehensive analysis
        </h1>
        <div className="text-xs text-neutral-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""} ·{" "}
            {matches.length} matches · {agg.rallies} rallies ·{" "}
            Generated {new Date().toLocaleDateString()}
          </span>
          <ConfidenceChip confidence={confidence} />
          {includeInProgress && inProgressCount > 0 && (
            <span className="px-1.5 py-0.5 rounded border bg-amber-950/60 text-amber-300 border-amber-800/70 text-[9px] font-bold uppercase tracking-wider print:bg-white print:text-black print:border-amber-300">
              ● live preview
            </span>
          )}
        </div>
      </div>

      {/* ---------- Pro-Level Findings ---------- */}
      <ProLevelFindings
        confidence={confidence}
        leaks={leaks}
        bestLengthBucket={bestLengthBucket}
        clutch={clutch}
        scorePressure={advanced.scorePressure}
        serveThirdShot={serveThirdShot}
        serveReturn={serveReturn}
        effectiveness={effectiveness}
        zoneWeakness={zoneWeakness}
        deception={deception}
        killChainAnalysis={advanced.killChainAnalysis}
        trainingPlan={trainingPlan}
      />

      {/* ---------- TOC ---------- */}
      <Card className="mb-5 print:break-after-page">
        <div className="font-bold text-emerald-400 text-sm mb-3">Table of contents</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TocSection label="Part A: Aggregate analysis" items={[
            ["a1", "1. Tournament overview"],
            ["a2", "2. Court heatmaps"],
            ["a3", "3. Shot distribution"],
            ["a3-shot-mix", "Shot Mix & Effectiveness"],
            ["a4", "4. Rally length profile"],
            ["a5", "5. Serve & return game"],
            ["a6", "6. Clutch performance"],
            ["a7", "7. Fatigue & endurance"],
            ["a7-ue", "Unforced Error Breakdown"],
            ["a8", "8. Effectiveness index"],
            ["a9", "9. Predictability & deception"],
            ["a10", "10. Tactical cleverness"],
            ["a11", "11. Coaching recommendations"],
            ["a12", "12. Predictability & response patterns"],
            ["a13", "13. Improvement trends"],
          ]} onNav={scrollTo} />
          <TocSection label="Part B: Drill-down" items={[
            ...tournaments.map((t, i) => ["t" + i, t.name]),
            ["bench", "Benchmarks"],
            ["trends", "Cross-tournament trends"],
          ]} onNav={scrollTo} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <TocSection label="Appendix" items={[
            ["app-def", "A. Metric definitions"],
            ["app-zone", "B. Court zone layout"],
            ["app-codes", "C. Shot code reference"],
            ["app-arch", "D. Data architecture"],
          ]} onNav={scrollTo} />
        </div>
      </Card>

      {/* ===================== PART A ===================== */}
      <PartHeader label="A" title="Aggregate analysis (all tournaments)" />

      {/* 1. Tournament overview */}
      <SH id="a1" n="1" t="Tournament overview" />
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

      {/* 2. Court heatmaps */}
      <SH id="a2" n="2" t="Court heatmaps" />
      <p className="text-xs text-neutral-400 mb-3">
        Zone frequency maps aggregated across every captured rally. Darker = more activity.{" "}
        <ConfidenceChip confidence={confidence} />
      </p>
      <Grid c={3}>
        <div><MiniLabel>All shot targets</MiniLabel><HGrid data={allZones} tone="sky" /></div>
        <div><MiniLabel>Winner zones</MiniLabel><HGrid data={winnerZones} tone="emerald" /></div>
        <div><MiniLabel>Unforced error zones</MiniLabel><HGrid data={errorZonesAll} tone="red" /></div>
      </Grid>
      <Insight>
        Winners cluster around the top zone; errors concentrate at the hotspot opposite — the tactical
        read is to keep feeding winners while tightening the error zone.
      </Insight>

      {/* 3. Shot distribution */}
      <SH id="a3" n="3" t="Shot distribution" />
      {distribution.length === 0 ? (
        <Empty>No shots captured yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {distribution.map((s) => {
            const max = distribution[0].count;
            return (
              <div key={s.code} className="flex items-center gap-2">
                <div className="w-24 text-[11px] font-semibold text-neutral-300 text-right">{s.name}</div>
                <div className="flex-1 h-3 bg-neutral-800 rounded overflow-hidden print:bg-neutral-200">
                  <div
                    className="h-full bg-emerald-500 rounded"
                    style={{ width: `${(s.count / max) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-[11px] font-mono text-neutral-400 tabular-nums">
                  {s.count} ({s.pct}%)
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shot Mix & Effectiveness */}
      <SH id="a3-shot-mix" t="Shot Mix & Effectiveness" />
      <ShotMixEffectivenessSection data={shotMix} />

      {/* 4. Rally length profile */}
      <SH id="a4" n="4" t="Rally length profile" />
      <Grid c={4}>
        {Object.entries(lengthProfile).map(([bucket, { w, l }]) => {
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
      <RallyLengthInsight best={bestLengthBucket} />

      {/* 5. Serve & return */}
      <SH id="a5" n="5" t="Serve & return game" />
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

      {/* 6. Clutch */}
      <SH id="a6" n="6" t="Clutch performance (16–21)" />
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

      {/* 7. Fatigue */}
      <SH id="a7" n="7" t="Fatigue & endurance" />
      <Grid c={2}>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 print:border-neutral-400">
          <MiniLabel>UE rate: first half of sets (pts 1–11)</MiniLabel>
          <div className="text-3xl font-extrabold text-emerald-400">{fatigue.firstHalf.rate}%</div>
          <div className="text-[11px] text-neutral-500">
            {fatigue.firstHalf.ue} UE in {fatigue.firstHalf.points} points
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 print:border-neutral-400">
          <MiniLabel>UE rate: second half of sets (pts 12–21)</MiniLabel>
          <div className={`text-3xl font-extrabold ${fatigue.secondHalf.rate > fatigue.firstHalf.rate ? "text-red-400" : "text-emerald-400"}`}>
            {fatigue.secondHalf.rate}%
          </div>
          <div className="text-[11px] text-neutral-500">
            {fatigue.secondHalf.ue} UE in {fatigue.secondHalf.points} points
          </div>
        </div>
      </Grid>
      <div className="mt-3">
        <MiniLabel>Per-set UE rate</MiniLabel>
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

      {/* Unforced Error Breakdown */}
      <SH id="a7-ue" t="Unforced Error Breakdown" />
      <UnforcedErrorBreakdown data={unforcedErrors} />

      {/* 8. Effectiveness index */}
      <SH id="a8" n="8" t="Effectiveness index" />
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

      {/* 9. Predictability & deception */}
      <SH id="a9" n="9" t="Predictability & deception" />
      <Grid c={3}>
        <Stat l="Half-smashes (HS)" v={deception.halfSmashes} s={`in ${matches.length} match${matches.length !== 1 ? "es" : ""}`} tone="warn" />
        <Stat l="Slices (SL)" v={deception.slices} s={`in ${matches.length} match${matches.length !== 1 ? "es" : ""}`} tone="warn" />
        <Stat l="Variation / match" v={deception.perMatch} s="HS + SL + tagged deception" tone={deception.perMatch >= 3 ? "good" : "warn"} />
      </Grid>
      {deception.hasAdvancedTagging ? (
        <Grid c={4}>
          <Stat l="Holds" v={deception.holds} tone="warn" />
          <Stat l="Delays" v={deception.delays} tone="warn" />
          <Stat l="Double motion" v={deception.doubleMotion} tone="warn" />
          <Stat l="Disguised" v={deception.disguised} tone="warn" />
        </Grid>
      ) : (
        <Flag>
          Hold/delay deception is not tracked unless advanced deception tagging is used.
          Tag shots with <code className="font-mono text-emerald-300">deceptionType</code> (hold / delay / double_motion / disguised) during capture to populate this section.
        </Flag>
      )}
      {deception.perMatch < 3 && matches.length >= 2 && (
        <Flag>
          Fewer than 3 variation shots per match. HS and SL bring power deception; tagged holds/delays bring timing deception — both pry openings against disciplined opponents.
        </Flag>
      )}

      {/* 10. Tactical cleverness — contextual pro-level insights */}
      <SH id="a10" n="10" t="Tactical cleverness" />
      <p className="text-xs text-neutral-400 mb-3">
        Pro-level contextual analytics: how much you move the opponent, which
        shot unlocks your winners, whether your serves decay under pressure,
        where the opponent finishes you off, and when your momentum collapses.
      </p>

      <SubSH t="Displacement Index (opponent movement)" />
      <DisplacementViz data={advanced.displacement} />

      <SubSH t="Kill Chain (setup → winner)" />
      <KillChainList data={advanced.killChains} />

      <SubSH t="Serve ROI (LS / FS / DS · early vs late)" />
      <ServeROITable data={advanced.serveROI} />

      <SubSH t="Recovery Leak (where opp finishes after your shot)" />
      <RecoveryLeakView data={advanced.recoveryLeak} />

      <SubSH t="Momentum chunks (loss streaks of 3+)" />
      <MomentumChunksView data={advanced.momentum} />

      {/* 11. Coaching recommendations */}
      <SH id="a11" n="11" t="Coaching recommendations" />
      {recs.length === 0 ? (
        <Empty>Not enough data to generate recommendations yet — keep capturing matches.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {recs.map((r, i) => <RecBox key={i} {...r} />)}
        </div>
      )}

      {/* 12. Predictability & response patterns */}
      <SH id="a12" n="12" t="Predictability & response patterns" />
      <PredictabilityTable
        patterns={predictability}
        pressureComparisons={pressurePredictability}
        confidence={confidence}
      />

      {/* 13. Improvement trends */}
      <SH id="a13" n="13" t="Improvement trends" />
      <ImprovementTrends trends={trends} />

      {/* ===================== PART B ===================== */}
      <PartHeader label="B" title="Tournament drill-down" />
      {tournaments.map((t, ti) => <TournamentBlock key={ti} t={t} index={ti} />)}

      {/* Benchmarks */}
      <SH id="bench" t="U13/U15 reference benchmarks" />
      <Grid c={4}>
        <BenchCard l="Avg rally" target="5.6 shots" player={`${agg.avgLen || 0}`} src="COSMED" />
        <BenchCard l="3-shot win %" target="≥ 55%" player={`${serveReturn.threeShotWinPct}%`} src="BWF" />
        <BenchCard l="UE rate" target="≤ 18%" player={`${pct(agg.ue_son, agg.rallies)}%`} src="Target" />
        <BenchCard l="Effective %" target="≥ 35%" player={`${effectiveness.ePct}%`} src="BWF" />
      </Grid>

      {/* Trends placeholder */}
      <SH id="trends" t="Cross-tournament trends" />
      {tournaments.length >= 3 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-xs text-neutral-400 leading-relaxed">
          With {tournaments.length} tournaments captured, trend charts will render here in a later update.
        </div>
      ) : (
        <Empty>Need 3+ tournaments to surface cross-tournament trends — keep competing.</Empty>
      )}

      {/* ===================== APPENDIX ===================== */}
      <PartHeader label="C" title="Appendix" />

      <SH id="app-def" n="A" t="Metric definitions & formulas" />
      <AppTable rows={[
        ["Win Rate", "Points won / Total points × 100", "Basic effectiveness measure"],
        ["Unforced Error (UE)", "Error made without opponent pressure", "Missed shots from comfortable positions"],
        ["Winner (W)", "Shot the opponent cannot reach", "Untouchable winning shot"],
        ["UE Rate", "Son's UE / Total points × 100", "Target ≤ 18%"],
        ["Clutch Phase", "Any rally where a player is at 16+", "High-pressure game situations"],
        ["Clutch Deficit", "Clutch UE rate − Overall UE rate", "Positive = worse under pressure"],
        ["Rally Length", "Shots per rally", "Short (1-3), Medium (4-8), Long (9-15), Extended (16+)"],
        ["3-Shot Win Rate", "Rallies won in ≤3 shots when serving / serving points", "Target ≥ 55%"],
        ["Fatigue Ratio", "2nd-half UE rate / 1st-half UE rate", "Values ≥ 2.0 indicate fatigue concern"],
        ["Effectiveness Index", "E / N / I quality tags across every captured shot", "Target E ≥ 35%, N ~ 50%, I ≤ 15%"],
        ["Playing Style", "Classified from shot ratios", "Aggressive (>25% attack), Defensive (>20% defense), Net-dominant (>15% net), Baseline"],
        ["Deception Index", "(Holds + Slices) / Matches", "Higher = less predictable"],
      ]} />

      <SH id="app-zone" n="B" t="Court zone layout" />
      <p className="text-xs text-neutral-400 mb-3">
        Zone numbering is identical on both sides of the net — the grid moves with the player.
        Zone 1 is Front-Left from the player's own perspective, Zone 9 is Back-Right.
      </p>
      <div className="max-w-xs mx-auto">
        <ZoneDiagram playerName={playerName} />
      </div>

      <SH id="app-codes" n="C" t="Shot code reference" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
        {Object.entries(SHOT_NAMES).map(([code, name]) => (
          <div key={code} className="flex items-center gap-2 px-2 py-1 rounded bg-neutral-900 text-[11px] border border-neutral-800 print:border-neutral-400">
            <span className="font-mono font-bold text-emerald-400 w-7">{code}</span>
            <span className="text-neutral-300">{name}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-neutral-400 leading-relaxed mt-3 space-y-1">
        <div><b className="text-neutral-200">Modifiers:</b> F = Forehand, B = Backhand, ST = Straight, CR = Cross, BD = Body</div>
        <div><b className="text-neutral-200">Format:</b> Grip-Shot-Direction → e.g. F-SM-CR at Zone 5</div>
        <div><b className="text-neutral-200">Results:</b> W = Winner, FE = Forced Error, UE = Unforced Error</div>
      </div>

      <SH id="app-arch" n="D" t="Data architecture" />
      <div className="text-xs text-neutral-400 leading-relaxed space-y-2">
        <p><b className="text-neutral-200">All analysis is deterministic</b> — every metric is computed from raw rally data via formulas in <code className="font-mono text-emerald-400">src/lib/analytics.js</code>. No LLM or external service is used.</p>
        <p><b className="text-neutral-200">Data flow:</b> Capture screen → Zustand store (localStorage via <code className="font-mono">persist</code>) → Report generator → this document.</p>
        <p><b className="text-neutral-200">Raw data is the source of truth.</b> Never edit the report directly — regenerate from captured matches to keep numbers auditable.</p>
      </div>

      <div className="text-center py-6 text-[10px] text-neutral-600 border-t border-neutral-800 mt-6 print:border-neutral-400">
        Courtside Performance Analysis · {playerName} · Generated {new Date().toLocaleDateString()}
        <div className="mt-2">
          <button
            onClick={() => scrollTo("toc")}
            className="px-3 py-1 rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 print:hidden"
          >
            ↑ Back to top
          </button>
        </div>
      </div>

      <div className="h-4" />
    </Screen>
  );
}

// ===================================================================
//                    PART-B SECTION (per tournament)
// ===================================================================

function TournamentBlock({ t, index }) {
  const ts = useMemo(() => setAggregate(t.rallies), [t]);
  const style = classifyStyle(ts.shots);
  const tournamentConfidence = useMemo(
    () => computeSampleConfidence(t.matches),
    [t.matches],
  );
  const wins = t.matches.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;

  return (
    <div id={`t${index}`} className="mb-8 print:break-before-page">
      <div className="bg-emerald-900 border border-emerald-700 rounded-lg p-3 mb-3 print:bg-emerald-100 print:border-emerald-400 print:text-black">
        <div className="font-bold text-white print:text-black">{t.name}</div>
        <div className="text-xs text-emerald-200 print:text-emerald-900">
          {t.date} · {t.matches.length} match{t.matches.length !== 1 ? "es" : ""} · {t.rallies.length} rallies
        </div>
      </div>

      <Grid c={4}>
        <Stat l="Record" v={`${wins}W-${t.matches.length - wins}L`} />
        <Stat l="Win rate" v={`${pct(ts.won, ts.rallies)}%`} tone={ts.won > ts.rallies / 2 ? "good" : "bad"} />
        <Stat l="Winners" v={ts.w} tone="good" />
        <Stat l="UE rate" v={`${pct(ts.ue_son, ts.rallies)}%`} tone="bad" />
      </Grid>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mt-3 print:border-neutral-400">
        <MiniLabel>Playing style this tournament</MiniLabel>
        <div className="font-bold text-lg text-white">{style.style}</div>
        <div className="text-xs text-neutral-400">{style.desc}</div>
        <div className="mt-2"><ConfidenceChip confidence={tournamentConfidence} /></div>
      </div>

      {t.matches.map((m) => <MatchBlock key={m.id} match={m} />)}
    </div>
  );
}

function MatchBlock({ match }) {
  const sets = match.sets.map((s, si) => {
    const setRallies = match.rallies.filter((r) => r.set === si + 1);
    const agg = setAggregate(setRallies);
    const setWon = s.sonScore > s.oppScore;
    const topShot = Object.entries(agg.shots)
      .filter(([k]) => !["LS", "FS", "DS"].includes(k))
      .sort((a, b) => b[1] - a[1])[0];
    return { si, s, setWon, agg, topShot };
  });
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mt-3 print:border-neutral-400 print:break-inside-avoid">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="font-bold text-white">
          vs {match.opponent}
          {match.tournament && <span className="text-xs text-neutral-500 ml-2">({match.tournament})</span>}
        </div>
        <div className="font-mono text-xs text-neutral-300">
          {match.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", ")}
        </div>
      </div>
      {match.playerStyle && match.playerStyle !== "Unknown" && (
        <div className="text-[11px] text-neutral-400 mb-2">
          Opponent style: <span className="font-semibold text-amber-300">{match.playerStyle}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
              <Th>Set</Th><Th>Score</Th><Th>Rallies</Th><Th>W</Th><Th>FE</Th>
              <Th>UE</Th><Th>UE%</Th><Th>Avg len</Th><Th>Top shot</Th>
            </tr>
          </thead>
          <tbody>
            {sets.map(({ si, s, setWon, agg: a, topShot }) => (
              <tr key={si} className={setWon ? "bg-emerald-950/40 print:bg-emerald-50" : "bg-red-950/30 print:bg-red-50"}>
                <Td>Set {si + 1}</Td>
                <Td className={setWon ? "text-emerald-400" : "text-red-400"}>{s.sonScore}-{s.oppScore}</Td>
                <Td>{a.rallies}</Td>
                <Td>{a.w}</Td>
                <Td>{a.fe}</Td>
                <Td className={a.ue_son > 3 ? "text-red-400" : ""}>{a.ue_son}</Td>
                <Td className={pct(a.ue_son, a.rallies) > 20 ? "text-red-400 font-bold" : ""}>{pct(a.ue_son, a.rallies)}%</Td>
                <Td>{a.avgLen}</Td>
                <Td>{topShot ? `${SHOT_NAMES[topShot[0]] || topShot[0]} (${topShot[1]})` : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div><MiniLabel>Shot targets</MiniLabel><HGrid data={reduceZones(match.rallies, "all")} tone="sky" small /></div>
        <div><MiniLabel>Winner zones</MiniLabel><HGrid data={reduceZones(match.rallies, "winner")} tone="emerald" small /></div>
        <div><MiniLabel>Error zones</MiniLabel><HGrid data={reduceZones(match.rallies, "error")} tone="red" small /></div>
      </div>
    </div>
  );
}

function reduceZones(rallies, kind) {
  const z = {};
  for (const r of rallies) {
    if (kind === "all") {
      for (const s of r.shots) if (s.zone) z[s.zone] = (z[s.zone] || 0) + 1;
      continue;
    }
    const matches = kind === "winner"
      ? r.result === "W" && r.pointWonBy === "S"
      : r.result === "UE" && r.pointWonBy === "O";
    if (!matches) continue;
    const last = r.shots[r.shots.length - 1];
    if (last?.zone) z[last.zone] = (z[last.zone] || 0) + 1;
  }
  return z;
}

// ===================================================================
//                        INLINE COMPONENTS
// ===================================================================

// ===================================================================
//                      PRO-LEVEL FINDINGS (Phase 11)
//  Renders the deterministic pro-level findings near the top of the
//  report. Each card is driven entirely by the bundle — the same data
//  used by the markdown export, so on-screen and exported reports stay
//  in sync.
// ===================================================================
function ProLevelFindings({
  confidence, leaks, bestLengthBucket, clutch, scorePressure,
  serveThirdShot, serveReturn, effectiveness, zoneWeakness,
  deception, killChainAnalysis, trainingPlan,
}) {
  const sevTone = {
    critical: "bad",
    high: "warn",
    medium: "warn",
    low: "default",
  };

  return (
    <Card className="mb-5 print:break-after-page">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-400 font-semibold">Pro-level findings</div>
          <div className="text-base font-bold text-white print:text-black">10-section deterministic snapshot</div>
        </div>
        <ConfidenceChip confidence={confidence} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* 1. Data Confidence */}
        <FindingCard n={1} title="Data confidence">
          <div className="text-xs text-neutral-300 print:text-black">
            <b>{confidence.label}</b> — {confidence.matches} match{confidence.matches !== 1 ? "es" : ""},{" "}
            {confidence.rallies} rallies.
          </div>
          {confidence.isDirectional && (
            <div className="text-[11px] text-amber-300 mt-1">Findings should be read as directional only.</div>
          )}
        </FindingCard>

        {/* 2. Top Performance Leaks */}
        <FindingCard n={2} title="Top performance leaks">
          <div className="flex flex-col gap-1">
            {leaks.slice(0, 3).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-200 truncate print:text-black">{l.title}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-neutral-500 font-mono">{l.valueLabel}</span>
                  <SeverityPill severity={l.severity} />
                </span>
              </div>
            ))}
          </div>
        </FindingCard>

        {/* 3. Rally-Length Truth */}
        <FindingCard n={3} title="Rally-length truth">
          {bestLengthBucket.bucket ? (
            <div className="text-xs text-neutral-300 print:text-black">
              Best win rate in <b>{bestLengthBucket.bucket}-shot</b> rallies — {bestLengthBucket.winPct}%
              ({bestLengthBucket.won}W / {bestLengthBucket.lost}L from {bestLengthBucket.total} rallies).
              {!bestLengthBucket.strong && (
                <span className="block text-[11px] text-amber-300 mt-0.5">Sample size small — directional.</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-neutral-500 print:text-black">Not enough rallies to call out a strongest length range yet.</div>
          )}
        </FindingCard>

        {/* 4. Pressure & Closing Ability */}
        <FindingCard n={4} title="Pressure & closing">
          <div className="text-xs text-neutral-300 print:text-black">
            Clutch UE {clutch.clutchUEPct}% vs overall {clutch.overallUEPct}% (Δ {clutch.deficit >= 0 ? "+" : ""}{clutch.deficit}pp).
            Clutch win {clutch.clutchWinPct}% across {clutch.clutchPoints} pts.
          </div>
          {scorePressure && scorePressure.total > 0 && (
            <div className="text-[11px] text-neutral-500 mt-1">
              Loss-streak chunks: {scorePressure.counts.mental}M · {scorePressure.counts.physical}P ·{" "}
              {scorePressure.counts.tactical}T · {scorePressure.counts.mixed}X.
            </div>
          )}
        </FindingCard>

        {/* 5. Serve + Third Shot */}
        <FindingCard n={5} title="Serve + third shot">
          <div className="text-xs text-neutral-300 print:text-black">
            3-shot win {serveReturn.threeShotWinPct}% ({serveReturn.threeShotWon}/{serveReturn.threeShotPoints}).
          </div>
          {serveThirdShot.length > 0 ? (
            <div className="text-[11px] text-neutral-500 mt-1">
              {serveThirdShot.length} (serve, target) bucket{serveThirdShot.length !== 1 ? "s" : ""} captured.
            </div>
          ) : (
            <div className="text-[11px] text-amber-300 mt-1">
              No serveTarget data captured — tag during next session for a richer table.
            </div>
          )}
        </FindingCard>

        {/* 6. Neutral-to-Pressure Conversion */}
        <FindingCard n={6} title="Neutral-to-pressure conversion">
          {effectiveness.total === 0 ? (
            <div className="text-xs text-amber-300 print:text-black">Tag shots E/N/I to power this finding.</div>
          ) : (
            <div className="text-xs text-neutral-300 print:text-black">
              E {effectiveness.ePct}% · N {effectiveness.nPct}% · I {effectiveness.iPct}%.
              {effectiveness.nPct > 60 && (
                <span className="block text-[11px] text-amber-300 mt-0.5">
                  Neutral &gt; 60% — rallies stay flat instead of building pressure.
                </span>
              )}
            </div>
          )}
        </FindingCard>

        {/* 7. Zone Weakness Confidence */}
        <FindingCard n={7} title="Zone weakness confidence">
          <div className="text-xs text-neutral-300 print:text-black">{zoneWeakness.finding}</div>
          {!zoneWeakness.supportedBackhandClaim && zoneWeakness.totalErrors > 0 && (
            <div className="text-[11px] text-amber-300 mt-1">
              Capture <code className="font-mono">originZone</code>, <code className="font-mono">bodySide</code>,
              and <code className="font-mono">contactQuality</code> to confirm.
            </div>
          )}
        </FindingCard>

        {/* 8. Deception & Variation */}
        <FindingCard n={8} title="Deception & variation">
          <div className="text-xs text-neutral-300 print:text-black">
            HS {deception.halfSmashes} · SL {deception.slices}.
            {deception.hasAdvancedTagging
              ? ` Hold ${deception.holds} · Delay ${deception.delays} · Disguised ${deception.disguised}.`
              : ""}
          </div>
          {!deception.hasAdvancedTagging && (
            <div className="text-[11px] text-amber-300 mt-1">
              Hold/delay deception is not tracked unless advanced deception tagging is used.
            </div>
          )}
        </FindingCard>

        {/* 9. Kill chains */}
        <FindingCard n={9} title="Kill chains">
          <div className="text-xs text-neutral-300 print:text-black">{killChainAnalysis.finding}</div>
          {killChainAnalysis.anyRepeatable && (
            <div className="text-[11px] text-emerald-300 mt-1">
              Repeatable: 1-shot {killChainAnalysis.oneShot.repeatable.length} ·
              {" "}2-shot {killChainAnalysis.twoShot.repeatable.length} ·
              {" "}3-shot {killChainAnalysis.threeShot.repeatable.length}.
            </div>
          )}
        </FindingCard>

        {/* 10. Training prescription */}
        <FindingCard n={10} title="Training prescription">
          <div className="flex flex-col gap-1">
            {trainingPlan.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-200 truncate print:text-black">{p.priority}. {p.title}</span>
                <SeverityPill severity={p.severity} />
              </div>
            ))}
            {trainingPlan.length > 3 && (
              <div className="text-[10px] text-neutral-500">+{trainingPlan.length - 3} more</div>
            )}
          </div>
        </FindingCard>
      </div>
    </Card>
  );

  // Local helper — using the parent's tone map.
  function SeverityPill({ severity }) {
    const t = sevTone[severity] || "default";
    const tones = {
      bad:     "bg-red-950/60 text-red-300 border-red-800/70",
      warn:    "bg-amber-950/60 text-amber-300 border-amber-800/70",
      default: "bg-neutral-900 text-neutral-400 border-neutral-700",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${tones[t]} print:bg-white print:text-black print:border-neutral-400`}>
        {severity}
      </span>
    );
  }
}

// ===================================================================
//                    UNFORCED ERROR BREAKDOWN
//  Coach-facing UE split. Count = where mistakes happened most; rate =
//  mistakes divided by opportunities for that zone/pattern.
// ===================================================================
// `omit` lets a caller drop sub-tables. Custom Report uses
// omit=["origin_zone", "top_patterns"] to keep just the insight summary.
export function UnforcedErrorBreakdown({ data, omit = [] }) {
  if (!data || data.totalUEs === 0) {
    return <Empty>No Son unforced errors captured in this scope.</Empty>;
  }
  const skip = (key) => omit.includes(key);

  const originMain = data.ueByInferredOriginZone.filter((row) => row.sampleLevel === "main");
  const originDirectional = data.ueByInferredOriginZone.filter((row) => row.sampleLevel === "directional_only");
  const originBelow = data.ueByInferredOriginZone.filter((row) => row.sampleLevel === "below_threshold");
  const patternMain = data.topUEPatterns.filter((row) => row.sampleLevel === "main");
  const patternDirectional = data.topUEPatterns.filter((row) => row.sampleLevel === "directional_only");
  const patternBelow = data.ueByResponsePattern.filter((row) => row.sampleLevel === "below_threshold");

  return (
    <div className="space-y-3">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 print:bg-white print:border-neutral-400">
        <div className="text-xs text-neutral-300 leading-relaxed print:text-black">{data.insight}</div>
        <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed print:text-black">
          Count shows where errors occurred most often. UE rate adjusts for how often that zone/pattern occurred.
        </div>
      </div>

      {!skip("origin_zone") && (
        <UETableFrame title="UE by inferred origin zone" belowCount={originBelow.length}>
          {originMain.length === 0 && originDirectional.length === 0 ? (
            <tbody>
              <tr>
                <Td colSpan={6} className="text-neutral-500 print:text-black">
                  No origin-zone denominator reaches the 3-opportunity directional threshold yet.
                </Td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {originMain.map((row) => <UEOriginRow key={row.key} row={row} />)}
              {originDirectional.map((row) => <UEOriginRow key={row.key} row={row} directional />)}
            </tbody>
          )}
        </UETableFrame>
      )}

      {!skip("top_patterns") && (
        <UETableFrame title="Top UE patterns" belowCount={patternBelow.length} pattern>
          {patternMain.length === 0 && patternDirectional.length === 0 ? (
            <tbody>
              <tr>
                <Td colSpan={6} className="text-neutral-500 print:text-black">
                  No response-pattern denominator reaches the 3-opportunity directional threshold yet.
                </Td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {patternMain.map((row) => <UEPatternRow key={row.key} row={row} />)}
              {patternDirectional.map((row) => <UEPatternRow key={row.key} row={row} directional />)}
            </tbody>
          )}
        </UETableFrame>
      )}
    </div>
  );
}

function UETableFrame({ title, children, belowCount, pattern = false }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 mb-1.5 print:text-black">
        {title}
      </div>
      <div className="overflow-x-auto bg-neutral-950/70 border border-neutral-800 rounded-md print:bg-white print:border-neutral-400">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
              {pattern ? (
                <>
                  <Th>Incoming pattern</Th>
                  <Th>Error response</Th>
                  <Th>Count</Th>
                  <Th>UE rate</Th>
                  <Th>Phase</Th>
                  <Th>Evidence</Th>
                </>
              ) : (
                <>
                  <Th>Zone</Th>
                  <Th>UE count</Th>
                  <Th>Opportunities</Th>
                  <Th>UE rate</Th>
                  <Th>Top error response</Th>
                  <Th>Evidence</Th>
                </>
              )}
            </tr>
          </thead>
          {children}
        </table>
      </div>
      {belowCount > 0 && (
        <div className="text-[10px] text-neutral-500 mt-1 print:text-black">
          +{belowCount} below-threshold row{belowCount !== 1 ? "s" : ""} hidden (2 or fewer opportunities).
        </div>
      )}
    </div>
  );
}

function UEOriginRow({ row, directional = false }) {
  return (
    <tr className={`border-b border-neutral-800 print:border-neutral-300 align-top ${directional ? "bg-amber-950/20 print:bg-amber-50" : "bg-neutral-900 print:bg-white"}`}>
      <Td className="font-mono text-neutral-200 whitespace-nowrap print:text-black">{row.label}</Td>
      <Td className="font-mono tabular-nums">
        {row.count} <span className="text-neutral-500">({row.pctOfTotalUEs}%)</span>
      </Td>
      <Td className="font-mono tabular-nums">{row.opportunities}</Td>
      <Td><UERate row={row} /></Td>
      <Td className="font-mono text-neutral-300 print:text-black">
        {row.topErrorResponse?.label || "—"}
        {directional && <SampleBadge label="directional only" />}
      </Td>
      <Td><EvidenceList evidence={row.evidence} /></Td>
    </tr>
  );
}

function UEPatternRow({ row, directional = false }) {
  return (
    <tr className={`border-b border-neutral-800 print:border-neutral-300 align-top ${directional ? "bg-amber-950/20 print:bg-amber-50" : "bg-neutral-900 print:bg-white"}`}>
      <Td className="font-mono text-neutral-200 whitespace-nowrap print:text-black">{row.incomingPattern}</Td>
      <Td className="font-mono text-neutral-300 whitespace-nowrap print:text-black">
        {row.errorResponse}
        {directional && <SampleBadge label="directional only" />}
      </Td>
      <Td className="font-mono tabular-nums">
        {row.count} <span className="text-neutral-500">({row.pctOfTotalUEs}%)</span>
      </Td>
      <Td><UERate row={row} /></Td>
      <Td className="text-[10px] text-neutral-400 print:text-black">{row.phaseLabel}</Td>
      <Td><EvidenceList evidence={row.evidence} /></Td>
    </tr>
  );
}

function UERate({ row }) {
  if (row.ueRate == null) return <span className="text-neutral-600 print:text-black">—</span>;
  return (
    <span className={`font-mono tabular-nums ${row.ueRate >= 30 ? "text-red-400" : row.ueRate >= 18 ? "text-amber-300" : "text-neutral-300"} print:text-black`}>
      {row.ueRate}% <span className="text-neutral-500">({row.count}/{row.opportunities})</span>
    </span>
  );
}

function EvidenceList({ evidence }) {
  if (!evidence?.length) return <span className="text-neutral-600 print:text-black">—</span>;
  return (
    <span className="text-[10px] text-neutral-500 max-w-[16rem] block truncate print:max-w-none print:whitespace-normal print:text-black">
      {evidence.map((e) => e.label).join(", ")}
    </span>
  );
}

function SampleBadge({ label }) {
  return (
    <span className="ml-1 px-1 py-0.5 rounded border border-amber-800/70 bg-amber-950/60 text-[8px] uppercase tracking-wider text-amber-300 print:bg-white print:text-black print:border-neutral-400">
      {label}
    </span>
  );
}

// ===================================================================
//                  PREDICTABILITY & RESPONSE PATTERNS
//  Deterministic counts: per (Opp shotType+zone) stimulus, what's Son's
//  most-common response, how often does it work, and is a less-used
//  alternative outperforming it?
// ===================================================================
function PredictabilityTable({ patterns, pressureComparisons = [], confidence }) {
  // Split by sample size:
  //   major     = total >= 5  → main table, claims allowed
  //   directional = total 3–4 → compact secondary section, "directional only"
  //   below     = total 1–2  → just a count, never a claim
  const major = patterns.filter((p) => p.total >= 5);
  const directional = patterns.filter((p) => p.total === 3 || p.total === 4);
  const below = patterns.filter((p) => p.total > 0 && p.total < 3);
  const majorKeys = new Set(major.map((p) => p.stimulusKey));
  const pressureRows = (pressureComparisons || [])
    .filter((c) => majorKeys.has(c.stimulusKey))
    .sort(
      (a, b) =>
        Number(b.pressurePredictability) - Number(a.pressurePredictability) ||
        b.maxPressureDelta - a.maxPressureDelta ||
        b.phases.all.total - a.phases.all.total,
    );

  if (major.length === 0 && directional.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-xs text-neutral-400 leading-relaxed print:border-neutral-400 print:bg-white">
        Not enough qualifying stimulus → response samples yet (need 3+ per pattern).
        {below.length > 0 && ` ${below.length} pattern${below.length !== 1 ? "s" : ""} with 1–2 occurrences (no claim).`}
        <div className="text-neutral-500 mt-2">
          Patterns are deterministic counts from tagged rallies. Claims require minimum sample size (5).
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <ConfidenceChip confidence={confidence} />
        {directional.length > 0 && (
          <span className="text-[11px] text-amber-300">
            +{directional.length} directional-only pattern{directional.length !== 1 ? "s" : ""} (3–4 occurrences)
          </span>
        )}
        {below.length > 0 && (
          <span className="text-[11px] text-neutral-500">
            +{below.length} below threshold (≤ 2)
          </span>
        )}
      </div>

      {/* Main table — major patterns (>= 5) */}
      {major.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
                <Th>Incoming pattern</Th>
                <Th>Top response</Th>
                <Th>Frequency</Th>
                <Th>Win %</Th>
                <Th>UE %</Th>
                <Th>Classification</Th>
                <Th>Evidence</Th>
              </tr>
            </thead>
            <tbody>
              {major.map((p) => <PatternRow key={p.stimulusKey} p={p} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 text-xs text-neutral-400 print:border-neutral-400 print:bg-white">
          No pattern reaches the 5-occurrence threshold yet — see directional table below.
        </div>
      )}

      {/* Pressure-phase comparison — all-points baseline vs score/state subsets */}
      {pressureRows.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 mb-1.5 print:text-black">
            Pressure-phase comparison
          </div>
          <div className="overflow-x-auto bg-neutral-950/70 border border-neutral-800 rounded-md print:bg-white print:border-neutral-400">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
                  <Th>Incoming</Th>
                  <Th>All</Th>
                  <Th>Clutch</Th>
                  <Th>Leading</Th>
                  <Th>Trailing</Th>
                  <Th>After lost</Th>
                  <Th>Flag</Th>
                </tr>
              </thead>
              <tbody>
                {pressureRows.map((c) => <PressureComparisonRow key={c.stimulusKey} comparison={c} />)}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 print:text-black">
            Pressure flags trigger at +15pp versus all-points frequency. Phase samples under 5 are directional.
          </div>
        </div>
      )}

      {/* Compact directional section — total 3 or 4 only */}
      {directional.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-400 mb-1.5 print:text-black">
            Directional only / low sample (3–4 occurrences)
          </div>
          <div className="overflow-x-auto bg-amber-950/20 border border-amber-900/40 rounded-md print:bg-amber-50 print:border-amber-300">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-amber-950/40 text-amber-200 print:bg-amber-100 print:text-black">
                  <Th>Incoming</Th>
                  <Th>Top response</Th>
                  <Th>Freq</Th>
                  <Th>Win %</Th>
                  <Th>Evidence</Th>
                </tr>
              </thead>
              <tbody>
                {directional.map((p) => (
                  <tr key={p.stimulusKey} className="border-b border-amber-900/30 print:border-amber-200 align-top">
                    <Td className="font-mono text-amber-200 whitespace-nowrap print:text-black">
                      {p.stimulusLabel}
                    </Td>
                    <Td className="font-mono text-amber-100/90 print:text-black">
                      {p.topResponse
                        ? `Son ${p.topResponse.responseGrip || "?"}-${p.topResponse.responseShotType}-${p.topResponse.responseDirection || "?"} to Z${p.topResponse.responseTargetZone}`
                        : "—"}
                    </Td>
                    <Td className="font-mono tabular-nums">
                      {p.topResponse?.count ?? 0}/{p.total} <span className="text-amber-300/70">({p.topResponsePct}%)</span>
                    </Td>
                    <Td className="font-mono tabular-nums">{p.topResponseWinPct}%</Td>
                    <Td className="text-[10px] text-amber-300/80 max-w-[16rem] truncate print:text-black print:max-w-none print:whitespace-normal">
                      {p.evidence
                        .map((e) => `${e.matchId} R${e.rallyIndex}${e.score ? ` @ ${e.score}` : ""}`)
                        .join(", ")}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-amber-300/80 mt-1 print:text-black">
            Sample sizes 3–4 — surfaced for awareness only. Don&apos;t form coaching prescriptions from these rows.
          </div>
        </div>
      )}

      <div className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
        Patterns are deterministic counts from tagged rallies. Claims require minimum sample size (5).
      </div>
    </>
  );
}

function PressureComparisonRow({ comparison }) {
  const flags = comparison.pressureFlags || [];
  return (
    <tr className={`border-b border-neutral-800 print:border-neutral-300 align-top ${comparison.pressurePredictability ? "bg-amber-950/20 print:bg-amber-50" : "bg-neutral-900 print:bg-white"}`}>
      <Td className="font-mono text-neutral-200 whitespace-nowrap print:text-black">
        {comparison.stimulusLabel}
      </Td>
      <Td><PhaseCell summary={comparison.phases.all} /></Td>
      <Td><PhaseCell summary={comparison.phases.clutch} /></Td>
      <Td><PhaseCell summary={comparison.phases.leading} /></Td>
      <Td><PhaseCell summary={comparison.phases.trailing} /></Td>
      <Td><PhaseCell summary={comparison.phases.after_lost_point} /></Td>
      <Td className="min-w-[14rem]">
        {flags.length > 0 ? (
          <div className="space-y-1">
            {flags.map((flag) => (
              <div key={flag.phase}>
                <div className="flex flex-wrap items-center gap-1">
                  <ClassChip label="pressure_predictability" />
                  <span className="font-mono tabular-nums text-amber-300 print:text-black">
                    {flag.phaseLabel} +{flag.deltaPct}pp
                  </span>
                  {flag.lowSample && (
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500 print:text-black">
                      directional
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-amber-200/90 leading-snug mt-0.5 print:text-black">
                  {flag.insight}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-neutral-600 print:text-black">—</span>
        )}
      </Td>
    </tr>
  );
}

function PhaseCell({ summary }) {
  if (!summary || summary.total === 0) {
    return <span className="text-neutral-600 print:text-black">—</span>;
  }
  const delta = summary.phase !== "all" ? summary.deltaFromAll : null;
  return (
    <div className="font-mono tabular-nums leading-tight">
      <div className="text-neutral-200 print:text-black">
        {summary.topResponsePct}%
        <span className="text-neutral-500 ml-1">({summary.topResponseCount}/{summary.total})</span>
      </div>
      <div className="text-[10px] text-neutral-500 whitespace-nowrap print:text-black">
        {shortResponse(summary.topResponse)}
      </div>
      {delta !== null && delta !== 0 && (
        <div className={`text-[10px] ${delta >= 15 ? "text-amber-300" : delta > 0 ? "text-neutral-300" : "text-neutral-500"} print:text-black`}>
          {delta > 0 ? "+" : ""}{delta}pp
        </div>
      )}
    </div>
  );
}

function shortResponse(response) {
  if (!response) return "—";
  const grip = response.responseGrip || "?";
  const shot = response.responseShotType || "?";
  const dir = response.responseDirection || "?";
  const zone = response.responseTargetZone ?? "?";
  return `${grip}-${shot}-${dir} to Z${zone}`;
}

// Single row for the major pattern table — kept inline so PatternRow shares
// styling rules with the directional table without duplicating the logic.
function PatternRow({ p }) {
  return (
    <tr className="bg-neutral-900 print:bg-white border-b border-neutral-800 print:border-neutral-300 align-top">
      <Td className="font-mono text-neutral-200 whitespace-nowrap print:text-black">
        {p.stimulusLabel}
      </Td>
      <Td className="font-mono text-neutral-300 print:text-black">
        {p.topResponse
          ? `Son ${p.topResponse.responseGrip || "?"}-${p.topResponse.responseShotType}-${p.topResponse.responseDirection || "?"} to Z${p.topResponse.responseTargetZone}`
          : "—"}
      </Td>
      <Td className="font-mono tabular-nums">
        {p.topResponse ? `${p.topResponse.count}/${p.total}` : "—"}
        <span className="text-neutral-500 ml-1">({p.topResponsePct}%)</span>
      </Td>
      <Td className={`font-mono tabular-nums ${p.topResponseWinPct >= 60 ? "text-emerald-400" : p.topResponseWinPct <= 40 ? "text-red-400" : ""}`}>
        {p.topResponseWinPct}%
      </Td>
      <Td className={`font-mono tabular-nums ${p.topResponseUePct >= 25 ? "text-red-400" : ""}`}>
        {p.topResponseUePct}%
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {p.classifications.map((c) => <ClassChip key={c} label={c} />)}
        </div>
        {p.alternativeRecommendation && (
          <div className="text-[10px] text-amber-300 mt-1 leading-snug print:text-black">
            ↻ Alt response wins {p.alternativeRecommendation.altWinPct}% (Δ +{p.alternativeRecommendation.deltaPct}pp). Consider varying.
          </div>
        )}
      </Td>
      <Td className="text-[10px] text-neutral-500 max-w-[16rem] truncate print:max-w-none print:whitespace-normal print:text-black">
        {p.evidence
          .map((e) => `${e.matchId} R${e.rallyIndex}${e.score ? ` @ ${e.score}` : ""}`)
          .join(", ")}
      </Td>
    </tr>
  );
}

const CLASS_CHIP_TONE = {
  strong_predictability:   "bg-amber-950/60 text-amber-300 border-amber-800/70",
  moderate_predictability: "bg-amber-950/40 text-amber-300 border-amber-900/60",
  weapon:                  "bg-emerald-950/60 text-emerald-300 border-emerald-800/70",
  liability:               "bg-red-950/60 text-red-300 border-red-800/70",
  pressure_predictability:  "bg-amber-950/70 text-amber-200 border-amber-700/80",
  directional_only:        "bg-neutral-800 text-neutral-400 border-neutral-700",
};

function ClassChip({ label }) {
  const tone = CLASS_CHIP_TONE[label] || CLASS_CHIP_TONE.directional_only;
  const text = label.replace(/_/g, " ");
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${tone} print:bg-white print:text-black print:border-neutral-400`}>
      {text}
    </span>
  );
}

// ===================================================================
//                       IMPROVEMENT TRENDS (Section 13)
//  Sub-sections:
//    A. Trend readiness         — gating + baseline message
//    B. Tournament comparison   — table per tournament
//    C. Rolling window comparison — last 100 rallies / last 5 matches
//    D. Training focus progress  — focus-area roll-up
//    E. Baseline metrics         — fallback when not enough data
// ===================================================================
function ImprovementTrends({ trends }) {
  if (!trends) return null;
  const { readiness, baseline, byTournament, rolling, trainingFocus } = trends;

  return (
    <div className="flex flex-col gap-4">
      {/* A. Trend readiness */}
      <SubSection label="A" title="Trend readiness">
        <div className={`rounded-md p-3 text-xs leading-relaxed border ${
          readiness.canCompare
            ? "bg-sky-950/40 border-sky-900/60 text-sky-200 print:bg-sky-50 print:text-black print:border-sky-300"
            : "bg-amber-950/40 border-amber-900/60 text-amber-200 print:bg-amber-50 print:text-black print:border-amber-300"
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-neutral-900 print:bg-white">
              {readiness.level.replace(/_/g, " ")}
            </span>
            <span className="font-mono">{readiness.totalMatches}m / {readiness.totalRallies}r</span>
          </div>
          <div className="mt-1.5">{readiness.message}</div>
        </div>
      </SubSection>

      {/* B. Tournament comparison */}
      <SubSection label="B" title="Tournament comparison">
        {byTournament.length === 0 ? (
          <Empty>No tournament data captured yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
                  <Th>Tournament</Th>
                  <Th>Matches</Th>
                  <Th>Rallies</Th>
                  <Th>UE %</Th>
                  <Th>Clutch UE %</Th>
                  <Th>Z7 UE %</Th>
                  <Th>Effective %</Th>
                  <Th>3-shot win %</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {byTournament.map(({ window: w, metrics }, i) => (
                  <tr key={i} className="bg-neutral-900 print:bg-white border-b border-neutral-800 print:border-neutral-300">
                    <Td className="font-semibold text-neutral-100 print:text-black">{w.label}</Td>
                    <Td className="font-mono">{w.matches.length}</Td>
                    <Td className="font-mono">{metrics.rallies}</Td>
                    <Td className="font-mono">{metrics.ueRate}%</Td>
                    <Td className="font-mono">{metrics.clutchUERate}%</Td>
                    <Td className="font-mono">{metrics.z7UERate}%</Td>
                    <Td className="font-mono">{metrics.effectivePct}%</Td>
                    <Td className="font-mono">{metrics.threeShotWinRate}%</Td>
                    <Td><SampleChip level={metrics.sampleLevel} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SubSection>

      {/* C. Rolling window comparison */}
      <SubSection label="C" title="Rolling window comparison">
        <RollingWindowBlock
          title="Last 100 rallies vs previous 100"
          window={rolling.last100Rallies}
        />
        <RollingWindowBlock
          title="Last 5 matches vs previous 5"
          window={rolling.last5Matches}
        />
      </SubSection>

      {/* D. Training focus progress */}
      <SubSection label="D" title="Training focus progress">
        {trainingFocus.length === 0 ? (
          <Empty>Need at least two windows of data to track training focus progress.</Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {trainingFocus.map((focus) => <TrainingFocusBlock key={focus.id} focus={focus} />)}
          </div>
        )}
      </SubSection>

      {/* E. Baseline metrics */}
      <SubSection label="E" title="Current baseline metrics">
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
          Trend claims activate once two windows of 30+ rallies each are available.
        </div>
      </SubSection>
    </div>
  );
}

// Sub-section wrapper with a small "A / B / ..." label.
export function SubSection({ label, title, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-emerald-400 print:text-black">{label}.</span>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 print:text-black">{title}</span>
      </div>
      {children}
    </div>
  );
}

const TREND_TONE = {
  strong_improvement: "bg-emerald-700 text-white border-emerald-500",
  improvement:        "bg-emerald-950/60 text-emerald-300 border-emerald-800/70",
  stable:             "bg-neutral-800 text-neutral-300 border-neutral-700",
  regression:         "bg-amber-950/60 text-amber-300 border-amber-800/70",
  strong_regression:  "bg-red-700 text-white border-red-500",
  insufficient:       "bg-neutral-900 text-neutral-500 border-neutral-700",
};

export function TrendChip({ status }) {
  const tone = TREND_TONE[status] || TREND_TONE.stable;
  const text = (status || "stable").replace(/_/g, " ");
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${tone} print:bg-white print:text-black print:border-neutral-400`}>
      {text}
    </span>
  );
}

const SAMPLE_TONE = {
  insufficient:     "bg-neutral-900 text-neutral-500 border-neutral-700",
  very_directional: "bg-amber-950/60 text-amber-300 border-amber-800/70",
  directional:      "bg-amber-950/40 text-amber-300 border-amber-900/60",
  moderate:         "bg-sky-950/60 text-sky-300 border-sky-800/70",
  reliable:         "bg-emerald-950/60 text-emerald-300 border-emerald-800/70",
};
export function SampleChip({ level }) {
  const tone = SAMPLE_TONE[level] || SAMPLE_TONE.directional;
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${tone} print:bg-white print:text-black print:border-neutral-400`}>
      {(level || "directional").replace(/_/g, " ")}
    </span>
  );
}

export function RollingWindowBlock({ title, window }) {
  if (!window || (!window.previous && !window.current)) {
    return (
      <div className="mb-2">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">{title}</div>
        <Empty>Not enough rallies yet.</Empty>
      </div>
    );
  }
  const { previous, current, comparisons } = window;
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">{title}</div>
      {!previous ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 text-xs text-neutral-400 print:border-neutral-400 print:bg-white">
          Only one window so far ({current?.label}: {current?.count} rallies). Need a second window for comparison.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
                <Th>Metric</Th>
                <Th>Previous</Th>
                <Th>Current</Th>
                <Th>Delta</Th>
                <Th>Trend</Th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr key={c.metricName} className="bg-neutral-900 print:bg-white border-b border-neutral-800 print:border-neutral-300">
                  <Td className="font-semibold text-neutral-200 print:text-black">{c.metricName}</Td>
                  <Td className="font-mono">{c.previousValue ?? "—"}</Td>
                  <Td className="font-mono">{c.currentValue ?? "—"}</Td>
                  <Td className={`font-mono ${c.delta > 0 ? "text-amber-300" : c.delta < 0 ? "text-emerald-300" : "text-neutral-400"}`}>
                    {c.status === "insufficient" ? "—" : `${c.delta >= 0 ? "+" : ""}${c.delta}`}
                  </Td>
                  <Td><TrendChip status={c.status} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-neutral-500 mt-1">
            {previous.label}: {previous.count} rallies · {current.label}: {current.count} rallies
          </div>
        </div>
      )}
    </div>
  );
}

export function TrainingFocusBlock({ focus }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3 print:bg-white print:border-neutral-400">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="font-bold text-neutral-100 print:text-black">{focus.title}</div>
        <div className="flex items-center gap-2">
          <SampleChip level={focus.confidence} />
          <TrendChip status={focus.status} />
        </div>
      </div>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-neutral-800/60 text-neutral-300 print:bg-neutral-200 print:text-black">
            <Th>Metric</Th>
            <Th>Baseline</Th>
            <Th>Latest</Th>
            <Th>Δ</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {focus.metrics.map((m) => (
            <tr key={m.name} className="border-b border-neutral-800 print:border-neutral-300">
              <Td className="text-neutral-200 print:text-black">{m.label}</Td>
              <Td className="font-mono">{m.previousValue ?? "—"}</Td>
              <Td className="font-mono">{m.currentValue ?? "—"}</Td>
              <Td className={`font-mono ${m.status === "insufficient" ? "text-neutral-500" : ""}`}>
                {m.status === "insufficient" ? "—" : `${m.delta >= 0 ? "+" : ""}${m.delta}`}
              </Td>
              <Td><TrendChip status={m.status} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10px] text-neutral-500 mt-1">
        Baseline: {focus.baselineRallies} rallies · Latest: {focus.latestRallies} rallies
      </div>
    </div>
  );
}

function FindingCard({ n, title, children }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 print:bg-white print:border-neutral-400">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-emerald-400 print:text-black">{n}.</span>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 print:text-black">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function PartHeader({ label, title }) {
  return (
    <div className="bg-emerald-800 border border-emerald-600 rounded-lg px-4 py-2.5 mt-8 mb-3 print:bg-emerald-100 print:border-emerald-500 print:text-black print:break-before-page">
      <div className="text-[11px] text-emerald-200 font-semibold print:text-emerald-900">Part {label}</div>
      <div className="text-white font-bold text-base print:text-black">{title}</div>
    </div>
  );
}

export function SH({ id, n, t }) {
  return (
    <h2
      id={id}
      className="text-sm font-bold text-emerald-400 mt-6 mb-2 pb-1 border-b border-emerald-900 print:text-black print:border-neutral-400"
    >
      {n && <span className="text-neutral-500 font-normal mr-1">{n}.</span>}
      {t}
    </h2>
  );
}

// Smaller sub-section header used inside section 10's "Tactical cleverness".
function SubSH({ t }) {
  return (
    <h3 className="text-[11px] font-bold text-sky-300 uppercase tracking-[0.15em] mt-4 mb-2 print:text-black">
      {t}
    </h3>
  );
}

// ---- Displacement Index bar ----
function DisplacementViz({ data }) {
  const max = Math.max(data.max, data.won, data.lost) || 1;
  const wonPct = (data.won / max) * 100;
  const lostPct = (data.lost / max) * 100;
  const verdict = data.verdict === "movement-driven"
    ? { tone: "text-emerald-300", text: `Winning by moving the opponent (Δ ${data.delta > 0 ? "+" : ""}${data.delta}).` }
    : data.verdict === "power-driven"
    ? { tone: "text-amber-300", text: `Winning through raw power/luck — displacement under 1.2 suggests you're finishing early, not wearing the opponent out.` }
    : data.verdict === "balanced"
    ? { tone: "text-sky-300", text: `Balanced approach — moderate displacement on wins.` }
    : { tone: "text-neutral-500", text: "Need at least 3 winning rallies with recorded zones to classify." };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 print:bg-white print:border-neutral-400">
      {data.wonRallies + data.lostRallies === 0 ? (
        <Empty>No rallies with enough shot-zone data yet.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-[70px,1fr,80px] gap-x-3 gap-y-2 items-center text-[11px]">
            <span className="text-emerald-300 font-semibold">Won rallies</span>
            <div className="h-3 bg-neutral-800 rounded overflow-hidden print:bg-neutral-200">
              <div className="h-full bg-emerald-500 rounded" style={{ width: `${wonPct}%` }} />
            </div>
            <span className="font-mono text-right tabular-nums text-emerald-300">
              {data.won.toFixed(2)}<span className="text-neutral-500"> / {data.max.toFixed(2)}</span>
            </span>

            <span className="text-red-300 font-semibold">Lost rallies</span>
            <div className="h-3 bg-neutral-800 rounded overflow-hidden print:bg-neutral-200">
              <div className="h-full bg-red-500 rounded" style={{ width: `${lostPct}%` }} />
            </div>
            <span className="font-mono text-right tabular-nums text-red-300">
              {data.lost.toFixed(2)}<span className="text-neutral-500"> / {data.max.toFixed(2)}</span>
            </span>
          </div>
          <div className={`text-[11px] leading-relaxed mt-3 ${verdict.tone}`}>
            <b>Verdict:</b> {verdict.text}
            <span className="text-neutral-500 block mt-1">
              Based on {data.wonRallies} winning ({data.wonPairs} shot pairs) and {data.lostRallies} losing rallies.
              Thresholds: &gt; 2.0 = movement-driven · &lt; 1.2 = power-driven.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Kill Chain list ----
function KillChainList({ data }) {
  if (data.top.length === 0) {
    return <Empty>No Winner rallies with a setup shot captured yet.</Empty>;
  }
  const max = data.top[0].count;
  return (
    <div className="flex flex-col gap-1.5">
      {data.top.map((row) => {
        const widthPct = (row.count / max) * 100;
        return (
          <div
            key={row.key}
            className="flex items-center gap-3 p-2 rounded-md bg-emerald-950/30 border border-emerald-900/50 print:bg-emerald-50 print:border-emerald-300"
          >
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-emerald-200 truncate print:text-black">
                <span className="text-neutral-400">Setup:</span> {row.setupLabel}
                <span className="text-neutral-500 mx-1.5">→</span>
                <span className="text-emerald-300 font-bold">Finish: {row.winnerLabel}</span>
              </div>
              <div className="h-1 bg-emerald-950/60 rounded mt-1 overflow-hidden print:bg-emerald-100">
                <div className="h-full bg-emerald-400 rounded" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
            <Badge tone="default">×{row.count}</Badge>
          </div>
        );
      })}
      <div className="text-[11px] text-neutral-500 mt-1">
        {data.totalWinners} winning rall{data.totalWinners !== 1 ? "ies" : "y"} had a qualifying setup shot.
      </div>
    </div>
  );
}

// ---- Serve ROI table ----
function ServeROITable({ data }) {
  const ROWS = [
    { code: "LS", name: "Low Serve" },
    { code: "FS", name: "Flick Serve" },
    { code: "DS", name: "Drive Serve" },
  ];
  const hasData = ROWS.some((r) => data[r.code]?.overall?.pts > 0);
  if (!hasData) return <Empty>No Son-served rallies captured yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black">
            <Th>Serve</Th>
            <Th>Early (&lt;12)</Th>
            <Th>Late (12–21)</Th>
            <Th>Decay</Th>
            <Th>Overall</Th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ code, name }) => {
            const row = data[code] || { early: { pts: 0, won: 0, pct: 0 }, late: { pts: 0, won: 0, pct: 0 }, overall: { pts: 0, won: 0, pct: 0 }, decay: null };
            const decay = row.decay;
            const decayTone = decay === null
              ? "text-neutral-500"
              : decay >= 20 ? "text-red-400 font-bold"
              : decay >= 10 ? "text-amber-400"
              : decay <= -10 ? "text-emerald-400"
              : "text-neutral-400";
            return (
              <tr key={code} className="bg-neutral-900 print:bg-white border-b border-neutral-800 print:border-neutral-400">
                <Td>
                  <span className="font-mono font-bold text-purple-300">{code}</span>
                  <span className="ml-2 text-neutral-500 hidden sm:inline">{name}</span>
                </Td>
                <Td>{row.early.pts ? <><b>{row.early.pct}%</b> <span className="text-neutral-500">({row.early.won}/{row.early.pts})</span></> : <span className="text-neutral-600">—</span>}</Td>
                <Td>{row.late.pts ? <><b>{row.late.pct}%</b> <span className="text-neutral-500">({row.late.won}/{row.late.pts})</span></> : <span className="text-neutral-600">—</span>}</Td>
                <Td className={decayTone}>
                  {decay === null ? "—" : (decay > 0 ? `↘ ${decay}pp` : decay < 0 ? `↗ ${-decay}pp` : "·")}
                </Td>
                <Td>{row.overall.pts ? <><b>{row.overall.pct}%</b> <span className="text-neutral-500">({row.overall.won}/{row.overall.pts})</span></> : <span className="text-neutral-600">—</span>}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
        Decay = early% − late%. Positive (↘) = opponent solved it as the set progressed.
        Negative (↗) = your serve gets sharper under pressure.
      </div>
    </div>
  );
}

// ---- Recovery Leak ----
function RecoveryLeakView({ data }) {
  if (data.total === 0) return <Empty>No opponent-winner rallies yet.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Stat l="Opp winners" v={data.total} />
        <Stat l="Long-diagonal" v={`${data.longDiagonalPct}%`} s={`${data.longDiagonal} of ${data.total}`} tone={data.longDiagonalPct >= 40 ? "bad" : "default"} />
        <Stat l="Avg gap" v={data.avgDist.toFixed(2)} s={`max ${data.maxDist.toFixed(2)}`} />
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        {data.top.map((p) => (
          <div
            key={p.key}
            className={`flex items-center gap-3 p-2 rounded-md border ${p.dist >= 2.5 ? "bg-red-950/30 border-red-900 print:bg-red-50 print:border-red-300" : "bg-neutral-900 border-neutral-800 print:bg-white print:border-neutral-400"}`}
          >
            <span className="font-mono text-sm font-bold text-neutral-100 print:text-black">
              Z{p.sonZone} <span className="text-neutral-500 mx-1">→</span> Z{p.oppZone}
            </span>
            <span className="flex-1 text-[11px] text-neutral-400">
              gap {p.dist.toFixed(2)}
              {p.dist >= 2.5 && <span className="ml-2 text-red-300 font-semibold">long diagonal</span>}
            </span>
            <Badge tone={p.dist >= 2.5 ? "danger" : "muted"}>×{p.count}</Badge>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-neutral-500 mt-1">
        Sequences with gap ≥ 2.5 suggest slow recovery from the corner — opponent exploits the diagonal before you re-centre.
      </div>
    </div>
  );
}

// ---- Momentum chunks ----
export function MomentumChunksView({ data }) {
  if (data.total === 0) return <Empty>No 3+ consecutive-loss streaks detected — good momentum control.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Stat l="Chunks (3+)" v={data.total} tone={data.total > 0 ? "bad" : "default"} />
        <Stat l="Physical" v={data.physical} s="prev rally > 15" tone="warn" />
        <Stat l="Mental" v={data.mental} s="prev rally ≤ 15" tone="warn" />
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        {data.chunks.map((c, i) => (
          <div
            key={i}
            className={`p-2.5 rounded-md border-l-4 ${c.classification === "physical" ? "bg-red-950/40 border-red-500 print:bg-red-50" : c.classification === "mental" ? "bg-amber-950/40 border-amber-500 print:bg-amber-50" : "bg-neutral-900 border-neutral-700 print:bg-white"}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-xs text-neutral-300 print:text-black">
                Set {c.set} · {c.length} consecutive losses
                <span className="text-neutral-500 ml-2">({c.scores.join(" → ")})</span>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.classification === "physical" ? "text-red-300" : c.classification === "mental" ? "text-amber-300" : "text-neutral-500"} print:text-black`}>
                {c.classification} collapse
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 print:text-black">
              avg rally: <b className="text-neutral-200 print:text-black">{c.avgLen}</b> shots ·{" "}
              UE rate: <b className="text-neutral-200 print:text-black">{c.ueRate}%</b> ·{" "}
              previous rally: <b className="text-neutral-200 print:text-black">{c.prevLen}</b> shots
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
        Physical collapses typically respond to conditioning work. Mental collapses respond to routine/focus drills and point-by-point reset habits.
      </div>
    </div>
  );
}

export function Grid({ c, children }) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-5" };
  return <div className={`grid ${cols[c] || cols[3]} gap-2`}>{children}</div>;
}

// `sections` controls which subsections render (A=Mix, B=Effectiveness,
// C=Phase, D=Zone). The Custom Report uses ["A","B"] to keep the header
// dense and skip the heavier subsections.
export function ShotMixEffectivenessSection({ data, sections = ["A", "B", "C", "D"] }) {
  if (!data || data.totalShots === 0) {
    return <Empty>No shot-level data captured yet.</Empty>;
  }
  const wants = (key) => sections.includes(key);
  const sonMixRows = data.sonShotMix.filter((r) => r.count >= 3).slice(0, 10);
  const hiddenSonRows = data.sonShotMix.filter((r) => r.count > 0 && r.count <= 2).length;
  const effRows = data.sonShotEffectiveness.filter((r) => r.count >= 3).slice(0, 10);
  const phaseRows = data.phaseShotMix.filter((r) => r.totalSonShots > 0);
  const zoneRows = data.zoneShotMix.filter((r) => r.totalSonShots >= 3).slice(0, 8);
  const noteForMix = (row) => {
    const lowYield = data.overusedLowYieldShots.find((s) => s.shotType === row.shotType);
    if (lowYield) return "Dominant but low-yield; review timing and target.";
    if (row.count < 5) return "Directional only / low sample.";
    if (data.dominantShots.some((s) => s.shotType === row.shotType)) return "Dominant Son choice.";
    return "";
  };
  const coachNote = (row) => {
    if (row.lowSample) return "Low sample; avoid strong claims.";
    if (row.finalShotUERatePct >= 20) return "Final-shot UE rate is high; check balance and risk.";
    if (row.ineffectivePct >= 25) return "Often tagged ineffective; review usage context.";
    if (row.pointWinRateAfterShotPct != null && row.pointWinRateAfterShotPct <= 40) return "Rallies containing this shot are not converting well.";
    if (row.winnerOrFEContributionPct >= 20) return "Contributing to finishes.";
    return "Stable in this sample.";
  };
  const evidence = (row) =>
    row?.evidence?.length ? row.evidence.map((e) => e.label).join("; ") : "—";
  const topNames = (rows) =>
    rows?.length ? rows.map((r) => `${r.label} ${r.share}%`).join(", ") : "—";

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400 leading-relaxed">
        Son-only mix is the coaching baseline. All-shot mix is match-environment context:
        {" "}{data.totalShots} total shots, {data.sonShots} Son shots, {data.opponentShots} opponent shots.
      </p>

      {wants("A") && (
      <div>
        <MiniLabel>A. Son Shot Mix</MiniLabel>
        {sonMixRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead><tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black"><Th>Shot</Th><Th>Count</Th><Th>Share</Th><Th>Rank</Th><Th>Note</Th></tr></thead>
              <tbody>
                {sonMixRows.map((row) => (
                  <tr key={row.shotType} className="bg-neutral-900 print:bg-white">
                    <Td>{row.label}</Td>
                    <Td>{row.count}</Td>
                    <Td>{row.pctOfSonShots}%</Td>
                    <Td>{row.rank}</Td>
                    <Td>{noteForMix(row)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No Son shot type reaches the directional threshold yet.</Empty>}
        {hiddenSonRows > 0 && (
          <div className="text-[11px] text-neutral-500 mt-1">
            {hiddenSonRows} shot type{hiddenSonRows !== 1 ? "s" : ""} with 1-2 uses hidden below threshold.
          </div>
        )}
      </div>
      )}

      {wants("B") && (
      <div>
        <MiniLabel>B. Son Shot Effectiveness</MiniLabel>
        {effRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead><tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black"><Th>Shot</Th><Th>Count</Th><Th>E%</Th><Th>N%</Th><Th>I%</Th><Th>Final UE%</Th><Th>Winner/FE%</Th><Th>Coaching note</Th></tr></thead>
              <tbody>
                {effRows.map((row) => (
                  <tr key={row.shotType} className="bg-neutral-900 print:bg-white">
                    <Td>{row.label}</Td>
                    <Td>{row.count}</Td>
                    <Td>{row.effectivePct}%</Td>
                    <Td>{row.neutralPct}%</Td>
                    <Td>{row.ineffectivePct}%</Td>
                    <Td>{row.finalShotUERatePct}%</Td>
                    <Td>{row.winnerOrFEContributionPct}%</Td>
                    <Td>{coachNote(row)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Need at least 3 uses of a Son shot type for directional effectiveness rows.</Empty>}
      </div>
      )}

      {wants("C") && (
      <div>
        <MiniLabel>C. Shot Mix by Phase</MiniLabel>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black"><Th>Phase</Th><Th>Top shot types</Th><Th>Drop %</Th><Th>Clear %</Th><Th>Lift %</Th><Th>Smash %</Th><Th>Slice %</Th><Th>Note</Th></tr></thead>
            <tbody>
              {phaseRows.map((row) => (
                <tr key={row.phase} className="bg-neutral-900 print:bg-white">
                  <Td>{row.label}</Td>
                  <Td>{topNames(row.topShotTypes)}</Td>
                  <Td>{row.dropShare}%</Td>
                  <Td>{row.clearShare}%</Td>
                  <Td>{row.liftShare}%</Td>
                  <Td>{row.smashShare}%</Td>
                  <Td>{row.sliceShare}%</Td>
                  <Td>{row.note || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {wants("D") && (
      <div>
        <MiniLabel>D. Zone-Specific Shot Mix</MiniLabel>
        {zoneRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead><tr className="bg-neutral-800 text-neutral-300 print:bg-neutral-200 print:text-black"><Th>Origin zone</Th><Th>Top shot type</Th><Th>Top response</Th><Th>UE rate</Th><Th>Evidence</Th></tr></thead>
              <tbody>
                {zoneRows.map((row) => (
                  <tr key={row.originZone} className="bg-neutral-900 print:bg-white align-top">
                    <Td>{row.label}{row.lowSample ? " (directional)" : ""}</Td>
                    <Td>{row.topShotType ? `${row.topShotType.label} (${row.topShotType.share}%)` : "—"}</Td>
                    <Td>{row.topResponse?.label || "—"}</Td>
                    <Td>{row.ueRatePct}%</Td>
                    <Td>{evidence(row)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No inferred origin zone reaches the directional threshold yet.</Empty>}
      </div>
      )}

      <Insight>
        <b>Coach insight:</b> {data.insight} {data.coachingNotes?.[1]}
      </Insight>
    </div>
  );
}

export function Stat({ l, v, s, tone = "default" }) {
  const tones = {
    default: "text-white",
    good: "text-emerald-400",
    bad: "text-red-400",
    warn: "text-amber-400",
  };
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-2 text-center print:border-neutral-400 print:bg-white">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">{l}</div>
      <div className={`text-xl font-extrabold font-display tabular-nums ${tones[tone]} print:text-black`}>{v}</div>
      {s && <div className="text-[10px] text-neutral-500">{s}</div>}
    </div>
  );
}

export function MiniLabel({ children }) {
  return <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">{children}</div>;
}

// Compact confidence indicator — one chip rendered next to the report
// header and (smaller) inline at the top of every confidence-sensitive
// section. Single source of truth for tone.
export function ConfidenceChip({ confidence, compact = false }) {
  if (!confidence) return null;
  const tones = {
    warn: "bg-amber-950/60 text-amber-300 border-amber-800/70 print:bg-amber-50 print:text-black print:border-amber-300",
    info: "bg-sky-950/60 text-sky-300 border-sky-800/70 print:bg-sky-50 print:text-black print:border-sky-300",
    good: "bg-emerald-950/60 text-emerald-300 border-emerald-800/70 print:bg-emerald-50 print:text-black print:border-emerald-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${
        tones[confidence.tone] || tones.info
      } ${compact ? "" : ""}`}
    >
      <span className="text-[8px] opacity-70">●</span>
      <span>Confidence: {confidence.label}</span>
      <span className="opacity-60 normal-case tracking-normal">
        ({confidence.matches}m / {confidence.rallies}r)
      </span>
    </span>
  );
}

export function Insight({ children }) {
  return (
    <div className="bg-emerald-950/40 border border-emerald-800/70 rounded-md p-3 mt-3 text-xs text-emerald-200 leading-relaxed print:bg-emerald-50 print:text-black print:border-emerald-300">
      <b className="text-emerald-300 print:text-black">Key insight:</b> {children}
    </div>
  );
}

// Data-driven insight for the rally-length section. Falls back to a neutral
// message when no bucket has enough sample size — never claims "short
// rallies are best" unless the data actually says so.
export function RallyLengthInsight({ best }) {
  if (!best || !best.bucket) {
    return (
      <Insight>
        Not enough rallies in any single length bucket yet to call out a strongest range.
        Capture a few more matches to surface this insight.
      </Insight>
    );
  }
  const tone = best.strong ? "Insight" : "Directional";
  return (
    <Insight>
      <b>{tone}:</b> Best win rate is in the <b>{best.bucket}-shot</b> bucket
      ({best.winPct}% — {best.won}W/{best.lost}L from {best.total} rallies).
      {!best.strong && (
        <span className="text-neutral-400"> Sample size is small; treat as directional.</span>
      )}
    </Insight>
  );
}

export function Flag({ children }) {
  return (
    <div className="bg-amber-950/40 border border-amber-800/70 rounded-md p-3 mt-3 text-xs text-amber-200 leading-relaxed print:bg-amber-50 print:text-black print:border-amber-300">
      <b className="text-amber-300 print:text-black">Flag:</b> {children}
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-500 text-center print:border-neutral-400">
      {children}
    </div>
  );
}

function RecBox({ tone, title, body }) {
  const tones = {
    danger: "bg-red-950/50 border-red-700 border-l-4 border-l-red-500 text-red-200 print:bg-red-50 print:text-black",
    warn:   "bg-amber-950/50 border-amber-700 border-l-4 border-l-amber-500 text-amber-200 print:bg-amber-50 print:text-black",
    info:   "bg-sky-950/50 border-sky-700 border-l-4 border-l-sky-500 text-sky-200 print:bg-sky-50 print:text-black",
    good:   "bg-emerald-950/50 border-emerald-700 border-l-4 border-l-emerald-500 text-emerald-200 print:bg-emerald-50 print:text-black",
    violet: "bg-violet-950/50 border-violet-700 border-l-4 border-l-violet-500 text-violet-200 print:bg-violet-50 print:text-black",
  };
  const titleTone = {
    danger: "text-red-300",
    warn: "text-amber-300",
    info: "text-sky-300",
    good: "text-emerald-300",
    violet: "text-violet-300",
  };
  return (
    <div className={`rounded-lg p-3 border ${tones[tone] || tones.info}`}>
      <div className={`font-bold text-sm mb-1 ${titleTone[tone] || "text-white"} print:text-black`}>{title}</div>
      <div className="text-xs leading-relaxed">{body}</div>
    </div>
  );
}

function TocSection({ label, items, onNav }) {
  return (
    <div>
      <div className="font-bold text-sm text-emerald-400 mb-1.5 print:text-black">{label}</div>
      <div className="flex flex-col">
        {items.map(([id, text]) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className="text-left text-xs text-sky-400 hover:text-sky-300 underline decoration-dotted py-0.5 print:text-black print:no-underline"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BenchCard({ l, target, player, src }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center print:border-neutral-400 print:bg-white">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{l}</div>
      <div className="text-xs text-neutral-200 font-bold mt-1 print:text-black">Target: {target}</div>
      <div className="text-sm text-emerald-400 font-bold mt-1 print:text-black">Player: {player}</div>
      <div className="text-[9px] text-neutral-600 mt-0.5">{src}</div>
    </div>
  );
}

export function Ring({ pct: p }) {
  const stroke = p >= 55 ? "#10b981" : p >= 45 ? "#f59e0b" : "#ef4444";
  const textColor = p >= 55 ? "text-emerald-400" : p >= 45 ? "text-amber-400" : "text-red-400";
  return (
    <div className="relative w-14 h-14 mx-auto">
      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#27272a" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9" fill="none" stroke={stroke} strokeWidth="3"
          strokeDasharray={`${p} ${100 - p}`} strokeLinecap="round"
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-xs font-extrabold ${textColor}`}>
        {p}%
      </div>
    </div>
  );
}

function HGrid({ data, tone, small }) {
  const max = Math.max(1, ...Object.values(data));
  const paints = {
    sky:     (a) => `rgba(56,189,248,${0.1 + 0.7 * a})`,
    emerald: (a) => `rgba(16,185,129,${0.1 + 0.7 * a})`,
    red:     (a) => `rgba(239,68,68,${0.1 + 0.7 * a})`,
    amber:   (a) => `rgba(245,158,11,${0.1 + 0.7 * a})`,
  };
  const paint = paints[tone] || paints.sky;
  return (
    <div>
      <div className={`grid grid-cols-3 ${small ? "gap-0.5" : "gap-1"}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((z) => {
          const v = data[z] || 0;
          const a = max > 0 ? v / max : 0;
          const bg = v === 0 ? "transparent" : paint(a);
          const filled = v > 0;
          return (
            <div
              key={z}
              className={`rounded text-center border ${filled ? "border-transparent" : "border-neutral-800 print:border-neutral-400"} ${small ? "py-1 px-0.5" : "py-1.5 px-1"}`}
              style={{ background: filled ? bg : "transparent" }}
            >
              <div className={`${small ? "text-[11px]" : "text-xs"} font-bold ${a > 0.4 ? "text-white" : "text-neutral-500"} print:text-black`}>
                {v || "·"}
              </div>
              {!small && (
                <div className={`text-[8px] ${a > 0.4 ? "text-white/70" : "text-neutral-600"} print:text-neutral-700`}>
                  {ZONE_LABELS[z]}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center text-[8px] text-neutral-600 mt-0.5">↑ NET ↑</div>
    </div>
  );
}

export function EffSlice({ pct, label, className }) {
  if (pct === 0) return null;
  return (
    <div
      className={`flex items-center justify-center text-[11px] font-bold tabular-nums ${className}`}
      style={{ width: `${pct}%` }}
    >
      {pct >= 8 ? label : ""}
    </div>
  );
}

function AppTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-emerald-800 text-white print:bg-emerald-100 print:text-black">
            <Th>Metric</Th><Th>Formula / Definition</Th><Th>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, f, n], i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-neutral-900 print:bg-white" : "bg-neutral-900/50 print:bg-neutral-50"}>
              <Td className="font-semibold text-white print:text-black">{m}</Td>
              <Td className="font-mono text-[10px] text-neutral-400 print:text-black">{f}</Td>
              <Td className="text-neutral-400 print:text-black">{n}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Th({ children }) { return <th className="px-2 py-1.5 text-left font-semibold border-b border-neutral-700 print:border-neutral-400">{children}</th>; }
export function Td({ children, className = "", ...props }) {
  return <td {...props} className={`px-2 py-1 border-b border-neutral-800 print:border-neutral-300 ${className}`}>{children}</td>;
}

export function ZoneDiagram({ playerName = "Player" }) {
  return (
    <div>
      <div className="bg-red-950/50 border border-red-900 rounded-t-lg p-2 print:bg-red-50 print:border-red-300">
        <div className="text-center text-[10px] text-red-300 font-semibold mb-2 print:text-black">OPPONENT'S COURT</div>
        <div className="grid grid-cols-3 gap-1">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((z) => <ZoneCell key={z} n={z} />)}
        </div>
      </div>
      <div className="h-1 bg-neutral-700 print:bg-black" />
      <div className="text-center text-[10px] font-bold py-0.5 text-neutral-400 print:text-black">— NET —</div>
      <div className="h-1 bg-neutral-700 print:bg-black" />
      <div className="bg-sky-950/50 border border-sky-900 rounded-b-lg p-2 print:bg-sky-50 print:border-sky-300">
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((z) => <ZoneCell key={z} n={z} />)}
        </div>
        <div className="text-center text-[10px] text-sky-300 font-semibold mt-2 print:text-black">{playerName.toUpperCase()}'S COURT</div>
      </div>
    </div>
  );
}

function ZoneCell({ n }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-1.5 text-center print:bg-white print:border-neutral-400">
      <div className="text-sm font-bold text-white print:text-black">{n}</div>
      <div className="text-[8px] text-neutral-500 print:text-neutral-700">{ZONE_LABELS[n]}</div>
    </div>
  );
}

export function PrintBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-95 print:hidden"
    >
      🖨 Print / Save PDF
    </button>
  );
}

export function ScopePill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition active:scale-95 ${
        active
          ? "bg-emerald-700 border-emerald-500 text-white"
          : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

// Drop the paused-only fields (_pausedRally, pausedAt) so paused matches
// look like a regular match shape to the analytics layer.
function stripPausedFields(pausedMatch) {
  if (!pausedMatch) return null;
  const { _pausedRally: _r, pausedAt: _p, ...m } = pausedMatch;
  return m;
}
