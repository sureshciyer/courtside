// 3-way quality toggle: Effective / Neutral / Ineffective.
// Used both for the default quality of the next shot and for updating the
// focused shot while editing.

const OPTIONS = [
  { code: "E", value: "Effective",   color: "bg-emerald-500 text-white",   idle: "border-emerald-700/60 text-emerald-300" },
  { code: "N", value: "Neutral",     color: "bg-slate-500 text-white",     idle: "border-slate-600/60 text-slate-300" },
  { code: "I", value: "Ineffective", color: "bg-red-500 text-white",       idle: "border-red-700/60 text-red-300" },
];

export default function QualityToggle({ value, onChange, label = "Quality", compact = false }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : ""}`}>
      {label && <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</span>}
      <div className="flex gap-1">
        {OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.code}
              onClick={() => onChange(o.value)}
              aria-label={o.value}
              className={`w-8 h-8 rounded-md border text-xs font-bold transition active:scale-95 ${active ? o.color : `bg-neutral-900 hover:bg-neutral-800 ${o.idle}`}`}
            >
              {o.code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
