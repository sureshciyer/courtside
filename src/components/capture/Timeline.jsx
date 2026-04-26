import { SHOT_CODES } from "../../constants/badminton.js";

// Horizontal scrolling rally timeline. Each shot is a card showing
// Grip · ShotCode · Direction, zone, and a quality dot. Disruption shots get
// an amber glow. Grip and direction segments cycle in-place on tap; tapping
// the shot code focuses the card for full edit.

const QUALITY_DOT = {
  Effective: "bg-emerald-400",
  Neutral: "bg-slate-400",
  Ineffective: "bg-red-400",
};

// Compact one-letter glyph shown on the timeline card when a shot has been
// tagged with a deception type other than "none".
const DECEPTION_GLYPH = {
  hold:      { ch: "H", cls: "bg-violet-500 text-white" },
  disguised: { ch: "D", cls: "bg-fuchsia-500 text-white" },
  // Legacy values from earlier captures — render the closest single-letter form.
  delay:         { ch: "H", cls: "bg-violet-500 text-white" },
  double_motion: { ch: "D", cls: "bg-fuchsia-500 text-white" },
};

const SERVE_CODES = new Set(SHOT_CODES.serve.map((s) => s.code));

export default function Timeline({ shots, focusedIdx, onFocus, onUndo, onCycleGrip, onCycleDir }) {
  return (
    <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto snap-x no-scrollbar min-h-[64px] items-center">
          {shots.length === 0 ? (
            <div className="text-xs text-neutral-500 px-1">No shots yet — pick a serve or shot to begin</div>
          ) : (
            shots.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 shrink-0">
                <ShotCard
                  idx={i}
                  shot={s}
                  focused={focusedIdx === i}
                  onFocus={() => onFocus(i)}
                  onCycleGrip={() => onCycleGrip(i)}
                  onCycleDir={() => onCycleDir(i)}
                />
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

function ShotCard({ idx, shot, focused, onFocus, onCycleGrip, onCycleDir }) {
  const disruption = shot.role === "disruption";
  const quality = shot.quality || "Neutral";
  const isServe = SERVE_CODES.has(shot.shotType);

  const ring = focused
    ? "ring-2 ring-emerald-400 shadow-focus-glow"
    : disruption
    ? "ring-2 ring-amber-500 shadow-disruption-glow"
    : "ring-1 ring-neutral-700";

  const stop = (e) => e.stopPropagation();

  return (
    <div
      onClick={onFocus}
      className={`shrink-0 snap-start flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-neutral-800 text-neutral-100 font-mono cursor-pointer transition ${ring}`}
    >
      <div className="flex items-center gap-0.5 leading-none text-[13px] font-bold">
        {!isServe && (
          <>
            <Segment onClick={(e) => { stop(e); onCycleGrip(); }} color="text-slate-200">
              {shot.grip || "F"}
            </Segment>
            <span className="text-neutral-600">-</span>
          </>
        )}
        <span className="px-0.5 tracking-tight">{shot.shotType}</span>
        {!isServe && (
          <>
            <span className="text-neutral-600">-</span>
            <Segment onClick={(e) => { stop(e); onCycleDir(); }} color="text-amber-200">
              {shot.dir || "ST"}
            </Segment>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {shot.zone != null && (
          <span className="text-[10px] text-neutral-400">Z{shot.zone}</span>
        )}
        <span className={`w-1.5 h-1.5 rounded-full ${QUALITY_DOT[quality]}`} title={quality} />
        {DECEPTION_GLYPH[shot.deceptionType] && (
          <span
            className={`text-[8px] font-bold leading-none px-1 py-0.5 rounded ${DECEPTION_GLYPH[shot.deceptionType].cls}`}
            title={`Deception: ${shot.deceptionType}`}
          >
            {DECEPTION_GLYPH[shot.deceptionType].ch}
          </span>
        )}
        <span className="text-[9px] uppercase tracking-wider text-neutral-500">#{idx + 1}</span>
      </div>
    </div>
  );
}

// Tappable letter cluster inside the card. Bumps up a bit on hover so the
// hit target is discoverable.
function Segment({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`px-1 rounded hover:bg-neutral-700 active:bg-neutral-600 ${color}`}
    >
      {children}
    </button>
  );
}
