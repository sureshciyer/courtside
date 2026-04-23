import { DISRUPTION_SHOTS } from "../constants/badminton.js";

export const OPENING_LENGTH = 3;
export const CLUTCH_THRESHOLD = 16;
export const EARLY_THRESHOLD = 5;

// Supported opponent styles — used later to filter patterns by opponent type.
export const PLAYER_STYLES = [
  "Attacking",
  "Defensive",
  "Deceptive",
  "All-round",
  "Unknown",
];

export const initMatch = () => ({
  id: "",
  date: new Date().toISOString().split("T")[0],
  tournament: "",
  opponent: "",
  playerStyle: "Unknown", // opponent's style, for later pattern filtering
  sets: [{ sonScore: 0, oppScore: 0 }],
  currentSet: 0,
  rallies: [],
  completed: false,
});

export const initRally = (matchId, setIdx, sonScore, oppScore) => ({
  matchId,
  set: setIdx + 1,
  score: `${sonScore}-${oppScore}`,
  server: null,
  shots: [],
  result: null,
  pointWonBy: null,
  phase: computePhase(sonScore, oppScore),
  startedAt: Date.now(), // used to derive each shot's `timestamp` (s from rally start)
});

// Effectiveness of a shot — optional toggle per shot, wired up later in UI.
export const SHOT_QUALITIES = ["Effective", "Neutral", "Ineffective"];

export const emptyBuild = () => ({
  grip: null,
  shot: null,
  dir: null,
  zone: null,
  role: null,
});

export const computePhase = (son, opp) => {
  if (son >= CLUTCH_THRESHOLD || opp >= CLUTCH_THRESHOLD) return "Clutch";
  if (son <= EARLY_THRESHOLD && opp <= EARLY_THRESHOLD) return "Early";
  return "Mid";
};

// Suggests the tactical role for a shot at `position` given its shot type.
// - First OPENING_LENGTH shots default to "opening".
// - Smashes, half-smashes, kills, and quality net shots past the opening
//   default to "disruption" (user can still override).
// - Everything else defaults to "neutral".
export const autoRole = (position, shotType) => {
  if (position < OPENING_LENGTH) return "opening";
  if (shotType && DISRUPTION_SHOTS.has(shotType)) return "disruption";
  return "neutral";
};

export const formatShotCode = ({ grip, shotType, dir }) => {
  if (!grip || !dir) return shotType || "";
  return [grip, shotType, dir].join("-");
};

export const nextMatchId = (matches) =>
  `M${String(matches.length + 1).padStart(3, "0")}`;
