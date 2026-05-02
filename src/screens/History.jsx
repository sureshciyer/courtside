import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, Badge } from "../components/ui.jsx";
import {
  matchAnalysisMarkdown,
  copyMarkdown,
  downloadMarkdown,
  slugify,
} from "../lib/markdown.js";

export default function History({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";
  const reopenMatch = useMatchStore((s) => s.reopenMatch);
  const currentMatch = useMatchStore((s) => s.currentMatch);
  const [flash, setFlash] = useState(null);

  const toast = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  };

  const handleCopy = async (m) => {
    const md = matchAnalysisMarkdown(m, { playerName });
    const ok = await copyMarkdown(md);
    toast(ok ? `${m.id} copied` : "Copy failed");
  };

  const handleDownload = (m) => {
    const md = matchAnalysisMarkdown(m, { playerName });
    downloadMarkdown(md, `courtside_${m.id}_${slugify(m.opponent)}.md`);
    toast(`${m.id} downloaded`);
  };

  const handleReopen = (m) => {
    const liveActive = currentMatch && !currentMatch.completed;
    const liveNote = liveActive
      ? `\n\nNote: your live match (vs ${currentMatch.opponent || "—"}) will auto-pause first.`
      : "";
    const ok = window.confirm(
      `Reopen match ${m.id} (vs ${m.opponent})?\n\n` +
      `It will move from History → Live capture so you can keep adding rallies (or tap Next set to start a new set).${liveNote}`
    );
    if (!ok) return;
    reopenMatch(m.id);
    setScreen("capture");
  };

  return (
    <Screen>
      <TopBar title="Match history" subtitle={`${matches.length} completed`} onBack={() => setScreen("home")} />

      {flash && (
        <div className="cs-toast fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {flash}
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center text-neutral-500 mt-10 text-sm">No matches yet — start one from the home screen.</div>
      )}
      <div className="flex flex-col gap-2">
        {[...matches].reverse().map((m) => {
          const w = m.rallies.filter((r) => r.pointWonBy === "S").length;
          const l = m.rallies.filter((r) => r.pointWonBy === "O").length;
          const setWins = m.sets.filter((s) => s.sonScore > s.oppScore).length;
          const matchWon = setWins > m.sets.length / 2;
          const hasInsights = !!(m.aiInsights && m.aiInsights.trim());
          return (
            <Card key={m.id} tone={matchWon ? "accent" : "default"}>
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white truncate">vs {m.opponent}</span>
                    {hasInsights && <Badge tone="muted">🧠</Badge>}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">{m.id} · {m.date}</div>
                </div>
                <Badge tone={matchWon ? "default" : "danger"}>{matchWon ? "WON" : "LOST"}</Badge>
              </div>
              <div className="font-mono text-sm text-neutral-300">
                {m.sets.map((s, i) => (
                  <span key={i} className={`mr-3 ${s.sonScore > s.oppScore ? "text-emerald-300" : "text-red-300"}`}>
                    {s.sonScore}-{s.oppScore}
                  </span>
                ))}
                <span className="text-neutral-500">({w}W · {l}L)</span>
              </div>
              {m.tournament && <div className="text-[11px] text-neutral-500 mt-1">{m.tournament}</div>}
              {m.playerStyle && m.playerStyle !== "Unknown" && (
                <div className="text-[11px] text-amber-300/90 mt-0.5">Opponent style: {m.playerStyle}</div>
              )}

              <div className="flex gap-1.5 mt-2 pt-2 border-t border-neutral-800">
                <button
                  onClick={() => handleCopy(m)}
                  className="flex-1 px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[11px] font-semibold active:scale-95"
                >
                  📋 Copy Markdown
                </button>
                <button
                  onClick={() => handleDownload(m)}
                  className="flex-1 px-2 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px] font-semibold active:scale-95"
                >
                  ⬇ Download .md
                </button>
                <button
                  onClick={() => handleReopen(m)}
                  className="flex-1 px-2 py-1 rounded-md bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 text-amber-200 text-[11px] font-semibold active:scale-95"
                  title="Move this match back to live capture so you can keep adding rallies / sets"
                >
                  ↻ Reopen
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
