import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, BigBtn, Card } from "../components/ui.jsx";

export default function Home({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const currentMatch = useMatchStore((s) => s.currentMatch);
  const pausedMatches = useMatchStore((s) => s.pausedMatches);
  const resumeMatch = useMatchStore((s) => s.resumeMatch);
  const discardPausedMatch = useMatchStore((s) => s.discardPausedMatch);
  const pauseCurrentMatch = useMatchStore((s) => s.pauseCurrentMatch);

  const totalRallies = matches.reduce((a, m) => a + m.rallies.length, 0);
  const n = matches.length;
  const activeLive = currentMatch && !currentMatch.completed;

  const handleResumePaused = (id) => {
    resumeMatch(id);
    setScreen("capture");
  };

  const handleDiscard = (m) => {
    const ok = window.confirm(
      `Discard match vs ${m.opponent || "(no opponent)"}?\n\n` +
      `${m.rallies.length} captured rall${m.rallies.length !== 1 ? "ies" : "y"} will be lost. This cannot be undone.`
    );
    if (ok) discardPausedMatch(m.id);
  };

  return (
    <Screen>
      <div className="text-center pt-6 pb-4">
        <div className="text-5xl mb-1">🏸</div>
        <h1 className="font-extrabold text-3xl text-white tracking-tight">Courtside</h1>
        <p className="text-xs text-neutral-500 tracking-wider uppercase">Tactical notation</p>
      </div>

      {/* Live match card (the one currently being captured) */}
      {activeLive && (
        <Card tone="accent" className="mb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Live match</div>
              <div className="font-bold text-white truncate">vs {currentMatch.opponent || "…"}</div>
              <div className="text-xs text-neutral-400">
                {currentMatch.id} · Set {currentMatch.currentSet + 1} · {currentMatch.rallies.length} rallies
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => setScreen("capture")}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm active:scale-95"
              >
                Resume →
              </button>
              <button
                onClick={pauseCurrentMatch}
                className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold border border-neutral-700"
                title="Park this match without ending it"
              >
                Pause
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Paused matches list */}
      {pausedMatches.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold mb-1.5 mt-1 px-1">
            Paused · {pausedMatches.length}
          </div>
          <div className="flex flex-col gap-1.5 mb-2">
            {pausedMatches.map((m) => {
              const setScore = m.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", ");
              const agoSec = m.pausedAt ? Math.round((Date.now() - m.pausedAt) / 1000) : 0;
              const ago = agoSec < 60 ? "just now"
                        : agoSec < 3600 ? `${Math.round(agoSec / 60)}m ago`
                        : agoSec < 86400 ? `${Math.round(agoSec / 3600)}h ago`
                        : `${Math.round(agoSec / 86400)}d ago`;
              return (
                <Card key={m.id} tone="warn" className="!p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">vs {m.opponent || "(no opponent)"}</div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {m.id} · Set {m.currentSet + 1} · {m.rallies.length} rallies · {setScore}
                      </div>
                      {m.tournament && (
                        <div className="text-[11px] text-amber-300/80 truncate">{m.tournament}</div>
                      )}
                      <div className="text-[10px] text-neutral-500 mt-0.5">Paused {ago}</div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleResumePaused(m.id)}
                        className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs active:scale-95"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => handleDiscard(m)}
                        className="px-3 py-1 rounded-md bg-neutral-900 hover:bg-red-950 text-red-400 text-[10px] font-semibold border border-red-900 hover:border-red-700"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <BigBtn tone="secondary" onClick={() => setScreen("quickLog")}>
        📝 Quick log (reflection only)
      </BigBtn>
      <BigBtn tone="primary" onClick={() => setScreen("setup")}>
        New match
        {(activeLive || pausedMatches.length > 0) && (
          <span className="ml-2 text-[11px] font-normal opacity-80">
            (live match will auto-pause)
          </span>
        )}
      </BigBtn>
      {n > 0 && (
        <>
          <BigBtn tone="secondary" onClick={() => setScreen("history")}>
            Match history
            <span className="ml-2 font-mono text-emerald-400 text-xs">({n})</span>
          </BigBtn>
          <BigBtn tone="violet" onClick={() => setScreen("reflectionTrends")}>
            📝 Reflection trends
          </BigBtn>
          <BigBtn tone="violet" onClick={() => setScreen("patterns")}>
            Patterns & tactical intelligence
          </BigBtn>
          <BigBtn tone="info" onClick={() => setScreen("scouting")}>
            🎯 Scouting dossier
          </BigBtn>
          <BigBtn tone="accent" onClick={() => setScreen("report")}>
            Full performance report
          </BigBtn>
          <BigBtn tone="secondary" onClick={() => setScreen("customReport")}>
            📋 Custom report (selected sections)
          </BigBtn>
        </>
      )}
      {/* Backup/Restore is always reachable — a brand-new device needs
          Restore before any matches exist. */}
      <BigBtn tone="secondary" onClick={() => setScreen("exportScreen")}>
        💾 Backup / Restore
      </BigBtn>

      <div className="mt-auto pt-6 text-center flex flex-col items-center gap-2">
        <button
          onClick={() => setScreen("settings")}
          className="text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-800 hover:border-neutral-600 rounded-full px-3 py-1.5 transition"
        >
          ⚙ Settings
        </button>
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-semibold">
          {n} match{n !== 1 ? "es" : ""} · {totalRallies} rallies stored
        </div>
      </div>
    </Screen>
  );
}
