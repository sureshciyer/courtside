import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, Field, SectionLabel } from "../components/ui.jsx";

// Simple preferences screen. Every change writes back to the Zustand store
// immediately (no "Save" button) — the `persist` middleware handles storage.
export default function Settings({ setScreen }) {
  const settings = useMatchStore((s) => s.settings);
  const updateSettings = useMatchStore((s) => s.updateSettings);

  return (
    <Screen>
      <TopBar title="Settings" subtitle="Preferences are saved automatically" onBack={() => setScreen("home")} />

      <Card className="mb-3">
        <SectionLabel>Player</SectionLabel>
        <Field
          label="Player name"
          value={settings.playerName}
          onChange={(v) => updateSettings({ playerName: v })}
          placeholder="e.g. Arjun"
        />
        <p className="text-[11px] text-neutral-500 leading-relaxed -mt-1">
          Shown in the Performance Report header and the court-zone diagram.
        </p>
      </Card>

      <Card className="mb-3">
        <SectionLabel>Handedness</SectionLabel>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <HandBtn
            label="Right-handed"
            hint="Zones 1 / 4 / 7 → Backhand"
            active={settings.handedness === "R"}
            onClick={() => updateSettings({ handedness: "R" })}
          />
          <HandBtn
            label="Left-handed"
            hint="Zones 3 / 6 / 9 → Backhand"
            active={settings.handedness === "L"}
            onClick={() => updateSettings({ handedness: "L" })}
          />
        </div>
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          Flips the zone-based grip guess during capture. You can still override
          each shot's grip by tapping its letter on the timeline card.
        </p>
      </Card>

      <Card className="mb-3 text-[11px] text-neutral-500 leading-relaxed">
        <SectionLabel>About</SectionLabel>
        All settings and match data are stored locally on this device via
        <code className="font-mono text-emerald-400 px-1">localStorage</code>.
        Use Export / Download JSON from the home screen to create a backup.
      </Card>
    </Screen>
  );
}

function HandBtn({ label, hint, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 px-3 rounded-lg border text-left transition active:scale-95 ${
        active
          ? "bg-emerald-700 border-emerald-500 text-white"
          : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      <div className="font-bold text-sm">{label}</div>
      <div className={`text-[10px] mt-0.5 font-mono ${active ? "text-emerald-100" : "text-neutral-500"}`}>
        {hint}
      </div>
    </button>
  );
}
