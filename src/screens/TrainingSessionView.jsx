import { useEffect, useMemo } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, BigBtn, Badge } from "../components/ui.jsx";
import { normalizeDrill } from "../lib/training.js";

// Read + print view of ONE training session, for sharing with the coach.
// Rendered under .report-root so the print CSS in index.css converts the
// dark screen view into a clean light A4 page (same approach as the
// pre-match plan and drill dossier).

export default function TrainingSessionView({ setScreen }) {
  const viewId = useMatchStore((s) => s.trainingViewId);
  const sessions = useMatchStore((s) => s.trainingSessions);
  const drillCatalog = useMatchStore((s) => s.drillCatalog);
  const openTrainingEdit = useMatchStore((s) => s.openTrainingEdit);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";

  const session = useMemo(
    () => sessions.find((s) => s.id === viewId) || null,
    [sessions, viewId]
  );

  useEffect(() => { if (!session) setScreen("training"); }, [session, setScreen]);
  if (!session) return null;

  const meta = [
    session.type,
    session.coach && `Coach: ${session.coach}`,
    session.club,
    session.durationMin && `${session.durationMin} min`,
  ].filter(Boolean).join("  ·  ");

  const drills = session.drills || [];

  return (
    <Screen wide className="report-root">
      {/* Print-only heading */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-extrabold mb-1">Training session — {playerName}</h1>
        <div className="text-sm">{session.date}{meta ? `  ·  ${meta}` : ""}</div>
      </div>

      <div className="print:hidden">
        <TopBar
          title="Training session"
          subtitle={`${session.id} · ${session.date}`}
          onBack={() => setScreen("training")}
          right={<Badge tone="muted">{session.type}</Badge>}
        />
      </div>

      <Card className="mb-3 print:break-inside-avoid">
        <SectionLabel>Session</SectionLabel>
        <div className="text-sm text-neutral-100 font-bold mb-1 print:hidden">{session.date}</div>
        <div className="text-[11px] text-neutral-400 mb-2 print:hidden">{meta}</div>
        {session.focus?.trim() && (
          <div className="mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Focus: </span>
            <span className="text-sm text-neutral-100">{session.focus.trim()}</span>
          </div>
        )}
        {session.rating != null && (
          <div className="mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Overall: </span>
            <span className="text-sm text-neutral-100 font-bold">{session.rating}/5</span>
          </div>
        )}
        {session.videoUrl?.trim() && (
          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Video: </span>
            <a
              href={session.videoUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sky-300 underline break-all"
            >
              {session.videoUrl.trim()}
            </a>
          </div>
        )}
      </Card>

      {drills.length > 0 && (
        <Card className="mb-3">
          <SectionLabel>Drills ({drills.length})</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {drills.map((d, i) => {
              const cat = drillCatalog[d.drillKey] || drillCatalog[normalizeDrill(d.name)];
              const tags = [cat?.category, ...(cat?.skills || [])].filter(Boolean).join(" · ");
              const load = [d.sets && `${d.sets} sets`, d.reps].filter(Boolean).join(" × ");
              return (
                <div
                  key={`${d.drillKey}-${i}`}
                  className="p-2.5 rounded-md border-l-4 border-emerald-500 bg-emerald-950/20 print:break-inside-avoid"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="font-bold text-sm text-neutral-100">{i + 1}. {d.name}</span>
                    {load && <span className="text-[11px] text-neutral-400 font-mono">{load}</span>}
                  </div>
                  {tags && <div className="text-[11px] text-neutral-500 mt-0.5">{tags}</div>}
                  {d.note?.trim() && <div className="text-sm text-neutral-200 mt-1">{d.note.trim()}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {session.notes?.trim() && (
        <Card className="mb-3 print:break-inside-avoid">
          <SectionLabel>Notes / coach feedback</SectionLabel>
          <div className="text-sm text-neutral-100 leading-relaxed whitespace-pre-wrap">
            {session.notes.trim()}
          </div>
        </Card>
      )}

      <div className="hidden print:block text-xs mt-6 pt-2 border-t">
        Generated by Courtside · {new Date().toLocaleDateString()}
      </div>

      <div className="print:hidden">
        <BigBtn tone="info" onClick={() => window.print()}>📄 Print / save as PDF for coach</BigBtn>
        <BigBtn tone="secondary" onClick={() => { openTrainingEdit(session.id); setScreen("trainingSessionEdit"); }}>
          ✎ Edit session
        </BigBtn>
        <BigBtn tone="secondary" onClick={() => setScreen("training")}>Back</BigBtn>
      </div>
    </Screen>
  );
}
