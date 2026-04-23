// Pure analytics helpers for the Patterns dashboard. No React, no store.

// Frequency map of N-gram shot-type sequences from rallies where `son` won.
// Returns [{ seq: "LS→NT→SM", count: 4 }, ...] sorted desc.
export const winningSequences = (rallies, n = 3) => {
  const counts = new Map();
  for (const r of rallies) {
    if (r.pointWonBy !== "S" || r.shots.length < n) continue;
    for (let i = 0; i <= r.shots.length - n; i++) {
      const seq = r.shots.slice(i, i + n).map((s) => s.shotType || s.code).join("→");
      counts.set(seq, (counts.get(seq) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([seq, count]) => ({ seq, count }))
    .sort((a, b) => b.count - a.count);
};

// Heatmap-ready tally of unforced errors by zone. Counts the landing zone of
// the *last* shot on rallies where the son committed an unforced error.
export const errorZones = (rallies) => {
  const zones = new Array(10).fill(0); // indices 1..9
  for (const r of rallies) {
    if (r.result !== "UE" || r.pointWonBy !== "O") continue;
    const last = r.shots[r.shots.length - 1];
    if (last?.zone) zones[last.zone] += 1;
  }
  return zones; // zones[n] = count for zone n
};

// Shot-type frequency across all captured shots. Useful for a simple breakdown.
export const shotTypeFrequency = (rallies) => {
  const counts = new Map();
  for (const r of rallies) {
    for (const s of r.shots) {
      const k = s.shotType || s.code;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
};

// Aggregate role distribution — useful to see if rallies are "finish-heavy".
export const roleDistribution = (rallies) => {
  const counts = { opening: 0, neutral: 0, disruption: 0, finish: 0 };
  for (const r of rallies) {
    for (const s of r.shots) {
      if (counts[s.role] !== undefined) counts[s.role] += 1;
    }
  }
  return counts;
};
