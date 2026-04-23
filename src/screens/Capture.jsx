import { useEffect, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { autoRole, OPENING_LENGTH } from "../lib/rally.js";
import { DISRUPTION_SHOTS, SHOT_CODES } from "../constants/badminton.js";

const SERVE_CODES = new Set(SHOT_CODES.serve.map((s) => s.code));
import Scoreboard from "../components/capture/Scoreboard.jsx";
import Timeline from "../components/capture/Timeline.jsx";
import CourtGrid from "../components/capture/CourtGrid.jsx";
import ShotPalette from "../components/capture/ShotPalette.jsx";
import QualityToggle from "../components/capture/QualityToggle.jsx";
import ServerPicker from "../components/capture/ServerPicker.jsx";
import ResultBar from "../components/capture/ResultBar.jsx";

export default function Capture({ setScreen }) {
  const m = useMatchStore((s) => s.currentMatch);
  const rally = useMatchStore((s) => s.currentRally);
  const setServer = useMatchStore((s) => s.setServer);
  const addShot = useMatchStore((s) => s.addShot);
  const updateShot = useMatchStore((s) => s.updateShot);
  const deleteShot = useMatchStore((s) => s.deleteShot);
  const popShot = useMatchStore((s) => s.popShot);
  const setShotQuality = useMatchStore((s) => s.setShotQuality);
  const finishRally = useMatchStore((s) => s.finishRally);
  const restartRally = useMatchStore((s) => s.restartRally);
  const nextSet = useMatchStore((s) => s.nextSet);
  const endMatch = useMatchStore((s) => s.endMatch);

  // --- local UI state (transient; not persisted) ---
  const [armedShot, setArmedShot] = useState(null);    // shot type waiting for a zone
  const [quality, setQuality] = useState("Neutral");   // default quality for the next commit
  const [focusedIdx, setFocusedIdx] = useState(null);  // index of the shot being edited
  const [finishAfter, setFinishAfter] = useState(false); // next commit triggers end-of-rally
  const [showResult, setShowResult] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { if (!m) setScreen("home"); }, [m, setScreen]);
  if (!m || !rally) return null;

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400); };
  const isFirstShot = rally.shots.length === 0;
  const isEditing = focusedIdx !== null;
  const focused = isEditing ? rally.shots[focusedIdx] : null;
  const paletteMode = isEditing
    ? SERVE_CODES.has(focused?.shotType) ? "serve" : "shot"
    : isFirstShot ? "serve" : "shot";

  // ---------- commit / edit handlers ----------
  const commitNewShot = (shotType, zone) => {
    const isServe = paletteMode === "serve" && isFirstShot && !isEditing;
    addShot({
      grip: null,
      shotType,
      dir: null,
      zone,
      role: isServe ? "opening" : autoRole(rally.shots.length, shotType),
      quality,
    });
    setArmedShot(null);
    if (finishAfter) {
      setFinishAfter(false);
      setShowResult(true);
    }
  };

  const handleZoneTap = (zone) => {
    if (isEditing) {
      updateShot(focusedIdx, { zone });
      flash(`Zone → ${zone}`);
      return;
    }
    if (!armedShot) {
      flash("Pick a shot first");
      return;
    }
    commitNewShot(armedShot, zone);
  };

  const handleShotArm = (shotType) => {
    if (isEditing) {
      const patch = { shotType };
      // Re-suggest disruption tag when the new shot type qualifies and we're
      // past the opening. Leave "opening"/"finish" roles untouched.
      const pastOpening = focusedIdx >= OPENING_LENGTH;
      if (pastOpening && DISRUPTION_SHOTS.has(shotType) && focused.role === "neutral") {
        patch.role = "disruption";
      }
      updateShot(focusedIdx, patch);
      flash(`Shot → ${shotType}`);
      return;
    }
    setArmedShot(shotType);
  };

  const handleQualityChange = (q) => {
    if (isEditing) {
      setShotQuality(focusedIdx, q);
      flash(`Quality → ${q[0]}`);
    } else {
      setQuality(q);
    }
  };

  const handleUndo = () => {
    const popped = popShot();
    if (popped) flash(`Undid ${popped.code}`);
    setArmedShot(null);
    setFocusedIdx(null);
  };

  const handleDeleteFocused = () => {
    if (!isEditing) return;
    deleteShot(focusedIdx);
    setFocusedIdx(null);
    flash("Shot deleted");
  };

  const handleFinish = (result, wonBy) => {
    finishRally(result, wonBy);
    setShowResult(false);
    setPendingResult(null);
    setArmedShot(null);
    setFocusedIdx(null);
    setFinishAfter(false);
    flash("Rally saved");
  };

  const handleRestart = () => {
    restartRally();
    setArmedShot(null);
    setFocusedIdx(null);
    setShowResult(false);
    setFinishAfter(false);
  };

  const handleEndMatch = () => {
    endMatch();
    setScreen("summary");
  };

  // ---------- render ----------
  const serverPicker = !rally.server && rally.shots.length === 0;
  const focusedQuality = focused?.quality || "Neutral";

  return (
    <div className="capture-dark min-h-screen flex flex-col bg-neutral-950 text-neutral-100 font-display">
      {toast && (
        <div className="cs-toast fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}

      <Scoreboard onBack={() => setScreen("home")} />

      <Timeline
        shots={rally.shots}
        focusedIdx={focusedIdx}
        onFocus={(i) => { setFocusedIdx(focusedIdx === i ? null : i); setArmedShot(null); }}
        onUndo={handleUndo}
      />

      {/* Edit / capture toolbar */}
      <div className="px-3 py-2 bg-neutral-900/70 border-b border-neutral-800 flex items-center justify-between gap-3">
        {isEditing ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Editing #{focusedIdx + 1}</span>
              <span className="font-mono text-sm text-neutral-200 truncate">{focused.code} · Z{focused.zone}</span>
            </div>
            <div className="flex items-center gap-2">
              <QualityToggle value={focusedQuality} onChange={handleQualityChange} label="" />
              <button onClick={handleDeleteFocused} className="px-2 py-1.5 rounded-md bg-red-900/50 border border-red-700/60 text-red-200 text-xs font-semibold hover:bg-red-900 active:scale-95">Delete</button>
              <button onClick={() => setFocusedIdx(null)} className="px-2 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold hover:bg-neutral-700 active:scale-95">Done</button>
            </div>
          </>
        ) : (
          <>
            <QualityToggle value={quality} onChange={handleQualityChange} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFinishAfter((v) => !v)}
                className={`px-2 py-1.5 rounded-md border text-[11px] font-semibold transition ${finishAfter ? "bg-red-600 border-red-400 text-white animate-pulse-arm" : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
                title="Next commit ends the rally"
              >
                {finishAfter ? "FINISH ●" : "Finish"}
              </button>
              <button
                onClick={() => setShowResult(true)}
                className="px-2 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-semibold hover:bg-neutral-700 active:scale-95"
              >
                End rally →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Main capture area */}
      <div className="flex-1 min-h-0 max-w-2xl w-full mx-auto px-3 pt-3 pb-36 md:pb-28">
        {serverPicker ? (
          <ServerPicker onPick={(who) => setServer(who)} />
        ) : (
          <div className="grid grid-cols-2 gap-3 h-full">
            <div className="min-h-0">
              <CourtGrid
                onTap={handleZoneTap}
                active={isEditing ? focused.zone : null}
                armed={!!armedShot && !isEditing}
                editing={isEditing}
              />
            </div>
            <div className="min-h-0">
              <ShotPalette
                mode={paletteMode}
                armedShot={isEditing ? focused.shotType : armedShot}
                onArm={handleShotArm}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar (when no result sheet is open) */}
      {!showResult && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur">
          <div className="max-w-2xl mx-auto px-3 py-2 flex gap-2">
            <BarBtn onClick={handleRestart}>Restart rally</BarBtn>
            <BarBtn onClick={nextSet}>Next set</BarBtn>
            <BarBtn onClick={handleEndMatch} tone="danger">End match</BarBtn>
          </div>
        </div>
      )}

      {showResult && (
        <ResultBar
          result={pendingResult}
          onPickResult={setPendingResult}
          onFinish={handleFinish}
          onCancel={() => { setShowResult(false); setPendingResult(null); }}
        />
      )}
    </div>
  );
}

function BarBtn({ children, onClick, tone }) {
  const cls = tone === "danger"
    ? "border-red-800/70 text-red-300 hover:bg-red-950/50"
    : "border-neutral-700 text-neutral-300 hover:bg-neutral-800";
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg bg-neutral-900 border text-xs font-semibold active:scale-95 ${cls}`}
    >
      {children}
    </button>
  );
}
