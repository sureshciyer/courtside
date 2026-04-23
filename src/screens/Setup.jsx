import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { PLAYER_STYLES } from "../lib/rally.js";
import { Screen, TopBar, Badge, Field, Select, BigBtn, Card } from "../components/ui.jsx";

export default function Setup({ setScreen }) {
  const newMatchId = useMatchStore((s) => s.newMatchId);
  const startMatch = useMatchStore((s) => s.startMatch);
  const nextId = newMatchId();

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    opponent: "",
    tournament: "",
    playerStyle: "Unknown",
  });

  const canStart = !!form.opponent;

  return (
    <Screen>
      <TopBar title="New match" subtitle="Capture opponent context up front" onBack={() => setScreen("home")} />

      <Card className="mb-3">
        <div className="flex items-center justify-between mb-4">
          <Badge>{nextId}</Badge>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Match ID</span>
        </div>

        <Field label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
        <Field label="Opponent" value={form.opponent} onChange={(v) => setForm({ ...form, opponent: v })} placeholder="Name or initials" />
        <Field label="Tournament / Stage" value={form.tournament} onChange={(v) => setForm({ ...form, tournament: v })} placeholder="e.g. State U13 QF" />
        <Select
          label="Opponent style"
          value={form.playerStyle}
          onChange={(v) => setForm({ ...form, playerStyle: v })}
          options={PLAYER_STYLES}
        />
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          Opponent style is used later to filter tactical patterns. Pick what feels closest — you can update it after the match.
        </p>
      </Card>

      <BigBtn tone="primary" disabled={!canStart} onClick={() => { startMatch(form); setScreen("capture"); }}>
        Start match →
      </BigBtn>
      {!canStart && (
        <p className="text-[11px] text-center text-amber-400/80 mt-1">Opponent name is required</p>
      )}
    </Screen>
  );
}
