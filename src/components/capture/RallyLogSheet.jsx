// Bottom-sheet drawer that lists every finished rally of the current set
// (and a count for earlier sets). Opens from the capture toolbar so the
// notator can verify what was saved without ending the match first.

const ROLE_CHIP = {
  opening:    "bg-sky-950/50 border-sky-800 text-sky-200",
  neutral:    "bg-neutral-900 border-neutral-700 text-neutral-300",
  disruption: "bg-amber-950/50 border-amber-700 text-amber-200",
  finish:     "bg-red-950/50 border-red-700 text-red-200",
};

const RESULT_LABEL = { W: "Winner", FE: "Forced err", UE: "Unforced err" };

export default function RallyLogSheet({ rallies, currentSet, onClose }) {
  const setRallies = rallies.filter((r) => r.set === currentSet);
  const priorSetsCount = rallies.length - setRallies.length;
  const wonInSet = setRallies.filter((r) => r.pointWonBy === "S").length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col">
      <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-neutral-950 border-t border-neutral-800 shadow-2xl max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">Rally log</div>
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
          {setRallies.length === 0 ? (
            <div className="text-center text-neutral-500 text-sm py-8">
              No finished rallies in this set yet.
            </div>
          ) : (
            setRallies.map((r, i) => {
              const won = r.pointWonBy === "S";
              return (
                <div
                  key={i}
                  className={`rounded-lg border-l-4 p-2.5 ${won ? "bg-emerald-950/30 border-emerald-500" : "bg-red-950/30 border-red-500"}`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-mono text-neutral-300">
                      R{i + 1} <span className="text-neutral-500">· {r.score}</span>
                      {r.phase === "Clutch" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">CLUTCH</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                        {RESULT_LABEL[r.result] || r.result}
                      </span>
                      <span className={`font-bold text-[11px] uppercase tracking-wider ${won ? "text-emerald-400" : "text-red-400"}`}>
                        {won ? "Son" : "Opp"}
                      </span>
                    </span>
                  </div>
                  {r.shots.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 italic">No shots captured</div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      {r.shots.map((s, j) => (
                        <span key={j} className="inline-flex items-center gap-1">
                          <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${ROLE_CHIP[s.role] || ROLE_CHIP.neutral}`}>
                            {s.code}{s.zone != null ? `·${s.zone}` : ""}
                          </span>
                          {j < r.shots.length - 1 && <span className="text-neutral-600 text-[10px]">›</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {priorSetsCount > 0 && (
            <div className="text-center text-[11px] text-neutral-500 pt-3 border-t border-neutral-800 mt-3">
              {priorSetsCount} earlier-set rall{priorSetsCount !== 1 ? "ies" : "y"} — open History or Report for the full archive.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
