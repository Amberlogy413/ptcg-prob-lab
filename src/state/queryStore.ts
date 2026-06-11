/**
 * Q2 sentence-builder query state (docs/04 §4). Ephemeral (not persisted);
 * share-URL encoding arrives in Phase 5.
 */

import { create } from "zustand";

export type ConstraintKind = "atLeast" | "exactly" | "atMost" | "between" | "avoid";

export interface TrackedQueryCard {
  /** DeckCard id in the active deck. */
  cardId: string;
  kind: ConstraintKind;
  /** Single bound for atLeast / exactly / atMost. */
  n: number;
  /** Range bounds for between. */
  a: number;
  b: number;
}

export const MAX_TRACKED_CARDS = 5;

interface QueryState {
  tracked: TrackedQueryCard[];
  mulliganAware: boolean;
  addCard: (cardId: string) => void;
  removeCard: (cardId: string) => void;
  updateConstraint: (cardId: string, patch: Partial<Omit<TrackedQueryCard, "cardId">>) => void;
  setMulliganAware: (on: boolean) => void;
  reset: () => void;
}

export const useQueryStore = create<QueryState>()((set) => ({
  tracked: [],
  mulliganAware: true, // mulligan-aware by default (CLAUDE.md non-negotiable #3)
  addCard: (cardId) =>
    set((s) => {
      if (s.tracked.length >= MAX_TRACKED_CARDS) return s;
      if (s.tracked.some((c) => c.cardId === cardId)) return s;
      return { tracked: [...s.tracked, { cardId, kind: "atLeast", n: 1, a: 1, b: 2 }] };
    }),
  removeCard: (cardId) => set((s) => ({ tracked: s.tracked.filter((c) => c.cardId !== cardId) })),
  updateConstraint: (cardId, patch) =>
    set((s) => ({
      tracked: s.tracked.map((c) => (c.cardId === cardId ? { ...c, ...patch } : c)),
    })),
  setMulliganAware: (mulliganAware) => set({ mulliganAware }),
  reset: () => set({ tracked: [], mulliganAware: true }),
}));

/** [min, max] semantics per docs/02 §4.1, clamped to [0, min(count, H)]. */
export function constraintBounds(
  c: TrackedQueryCard,
  count: number,
  H = 7,
): [number, number] {
  const cap = Math.min(count, H);
  const clamp = (v: number) => Math.max(0, Math.min(cap, Math.trunc(v)));
  switch (c.kind) {
    case "atLeast":
      return [clamp(c.n), H];
    case "exactly":
      return [clamp(c.n), clamp(c.n)];
    case "atMost":
      return [0, clamp(c.n)];
    case "between": {
      const lo = clamp(Math.min(c.a, c.b));
      const hi = clamp(Math.max(c.a, c.b));
      return [lo, hi];
    }
    case "avoid":
      return [0, 0];
  }
}
