import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { PLAYER_STYLES } from "../lib/rally.js";
import { MATCH_TYPES, MATCH_FORMATS } from "../constants/reflection.js";
import { CONTROLLABLES, MAX_CONTROLLABLES, BODY_READINESS, emptyPreMatch } from "../constants/prematch.js";
import { Screen, TopBar, Badge, Field, Select, SectionLabel, BigBtn, Card } from "../components/ui.jsx";

// Multi-select chip row with an optional pick cap (process goals).
function ChipRow({ options, selected, onToggle, max, tone = "sky" }) {
  const on = tone === "sky"
    ? "bg-sky-700/40 text-sky-200 border-sky-600"
    : "bg-emerald-700/40 text-emerald-200 border-emerald-600";
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const sel = selected.includes(opt);
        const capped = max != null && !sel && selected.length >= max;
        return (
          <button
            key={opt}
            onClick={() => !capped && onToggle(opt)}
            disabled={capped}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
              sel ? on
                : capped ? "bg-neutral-900 text-neutral-700 border-neutral-800"
                : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
            }`}
          >
            {opt}{sel && " ✓"}
          </button>
        );
      })}
    </div>
  );
}

// Single-select chip row (body readiness) — tap again to clear.
function SingleChipRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const sel = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(sel ? null : opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
              sel ? "bg-emerald-700/40 text-emerald-200 border-emerald-600"
                : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Compact 1–5 tap rating for confidence / nerves.
function MiniRating({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-neutral-200">{label}</span>
        {value != null && (
          <button onClick={() => onChange(null)} className="text-[10px] text-neutral-500 hover:text-neutral-300 underline">clear</button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(active ? null : n)}
              className={`h-9 rounded-lg font-extrabold text-sm tabular-nums border transition active:scale-95 ${
                active ? "bg-sky-600 border-sky-400 text-white"
                       : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >{n}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function Setup({ setScreen }) {
  const newMatchId = useMatchStore((s) => s.newMatchId);
  const startMatch = useMatchStore((s) => s.startMatch);
  const opponents = useMatchStore((s) => s.opponents) || {};
  const nextId = newMatchId();

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    opponent: "",
    tournament: "",
    playerStyle: "Unknown",
    matchType: "Casual Game",
    club: "",
    format: "Singles",
  });
  const [pre, setPre] = useState(() => emptyPreMatch());

  const isTournament = form.matchType === "Tournament";
  const canStart = !!form.opponent;

  // Show any existing scouting notes for this opponent as a reference while
  // writing the game plan (doesn't auto-fill — the plan is the player's own).
  const dossier = opponents[(form.opponent || "").trim().toLowerCase()];
  const scoutRef = dossier && (dossier.notes?.trim() || dossier.aiInsights?.trim());

  const setPreField = (k, v) => setPre((p) => ({ ...p, [k]: v }));
  const toggleControllable = (opt) =>
    setPre((p) => ({
      ...p,
      controllables: p.controllables.includes(opt)
        ? p.controllables.filter((x) => x !== opt)
        : [...p.controllables, opt],
    }));

  const handleStart = () => {
    // Attach a pre-match plan only for tournaments, and only if something
    // was filled — keeps casual matches clean.
    const anyPre = isTournament && (
      pre.gamePlan.trim() || pre.controllables.length || pre.planB.trim() ||
      pre.focusWord.trim() || pre.confidence != null || pre.nerves != null ||
      pre.bodyReadiness != null || pre.bodyNote.trim()
    );
    const setup = anyPre
      ? { ...form, preMatch: { ...pre, createdAt: Date.now() } }
      : form;
    startMatch(setup);
    setScreen("capture");
  };

  return (
    <Screen>
      <TopBar title="New match" subtitle="Capture opponent context up front" onBack={() => setScreen("home")} />

      <Card className="mb-3">
        <div className="flex items-center justify-between mb-4">
          <Badge>{nextId}</Badge>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Match ID</span>
        </div>

        <Field label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
        <Field label="Opponent" value={form.opponent} onChange={(v) => setForm({ ...form, opponent: v })} placeholder="Name or initials" />
        <Select
          label="Match type"
          value={form.matchType}
          onChange={(v) => setForm({ ...form, matchType: v })}
          options={MATCH_TYPES}
        />
        <Field
          label="Club / venue (optional)"
          value={form.club}
          onChange={(v) => setForm({ ...form, club: v })}
          placeholder="e.g. home club, or a nearby club for sparring"
        />
        <Select
          label="Format"
          value={form.format}
          onChange={(v) => setForm({ ...form, format: v })}
          options={MATCH_FORMATS}
        />
        <Field label="Tournament / Stage" value={form.tournament} onChange={(v) => setForm({ ...form, tournament: v })} placeholder="e.g. State U13 QF" />
        <Select
          label="Opponent style"
          value={form.playerStyle}
          onChange={(v) => setForm({ ...form, playerStyle: v })}
          options={PLAYER_STYLES}
        />
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          Opponent style is used later to filter tactical patterns. Pick what feels closest — you can update it after the match.
        </p>
      </Card>

      {/* Pre-match prep — tournaments only. Sets the intention the post-match
          reflection later grades ("did you stick to the plan?"). */}
      {isTournament && (
        <Card tone="accent" className="mb-3">
          <SectionLabel>🎯 Pre-match prep (tournament)</SectionLabel>
          <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
            Two minutes before you walk on. All optional — but a clear plan beats a blank mind.
          </p>

          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-semibold">
              Game plan — my 2–3 priorities vs {form.opponent || "this opponent"}
            </div>
            {scoutRef && (
              <div className="mb-1.5 p-2 rounded-lg bg-neutral-900/70 border border-neutral-700">
                <div className="text-[9px] uppercase tracking-wider text-sky-400 font-semibold mb-0.5">From your scouting notes</div>
                <div className="text-[11px] text-neutral-400 leading-relaxed whitespace-pre-wrap line-clamp-4">{scoutRef}</div>
              </div>
            )}
            <textarea
              value={pre.gamePlan}
              onChange={(e) => setPreField("gamePlan", e.target.value.slice(0, 240))}
              placeholder="e.g. Attack his backhand corner · keep net shots tight · stay patient, don't rush the kill"
              maxLength={240}
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 resize-y leading-relaxed"
            />
            <div className="text-[10px] text-neutral-600 mt-0.5 text-right">{pre.gamePlan.length}/240</div>
          </div>

          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-semibold">
              What's in my control today · pick up to {MAX_CONTROLLABLES}
            </div>
            <ChipRow options={CONTROLLABLES} selected={pre.controllables} onToggle={toggleControllable} max={MAX_CONTROLLABLES} />
          </div>

          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-semibold">If it's not going well, my Plan B is…</div>
            <input
              value={pre.planB}
              onChange={(e) => setPreField("planB", e.target.value.slice(0, 140))}
              placeholder="e.g. Slow it down and lift high to the back corners"
              maxLength={140}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-semibold">My focus word for the big points</div>
            <input
              value={pre.focusWord}
              onChange={(e) => setPreField("focusWord", e.target.value.slice(0, 24))}
              placeholder="e.g. Fight · Low · Next"
              maxLength={24}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="mb-3">
            <MiniRating label="Confidence right now" value={pre.confidence} onChange={(v) => setPreField("confidence", v)} />
            <MiniRating label="Nerves right now" value={pre.nerves} onChange={(v) => setPreField("nerves", v)} />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1.5 font-semibold">Body check</div>
            <SingleChipRow options={BODY_READINESS} value={pre.bodyReadiness} onChange={(v) => setPreField("bodyReadiness", v)} />
            <input
              value={pre.bodyNote}
              onChange={(e) => setPreField("bodyNote", e.target.value.slice(0, 100))}
              placeholder="Any niggle / note (optional)"
              maxLength={100}
              className="w-full mt-2 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </Card>
      )}

      <BigBtn tone="primary" disabled={!canStart} onClick={handleStart}>
        Start match →
      </BigBtn>
      {!canStart && (
        <p className="text-[11px] text-center text-amber-400/80 mt-1">Opponent name is required</p>
      )}
    </Screen>
  );
}
