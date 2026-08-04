import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import {
  listOpponents,
  opponentDossier,
} from "../lib/analytics.js";
import {
  battlePlanMarkdown,
  matchAnalysisMarkdown,
  copyMarkdown,
  downloadMarkdown,
  slugify,
} from "../lib/markdown.js";
import {
  Screen, TopBar, Card, BigBtn, Stat, HeatGrid, SectionLabel, Badge, AutoSavingTextarea,
} from "../components/ui.jsx";
import { hasReflection } from "../constants/reflection.js";
import { hasPreMatch } from "../constants/prematch.js";

// Scouting screen. Two views:
//   - Opponent list (default) — searchable, shows career record per opponent
//   - Dossier view            — deep dive for one opponent + notes editor +
//                               AI insights editor + Battle Plan export
// State-per-view is kept in local React state; persisted fields (notes,
// aiInsights) flow through the store so they survive refresh.

export default function Scouting({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  // `?? {}` would change identity each render. Keep the store value as-is
  // and default inside the memo body so dependencies stay stable.
  const opponents = useMatchStore((s) => s.opponents);
  const [selectedKey, setSelectedKey] = useState(null);

  const opponentRows = useMemo(
    () => listOpponents(matches, opponents || {}),
    [matches, opponents]
  );

  if (selectedKey) {
    const row = opponentRows.find((o) => o.key === selectedKey);
    const name = row?.name || selectedKey;
    return <Dossier name={name} onBack={() => setSelectedKey(null)} goHome={() => setScreen("home")} setScreen={setScreen} />;
  }

  return (
    <OpponentList
      rows={opponentRows}
      onPick={(key) => setSelectedKey(key)}
      onBack={() => setScreen("insights")}
    />
  );
}

// ===================================================================
//                      Opponent list view
// ===================================================================
function OpponentList({ rows, onPick, onBack }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(needle) ||
      r.tournaments.some((t) => t.toLowerCase().includes(needle))
    );
  }, [rows, q]);

  return (
    <Screen>
      <TopBar
        title="Scouting dossier"
        subtitle={`${rows.length} opponent${rows.length !== 1 ? "s" : ""}`}
        onBack={onBack}
      />

      <div className="mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search opponents or tournaments…"
          className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-8">
          <div className="text-3xl mb-2">🎯</div>
          <div className="font-bold text-white mb-1">
            {q ? "No matches for that search" : "No opponents yet"}
          </div>
          <div className="text-sm text-neutral-400">
            {q ? "Try a different name or tournament." : "Capture a match and the opponent lands here automatically."}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((r) => {
            const hasNotes = !!r.notes.trim();
            const hasInsights = !!r.aiInsights.trim();
            const record = r.matchesPlayed > 0 ? `${r.wins}W - ${r.losses}L` : "—";
            const tone = r.matchesPlayed === 0
              ? "default"
              : r.wins > r.losses ? "accent"
              : r.wins < r.losses ? "danger"
              : "warn";
            return (
              <button
                key={r.key}
                onClick={() => onPick(r.key)}
                className="text-left"
              >
                <Card tone={tone}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white truncate">{r.name}</span>
                        {hasNotes && <Badge tone="muted">📝</Badge>}
                        {hasInsights && <Badge tone="muted">🧠</Badge>}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {r.matchesPlayed} match{r.matchesPlayed !== 1 ? "es" : ""}
                        {r.matchesPlayed > 0 && (
                          <>
                            <span className="mx-1.5 text-neutral-600">·</span>
                            <span className={r.wins > r.losses ? "text-emerald-300" : r.wins < r.losses ? "text-red-300" : "text-amber-300"}>
                              {record}
                            </span>
                            <span className="mx-1.5 text-neutral-600">·</span>
                            <span>{r.winRate}%</span>
                          </>
                        )}
                      </div>
                      {r.lastPlayed && (
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Last played: {r.lastPlayed}
                          {r.tournaments.length > 0 && (
                            <span className="ml-2 truncate">· {r.tournaments.slice(0, 2).join(", ")}
                              {r.tournaments.length > 2 && ` +${r.tournaments.length - 2}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-neutral-500 text-lg">›</span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

// ===================================================================
//                           Dossier view
// ===================================================================
function Dossier({ name, onBack, goHome, setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const opponents = useMatchStore((s) => s.opponents);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";
  const updateOpponentProfile = useMatchStore((s) => s.updateOpponentProfile);
  const deleteOpponentProfile = useMatchStore((s) => s.deleteOpponentProfile);
  const openOpponentTimeline = useMatchStore((s) => s.openOpponentTimeline);

  const dossier = useMemo(
    () => opponentDossier(matches, name, opponents || {}),
    [matches, name, opponents]
  );

  const [copyMsg, setCopyMsg] = useState(null);
  const flash = (msg) => { setCopyMsg(msg); setTimeout(() => setCopyMsg(null), 2000); };

  const handleBattlePlan = async (action) => {
    // Re-read latest from store to include any in-flight autosaved edits.
    const latestOpponents = useMatchStore.getState().opponents || {};
    const freshDossier = opponentDossier(matches, name, latestOpponents);
    const md = battlePlanMarkdown(freshDossier, { playerName });
    if (action === "copy") {
      const ok = await copyMarkdown(md);
      flash(ok ? "Battle plan copied" : "Copy failed — try download");
    } else {
      downloadMarkdown(md, `battleplan_${slugify(name)}.md`);
      flash("Battle plan downloaded");
    }
  };

  const handleMatchExport = async (match, action) => {
    const md = matchAnalysisMarkdown(match, { playerName });
    if (action === "copy") {
      const ok = await copyMarkdown(md);
      flash(ok ? `${match.id} copied` : "Copy failed — try download");
    } else {
      downloadMarkdown(md, `courtside_${match.id}_${slugify(name)}.md`);
      flash(`${match.id} downloaded`);
    }
  };

  const handleDeleteProfile = () => {
    if (!dossier.profile) return;
    const ok = window.confirm(
      `Delete scouting profile for ${name}? Notes and AI insights will be lost. ` +
      `Match history stays in the archive.`
    );
    if (ok) { deleteOpponentProfile(name); onBack(); }
  };

  const b = dossier.bundle;
  const reflectedCount = dossier.matches.filter((m) => hasReflection(m) || hasPreMatch(m)).length;

  return (
    <Screen wide>
      <TopBar title={name} subtitle={`${dossier.matchesPlayed} match${dossier.matchesPlayed !== 1 ? "es" : ""}`} onBack={onBack} />

      {copyMsg && (
        <div className="cs-toast fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {copyMsg}
        </div>
      )}

      {/* Career record */}
      <Card tone={dossier.wins > dossier.losses ? "accent" : dossier.wins < dossier.losses ? "danger" : "default"} className="mb-3">
        <SectionLabel>Career vs {playerName}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Matches" value={dossier.matchesPlayed} />
          <Stat label="W / L" value={`${dossier.wins}-${dossier.losses}`} tone={dossier.wins > dossier.losses ? "good" : dossier.wins < dossier.losses ? "bad" : "warn"} />
          <Stat label="Win rate" value={`${dossier.winRate}%`} tone={dossier.winRate >= 60 ? "good" : dossier.winRate <= 40 ? "bad" : "warn"} />
        </div>
        {dossier.tournaments.length > 0 && (
          <div className="text-[11px] text-neutral-500 mt-2">
            Played at: {dossier.tournaments.join(", ")}
          </div>
        )}
      </Card>

      {/* Reflections timeline */}
      {reflectedCount > 0 && (
        <Card className="mb-3">
          <SectionLabel>📖 Reflections timeline</SectionLabel>
          <p className="text-xs text-neutral-400 mb-2 leading-relaxed">
            Every pre- and post-match reflection vs {name}, stacked by date on one page —
            read the arc across meetings, or print / save as PDF for the coach.
          </p>
          <BigBtn
            tone="info"
            onClick={() => { openOpponentTimeline(name); setScreen("opponentReflections"); }}
          >
            📖 Read all reflections ({reflectedCount})
          </BigBtn>
        </Card>
      )}

      {/* Battle plan export */}
      <Card tone="accent" className="mb-3">
        <SectionLabel>🎯 Battle plan</SectionLabel>
        <p className="text-xs text-neutral-400 mb-2 leading-relaxed">
          Pre-match scouting brief: top 3 keys to win, opponent traps, serve ROI by phase,
          recovery leaks, momentum watchpoints — plus your scouting notes + any AI critique.
          Raw encounter JSON included at the bottom for deeper LLM analysis.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleBattlePlan("copy")}
            className="py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm active:scale-95"
          >📋 Copy Battle Plan</button>
          <button
            onClick={() => handleBattlePlan("download")}
            className="py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-bold text-sm active:scale-95"
          >⬇ Download .md</button>
        </div>
      </Card>

      {/* Scouting notes */}
      <Card className="mb-3">
        <SectionLabel>📝 Scouting notes (manual)</SectionLabel>
        <AutoSavingTextarea
          value={dossier.notes}
          onSave={(text) => updateOpponentProfile(name, { notes: text })}
          placeholder="e.g. weak backhand · fast at net · struggles with flick serves · goes short on 2nd shot"
          minHeight={90}
          statusLabel="notes"
        />
        <div className="text-[11px] text-neutral-500 mt-1.5">Appears in the Battle Plan under 📝 Scouting notes.</div>
      </Card>

      {/* AI insights */}
      <Card className="mb-3">
        <SectionLabel>🧠 AI insights (opponent-level critique)</SectionLabel>
        <AutoSavingTextarea
          value={dossier.aiInsights}
          onSave={(text) => updateOpponentProfile(name, { aiInsights: text })}
          placeholder="Paste Claude / Gemini's analysis across all your matches vs this opponent. Lives on the opponent profile and surfaces in every Battle Plan."
          statusLabel="insights"
        />
        <div className="text-[11px] text-neutral-500 mt-1.5">Appears in the Battle Plan under 🧠 AI INSIGHTS.</div>
      </Card>

      {/* Heatmaps */}
      {b && dossier.rallies.length > 0 && (
        <Card className="mb-3">
          <SectionLabel>🗺 Combined heatmaps</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5 font-semibold">Your winner zones</div>
              <HeatGrid values={b.winnerZones} tone="emerald" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5 font-semibold">Your error zones</div>
              <HeatGrid values={b.errorZonesAll} tone="red" />
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5 font-semibold">All shot targets</div>
              <HeatGrid values={b.allZones} tone="sky" />
            </div>
          </div>
        </Card>
      )}

      {/* Past encounters */}
      {dossier.matches.length > 0 && (
        <Card className="mb-3">
          <SectionLabel>📅 Past encounters</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {[...dossier.matches].reverse().map((m) => {
              const setsWon = m.sets.filter((s) => s.sonScore > s.oppScore).length;
              const won = setsWon > m.sets.length / 2;
              return (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-md border-l-4 ${won ? "bg-emerald-950/40 border-emerald-500" : "bg-red-950/40 border-red-500"}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-neutral-400">
                        <span className="text-neutral-200 font-bold">{m.id}</span>
                        <span className="mx-1.5">·</span>
                        {m.date || "—"}
                        {m.tournament && <span className="ml-2 text-amber-300/80">{m.tournament}</span>}
                      </div>
                      <div className={`text-sm font-mono mt-0.5 ${won ? "text-emerald-300" : "text-red-300"}`}>
                        {m.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", ")}
                        <span className="ml-2 text-neutral-400">({m.rallies.length} rallies)</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMatchExport(m, "copy")}
                        className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[11px] font-semibold"
                      >📋 .md</button>
                      <button
                        onClick={() => handleMatchExport(m, "download")}
                        className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px] font-semibold"
                      >⬇</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {dossier.matchesPlayed === 0 && (
        <Card className="mb-3 text-center">
          <div className="text-3xl mb-2">🎯</div>
          <div className="text-sm text-neutral-400">
            Profile exists (notes / AI insights above) but no matches captured yet.
            Start one to unlock career analytics + the full Battle Plan.
          </div>
          <div className="mt-3">
            <BigBtn tone="primary" onClick={goHome}>Back to home</BigBtn>
          </div>
        </Card>
      )}

      {dossier.profile && (
        <div className="mt-4 mb-6">
          <button
            onClick={handleDeleteProfile}
            className="w-full py-2 rounded-lg border border-red-900 text-red-400 text-xs font-semibold hover:bg-red-950/40"
          >
            Delete profile (keeps match history)
          </button>
        </div>
      )}
    </Screen>
  );
}
