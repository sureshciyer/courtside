import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, BigBtn } from "../components/ui.jsx";

export default function Home({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const currentMatch = useMatchStore((s) => s.currentMatch);
  const n = matches.length;
  const active = currentMatch && !currentMatch.completed;

  return (
    <Screen>
      <div style={{ textAlign: "center", padding: "2rem 0 1rem" }}>
        <div style={{ fontSize: 36 }}>🏸</div>
        <h1 style={{ fontWeight: 800, fontSize: 28, color: "#1B5E20", margin: 0 }}>Courtside</h1>
        <p style={{ fontSize: 14, color: "#78909c", marginTop: 2 }}>Badminton match notation</p>
      </div>
      {active && (
        <BigBtn bg="#E8F5E9" color="#1B5E20" onClick={() => setScreen("capture")}>
          Resume vs {currentMatch.opponent || "..."}
        </BigBtn>
      )}
      <BigBtn bg="#e3f2fd" color="#0d47a1" onClick={() => setScreen("setup")}>New match</BigBtn>
      {n > 0 && (
        <>
          <BigBtn bg="#f3e5f5" color="#4a148c" onClick={() => setScreen("history")}>Match history ({n})</BigBtn>
          <BigBtn bg="#fff3e0" color="#e65100" onClick={() => setScreen("patterns")}>Patterns</BigBtn>
          <BigBtn bg="#fbe9e7" color="#bf360c" onClick={() => setScreen("exportScreen")}>Export / Download</BigBtn>
        </>
      )}
      <div style={{ marginTop: "auto", textAlign: "center", padding: "1rem 0" }}>
        <p style={{ fontSize: 11, color: "#90a4ae" }}>{n} match{n !== 1 ? "es" : ""} stored</p>
      </div>
    </Screen>
  );
}
