import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, Field, BigBtn } from "../components/ui.jsx";
import { MATCH_TYPES, MATCH_FORMATS } from "../constants/reflection.js";

// Quick log — record a match that was played WITHOUT rally notation
// (casual club games, sessions the parent didn't attend) so a Mode 2
// reflection can still be attached. Creates a completed match with no
// rally data and drops straight into the Reflection screen.

function ToggleRow({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
            value === opt
              ? "bg-emerald-700/40 text-emerald-200 border-emerald-600"
              : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// Up to 3 sets of numeric score inputs. Rows are optional — a row counts
// only when at least one side is non-empty.
function SetScoreInputs({ sets, onChange }) {
  const setVal = (i, side, raw) => {
    const v = raw === "" ? "" : Math.max(0, Math.min(30, parseInt(raw, 10) || 0));
    const next = sets.map((s, j) => (j === i ? { ...s, [side]: v } : s));
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {sets.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 w-8">S{i + 1}</span>
          <input
            type="number" inputMode="numeric" min="0" max="30" placeholder="—"
            value={s.son}
            onChange={(e) => setVal(i, "son", e.target.value)}
            className="w-16 px-2 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 text-center font-mono text-sm focus:outline-none focus:border-emerald-600"
          />
          <span className="text-neutral-600">–</span>
          <input
            type="number" inputMode="numeric" min="0" max="30" placeholder="—"
            value={s.opp}
            onChange={(e) => setVal(i, "opp", e.target.value)}
            className="w-16 px-2 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 text-center font-mono text-sm focus:outline-none focus:border-emerald-600"
          />
        </div>
      ))}
    </div>
  );
}

export default function QuickLog({ setScreen }) {
  const addQuickMatch = useMatchStore((s) => s.addQuickMatch);
  const openReflection = useMatchStore((s) => s.openReflection);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    opponent: "",
    matchType: "Casual Game",
    club: "",
    format: "Singles",
    result: null, // "won" | "lost" | null
  });
  const [scores, setScores] = useState([
    { son: "", opp: "" }, { son: "", opp: "" }, { son: "", opp: "" },
  ]);

  // Rows where at least one number was typed become real sets.
  const enteredSets = scores
    .filter((s) => s.son !== "" || s.opp !== "")
    .map((s) => ({ sonScore: Number(s.son) || 0, oppScore: Number(s.opp) || 0 }));
  const hasScores = enteredSets.length > 0;

  const handleSave = () => {
    const id = addQuickMatch({
      date: form.date,
      opponent: form.opponent.trim(),
      matchType: form.matchType,
      club: form.club.trim(),
      format: form.format,
      sets: hasScores ? enteredSets : undefined,
      // Explicit W/L only matters when no scores were entered.
      resultLabel: hasScores ? null : form.result,
    });
    openReflection(id, "history");
    setScreen("reflection");
  };

  return (
    <Screen>
      <TopBar
        title="Quick log"
        subtitle="No rally capture — just the match & reflection"
        onBack={() => setScreen("home")}
      />

      <Card className="mb-3">
        <Field label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
        <Field
          label="Opponent (optional)"
          value={form.opponent}
          onChange={(v) => setForm({ ...form, opponent: v })}
          placeholder='Leave blank for "Club session"'
        />
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">Match type</div>
          <ToggleRow options={MATCH_TYPES} value={form.matchType} onChange={(v) => setForm({ ...form, matchType: v })} />
        </div>
        <Field
          label="Club / venue (optional)"
          value={form.club}
          onChange={(v) => setForm({ ...form, club: v })}
          placeholder="e.g. home club, or a nearby club for sparring"
        />
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">Format</div>
          <ToggleRow options={MATCH_FORMATS} value={form.format} onChange={(v) => setForm({ ...form, format: v })} />
        </div>
      </Card>

      <Card className="mb-3">
        <SectionLabel>Score (optional)</SectionLabel>
        <SetScoreInputs sets={scores} onChange={setScores} />
        {!hasScores && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">
              …or just the result
            </div>
            <ToggleRow
              options={["won", "lost"]}
              value={form.result}
              onChange={(v) => setForm({ ...form, result: form.result === v ? null : v })}
            />
            <p className="text-[10px] text-neutral-600 mt-1.5">
              Both optional — skip entirely if nobody kept score.
            </p>
          </div>
        )}
      </Card>

      <BigBtn tone="primary" onClick={handleSave}>Save & reflect →</BigBtn>
      <BigBtn tone="secondary" onClick={() => setScreen("home")}>Cancel</BigBtn>
    </Screen>
  );
}
