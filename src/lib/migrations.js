// Persisted-state migration chain for useMatchStore. Kept as a pure
// function (no store / storage imports) so it can be unit-tested in the
// node test environment. Keep the chain additive so older snapshots can
// walk through every step.

export const migratePersisted = (persisted, version) => {
  if (!persisted) return persisted;
  if (version < 2) {
    const archived = persisted.matches?.length || 0;
    const live = persisted.currentMatch ? 1 : 0;
    const maxId = [...(persisted.matches || []), persisted.currentMatch]
      .filter(Boolean)
      .map((m) => parseInt((m.id || "M0").slice(1), 10) || 0)
      .reduce((a, b) => Math.max(a, b), 0);
    persisted = {
      ...persisted,
      schemaVersion: 2,
      pausedMatches: persisted.pausedMatches || [],
      matchCounter: Math.max(maxId, archived + live),
    };
  }
  if ((persisted.schemaVersion ?? version) < 3) {
    // v2 -> v3: seed opponent profiles from every match we have.
    const opponents = persisted.opponents || {};
    const now = Date.now();
    const pool = [
      ...(persisted.matches || []),
      ...(persisted.pausedMatches || []),
      ...(persisted.currentMatch ? [persisted.currentMatch] : []),
    ];
    for (const m of pool) {
      const key = (m?.opponent || "").trim().toLowerCase();
      if (!key || opponents[key]) continue;
      opponents[key] = {
        name: m.opponent.trim(),
        notes: "",
        aiInsights: "",
        createdAt: now,
        updatedAt: now,
      };
    }
    persisted = { ...persisted, schemaVersion: 3, opponents };
  }
  if ((persisted.schemaVersion ?? version) < 4) {
    // v3 -> v4: match types simplified to Casual Game / Tournament.
    // Old "Club casual" and "Club league" both collapse into Casual Game.
    const remapType = (m) =>
      m && m.matchType && m.matchType !== "Tournament"
        ? { ...m, matchType: "Casual Game" }
        : m;
    persisted = {
      ...persisted,
      schemaVersion: 4,
      matches: (persisted.matches || []).map(remapType),
      pausedMatches: (persisted.pausedMatches || []).map(remapType),
      currentMatch: remapType(persisted.currentMatch) || null,
    };
  }
  return persisted;
};
