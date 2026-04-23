import { useState } from "react";
import { useMatchStore } from "../../store/useMatchStore.js";
import { cycleGrip, cycleDirection } from "../../lib/rally.js";
import { SHOT_CODES } from "../../constants/badminton.js";

// Bottom-sheet drawer that lists finished rallies. Each row can be expanded
// to edit the rally in place — flip winner, change result, delete shots or
// the whole rally. Score corrections cascade automatically.

const ROLE_CHIP = {
  opening:    "bg-sky-950/50 border-sky-800 text-sky-200",
  neutral:    "bg-neutral-900 border-neutral-700 text-neutral-300",
  disruption: "bg-amber-950/50 border-amber-700 text-amber-200",
  finish:     "bg-red-950/50 border-red-700 text-red-200",
};

const RESULT_LABEL = { W: "Winner", FE: "Forced err", UE: "Unforced err" };
const RESULT_OPTS = [
  { code: "W",  label: "Winner",     tone: "bg-emerald-700 text-white border-emerald-500" },
  { code: "FE", label: "Forced err", tone: "bg-orange-700 text-white border-orange-500" },
  { code: "UE", label: "Unforced",   tone: "bg-red-700 text-white border-red-500" },
];
const QUALITY_CYCLE = { Effective: "Neutral", Neutral: "Ineffective", Ineffective: "Effective", null: "Effective" };
const QUALITY_DOT = { Effective: "bg-emerald-400", Neutral: "bg-slate-400", Ineffective: "bg-red-400" };

const SERVE_CODES = new Set(SHOT_CODES.serve.map((s) => s.code));

export default function RallyLogSheet({ rallies, currentSet, onClose }) {
  const [expanded, setExpanded] = useState(null); // index into `rallies` that's open for editing
  const [showAll, setShowAll] = useState(false);

  const setRallies = rallies.filter((r) => r.set === currentSet);
  const priorSets = rallies.filter((r) => r.set !== currentSet);
  const visible = showAll ? rallies : setRallies;
  const wonInSet = setRallies.filter((r) => r.pointWonBy === "S").length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col">
      <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-neutral-950 border-t border-neutral-800 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">Rally log · tap row to edit</div>
            <div className="text-sm font-bold text-white">
              Set {currentSet} · {setRallies.length} saved
              {setRallies.length > 0 && (
                <span className="ml-2 text-xs font-mono text-neutral-400">
                  ({wonInSet}W · {setRallies.length - wonInSet}L)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold hover:bg-neutral-700 active:scale-95"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto p-3 space-y-2">
          {priorSets.length > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full py-2 rounded-md border border-dashed border-neutral-700 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-500"
            >
              {showAll
                ? `Hide earlier sets (${priorSets.length} rall${priorSets.length !== 1 ? "ies" : "y"})`
                : `Show earlier sets (${priorSets.length} rall${priorSets.length !== 1 ? "ies" : "y"})`}
            </button>
          )}

          {visible.length === 0 ? (
            <div className="text-center text-neutral-500 text-sm py-8">No finished rallies yet.</div>
          ) : (
            visible.map((r) => {
              // index of this rally in the full rallies array (used by store actions)
              const idx = rallies.indexOf(r);
              const displayNumInSet = setRallies.indexOf(r);
              const globalLabel = showAll ? `S${r.set} · R${rallies.filter((x) => x.set === r.set).indexOf(r) + 1}` : `R${displayNumInSet + 1}`;
              return (
                <RallyRow
                  key={idx}
                  rally={r}
                  index={idx}
                  label={globalLabel}
                  expanded={expanded === idx}
                  onToggle={() => setExpanded(expanded === idx ? null : idx)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RallyRow({ rally, index, label, expanded, onToggle }) {
  const won = rally.pointWonBy === "S";
  return (
    <div className={`rounded-lg border-l-4 ${won ? "bg-emerald-950/30 border-emerald-500" : "bg-red-950/30 border-red-500"} ${expanded ? "ring-1 ring-emerald-600/40" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-2.5 flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-neutral-300">
            {label} <span className="text-neutral-500">· {rally.score}</span>
            {rally.phase === "Clutch" && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">CLUTCH</span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">{RESULT_LABEL[rally.result] || rally.result}</span>
            <span className={`font-bold text-[11px] uppercase tracking-wider ${won ? "text-emerald-400" : "text-red-400"}`}>{won ? "Son" : "Opp"}</span>
            <span className={`text-neutral-500 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
          </span>
        </div>
        {rally.shots.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {rally.shots.map((s, j) => (
              <span key={j} className="inline-flex items-center gap-1">
                <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${ROLE_CHIP[s.role] || ROLE_CHIP.neutral}`}>
                  {s.code}{s.zone != null ? `·${s.zone}` : ""}
                </span>
                {j < rally.shots.length - 1 && <span className="text-neutral-600 text-[10px]">›</span>}
              </span>
            ))}
          </div>
        )}
      </button>
      {expanded && <EditPanel rally={rally} index={index} />}
    </div>
  );
}

function EditPanel({ rally, index }) {
  const updateFinishedRally = useMatchStore((s) => s.updateFinishedRally);
  const flipFinishedRallyWinner = useMatchStore((s) => s.flipFinishedRallyWinner);
  const deleteFinishedRally = useMatchStore((s) => s.deleteFinishedRally);
  const updateFinishedRallyShot = useMatchStore((s) => s.updateFinishedRallyShot);
  const deleteFinishedRallyShot = useMatchStore((s) => s.deleteFinishedRallyShot);

  const handleDeleteRally = () => {
    if (window.confirm(`Delete this rally (${rally.shots.length} shots)? The set score will roll back by 1 point.`)) {
      deleteFinishedRally(index);
    }
  };
  const handleFlipWinner = () => {
    flipFinishedRallyWinner(index);
  };
  const handleResultChange = (result) => {
    updateFinishedRally(index, { result });
  };

  return (
    <div className="border-t border-neutral-800 px-3 py-3 bg-neutral-950/60 rounded-b-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1.5">Result</div>
          <div className="flex gap-1">
            {RESULT_OPTS.map((o) => (
              <button
                key={o.code}
                onClick={() => handleResultChange(o.code)}
                className={`flex-1 py-1.5 rounded-md border text-[11px] font-bold font-mono ${rally.result === o.code ? o.tone : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
              >
                {o.code}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1.5">Winner (flip adjusts score)</div>
          <div className="flex gap-1">
            <button
              onClick={() => rally.pointWonBy !== "S" && handleFlipWinner()}
              className={`flex-1 py-1.5 rounded-md border text-[11px] font-bold ${rally.pointWonBy === "S" ? "bg-emerald-700 text-white border-emerald-500" : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
            >
              Son
            </button>
            <button
              onClick={() => rally.pointWonBy !== "O" && handleFlipWinner()}
              className={`flex-1 py-1.5 rounded-md border text-[11px] font-bold ${rally.pointWonBy === "O" ? "bg-red-700 text-white border-red-500" : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
            >
              Opp
            </button>
          </div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1.5">
        Shots ({rally.shots.length}) · tap letters / dot to edit
      </div>
      {rally.shots.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic">No shots in this rally.</div>
      ) : (
        <div className="flex flex-col gap-1">
          {rally.shots.map((s, j) => (
            <ShotEditRow
              key={j}
              shot={s}
              shotIdx={j}
              rallyIdx={index}
              onCycleGrip={() => updateFinishedRallyShot(index, j, { grip: cycleGrip(s.grip) })}
              onCycleDir={() => updateFinishedRallyShot(index, j, { dir: cycleDirection(s.dir) })}
              onCycleQuality={() => updateFinishedRallyShot(index, j, { quality: QUALITY_CYCLE[s.quality || "Neutral"] })}
              onDelete={() => deleteFinishedRallyShot(index, j)}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleDeleteRally}
        className="w-full mt-3 py-2 rounded-md bg-red-950/60 hover:bg-red-900/60 text-red-200 text-xs font-bold border border-red-800 active:scale-95"
      >
        ✕ Delete entire rally
      </button>
    </div>
  );
}

function ShotEditRow({ shot, shotIdx, onCycleGrip, onCycleDir, onCycleQuality, onDelete }) {
  const isServe = SERVE_CODES.has(shot.shotType);
  const q = shot.quality || "Neutral";
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-neutral-900 border border-neutral-800">
      <span className="text-[10px] font-mono text-neutral-500 w-6">#{shotIdx + 1}</span>
      <div className="flex items-center gap-0.5 font-mono text-[12px] font-bold flex-1">
        {!isServe && (
          <>
            <button onClick={onCycleGrip} className="px-1 rounded hover:bg-neutral-700 active:bg-neutral-600 text-slate-200">{shot.grip || "F"}</button>
            <span className="text-neutral-600">-</span>
          </>
        )}
        <span className="px-0.5 text-neutral-100">{shot.shotType}</span>
        {!isServe && (
          <>
            <span className="text-neutral-600">-</span>
            <button onClick={onCycleDir} className="px-1 rounded hover:bg-neutral-700 active:bg-neutral-600 text-amber-200">{shot.dir || "ST"}</button>
          </>
        )}
        {shot.zone != null && <span className="ml-2 text-[10px] text-neutral-400">Z{shot.zone}</span>}
      </div>
      <button
        onClick={onCycleQuality}
        title={`Quality: ${q} (tap to cycle)`}
        className={`w-5 h-5 rounded-full ${QUALITY_DOT[q]} ring-1 ring-neutral-700 active:scale-90`}
      />
      <button
        onClick={onDelete}
        className="px-2 py-1 rounded text-[10px] font-bold text-red-300 bg-red-950/50 border border-red-900 hover:bg-red-900/50"
      >
        ✕
      </button>
    </div>
  );
}
