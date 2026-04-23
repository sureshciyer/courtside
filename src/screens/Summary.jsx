import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Stat, BigBtn } from "../components/ui.jsx";

export default function Summary({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const m = matches[matches.length - 1];
  if (!m) { setScreen("home"); return null; }

  const r = m.rallies;
  const w = r.filter((x) => x.pointWonBy === "S").length;
  const l = r.filter((x) => x.pointWonBy === "O").length;
  const ue = r.filter((x) => x.result === "UE" && x.pointWonBy === "O").length;
  const wn = r.filter((x) => x.result === "W" && x.pointWonBy === "S").length;
  const cl = r.filter((x) => x.phase === "Clutch");
  const cw = cl.filter((x) => x.pointWonBy === "S").length;
  const avg = r.length > 0 ? (r.reduce((a, x) => a + x.shots.length, 0) / r.length).toFixed(1) : 0;

  return (
    <Screen>
      <TopBar title="Match summary" onBack={() => setScreen("home")} />
      <div style={{ background: "#1B5E20", borderRadius: 14, padding: "10px 16px", marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#a5d6a7" }}>{m.id} · vs {m.opponent}</div>
        <div>{m.sets.map((s, i) => <span key={i} style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 8px" }}>{s.sonScore}-{s.oppScore}</span>)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <Stat label="Rallies" value={r.length} />
        <Stat label="Won" value={w} color="#4caf50" />
        <Stat label="Lost" value={l} color="#ef5350" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <Stat label="Winners" value={wn} color="#1B5E20" />
        <Stat label="Unforced Err" value={ue} color="#c62828" />
        <Stat label="Avg rally" value={avg} />
      </div>
      {cl.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <Stat label="Clutch pts" value={cl.length} />
          <Stat label="Clutch won" value={`${cw}/${cl.length}`} color={cw >= cl.length / 2 ? "#4caf50" : "#ef5350"} />
        </div>
      )}
      <BigBtn bg="#e3f2fd" color="#0d47a1" onClick={() => setScreen("home")}>Done</BigBtn>
    </Screen>
  );
}
