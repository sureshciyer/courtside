import { useRef, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, BigBtn, Card, SectionLabel } from "../components/ui.jsx";
import { makeBackup, parseBackup, mergeBackup, BACKUP_VERSION } from "../lib/backup.js";
import { debugLog, relativeTime } from "../lib/debugLog.js";

// Backup / Restore hub. Three sections:
//   1. Backup       — full JSON envelope download (safe restore target)
//   2. Restore      — file picker with preview + merge confirmation
//   3. AI paste     — legacy clipboard copy for chat-based analysis

export default function Export({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const pausedMatches = useMatchStore((s) => s.pausedMatches) || [];
  const opponents = useMatchStore((s) => s.opponents) || {};
  const matchCounter = useMatchStore((s) => s.matchCounter) || 0;
  const settings = useMatchStore((s) => s.settings);
  const syncStatus = useMatchStore((s) => s.syncStatus) || {};
  const applyBackupMerge = useMatchStore((s) => s.applyBackupMerge);
  const recordBackupDownload = useMatchStore((s) => s.recordBackupDownload);

  const totalRallies = matches.reduce((a, m) => a + m.rallies.length, 0);
  const opponentCount = Object.keys(opponents).length;

  // ---------- backup (export) ----------
  const [copied, setCopied] = useState(false);
  const buildBackup = () => makeBackup({ matches, pausedMatches, opponents, matchCounter, settings });
  const backupJson = () => JSON.stringify(buildBackup(), null, 2);

  const downloadBackup = () => {
    const filename = `courtside_backup_${new Date().toISOString().split("T")[0]}.json`;
    const blob = new Blob([backupJson()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recordBackupDownload(matches.length);
    debugLog.info("export", "backup downloaded", { filename, matches: matches.length });
  };

  // ---------- restore (import) ----------
  const fileInputRef = useRef(null);
  const [importState, setImportState] = useState({ phase: "idle", preview: null, incoming: null, error: null, warning: null });

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected after a cancel.
    const reset = () => { if (fileInputRef.current) fileInputRef.current.value = ""; };

    if (file.size > 50 * 1024 * 1024) {
      setImportState({ phase: "error", error: "File too large (>50 MB). Doesn't look like a Courtside backup." });
      reset();
      return;
    }

    try {
      const text = await file.text();
      const { data, error, warning } = parseBackup(text);
      if (error) {
        setImportState({ phase: "error", error });
        debugLog.error("import", new Error(error), { filename: file.name });
        reset();
        return;
      }
      const current = { matches, pausedMatches, opponents, matchCounter };
      const { stats } = mergeBackup(current, data);
      setImportState({ phase: "preview", preview: stats, incoming: data, error: null, warning });
      reset();
    } catch (err) {
      setImportState({ phase: "error", error: `Read failed: ${err.message}` });
      debugLog.error("import", err, { filename: file.name });
      reset();
    }
  };

  const confirmImport = () => {
    if (!importState.incoming) return;
    const current = { matches, pausedMatches, opponents, matchCounter };
    const { patch, stats } = mergeBackup(current, importState.incoming);
    applyBackupMerge(patch, stats);
    setImportState({ phase: "done", preview: stats, incoming: null, error: null, warning: null });
    debugLog.info("import", "backup merged", stats);
  };

  const cancelImport = () =>
    setImportState({ phase: "idle", preview: null, incoming: null, error: null, warning: null });

  // ---------- AI clipboard (legacy clipboard copy) ----------
  const exportJson = JSON.stringify(matches, null, 0);
  const aiPayload =
    "Here is my match data from the Courtside app. Please analyze it and generate a downloadable CSV file.\n\n" +
    "__COURTSIDE_EXPORT__\n" + exportJson + "\n__END_EXPORT__";

  const copyAiPayload = async () => {
    try {
      await navigator.clipboard.writeText(aiPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      debugLog.error("copy", e);
    }
  };

  const needsFirstBackup = matches.length >= 5 && !syncStatus.lastBackupAt;
  const backupBehindByMatches = syncStatus.lastBackupAt
    ? Math.max(0, matches.length - (syncStatus.lastBackupMatchCount || 0))
    : 0;

  return (
    <Screen>
      <TopBar
        title="Backup / Restore"
        subtitle={`${matches.length} match${matches.length !== 1 ? "es" : ""} · ${totalRallies} rallies · ${opponentCount} opponents`}
        onBack={() => setScreen("home")}
      />

      {/* ==================== SYNC STATUS ==================== */}
      <SyncStatusCard
        status={syncStatus}
        needsFirstBackup={needsFirstBackup}
        behindByMatches={backupBehindByMatches}
      />

      {/* ==================== BACKUP ==================== */}
      <Card tone="accent" className="mb-3">
        <SectionLabel>💾 Backup (export)</SectionLabel>
        <p className="text-xs text-neutral-300 mb-3 leading-relaxed">
          Downloads a single JSON file containing <b>every</b> match, paused match,
          opponent profile (notes + AI insights), match counter, and your settings.
          Save this to Drive / Dropbox to restore on another device.
        </p>
        <BigBtn tone="primary" onClick={downloadBackup}>
          ⬇ Download full backup (.json)
        </BigBtn>
        <div className="text-[11px] text-neutral-500 mt-1">
          Backup format: version {BACKUP_VERSION} · signature "courtside"
        </div>
      </Card>

      {/* ==================== RESTORE ==================== */}
      <Card className="mb-3">
        <SectionLabel>📥 Restore (import)</SectionLabel>
        <p className="text-xs text-neutral-300 mb-3 leading-relaxed">
          Upload a backup JSON. Matches with an ID you already have are <b>skipped</b>
          (no overwrites). Opponent profiles merge field-by-field — your local notes
          and AI insights are preserved.
        </p>

        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          onChange={handleFilePicked}
          className="hidden"
        />

        {importState.phase === "idle" && (
          <BigBtn tone="info" onClick={() => fileInputRef.current?.click()}>
            📂 Choose backup file…
          </BigBtn>
        )}

        {importState.phase === "preview" && importState.preview && (
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 mb-2">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">
              Preview — review before committing
            </div>
            <PreviewRow label="Matches to add" value={importState.preview.addedMatches} />
            <PreviewRow label="Matches skipped (duplicate IDs)" value={importState.preview.skippedMatches} tone={importState.preview.skippedMatches > 0 ? "warn" : "default"} />
            <PreviewRow label="Paused matches to add" value={importState.preview.addedPaused} />
            <PreviewRow label="New opponent profiles" value={importState.preview.addedOpponentProfiles} />
            <PreviewRow label="Existing profiles to fill empty fields" value={importState.preview.filledOpponentFields} />
            {importState.warning && (
              <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-800 text-[11px] text-amber-200 leading-relaxed">
                ⚠️ {importState.warning}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={confirmImport}
                className="flex-1 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm active:scale-95"
              >
                ✓ Merge now
              </button>
              <button
                onClick={cancelImport}
                className="flex-1 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-sm active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {importState.phase === "done" && importState.preview && (
          <div className="bg-emerald-950/40 border border-emerald-700 rounded-lg p-3 mb-2">
            <div className="text-sm font-bold text-emerald-300 mb-1">✓ Import complete</div>
            <div className="text-[11px] text-neutral-300 leading-relaxed">
              {importState.preview.addedMatches} match{importState.preview.addedMatches !== 1 ? "es" : ""} added
              {importState.preview.skippedMatches > 0 && <> · {importState.preview.skippedMatches} skipped (already present)</>}
              {importState.preview.addedPaused > 0 && <> · {importState.preview.addedPaused} paused match{importState.preview.addedPaused !== 1 ? "es" : ""}</>}
              {importState.preview.addedOpponentProfiles > 0 && <> · {importState.preview.addedOpponentProfiles} new opponent profile{importState.preview.addedOpponentProfiles !== 1 ? "s" : ""}</>}
              {importState.preview.filledOpponentFields > 0 && <> · {importState.preview.filledOpponentFields} empty field{importState.preview.filledOpponentFields !== 1 ? "s" : ""} filled</>}.
            </div>
            <button
              onClick={cancelImport}
              className="mt-2 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold"
            >
              OK
            </button>
          </div>
        )}

        {importState.phase === "error" && (
          <div className="bg-red-950/40 border border-red-700 rounded-lg p-3 mb-2">
            <div className="text-sm font-bold text-red-300 mb-1">✕ Couldn't read that file</div>
            <div className="text-[11px] text-red-200 leading-relaxed">{importState.error}</div>
            <button
              onClick={cancelImport}
              className="mt-2 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold"
            >
              Try again
            </button>
          </div>
        )}
      </Card>

      {/* ==================== AI PASTE ==================== */}
      <Card className="mb-3">
        <SectionLabel>🧠 Copy for AI chat</SectionLabel>
        <p className="text-xs text-neutral-400 mb-2 leading-relaxed">
          Copies just the matches array as a paste-ready block for Claude / Gemini
          analysis. For full backup → use the section above.
        </p>
        <button
          onClick={copyAiPayload}
          className="w-full py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold text-sm active:scale-95"
        >
          {copied ? "Copied — paste in chat" : "📋 Copy data for chat"}
        </button>
      </Card>
    </Screen>
  );
}

function PreviewRow({ label, value, tone = "default" }) {
  const tones = {
    default: "text-neutral-200",
    warn: "text-amber-300",
  };
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-neutral-400">{label}</span>
      <span className={`font-mono font-bold tabular-nums ${tones[tone]}`}>{value}</span>
    </div>
  );
}

function SyncStatusCard({ status, needsFirstBackup, behindByMatches }) {
  const urgent = needsFirstBackup || behindByMatches >= 5;
  return (
    <Card tone={urgent ? "warn" : "default"} className="mb-3">
      <SectionLabel>🔄 Sync status</SectionLabel>
      <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[12px]">
        <span className="text-neutral-500">⬇ Last backup</span>
        <span className="font-mono text-neutral-200">
          {status.lastBackupAt ? (
            <>
              {relativeTime(status.lastBackupAt)}
              <span className="text-neutral-500"> · {status.lastBackupMatchCount} match{status.lastBackupMatchCount !== 1 ? "es" : ""}</span>
            </>
          ) : (
            <span className="text-neutral-500">never</span>
          )}
        </span>

        <span className="text-neutral-500">📥 Last restore</span>
        <span className="font-mono text-neutral-200">
          {status.lastRestoreAt ? (
            <>
              {relativeTime(status.lastRestoreAt)}
              {status.lastRestoreStats && (
                <span className="text-neutral-500"> · +{status.lastRestoreStats.addedMatches} matches</span>
              )}
            </>
          ) : (
            <span className="text-neutral-500">never</span>
          )}
        </span>
      </div>
      {needsFirstBackup && (
        <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-800 text-[11px] text-amber-200 leading-relaxed">
          ⚠️ You have match data but have never downloaded a backup. If you clear browser data or switch devices, everything is lost.
        </div>
      )}
      {!needsFirstBackup && behindByMatches >= 5 && (
        <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-800 text-[11px] text-amber-200 leading-relaxed">
          ⚠️ {behindByMatches} new match{behindByMatches !== 1 ? "es" : ""} captured since your last backup. Consider downloading again.
        </div>
      )}
    </Card>
  );
}
