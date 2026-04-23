import { useState } from "react";
import { useMatchStore } from "../store/useMatchStore.js";
import { PLAYER_STYLES } from "../lib/rally.js";
import { Screen, TopBar, Badge, Field, Select, BigBtn } from "../components/ui.jsx";

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
      <TopBar title="New match" onBack={() => setScreen("home")} />
      <Badge>{nextId}</Badge>
      <Field label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
      <Field label="Opponent" value={form.opponent} onChange={(v) => setForm({ ...form, opponent: v })} placeholder="Name" />
      <Field label="Tournament / Stage" value={form.tournament} onChange={(v) => setForm({ ...form, tournament: v })} placeholder="e.g. State U13 QF" />
      <Select label="Opponent style" value={form.playerStyle} onChange={(v) => setForm({ ...form, playerStyle: v })} options={PLAYER_STYLES} />
      <BigBtn bg="#1B5E20" color="#fff" disabled={!canStart} onClick={() => {
        startMatch(form);
        setScreen("capture");
      }}>Start match</BigBtn>
    </Screen>
  );
}
