// Backup / restore utilities. A "backup" is a versioned JSON envelope that
// carries every persisted field from the store (matches, paused matches,
// opponent profiles, match counter, settings). parseBackup() accepts both
// the envelope format AND the older bare-array format (matches only) so old
// exports can still be restored.
//
// Merge strategy is intentionally non-destructive: matches / paused matches
// are keyed by `id` (dupes skipped), and opponent profiles merge field-wise
// so existing local notes / AI insights are never overwritten by an import.

export const BACKUP_SIGNATURE = "courtside";
export const BACKUP_VERSION = 3;

// Build the envelope from a store-state snapshot.
export const makeBackup = (state) => ({
  courtside: BACKUP_SIGNATURE,
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  playerName: state.settings?.playerName || "",
  matches: state.matches || [],
  pausedMatches: state.pausedMatches || [],
  // The live match being captured right now and its in-progress rally.
  // Included so a download mid-match doesn't silently drop work. Will be
  // null on a fresh export with no live capture in progress.
  currentMatch: state.currentMatch || null,
  currentRally: state.currentRally || null,
  matchCounter: state.matchCounter || 0,
  opponents: state.opponents || {},
  // Settings are included so a fresh-device restore also brings back the
  // player name and handedness, but merge logic does NOT overwrite local
  // settings automatically — see mergeBackup below.
  settings: state.settings || null,
});

// Parse a text blob into a backup object. Returns { data } on success,
// { error } on failure, optionally { warning } for legacy format detection.
export const parseBackup = (text) => {
  if (typeof text !== "string" || !text.trim()) {
    return { error: "Empty file." };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: `Not valid JSON: ${e.message}` };
  }

  // Legacy format — user exported "matches only" JSON from a pre-backup build.
  if (Array.isArray(data)) {
    return {
      data: { matches: data, _legacyArray: true },
      warning: "Legacy format detected (matches-only array). Opponent profiles and paused matches won't be present in this file.",
    };
  }

  if (!data || typeof data !== "object") {
    return { error: "Expected a JSON object or array." };
  }
  if (!Array.isArray(data.matches)) {
    return { error: "Backup has no `matches` array — doesn't look like a Courtside export." };
  }
  if (data.courtside && data.courtside !== BACKUP_SIGNATURE) {
    return { error: `Unrecognised signature: ${data.courtside}` };
  }
  return { data };
};

// Produce merge result against a current state snapshot. Pure — caller
// applies the result via `set({...})`. Returns the merged fields + a stats
// summary the UI can show as a preview or a confirmation toast.
export const mergeBackup = (current, incoming) => {
  const currentMatches = current.matches || [];
  const incomingMatches = Array.isArray(incoming?.matches) ? incoming.matches : [];
  const currentPaused = current.pausedMatches || [];
  const incomingPaused = Array.isArray(incoming?.pausedMatches) ? incoming.pausedMatches : [];
  const currentOpponents = current.opponents || {};
  const incomingOpponents = incoming?.opponents || {};

  // --- matches: union by id, existing wins on collision ---
  const matchIds = new Set(currentMatches.map((m) => m.id));
  const addedMatches = [];
  const skippedMatches = [];
  for (const m of incomingMatches) {
    if (!m?.id) { skippedMatches.push(m); continue; }
    if (matchIds.has(m.id)) { skippedMatches.push(m); continue; }
    addedMatches.push(m);
    matchIds.add(m.id);
  }
  const mergedMatches = [...currentMatches, ...addedMatches];

  // --- paused matches: same union-by-id ---
  const pausedIds = new Set(currentPaused.map((m) => m.id));
  const addedPaused = [];
  for (const m of incomingPaused) {
    if (!m?.id || pausedIds.has(m.id)) continue;
    addedPaused.push(m);
    pausedIds.add(m.id);
  }
  const mergedPaused = [...currentPaused, ...addedPaused];

  // --- opponents: profile-wise field merge ---
  // For each incoming profile:
  //   · if local is missing → copy the whole thing
  //   · if local exists → only fill *empty* local fields; never overwrite
  //     existing user content (notes, AI insights)
  const mergedOpponents = { ...currentOpponents };
  let addedProfiles = 0;
  let filledFields = 0;
  for (const [key, prof] of Object.entries(incomingOpponents)) {
    if (!prof) continue;
    const existing = mergedOpponents[key];
    if (!existing) {
      mergedOpponents[key] = prof;
      addedProfiles++;
      continue;
    }
    const patched = { ...existing };
    if (!existing.notes?.trim() && prof.notes?.trim()) {
      patched.notes = prof.notes;
      filledFields++;
    }
    if (!existing.aiInsights?.trim() && prof.aiInsights?.trim()) {
      patched.aiInsights = prof.aiInsights;
      filledFields++;
    }
    mergedOpponents[key] = patched;
  }

  // --- live match (currentMatch + currentRally) ---
  // The backup may carry an in-progress match. Decide where it lands:
  //   1. If its id already exists anywhere local (matches, paused, current),
  //      skip — local wins, no overwrites.
  //   2. Else if local has NO live match, restore as currentMatch + currentRally.
  //   3. Else (local already has a live match), park the incoming live match
  //      into pausedMatches so nothing is overwritten. The user can resume
  //      it from Home if they want it active.
  let mergedCurrentMatch = current.currentMatch || null;
  let mergedCurrentRally = current.currentRally || null;
  let liveOutcome = "none"; // "restored" | "parked" | "skipped" | "none"

  const incomingLive = incoming?.currentMatch || null;
  const incomingLiveRally = incoming?.currentRally || null;
  if (incomingLive && incomingLive.id) {
    const liveId = incomingLive.id;
    const existsAsCompleted = matchIds.has(liveId);
    const existsAsPaused = pausedIds.has(liveId);
    const isLocalLive = current.currentMatch?.id === liveId;
    if (existsAsCompleted || existsAsPaused || isLocalLive) {
      liveOutcome = "skipped";
    } else if (!current.currentMatch) {
      // Slot available — restore the backup's live match directly.
      mergedCurrentMatch = incomingLive;
      mergedCurrentRally = incomingLiveRally || null;
      liveOutcome = "restored";
    } else {
      // Local is already capturing — park backup's live match instead.
      const packed = {
        ...incomingLive,
        _pausedRally: incomingLiveRally || null,
        pausedAt: Date.now(),
      };
      mergedPaused.push(packed);
      pausedIds.add(liveId);
      liveOutcome = "parked";
    }
  }

  // --- match counter: take max, bumped above merged length ---
  const mergedCounter = Math.max(
    current.matchCounter || 0,
    incoming?.matchCounter || 0,
    mergedMatches.length
  );

  // Build the patch. currentMatch / currentRally are only included when
  // the merge actually produces a value, so a no-op merge (no incoming
  // live match) doesn't accidentally overwrite local live state with null.
  const patch = {
    matches: mergedMatches,
    pausedMatches: mergedPaused,
    opponents: mergedOpponents,
    matchCounter: mergedCounter,
  };
  if (liveOutcome === "restored") {
    patch.currentMatch = mergedCurrentMatch;
    patch.currentRally = mergedCurrentRally;
  }

  return {
    patch,
    stats: {
      addedMatches: addedMatches.length,
      skippedMatches: skippedMatches.length,
      addedPaused: addedPaused.length,
      addedOpponentProfiles: addedProfiles,
      filledOpponentFields: filledFields,
      totalIncomingMatches: incomingMatches.length,
      liveOutcome, // "restored" | "parked" | "skipped" | "none"
    },
  };
};

// Quick cardinality preview without committing — used before the user
// confirms. Shape matches mergeBackup stats so the UI can render once.
export const backupPreview = (current, incoming) => mergeBackup(current, incoming).stats;
