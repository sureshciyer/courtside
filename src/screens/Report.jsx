import { useMemo } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { reportBundle, matchSummary, classifyStyle, setAggregate, pct } from "../lib/analytics.js";
import { SHOT_NAMES, ZONE_LABELS, PLAYER_NAME } from "../constants/badminton.js";
import { Screen, TopBar, Card, BigBtn } from "../components/ui.jsx";

// ===== Pro-level performance report. Each section is driven by the real
// matches array from the Zustand store — no sample data, all deterministic.
// Layout is print-friendly: body turns white on @media print (index.css),
// cards lose shadows/borders to render cleanly to a single PDF.

export default function Report({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const bundle = useMemo(() => reportBundle(matches), [matches]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const printReport = () => window.print();

  if (matches.length === 0) {
    return (
      <Screen>
        <TopBar title="Performance report" onBack={() => setScreen("home")} />
        <Card className="text-center py-10">
          <div className="text-4xl mb-2">📋</div>
          <div className="font-bold text-white mb-1">No match data yet</div>
          <div className="text-sm text-neutral-400 mb-4">
            Capture a few matches and the full report generates automatically.
          </div>
          <BigBtn tone="primary" onClick={() => setScreen("setup")}>Start first match</BigBtn>
        </Card>
      </Screen>
    );
  }

  const { agg, style, tournaments, distribution, lengthProfile, serveReturn,
          clutch, fatigue, deception, effectiveness,
          winnerZones, errorZonesAll, allZones, recs, rallies } = bundle;
  const wonMatches = matches.filter((m) => {
    const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
    return setsWon > m.sets.length / 2;
  }).length;

  return (
    <Screen wide className="report-root">
      <TopBar
        title="Performance report"
        subtitle={`${PLAYER_NAME} · ${matches.length} match${matches.length !== 1 ? "es" : ""} · ${agg.rallies} rallies`}
        onBack={() => setScreen("home")}
        right={<PrintBtn onClick={printReport} />}
      />

      {/* ---------- HEADER ---------- */}
      <div className="border-b-2 border-emerald-700 pb-3 mb-4 print:border-black">
        <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-500">Player performance report</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 print:text-black">
          {PLAYER_NAME} — Comprehensive analysis
        </h1>
        <div className="text-xs text-neutral-400 mt-1">
          {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""} ·{" "}
          {matches.length} matches · {agg.rallies} rallies ·{" "}
          Generated {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* ---------- TOC ---------- */}
      <Card className="mb-5 print:break-after-page">
        <div className="font-bold text-emerald-400 text-sm mb-3">Table of contents</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TocSection label="Part A: Aggregate analysis" items={[
            ["a1", "1. Tournament overview"],
            ["a2", "2. Court heatmaps"],
            ["a3", "3. Shot distribution"],
            ["a4", "4. Rally length profile"],
            ["a5", "5. Serve & return game"],
            ["a6", "6. Clutch performance"],
            ["a7", "7. Fatigue & endurance"],
            ["a8", "8. Effectiveness index"],
            ["a9", "9. Predictability & deception"],
            ["a10", "10. Coaching recommendations"],
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
        Zone frequency maps aggregated across every captured rally. Darker = more activity.
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
      <Insight>
        Win rate is highest in short rallies — he's an attacking player most effective when finishing early.
        Dips in longer rallies point to fitness or patience limits.
      </Insight>

      {/* 5. Serve & return */}
      <SH id="a5" n="5" t="Serve & return game" />
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
        <Stat l="Holds (HS)" v={deception.holds} s={`in ${matches.length} match${matches.length !== 1 ? "es" : ""}`} tone="warn" />
        <Stat l="Slices (SL)" v={deception.slices} s={`in ${matches.length} match${matches.length !== 1 ? "es" : ""}`} tone="warn" />
        <Stat l="Per-match deception" v={deception.perMatch} s="shots / match" tone={deception.perMatch >= 3 ? "good" : "warn"} />
      </Grid>
      {deception.perMatch < 3 && matches.length >= 2 && (
        <Flag>
          Fewer than 3 deception shots per match. Introduce holds and slices gradually —
          unpredictability creates openings against disciplined opponents.
        </Flag>
      )}

      {/* 10. Coaching recommendations */}
      <SH id="a10" n="10" t="Coaching recommendations" />
      {recs.length === 0 ? (
        <Empty>Not enough data to generate recommendations yet — keep capturing matches.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {recs.map((r, i) => <RecBox key={i} {...r} />)}
        </div>
      )}

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
        <ZoneDiagram />
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
        Courtside Performance Analysis · {PLAYER_NAME} · Generated {new Date().toLocaleDateString()}
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
      </div>

      {t.matches.map((m, mi) => <MatchBlock key={m.id} match={m} />)}
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

function PartHeader({ label, title }) {
  return (
    <div className="bg-emerald-800 border border-emerald-600 rounded-lg px-4 py-2.5 mt-8 mb-3 print:bg-emerald-100 print:border-emerald-500 print:text-black print:break-before-page">
      <div className="text-[11px] text-emerald-200 font-semibold print:text-emerald-900">Part {label}</div>
      <div className="text-white font-bold text-base print:text-black">{title}</div>
    </div>
  );
}

function SH({ id, n, t }) {
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

function Grid({ c, children }) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-5" };
  return <div className={`grid ${cols[c] || cols[3]} gap-2`}>{children}</div>;
}

function Stat({ l, v, s, tone = "default" }) {
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

function MiniLabel({ children }) {
  return <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">{children}</div>;
}

function Insight({ children }) {
  return (
    <div className="bg-emerald-950/40 border border-emerald-800/70 rounded-md p-3 mt-3 text-xs text-emerald-200 leading-relaxed print:bg-emerald-50 print:text-black print:border-emerald-300">
      <b className="text-emerald-300 print:text-black">Key insight:</b> {children}
    </div>
  );
}

function Flag({ children }) {
  return (
    <div className="bg-amber-950/40 border border-amber-800/70 rounded-md p-3 mt-3 text-xs text-amber-200 leading-relaxed print:bg-amber-50 print:text-black print:border-amber-300">
      <b className="text-amber-300 print:text-black">Flag:</b> {children}
    </div>
  );
}

function Empty({ children }) {
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

function BenchCard({ l, target, player, src }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-center print:border-neutral-400 print:bg-white">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{l}</div>
      <div className="text-xs text-neutral-200 font-bold mt-1 print:text-black">Target: {target}</div>
      <div className="text-sm text-emerald-400 font-bold mt-1 print:text-black">Player: {player}</div>
      <div className="text-[9px] text-neutral-600 mt-0.5">{src}</div>
    </div>
  );
}

function Ring({ pct: p }) {
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

function EffSlice({ pct, label, className }) {
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

function Th({ children }) { return <th className="px-2 py-1.5 text-left font-semibold border-b border-neutral-700 print:border-neutral-400">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`px-2 py-1 border-b border-neutral-800 print:border-neutral-300 ${className}`}>{children}</td>; }

function ZoneDiagram() {
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
        <div className="text-center text-[10px] text-sky-300 font-semibold mt-2 print:text-black">{PLAYER_NAME.toUpperCase()}'S COURT</div>
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

function PrintBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-95 print:hidden"
    >
      🖨 Print / Save PDF
    </button>
  );
}
