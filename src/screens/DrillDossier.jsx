import { useEffect, useMemo } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, Stat, BigBtn, Select, AutoSavingTextarea } from "../components/ui.jsx";
import { DRILL_CATEGORIES, DRILL_SKILLS } from "../constants/training.js";
import { normalizeDrill, drillUsage } from "../lib/training.js";

// Drill dossier — one drill's full history: how often, first/last done,
// editable category/skills/description, and every session it appeared in.
// Rendered under .report-root so the print CSS produces a clean PDF.

export default function DrillDossier({ setScreen }) {
  const name = useMatchStore((s) => s.drillViewName);
  const drillCatalog = useMatchStore((s) => s.drillCatalog);
  const sessions = useMatchStore((s) => s.trainingSessions);
  const updateDrill = useMatchStore((s) => s.updateDrill);
  const deleteDrill = useMatchStore((s) => s.deleteDrill);

  const key = normalizeDrill(name);
  const drill = drillCatalog[key];

  const usage = useMemo(() => drillUsage(sessions, key), [sessions, key]);

  useEffect(() => { if (!drill) setScreen("drillCatalog"); }, [drill, setScreen]);
  if (!drill) return null;

  const toggleSkill = (sk) => {
    const skills = (drill.skills || []).includes(sk)
      ? drill.skills.filter((x) => x !== sk)
      : [...(drill.skills || []), sk];
    updateDrill(name, { skills });
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${drill.name}" from the catalog? Session history is kept, but it won't be tracked as a named drill.`)) {
      deleteDrill(name);
      setScreen("drillCatalog");
    }
  };

  return (
    <Screen wide className="report-root">
      <h1 className="hidden print:block text-2xl font-extrabold mb-1">Drill history — {drill.name}</h1>

      <div className="print:hidden">
        <TopBar
          title={drill.name}
          subtitle={`${drill.category}${(drill.skills || []).length ? ` · ${drill.skills.join(", ")}` : ""}`}
          onBack={() => setScreen("drillCatalog")}
        />
      </div>

      <Card className="mb-3">
        <SectionLabel>How often</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Times done" value={usage.count} tone={usage.count >= 5 ? "good" : "default"} />
          <Stat label="First" value={usage.firstDate || "—"} />
          <Stat label="Last" value={usage.lastDate || "—"} />
        </div>
      </Card>

      {/* Editable tags — hidden in print */}
      <Card className="mb-3 print:hidden">
        <SectionLabel>Category & skills</SectionLabel>
        <Select label="Category" value={drill.category} onChange={(v) => updateDrill(name, { category: v })} options={DRILL_CATEGORIES} />
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">Skills trained</div>
        <div className="flex flex-wrap gap-1.5">
          {DRILL_SKILLS.map((sk) => {
            const on = (drill.skills || []).includes(sk);
            return (
              <button key={sk} onClick={() => toggleSkill(sk)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition active:scale-95 ${
                  on ? "bg-sky-700/40 text-sky-200 border-sky-600"
                    : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
                }`}>{sk}{on && " ✓"}</button>
            );
          })}
        </div>
      </Card>

      <Card className="mb-3 print:hidden">
        <SectionLabel>Description / coaching cues</SectionLabel>
        <AutoSavingTextarea
          value={drill.notes || ""}
          onSave={(text) => updateDrill(name, { notes: text })}
          placeholder="What the drill is, setup, coaching cues, what good looks like…"
          statusLabel="drill"
        />
      </Card>

      {drill.notes?.trim() && (
        <p className="hidden print:block text-sm mb-3"><b>Description:</b> {drill.notes.trim()}</p>
      )}

      <Card>
        <SectionLabel>Sessions ({usage.count})</SectionLabel>
        {usage.count === 0 ? (
          <div className="text-sm text-neutral-500">Not yet done in any logged session.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {usage.rows.map(({ session, entry }) => (
              <div key={session.id} className="p-2.5 rounded-md border-l-4 border-emerald-500 bg-emerald-950/20 print:break-inside-avoid">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-mono text-xs text-neutral-300">
                    <span className="font-bold text-neutral-100">{session.date}</span>
                    <span className="mx-1.5 text-neutral-600">·</span>{session.type}
                    {session.coach && <span className="ml-1.5 text-neutral-400">· {session.coach}</span>}
                  </div>
                  {(entry.sets || entry.reps) && (
                    <div className="text-[11px] text-neutral-400">
                      {[entry.sets && `${entry.sets} sets`, entry.reps].filter(Boolean).join(" × ")}
                    </div>
                  )}
                </div>
                {entry.note?.trim() && <div className="text-sm text-neutral-200 mt-1">{entry.note.trim()}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="print:hidden mt-3">
        <BigBtn tone="info" onClick={() => window.print()}>📄 Print / save as PDF</BigBtn>
        <BigBtn tone="secondary" onClick={() => setScreen("drillCatalog")}>Back</BigBtn>
        <button onClick={handleDelete} className="w-full mt-1 py-2 rounded-lg border border-red-900 text-red-400 text-xs font-semibold hover:bg-red-950/40">
          Delete from catalog (keeps session history)
        </button>
      </div>
    </Screen>
  );
}
