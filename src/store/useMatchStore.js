import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  initMatch,
  initRally,
  autoRole,
  computePhase,
} from "../lib/rally.js";
import { migratePersisted } from "../lib/migrations.js";

const STORE_KEY = "courtside-v1";
const SCHEMA_VERSION = 4;

// Opponent profile keys are normalized — lower-cased, trimmed — so "Rahul S."
// and "rahul s." map to the same dossier. Matches keep the original display
// name; the profile holds the canonical spelling.
const normalizeOpponent = (name) => (name || "").trim().toLowerCase();

/**
 * Shot shape (every entry in a rally's `shots` array):
 * {
 *   code:       "F-SM-ST" | "LS"
 *   grip:       "F" | "B" | null
 *   shotType:   "SM" | "LS" | ...
 *   dir:        "ST" | "CR" | "BD" | null
 *   zone:       1..9
 *   role:       "opening" | "neutral" | "disruption" | "finish"
 *   quality:    "Effective" | "Neutral" | "Ineffective" | null
 *   timestamp:  number (seconds from rally start)
 * }
 *
 * Match lifecycle:
 *   currentMatch + currentRally are the "live" match being captured right now.
 *   pausedMatches[] parks any in-progress match the user wants to come back to
 *   later. Each paused match carries its half-captured rally as `_pausedRally`.
 *   matches[] is the completed-match archive (End match moves here).
 */

const buildShot = (
  { grip, shotType, dir, zone, role, quality, deceptionType },
  position,
  startedAt,
) => ({
  grip: grip ?? null,
  shotType,
  dir: dir ?? null,
  zone,
  code: grip && dir ? `${grip}-${shotType}-${dir}` : shotType,
  role: role || autoRole(position, shotType),
  quality: quality ?? null,
  // Optional deception tagging (Phase 5). "none" is the default; analytics
  // ignores "none"/missing/"unknown" when computing the deception index.
  deceptionType: deceptionType || "none",
  timestamp: startedAt ? +((Date.now() - startedAt) / 1000).toFixed(2) : 0,
});

const scoreString = (set) => `${set.sonScore}-${set.oppScore}`;

// Monotonic match-id generator. Uses `matchCounter` so new IDs never collide
// with a previously-completed match that's already been archived.
const makeMatchId = (counter) => `M${String(counter).padStart(3, "0")}`;

// Package a live match for the paused shelf: bundle the separate currentRally
// back into the match object so it can travel as a single unit.
const packMatch = (match, rally) =>
  match ? { ...match, _pausedRally: rally || null, pausedAt: Date.now() } : null;

const unpackMatch = (paused) => {
  if (!paused) return { match: null, rally: null };
  const { _pausedRally, pausedAt, ...match } = paused;
  return { match, rally: _pausedRally || null };
};

export const useMatchStore = create(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      matches: [],           // completed matches (archive)
      currentMatch: null,    // the live match being captured (or null)
      currentRally: null,    // the rally being built inside currentMatch
      pausedMatches: [],     // in-progress matches stashed for later
      plannedMatches: [],    // prepared-but-not-started matches (pre-match prep done ahead of time)
      matchCounter: 0,       // monotonic — last id issued

      // Opponent profiles, keyed by normalized opponent name. Profile shape:
      //   { name, notes, aiInsights, createdAt, updatedAt }
      // Career stats (W/L, heatmaps, etc.) are derived from `matches` at read
      // time — not stored here — so they always reflect current data.
      opponents: {},

      // Persisted backup/restore activity log so "when did I last sync"
      // survives refresh. Not chatty — two timestamps + one stats blob.
      syncStatus: {
        lastBackupAt: null,
        lastBackupMatchCount: 0,
        lastRestoreAt: null,
        lastRestoreStats: null,
        // Google Drive cloud sync markers
        lastCloudSyncAt: null,
        lastCloudSyncStats: null,
      },

      // Tactical goals the user has set for the next match. Each entry:
      //   { id, metricKey, comparator: "lt"|"gt", threshold, params, createdAt }
      // Evaluated on Patterns (against all matches as a baseline) and on
      // the post-match Summary (against the latest match's rallies).
      goals: [],

      settings: {
        playerName: "Arjun",
        handedness: "R",
      },

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      // Create a completed match WITHOUT any rally capture — used by the
      // Quick log flow so a reflection can be attached to casual sessions
      // where nobody notated shots. `meta.sets` is optional; when absent we
      // store a neutral 0-0 set and rely on `resultLabel` for the W/L badge.
      addQuickMatch: (meta) => {
        const counter = (get().matchCounter || 0) + 1;
        const id = makeMatchId(counter);
        const sets = meta.sets?.length ? meta.sets : [{ sonScore: 0, oppScore: 0 }];
        const match = {
          ...initMatch(),
          id,
          date: meta.date || new Date().toISOString().split("T")[0],
          opponent: meta.opponent || "Club session",
          tournament: meta.tournament || "",
          matchType: meta.matchType || "Casual Game",
          club: meta.club || "",
          format: meta.format || "Singles",
          sets,
          currentSet: sets.length - 1,
          completed: true,
          quickLog: true,
          // "won" | "lost" | null — display hint when no real scores exist.
          resultLabel: meta.resultLabel || null,
        };
        set((state) => ({
          matchCounter: counter,
          matches: [...state.matches, match],
        }));
        get().ensureOpponent(match.opponent);
        return id;
      },

      // Edit metadata on a COMPLETED (archived) match — opponent, club,
      // matchType, format, date, tournament, and for quick-logged matches
      // also sets/resultLabel. Captured matches keep their scores derived
      // from rallies (use Reopen for those), so callers should only pass
      // sets/resultLabel when the match is quickLog.
      updateArchivedMatch: (matchId, patch) => {
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, ...patch } : m
          ),
        }));
        if (patch.opponent) get().ensureOpponent(patch.opponent);
      },

      // ---------- Mode 2: post-match reflection ----------
      // Which match the Reflection screen should edit, and where to return
      // after save/back. Transient UI state — intentionally NOT persisted
      // (excluded from partialize below).
      reflectTargetId: null,
      reflectReturn: "summary",
      openReflection: (matchId, returnScreen = "summary") =>
        set({ reflectTargetId: matchId, reflectReturn: returnScreen }),

      // Which archived match the EditMatch screen should edit. Transient
      // UI state like reflectTargetId — not persisted.
      editTargetId: null,
      openMatchEdit: (matchId) => set({ editTargetId: matchId }),

      // Attach/update the structured reflection on a completed match.
      saveReflection: (matchId, reflection) =>
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  reflection: {
                    ...reflection,
                    createdAt: m.reflection?.createdAt || Date.now(),
                    updatedAt: Date.now(),
                  },
                }
              : m
          ),
        })),

      // ---------- goals ----------
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      removeGoal: (id) =>
        set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),
      clearGoals: () => set({ goals: [] }),

      // ---------- opponent profiles ----------

      // Idempotently register an opponent the first time we see their name.
      // Called automatically by startMatch; safe to call from UI paths too.
      ensureOpponent: (name) => {
        const key = normalizeOpponent(name);
        if (!key) return;
        if (get().opponents[key]) return;
        set((state) => ({
          opponents: {
            ...state.opponents,
            [key]: {
              name: (name || "").trim(),
              notes: "",
              aiInsights: "",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        }));
      },

      // Patch an opponent profile — { notes, aiInsights, name } etc.
      // Creates the profile lazily if it doesn't exist yet.
      updateOpponentProfile: (name, patch) => {
        const key = normalizeOpponent(name);
        if (!key) return;
        set((state) => {
          const existing = state.opponents[key] || {
            name: (name || "").trim(),
            notes: "",
            aiInsights: "",
            createdAt: Date.now(),
          };
          return {
            opponents: {
              ...state.opponents,
              [key]: { ...existing, ...patch, updatedAt: Date.now() },
            },
          };
        });
      },

      // Remove an opponent's profile (notes + AI insights). Does NOT touch
      // their matches — those stay in the archive.
      deleteOpponentProfile: (name) => {
        const key = normalizeOpponent(name);
        if (!key) return;
        set((state) => {
          const next = { ...state.opponents };
          delete next[key];
          return { opponents: next };
        });
      },

      // ---------- planned (prepared-ahead) matches ----------
      // Pranav fills the pre-match plan a day / hours before a tournament
      // match. savePlannedMatch parks it WITHOUT starting capture; on match
      // day startPlannedMatch promotes it into the live slot.

      // Which planned match the Setup screen is editing (transient, not persisted).
      plannedEditId: null,
      openPlannedEdit: (id) => set({ plannedEditId: id }),

      // Which match's pre-match plan the print/share view should render.
      planViewId: null,
      openPlanView: (id) => set({ planViewId: id }),

      // Which opponent (display name) the reflections-timeline view should show.
      opponentTimelineName: null,
      openOpponentTimeline: (name) => set({ opponentTimelineName: name }),

      // Create a prepared match and shelve it — does not touch currentMatch.
      savePlannedMatch: (setup) => {
        const counter = (get().matchCounter || 0) + 1;
        const id = makeMatchId(counter);
        const match = {
          ...initMatch(),
          id,
          ...setup,
          completed: false,
          planned: true,
          plannedAt: Date.now(),
        };
        set((state) => ({
          matchCounter: counter,
          plannedMatches: [...state.plannedMatches, match],
        }));
        get().ensureOpponent(setup.opponent);
        return id;
      },

      // Edit a shelved plan's meta / preMatch before the match is played.
      updatePlannedMatch: (id, patch) => {
        set((state) => ({
          plannedMatches: state.plannedMatches.map((m) =>
            m.id === id ? { ...m, ...patch } : m
          ),
        }));
        if (patch.opponent) get().ensureOpponent(patch.opponent);
      },

      discardPlannedMatch: (id) =>
        set((state) => ({
          plannedMatches: state.plannedMatches.filter((m) => m.id !== id),
        })),

      // Promote a planned match into live capture. Strips the planned flags,
      // seeds a fresh rally at the current set's score, and auto-parks any
      // match already being captured so nothing is lost.
      startPlannedMatch: (id) => {
        set((state) => {
          const idx = state.plannedMatches.findIndex((m) => m.id === id);
          if (idx < 0) return {};
          // Strip the planned-only markers as it becomes a live match.
          const { planned: _planned, plannedAt: _plannedAt, ...match } = state.plannedMatches[idx];
          const setIdx = match.currentSet ?? 0;
          const curSet = match.sets?.[setIdx] || { sonScore: 0, oppScore: 0 };
          const rally = initRally(match.id, setIdx, curSet.sonScore, curSet.oppScore);
          const parked = state.currentMatch && !state.currentMatch.completed
            ? [...state.pausedMatches, packMatch(state.currentMatch, state.currentRally)]
            : state.pausedMatches;
          return {
            currentMatch: { ...match, completed: false },
            currentRally: rally,
            pausedMatches: parked,
            plannedMatches: state.plannedMatches.filter((_, i) => i !== idx),
          };
        });
      },

      // ---------- match lifecycle ----------

      newMatchId: () => makeMatchId((get().matchCounter || 0) + 1),

      startMatch: (setup) => {
        set((state) => {
          const counter = (state.matchCounter || 0) + 1;
          const id = makeMatchId(counter);
          const match = { ...initMatch(), id, ...setup };
          const rally = initRally(id, 0, 0, 0);

          // If a match is already live, auto-park it so it isn't overwritten.
          const parked = state.currentMatch && !state.currentMatch.completed
            ? [...state.pausedMatches, packMatch(state.currentMatch, state.currentRally)]
            : state.pausedMatches;

          return {
            matchCounter: counter,
            currentMatch: match,
            currentRally: rally,
            pausedMatches: parked,
          };
        });
        // Auto-register the opponent's dossier so notes/insights can attach
        // even before the match ends.
        get().ensureOpponent(setup.opponent);
      },

      // Park the live match without discarding data.
      pauseCurrentMatch: () => {
        set((state) => {
          if (!state.currentMatch) return {};
          return {
            pausedMatches: [...state.pausedMatches, packMatch(state.currentMatch, state.currentRally)],
            currentMatch: null,
            currentRally: null,
          };
        });
      },

      // Swap a paused match back into the live slot. If a live match is
      // already present it gets auto-parked first (no data loss).
      resumeMatch: (id) => {
        set((state) => {
          const idx = state.pausedMatches.findIndex((m) => m.id === id);
          if (idx < 0) return {};
          const { match, rally } = unpackMatch(state.pausedMatches[idx]);
          const nextPaused = state.pausedMatches.filter((_, i) => i !== idx);
          const parked = state.currentMatch && !state.currentMatch.completed
            ? [...nextPaused, packMatch(state.currentMatch, state.currentRally)]
            : nextPaused;
          return {
            currentMatch: match,
            currentRally: rally || initRally(match.id, match.currentSet, match.sets[match.currentSet].sonScore, match.sets[match.currentSet].oppScore),
            pausedMatches: parked,
          };
        });
      },

      discardPausedMatch: (id) =>
        set((state) => ({
          pausedMatches: state.pausedMatches.filter((m) => m.id !== id),
        })),

      updateMatchMeta: (patch) =>
        set((state) => ({
          currentMatch: state.currentMatch ? { ...state.currentMatch, ...patch } : null,
        })),

      // Update a completed match's AI insights (post-match critique paste).
      updateMatchAiInsights: (matchId, text) =>
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, aiInsights: text } : m
          ),
        })),

      endMatch: () =>
        set((state) => {
          if (!state.currentMatch) return {};
          // Bump the opponent's profile timestamp so Scouting list sorts by
          // recency naturally.
          const key = normalizeOpponent(state.currentMatch.opponent);
          const opponents = key && state.opponents[key]
            ? { ...state.opponents, [key]: { ...state.opponents[key], updatedAt: Date.now() } }
            : state.opponents;
          return {
            matches: [...state.matches, { ...state.currentMatch, completed: true }],
            currentMatch: null,
            currentRally: null,
            opponents,
          };
        }),

      // Reopen a previously-completed match. Use cases:
      //   - Imported a backup where a match was wrongly stamped completed
      //   - Hit "End match" too early and want to keep capturing
      // Behaviour:
      //   - Pulls the match out of `matches` (the archive)
      //   - Marks it `completed: false`
      //   - Auto-parks the current live match (if any) to pausedMatches
      //   - Sets it as currentMatch and seeds a fresh currentRally at the
      //     latest set's running score
      // The user can then capture more rallies in the existing set, or tap
      // Next set in Capture to start a new set.
      reopenMatch: (matchId) =>
        set((state) => {
          const idx = state.matches.findIndex((m) => m.id === matchId);
          if (idx < 0) return {};
          const target = state.matches[idx];
          const reopened = { ...target, completed: false };

          // Park the live match (if any) to avoid silent overwrite.
          const parked = state.currentMatch && !state.currentMatch.completed
            ? [...state.pausedMatches, packMatch(state.currentMatch, state.currentRally)]
            : state.pausedMatches;

          const setIdx = reopened.currentSet ?? (reopened.sets.length - 1);
          const lastSet = reopened.sets[setIdx] || { sonScore: 0, oppScore: 0 };
          const freshRally = initRally(
            reopened.id,
            setIdx,
            lastSet.sonScore,
            lastSet.oppScore,
          );

          return {
            matches: state.matches.filter((_, i) => i !== idx),
            pausedMatches: parked,
            currentMatch: { ...reopened, currentSet: setIdx },
            currentRally: freshRally,
          };
        }),

      // ---------- score ----------
      adjustScore: (side, delta) =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const sets = [...m.sets];
          const cur = sets[m.currentSet];
          const key = side === "S" ? "sonScore" : "oppScore";
          sets[m.currentSet] = { ...cur, [key]: Math.max(0, cur[key] + delta) };
          return { currentMatch: { ...m, sets } };
        }),

      nextSet: () =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const sets = [...m.sets, { sonScore: 0, oppScore: 0 }];
          const currentSet = m.currentSet + 1;
          return {
            currentMatch: { ...m, sets, currentSet },
            currentRally: initRally(m.id, currentSet, 0, 0),
          };
        }),

      // ---------- rally ----------
      setServer: (server) =>
        set((state) => ({
          currentRally: state.currentRally ? { ...state.currentRally, server } : null,
        })),

      addShot: (partial) =>
        set((state) => {
          const r = state.currentRally; if (!r) return {};
          const shot = buildShot(partial, r.shots.length, r.startedAt);
          return { currentRally: { ...r, shots: [...r.shots, shot] } };
        }),

      updateShot: (index, patch) =>
        set((state) => {
          const r = state.currentRally; if (!r) return {};
          const shots = r.shots.map((s, i) => (i === index ? { ...s, ...patch } : s));
          const s = shots[index];
          shots[index] = {
            ...s,
            code: s.grip && s.dir ? `${s.grip}-${s.shotType}-${s.dir}` : s.shotType,
          };
          return { currentRally: { ...r, shots } };
        }),

      setShotQuality: (index, quality) =>
        set((state) => {
          const r = state.currentRally; if (!r) return {};
          const shots = r.shots.map((s, i) => (i === index ? { ...s, quality } : s));
          return { currentRally: { ...r, shots } };
        }),

      setShotDeception: (index, deceptionType) =>
        set((state) => {
          const r = state.currentRally; if (!r) return {};
          const shots = r.shots.map((s, i) => (i === index ? { ...s, deceptionType } : s));
          return { currentRally: { ...r, shots } };
        }),

      setShotRole: (index, role) =>
        set((state) => {
          const r = state.currentRally; if (!r) return {};
          const shots = r.shots.map((s, i) => (i === index ? { ...s, role } : s));
          return { currentRally: { ...r, shots } };
        }),

      deleteShot: (index) =>
        set((state) => {
          const r = state.currentRally; if (!r) return {};
          return { currentRally: { ...r, shots: r.shots.filter((_, i) => i !== index) } };
        }),

      popShot: () => {
        const r = get().currentRally;
        if (!r || r.shots.length === 0) return null;
        const popped = r.shots[r.shots.length - 1];
        set({ currentRally: { ...r, shots: r.shots.slice(0, -1) } });
        return popped;
      },

      setRallyResult: (result) =>
        set((state) => ({
          currentRally: state.currentRally ? { ...state.currentRally, result } : null,
        })),

      // ---------- edits on FINISHED rallies in the live match ----------
      // Lets the RallyLogSheet correct past mistakes without forcing the
      // user to re-enter a rally. Any change to a rally's result/winner
      // also reconciles the set score to keep the scoreboard honest.

      updateFinishedRally: (index, patch) =>
        set((state) => {
          const m = state.currentMatch; if (!m || !m.rallies[index]) return {};
          const rallies = [...m.rallies];
          rallies[index] = { ...rallies[index], ...patch };
          return { currentMatch: { ...m, rallies } };
        }),

      // Flip Son↔Opp on a saved rally and move ±1 point between the set's
      // scores. `currentRally.score` is re-synced if the edited rally sits
      // in the current set so the next rally carries the corrected score.
      flipFinishedRallyWinner: (index) =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const rally = m.rallies[index]; if (!rally) return {};
          const wasSon = rally.pointWonBy === "S";
          const rallies = [...m.rallies];
          rallies[index] = { ...rally, pointWonBy: wasSon ? "O" : "S" };

          const sets = m.sets.map((s, i) => {
            if (i !== rally.set - 1) return s;
            return wasSon
              ? { sonScore: Math.max(0, s.sonScore - 1), oppScore: s.oppScore + 1 }
              : { sonScore: s.sonScore + 1, oppScore: Math.max(0, s.oppScore - 1) };
          });

          let nextRally = state.currentRally;
          const isCurrentSet = rally.set - 1 === m.currentSet;
          if (isCurrentSet && nextRally && nextRally.shots.length === 0) {
            const cur = sets[m.currentSet];
            nextRally = { ...nextRally, score: `${cur.sonScore}-${cur.oppScore}`, phase: computePhase(cur.sonScore, cur.oppScore) };
          }
          return { currentMatch: { ...m, rallies, sets }, currentRally: nextRally };
        }),

      // Remove a saved rally and roll back the 1 point it contributed to
      // the set's tally. Subsequent rallies' stored pre-rally `score`
      // labels are left as-is (historical record), but the running total
      // on the scoreboard is corrected.
      deleteFinishedRally: (index) =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const rally = m.rallies[index]; if (!rally) return {};
          const rallies = m.rallies.filter((_, i) => i !== index);
          const sets = m.sets.map((s, i) => {
            if (i !== rally.set - 1) return s;
            return rally.pointWonBy === "S"
              ? { ...s, sonScore: Math.max(0, s.sonScore - 1) }
              : { ...s, oppScore: Math.max(0, s.oppScore - 1) };
          });

          let nextRally = state.currentRally;
          const isCurrentSet = rally.set - 1 === m.currentSet;
          if (isCurrentSet && nextRally && nextRally.shots.length === 0) {
            const cur = sets[m.currentSet];
            nextRally = { ...nextRally, score: `${cur.sonScore}-${cur.oppScore}`, phase: computePhase(cur.sonScore, cur.oppScore) };
          }
          return { currentMatch: { ...m, rallies, sets }, currentRally: nextRally };
        }),

      updateFinishedRallyShot: (rallyIdx, shotIdx, patch) =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const rally = m.rallies[rallyIdx]; if (!rally) return {};
          const shots = rally.shots.map((s, i) => {
            if (i !== shotIdx) return s;
            const merged = { ...s, ...patch };
            return {
              ...merged,
              code: merged.grip && merged.dir ? `${merged.grip}-${merged.shotType}-${merged.dir}` : merged.shotType,
            };
          });
          const rallies = [...m.rallies];
          rallies[rallyIdx] = { ...rally, shots };
          return { currentMatch: { ...m, rallies } };
        }),

      deleteFinishedRallyShot: (rallyIdx, shotIdx) =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const rally = m.rallies[rallyIdx]; if (!rally) return {};
          const shots = rally.shots.filter((_, i) => i !== shotIdx);
          const rallies = [...m.rallies];
          rallies[rallyIdx] = { ...rally, shots };
          return { currentMatch: { ...m, rallies } };
        }),

      restartRally: () =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const s = m.sets[m.currentSet];
          return { currentRally: initRally(m.id, m.currentSet, s.sonScore, s.oppScore) };
        }),

      finishRally: (result, wonBy) =>
        set((state) => {
          const m = state.currentMatch, r = state.currentRally;
          if (!m || !r) return {};
          const finished = { ...r, result, pointWonBy: wonBy };
          const sets = [...m.sets];
          const cur = sets[m.currentSet];
          sets[m.currentSet] =
            wonBy === "S"
              ? { ...cur, sonScore: cur.sonScore + 1 }
              : { ...cur, oppScore: cur.oppScore + 1 };
          const next = sets[m.currentSet];
          return {
            currentMatch: { ...m, rallies: [...m.rallies, finished], sets },
            currentRally: {
              ...initRally(m.id, m.currentSet, next.sonScore, next.oppScore),
              phase: computePhase(next.sonScore, next.oppScore),
            },
          };
        }),

      // ---------- import/export ----------
      replaceAll: (data) =>
        set({
          matches: data?.matches ?? [],
          currentMatch: data?.currentMatch ?? null,
          currentRally: data?.currentRally ?? null,
          pausedMatches: data?.pausedMatches ?? [],
          plannedMatches: data?.plannedMatches ?? [],
          matchCounter: data?.matchCounter ?? (data?.matches?.length || 0),
          opponents: data?.opponents ?? {},
        }),

      // Merge a backup envelope into current state without destroying local
      // work. Matches / paused matches dedupe by id; opponent profiles
      // profile-wise merge so existing local notes/AI insights win.
      // `stats` is optional — when provided it updates syncStatus.
      applyBackupMerge: (mergedPatch, stats = null) =>
        set((state) => ({
          ...mergedPatch,
          syncStatus: {
            ...state.syncStatus,
            lastRestoreAt: Date.now(),
            lastRestoreStats: stats,
          },
        })),

      // Called after a successful download — sets the last-backup marker
      // so the Backup/Restore screen and Debug panel can show "X h ago".
      // Stamp a successful Google Drive sync so the UI can show "synced Xm ago".
      recordCloudSync: (stats = null) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            lastCloudSyncAt: Date.now(),
            lastCloudSyncStats: stats,
          },
        })),

      recordBackupDownload: (matchCount) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            lastBackupAt: Date.now(),
            lastBackupMatchCount: matchCount ?? (state.matches?.length || 0),
          },
        })),

      currentSet: () => {
        const m = get().currentMatch;
        return m ? m.sets[m.currentSet] : null;
      },

      currentScoreString: () => {
        const s = get().currentSet();
        return s ? scoreString(s) : "0-0";
      },
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        matches: state.matches,
        currentMatch: state.currentMatch,
        currentRally: state.currentRally,
        pausedMatches: state.pausedMatches,
        plannedMatches: state.plannedMatches,
        matchCounter: state.matchCounter,
        opponents: state.opponents,
        settings: state.settings,
        syncStatus: state.syncStatus,
        goals: state.goals,
      }),
      // Incremental migrations — extracted to lib/migrations.js so the
      // chain is unit-testable without touching localStorage.
      migrate: migratePersisted,
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        settings: { ...current.settings, ...(persisted?.settings || {}) },
        pausedMatches: persisted?.pausedMatches || current.pausedMatches || [],
        plannedMatches: persisted?.plannedMatches || current.plannedMatches || [],
        opponents: { ...(current.opponents || {}), ...(persisted?.opponents || {}) },
        syncStatus: { ...(current.syncStatus || {}), ...(persisted?.syncStatus || {}) },
        goals: persisted?.goals || current.goals || [],
      }),
    }
  )
);
