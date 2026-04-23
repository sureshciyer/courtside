import { SHOT_CODES, DISRUPTION_SHOTS } from "../../constants/badminton.js";

// Shot-type palette for the right half of the capture screen. Shows either
// the serve row (on the first shot of a rally) or the Front/Mid/Rear groups.
// Tapping a shot arms it; the next zone tap commits. Tapping while editing
// updates the focused shot's shotType directly.
export default function ShotPalette({ mode, armedShot, onArm }) {
  if (mode === "serve") {
    return (
      <div className="flex flex-col gap-2">
        <GroupLabel>Serve</GroupLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {SHOT_CODES.serve.map((s) => (
            <ShotBtn key={s.code} tone="serve" code={s.code} label={s.label} armed={armedShot === s.code} onTap={() => onArm(s.code)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 no-scrollbar">
      <Group tone="rear" label="Rear" shots={SHOT_CODES.rear} armedShot={armedShot} onArm={onArm} />
      <Group tone="mid" label="Mid" shots={SHOT_CODES.mid} armedShot={armedShot} onArm={onArm} />
      <Group tone="front" label="Front" shots={SHOT_CODES.front} armedShot={armedShot} onArm={onArm} />
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
  return (
    <button
      onClick={onTap}
      className={`relative rounded-lg px-2 py-2 border text-left transition active:scale-95 ${armed ? `${t.armed} animate-pulse-arm` : `${t.bg} ${t.idle}`}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-sm tracking-tight">{code}</span>
        {disruption && !armed && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Auto-tags as Disruption" />
        )}
      </div>
      <div className={`text-[10px] mt-0.5 leading-tight ${armed ? "text-white/80" : "text-neutral-400"}`}>
        {label}
      </div>
    </button>
  );
}
