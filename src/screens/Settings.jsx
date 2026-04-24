import { useEffect, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, Field, SectionLabel } from "../components/ui.jsx";
import { debugLog, relativeTime } from "../lib/debugLog.js";

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

      <DebugPanel />

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

// ---- Debug panel ----
// Lives in Settings so it's reachable from anywhere. Shows the last 40
// buffered events (errors from ErrorBoundary + window.error +
// unhandledrejection, plus any manual info entries), with copy / clear and
// a verbose-console toggle. Everything in-memory only; not persisted.

function DebugPanel() {
  const [entries, setEntries] = useState(() => debugLog.get());
  const [verbose, setVerbose] = useState(debugLog.isEnabled());
  const [copied, setCopied] = useState(false);
  const syncStatus = useMatchStore((s) => s.syncStatus) || {};

  useEffect(() => {
    const unsub = debugLog.subscribe(() => setEntries(debugLog.get()));
    return unsub;
  }, []);

  const toggleVerbose = () => {
    const next = !verbose;
    debugLog.setEnabled(next);
    setVerbose(next);
  };

  const copyLog = async () => {
    const text = JSON.stringify(debugLog.get(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable — quietly ignore */ }
  };

  const clearLog = () => {
    debugLog.clear();
    setEntries([]);
  };

  const errorCount = entries.filter((e) => e.type === "error").length;

  return (
    <Card className="mb-3" tone={errorCount > 0 ? "danger" : "default"}>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>🐛 Debug</SectionLabel>
        <button
          onClick={toggleVerbose}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
            verbose
              ? "bg-emerald-700 border-emerald-500 text-white"
              : "bg-neutral-900 border-neutral-700 text-neutral-400"
          }`}
          title="Mirror every event to the browser console"
        >
          Verbose logs: {verbose ? "ON" : "OFF"}
        </button>
      </div>
      <div className="text-[11px] text-neutral-500 mb-2">
        {entries.length} event{entries.length !== 1 ? "s" : ""} this session
        {errorCount > 0 && (
          <span className="ml-2 text-red-400 font-semibold">· {errorCount} error{errorCount !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Sync status — persisted across reloads, unlike the event log */}
      <div className="bg-neutral-950 border border-neutral-800 rounded p-2 mb-2 text-[11px] font-mono leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">⬇ Last backup</span>
          <span className="text-neutral-200">
            {syncStatus.lastBackupAt ? (
              <>
                {relativeTime(syncStatus.lastBackupAt)}
                <span className="text-neutral-500"> · {syncStatus.lastBackupMatchCount || 0}m</span>
              </>
            ) : (
              <span className="text-neutral-500">never</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">📥 Last restore</span>
          <span className="text-neutral-200">
            {syncStatus.lastRestoreAt ? (
              <>
                {relativeTime(syncStatus.lastRestoreAt)}
                {syncStatus.lastRestoreStats && (
                  <span className="text-neutral-500"> · +{syncStatus.lastRestoreStats.addedMatches || 0}m</span>
                )}
              </>
            ) : (
              <span className="text-neutral-500">never</span>
            )}
          </span>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded p-2">
        {entries.length === 0 ? (
          <div className="text-[11px] text-neutral-600 text-center py-4">No events yet</div>
        ) : (
          entries.slice(-40).reverse().map((e, i) => {
            const t = new Date(e.ts).toLocaleTimeString();
            const isError = e.type === "error";
            return (
              <div
                key={`${e.ts}-${i}`}
                className={`text-[10px] font-mono py-1 border-b border-neutral-900 last:border-0 ${isError ? "text-red-300" : "text-neutral-400"}`}
              >
                <span className="text-neutral-600">{t}</span>
                <span className={`mx-1 font-bold ${isError ? "text-red-400" : "text-emerald-400"}`}>
                  {e.type}
                </span>
                {e.source && <span className="text-neutral-500">{e.source}</span>}
                <div className={`mt-0.5 ${isError ? "text-red-200" : "text-neutral-300"} break-words`}>
                  {e.message || JSON.stringify(e)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2 mt-2">
        <button
          onClick={copyLog}
          disabled={entries.length === 0}
          className="flex-1 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold disabled:opacity-40"
        >
          {copied ? "Copied" : "📋 Copy log"}
        </button>
        <button
          onClick={clearLog}
          disabled={entries.length === 0}
          className="flex-1 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs font-semibold disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
        Captures React render errors, unhandled JS exceptions, and promise
        rejections. Log is in-memory only (cleared on reload). When the app
        crashes, the error screen also has a Copy Report button with more detail.
      </p>
    </Card>
  );
}
