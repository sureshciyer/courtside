import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, BigBtn, Card } from "../components/ui.jsx";

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
      <TopBar title="Export data" onBack={() => setScreen("home")} />

      <Card className="mb-3 text-center">
        <div className="text-3xl mb-1">📊</div>
        <div className="font-bold text-white">
          {matches.length} match{matches.length !== 1 ? "es" : ""} · {total} rallies
        </div>
        <div className="text-[11px] text-neutral-500 mt-1">All data is stored locally — nothing leaves your device.</div>
      </Card>

      <Card tone="accent" className="mb-3">
        <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold mb-2">How to export</div>
        <ol className="text-sm text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>Download a JSON backup, or copy data for chat analysis</li>
          <li>For chat: paste into a new message here</li>
          <li>Claude will return a CSV you can download</li>
        </ol>
      </Card>

      <BigBtn tone="primary" onClick={downloadJson}>Download match JSON</BigBtn>
      <BigBtn tone="info" onClick={copyData}>
        {copied ? "Copied — paste in chat" : "Copy data for chat analysis"}
      </BigBtn>
      {copied && (
        <p className="text-center text-emerald-400 text-xs font-semibold mt-1">Now switch to the chat and paste</p>
      )}

      <button
        onClick={() => setShowData(!showData)}
        className="text-center text-xs text-neutral-500 hover:text-neutral-300 underline mt-4 self-center"
      >
        {showData ? "Hide raw data" : "If copy doesn't work, show the data"}
      </button>

      {showData && (
        <div className="mt-3">
          <p className="text-[11px] text-neutral-500 mb-2">Select all text below, copy, and paste into the chat:</p>
          <textarea
            readOnly
            value={payload}
            className="w-full min-h-[160px] p-3 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 text-[11px] font-mono resize-y"
          />
        </div>
      )}
    </Screen>
  );
}
