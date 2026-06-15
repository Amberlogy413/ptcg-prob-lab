/**
 * Local two-player battle SANDBOX (owner request 2026-06-14): a faithful
 * board that mirrors real play — real zones, seeded shuffle, real random draw,
 * and free manual operation of every card (the player resolves card effects by
 * hand against the real card text). The exact-probability HUD reads this live
 * state. Nothing here touches the probability core; all math stays in selectors.
 *
 * Ephemeral by design (a scratch board), so no persistence.
 */

import { create } from "zustand";
import { uid } from "../utils/uid.ts";
import { mulberry32, shuffle, type Rng } from "../utils/rng.ts";

export type Zone = "deck" | "hand" | "active" | "bench" | "discard" | "prizes" | "lostzone";
export const ZONES: Zone[] = ["deck", "hand", "active", "bench", "discard", "prizes", "lostzone"];

export type PlayerId = "p1" | "p2";

export interface BattleCard {
  /** Per-instance id (a deck of 4 Switch makes 4 distinct instances). */
  iid: string;
  name: string;
  catalogId?: string;
  isBasic: boolean;
  section: "pokemon" | "trainer" | "energy" | "unknown";
}

export interface PlayerBoard {
  deck: BattleCard[];
  hand: BattleCard[];
  active: BattleCard[];
  bench: BattleCard[];
  discard: BattleCard[];
  prizes: BattleCard[];
  lostzone: BattleCard[];
}

export interface CardSpec {
  name: string;
  count: number;
  isBasic: boolean;
  section: "pokemon" | "trainer" | "energy" | "unknown";
  catalogId?: string;
}

interface BattleState {
  started: boolean;
  seed: number;
  /** Monotone counter folded into the seed so each reshuffle is reproducible. */
  shuffleNonce: number;
  turn: number;
  current: PlayerId;
  /** Who took the first turn (turn 1) — drives the going-first restrictions. */
  firstPlayer: PlayerId;
  /** Whether the current player has already played a Supporter this turn (1/turn). */
  turnSupporterUsed: boolean;
  p1: PlayerBoard;
  p2: PlayerBoard;
  names: { p1: string; p2: string };

  newGame: (input: { p1: CardSpec[]; p2: CardSpec[]; seed: number; names?: { p1: string; p2: string }; first?: PlayerId }) => void;
  /** Shuffle deck, draw the opening 7, set 6 prizes from the top. */
  setup: (player: PlayerId) => void;
  draw: (player: PlayerId, n: number) => void;
  /** Move one instance to a zone (real-play manual operation). */
  moveCard: (player: PlayerId, iid: string, to: Zone) => void;
  shuffleDeck: (player: PlayerId) => void;
  /** Move the whole hand to the discard pile (e.g. Professor's Research). */
  discardHand: (player: PlayerId) => void;
  /** Shuffle the whole hand back into the deck, fully reshuffled (e.g. Judge). */
  shuffleHandIntoDeck: (player: PlayerId) => void;
  /** Shuffle the hand among itself and place it UNDER the deck, preserving the
   *  existing top order (e.g. Iono — 放回牌庫下方). */
  shuffleHandUnderDeck: (player: PlayerId) => void;
  /** Record that a Supporter was played this turn (enforces 1-per-turn). */
  markSupporterUsed: () => void;
  /** Mulligan: hand → deck, reshuffle, redraw 7. */
  mulligan: (player: PlayerId) => void;
  endTurn: () => void;
  reset: () => void;
}

function emptyBoard(): PlayerBoard {
  return { deck: [], hand: [], active: [], bench: [], discard: [], prizes: [], lostzone: [] };
}

/** Flatten a deck spec into per-instance cards. */
function instantiate(specs: CardSpec[]): BattleCard[] {
  const out: BattleCard[] = [];
  for (const s of specs) {
    for (let i = 0; i < s.count; i++) {
      out.push({
        iid: uid(),
        name: s.name,
        isBasic: s.isBasic,
        section: s.section,
        ...(s.catalogId !== undefined ? { catalogId: s.catalogId } : {}),
      });
    }
  }
  return out;
}

function rngFor(seed: number, player: PlayerId, nonce: number): Rng {
  // Distinct, reproducible stream per player + reshuffle.
  return mulberry32((seed ^ (player === "p1" ? 0x1111 : 0x2222) ^ (nonce * 0x9e3779b9)) >>> 0);
}

/** Locate which zone holds an instance, for a move. */
function findZone(board: PlayerBoard, iid: string): Zone | null {
  for (const z of ZONES) {
    if (board[z].some((c) => c.iid === iid)) return z;
  }
  return null;
}

export const useBattleStore = create<BattleState>()((set, get) => ({
  started: false,
  seed: 1,
  shuffleNonce: 0,
  turn: 1,
  current: "p1",
  firstPlayer: "p1",
  turnSupporterUsed: false,
  p1: emptyBoard(),
  p2: emptyBoard(),
  names: { p1: "P1", p2: "P2" },

  newGame: ({ p1, p2, seed, names, first }) => {
    const firstPlayer = first ?? "p1";
    set({
      started: true,
      seed,
      shuffleNonce: 0,
      turn: 1,
      current: firstPlayer,
      firstPlayer,
      turnSupporterUsed: false,
      p1: { ...emptyBoard(), deck: instantiate(p1) },
      p2: { ...emptyBoard(), deck: instantiate(p2) },
      names: names ?? { p1: "P1", p2: "P2" },
    });
    get().setup("p1");
    get().setup("p2");
  },

  setup: (player) => {
    set((s) => {
      const board = s[player];
      const all = [...board.deck, ...board.hand, ...board.active, ...board.bench, ...board.discard, ...board.prizes, ...board.lostzone];
      const shuffled = shuffle(all, rngFor(s.seed, player, s.shuffleNonce + 1));
      const hand = shuffled.slice(0, 7);
      const prizes = shuffled.slice(7, 13);
      const deck = shuffled.slice(13);
      return {
        shuffleNonce: s.shuffleNonce + 1,
        [player]: { ...emptyBoard(), deck, hand, prizes },
      } as Partial<BattleState>;
    });
  },

  draw: (player, n) => {
    set((s) => {
      const board = s[player];
      const k = Math.max(0, Math.min(n, board.deck.length));
      if (k === 0) return {} as Partial<BattleState>;
      return {
        [player]: { ...board, hand: [...board.hand, ...board.deck.slice(0, k)], deck: board.deck.slice(k) },
      } as Partial<BattleState>;
    });
  },

  moveCard: (player, iid, to) => {
    set((s) => {
      const board = s[player];
      const from = findZone(board, iid);
      if (from === null || from === to) return {} as Partial<BattleState>;
      const card = board[from].find((c) => c.iid === iid);
      if (card === undefined) return {} as Partial<BattleState>;
      return {
        [player]: {
          ...board,
          [from]: board[from].filter((c) => c.iid !== iid),
          [to]: [...board[to], card],
        },
      } as Partial<BattleState>;
    });
  },

  shuffleDeck: (player) => {
    set((s) => {
      const board = s[player];
      return {
        shuffleNonce: s.shuffleNonce + 1,
        [player]: { ...board, deck: shuffle(board.deck, rngFor(s.seed, player, s.shuffleNonce + 1)) },
      } as Partial<BattleState>;
    });
  },

  discardHand: (player) => {
    set((s) => {
      const board = s[player];
      if (board.hand.length === 0) return {} as Partial<BattleState>;
      return {
        [player]: { ...board, hand: [], discard: [...board.discard, ...board.hand] },
      } as Partial<BattleState>;
    });
  },

  shuffleHandIntoDeck: (player) => {
    set((s) => {
      const board = s[player];
      if (board.hand.length === 0) return {} as Partial<BattleState>;
      const deck = shuffle([...board.deck, ...board.hand], rngFor(s.seed, player, s.shuffleNonce + 1));
      return {
        shuffleNonce: s.shuffleNonce + 1,
        [player]: { ...board, hand: [], deck },
      } as Partial<BattleState>;
    });
  },

  shuffleHandUnderDeck: (player) => {
    set((s) => {
      const board = s[player];
      if (board.hand.length === 0) return {} as Partial<BattleState>;
      // Shuffle ONLY the hand among itself, then place it under the existing
      // deck (top order preserved, drawn off the top) — faithful to 放回牌庫下方.
      const shuffledHand = shuffle(board.hand, rngFor(s.seed, player, s.shuffleNonce + 1));
      return {
        shuffleNonce: s.shuffleNonce + 1,
        [player]: { ...board, hand: [], deck: [...board.deck, ...shuffledHand] },
      } as Partial<BattleState>;
    });
  },

  markSupporterUsed: () => set({ turnSupporterUsed: true }),

  mulligan: (player) => {
    set((s) => {
      const board = s[player];
      const deck = [...board.deck, ...board.hand];
      const shuffled = shuffle(deck, rngFor(s.seed, player, s.shuffleNonce + 1));
      return {
        shuffleNonce: s.shuffleNonce + 1,
        [player]: { ...board, hand: shuffled.slice(0, 7), deck: shuffled.slice(7) },
      } as Partial<BattleState>;
    });
  },

  endTurn: () => {
    set((s) => ({ current: s.current === "p1" ? "p2" : "p1", turn: s.turn + 1, turnSupporterUsed: false }));
  },

  reset: () => {
    set({ started: false, p1: emptyBoard(), p2: emptyBoard(), turn: 1, current: "p1", firstPlayer: "p1", turnSupporterUsed: false });
  },
}));
