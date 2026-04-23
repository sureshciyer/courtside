import { useMemo, useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { PLAYER_STYLES } from "../lib/rally.js";
import { winningSequences, errorZones, shotTypeFrequency } from "../lib/analytics.js";
import { ZONES } from "../constants/badminton.js";
import { Screen, TopBar, Select } from "../components/ui.jsx";

// Minimal Patterns screen — shows winning sequences and the error-zone heatmap.
// Will be replaced with a richer dashboard once core UI is in place.
export default function Patterns({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const [styleFilter, setStyleFilter] = useState("All");
  const [n, setN] = useState(3);

  const rallies = useMemo(() => {
    const filtered = styleFilter === "All"
      ? matches
      : matches.filter((m) => (m.playerStyle || "Unknown") === styleFilter);
    return filtered.flatMap((m) => m.rallies);
  }, [matches, styleFilter]);

  const winSeqs = useMemo(() => winningSequences(rallies, n).slice(0, 10), [rallies, n]);
  const zones = useMemo(() => errorZones(rallies), [rallies]);
  const maxZ = Math.max(1, ...zones);
  const shotFreq = useMemo(() => shotTypeFrequency(rallies).slice(0, 8), [rallies]);

  return (
    <Screen>
      <TopBar title="Patterns" onBack={() => setScreen("home")} />
      <Select
        label="Opponent style filter"
        value={styleFilter}
        onChange={setStyleFilter}
        options={["All", ...PLAYER_STYLES]}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#78909c" }}>Sequence length:</span>
        {[2, 3, 4].map((v) => (
          <button key={v} onClick={() => setN(v)} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: n === v ? "2px solid #1B5E20" : "1px solid #e0e0e0",
            background: n === v ? "#E8F5E9" : "#fff", color: "#1B5E20",
          }}>{v}</button>
        ))}
      </div>

      <Section title={`Winning sequences (${n}-gram)`}>
        {winSeqs.length === 0 ? (
          <Empty>Not enough winning rallies yet</Empty>
        ) : winSeqs.map((s) => (
          <div key={s.seq} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#f1f8f1", borderRadius: 6, marginBottom: 4, fontFamily: "JetBrains Mono", fontSize: 12 }}>
            <span>{s.seq}</span><span style={{ fontWeight: 700 }}>×{s.count}</span>
          </div>
        ))}
      </Section>

      <Section title="Error zones (unforced)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, maxWidth: 260, margin: "0 auto" }}>
          {ZONES.map((z) => {
            const c = zones[z.n];
            const intensity = c / maxZ; // 0..1
            const bg = c === 0 ? "#fafafa" : `rgba(239,83,80,${0.15 + 0.6 * intensity})`;
            return (
              <div key={z.n} style={{
                padding: "14px 4px", borderRadius: 8, textAlign: "center",
                border: "1px solid #eee", background: bg,
              }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#b71c1c" }}>{c || "·"}</div>
                <div style={{ fontSize: 10, color: "#90a4ae" }}>{z.l}</div>
              </div>
            );
          })}
          <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: 10, color: "#bdbdbd" }}>↑ NET ↑</div>
        </div>
      </Section>

      <Section title="Shot frequency">
        {shotFreq.length === 0 ? (
          <Empty>No shots yet</Empty>
        ) : shotFreq.map((s) => (
          <div key={s.code} style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", fontFamily: "JetBrains Mono", fontSize: 12 }}>
            <span>{s.code}</span><span style={{ fontWeight: 700 }}>{s.count}</span>
          </div>
        ))}
      </Section>
    </Screen>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#37474f", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}
function Empty({ children }) {
  return <div style={{ fontSize: 12, color: "#90a4ae", textAlign: "center", padding: 10 }}>{children}</div>;
}
