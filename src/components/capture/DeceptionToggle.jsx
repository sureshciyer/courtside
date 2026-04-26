// 3-way deception toggle: none / hold / disguised.
//
// We keep the picker minimal because most shots aren't deceptive — default
// is `none`. `hold` covers timing-based deception (hold/delay) and
// `disguised` covers swing-based deception (double_motion/disguised).
// Analytics in src/lib/analytics.js treats "none" as not deceptive and
// leaves the report's "advanced tagging" flag off until at least one
// hold/disguised shot exists.

const OPTIONS = [
  { code: "—", value: "none",      title: "No deception",     active: "bg-neutral-700 text-neutral-200",   idle: "border-neutral-700/60 text-neutral-500" },
  { code: "H", value: "hold",      title: "Hold / delay",     active: "bg-violet-500 text-white",           idle: "border-violet-700/60 text-violet-300" },
  { code: "D", value: "disguised", title: "Disguised swing",  active: "bg-fuchsia-500 text-white",          idle: "border-fuchsia-700/60 text-fuchsia-300" },
];

export default function DeceptionToggle({ value, onChange, label = "Decep" }) {
  const current = value || "none";
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</span>}
      <div className="flex gap-1">
        {OPTIONS.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              aria-label={o.title}
              title={o.title}
              className={`w-8 h-8 rounded-md border text-xs font-bold transition active:scale-95 ${active ? o.active : `bg-neutral-900 hover:bg-neutral-800 ${o.idle}`}`}
            >
              {o.code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
