import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, BigBtn, Card } from "../components/ui.jsx";

export default function Home({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const currentMatch = useMatchStore((s) => s.currentMatch);
  const totalRallies = matches.reduce((a, m) => a + m.rallies.length, 0);
  const n = matches.length;
  const active = currentMatch && !currentMatch.completed;

  return (
    <Screen>
      <div className="text-center pt-6 pb-4">
        <div className="text-5xl mb-1">🏸</div>
        <h1 className="font-extrabold text-3xl text-white tracking-tight">Courtside</h1>
        <p className="text-xs text-neutral-500 tracking-wider uppercase">Tactical notation</p>
      </div>

      {active && (
        <Card tone="accent" className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Live match</div>
              <div className="font-bold text-white truncate">vs {currentMatch.opponent || "…"}</div>
              <div className="text-xs text-neutral-400">
                {currentMatch.id} · Set {currentMatch.currentSet + 1} · {currentMatch.rallies.length} rallies
              </div>
            </div>
            <button
              onClick={() => setScreen("capture")}
              className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm active:scale-95"
            >
              Resume →
            </button>
          </div>
        </Card>
      )}

      <BigBtn tone="primary" onClick={() => setScreen("setup")}>New match</BigBtn>
      {n > 0 && (
        <>
          <BigBtn tone="secondary" onClick={() => setScreen("history")}>
            Match history
            <span className="ml-2 font-mono text-emerald-400 text-xs">({n})</span>
          </BigBtn>
          <BigBtn tone="violet" onClick={() => setScreen("patterns")}>
            Patterns & tactical intelligence
          </BigBtn>
          <BigBtn tone="secondary" onClick={() => setScreen("exportScreen")}>
            Export / Download JSON
          </BigBtn>
        </>
      )}

      <div className="mt-auto pt-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-semibold">
          {n} match{n !== 1 ? "es" : ""} · {totalRallies} rallies stored
        </div>
      </div>
    </Screen>
  );
}
