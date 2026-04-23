import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, BigBtn } from "../components/ui.jsx";

export default function Export({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const [showData, setShowData] = useState(false);
  const [copied, setCopied] = useState(false);
  const total = matches.reduce((a, m) => a + m.rallies.length, 0);

  const exportJson = JSON.stringify(matches, null, 0);
  const payload =
    "Here is my match data from the Courtside app. Please analyze it and generate a downloadable CSV file.\n\n" +
    "__COURTSIDE_EXPORT__\n" + exportJson + "\n__END_EXPORT__";

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowData(true);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(matches, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `courtside-matches-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Screen>
      <TopBar title="Export" onBack={() => setScreen("home")} />
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
        <p style={{ fontSize: 13, color: "#78909c" }}>
          {matches.length} match{matches.length !== 1 ? "es" : ""} · {total} rallies
        </p>
      </div>

      <div style={{ background: "#f5f5f5", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: "#546e7a", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "#37474f", marginBottom: 6 }}>How to export:</div>
        1. Download a JSON backup, or copy data for analysis<br />
        2. For chat analysis: paste the copied text as a new message<br />
        3. Claude will return a CSV you can download
      </div>

      <BigBtn bg="#1B5E20" color="#fff" onClick={downloadJson}>Download Match JSON</BigBtn>
      <BigBtn bg="#e3f2fd" color="#0d47a1" onClick={copyData}>
        {copied ? "Copied! Now paste in chat" : "Copy data for chat analysis"}
      </BigBtn>

      {copied && (
        <p style={{ textAlign: "center", color: "#4caf50", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
          Now switch to the chat and paste (long-press → Paste)
        </p>
      )}

      <div style={{ marginTop: 8 }}>
        <button onClick={() => setShowData(!showData)} style={{
          background: "none", border: "none", color: "#90a4ae", fontSize: 12,
          cursor: "pointer", textDecoration: "underline", fontFamily: "Outfit",
        }}>
          {showData ? "Hide raw data" : "If copy doesn't work, tap here to show data"}
        </button>
      </div>

      {showData && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, color: "#78909c", marginBottom: 6 }}>
            Select all the text below, copy it, and paste it in the chat:
          </p>
          <textarea readOnly value={payload} style={{
            width: "100%", minHeight: 150, padding: 10, borderRadius: 8,
            border: "1px solid #e0e0e0", fontSize: 11, fontFamily: "JetBrains Mono",
            resize: "vertical", boxSizing: "border-box", background: "#fafafa", color: "#333",
          }} />
        </div>
      )}
    </Screen>
  );
}
