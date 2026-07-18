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
  emptyReflection,
} from "../constants/reflection.js";

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

  return (
    <Screen>
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
      <BigBtn tone="secondary" onClick={() => setScreen(reflectReturn)}>Cancel</BigBtn>
    </Screen>
  );
}
