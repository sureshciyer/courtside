import { ZONES } from "../../constants/badminton.js";

// Split-screen court grid. Bigger, tap-friendly, dark-themed. If `armed` is
// true (a shot type is armed and waiting for a zone), cells pulse subtly to
// show that the next tap will commit the shot.
export default function CourtGrid({ onTap, active, armed, editing }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 text-center">↑ NET ↑</div>
      <div className="grid grid-cols-3 gap-1.5">
        {ZONES.map((z) => {
          const isActive = active === z.n;
          const base = "rounded-lg p-2 flex flex-col items-center justify-center transition active:scale-95 select-none";
          const state = isActive
            ? "bg-emerald-700/40 border-2 border-emerald-400 text-emerald-100"
            : editing
            ? "bg-neutral-800 border border-amber-700/60 text-amber-200 hover:bg-neutral-700"
            : armed
            ? "bg-neutral-800 border border-emerald-600/40 text-emerald-200 hover:bg-emerald-900/40 animate-pulse-arm"
            : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:bg-neutral-800";
          return (
            <button
              key={z.n}
              onClick={() => onTap(z.n)}
              className={`${base} ${state} aspect-square`}
            >
              <div className="text-2xl font-extrabold font-display leading-none">{z.n}</div>
              <div className="text-[9px] text-neutral-500 mt-0.5 leading-tight">{z.l}</div>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 text-center">BASELINE</div>
    </div>
  );
}
