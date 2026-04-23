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

const HEATMAP_TABS = [
  { key: "winners",   label: "Winners",   tone: "emerald" },
  { key: "effective", label: "Effective", tone: "sky" },
  { key: "errors",    label: "Errors",    tone: "red" },
];

export default function Patterns({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const [styleFilter, setStyleFilter] = useState("All");
  const [seqN, setSeqN] = useState(3);
  const [heatKind, setHeatKind] = useState("winners");

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

      <Card className="mb-3">
        <Select
          label="Opponent style filter"
          value={styleFilter}
          onChange={setStyleFilter}
          options={["All", ...PLAYER_STYLES]}
        />
        <div className="text-[11px] text-neutral-500 leading-relaxed">
          Filters every section below so you can compare tactical patterns against specific opponent profiles.
        </div>
      </Card>

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
