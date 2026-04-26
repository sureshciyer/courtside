// Shared fixture builders for analytics tests. Keep small and obvious — the
// goal is to make individual tests readable, not to model the full app shape.

export const shot = (overrides = {}) => ({
  shotType: "CL",
  zone: 5,
  grip: "F",
  dir: "ST",
  role: "neutral",
  quality: "Neutral",
  ...overrides,
});

export const rally = (overrides = {}) => ({
  matchId: "M001",
  set: 1,
  score: "0-0",
  server: "S",
  shots: [],
  result: null,
  pointWonBy: null,
  phase: "Early",
  startedAt: 0,
  ...overrides,
});

export const match = (overrides = {}) => ({
  id: "M001",
  date: "2026-01-01",
  tournament: "Test Cup",
  opponent: "Opp",
  playerStyle: "Unknown",
  aiInsights: "",
  sets: [{ sonScore: 21, oppScore: 15 }],
  currentSet: 0,
  rallies: [],
  completed: true,
  ...overrides,
});

// Convenience: build a winning rally for Son with a given shot list and final
// result. Caller can pass partial shot objects.
export const wonRally = (shots, extra = {}) =>
  rally({
    pointWonBy: "S",
    result: "W",
    shots: shots.map((s) => shot(s)),
    ...extra,
  });

export const lostRally = (shots, extra = {}) =>
  rally({
    pointWonBy: "O",
    result: "UE",
    shots: shots.map((s) => shot(s)),
    ...extra,
  });
