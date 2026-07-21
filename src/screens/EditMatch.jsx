import { useEffect, useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, Field, BigBtn, Badge } from "../components/ui.jsx";
import { MATCH_TYPES, MATCH_FORMATS } from "../constants/reflection.js";

// Edit the details of a COMPLETED match — opponent, club, match type,
// date, tournament. Quick-logged matches (no rally data) can also edit
// their set scores / result; captured matches keep scores derived from
// rallies, so those are shown read-only with a pointer to Reopen.

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

function SetScoreInputs({ sets, onChange }) {
  const setVal = (i, side, raw) => {
    const v = raw === "" ? "" : Math.max(0, Math.min(30, parseInt(raw, 10) || 0));
    onChange(sets.map((s, j) => (j === i ? { ...s, [side]: v } : s)));
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

export default function EditMatch({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const editTargetId = useMatchStore((s) => s.editTargetId);
  const updateArchivedMatch = useMatchStore((s) => s.updateArchivedMatch);

  const match = useMemo(
    () => matches.find((m) => m.id === editTargetId) || null,
    [matches, editTargetId]
  );

  const [form, setForm] = useState(() => ({
    date: match?.date || "",
    opponent: match?.opponent || "",
    tournament: match?.tournament || "",
    matchType: match?.matchType || "Casual Game",
    club: match?.club || "",
    format: match?.format || "Singles",
    result: match?.resultLabel || null,
  }));
  // Quick-log score rows. An all-zero single set on an unscored quick log
  // is the placeholder addQuickMatch stores — show blanks instead.
  const [scores, setScores] = useState(() => {
    const stored = (match?.sets || []).map((s) => ({ son: String(s.sonScore), opp: String(s.oppScore) }));
    const isPlaceholder = match?.quickLog
      && stored.length === 1 && stored[0].son === "0" && stored[0].opp === "0";
    const rows = isPlaceholder ? [] : stored;
    while (rows.length < 3) rows.push({ son: "", opp: "" });
    return rows.slice(0, 3);
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!match) setScreen("history"); }, [match, setScreen]);
  if (!match) return null;

  const enteredSets = scores
    .filter((s) => s.son !== "" || s.opp !== "")
    .map((s) => ({ sonScore: Number(s.son) || 0, oppScore: Number(s.opp) || 0 }));
  const hasScores = enteredSets.length > 0;

  const handleSave = () => {
    const patch = {
      date: form.date,
      opponent: form.opponent.trim() || (match.quickLog ? "Club session" : match.opponent),
      tournament: form.tournament.trim(),
      matchType: form.matchType,
      club: form.club.trim(),
      format: form.format,
    };
    if (match.quickLog) {
      const sets = hasScores ? enteredSets : [{ sonScore: 0, oppScore: 0 }];
      patch.sets = sets;
      patch.currentSet = sets.length - 1;
      patch.resultLabel = hasScores ? null : form.result;
    }
    updateArchivedMatch(match.id, patch);
    setSaved(true);
    setTimeout(() => setScreen("history"), 350);
  };

  return (
    <Screen>
      <TopBar
        title="Edit match details"
        subtitle={`${match.id} · ${match.quickLog ? "Quick log" : `${match.rallies.length} rallies captured`}`}
        onBack={() => setScreen("history")}
        right={<Badge tone="muted">{match.id}</Badge>}
      />

      <Card className="mb-3">
        <Field label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
        <Field
          label={match.quickLog ? "Opponent (optional)" : "Opponent"}
          value={form.opponent}
          onChange={(v) => setForm({ ...form, opponent: v })}
          placeholder={match.quickLog ? 'Leave blank for "Club session"' : "Name or initials"}
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
        <Field
          label="Tournament / Stage (optional)"
          value={form.tournament}
          onChange={(v) => setForm({ ...form, tournament: v })}
          placeholder="e.g. State U13 QF"
        />
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">Format</div>
          <ToggleRow options={MATCH_FORMATS} value={form.format} onChange={(v) => setForm({ ...form, format: v })} />
        </div>
      </Card>

      {match.quickLog ? (
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
            </div>
          )}
        </Card>
      ) : (
        <Card className="mb-3">
          <SectionLabel>Score</SectionLabel>
          <div className="font-mono text-sm text-neutral-300 mb-1">
            {match.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join("  ·  ")}
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Scores on a captured match come from its rallies. To change them,
            use ↻ Reopen in Match history and correct the rallies there.
          </p>
        </Card>
      )}

      <BigBtn tone="primary" onClick={handleSave}>
        {saved ? "Saved ✓" : "Save changes"}
      </BigBtn>
      <BigBtn tone="secondary" onClick={() => setScreen("history")}>Cancel</BigBtn>
    </Screen>
  );
}
