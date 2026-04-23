import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Stat, BigBtn, Card } from "../components/ui.jsx";

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
  const setWins = m.sets.filter((s) => s.sonScore > s.oppScore).length;
  const won = setWins > m.sets.length / 2;

  return (
    <Screen>
      <TopBar title="Match summary" onBack={() => setScreen("home")} />

      <Card tone={won ? "accent" : "danger"} className="mb-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          {m.id} · vs {m.opponent}
        </div>
        <div className="flex justify-center gap-5 my-2">
          {m.sets.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-[9px] uppercase text-neutral-500 tracking-wider">S{i + 1}</div>
              <div className={`text-2xl font-extrabold font-display tabular-nums ${s.sonScore > s.oppScore ? "text-emerald-400" : "text-red-400"}`}>
                {s.sonScore}-{s.oppScore}
              </div>
            </div>
          ))}
        </div>
        <div className={`text-sm font-bold uppercase tracking-widest ${won ? "text-emerald-400" : "text-red-400"}`}>
          {won ? "Match won" : "Match lost"}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="Rallies" value={r.length} />
        <Stat label="Won" value={w} tone="good" />
        <Stat label="Lost" value={l} tone="bad" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="Winners" value={wn} tone="good" />
        <Stat label="UE" value={ue} tone="bad" />
        <Stat label="Avg rally" value={avg} />
      </div>
      {cl.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Stat label="Clutch pts" value={cl.length} tone="warn" />
          <Stat label="Clutch won" value={`${cw}/${cl.length}`} tone={cw >= cl.length / 2 ? "good" : "bad"} />
        </div>
      )}

      <div className="mt-4">
        <BigBtn tone="violet" onClick={() => setScreen("patterns")}>See tactical patterns →</BigBtn>
        <BigBtn tone="secondary" onClick={() => setScreen("home")}>Back to home</BigBtn>
      </div>
    </Screen>
  );
}
