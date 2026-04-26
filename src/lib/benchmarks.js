// Centralised numeric thresholds the analytics layer leans on.
// Single source of truth — UI, markdown, and analytics all import from here
// so we never have a "33%" hardcoded somewhere disagreeing with the report.
//
// All values are %; any helper that compares to one should normalise to %.

export const BENCHMARKS = {
  // Unforced-error ceiling — anything above this is a leak.
  UE_TARGET_PCT: 18,

  // Effective-tagged shots floor (E from E/N/I tagging).
  EFFECTIVE_TARGET_PCT: 35,

  // 3-shot opening win rate floor.
  THREE_SHOT_WIN_TARGET_PCT: 55,

  // Clutch deficit (clutch UE% − overall UE%) above this triggers a warning.
  CLUTCH_DEFICIT_WARN_PP: 10,

  // Neutral-shot share above this means the player rallies passively
  // instead of converting neutral exchanges into pressure.
  NEUTRAL_HIGH_PCT: 60,
};

// Severity bands used by the Performance Leak Engine (Phase 4) and any
// other consumer that wants a colour/severity for a UE rate.
//
// Order matters — first match wins. Keep aligned with BENCHMARKS.UE_TARGET_PCT
// (the "low" upper bound is the same number).
export const UE_SEVERITY_BANDS = [
  { code: "critical", min: 30.0001, max: 100, label: "Critical" },
  { code: "high",     min: 25.0001, max: 30,  label: "High" },
  { code: "medium",   min: 18.0001, max: 25,  label: "Medium" },
  { code: "low",      min: 0,       max: 18,  label: "Low" },
];

export const uePctSeverity = (uePct) => {
  for (const band of UE_SEVERITY_BANDS) {
    if (uePct >= band.min && uePct <= band.max) return band.code;
  }
  return "low";
};

// Sample-confidence thresholds (Phase 3). Tuned so a single match with
// ~40 captured rallies lands at "very_low" / directional only.
export const SAMPLE_CONFIDENCE = {
  VERY_LOW_MAX_MATCHES: 3,   // strictly fewer than this is very_low
  VERY_LOW_MAX_RALLIES: 100, // strictly fewer than this is very_low
  LOW_MAX_MATCHES: 6,
  LOW_MAX_RALLIES: 250,
  MEDIUM_MAX_MATCHES: 12,
  MEDIUM_MAX_RALLIES: 600,
  // Anything above MEDIUM_MAX_* counts as "high" confidence.
};

// Minimum counts before a "repeating pattern" claim is allowed (Phase 9).
// e.g. don't claim a kill-chain is repeatable if we've only seen it twice.
export const PATTERN_MIN_COUNT = 3;
