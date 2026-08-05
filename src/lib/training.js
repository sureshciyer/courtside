// Pure helpers for the training log. No store / storage imports so these
// are unit-testable in the node environment.

// Canonical drill key — lower-cased, trimmed, inner whitespace collapsed —
// so "Net + Cross Defense" and "net + cross  defense" map to one drill.
export const normalizeDrill = (name) =>
  (name || "").trim().toLowerCase().replace(/\s+/g, " ");

// Every session that ran a given drill, with that session's per-drill
// entry attached. Newest first. `key` is a normalized drill key.
export const drillUsage = (sessions, key) => {
  const rows = [];
  for (const s of sessions || []) {
    const entry = (s.drills || []).find((d) => d.drillKey === key);
    if (entry) rows.push({ session: s, entry });
  }
  rows.sort((a, b) => String(b.session.date).localeCompare(String(a.session.date)));
  const dates = rows.map((r) => r.session.date).filter(Boolean).sort();
  return {
    count: rows.length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    rows,
  };
};

// Catalog entries decorated with usage stats, for the drill-list view.
// `catalog` is the { key: drill } map; returns an array sorted by the
// requested key ("count" | "recent" | "name").
export const catalogWithUsage = (catalog, sessions, sortBy = "count") => {
  const out = Object.entries(catalog || {}).map(([key, drill]) => {
    const u = drillUsage(sessions, key);
    return { key, ...drill, count: u.count, lastDate: u.lastDate, firstDate: u.firstDate };
  });
  const cmp = {
    count: (a, b) => b.count - a.count || String(b.lastDate).localeCompare(String(a.lastDate)),
    recent: (a, b) => String(b.lastDate || "").localeCompare(String(a.lastDate || "")),
    name: (a, b) => a.name.localeCompare(b.name),
  }[sortBy] || ((a, b) => b.count - a.count);
  return out.sort(cmp);
};

// Distinct drills actually referenced by sessions but NOT (yet) present in
// the catalog — used to reconcile after an import from an older backup.
export const orphanDrillKeys = (catalog, sessions) => {
  const known = new Set(Object.keys(catalog || {}));
  const seen = new Set();
  for (const s of sessions || []) {
    for (const d of s.drills || []) {
      if (d.drillKey && !known.has(d.drillKey)) seen.add(d.drillKey);
    }
  }
  return [...seen];
};

// Quick per-type / per-coach tallies for the training list header.
export const trainingSummary = (sessions) => {
  const list = sessions || [];
  const byType = {};
  for (const s of list) byType[s.type] = (byType[s.type] || 0) + 1;
  const drillRefs = list.reduce((a, s) => a + (s.drills || []).length, 0);
  return { total: list.length, byType, drillRefs };
};
