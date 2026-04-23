import { ZONES } from "../constants/badminton.js";

// Shared dark-themed primitives used across all non-capture screens.
// Classes are Tailwind; every primitive accepts a `className` escape hatch.

export function Screen({ children, wide = false, className = "" }) {
  const width = wide ? "max-w-3xl" : "max-w-md";
  return (
    <div className={`min-h-screen bg-neutral-950 text-neutral-100 font-display ${className}`}>
      <div className={`${width} mx-auto min-h-screen px-4 py-4 flex flex-col`}>
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, onBack, right, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {onBack && (
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center"
          aria-label="Back"
        >←</button>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base text-white truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-neutral-500 truncate">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// Card primitive — uniform shell for every section across the suite.
export function Card({ children, className = "", tone = "default" }) {
  const tones = {
    default: "bg-neutral-900 border-neutral-800",
    accent:  "bg-emerald-950/30 border-emerald-800/50",
    warn:    "bg-amber-950/30 border-amber-800/50",
    danger:  "bg-red-950/30 border-red-800/50",
  };
  return (
    <div className={`rounded-xl border ${tones[tone]} p-4 ${className}`}>{children}</div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-semibold mb-2">
      {children}
    </div>
  );
}

const BIG_BTN_TONES = {
  primary:   "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500",
  secondary: "bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border-neutral-700",
  accent:    "bg-amber-600 hover:bg-amber-500 text-white border-amber-400",
  danger:    "bg-red-600 hover:bg-red-500 text-white border-red-400",
  ghost:     "bg-transparent hover:bg-neutral-900 text-neutral-200 border-neutral-700",
  info:      "bg-sky-700 hover:bg-sky-600 text-white border-sky-500",
  violet:    "bg-violet-700 hover:bg-violet-600 text-white border-violet-500",
};

export function BigBtn({ children, tone = "primary", onClick, disabled, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-xl border font-bold text-[15px] tracking-tight transition active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed mb-2 ${BIG_BTN_TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick, danger, className = "" }) {
  const cls = danger
    ? "border-red-800 text-red-300 hover:bg-red-950/60"
    : "border-neutral-700 text-neutral-300 hover:bg-neutral-800";
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg bg-neutral-900 border text-xs font-semibold active:scale-95 ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: "bg-emerald-950/50 text-emerald-300 border-emerald-800/60",
    warn:    "bg-amber-950/50 text-amber-300 border-amber-800/60",
    danger:  "bg-red-950/50 text-red-300 border-red-800/60",
    muted:   "bg-neutral-800 text-neutral-400 border-neutral-700",
  };
  return (
    <span className={`inline-block font-mono text-[11px] px-2 py-1 rounded-md border font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block mb-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">{label}</div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-600 font-display text-sm"
      />
    </label>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="block mb-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5 font-semibold">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 focus:outline-none focus:border-emerald-600 font-display text-sm"
      >
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Chip / stat / small helper components retained for legacy compat.
export function Chip({ label, filled, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filled ? "bg-emerald-700/30 text-emerald-200 border-emerald-700" : "bg-neutral-900 text-neutral-500 border-neutral-700 border-dashed"}`}
    >{label}{filled && " ✕"}</button>
  );
}

export function Stat({ label, value, tone = "default" }) {
  const tones = {
    default: "text-neutral-100",
    good:    "text-emerald-400",
    bad:     "text-red-400",
    warn:    "text-amber-400",
  };
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-semibold">{label}</div>
      <div className={`text-2xl font-extrabold font-display tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  );
}

// Mini court grid — used by non-capture screens (Patterns, etc.) as a
// read-only 9-cell heatmap. `values[n]` should be the tally for zone n;
// `max` is the normalization cap. `tone` picks the color ramp.
const HEAT_RAMP = {
  emerald: (a) => `rgba(16,185,129,${0.12 + 0.7 * a})`,
  amber:   (a) => `rgba(245,158,11,${0.12 + 0.7 * a})`,
  red:     (a) => `rgba(239,68,68,${0.12 + 0.7 * a})`,
  sky:     (a) => `rgba(56,189,248,${0.12 + 0.7 * a})`,
};

export function HeatGrid({ values, tone = "red", maxOverride }) {
  const max = Math.max(1, maxOverride || Math.max(...values));
  const paint = HEAT_RAMP[tone] || HEAT_RAMP.red;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 text-center">↑ NET ↑</div>
      <div className="grid grid-cols-3 gap-1.5">
        {ZONES.map((z) => {
          const c = values[z.n] || 0;
          const alpha = c / max;
          const bg = c === 0 ? "transparent" : paint(alpha);
          return (
            <div
              key={z.n}
              className={`aspect-square rounded-lg border border-neutral-800 flex flex-col items-center justify-center select-none ${c === 0 ? "bg-neutral-900" : ""}`}
              style={c === 0 ? undefined : { background: bg }}
            >
              <div className="text-xl font-extrabold font-display text-white leading-none">{c || "·"}</div>
              <div className="text-[9px] text-neutral-400 mt-0.5">{z.l}</div>
            </div>
          );
        })}
      </div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-600 text-center">BASELINE</div>
    </div>
  );
}

// Horizontal percentage bar — used in disruption-conversion and similar rows.
export function MeterRow({ label, value, total, tone = "emerald" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colors = {
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-neutral-300 font-medium">{label}</span>
        <span className="font-mono text-xs text-neutral-400">
          <span className="text-white font-bold">{pct}%</span> · {value}/{total}
        </span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full ${colors[tone]} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
