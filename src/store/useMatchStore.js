import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  initMatch,
  initRally,
  autoRole,
  computePhase,
  nextMatchId,
} from "../lib/rally.js";

const STORE_KEY = "courtside-v1";
const SCHEMA_VERSION = 1;

/**
 * Shot shape (every entry in a rally's `shots` array):
 * {
 *   code:       "F-SM-ST" | "LS"       // display code (grip-shot-dir or serve code)
 *   grip:       "F" | "B" | null       // null for serves
 *   shotType:   "SM" | "LS" | ...      // canonical shot type (3-letter)
 *   dir:        "ST" | "CR" | "BD" | null
 *   zone:       1..9                   // landing zone
 *   role:       "opening" | "neutral" | "disruption" | "finish"
 *   quality:    "Effective" | "Neutral" | "Ineffective" | null  // optional, for pro analysis
 *   timestamp:  number                  // seconds elapsed from rally start
 * }
 */

// Normalize a partially-built shot + position into the persisted shape.
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

export const useMatchStore = create(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      matches: [],        // completed matches
      currentMatch: null, // { ...match, rallies: [finished] }
      currentRally: null, // rally being captured right now

      // ---------- match lifecycle ----------
      newMatchId: () => nextMatchId(get().matches),

      startMatch: (setup) => {
        const id = nextMatchId(get().matches);
        const match = { ...initMatch(), id, ...setup };
        set({
          currentMatch: match,
          currentRally: initRally(id, 0, 0, 0),
        });
      },

      updateMatchMeta: (patch) =>
        set((state) => ({
          currentMatch: state.currentMatch ? { ...state.currentMatch, ...patch } : null,
        })),

      endMatch: () =>
        set((state) => {
          if (!state.currentMatch) return {};
          return {
            matches: [...state.matches, { ...state.currentMatch, completed: true }],
            currentMatch: null,
            currentRally: null,
          };
        }),

      // ---------- score ----------
      adjustScore: (side, delta) =>
        set((state) => {
          const m = state.currentMatch; if (!m) return {};
          const sets = [...m.sets];
          const cur = sets[m.currentSet];
          const key = side === "S" ? "sonScore" : "oppScore";
          const next = Math.max(0, cur[key] + delta);
          sets[m.currentSet] = { ...cur, [key]: next };
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
          // re-derive code if grip/shotType/dir changed
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

      // Undo: drop the last captured shot. Returns the dropped shot so UI can
      // offer a "redo" toast if it wants to.
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
        }),

      // Convenience: derive the currently-active set object.
      currentSet: () => {
        const m = get().currentMatch;
        return m ? m.sets[m.currentSet] : null;
      },

      // Convenience: running score string, used as rally `score` label.
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
      }),
    }
  )
);
