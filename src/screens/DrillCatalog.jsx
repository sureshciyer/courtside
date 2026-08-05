import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, Badge } from "../components/ui.jsx";
import { catalogWithUsage } from "../lib/training.js";

// Drill catalog — every drill ever logged, with how often it's been done
// and when it was last done. Tap a drill for its full history (dossier).

export default function DrillCatalog({ setScreen }) {
  const drillCatalog = useMatchStore((s) => s.drillCatalog);
  const sessions = useMatchStore((s) => s.trainingSessions);
  const openDrillView = useMatchStore((s) => s.openDrillView);

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("count");

  const rows = useMemo(() => {
    const all = catalogWithUsage(drillCatalog, sessions, sortBy);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((d) =>
      d.name.toLowerCase().includes(needle) ||
      (d.category || "").toLowerCase().includes(needle) ||
      (d.skills || []).some((s) => s.toLowerCase().includes(needle))
    );
  }, [drillCatalog, sessions, sortBy, q]);

  const open = (name) => { openDrillView(name); setScreen("drillDossier"); };

  return (
    <Screen>
      <TopBar
        title="Drill catalog"
        subtitle={`${rows.length} drill${rows.length !== 1 ? "s" : ""}`}
        onBack={() => setScreen("training")}
      />

      <div className="mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search drills, category, or skill…"
          className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 text-sm"
        />
        <div className="flex gap-1.5 mt-2">
          {[["count", "Most done"], ["recent", "Recent"], ["name", "A–Z"]].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setSortBy(v)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                sortBy === v ? "bg-emerald-700/40 text-emerald-200 border-emerald-600"
                  : "bg-neutral-900 text-neutral-500 border-neutral-700"
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center py-8">
          <div className="text-3xl mb-2">🗂</div>
          <div className="font-bold text-white mb-1">No drills yet</div>
          <div className="text-sm text-neutral-400">Log a session with drills and they'll appear here with frequency.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((d) => (
            <button key={d.key} onClick={() => open(d.name)} className="text-left">
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{d.name}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {d.category}
                      {(d.skills || []).length > 0 && <span className="text-neutral-600"> · {d.skills.join(", ")}</span>}
                    </div>
                    {d.lastDate && <div className="text-[11px] text-neutral-500 mt-0.5">Last done: {d.lastDate}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={d.count >= 5 ? "default" : "muted"}>×{d.count}</Badge>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
