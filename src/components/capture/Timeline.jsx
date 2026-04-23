// Horizontal scrolling rally timeline. Each shot is a card showing code, zone,
// and a colored dot for quality. Disruption shots get an amber glow. Tapping a
// card focuses it so the Capture screen can edit zone/shot/quality in place.

const QUALITY_DOT = {
  Effective: "bg-emerald-400",
  Neutral: "bg-slate-400",
  Ineffective: "bg-red-400",
};

export default function Timeline({ shots, focusedIdx, onFocus, onUndo }) {
  return (
    <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto snap-x no-scrollbar min-h-[60px] items-center">
          {shots.length === 0 ? (
            <div className="text-xs text-neutral-500 px-1">No shots yet — pick a serve or shot to begin</div>
          ) : (
            shots.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 shrink-0">
                <ShotCard idx={i} shot={s} focused={focusedIdx === i} onTap={() => onFocus(i)} />
                {i < shots.length - 1 && <span className="text-neutral-600 text-xs">›</span>}
              </span>
            ))
          )}
        </div>
        <button
          onClick={onUndo}
          disabled={shots.length === 0}
          className="shrink-0 px-3 py-2 rounded-lg bg-neutral-800 text-emerald-300 text-xs font-semibold border border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-700 active:scale-95"
        >
          ↶ Undo
        </button>
      </div>
    </div>
  );
}

function ShotCard({ idx, shot, focused, onTap }) {
  const disruption = shot.role === "disruption";
  const quality = shot.quality || "Neutral";

  const ring = focused
    ? "ring-2 ring-emerald-400 shadow-focus-glow"
    : disruption
    ? "ring-2 ring-amber-500 shadow-disruption-glow"
    : "ring-1 ring-neutral-700";

  return (
    <button
      onClick={onTap}
      className={`shrink-0 snap-start flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-100 font-mono transition ${ring}`}
    >
      <div className="flex items-center gap-1.5 leading-none">
        <span className="text-[13px] font-bold tracking-tight">{shot.code}</span>
        {shot.zone != null && (
          <span className="text-[11px] text-neutral-400">· {shot.zone}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${QUALITY_DOT[quality]}`} />
        <span className="text-[9px] uppercase tracking-wider text-neutral-500">#{idx + 1}</span>
      </div>
    </button>
  );
}
