import { useState } from "react";
import { roleColor } from "../constants/badminton.js";

export default function RallyLog({ rallies, currentSet }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  if (rallies.length === 0) return null;

  const setRallies = rallies.filter((r) => r.set === currentSet);
  const prevRallies = rallies.filter((r) => r.set !== currentSet);
  const displaySet = showAll ? rallies : setRallies;

  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "8px 12px", background: "#f8f9fa", border: "none", cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#37474f", fontFamily: "Outfit" }}>
          Rally log ({rallies.length} total{setRallies.length !== rallies.length ? ` · ${setRallies.length} this set` : ""})
        </span>
        <span style={{ fontSize: 11, color: "#90a4ae", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
      </button>
      {open && (
        <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 8px 8px" }}>
          {prevRallies.length > 0 && !showAll && (
            <button onClick={() => setShowAll(true)} style={{
              width: "100%", padding: 6, marginBottom: 4, background: "none",
              border: "1px dashed #ddd", borderRadius: 6, fontSize: 11, color: "#90a4ae",
              cursor: "pointer", fontFamily: "Outfit",
            }}>Show earlier sets ({prevRallies.length} rallies)</button>
          )}
          {showAll && prevRallies.length > 0 && (
            <button onClick={() => setShowAll(false)} style={{
              width: "100%", padding: 6, marginBottom: 4, background: "none",
              border: "1px dashed #ddd", borderRadius: 6, fontSize: 11, color: "#90a4ae",
              cursor: "pointer", fontFamily: "Outfit",
            }}>Hide earlier sets</button>
          )}
          {displaySet.map((r, i) => {
            const won = r.pointWonBy === "S";
            return (
              <div key={i} style={{
                padding: "6px 8px", marginBottom: 3, borderRadius: 6,
                background: won ? "#f1f8f1" : "#fef5f5",
                borderLeft: `3px solid ${won ? "#4caf50" : "#ef5350"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#555", fontFamily: "Outfit" }}>
                    {showAll && r.set !== currentSet ? `S${r.set} ` : ""}
                    {r.score} · R{(showAll ? rallies : setRallies).indexOf(r) + 1}
                  </span>
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: won ? "#4caf50" : "#ef5350", fontFamily: "Outfit" }}>{r.result}</span>
                    <span style={{ fontSize: 10, color: won ? "#4caf50" : "#ef5350", fontFamily: "Outfit" }}>{won ? "SON" : "OPP"}</span>
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
                  {r.shots.map((s, j) => {
                    const [bg, fg] = roleColor(s.role);
                    return (
                      <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <span style={{
                          padding: "1px 5px", borderRadius: 4, background: bg, color: fg,
                          fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 600,
                        }}>{s.code}{s.zone ? `—${s.zone}` : ""}</span>
                        {j < r.shots.length - 1 && <span style={{ color: "#ddd", fontSize: 9 }}>→</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
