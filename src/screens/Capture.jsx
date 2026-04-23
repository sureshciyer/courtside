import { useEffect, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { SHOT_CODES, GRIPS, DIRS, ROLES, roleColor } from "../constants/badminton.js";
import { autoRole, emptyBuild, OPENING_LENGTH } from "../lib/rally.js";
import RallyLog from "../components/RallyLog.jsx";
import {
  Screen, Toast, SLabel, TapBtn, GhostBtn, CourtGrid, Chip, ScoreSide,
} from "../components/ui.jsx";

export default function Capture({ setScreen }) {
  const m = useMatchStore((s) => s.currentMatch);
  const rally = useMatchStore((s) => s.currentRally);
  const adjustScore = useMatchStore((s) => s.adjustScore);
  const setServer = useMatchStore((s) => s.setServer);
  const addShot = useMatchStore((s) => s.addShot);
  const updateShot = useMatchStore((s) => s.updateShot);
  const deleteShot = useMatchStore((s) => s.deleteShot);
  const popShot = useMatchStore((s) => s.popShot);
  const finishRally = useMatchStore((s) => s.finishRally);
  const restartRally = useMatchStore((s) => s.restartRally);
  const nextSet = useMatchStore((s) => s.nextSet);
  const endMatch = useMatchStore((s) => s.endMatch);
  const setRallyResult = useMatchStore((s) => s.setRallyResult);

  const [build, setBuild] = useState(emptyBuild());
  const [editIdx, setEditIdx] = useState(null);
  const [step, setStep] = useState("server");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!m) setScreen("home");
  }, [m, setScreen]);

  if (!m || !rally) return null;

  const set = m.sets[m.currentSet] || { sonScore: 0, oppScore: 0 };
  const isEditing = editIdx !== null;
  const isServe = step === "serve";
  const phase = set.sonScore >= 16 || set.oppScore >= 16;

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const commitShot = (grip, shotType, dir, zone, role) => {
    addShot({ grip, shotType, dir, zone, role });
    setBuild(emptyBuild());
  };
  const commitServe = (shotType, zone) => {
    addShot({ grip: null, shotType, dir: null, zone, role: "opening" });
    setBuild(emptyBuild());
    setStep("shot");
  };

  const applyUpdateShot = () => {
    if (!build.grip || !build.shot || !build.dir || !build.zone) return;
    const role = build.role || autoRole(editIdx, build.shot);
    updateShot(editIdx, { grip: build.grip, shotType: build.shot, dir: build.dir, zone: build.zone, role });
    setBuild(emptyBuild());
    setEditIdx(null);
    flash("Shot updated");
  };
  const applyUpdateServe = () => {
    if (!build.shot || !build.zone) return;
    updateShot(editIdx, { grip: null, shotType: build.shot, dir: null, zone: build.zone, role: "opening" });
    setBuild(emptyBuild());
    setEditIdx(null);
    setStep("shot");
    flash("Serve updated");
  };
  const handleDeleteShot = (i) => {
    deleteShot(i);
    setBuild(emptyBuild());
    setEditIdx(null);
    flash("Shot deleted");
  };
  const handleUndo = () => {
    const popped = popShot();
    if (popped) flash(`Undid ${popped.code}`);
  };
  const editShot = (i) => {
    const s = rally.shots[i];
    if (s.dir === null) {
      setBuild({ grip: null, shot: s.shotType || s.code, dir: null, zone: s.zone, role: s.role });
      setEditIdx(i); setStep("serve");
    } else {
      setBuild({ grip: s.grip, shot: s.shotType, dir: s.dir, zone: s.zone, role: s.role });
      setEditIdx(i); setStep("shot");
    }
  };
  const handleFinishRally = (result, wonBy) => {
    finishRally(result, wonBy);
    setStep("server");
    setBuild(emptyBuild());
    setEditIdx(null);
    flash("Rally saved");
  };
  const handleNextSet = () => {
    nextSet();
    setStep("server");
    setBuild(emptyBuild());
  };
  const handleEndMatch = () => {
    endMatch();
    setScreen("summary");
  };
  const handleRestart = () => {
    restartRally();
    setStep("server");
    setBuild(emptyBuild());
    setEditIdx(null);
  };

  const editDone = isServe ? (build.shot && build.zone) : (build.grip && build.shot && build.dir && build.zone);

  return (
    <Screen>
      <Toast>{toast}</Toast>

      <div style={{ background: "#1B5E20", borderRadius: 14, padding: "10px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#a5d6a7", fontWeight: 600 }}>{m.id} · Set {m.currentSet + 1}</span>
          {phase && <span style={{ fontSize: 10, background: "#ef5350", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>CLUTCH</span>}
          <span style={{ fontSize: 11, color: "#a5d6a7" }}>R{m.rallies.filter((r) => r.set === m.currentSet + 1).length + 1}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <ScoreSide label="SON" score={set.sonScore} onInc={() => adjustScore("S", +1)} onDec={() => adjustScore("S", -1)} />
          <span style={{ fontSize: 20, color: "#4caf50" }}>:</span>
          <ScoreSide label="OPP" score={set.oppScore} onInc={() => adjustScore("O", +1)} onDec={() => adjustScore("O", -1)} />
        </div>
      </div>

      {rally.shots.length > 0 && (
        <div style={{ background: "#fafafa", borderRadius: 10, padding: "8px 10px", marginBottom: 8, border: "1px solid #eee" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {rally.shots.map((s, i) => {
              const [bg, fg] = roleColor(s.role);
              const ed = editIdx === i;
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <button onClick={() => editShot(i)} style={{
                    padding: "3px 8px", borderRadius: 6,
                    border: ed ? `2px solid ${fg}` : "1px solid transparent",
                    background: bg, color: fg, fontFamily: "JetBrains Mono",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none",
                  }}>{s.code}{s.zone ? `—${s.zone}` : ""}</button>
                  {i < rally.shots.length - 1 && <span style={{ color: "#ccc", fontSize: 10 }}>→</span>}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, alignItems: "center" }}>
            <div style={{ fontSize: 10, color: "#90a4ae" }}>Tap a shot to edit</div>
            <button onClick={handleUndo} style={{
              padding: "2px 8px", borderRadius: 6, border: "1px solid #e0e0e0",
              background: "#fff", fontSize: 10, fontWeight: 600, color: "#78909c", cursor: "pointer",
            }}>↶ Undo last</button>
          </div>
        </div>
      )}

      {isEditing && (
        <div style={{ background: "#fff", border: "1.5px solid #e0e0e0", borderRadius: 12, padding: "10px 12px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#37474f" }}>Editing shot {editIdx + 1}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleDeleteShot(editIdx)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ef9a9a", background: "#ffebee", color: "#c62828", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Delete</button>
              <button onClick={() => { setBuild(emptyBuild()); setEditIdx(null); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#f5f5f5", color: "#78909c", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {!isServe && <Chip label={build.grip ? (build.grip === "F" ? "FH" : "BH") : "Grip?"} filled={!!build.grip} color="#37474f" onClick={() => setBuild({ ...build, grip: null, shot: null, dir: null, zone: null })} />}
            <Chip label={build.shot || (isServe ? "Serve?" : "Shot?")} filled={!!build.shot} color="#6a1b9a" onClick={() => isServe ? setBuild({ ...build, shot: null, zone: null }) : setBuild({ ...build, shot: null, dir: null, zone: null })} />
            {!isServe && <Chip label={build.dir ? { ST: "Straight", CR: "Cross", BD: "Body" }[build.dir] : "Dir?"} filled={!!build.dir} color="#e65100" onClick={() => setBuild({ ...build, dir: null, zone: null })} />}
            <Chip label={build.zone ? `Zone ${build.zone}` : "Zone?"} filled={!!build.zone} color="#0d47a1" onClick={() => setBuild({ ...build, zone: null })} />
          </div>
          {!isServe && editIdx >= OPENING_LENGTH && (
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {ROLES.map((r) => {
                const selected = (build.role || autoRole(editIdx, build.shot)) === r.code;
                return (
                  <button key={r.code} onClick={() => setBuild({ ...build, role: r.code })} style={{
                    flex: 1, padding: "5px 2px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
                    border: selected ? `2px solid ${r.c}` : "1px solid #e0e0e0",
                    background: selected ? r.bg : "#fff", color: r.c,
                  }}>{r.label}</button>
                );
              })}
            </div>
          )}
          <button onClick={isServe ? applyUpdateServe : applyUpdateShot} disabled={!editDone} style={{
            width: "100%", padding: 12, borderRadius: 10, border: "none",
            background: editDone ? "#1B5E20" : "#e0e0e0", color: editDone ? "#fff" : "#9e9e9e",
            fontWeight: 700, fontSize: 14, cursor: editDone ? "pointer" : "default",
          }}>Update shot</button>
        </div>
      )}

      {step === "server" && (
        <div>
          <SLabel>Who's serving?</SLabel>
          <div style={{ display: "flex", gap: 8 }}>
            <TapBtn flex label="Son serves" color="#1B5E20" onClick={() => { setServer("S"); setStep("serve"); }} />
            <TapBtn flex label="Opponent serves" color="#546e7a" onClick={() => { setServer("O"); setStep("serve"); }} />
          </div>
        </div>
      )}

      {step === "serve" && !build.shot && (
        <div>
          <SLabel>Serve type</SLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {SHOT_CODES.serve.map((s) => (
              <TapBtn key={s.code} flex label={s.label} sub={s.code} color={s.color} onClick={() => setBuild({ ...build, shot: s.code })} />
            ))}
          </div>
        </div>
      )}

      {step === "serve" && build.shot && !build.zone && (
        <div>
          <SLabel>Where did it land?</SLabel>
          <CourtGrid onTap={(z) => isEditing ? setBuild({ ...build, zone: z }) : commitServe(build.shot, z)} active={isEditing ? build.zone : null} />
        </div>
      )}

      {step === "shot" && !isEditing && !build.grip && (
        <div>
          <SLabel>{rally.shots.length < OPENING_LENGTH ? `Shot ${rally.shots.length + 1} of opening` : "Next shot"}</SLabel>
          {rally.shots.length >= OPENING_LENGTH && (
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {ROLES.map((r) => {
                const selected = (build.role || "neutral") === r.code;
                return (
                  <button key={r.code} onClick={() => setBuild({ ...build, role: r.code })} style={{
                    flex: 1, padding: "5px 2px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
                    border: selected ? `2px solid ${r.c}` : "1px solid #e0e0e0",
                    background: selected ? r.bg : "#fff", color: r.c,
                  }}>{r.label}</button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {GRIPS.map((g) => (
              <TapBtn key={g.code} flex label={g.label} sub={g.code} color="#37474f" onClick={() => setBuild({ ...build, grip: g.code })} />
            ))}
          </div>
        </div>
      )}

      {step === "shot" && !build.shot && build.grip && (
        <div>
          <SLabel>Shot type</SLabel>
          {Object.entries({ "Rear court": SHOT_CODES.rear, "Mid court": SHOT_CODES.mid, "Front court": SHOT_CODES.front }).map(([g, shots]) => (
            <div key={g}>
              <div style={{ fontSize: 10, color: "#90a4ae", marginBottom: 4, marginTop: 6 }}>{g}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {shots.map((s) => (
                  <TapBtn key={s.code} label={s.label} sub={s.code} color={s.color} onClick={() => setBuild({ ...build, shot: s.code })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === "shot" && build.grip && build.shot && !build.dir && (
        <div>
          <SLabel>Direction</SLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {DIRS.map((d) => (
              <TapBtn key={d.code} flex label={d.label} sub={d.code} color="#546e7a" onClick={() => setBuild({ ...build, dir: d.code })} />
            ))}
          </div>
        </div>
      )}

      {step === "shot" && build.grip && build.shot && build.dir && !build.zone && (
        <div>
          <SLabel>Landing zone</SLabel>
          <CourtGrid
            onTap={(z) => isEditing
              ? setBuild({ ...build, zone: z })
              : commitShot(build.grip, build.shot, build.dir, z, build.role)}
            active={isEditing ? build.zone : null}
          />
        </div>
      )}

      {step === "shot" && isEditing && !build.grip && (
        <div>
          <SLabel>Grip</SLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {GRIPS.map((g) => (
              <TapBtn key={g.code} flex label={g.label} sub={g.code} color="#37474f" onClick={() => setBuild({ ...build, grip: g.code })} />
            ))}
          </div>
        </div>
      )}

      {step === "result" && (
        <div>
          <SLabel>How did the rally end?</SLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            <TapBtn label="Winner" sub="W" color="#2e7d32" onClick={() => setRallyResult("W")} active={rally.result === "W"} />
            <TapBtn label="Forced Err" sub="FE" color="#e65100" onClick={() => setRallyResult("FE")} active={rally.result === "FE"} />
            <TapBtn label="Unforced Err" sub="UE" color="#c62828" onClick={() => setRallyResult("UE")} active={rally.result === "UE"} />
          </div>
          <SLabel>Point won by?</SLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <TapBtn flex label="Son" color="#1B5E20" onClick={() => handleFinishRally(rally.result || "W", "S")} />
            <TapBtn flex label="Opponent" color="#546e7a" onClick={() => handleFinishRally(rally.result || "UE", "O")} />
          </div>
          <button onClick={() => { setRallyResult(null); setStep("shot"); }} style={{
            width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e0e0e0",
            background: "#fff", color: "#78909c", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>← Back to shots</button>
        </div>
      )}

      {step !== "result" && step !== "server" && !isEditing && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <GhostBtn onClick={() => setStep("result")}>End rally →</GhostBtn>
          <GhostBtn onClick={handleRestart}>Restart rally</GhostBtn>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <RallyLog rallies={m.rallies} currentSet={m.currentSet + 1} />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <GhostBtn onClick={handleNextSet}>Next set</GhostBtn>
          <GhostBtn onClick={handleEndMatch} danger>End match</GhostBtn>
          <GhostBtn onClick={handleRestart}>Skip rally</GhostBtn>
        </div>
      </div>
    </Screen>
  );
}
