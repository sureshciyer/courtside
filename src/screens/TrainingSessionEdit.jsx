import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, SectionLabel, Field, Select, BigBtn, Badge } from "../components/ui.jsx";
import {
  TRAINING_TYPES, DRILL_CATEGORIES, DRILL_SKILLS, TRAINING_RATING_SCALE,
  emptyTrainingSession,
} from "../constants/training.js";
import { normalizeDrill } from "../lib/training.js";

function TypeToggle({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {TRAINING_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
            value === t ? "bg-emerald-700/40 text-emerald-200 border-emerald-600"
              : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
          }`}
        >{t}</button>
      ))}
    </div>
  );
}

function SkillChips({ selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DRILL_SKILLS.map((sk) => {
        const on = selected.includes(sk);
        return (
          <button
            key={sk}
            onClick={() => onToggle(sk)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition active:scale-95 ${
              on ? "bg-sky-700/40 text-sky-200 border-sky-600"
                : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"
            }`}
          >{sk}{on && " ✓"}</button>
        );
      })}
    </div>
  );
}

function MiniRating({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</span>
        {value != null && (
          <button onClick={() => onChange(null)} className="text-[10px] text-neutral-500 hover:text-neutral-300 underline">clear</button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {TRAINING_RATING_SCALE.map((n) => {
          const active = value === n;
          return (
            <button key={n} onClick={() => onChange(active ? null : n)}
              className={`h-9 rounded-lg font-extrabold text-sm border transition active:scale-95 ${
                active ? "bg-emerald-600 border-emerald-400 text-white"
                  : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}>{n}</button>
          );
        })}
      </div>
    </div>
  );
}

// One drill row. Holds session-level fields (sets/reps/note) plus the
// drill's catalog-level tags (category/skills), which are saved back to
// the catalog on submit so they apply everywhere the drill is used.
function DrillRow({ row, index, onChange, onRemove, onExpandTags }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/60 p-2.5 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold shrink-0">#{index + 1}</span>
        <input
          value={row.name}
          onChange={(e) => onChange({ ...row, name: e.target.value })}
          list="drill-names"
          placeholder="Drill name — e.g. Net + cross-court defense"
          className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 rounded-md px-2.5 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600"
        />
        <button onClick={onRemove} className="shrink-0 w-7 h-7 rounded-md bg-neutral-900 border border-neutral-700 text-red-400 hover:bg-red-950 text-sm" aria-label="Remove drill">✕</button>
      </div>
      <div className="flex gap-2 mb-2">
        <input value={row.sets} onChange={(e) => onChange({ ...row, sets: e.target.value })} placeholder="Sets" className="w-16 bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600" />
        <input value={row.reps} onChange={(e) => onChange({ ...row, reps: e.target.value })} placeholder="Reps / time" className="w-24 bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600" />
        <input value={row.note} onChange={(e) => onChange({ ...row, note: e.target.value })} placeholder="How it went (optional)" className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600" />
      </div>
      {row.showTags ? (
        <div className="pt-1">
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Category</div>
            <Select label="" value={row.category} onChange={(v) => onChange({ ...row, category: v })} options={DRILL_CATEGORIES} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">Skills trained</div>
            <SkillChips
              selected={row.skills}
              onToggle={(sk) => onChange({ ...row, skills: row.skills.includes(sk) ? row.skills.filter((x) => x !== sk) : [...row.skills, sk] })}
            />
          </div>
        </div>
      ) : (
        <button onClick={onExpandTags} className="text-[11px] text-sky-300/90 hover:text-sky-200">
          {row.category !== "Other" || row.skills.length ? `Tags: ${[row.category, ...row.skills].filter(Boolean).join(" · ")} · edit` : "＋ Add category & skills"}
        </button>
      )}
    </div>
  );
}

export default function TrainingSessionEdit({ setScreen }) {
  const editId = useMatchStore((s) => s.trainingEditId);
  const sessions = useMatchStore((s) => s.trainingSessions);
  const drillCatalog = useMatchStore((s) => s.drillCatalog);
  const addTrainingSession = useMatchStore((s) => s.addTrainingSession);
  const updateTrainingSession = useMatchStore((s) => s.updateTrainingSession);
  const deleteTrainingSession = useMatchStore((s) => s.deleteTrainingSession);
  const ensureDrill = useMatchStore((s) => s.ensureDrill);
  const newTrainingId = useMatchStore((s) => s.newTrainingId);

  const editing = editId ? sessions.find((s) => s.id === editId) : null;
  const catalogNames = useMemo(() => Object.values(drillCatalog).map((d) => d.name), [drillCatalog]);

  // Hydrate a drill row from a session entry, pulling catalog tags in.
  const rowFromEntry = (d) => {
    const cat = drillCatalog[d.drillKey] || drillCatalog[normalizeDrill(d.name)];
    return {
      name: d.name || "", sets: d.sets || "", reps: d.reps || "", note: d.note || "",
      category: cat?.category || "Other", skills: cat?.skills || [], showTags: false,
    };
  };

  const [form, setForm] = useState(() => {
    const base = editing || emptyTrainingSession();
    return {
      date: base.date || new Date().toISOString().split("T")[0],
      type: base.type || "Private",
      coach: base.coach || "",
      club: base.club || "",
      durationMin: base.durationMin || "",
      focus: base.focus || "",
      rating: base.rating ?? null,
      videoUrl: base.videoUrl || "",
      notes: base.notes || "",
    };
  });
  const [drills, setDrills] = useState(() =>
    (editing?.drills || []).map(rowFromEntry)
  );
  const [saved, setSaved] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // When a drill name matches a known catalog drill, auto-fill its tags
  // (unless the user has already set them on this row).
  const updateDrill = (i, next) => {
    setDrills((rows) => rows.map((r, idx) => {
      if (idx !== i) return r;
      let merged = next;
      if (next.name !== r.name) {
        const cat = drillCatalog[normalizeDrill(next.name)];
        if (cat && merged.category === "Other" && merged.skills.length === 0) {
          merged = { ...merged, category: cat.category || "Other", skills: cat.skills || [] };
        }
      }
      return merged;
    }));
  };
  const addDrill = () => setDrills((r) => [...r, { name: "", sets: "", reps: "", note: "", category: "Other", skills: [], showTags: false }]);
  const removeDrill = (i) => setDrills((r) => r.filter((_, idx) => idx !== i));

  const canSave = !!(form.focus.trim() || form.notes.trim() || form.videoUrl.trim() || drills.some((d) => d.name.trim()));

  const buildDrills = () =>
    drills.filter((d) => d.name.trim()).map((d) => ({
      drillKey: normalizeDrill(d.name), name: d.name.trim(),
      sets: d.sets.trim(), reps: d.reps.trim(), note: d.note.trim(),
    }));

  const handleSave = () => {
    const payload = { ...form, durationMin: form.durationMin, drills: buildDrills() };
    if (editing) updateTrainingSession(editing.id, payload);
    else addTrainingSession(payload);
    // Persist catalog-level tags for each named drill.
    for (const d of drills.filter((x) => x.name.trim())) {
      ensureDrill(d.name, { category: d.category, skills: d.skills });
    }
    setSaved(true);
    setTimeout(() => setScreen("training"), 300);
  };

  const handleDelete = () => {
    if (!editing) return;
    if (window.confirm(`Delete this training session (${editing.date})? This cannot be undone.`)) {
      deleteTrainingSession(editing.id);
      setScreen("training");
    }
  };

  return (
    <Screen>
      <datalist id="drill-names">
        {catalogNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <TopBar
        title={editing ? "Edit session" : "Log training session"}
        subtitle={editing ? editing.id : newTrainingId()}
        onBack={() => setScreen("training")}
        right={<Badge tone="muted">{editing ? editing.id : "new"}</Badge>}
      />

      <Card className="mb-3">
        <Field label="Date" value={form.date} onChange={(v) => setField("date", v)} type="date" />
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">Type</div>
          <TypeToggle value={form.type} onChange={(v) => setField("type", v)} />
        </div>
        <Field label="Coach (optional)" value={form.coach} onChange={(v) => setField("coach", v)} placeholder="Coach name" />
        <Field label="Club / venue (optional)" value={form.club} onChange={(v) => setField("club", v)} placeholder="Where the session was" />
        <Field label="Duration in minutes (optional)" value={form.durationMin} onChange={(v) => setField("durationMin", v.replace(/[^0-9]/g, ""))} placeholder="e.g. 60" />
        <Field label="Session focus (optional)" value={form.focus} onChange={(v) => setField("focus", v)} placeholder="e.g. Backhand defense & net tightness" />
      </Card>

      <Card className="mb-3">
        <SectionLabel>Drills / sequences</SectionLabel>
        <p className="text-[11px] text-neutral-500 mb-2">
          Type a drill name — it autocompletes from past sessions so repeats are recognised. Add category & skills once per drill.
        </p>
        {drills.map((row, i) => (
          <DrillRow
            key={i}
            row={row}
            index={i}
            onChange={(next) => updateDrill(i, next)}
            onRemove={() => removeDrill(i)}
            onExpandTags={() => updateDrill(i, { ...row, showTags: true })}
          />
        ))}
        <button
          onClick={addDrill}
          className="w-full py-2 rounded-lg border border-dashed border-neutral-600 text-neutral-300 text-sm font-semibold hover:border-neutral-400 hover:bg-neutral-900 active:scale-[0.99]"
        >＋ Add drill</button>
      </Card>

      <Card className="mb-3">
        <SectionLabel>How did it go? (optional)</SectionLabel>
        <MiniRating label="Overall session rating" value={form.rating} onChange={(v) => setField("rating", v)} />
      </Card>

      <Card className="mb-3">
        <Field label="Video link (optional)" value={form.videoUrl} onChange={(v) => setField("videoUrl", v)} placeholder="YouTube / Google Drive URL" />
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">Notes / coach feedback</div>
        <textarea
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value.slice(0, 1000))}
          placeholder="What the coach said, what to work on, anything worth remembering…"
          rows={4}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 resize-y leading-relaxed"
        />
        <div className="text-[10px] text-neutral-600 mt-1 text-right">{form.notes.length}/1000</div>
      </Card>

      <BigBtn tone="primary" disabled={!canSave} onClick={handleSave}>
        {saved ? "Saved ✓" : editing ? "Save changes" : "Save session"}
      </BigBtn>
      <BigBtn tone="secondary" onClick={() => setScreen("training")}>Cancel</BigBtn>
      {editing && (
        <button onClick={handleDelete} className="w-full mt-1 py-2 rounded-lg border border-red-900 text-red-400 text-xs font-semibold hover:bg-red-950/40">
          Delete session
        </button>
      )}
    </Screen>
  );
}
