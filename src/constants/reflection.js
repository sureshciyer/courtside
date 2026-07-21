// =============================================================
//  MODE 2 — POST-MATCH PLAYER REFLECTION
//
//  Structured, tap-only self-assessment the player fills in ~2
//  minutes after a match. Deliberately NO free text except one
//  short "focus next" line — everything else is ratings/chips so
//  ReflectionTrends can chart it over time.
//
//  Design rule: don't duplicate what live capture already measures
//  objectively (UE counts, deception, shot mix). Ratings target
//  things only the player/parent can judge: spin quality, reaction
//  feel, composure, energy.
// =============================================================

// 1–5 rating scale, shared labels for every rating row.
export const RATING_SCALE = [1, 2, 3, 4, 5];
export const RATING_ANCHORS = { 1: "Poor", 3: "OK", 5: "Great" };

// Each rating: stable key (never rename — stored on matches),
// short label, and a hint shown under the row.
export const REFLECTION_RATINGS = [
  { key: "netSpin",       label: "Net spin & tumble",       hint: "Did net shots spin/tumble, or sit up?" },
  { key: "paceVariation", label: "Pace variation",           hint: "Mixed speeds, held shots, change of rhythm" },
  { key: "defenseReaction", label: "Defense reaction speed", hint: "How quick off the mark when defending?" },
  { key: "smashDefense",  label: "Handling smashes to lines", hint: "Returns vs smashes aimed at sidelines/body" },
  { key: "footwork",      label: "Footwork & recovery",      hint: "Back to base, balanced into shots" },
  { key: "focus",         label: "Focus & composure",        hint: "Steady after errors and at big points" },
  { key: "energy",        label: "Energy level",             hint: "Physical freshness across the match" },
];

// Playing-style tags for THIS match (multi-select). Trend view shows
// how style mix drifts over time — e.g. from lift&clear to push&smash.
export const STYLE_TAGS = [
  "Lift & clear",
  "Push & smash",
  "Net-heavy",
  "Counter-attack",
  "Fast drives",
  "Defensive walls",
  "Deception-led",
];

// Fixed vocabulary for strengths/weaknesses so counts aggregate cleanly.
// Pick up to MAX_PICKS of each per match.
export const SKILL_AREAS = [
  "Serve",
  "Return",
  "Net kills",
  "Net play",
  "Backhand clear",
  "Smash power",
  "Smash placement",
  "Drops",
  "Drives",
  "Defense",
  "Footwork",
  "Stamina",
  "Deception",
  "Shot selection",
  "Composure",
];
export const MAX_PICKS = 2;

// Context of the match — set at Setup, used to slice reflection trends
// (e.g. composure in tournaments vs casual games).
export const MATCH_TYPES = ["Casual Game", "Tournament"];
export const DEFAULT_MATCH_TYPE = "Casual Game";
export const MATCH_FORMATS = ["Singles", "Doubles"];

// Pre-v4 stored matches used "Club casual" / "Club league" — both collapse
// into Casual Game. Used by the store migration and any read path that may
// see un-migrated data (e.g. a merged backup from an old device).
export const normalizeMatchType = (t) =>
  t === "Tournament" ? "Tournament" : DEFAULT_MATCH_TYPE;

// Post-match emotion vocabulary (multi-select). Short, concrete words a
// young player can pick honestly in seconds — builds the habit of naming
// feelings, and the trend view charts the mood mix over time.
export const FEELING_TAGS = [
  "Proud",
  "Happy",
  "Excited",
  "Calm",
  "Nervous",
  "Frustrated",
  "Angry",
  "Disappointed",
  "Tired",
];

// Single pick: the dominant mindset at pressure points (game points,
// deciders, long losing runs). The most coach-useful mental signal —
// especially sliced Tournament vs Casual in ReflectionTrends.
export const BIG_POINT_MINDSETS = [
  "Brave — went for my shots",
  "Played it safe",
  "Tight / panicky",
];

// Error categories the player can optionally comment on after the match.
// Free text per topic — kept separate from the misc notes so the Markdown
// export and coach PDF can group them under one "Errors" heading.
export const ERROR_TOPICS = [
  "Unforced errors",
  "Serve errors",
  "Return errors",
  "Net errors",
  "Smash errors",
];

export const emptyReflection = () => ({
  ratings: Object.fromEntries(REFLECTION_RATINGS.map((r) => [r.key, null])),
  styleTags: [],
  strengths: [],
  weaknesses: [],
  focusNext: "",
  // Pre→post loop: 1–5 self-grade on sticking to the pre-match game plan.
  // Only meaningful when the match has a preMatch plan (tournaments).
  stuckToPlan: null,
  // Mental / feelings check (Mode 2 mindset block).
  feelings: [],          // multi-select from FEELING_TAGS
  bigPointMindset: null, // one of BIG_POINT_MINDSETS
  selfTalk: "",          // thoughts when points kept slipping away
  // Optional per-topic error commentary, keyed by ERROR_TOPICS entries.
  // Only topics with non-empty text are stored.
  errorNotes: {},
  // Free-form catch-all for anything the structured form doesn't cover.
  notes: "",
  createdAt: null,
  updatedAt: null,
});

// A reflection "counts" once at least one rating is filled.
export const hasReflection = (match) => {
  const r = match?.reflection;
  if (!r) return false;
  return Object.values(r.ratings || {}).some((v) => v != null)
    || (r.styleTags || []).length > 0
    || (r.strengths || []).length > 0
    || (r.weaknesses || []).length > 0
    || (r.feelings || []).length > 0
    || r.bigPointMindset != null
    || r.stuckToPlan != null
    || !!r.selfTalk?.trim()
    || Object.values(r.errorNotes || {}).some((t) => t?.trim())
    || !!r.notes?.trim();
};
