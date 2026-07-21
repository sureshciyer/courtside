import { useEffect, useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, BigBtn, Badge } from "../components/ui.jsx";
import {
  REFLECTION_RATINGS,
  RATING_SCALE,
  RATING_ANCHORS,
  STYLE_TAGS,
  SKILL_AREAS,
  MAX_PICKS,
  ERROR_TOPICS,
  FEELING_TAGS,
  BIG_POINT_MINDSETS,
  emptyReflection,
} from "../constants/reflection.js";
import { hasPreMatch } from "../constants/prematch.js";

// One tappable 1–5 rating row. Big touch targets — this is filled
// courtside on a phone, often by a 10-year-old.
function RatingRow({ label, hint, value, onChange }) {
  return (
    <div className="py-2.5 border-b border-neutral-800 last:border-b-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-sm font-bold text-neutral-100">{label}</div>
        {value != null && (
          <button
            onClick={() => onChange(null)}
            className="text-[10px] text-neutral-500 hover:text-neutral-300 underline"
          >
            clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {RATING_SCALE.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(active ? null : n)}
              className={`h-11 rounded-lg font-extrabold text-base tabular-nums border transition active:scale-95 ${
                active
                  ? n <= 2
                    ? "bg-red-700 border-red-500 text-white"
                    : n === 3
                    ? "bg-amber-600 border-amber-400 text-white"
                    : "bg-emerald-600 border-emerald-400 text-white"
                  : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[9px] uppercase tracking-wider text-neutral-600">{RATING_ANCHORS[1]}</span>
        <span className="text-[9px] uppercase tracking-wider text-neutral-600">{RATING_ANCHORS[3]}</span>
        <span className="text-[9px] uppercase tracking-wider text-neutral-600">{RATING_ANCHORS[5]}</span>
      </div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{hint}</div>
    </div>
  );
}

// Multi-select chip group with an optional pick cap.
function ChipGroup({ options, selected, onToggle, max }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = selected.includes(opt);
        const capped = max != null && !on && selected.length >= max;
        return (
          <button
            key={opt}
            onClick={() => !capped && onToggle(opt)}
            disabled={capped}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
              on
                ? "bg-emerald-700/40 text-emerald-200 border-emerald-600"
                : capped
                ? "bg-neutral-900 text-neutral-700 border-neutral-800"
                : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
            }`}
          >
            {opt}
            {on && " ✓"}
          </button>
        );
      })}
    </div>
  );
}

// Single-select chip row — tap again to deselect.
function SingleChipRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(on ? null : opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
              on
                ? "bg-sky-700/40 text-sky-200 border-sky-600"
                : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
            }`}
          >
            {opt}
            {on && " ✓"}
          </button>
        );
      })}
    </div>
  );
}

// Per-topic error commentary. Tapping a topic chip reveals a one-line
// input under it; clearing the text removes the topic from the draft.
function ErrorNoteRows({ value, onChange }) {
  const [open, setOpen] = useState(() =>
    ERROR_TOPICS.filter((t) => value[t]?.trim())
  );
  const toggle = (topic) => {
    if (open.includes(topic)) {
      setOpen(open.filter((t) => t !== topic));
      const rest = { ...value };
      delete rest[topic];
      onChange(rest);
    } else {
      setOpen([...open, topic]);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {ERROR_TOPICS.map((topic) => {
          const on = open.includes(topic);
          return (
            <button
              key={topic}
              onClick={() => toggle(topic)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
                on
                  ? "bg-amber-700/40 text-amber-200 border-amber-600"
                  : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
              }`}
            >
              {topic}
              {on && " ✓"}
            </button>
          );
        })}
      </div>
      {open.map((topic) => (
        <div key={topic} className="mb-2">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">{topic}</div>
          <input
            value={value[topic] || ""}
            onChange={(e) => onChange({ ...value, [topic]: e.target.value.slice(0, 140) })}
            placeholder="What happened? e.g. 3 serves into the net in set 2"
            maxLength={140}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-600"
          />
        </div>
      ))}
    </div>
  );
}

// Clean, light, A4-friendly rendering of the reflection for the coach.
// Hidden on screen; becomes the whole page in print (index.css hides the
// form via .print:hidden and this block uses hidden print:block).
function ReflectionPrintView({ match, draft, playerName }) {
  const rated = REFLECTION_RATINGS.filter((r) => draft.ratings[r.key] != null);
  const errorNotes = ERROR_TOPICS.filter((t) => draft.errorNotes?.[t]?.trim());
  const scoreLine = match.quickLog && !match.sets.some((s) => s.sonScore || s.oppScore)
    ? (match.resultLabel ? `Result: ${match.resultLabel}` : null)
    : match.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join("  ·  ");
  const contextLine = [
    match.date,
    `vs ${match.opponent}`,
    match.matchType,
    match.club,
    match.format,
  ].filter(Boolean).join("  ·  ");

  return (
    <div className="hidden print:block">
      <h1 className="text-2xl font-extrabold mb-1">Post-match reflection — {playerName}</h1>
      <div className="text-sm mb-1">{contextLine}</div>
      {scoreLine && <div className="text-sm font-mono mb-4">Score: {scoreLine}</div>}

      {hasPreMatch(match) && (
        <div className="text-sm mb-4 pb-3 border-b">
          <div className="font-bold mb-1">Pre-match game plan</div>
          {match.preMatch.gamePlan?.trim() && <p className="mb-1 whitespace-pre-wrap">{match.preMatch.gamePlan.trim()}</p>}
          {(match.preMatch.controllables || []).length > 0 && (
            <p className="mb-1"><b>Focus:</b> {match.preMatch.controllables.join(", ")}</p>
          )}
          {match.preMatch.planB?.trim() && <p className="mb-1"><b>Plan B:</b> {match.preMatch.planB.trim()}</p>}
          {match.preMatch.focusWord?.trim() && <p className="mb-1"><b>Focus word:</b> {match.preMatch.focusWord.trim()}</p>}
          {draft.stuckToPlan != null && <p className="mb-0"><b>Stuck to the plan:</b> {draft.stuckToPlan} / 5</p>}
        </div>
      )}

      {rated.length > 0 && (
        <table className="w-full text-sm mb-4 border-collapse">
          <thead>
            <tr>
              <th className="text-left border-b py-1 pr-2">How it felt (self-rating)</th>
              <th className="text-right border-b py-1">1–5</th>
            </tr>
          </thead>
          <tbody>
            {rated.map((r) => (
              <tr key={r.key}>
                <td className="py-1 pr-2 border-b">{r.label}</td>
                <td className="py-1 text-right font-bold border-b">{draft.ratings[r.key]} / 5</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {draft.styleTags.length > 0 && (
        <p className="text-sm mb-2"><b>Playing style this match:</b> {draft.styleTags.join(", ")}</p>
      )}
      {draft.strengths.length > 0 && (
        <p className="text-sm mb-2"><b>What worked:</b> {draft.strengths.join(", ")}</p>
      )}
      {draft.weaknesses.length > 0 && (
        <p className="text-sm mb-2"><b>To improve:</b> {draft.weaknesses.join(", ")}</p>
      )}

      {(draft.feelings || []).length > 0 && (
        <p className="text-sm mb-2"><b>Feelings after the match:</b> {draft.feelings.join(", ")}</p>
      )}
      {draft.bigPointMindset && (
        <p className="text-sm mb-2"><b>At the big points:</b> {draft.bigPointMindset}</p>
      )}
      {draft.selfTalk?.trim() && (
        <p className="text-sm mb-2"><b>Tough moments (own words):</b> {draft.selfTalk.trim()}</p>
      )}

      {errorNotes.length > 0 && (
        <div className="text-sm mb-2">
          <b>Error notes:</b>
          <ul className="list-disc ml-5 mt-1">
            {errorNotes.map((t) => (
              <li key={t} className="mb-0.5"><b>{t}:</b> {draft.errorNotes[t].trim()}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.notes?.trim() && (
        <p className="text-sm mb-2"><b>Other observations:</b> {draft.notes.trim()}</p>
      )}
      {draft.focusNext?.trim() && (
        <p className="text-sm mb-2"><b>Focus for next match:</b> {draft.focusNext.trim()}</p>
      )}

      <div className="text-xs mt-6 pt-2 border-t">
        Generated by Courtside · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

export default function Reflection({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const reflectTargetId = useMatchStore((s) => s.reflectTargetId);
  const reflectReturn = useMatchStore((s) => s.reflectReturn) || "summary";
  const saveReflection = useMatchStore((s) => s.saveReflection);
  const playerName = useMatchStore((s) => s.settings?.playerName) || "Player";

  // Target match: explicit id if set, otherwise the latest completed match.
  const match = useMemo(() => {
    if (reflectTargetId) return matches.find((m) => m.id === reflectTargetId) || null;
    return matches[matches.length - 1] || null;
  }, [matches, reflectTargetId]);

  const [draft, setDraft] = useState(() => ({
    ...emptyReflection(),
    ...(match?.reflection || {}),
    ratings: { ...emptyReflection().ratings, ...(match?.reflection?.ratings || {}) },
  }));
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!match) setScreen("home"); }, [match, setScreen]);
  if (!match) return null;

  const setRating = (key, v) =>
    setDraft((d) => ({ ...d, ratings: { ...d.ratings, [key]: v } }));

  const toggleIn = (field) => (opt) =>
    setDraft((d) => ({
      ...d,
      [field]: d[field].includes(opt)
        ? d[field].filter((x) => x !== opt)
        : [...d[field], opt],
    }));

  const ratedCount = Object.values(draft.ratings).filter((v) => v != null).length;

  const handleSave = () => {
    saveReflection(match.id, draft);
    setSaved(true);
    setTimeout(() => setScreen(reflectReturn), 350);
  };

  // Save first, then hand off to the browser's print dialog — on a phone
  // that's where "Save as PDF" / share-to-WhatsApp lives.
  const handlePdf = () => {
    saveReflection(match.id, draft);
    setSaved(true);
    window.print();
  };

  return (
    <Screen className="report-root">
      <ReflectionPrintView match={match} draft={draft} playerName={playerName} />
      <div className="print:hidden">
      <TopBar
        title="Player reflection"
        subtitle={`${match.id} · vs ${match.opponent}`}
        onBack={() => setScreen(reflectReturn)}
        right={<Badge tone="muted">{ratedCount}/{REFLECTION_RATINGS.length}</Badge>}
      />

      <p className="text-[11px] text-neutral-500 leading-relaxed mb-2 px-1">
        {playerName}'s own read on the match — 2 minutes, all taps. This feeds the
        Reflection trends view and the Markdown export for AI critique.
      </p>

      {/* Pre→post loop: only when a tournament pre-match plan exists. Shows
          the plan and asks the player to grade how well they stuck to it. */}
      {hasPreMatch(match) && (
        <Card tone="accent" className="mb-3">
          <SectionLabel>🎯 Your pre-match game plan</SectionLabel>
          {match.preMatch.gamePlan?.trim() && (
            <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap mb-2">
              {match.preMatch.gamePlan.trim()}
            </div>
          )}
          {(match.preMatch.controllables || []).length > 0 && (
            <div className="text-[11px] text-neutral-400 mb-1">
              <span className="text-neutral-500">Focus: </span>{match.preMatch.controllables.join(" · ")}
            </div>
          )}
          {match.preMatch.planB?.trim() && (
            <div className="text-[11px] text-neutral-400 mb-2">
              <span className="text-neutral-500">Plan B: </span>{match.preMatch.planB.trim()}
            </div>
          )}
          <div className="pt-2 border-t border-neutral-800">
            <RatingRow
              label="Did you stick to your plan?"
              hint="1 = forgot it completely · 5 = executed it all match"
              value={draft.stuckToPlan}
              onChange={(v) => setDraft((d) => ({ ...d, stuckToPlan: v }))}
            />
          </div>
        </Card>
      )}

      <Card className="mb-3">
        <SectionLabel>Rate 1–5 · how did it feel today?</SectionLabel>
        {REFLECTION_RATINGS.map((r) => (
          <RatingRow
            key={r.key}
            label={r.label}
            hint={r.hint}
            value={draft.ratings[r.key]}
            onChange={(v) => setRating(r.key, v)}
          />
        ))}
      </Card>

      <Card className="mb-3">
        <SectionLabel>Playing style this match</SectionLabel>
        <p className="text-[11px] text-neutral-500 mb-2">Pick every tag that fits how the match was actually played.</p>
        <ChipGroup options={STYLE_TAGS} selected={draft.styleTags} onToggle={toggleIn("styleTags")} />
      </Card>

      <Card className="mb-3">
        <SectionLabel>What worked · pick up to {MAX_PICKS}</SectionLabel>
        <ChipGroup options={SKILL_AREAS} selected={draft.strengths} onToggle={toggleIn("strengths")} max={MAX_PICKS} />
      </Card>

      <Card className="mb-3">
        <SectionLabel>What to improve · pick up to {MAX_PICKS}</SectionLabel>
        <ChipGroup options={SKILL_AREAS} selected={draft.weaknesses} onToggle={toggleIn("weaknesses")} max={MAX_PICKS} />
      </Card>

      <Card className="mb-3">
        <SectionLabel>Feelings check — how do you feel right now?</SectionLabel>
        <p className="text-[11px] text-neutral-500 mb-2">Pick every word that fits. There are no wrong answers.</p>
        <ChipGroup options={FEELING_TAGS} selected={draft.feelings || []} onToggle={toggleIn("feelings")} />
      </Card>

      <Card className="mb-3">
        <SectionLabel>At the big points, I mostly felt…</SectionLabel>
        <p className="text-[11px] text-neutral-500 mb-2">Game points, deciders, long losing runs — pick the one closest.</p>
        <SingleChipRow
          options={BIG_POINT_MINDSETS}
          value={draft.bigPointMindset}
          onChange={(v) => setDraft((d) => ({ ...d, bigPointMindset: v }))}
        />
      </Card>

      <Card className="mb-3">
        <SectionLabel>Tough moments (optional)</SectionLabel>
        <p className="text-[11px] text-neutral-500 mb-2">
          When you kept losing points or couldn't find a way to attack — what were you feeling or telling yourself?
        </p>
        <textarea
          value={draft.selfTalk || ""}
          onChange={(e) => setDraft((d) => ({ ...d, selfTalk: e.target.value.slice(0, 200) }))}
          placeholder='e.g. "Nothing was working, I just kept smashing harder"'
          maxLength={200}
          rows={2}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-sky-600 resize-y leading-relaxed"
        />
        <div className="text-[10px] text-neutral-600 mt-1 text-right">{(draft.selfTalk || "").length}/200</div>
      </Card>

      <Card className="mb-3">
        <SectionLabel>Errors worth a comment (optional)</SectionLabel>
        <p className="text-[11px] text-neutral-500 mb-2">
          Tap a category to add a short note — e.g. serve errors at game points, easy lifts hit out.
        </p>
        <ErrorNoteRows
          value={draft.errorNotes || {}}
          onChange={(errorNotes) => setDraft((d) => ({ ...d, errorNotes }))}
        />
      </Card>

      <Card className="mb-3">
        <SectionLabel>Anything else? (optional)</SectionLabel>
        <textarea
          value={draft.notes || ""}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value.slice(0, 500) }))}
          placeholder="Anything the form didn't ask — how the opponent played, conditions, injuries, what the coach should know…"
          maxLength={500}
          rows={4}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 resize-y leading-relaxed"
        />
        <div className="text-[10px] text-neutral-600 mt-1 text-right">{(draft.notes || "").length}/500</div>
      </Card>

      <Card className="mb-3">
        <SectionLabel>One focus for next match (optional)</SectionLabel>
        <input
          value={draft.focusNext}
          onChange={(e) => setDraft((d) => ({ ...d, focusNext: e.target.value.slice(0, 80) }))}
          placeholder="e.g. Tighter spinning net shots"
          maxLength={80}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600"
        />
        <div className="text-[10px] text-neutral-600 mt-1 text-right">{draft.focusNext.length}/80</div>
      </Card>

      <BigBtn tone="primary" onClick={handleSave}>
        {saved ? "Saved ✓" : "Save reflection"}
      </BigBtn>
      <BigBtn tone="info" onClick={handlePdf}>📄 Save as PDF / send to coach</BigBtn>
      <BigBtn tone="secondary" onClick={() => setScreen(reflectReturn)}>Cancel</BigBtn>
      </div>
    </Screen>
  );
}
