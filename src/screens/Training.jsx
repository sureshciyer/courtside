import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, BigBtn, Badge } from "../components/ui.jsx";
import { trainingSummary } from "../lib/training.js";

// Training log — list of coaching sessions (private + group), newest first,
// with search + type filter. Tap a session to view / edit it. Links out to
// the drill catalog (per-drill frequency).

export default function Training({ setScreen }) {
  const sessions = useMatchStore((s) => s.trainingSessions);
  const openTrainingEdit = useMatchStore((s) => s.openTrainingEdit);
  const openTrainingView = useMatchStore((s) => s.openTrainingView);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const summary = useMemo(() => trainingSummary(sessions), [sessions]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...sessions]
      .reverse()
      .filter((s) => typeFilter === "All" || s.type === typeFilter)
      .filter((s) => {
        if (!needle) return true;
        return (
          (s.coach || "").toLowerCase().includes(needle) ||
          (s.focus || "").toLowerCase().includes(needle) ||
          (s.club || "").toLowerCase().includes(needle) ||
          (s.notes || "").toLowerCase().includes(needle) ||
          (s.drills || []).some((d) => (d.name || "").toLowerCase().includes(needle))
        );
      });
  }, [sessions, q, typeFilter]);

  const newSession = () => { openTrainingEdit(null); setScreen("trainingSessionEdit"); };
  // Tapping a session opens the read/print view; edit is one tap deeper
  // (or via the ✎ shortcut on the row).
  const openSession = (id) => { openTrainingView(id); setScreen("trainingSessionView"); };
  const editSession = (id) => { openTrainingEdit(id); setScreen("trainingSessionEdit"); };

  return (
    <Screen>
      <TopBar
        title="Training log"
        subtitle={`${summary.total} session${summary.total !== 1 ? "s" : ""} · ${summary.drillRefs} drill entries`}
        onBack={() => setScreen("home")}
      />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <BigBtn tone="primary" onClick={newSession} className="!mb-0">＋ Log session</BigBtn>
        <BigBtn tone="secondary" onClick={() => setScreen("drillCatalog")} className="!mb-0">🗂 Drill catalog</BigBtn>
      </div>

      <div className="mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search coach, focus, club, or drill…"
          className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 text-sm"
        />
        <div className="flex gap-1.5 mt-2">
          {["All", "Private", "Group"].map((t) => (
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
      </div>

      {rows.length === 0 ? (
        <Card className="text-center py-8">
          <div className="text-3xl mb-2">🏋️</div>
          <div className="font-bold text-white mb-1">
            {sessions.length === 0 ? "No sessions logged yet" : "No sessions match that filter"}
          </div>
          <div className="text-sm text-neutral-400">
            {sessions.length === 0
              ? "Log a private or group class — you can backdate old sessions and add a video link."
              : "Try a different search or type."}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((s) => (
            <Card key={s.id} tone={s.type === "Private" ? "accent" : "default"} className="!p-0 overflow-hidden">
              <button onClick={() => openSession(s.id)} className="w-full text-left p-4 hover:bg-neutral-800/40 transition active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{s.date || "—"}</span>
                      <Badge tone={s.type === "Private" ? "default" : "muted"}>{s.type}</Badge>
                      {s.videoUrl?.trim() && <Badge tone="muted">🎬</Badge>}
                      {s.rating != null && <Badge tone="muted">{s.rating}/5</Badge>}
                    </div>
                    {s.focus?.trim() && <div className="text-sm text-neutral-200 mt-0.5 truncate">{s.focus.trim()}</div>}
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {[s.coach && `Coach: ${s.coach}`, s.club, s.durationMin && `${s.durationMin} min`].filter(Boolean).join(" · ")}
                    </div>
                    {(s.drills || []).length > 0 && (
                      <div className="text-[11px] text-emerald-300/80 mt-1 truncate">
                        {(s.drills || []).length} drill{(s.drills || []).length !== 1 ? "s" : ""}: {(s.drills || []).map((d) => d.name).join(", ")}
                      </div>
                    )}
                  </div>
                  <span className="text-neutral-500 text-lg">›</span>
                </div>
              </button>
              <div className="flex gap-1.5 px-4 pb-3 -mt-1">
                <button
                  onClick={() => openSession(s.id)}
                  className="flex-1 px-2 py-1 rounded-md bg-sky-900/40 hover:bg-sky-900/60 border border-sky-800 text-sky-200 text-[11px] font-semibold active:scale-95"
                >
                  📄 View / print
                </button>
                <button
                  onClick={() => editSession(s.id)}
                  className="flex-1 px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-[11px] font-semibold active:scale-95"
                >
                  ✎ Edit
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
