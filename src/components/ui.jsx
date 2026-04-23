import { ZONES } from "../constants/badminton.js";

export function Screen({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "12px 16px" }}>
      {children}
    </div>
  );
}

export function TopBar({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: 4 }}>←</button>
      <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{title}</span>
      {right}
    </div>
  );
}

export function BigBtn({ children, bg, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: 14, borderRadius: 12, border: "none",
      background: bg, color, fontWeight: 700, fontSize: 15,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
      marginBottom: 8, fontFamily: "Outfit",
    }}>{children}</button>
  );
}

export function GhostBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 10, borderRadius: 8,
      border: `1px solid ${danger ? "#ef9a9a" : "#e0e0e0"}`,
      background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
      color: danger ? "#ef5350" : "#78909c", fontFamily: "Outfit",
    }}>{children}</button>
  );
}

export function TapBtn({ label, sub, color, onClick, flex, active }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 14px", borderRadius: 10,
      border: active ? `2px solid ${color}` : `1.5px solid ${color}22`,
      background: active ? `${color}22` : `${color}08`,
      cursor: "pointer", textAlign: "center",
      flex: flex ? 1 : undefined, minWidth: flex ? 0 : undefined,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, color }}>{label}</div>
      {sub && <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: `${color}99`, marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

export function SLabel({ children }) {
  return <div style={{ fontWeight: 600, fontSize: 13, color: "#37474f", marginBottom: 8 }}>{children}</div>;
}

export function Badge({ children }) {
  return (
    <div style={{
      fontFamily: "JetBrains Mono", fontSize: 12, color: "#1B5E20",
      background: "#E8F5E9", padding: "4px 10px", borderRadius: 6,
      display: "inline-block", marginBottom: 12, fontWeight: 600,
    }}>{children}</div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#78909c", marginBottom: 4 }}>{label}</div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0",
          fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "Outfit",
        }}
      />
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#78909c", marginBottom: 4 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0",
          fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "Outfit", background: "#fff",
        }}
      >
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  );
}

export function Chip({ label, filled, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: filled ? `1.5px solid ${color}` : "1.5px dashed #bdbdbd",
      background: filled ? `${color}12` : "#fff",
      color: filled ? color : "#bdbdbd", fontFamily: "Outfit",
    }}>{label}{filled && " ✕"}</button>
  );
}

export function CourtGrid({ onTap, active }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, maxWidth: 260, margin: "0 auto 8px" }}>
      {ZONES.map((z) => (
        <button key={z.n} onClick={() => onTap(z.n)} style={{
          padding: "14px 4px", borderRadius: 8, textAlign: "center", cursor: "pointer",
          border: active === z.n ? "2px solid #0d47a1" : "1.5px solid #e0e0e0",
          background: active === z.n ? "#e3f2fd" : "#fafafa",
        }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: active === z.n ? "#0d47a1" : "#37474f" }}>{z.n}</div>
          <div style={{ fontSize: 10, color: "#90a4ae" }}>{z.l}</div>
        </button>
      ))}
      <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: 10, color: "#bdbdbd" }}>↑ NET ↑</div>
    </div>
  );
}

export function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#f5f5f5", borderRadius: 10, padding: 10, textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#90a4ae", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 20, color: color || "#37474f" }}>{value}</div>
    </div>
  );
}

export function ScoreSide({ label, score, onInc, onDec }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#a5d6a7" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onDec} style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid #4caf50", background: "transparent", color: "#a5d6a7", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>−</button>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", fontFamily: "Outfit", minWidth: 40 }}>{score}</div>
        <button onClick={onInc} style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid #4caf50", background: "transparent", color: "#a5d6a7", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>+</button>
      </div>
    </div>
  );
}

export function Toast({ children }) {
  if (!children) return null;
  return (
    <div className="cs-toast" style={{
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 99, background: "#1B5E20", color: "#fff",
      padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600,
    }}>{children}</div>
  );
}
