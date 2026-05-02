import { SHOT_CODES, DISRUPTION_SHOTS, SHOT_KEY_BY_CODE } from "../../constants/badminton.js";
import { DIRS } from "../../constants/badminton.js";

// Shot-type palette for the right half of the capture screen. Shows either
// the serve row (on the first shot of a rally) or the Front/Mid/Rear groups,
// plus a sticky direction quick-toggle that carries over between shots.
export default function ShotPalette({
  mode,
  armedShot,
  onArm,
  direction,
  onDirectionChange,
  showDirection = true,
}) {
  const isServe = mode === "serve";
  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {showDirection && !isServe && (
        <DirectionToggle value={direction} onChange={onDirectionChange} />
      )}
      {isServe ? (
        <>
          <GroupLabel>Serve</GroupLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {SHOT_CODES.serve.map((s) => (
              <ShotBtn
                key={s.code}
                tone="serve"
                code={s.code}
                label={s.label}
                armed={armedShot === s.code}
                onTap={() => onArm(s.code)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 no-scrollbar">
          <Group tone="rear" label="Rear" shots={SHOT_CODES.rear} armedShot={armedShot} onArm={onArm} />
          <Group tone="mid" label="Mid" shots={SHOT_CODES.mid} armedShot={armedShot} onArm={onArm} />
          <Group tone="front" label="Front" shots={SHOT_CODES.front} armedShot={armedShot} onArm={onArm} />
        </div>
      )}
    </div>
  );
}

// Sticky direction quick-toggle. Displayed above the shot buttons so the user
// can flip ST/CR/BD before picking a zone; the parent can also push an
// auto-suggested value (e.g. CR when the zone is on the opposite side).
function DirectionToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Dir</span>
      <div className="flex flex-1 gap-1 p-0.5 rounded-lg bg-neutral-950 border border-neutral-800">
        {DIRS.map((d) => {
          const active = value === d.code;
          return (
            <button
              key={d.code}
              onClick={() => onChange(d.code)}
              className={`flex-1 py-1 rounded-md font-mono text-[11px] font-bold tracking-tight transition ${active ? "bg-emerald-700 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"}`}
              title={d.label}
            >
              {d.code}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Group({ tone, label, shots, armedShot, onArm }) {
  return (
    <div>
      <GroupLabel>{label}</GroupLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {shots.map((s) => (
          <ShotBtn
            key={s.code}
            tone={tone}
            code={s.code}
            label={s.label}
            disruption={DISRUPTION_SHOTS.has(s.code)}
            armed={armedShot === s.code}
            onTap={() => onArm(s.code)}
          />
        ))}
      </div>
    </div>
  );
}

function GroupLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-1">
      {children}
    </div>
  );
}

const TONE = {
  rear:  { bg: "bg-red-950/40",    armed: "bg-red-600 text-white border-red-400",       idle: "border-red-700/40 text-red-200 hover:bg-red-900/40" },
  mid:   { bg: "bg-orange-950/40", armed: "bg-orange-500 text-white border-orange-300", idle: "border-orange-700/40 text-orange-200 hover:bg-orange-900/40" },
  front: { bg: "bg-sky-950/40",    armed: "bg-sky-600 text-white border-sky-400",       idle: "border-sky-700/40 text-sky-200 hover:bg-sky-900/40" },
  serve: { bg: "bg-purple-950/40", armed: "bg-purple-600 text-white border-purple-400", idle: "border-purple-700/40 text-purple-200 hover:bg-purple-900/40" },
};

function ShotBtn({ tone, code, label, armed, disruption, onTap }) {
  const t = TONE[tone];
  const hotkey = SHOT_KEY_BY_CODE[code];
  return (
    <button
      onClick={onTap}
      className={`relative rounded-lg px-2 py-2 border text-left transition active:scale-95 ${armed ? `${t.armed} animate-pulse-arm` : `${t.bg} ${t.idle}`}`}
      title={hotkey ? `${label} — keyboard: ${hotkey}` : label}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-sm tracking-tight">{code}</span>
        <div className="flex items-center gap-1">
          {disruption && !armed && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Auto-tags as Disruption" />
          )}
          {hotkey && (
            <kbd
              className={`hidden md:inline-block font-mono text-[9px] leading-none px-1 py-0.5 rounded border ${
                armed
                  ? "bg-white/15 text-white border-white/40"
                  : "bg-neutral-950 text-neutral-300 border-neutral-700"
              }`}
              aria-label={`Keyboard shortcut ${hotkey}`}
            >
              {hotkey}
            </kbd>
          )}
        </div>
      </div>
      <div className={`text-[10px] mt-0.5 leading-tight ${armed ? "text-white/80" : "text-neutral-400"}`}>
        {label}
      </div>
    </button>
  );
}
