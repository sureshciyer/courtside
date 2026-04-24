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
  aiInsights: "",         // user-pasted critique from Claude / Gemini for this match
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

// ---------- Smart contextual defaults ----------

// 9-zone layout with the net at the top (rendered in CourtGrid):
//   1 2 3   ← front
//   4 5 6
//   7 8 9   ← back
// The left column (1,4,7) and right column (3,6,9) correspond to the
// player's backhand / forehand sides respectively for a right-hander.
export const ZONE_SIDE = {
  1: "L", 4: "L", 7: "L",
  2: "M", 5: "M", 8: "M",
  3: "R", 6: "R", 9: "R",
};

// Guess the grip for a shot landing in `zone`.
// - Right-hander (default): left-side zones (1/4/7) → Backhand, right-side
//   (3/6/9) → Forehand.
// - Left-hander: flipped — left-side zones → Forehand, right-side → Backhand.
// Middle zones (2/5/8) inherit the previous grip (or default Forehand).
export const guessGrip = (zone, previousGrip = null, handedness = "R") => {
  const side = ZONE_SIDE[zone];
  if (side === "M" || !side) return previousGrip || "F";
  if (handedness === "L") return side === "L" ? "F" : "B";
  return side === "L" ? "B" : "F";
};

// Suggest a direction based on the previous landing zone. If the next zone
// is on the opposite side of the court, we assume a cross-court hit; same
// side → straight. Middle (M) zones keep the last used direction.
export const suggestDirection = (prevZone, nextZone, lastDir = "ST") => {
  if (!prevZone || !nextZone) return lastDir || "ST";
  const a = ZONE_SIDE[prevZone];
  const b = ZONE_SIDE[nextZone];
  if (!a || !b) return lastDir || "ST";
  if (a === "M" || b === "M") return lastDir || "ST";
  return a === b ? "ST" : "CR";
};

// Cycle through allowed options — used by the Timeline card's tap-to-toggle
// on grip / direction segments.
export const cycleGrip = (g) => (g === "F" ? "B" : "F");
export const cycleDirection = (d) => {
  const order = ["ST", "CR", "BD"];
  const i = order.indexOf(d);
  return order[(i + 1) % order.length] || "ST";
};
