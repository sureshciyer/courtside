import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  initMatch,
  initRally,
  autoRole,
  computePhase,
} from "../lib/rally.js";

const STORE_KEY = "courtside-v1";
const SCHEMA_VERSION = 3;

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

const buildShot = ({ grip, shotType, dir, zone, role, quality }, position, startedAt) => ({
  grip: grip ?? null,
  shotType,
  dir: dir ?? null,
  zone,
  code: grip && dir ? `${grip}-${shotType}-${dir}` : shotType,
  role: role || autoRole(position, shotType),
  quality: quality ?? null,
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
      matchCounter: 0,       // monotonic — last id issued

      // Opponent profiles, keyed by normalized opponent name. Profile shape:
      //   { name, notes, aiInsights, createdAt, updatedAt }
      // Career stats (W/L, heatmaps, etc.) are derived from `matches` at read
      // time — not stored here — so they always reflect current data.
      opponents: {},

      settings: {
        playerName: "Arjun",
        handedness: "R",
      },

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

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
          matchCounter: data?.matchCounter ?? (data?.matches?.length || 0),
          opponents: data?.opponents ?? {},
        }),

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
        matchCounter: state.matchCounter,
        opponents: state.opponents,
        settings: state.settings,
      }),
      // Incremental migrations. Keep the chain additive so older snapshots
      // can walk through every step.
      migrate: (persisted, version) => {
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
        return persisted;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        settings: { ...current.settings, ...(persisted?.settings || {}) },
        pausedMatches: persisted?.pausedMatches || current.pausedMatches || [],
        opponents: { ...(current.opponents || {}), ...(persisted?.opponents || {}) },
      }),
    }
  )
);
