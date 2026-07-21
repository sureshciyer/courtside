// =============================================================
//  MODE 3 — PRE-MATCH PREPARATION (tournaments only)
//
//  A ~90-second tap-first form filled right before a tournament
//  match. Distils elite pre-match routine into six items a junior
//  can answer: a game plan against THIS opponent, process goals
//  (controllables), an if-then Plan B, a focus word, an arousal
//  read (confidence + nerves), and a body-readiness check.
//
//  Design rule: pre-match sets INTENTION; the post-match reflection
//  closes the loop by asking "did you stick to the plan?" — so keep
//  the game plan short and concrete enough to grade afterwards.
// =============================================================

// Process goals — controllable things that don't depend on the score.
// Pick up to MAX_CONTROLLABLES; the point is focus, not a checklist.
export const CONTROLLABLES = [
  "Footwork & recovery to base",
  "Tight net shots",
  "Stay positive after mistakes",
  "High tempo / intensity",
  "Patient — wait for the right ball",
  "Move them corner to corner",
  "Deep, varied serves",
];
export const MAX_CONTROLLABLES = 2;

// Physical readiness self-report before the match.
export const BODY_READINESS = ["Fresh", "OK", "Tired"];

export const emptyPreMatch = () => ({
  gamePlan: "",         // 2–3 concrete priorities vs this opponent
  controllables: [],    // process goals (<= MAX_CONTROLLABLES)
  planB: "",            // if-then contingency
  focusWord: "",        // one refocus cue word
  confidence: null,     // 1–5
  nerves: null,         // 1–5
  bodyReadiness: null,  // one of BODY_READINESS
  bodyNote: "",         // optional niggle / note
  createdAt: null,
});

// A pre-match plan "counts" once any meaningful field is filled.
export const hasPreMatch = (match) => {
  const p = match?.preMatch;
  if (!p) return false;
  return !!p.gamePlan?.trim()
    || (p.controllables || []).length > 0
    || !!p.planB?.trim()
    || !!p.focusWord?.trim()
    || p.confidence != null
    || p.nerves != null
    || p.bodyReadiness != null
    || !!p.bodyNote?.trim();
};
