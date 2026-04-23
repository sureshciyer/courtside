import { useMatchStore } from "../../store/useMatchStore.js";

export default function Scoreboard({ onBack }) {
  const m = useMatchStore((s) => s.currentMatch);
  const adjustScore = useMatchStore((s) => s.adjustScore);
  if (!m) return null;

  const set = m.sets[m.currentSet];
  const rallyNum = m.rallies.filter((r) => r.set === m.currentSet + 1).length + 1;
  const clutch = set.sonScore >= 16 || set.oppScore >= 16;

  return (
    <div className="bg-emerald-950/70 border-b border-emerald-900/60 px-4 pt-3 pb-3">
      <div className="flex items-center justify-between text-[11px] text-emerald-300/80 mb-2">
        <button
          onClick={onBack}
          className="font-mono font-semibold px-2 py-0.5 rounded hover:bg-emerald-900/50"
        >
          ← {m.id}
        </button>
        <span className="font-mono">Set {m.currentSet + 1}</span>
        {clutch ? (
          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-bold text-[10px] tracking-wider">CLUTCH</span>
        ) : (
          <span className="font-mono text-emerald-400/70">R{rallyNum}</span>
        )}
      </div>
      <div className="flex items-center justify-center gap-6">
        <Side label="SON" score={set.sonScore} onDec={() => adjustScore("S", -1)} onInc={() => adjustScore("S", +1)} />
        <span className="text-3xl font-extrabold text-emerald-600">:</span>
        <Side label="OPP" score={set.oppScore} onDec={() => adjustScore("O", -1)} onInc={() => adjustScore("O", +1)} />
      </div>
      {m.opponent && (
        <div className="text-center text-[11px] text-emerald-400/60 mt-1">
          vs {m.opponent}
          {m.playerStyle && m.playerStyle !== "Unknown" ? ` · ${m.playerStyle}` : ""}
        </div>
      )}
    </div>
  );
}

function Side({ label, score, onDec, onInc }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-emerald-400/70 font-semibold tracking-[0.2em]">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onDec}
          className="w-8 h-8 rounded-full border border-emerald-700/70 text-emerald-200/80 text-lg leading-none hover:bg-emerald-900/60 active:scale-95"
        >−</button>
        <div className="text-[40px] leading-none font-extrabold text-white font-display tabular-nums w-12">
          {score}
        </div>
        <button
          onClick={onInc}
          className="w-8 h-8 rounded-full border border-emerald-700/70 text-emerald-200/80 text-lg leading-none hover:bg-emerald-900/60 active:scale-95"
        >+</button>
      </div>
    </div>
  );
}
