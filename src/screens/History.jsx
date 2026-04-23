import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar } from "../components/ui.jsx";

export default function History({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  return (
    <Screen>
      <TopBar title="Match history" onBack={() => setScreen("home")} />
      {matches.length === 0 && (
        <p style={{ color: "#90a4ae", textAlign: "center", marginTop: "2rem" }}>No matches yet</p>
      )}
      {[...matches].reverse().map((m, i) => {
        const w = m.rallies.filter((r) => r.pointWonBy === "S").length;
        const l = m.rallies.filter((r) => r.pointWonBy === "O").length;
        return (
          <div key={i} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#90a4ae" }}>{m.id}</span>
              <span style={{ fontSize: 11, color: "#90a4ae" }}>{m.date}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, margin: "4px 0" }}>vs {m.opponent}</div>
            <div style={{ fontSize: 13, color: "#546e7a" }}>
              {m.sets.map((s) => `${s.sonScore}-${s.oppScore}`).join(", ")}
              <span style={{ marginLeft: 8, color: w > l ? "#4caf50" : "#ef5350" }}>({w}W-{l}L)</span>
            </div>
            {m.tournament && <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 2 }}>{m.tournament}</div>}
            {m.playerStyle && m.playerStyle !== "Unknown" && (
              <div style={{ fontSize: 11, color: "#e65100", marginTop: 2 }}>Opponent style: {m.playerStyle}</div>
            )}
          </div>
        );
      })}
    </Screen>
  );
}
