import { useEffect, useMemo } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, BigBtn } from "../components/ui.jsx";
import { REFLECTION_RATINGS, hasReflection } from "../constants/reflection.js";
import { hasPreMatch } from "../constants/prematch.js";

// All pre- + post-match reflections against ONE opponent, stacked by date on
// a single page. Rendered under .report-root so the print CSS in index.css
// auto-converts this dark view into a clean light PDF for the coach — no
// separate print markup needed (same approach as the Report screen).

const normalize = (s) => (s || "").trim().toLowerCase();

// Won/Lost for a match, tolerating quick logs with only a resultLabel.
const didWin = (m) => {
  if (m.quickLog && m.resultLabel) return m.resultLabel === "won";
  const setsWon = (m.sets || []).filter((s) => s.sonScore > s.oppScore).length;
  return setsWon > (m.sets || []).length / 2;
};

const scoreLine = (m) => {
  if (m.quickLog && !(m.sets || []).some((s) => s.sonScore || s.oppScore)) {
    return m.resultLabel ? m.resultLabel.toUpperCase() : "—";
  }
  return (m.sets || []).map((s) => `${s.sonScore}-${s.oppScore}`).join("  ·  ");
};

function Line({ label, children }) {
  return (
    <div className="mb-1.5">
      <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}: </span>
      <span className="text-sm text-neutral-100 leading-relaxed whitespace-pre-wrap">{children}</span>
    </div>
  );
}

function PreBlock({ pre, stuckToPlan }) {
  const state = [
    pre.confidence != null ? `confidence ${pre.confidence}/5` : null,
    pre.nerves != null ? `nerves ${pre.nerves}/5` : null,
  ].filter(Boolean).join(" · ");
  const body = [pre.bodyReadiness, pre.bodyNote?.trim()].filter(Boolean).join(" — ");
  return (
    <div className="mt-2 pt-2 border-t border-neutral-800">
      <div className="text-[10px] uppercase tracking-[0.18em] text-sky-400 font-semibold mb-1.5">🎯 Pre-match plan</div>
      {pre.gamePlan?.trim() && <Line label="Game plan">{pre.gamePlan.trim()}</Line>}
      {(pre.controllables || []).length > 0 && <Line label="Controllables">{pre.controllables.join(", ")}</Line>}
      {pre.planB?.trim() && <Line label="Plan B">{pre.planB.trim()}</Line>}
      {pre.focusWord?.trim() && <Line label="Focus word">{pre.focusWord.trim()}</Line>}
      {state && <Line label="Pre-match state">{state}</Line>}
      {body && <Line label="Body check">{body}</Line>}
      {stuckToPlan != null && <Line label="Stuck to the plan">{stuckToPlan}/5</Line>}
    </div>
  );
}

function PostBlock({ r }) {
  const ratings = REFLECTION_RATINGS.filter((x) => r.ratings?.[x.key] != null);
  const errorNotes = Object.entries(r.errorNotes || {}).filter(([, t]) => t?.trim());
  return (
    <div className="mt-2 pt-2 border-t border-neutral-800">
      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-semibold mb-1.5">📝 Post-match reflection</div>
      {ratings.length > 0 && (
        <div className="mb-1.5">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Self-ratings: </span>
          <span className="text-sm text-neutral-100">
            {ratings.map((x) => `${x.label} ${r.ratings[x.key]}/5`).join("  ·  ")}
          </span>
        </div>
      )}
      {(r.styleTags || []).length > 0 && <Line label="Playing style">{r.styleTags.join(", ")}</Line>}
      {(r.strengths || []).length > 0 && <Line label="What worked">{r.strengths.join(", ")}</Line>}
      {(r.weaknesses || []).length > 0 && <Line label="To improve">{r.weaknesses.join(", ")}</Line>}
      {(r.feelings || []).length > 0 && <Line label="Feelings">{r.feelings.join(", ")}</Line>}
      {r.bigPointMindset && <Line label="At big points">{r.bigPointMindset}</Line>}
      {r.selfTalk?.trim() && <Line label="Tough moments">{r.selfTalk.trim()}</Line>}
      {errorNotes.length > 0 && (
        <div className="mb-1.5">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Error notes: </span>
          <span className="text-sm text-neutral-100">
            {errorNotes.map(([topic, t]) => `${topic} — ${t.trim()}`).join("; ")}
          </span>
        </div>
      )}
      {r.notes?.trim() && <Line label="Other observations">{r.notes.trim()}</Line>}
      {r.focusNext?.trim() && <Line label="Focus for next match">{r.focusNext.trim()}</Line>}
    </div>
  );
}

export default function OpponentReflections({ setScreen }) {
  const name = useMatchStore((s) => s.opponentTimelineName);
  const matches = useMatchStore((s) => s.matches);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";

  // Every match vs this opponent that carries a plan and/or a reflection,
  // newest first (consistent with History / Past encounters).
  const entries = useMemo(() => {
    const key = normalize(name);
    return matches
      .filter((m) => normalize(m.opponent) === key)
      .filter((m) => hasReflection(m) || hasPreMatch(m))
      .slice()
      .reverse();
  }, [matches, name]);

  const missing = useMemo(() => {
    const key = normalize(name);
    return matches.filter((m) => normalize(m.opponent) === key && !hasReflection(m) && !hasPreMatch(m)).length;
  }, [matches, name]);

  useEffect(() => { if (!name) setScreen("scouting"); }, [name, setScreen]);
  if (!name) return null;

  return (
    <Screen wide className="report-root">
      {/* Print-only heading */}
      <h1 className="hidden print:block text-2xl font-extrabold mb-3">
        Reflections — {playerName} vs {name}
      </h1>

      <div className="print:hidden">
        <TopBar
          title={`Reflections vs ${name}`}
          subtitle={`${entries.length} reflected match${entries.length !== 1 ? "es" : ""}${missing ? ` · ${missing} without a reflection` : ""}`}
          onBack={() => setScreen("scouting")}
        />
      </div>

      {entries.length === 0 ? (
        <Card className="text-center py-8 print:hidden">
          <div className="text-3xl mb-2">📖</div>
          <div className="text-sm text-neutral-400">No pre- or post-match reflections recorded against {name} yet.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((m) => (
            <Card key={m.id} className="print:break-inside-avoid">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <SectionLabel>{m.date || "—"} · {[m.matchType, m.format, m.club].filter(Boolean).join(" · ")}</SectionLabel>
                <span className={`text-xs font-mono font-bold ${didWin(m) ? "text-emerald-400" : "text-red-400"}`}>
                  {didWin(m) ? "WON" : "LOST"} {scoreLine(m)}
                </span>
              </div>
              {m.tournament && <div className="text-[11px] text-sky-300/80 -mt-1 mb-1">{m.tournament}</div>}

              {hasPreMatch(m) && <PreBlock pre={m.preMatch} stuckToPlan={m.reflection?.stuckToPlan} />}
              {hasReflection(m) && <PostBlock r={m.reflection} />}
            </Card>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="print:hidden mt-3">
          <BigBtn tone="info" onClick={() => window.print()}>📄 Print / save as PDF for coach</BigBtn>
          <BigBtn tone="secondary" onClick={() => setScreen("scouting")}>Back</BigBtn>
        </div>
      )}
    </Screen>
  );
}
