import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, MeterRow, Badge } from "../components/ui.jsx";
import { REFLECTION_RATINGS, hasReflection, MATCH_TYPES } from "../constants/reflection.js";

// Tiny dependency-free sparkline for 1–5 rating series.
function Sparkline({ points, width = 132, height = 34 }) {
  if (points.length === 0) return null;
  const pad = 3;
  const xs = points.length === 1
    ? [width / 2]
    : points.map((_, i) => pad + (i * (width - pad * 2)) / (points.length - 1));
  const y = (v) => height - pad - ((v - 1) / 4) * (height - pad * 2);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y(points[i]).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} className="shrink-0">
      {points.length > 1 && (
        <path d={path} fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={y(points[i])} r={i === points.length - 1 ? 3.2 : 2}
          fill={i === points.length - 1 ? "#34d399" : "rgba(52,211,153,0.55)"} />
      ))}
      <text x={xs[xs.length - 1]} y={Math.max(9, y(last) - 6)} textAnchor="end" fontSize="9" fill="#a3a3a3" fontWeight="700">
        {last}
      </text>
    </svg>
  );
}

const trendDelta = (series) => {
  if (series.length < 2) return null;
  // Compare mean of last up-to-3 vs mean of the previous up-to-3.
  const recent = series.slice(-3);
  const prior = series.slice(Math.max(0, series.length - 6), series.length - 3);
  if (prior.length === 0) return null;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return mean(recent) - mean(prior);
};

const tally = (list) => {
  const t = {};
  for (const x of list) t[x] = (t[x] || 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
};

export default function ReflectionTrends({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const [typeFilter, setTypeFilter] = useState("All");

  const reflected = useMemo(() => {
    let list = matches.filter(hasReflection);
    if (typeFilter !== "All") list = list.filter((m) => (m.matchType || "Club casual") === typeFilter);
    return list; // matches[] is already chronological (append on endMatch)
  }, [matches, typeFilter]);

  const missing = matches.filter((m) => !hasReflection(m)).length;

  const series = useMemo(() => {
    const out = {};
    for (const r of REFLECTION_RATINGS) {
      out[r.key] = reflected
        .map((m) => m.reflection?.ratings?.[r.key])
        .filter((v) => v != null);
    }
    return out;
  }, [reflected]);

  const styleCounts = useMemo(() => tally(reflected.flatMap((m) => m.reflection?.styleTags || [])), [reflected]);
  const strengthCounts = useMemo(() => tally(reflected.flatMap((m) => m.reflection?.strengths || [])), [reflected]);
  const weaknessCounts = useMemo(() => tally(reflected.flatMap((m) => m.reflection?.weaknesses || [])), [reflected]);
  const focusList = reflected
    .filter((m) => m.reflection?.focusNext?.trim())
    .slice(-5)
    .reverse();

  return (
    <Screen>
      <TopBar
        title="Reflection trends"
        subtitle={`${reflected.length} reflected match${reflected.length !== 1 ? "es" : ""}`}
        onBack={() => setScreen("home")}
      />

      {/* Match-type filter — the tournament-vs-club comparison this whole
          feature exists for. */}
      <div className="flex gap-1.5 mb-3">
        {["All", ...MATCH_TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
              typeFilter === t
                ? "bg-emerald-700/40 text-emerald-200 border-emerald-600"
                : "bg-neutral-900 text-neutral-500 border-neutral-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {reflected.length === 0 ? (
        <Card className="text-center py-8">
          <div className="text-3xl mb-2">📝</div>
          <div className="text-sm text-neutral-400">
            No reflections {typeFilter !== "All" ? `for ${typeFilter} matches ` : ""}yet.
          </div>
          <div className="text-[11px] text-neutral-600 mt-1">
            After a match, open its summary and tap "Add reflection".
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-3">
            <SectionLabel>Self-ratings over time</SectionLabel>
            {REFLECTION_RATINGS.map((r) => {
              const s = series[r.key];
              const d = trendDelta(s);
              return (
                <div key={r.key} className="flex items-center justify-between gap-3 py-2 border-b border-neutral-800 last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-neutral-100 truncate">{r.label}</div>
                    <div className="text-[10px] text-neutral-500">
                      {s.length === 0 ? "not rated yet" : `${s.length} rating${s.length !== 1 ? "s" : ""}`}
                      {d != null && (
                        <span className={d > 0.15 ? " text-emerald-400" : d < -0.15 ? " text-red-400" : " text-neutral-500"}>
                          {" "}· {d > 0.15 ? "↑ improving" : d < -0.15 ? "↓ slipping" : "→ steady"}
                        </span>
                      )}
                    </div>
                  </div>
                  {s.length > 0 ? <Sparkline points={s} /> : <span className="text-neutral-700 text-xs">—</span>}
                </div>
              );
            })}
            <p className="text-[10px] text-neutral-600 mt-2">
              Scale 1–5, oldest → newest. Trend compares the last 3 matches to the 3 before.
            </p>
          </Card>

          {styleCounts.length > 0 && (
            <Card className="mb-3">
              <SectionLabel>Playing-style mix</SectionLabel>
              {styleCounts.map(([tag, n]) => (
                <MeterRow key={tag} label={tag} value={n} total={reflected.length} tone="emerald" />
              ))}
              <p className="text-[10px] text-neutral-600 mt-1">Share of reflected matches carrying each tag.</p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <Card>
              <SectionLabel>Top strengths</SectionLabel>
              {strengthCounts.length === 0 && <div className="text-xs text-neutral-600">—</div>}
              {strengthCounts.slice(0, 5).map(([s, n]) => (
                <div key={s} className="flex justify-between text-xs py-1 border-b border-neutral-800 last:border-b-0">
                  <span className="text-emerald-300 font-semibold">{s}</span>
                  <span className="text-neutral-500 font-mono">×{n}</span>
                </div>
              ))}
            </Card>
            <Card>
              <SectionLabel>Top weaknesses</SectionLabel>
              {weaknessCounts.length === 0 && <div className="text-xs text-neutral-600">—</div>}
              {weaknessCounts.slice(0, 5).map(([s, n]) => (
                <div key={s} className="flex justify-between text-xs py-1 border-b border-neutral-800 last:border-b-0">
                  <span className="text-red-300 font-semibold">{s}</span>
                  <span className="text-neutral-500 font-mono">×{n}</span>
                </div>
              ))}
            </Card>
          </div>

          {focusList.length > 0 && (
            <Card className="mb-3">
              <SectionLabel>Recent focus notes</SectionLabel>
              {focusList.map((m) => (
                <div key={m.id} className="py-1.5 border-b border-neutral-800 last:border-b-0">
                  <div className="text-xs text-neutral-200">"{m.reflection.focusNext}"</div>
                  <div className="text-[10px] text-neutral-600 font-mono">{m.id} · {m.date} · vs {m.opponent}</div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {missing > 0 && (
        <Card className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-neutral-500">
              {missing} match{missing !== 1 ? "es" : ""} without a reflection
            </div>
            <Badge tone="muted">History → 📝 Reflect</Badge>
          </div>
        </Card>
      )}
    </Screen>
  );
}
