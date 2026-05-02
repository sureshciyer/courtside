import { useEffect, useRef, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import {
  autoRole,
  OPENING_LENGTH,
  guessGrip,
  suggestDirection,
  cycleGrip,
  cycleDirection,
} from "../lib/rally.js";
import {
  DISRUPTION_SHOTS,
  SHOT_CODES,
  SHOT_HOTKEYS_RALLY,
  SHOT_HOTKEYS_SERVE,
} from "../constants/badminton.js";
import Scoreboard from "../components/capture/Scoreboard.jsx";
import Timeline from "../components/capture/Timeline.jsx";
import CourtGrid from "../components/capture/CourtGrid.jsx";
import ShotPalette from "../components/capture/ShotPalette.jsx";
import QualityToggle from "../components/capture/QualityToggle.jsx";
import DeceptionToggle from "../components/capture/DeceptionToggle.jsx";
import ServerPicker from "../components/capture/ServerPicker.jsx";
import ResultBar from "../components/capture/ResultBar.jsx";
import RallyLogSheet from "../components/capture/RallyLogSheet.jsx";

const SERVE_CODES = new Set(SHOT_CODES.serve.map((s) => s.code));

export default function Capture({ setScreen }) {
  const m = useMatchStore((s) => s.currentMatch);
  const rally = useMatchStore((s) => s.currentRally);
  const handedness = useMatchStore((s) => s.settings?.handedness) || "R";
  const setServer = useMatchStore((s) => s.setServer);
  const addShot = useMatchStore((s) => s.addShot);
  const updateShot = useMatchStore((s) => s.updateShot);
  const deleteShot = useMatchStore((s) => s.deleteShot);
  const popShot = useMatchStore((s) => s.popShot);
  const setShotQuality = useMatchStore((s) => s.setShotQuality);
  const setShotDeception = useMatchStore((s) => s.setShotDeception);
  const finishRally = useMatchStore((s) => s.finishRally);
  const restartRally = useMatchStore((s) => s.restartRally);
  const nextSet = useMatchStore((s) => s.nextSet);
  const endMatch = useMatchStore((s) => s.endMatch);
  const pauseCurrentMatch = useMatchStore((s) => s.pauseCurrentMatch);

  // --- local UI state (transient; not persisted) ---
  const [armedShot, setArmedShot] = useState(null);     // shot type waiting for a zone
  const [quality, setQuality] = useState("Neutral");    // default quality for the next commit
  const [deception, setDeception] = useState("none");   // default deception tag for the next commit (resets after each commit)
  const [direction, setDirection] = useState("ST");     // sticky direction for the next commit
  const [dirOverridden, setDirOverridden] = useState(false); // user manually touched direction during the current arm
  const [focusedIdx, setFocusedIdx] = useState(null);
  const [finishAfter, setFinishAfter] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [gridFlipped, setGridFlipped] = useState(false); // visual-only: rotates the CourtGrid 180° for video notation when son is on the far side
  const [toast, setToast] = useState(null);
  // Show a one-time hint banner when this Capture mounts on a match that
  // already has saved rallies (typical for Reopen / Resume). Dismissible,
  // and auto-dismissed once the user commits a new shot.
  const [showHistoryHint, setShowHistoryHint] = useState(
    () => (m?.rallies?.length || 0) > 0
  );

  useEffect(() => { if (!m) setScreen("home"); }, [m, setScreen]);

  // ---------- keyboard shortcuts (V1) ----------
  // We install a single global keydown listener once and dispatch through a
  // ref so the listener stays stable while reading the latest closures every
  // render. This pattern lets us keep the existing `if (!m || !rally) return
  // null` early-return below without breaking the rules-of-hooks ordering.
  const onKeyRef = useRef(() => {});
  useEffect(() => {
    const handler = (e) => onKeyRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (!m || !rally) return null;

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400); };
  const isFirstShot = rally.shots.length === 0;
  const isEditing = focusedIdx !== null;
  const focused = isEditing ? rally.shots[focusedIdx] : null;
  const paletteMode = isEditing
    ? SERVE_CODES.has(focused?.shotType) ? "serve" : "shot"
    : isFirstShot ? "serve" : "shot";

  const prevZone = rally.shots.length > 0 ? rally.shots[rally.shots.length - 1].zone : null;
  const prevGrip = rally.shots.length > 0 ? rally.shots[rally.shots.length - 1].grip : null;

  // ---------- commit / edit handlers ----------
  const commitNewShot = (shotType, zone) => {
    const isServeShot = paletteMode === "serve" && isFirstShot;
    let shotGrip = null;
    let shotDir = null;
    if (!isServeShot) {
      shotGrip = guessGrip(zone, prevGrip, handedness);
      // If the user manually set a direction this arm cycle, respect that.
      // Otherwise auto-suggest from the prev vs next zone sides.
      shotDir = dirOverridden ? direction : suggestDirection(prevZone, zone, direction);
    }
    addShot({
      grip: shotGrip,
      shotType,
      dir: shotDir,
      zone,
      role: isServeShot ? "opening" : autoRole(rally.shots.length, shotType),
      quality,
      deceptionType: deception,
    });
    // Reset arm state; carry direction forward as the new sticky default.
    // Deception is *not* sticky — most shots aren't deceptive, so we reset
    // each commit to avoid silently tagging unrelated shots.
    setArmedShot(null);
    setDirOverridden(false);
    if (shotDir) setDirection(shotDir);
    setDeception("none");
    // Once the user has committed a shot they've engaged with the screen;
    // the "we kept your old data" banner has done its job.
    if (showHistoryHint) setShowHistoryHint(false);
    if (finishAfter) {
      setFinishAfter(false);
      setShowResult(true);
    }
  };

  const handleZoneTap = (zone) => {
    if (isEditing) {
      // Also re-guess grip + direction when zone moves during an edit.
      const patch = { zone };
      if (!SERVE_CODES.has(focused.shotType)) {
        patch.grip = guessGrip(zone, focused.grip, handedness);
        patch.dir = suggestDirection(
          focusedIdx > 0 ? rally.shots[focusedIdx - 1].zone : null,
          zone,
          focused.dir || "ST",
        );
      }
      updateShot(focusedIdx, patch);
      flash(`Zone → ${zone}`);
      return;
    }
    if (!armedShot) { flash("Pick a shot first"); return; }
    commitNewShot(armedShot, zone);
  };

  const handleShotArm = (shotType) => {
    if (isEditing) {
      const patch = { shotType };
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

  const handleDirectionChange = (d) => {
    if (isEditing) {
      updateShot(focusedIdx, { dir: d });
      flash(`Dir → ${d}`);
      return;
    }
    setDirection(d);
    setDirOverridden(true);
  };

  const handleQualityChange = (q) => {
    if (isEditing) {
      setShotQuality(focusedIdx, q);
      flash(`Quality → ${q[0]}`);
    } else {
      setQuality(q);
    }
  };

  const handleDeceptionChange = (dt) => {
    if (isEditing) {
      setShotDeception(focusedIdx, dt);
      flash(`Decep → ${dt === "none" ? "—" : dt}`);
    } else {
      setDeception(dt);
    }
  };

  const handleCycleGrip = (i) => {
    const s = rally.shots[i];
    if (SERVE_CODES.has(s.shotType)) return;
    const next = cycleGrip(s.grip);
    updateShot(i, { grip: next });
    flash(`Grip → ${next === "F" ? "Forehand" : "Backhand"}`);
  };

  const handleCycleDir = (i) => {
    const s = rally.shots[i];
    if (SERVE_CODES.has(s.shotType)) return;
    const next = cycleDirection(s.dir);
    updateShot(i, { dir: next });
    flash(`Dir → ${next}`);
  };

  const handleUndo = () => {
    const popped = popShot();
    if (popped) flash(`Undid ${popped.code}`);
    setArmedShot(null);
    setFocusedIdx(null);
    setDirOverridden(false);
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
    setDirection("ST");
    setDirOverridden(false);
    setDeception("none");
    flash("Rally saved");
  };

  const handleRestart = () => {
    restartRally();
    setArmedShot(null);
    setFocusedIdx(null);
    setShowResult(false);
    setFinishAfter(false);
    setDirection("ST");
    setDirOverridden(false);
    setDeception("none");
  };

  const handleEndMatch = () => { endMatch(); setScreen("summary"); };

  const handlePauseMatch = () => {
    pauseCurrentMatch();
    setScreen("home");
  };

  // ---------- render ----------
  const serverPicker = !rally.server && rally.shots.length === 0;
  const focusedQuality = focused?.quality || "Neutral";
  const focusedDeception = focused?.deceptionType || "none";
  const displayDirection = isEditing ? (focused.dir || "ST") : direction;

  // Keyboard handler — assigned to the ref every render so it captures the
  // latest closures (state setters, derived values, handler closures).
  // Rally mode: 12-letter shot map + 1–9 zones + Backspace/Esc/Enter.
  // Serve mode: q/w/e for LS/FS/DS plus 1–9 zones.
  // Result-bar mode (when showResult): w/f/u pick result type, s/o pick winner,
  // Enter confirms with a sensible default winner, Esc cancels.
  onKeyRef.current = (e) => {
    const isTypingTarget = (el) =>
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (isTypingTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Tab") return; // let the browser handle focus traversal
    if (serverPicker) return;

    if (showResult) {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        e.preventDefault();
        setShowResult(false);
        setPendingResult(null);
        return;
      }
      if (k === "w") { e.preventDefault(); setPendingResult("W");  return; }
      if (k === "f") { e.preventDefault(); setPendingResult("FE"); return; }
      if (k === "u") { e.preventDefault(); setPendingResult("UE"); return; }
      if (k === "s") { e.preventDefault(); handleFinish(pendingResult || "W",  "S"); return; }
      if (k === "o") { e.preventDefault(); handleFinish(pendingResult || "UE", "O"); return; }
      if (k === "enter") {
        e.preventDefault();
        const winner = pendingResult === "UE" ? "O" : "S";
        handleFinish(pendingResult || "W", winner);
      }
      return;
    }

    const k = e.key.toLowerCase();

    if (k === "escape") {
      e.preventDefault();
      if (isEditing) setFocusedIdx(null);
      else setArmedShot(null);
      return;
    }

    if (k === "backspace") {
      e.preventDefault();
      handleUndo();
      return;
    }

    if (k === "enter") {
      e.preventDefault();
      if (!isEditing) setShowResult(true);
      return;
    }

    if (e.key >= "1" && e.key <= "9") {
      const zone = Number(e.key);
      if (!isEditing && !armedShot) return;
      e.preventDefault();
      handleZoneTap(zone);
      return;
    }

    const map = paletteMode === "serve" ? SHOT_HOTKEYS_SERVE : SHOT_HOTKEYS_RALLY;
    const shotType = map[k];
    if (shotType) {
      e.preventDefault();
      handleShotArm(shotType);
    }
  };

  return (
    <div className="capture-dark min-h-screen flex flex-col bg-neutral-950 text-neutral-100 font-display">
      {toast && (
        <div className="cs-toast fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}

      <Scoreboard onBack={() => setScreen("home")} />

      {showHistoryHint && (
        <div className="bg-amber-950/40 border-b border-amber-800/60 px-3 py-2 text-[12px] text-amber-100 leading-snug flex items-start gap-2">
          <div className="flex-1">
            <span className="font-bold text-amber-300">Reopened — </span>
            {m.rallies.length} saved rall{m.rallies.length !== 1 ? "ies" : "y"} carried over (
            {m.sets.map((s, i) => {
              const n = m.rallies.filter((r) => r.set === i + 1).length;
              return `Set ${i + 1}: ${n}`;
            }).join(" · ")}
            ). Tap <span className="font-mono font-bold">📋 Log</span> below to see them. Tap <span className="font-mono font-bold">Next set</span> to begin a new set.
          </div>
          <button
            onClick={() => setShowHistoryHint(false)}
            className="shrink-0 px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700 text-amber-200 text-[10px] font-bold hover:bg-amber-900"
          >
            ✕
          </button>
        </div>
      )}

      <Timeline
        shots={rally.shots}
        focusedIdx={focusedIdx}
        onFocus={(i) => { setFocusedIdx(focusedIdx === i ? null : i); setArmedShot(null); }}
        onUndo={handleUndo}
        onCycleGrip={handleCycleGrip}
        onCycleDir={handleCycleDir}
      />

      {/* Edit / capture toolbar */}
      <div className="px-3 py-2 bg-neutral-900/70 border-b border-neutral-800 flex items-center justify-between gap-3">
        {isEditing ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Editing #{focusedIdx + 1}</span>
              <span className="font-mono text-sm text-neutral-200 truncate">{focused.code} · Z{focused.zone}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <QualityToggle value={focusedQuality} onChange={handleQualityChange} label="" />
              <DeceptionToggle value={focusedDeception} onChange={handleDeceptionChange} label="" />
              <button onClick={handleDeleteFocused} className="px-2 py-1.5 rounded-md bg-red-900/50 border border-red-700/60 text-red-200 text-xs font-semibold hover:bg-red-900 active:scale-95">Delete</button>
              <button onClick={() => setFocusedIdx(null)} className="px-2 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold hover:bg-neutral-700 active:scale-95">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <QualityToggle value={quality} onChange={handleQualityChange} />
              <DeceptionToggle value={deception} onChange={handleDeceptionChange} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLog(true)}
                className="px-2 py-1.5 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 text-[11px] font-semibold hover:bg-neutral-800 active:scale-95"
                title="Review finished rallies in this set"
              >
                📋 Log
                {m.rallies.filter((r) => r.set === m.currentSet + 1).length > 0 && (
                  <span className="ml-1 font-mono text-emerald-400">
                    {m.rallies.filter((r) => r.set === m.currentSet + 1).length}
                  </span>
                )}
              </button>
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
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
                  Zone
                  {gridFlipped && (
                    <span className="ml-1.5 text-amber-400 normal-case tracking-normal">· flipped</span>
                  )}
                </div>
                <button
                  onClick={() => setGridFlipped((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition active:scale-95 ${gridFlipped ? "bg-amber-950/60 border-amber-700 text-amber-200" : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
                  title="Rotate the grid 180° — use when son is on the far side of your camera view"
                >
                  ⇅ Flip
                </button>
              </div>
              <CourtGrid
                onTap={handleZoneTap}
                active={isEditing ? focused.zone : null}
                armed={!!armedShot && !isEditing}
                editing={isEditing}
                flipped={gridFlipped}
              />
            </div>
            <div className="min-h-0 flex flex-col">
              <ShotPalette
                mode={paletteMode}
                armedShot={isEditing ? focused.shotType : armedShot}
                onArm={handleShotArm}
                direction={displayDirection}
                onDirectionChange={handleDirectionChange}
              />
            </div>
          </div>
        )}
      </div>

      {!showResult && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur">
          <div className="max-w-2xl mx-auto px-3 py-2 flex gap-2">
            <BarBtn onClick={handleRestart}>Restart rally</BarBtn>
            <BarBtn onClick={nextSet}>Next set</BarBtn>
            <BarBtn onClick={handlePauseMatch} tone="warn">⏸ Pause</BarBtn>
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

      {showLog && (
        <RallyLogSheet
          rallies={m.rallies}
          currentSet={m.currentSet + 1}
          onClose={() => setShowLog(false)}
        />
      )}
    </div>
  );
}

function BarBtn({ children, onClick, tone }) {
  const cls = tone === "danger"
    ? "border-red-800/70 text-red-300 hover:bg-red-950/50"
    : tone === "warn"
    ? "border-amber-800/70 text-amber-300 hover:bg-amber-950/50"
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
