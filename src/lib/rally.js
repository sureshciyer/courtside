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

// ---------- Rally context derivations ----------
//
// Two perspective conventions matter here:
//   1. `zone` is always recorded from Son's court perspective, regardless
//      of who hit the shot. So the receiver's standing position equals
//      the previous (incoming) shot's landing zone.
//   2. `quality` (E/N/I) is from the *hitter's* perspective. Son E means
//      Son hit a strong shot; Opp E means the opponent's shot was strong
//      against Son.
//
// These helpers let analytics derive origin / opponent context / Son's
// quality view without requiring new capture inputs.

// Identify the player who hit `shotIndex` of a rally. Shots strictly
// alternate; first shot is the server.
//   Returns "S" (Son) | "O" (Opponent) | null when not derivable.
export const shotHitter = (rally, shotIndex) => {
  if (!rally || !rally.server) return null;
  if (shotIndex == null || shotIndex < 0) return null;
  const isEven = shotIndex % 2 === 0;
  const server = rally.server;
  if (server !== "S" && server !== "O") return null;
  return isEven ? server : (server === "S" ? "O" : "S");
};

export const isSonShot = (rally, shotIndex) =>
  shotHitter(rally, shotIndex) === "S";

export const isOpponentShot = (rally, shotIndex) =>
  shotHitter(rally, shotIndex) === "O";

// Map the hitter's E/N/I onto Son's perspective. For Son's own shots
// the value is unchanged; for Opp shots, E/I flip to "pressuring"/"weak"
// (and N becomes the lowercase "neutral" so consumers can distinguish
// "Son neutral shot" from "neutral opponent return").
const sonPerspectiveQuality = (hitBy, q) => {
  if (!q) return null;
  if (hitBy === "S") return q;
  if (hitBy === "O") {
    if (q === "Effective")   return "pressuring";
    if (q === "Ineffective") return "weak";
    if (q === "Neutral")     return "neutral";
  }
  return q;
};

// Derive the analytical context for a single shot in a rally. Lets
// analytics ask "where was Son when he hit?" and "what was the opponent's
// previous shot?" without needing those fields to be explicitly captured.
//
// Origin inference is gated to *Son shots only* — zones are recorded from
// Son's court perspective, so Son's standing position equals the previous
// opponent shot's landing zone. We do not attempt to infer opponent
// standing positions from this perspective.
//
// Future-proofing: if a shot ever carries an explicit `originZone`, that
// capture wins and `originZoneSource` becomes "captured".
export const deriveShotContext = (rally, shotIndex) => {
  const shot = rally?.shots?.[shotIndex];
  if (!shot) return null;

  const hitBy = shotHitter(rally, shotIndex);
  const prev = shotIndex > 0 ? rally.shots[shotIndex - 1] : null;
  const next = rally?.shots?.[shotIndex + 1] || null;
  const prevHitBy = shotIndex > 0 ? shotHitter(rally, shotIndex - 1) : null;

  // Previous opponent shot is the *opponent's* prior shot from Son's
  // perspective. Only meaningful when the *current* shot is Son's; for an
  // opponent shot we leave it null so consumers don't accidentally treat
  // a Son shot as an "opponent" shot.
  const previousOpponentShot =
    hitBy === "S" && prev && prevHitBy === "O" ? prev : null;

  // Origin inference (Son only).
  let inferredOriginZone = null;
  let originZoneSource = "unknown";
  if (shot.originZone != null) {
    inferredOriginZone = shot.originZone;
    originZoneSource = "captured";
  } else if (hitBy === "S") {
    if (shotIndex === 0) {
      inferredOriginZone = null;
      originZoneSource = "serve";
    } else if (previousOpponentShot?.zone != null) {
      inferredOriginZone = previousOpponentShot.zone;
      originZoneSource = "derived_from_previous_opponent_shot";
    }
  } else {
    // Opponent shot — perspective convention means we don't infer opp
    // origin from prior shots. Caller can still see `previousShot`.
    inferredOriginZone = null;
    originZoneSource = "not_inferred_for_opponent";
  }

  const bodySide =
    shot.grip === "F" ? "forehand" :
    shot.grip === "B" ? "backhand" :
    null;

  const q = shot.quality ?? null;

  return {
    hitBy,
    shotType: shot.shotType ?? null,
    grip: shot.grip ?? null,
    dir: shot.dir ?? null,
    targetZone: shot.zone ?? null,
    qualityFromHitterPerspective: q,
    qualityForSonPerspective: sonPerspectiveQuality(hitBy, q),
    score: rally?.score ?? null,
    phase: rally?.phase ?? null,
    previousShot: prev,
    nextShot: next,
    previousOpponentShot,
    previousOpponentShotType: previousOpponentShot?.shotType ?? null,
    previousOpponentShotZone: previousOpponentShot?.zone ?? null,
    bodySide,
    inferredOriginZone,
    originZoneSource,
  };
};
