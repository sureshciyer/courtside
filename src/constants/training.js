// =============================================================
//  MODE 4 — TRAINING LOG (private + group classes)
//
//  Log what happened in a coaching session and which drills were
//  run. Drills are canonical entities (like opponents): auto-created
//  the first time a name is used and referenced by every session, so
//  "how often has he done this drill / when last" is a simple count.
//
//  Design rule: capture is fast (named drill + light tags + per-session
//  reps/note). The tags aggregate cleanly so the drill dossier can show
//  frequency and, later, links to match weaknesses.
// =============================================================

export const TRAINING_TYPES = ["Private", "Group"];

// Drill categories — single-select per drill (catalog-level).
export const DRILL_CATEGORIES = [
  "Footwork",
  "Net play",
  "Defense",
  "Attack / Smash",
  "Serve & return",
  "Clears & drops",
  "Drives",
  "Deception",
  "Multi-shuttle",
  "Match play",
  "Fitness",
  "Other",
];

// Friendly "skills trained" tags — multi-select per drill (catalog-level).
// Kept parent-friendly rather than raw shot codes; still aggregate cleanly.
export const DRILL_SKILLS = [
  "Serve",
  "Return",
  "Net",
  "Lift",
  "Clear",
  "Drop",
  "Smash",
  "Block",
  "Drive",
  "Deception",
  "Footwork",
  "Defense",
  "Stamina",
];

export const TRAINING_RATING_SCALE = [1, 2, 3, 4, 5];

// One drill as it appears WITHIN a session — a reference to the catalog
// drill plus how it was run that day.
export const emptyDrillEntry = () => ({
  drillKey: "",   // normalized name — links to the catalog
  name: "",       // display name as typed
  sets: "",       // e.g. "4"
  reps: "",       // e.g. "10" or "10 min"
  note: "",       // how it went that day
});

export const emptyTrainingSession = () => ({
  date: new Date().toISOString().split("T")[0],
  type: "Private",
  coach: "",
  club: "",
  durationMin: "",  // number as string in the form
  focus: "",        // headline focus of the session
  rating: null,     // 1–5 how it went overall
  videoUrl: "",     // link to a video (YouTube / Drive / etc.)
  notes: "",        // free notes / coach feedback
  drills: [],       // emptyDrillEntry()[]
});

// Catalog drill (canonical). Keyed by normalized name in the store.
export const emptyDrill = (name = "") => ({
  name: name.trim(),
  category: "Other",
  skills: [],
  notes: "",   // description of the drill
});

// A session "counts" as logged once it has a date and at least a focus,
// a drill, a note, or a video.
export const hasTrainingContent = (s) =>
  !!(s && (s.focus?.trim() || (s.drills || []).some((d) => d.name?.trim()) || s.notes?.trim() || s.videoUrl?.trim()));
