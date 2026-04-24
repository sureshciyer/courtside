import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Stat, BigBtn, Card, SectionLabel } from "../components/ui.jsx";
import {
  matchAnalysisMarkdown,
  copyMarkdown,
  downloadMarkdown,
  slugify,
} from "../lib/markdown.js";

export default function Summary({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";
  const updateMatchAiInsights = useMatchStore((s) => s.updateMatchAiInsights);
  const m = matches[matches.length - 1];
  if (!m) { setScreen("home"); return null; }

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

  // Local state for the AI-insights textarea (prevents lag on every keystroke;
  // debounces into the store).
  const [insightsDraft, setInsightsDraft] = useState(m.aiInsights || "");
  const [copied, setCopied] = useState(false);
  const saveInsights = () => updateMatchAiInsights(m.id, insightsDraft);

  const handleExportMarkdown = async (action) => {
    saveInsights();
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

      {/* AI insights editor — critique pasted back from Claude/Gemini lands in
          the Match Analysis Markdown (## AI critique section). */}
      <Card className="mt-3 mb-3">
        <SectionLabel>🧠 AI tactical insights</SectionLabel>
        <textarea
          value={insightsDraft}
          onChange={(e) => setInsightsDraft(e.target.value)}
          onBlur={saveInsights}
          placeholder="Paste Claude / Gemini's critique of this match here. It will appear in the Match Analysis Markdown export under the ## AI critique section."
          className="w-full min-h-[120px] p-3 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-[13px] font-display placeholder-neutral-600 focus:outline-none focus:border-emerald-600 resize-y leading-relaxed"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-neutral-500">Saves on blur. Survives refresh.</span>
          <button
            onClick={saveInsights}
            className="px-3 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700"
          >Save</button>
        </div>
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
