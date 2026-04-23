import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card, Badge } from "../components/ui.jsx";

export default function History({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  return (
    <Screen>
      <TopBar title="Match history" subtitle={`${matches.length} completed`} onBack={() => setScreen("home")} />
      {matches.length === 0 && (
        <div className="text-center text-neutral-500 mt-10 text-sm">No matches yet — start one from the home screen.</div>
      )}
      <div className="flex flex-col gap-2">
        {[...matches].reverse().map((m) => {
          const w = m.rallies.filter((r) => r.pointWonBy === "S").length;
          const l = m.rallies.filter((r) => r.pointWonBy === "O").length;
          const setWins = m.sets.filter((s) => s.sonScore > s.oppScore).length;
          const matchWon = setWins > m.sets.length / 2;
          return (
            <Card key={m.id} tone={matchWon ? "accent" : "default"}>
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">vs {m.opponent}</div>
                  <div className="text-[11px] text-neutral-500 font-mono">{m.id} · {m.date}</div>
                </div>
                <Badge tone={matchWon ? "default" : "danger"}>{matchWon ? "WON" : "LOST"}</Badge>
              </div>
              <div className="font-mono text-sm text-neutral-300">
                {m.sets.map((s, i) => (
                  <span key={i} className={`mr-3 ${s.sonScore > s.oppScore ? "text-emerald-300" : "text-red-300"}`}>
                    {s.sonScore}-{s.oppScore}
                  </span>
                ))}
                <span className="text-neutral-500">({w}W · {l}L)</span>
              </div>
              {m.tournament && <div className="text-[11px] text-neutral-500 mt-1">{m.tournament}</div>}
              {m.playerStyle && m.playerStyle !== "Unknown" && (
                <div className="text-[11px] text-amber-300/90 mt-0.5">Opponent style: {m.playerStyle}</div>
              )}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
