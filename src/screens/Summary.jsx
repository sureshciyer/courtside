import { useEffect, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Stat, BigBtn, Card, SectionLabel, AutoSavingTextarea } from "../components/ui.jsx";
import {
  matchAnalysisMarkdown,
  copyMarkdown,
  downloadMarkdown,
  slugify,
} from "../lib/markdown.js";
import { evaluateGoal, goalLabel, findMetric } from "../lib/goals.js";

export default function Summary({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";
  const updateMatchAiInsights = useMatchStore((s) => s.updateMatchAiInsights);
  const goals = useMatchStore((s) => s.goals) || [];
  const m = matches[matches.length - 1];

  // Hook state must stay unconditional — tracked before any early return.
  const [copied, setCopied] = useState(false);

  // Route away if there's genuinely nothing to summarise.
  useEffect(() => { if (!m) setScreen("home"); }, [m, setScreen]);
  if (!m) return null;

  const r = m.rallies;
  const w = r.filter((x) => x.pointWonBy === "S").length;
  const l = r.filter((x) => x.pointWonBy === "O").length;
  const ue = r.filter((x) => x.result === "UE" && x.pointWonBy === "O").length;
  const wn = r.filter((x) => x.result === "W" && x.pointWonBy === "S").length;
  const cl = r.filter((x) => x.phase === "Clutch");
  const cw = cl.filter((x) => x.pointWonBy === "S").length;
  const avg = r.length > 0 ? (r.reduce((a, x) => a + x.shots.length, 0) / r.length).toFixed(1) : 0;
  const setWins = m.sets.filter((s) => s.sonScore > s.oppScore).length;
  const won = setWins > m.sets.length / 2;

  const handleExportMarkdown = async (action) => {
    // Pull the latest match state in case the autosaving textarea committed
    // a keystroke in the last millisecond.
    const latest = useMatchStore.getState().matches.find((x) => x.id === m.id) || m;
    const md = matchAnalysisMarkdown(latest, { playerName });
    if (action === "copy") {
      const ok = await copyMarkdown(md);
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } else {
      const safeOpp = slugify(m.opponent);
      downloadMarkdown(md, `courtside_${m.id}_${safeOpp}.md`);
    }
  };

  return (
    <Screen>
      <TopBar title="Match summary" onBack={() => setScreen("home")} />

      <Card tone={won ? "accent" : "danger"} className="mb-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          {m.id} · vs {m.opponent}
        </div>
        <div className="flex justify-center gap-5 my-2">
          {m.sets.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-[9px] uppercase text-neutral-500 tracking-wider">S{i + 1}</div>
              <div className={`text-2xl font-extrabold font-display tabular-nums ${s.sonScore > s.oppScore ? "text-emerald-400" : "text-red-400"}`}>
                {s.sonScore}-{s.oppScore}
              </div>
            </div>
          ))}
        </div>
        <div className={`text-sm font-bold uppercase tracking-widest ${won ? "text-emerald-400" : "text-red-400"}`}>
          {won ? "Match won" : "Match lost"}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="Rallies" value={r.length} />
        <Stat label="Won" value={w} tone="good" />
        <Stat label="Lost" value={l} tone="bad" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="Winners" value={wn} tone="good" />
        <Stat label="UE" value={ue} tone="bad" />
        <Stat label="Avg rally" value={avg} />
      </div>
      {cl.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Stat label="Clutch pts" value={cl.length} tone="warn" />
          <Stat label="Clutch won" value={`${cw}/${cl.length}`} tone={cw >= cl.length / 2 ? "good" : "bad"} />
        </div>
      )}

      {/* Goal evaluation — green/red per goal vs this match's rallies */}
      {goals.length > 0 && (
        <Card className="mb-3">
          <SectionLabel>🎯 Match goals</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {goals.map((g) => {
              const result = evaluateGoal(g, m.rallies);
              const m_metric = findMetric(g.metricKey);
              const valueStr = result.hasData ? `${result.value}${m_metric?.unit || ""}` : "no data";
              return (
                <div
                  key={g.id}
                  className={`flex items-center gap-3 p-2.5 rounded-md border ${
                    result.met === true
                      ? "bg-emerald-950/40 border-emerald-700"
                      : result.met === false
                      ? "bg-red-950/40 border-red-700"
                      : "bg-neutral-900 border-neutral-700"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    result.met === true ? "bg-emerald-600 text-white"
                      : result.met === false ? "bg-red-600 text-white"
                      : "bg-neutral-700 text-neutral-300"
                  }`}>
                    {result.met === true ? "✓" : result.met === false ? "✕" : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate ${
                      result.met === true ? "text-emerald-200"
                        : result.met === false ? "text-red-200"
                        : "text-neutral-300"
                    }`}>
                      {goalLabel(g)}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono">
                      This match: <span className="font-bold text-neutral-200">{valueStr}</span>
                      {result.met !== null && (
                        <span className={result.met ? " text-emerald-400" : " text-red-400"}>
                          {" "}· {result.met ? "goal met" : "goal missed"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
            Goals are evaluated against the rallies of this match only. Edit them on
            the Patterns screen between matches.
          </p>
        </Card>
      )}

      {/* AI insights editor — critique pasted back from Claude/Gemini lands in
          the Match Analysis Markdown (## AI critique section). */}
      <Card className="mt-3 mb-3">
        <SectionLabel>🧠 AI tactical insights</SectionLabel>
        <AutoSavingTextarea
          value={m.aiInsights || ""}
          onSave={(text) => updateMatchAiInsights(m.id, text)}
          placeholder="Paste Claude / Gemini's critique of this match here. It will appear in the Match Analysis Markdown export under the ## AI critique section."
          statusLabel="critique"
        />
      </Card>

      <Card className="mb-3">
        <SectionLabel>📤 Export</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleExportMarkdown("copy")}
            className="py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm active:scale-95"
          >
            {copied ? "Copied!" : "📋 Copy Markdown"}
          </button>
          <button
            onClick={() => handleExportMarkdown("download")}
            className="py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-bold text-sm active:scale-95"
          >
            ⬇ Download .md
          </button>
        </div>
        <div className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
          Includes headline stats, per-set breakdown, zone heatmaps, Tactical
          Cleverness metrics, coaching recs, your AI critique, and the raw
          match JSON block for further LLM analysis.
        </div>
      </Card>

      <div className="mt-2">
        <BigBtn tone="violet" onClick={() => setScreen("patterns")}>See tactical patterns →</BigBtn>
        <BigBtn tone="accent" onClick={() => setScreen("report")}>Full performance report →</BigBtn>
        <BigBtn tone="secondary" onClick={() => setScreen("home")}>Back to home</BigBtn>
      </div>
    </Screen>
  );
}
