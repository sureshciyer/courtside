// Bottom sheet shown when the user ends the rally. Two rows: result kind and
// point winner. Tapping a winner finishes the rally.

const RESULTS = [
  { code: "W",  label: "Winner",       tone: "bg-emerald-700 border-emerald-500 text-white",   idle: "border-emerald-800/60 text-emerald-300" },
  { code: "FE", label: "Forced Err",   tone: "bg-orange-700  border-orange-500  text-white",   idle: "border-orange-800/60  text-orange-300" },
  { code: "UE", label: "Unforced Err", tone: "bg-red-700     border-red-500     text-white",   idle: "border-red-800/60     text-red-300" },
];

export default function ResultBar({ result, onPickResult, onFinish, onCancel }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-neutral-950 border-t border-neutral-800 shadow-2xl">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">End of rally</span>
          <button onClick={onCancel} className="text-xs text-neutral-500 hover:text-neutral-300 font-semibold">✕ Cancel</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {RESULTS.map((r) => {
            const active = result === r.code;
            return (
              <button
                key={r.code}
                onClick={() => onPickResult(r.code)}
                className={`py-2.5 rounded-lg border-2 font-bold text-sm transition active:scale-95 ${active ? r.tone : `bg-neutral-900 ${r.idle}`}`}
              >
                {r.label}
                <div className="font-mono text-[10px] opacity-70 mt-0.5">{r.code}</div>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">Point won by</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onFinish(result || "W", "S")}
            className="py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold active:scale-95"
          >
            Son
          </button>
          <button
            onClick={() => onFinish(result || "UE", "O")}
            className="py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-display font-bold active:scale-95"
          >
            Opponent
          </button>
        </div>
      </div>
    </div>
  );
}
