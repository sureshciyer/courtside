import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { PLAYER_STYLES } from "../lib/rally.js";
import {
  winningSequences,
  disruptionConversion,
  criticalReturn,
  effectivenessZones,
  coachingTips,
} from "../lib/analytics.js";
import {
  Screen, TopBar, Card, SectionLabel, Select, HeatGrid, MeterRow, Badge,
} from "../components/ui.jsx";
import { patternsMarkdown, copyMarkdown, downloadMarkdown, slugify } from "../lib/markdown.js";
import { GOAL_METRICS, findMetric, goalLabel, goalValue, buildGoal } from "../lib/goals.js";

const HEATMAP_TABS = [
  { key: "winners",   label: "Winners",   tone: "emerald" },
  { key: "effective", label: "Effective", tone: "sky" },
  { key: "errors",    label: "Errors",    tone: "red" },
];

export default function Patterns({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";
  const [styleFilter, setStyleFilter] = useState("All");
  const [seqN, setSeqN] = useState(3);
  const [heatKind, setHeatKind] = useState("winners");
  const [mdFlash, setMdFlash] = useState(null);
  const flash = (s) => { setMdFlash(s); setTimeout(() => setMdFlash(null), 1800); };

  const handleCopyMd = async () => {
    const md = patternsMarkdown(matches, { playerName, styleFilter });
    const ok = await copyMarkdown(md);
    flash(ok ? "Patterns copied" : "Copy failed");
  };
  const handleDownloadMd = () => {
    const md = patternsMarkdown(matches, { playerName, styleFilter });
    const stamp = new Date().toISOString().split("T")[0];
    const styleSlug = styleFilter === "All" ? "all" : slugify(styleFilter);
    downloadMarkdown(md, `courtside_patterns_${styleSlug}_${stamp}.md`);
    flash("Patterns downloaded");
  };

  const { rallies, matchCount } = useMemo(() => {
    const filtered = styleFilter === "All"
      ? matches
      : matches.filter((m) => (m.playerStyle || "Unknown") === styleFilter);
    return { rallies: filtered.flatMap((m) => m.rallies), matchCount: filtered.length };
  }, [matches, styleFilter]);

  const tips = useMemo(() => coachingTips(rallies), [rallies]);
  const conv = useMemo(() => disruptionConversion(rallies), [rallies]);
  const seqs = useMemo(() => winningSequences(rallies, seqN).slice(0, 6), [rallies, seqN]);
  const ret  = useMemo(() => criticalReturn(rallies), [rallies]);
  const heat = useMemo(() => effectivenessZones(rallies, heatKind), [rallies, heatKind]);
  const heatTone = HEATMAP_TABS.find((t) => t.key === heatKind)?.tone || "red";

  return (
    <Screen wide>
      <TopBar
        title="Patterns"
        subtitle={`${matchCount} match${matchCount !== 1 ? "es" : ""} · ${rallies.length} rallies`}
        onBack={() => setScreen("home")}
      />

      {mdFlash && (
        <div className="cs-toast fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {mdFlash}
        </div>
      )}

      <Card className="mb-3">
        <Select
          label="Opponent style filter"
          value={styleFilter}
          onChange={setStyleFilter}
          options={["All", ...PLAYER_STYLES]}
        />
        <div className="text-[11px] text-neutral-500 leading-relaxed mb-3">
          Filters every section below so you can compare tactical patterns against specific opponent profiles.
        </div>
        <div className="flex gap-2 pt-2 border-t border-neutral-800">
          <button
            onClick={handleCopyMd}
            className="flex-1 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold active:scale-95"
          >
            📋 Copy patterns Markdown
          </button>
          <button
            onClick={handleDownloadMd}
            className="flex-1 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-bold active:scale-95"
          >
            ⬇ Download .md
          </button>
        </div>
      </Card>

      {/* Goal tracker */}
      <GoalsCard rallies={rallies} />

      {/* Coaching tips */}
      <Card tone="accent" className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Coaching summary</SectionLabel>
          <span className="text-[10px] text-emerald-400 font-mono">AI · auto</span>
        </div>
        {tips.length === 0 ? (
          <div className="text-sm text-neutral-400 py-1">
            Not enough rallies yet — capture a few more and tips will appear here.
          </div>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-3 items-start">
                <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mt-0.5">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm leading-tight">{t.headline}</div>
                  <div className="text-xs text-neutral-400 leading-relaxed mt-0.5">{t.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Disruption conversion */}
      <Card className="mb-3">
        <SectionLabel>Disruption conversion</SectionLabel>
        <div className="flex flex-col gap-3">
          <MeterRow
            label="Rallies WITH disruption"
            value={conv.withDisruption.won}
            total={conv.withDisruption.count}
            tone="emerald"
          />
          <MeterRow
            label="Rallies WITHOUT disruption"
            value={conv.withoutDisruption.won}
            total={conv.withoutDisruption.count}
            tone="sky"
          />
        </div>
        {conv.withDisruption.count > 0 && (
          <div className="text-[11px] text-neutral-500 mt-3 leading-relaxed border-t border-neutral-800 pt-2">
            {conv.withDisruption.rate > conv.withoutDisruption.rate ? (
              <>When a smash, kill or quality net shot lands in the rally you convert <span className="text-emerald-300 font-semibold">+{Math.round((conv.withDisruption.rate - conv.withoutDisruption.rate) * 100)}pp</span> higher than neutral exchanges.</>
            ) : (
              <>Disruption shots aren't outperforming neutral rallies yet — tighten the follow-up after attacks.</>
            )}
          </div>
        )}
      </Card>

      {/* Effectiveness heatmap */}
      <Card className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Shot effectiveness heatmap</SectionLabel>
          <div className="flex gap-1 p-1 rounded-lg bg-neutral-950 border border-neutral-800">
            {HEATMAP_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setHeatKind(t.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${heatKind === t.key ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <HeatGrid values={heat} tone={heatTone} />
        <div className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
          {heatKind === "winners" && "Landing zones of Son's winning shots (rally result = Winner)."}
          {heatKind === "effective" && "Every shot tagged Effective during rally capture."}
          {heatKind === "errors" && "Unforced-error landing zones + every shot tagged Ineffective."}
        </div>
      </Card>

      {/* Critical return */}
      <Card className="mb-3">
        <SectionLabel>Critical return (opponent's return of your serve)</SectionLabel>
        {ret.total === 0 ? (
          <div className="text-sm text-neutral-500">No Son-served rallies with a recorded return yet.</div>
        ) : (
          <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
            <HeatGrid values={ret.zoneFreq} tone="amber" />
            <div className="min-w-0">
              <div className="text-xs text-neutral-400 mb-2">
                <span className="text-white font-bold tabular-nums">{ret.total}</span> returns across Son-served rallies.
              </div>
              <div className="flex flex-col gap-1.5">
                {ret.zoneFreq.map((f, i) => {
                  if (i === 0 || f === 0) return null;
                  const loss = ret.zoneLoss[i];
                  const rate = Math.round(ret.losingRates[i] * 100);
                  const dangerous = loss >= 2 && ret.losingRates[i] >= 0.5;
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-neutral-300">Zone {i}</span>
                      <span className="text-neutral-500">
                        {f} return{f !== 1 ? "s" : ""} ·{" "}
                        <span className={dangerous ? "text-red-400 font-bold" : "text-neutral-400"}>
                          {rate}% lost
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Winning sequences */}
      <Card className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Winning sequences</SectionLabel>
          <div className="flex gap-1 p-1 rounded-lg bg-neutral-950 border border-neutral-800">
            {[2, 3, 4].map((v) => (
              <button
                key={v}
                onClick={() => setSeqN(v)}
                className={`w-8 py-1 rounded-md text-[11px] font-bold transition ${seqN === v ? "bg-emerald-700 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
              >{v}</button>
            ))}
          </div>
        </div>
        {seqs.length === 0 ? (
          <div className="text-sm text-neutral-500">Not enough winning rallies yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {seqs.map((s, i) => (
              <div
                key={s.seq}
                className="flex items-center gap-3 p-2 rounded-md bg-emerald-950/30 border border-emerald-900/50"
              >
                <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="flex-1 font-mono text-xs text-emerald-200 tracking-tight truncate">
                  {s.seq}
                </span>
                <Badge tone="default">×{s.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="h-4" />
    </Screen>
  );
}

// ===================================================================
//                          Goal tracker UI
// ===================================================================

function GoalsCard({ rallies }) {
  const goals = useMatchStore((s) => s.goals) || [];
  const removeGoal = useMatchStore((s) => s.removeGoal);
  const [adding, setAdding] = useState(false);

  return (
    <Card className="mb-3" tone="warn">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>🎯 Goals for next match</SectionLabel>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-2.5 py-1 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-[11px] font-bold active:scale-95"
          >
            + Add goal
          </button>
        )}
      </div>

      {goals.length === 0 && !adding && (
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          Set targets for the next match (e.g. "reduce Zone 9 loss rate to &lt; 50 %"). After
          the match, the Summary screen will mark each goal green or red.
        </p>
      )}

      {goals.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {goals.map((g) => {
            const baseline = goalValue(g, rallies);
            return (
              <div key={g.id} className="flex items-center gap-2 p-2 rounded-md bg-neutral-900 border border-neutral-800">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-neutral-100 truncate">{goalLabel(g)}</div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    Baseline so far: {baseline === null ? <span className="text-neutral-600">no data</span> : <span className="text-neutral-300">{baseline}{findMetric(g.metricKey)?.unit || ""}</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeGoal(g.id)}
                  className="px-2 py-1 rounded text-[10px] font-bold text-red-300 bg-red-950/40 border border-red-900 hover:bg-red-900/40"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding && <GoalForm onClose={() => setAdding(false)} />}
    </Card>
  );
}

function GoalForm({ onClose }) {
  const addGoal = useMatchStore((s) => s.addGoal);
  const [metricKey, setMetricKey] = useState("disruptionConversionPct");
  const [comparator, setComparator] = useState("gt");
  const [threshold, setThreshold] = useState(65);
  const [zone, setZone] = useState(9);
  const [serveType, setServeType] = useState("DS");

  const metric = findMetric(metricKey);
  const needsZone = !!metric?.needsZone;
  const needsServe = !!metric?.needsServe;

  // Default comparator nudges based on metric direction (lower vs higher).
  const handleMetricChange = (key) => {
    setMetricKey(key);
    const m = findMetric(key);
    if (m?.direction === "higher") setComparator("gt");
    else if (m?.direction === "lower") setComparator("lt");
  };

  const handleSubmit = () => {
    const n = Number(threshold);
    if (Number.isNaN(n)) return;
    const params = {};
    if (needsZone) params.zone = Number(zone);
    if (needsServe) params.serveType = serveType;
    addGoal(buildGoal({ metricKey, comparator, threshold: n, params }));
    onClose();
  };

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 mt-1 space-y-2">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Metric</label>
        <select
          value={metricKey}
          onChange={(e) => handleMetricChange(e.target.value)}
          className="w-full px-2.5 py-2 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:border-emerald-600"
        >
          {GOAL_METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        {metric?.description && (
          <div className="text-[11px] text-neutral-500 mt-1 leading-snug">{metric.description}</div>
        )}
      </div>

      {needsZone && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Zone</label>
          <div className="grid grid-cols-9 gap-1">
            {[1,2,3,4,5,6,7,8,9].map((z) => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={`py-1.5 rounded text-xs font-bold border ${zone === z ? "bg-emerald-700 border-emerald-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsServe && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Serve type</label>
          <div className="grid grid-cols-3 gap-1">
            {["LS","FS","DS"].map((t) => (
              <button
                key={t}
                onClick={() => setServeType(t)}
                className={`py-1.5 rounded text-xs font-bold border ${serveType === t ? "bg-purple-700 border-purple-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">Direction</label>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setComparator("lt")}
              className={`py-1.5 rounded text-xs font-bold border ${comparator === "lt" ? "bg-emerald-700 border-emerald-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400"}`}
            >
              &lt; less than
            </button>
            <button
              onClick={() => setComparator("gt")}
              className={`py-1.5 rounded text-xs font-bold border ${comparator === "gt" ? "bg-emerald-700 border-emerald-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400"}`}
            >
              &gt; greater than
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1">
            Target value{metric?.unit ? ` (${metric.unit || ""})` : ""}
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full px-2.5 py-2 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          className="flex-1 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm active:scale-95"
        >
          ✓ Save goal
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
