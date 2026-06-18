/**
 * Local two-player battle GAME (owner request 2026-06-17: make it play like a
 * real turn-based TCG — PTCG Live / tcgmasters.net — not a free "move any card
 * anywhere" sandbox). The board is faithful: a card's TYPE decides what you can
 * do with it. A Pokémon goes only to the Active spot or the Bench (≤5); Energy
 * ATTACHES to a Pokémon in play (1 per turn); a Supporter/Item is played then
 * discarded (Supporter 1/turn, none on the going-first turn 1); a Stadium goes
 * to the Stadium zone (replacing the old one); a Tool attaches to a Pokémon.
 *
 * Each in-play Pokémon is a UNIT — the card plus its attached Energy/Tools, its
 * damage, and its evolution stack — so the board reads like a real game. The
 * exact-probability HUD reads only `deck` (drawn from the top of a uniformly
 * shuffled pile); nothing here touches the probability core.
 *
 * Ephemeral by design (a scratch board), so no persistence. Card INSTANCE
 * identity (iid) is preserved through every move, attach and evolve.
 */

import { create } from "zustand";
import { uid } from "../utils/uid.ts";
import { mulberry32, shuffle, type Rng } from "../utils/rng.ts";

/** Flat card piles (everything that is just an ordered list of loose cards). */
export type Pile = "deck" | "hand" | "discard" | "prizes" | "lostzone";
export const PILES: Pile[] = ["deck", "hand", "discard", "prizes", "lostzone"];

export type PlayerId = "p1" | "p2";

/** What a card lets you DO when played — derived from real catalog facts in the
 *  view (category / stage / trainerType / energyType) and carried on the card so
 *  the store can enforce the rules without a catalog dependency. "unknown" =
 *  no catalog match (newest / custom) → the UI offers a manual fallback. */
export type PlayKind =
  | "basic" // Basic Pokémon → Active / Bench
  | "evolution" // Stage 1/2 etc. → evolve onto a matching Pokémon in play
  | "energy-basic"
  | "energy-special"
  | "supporter"
  | "item"
  | "tool"
  | "stadium"
  | "unknown";

export interface BattleCard {
  /** Per-instance id (a deck of 4 Switch makes 4 distinct instances). */
  iid: string;
  name: string;
  catalogId?: string;
  isBasic: boolean;
  section: "pokemon" | "trainer" | "energy" | "unknown";
  /** Type-correct play behaviour (set by the view from the catalog). */
  kind: PlayKind;
  /** Minimal battle facts (set when a catalog match exists). */
  hp?: number;
  retreat?: number;
  /** The lower-stage name this card evolves from (for legal evolution). */
  evolveFrom?: string;
}

/** An in-play Pokémon: the (top) card plus everything riding on it. */
export interface InPlay {
  /** Stable unit id = the bottom Pokémon's iid (kept across evolutions). */
  uid: string;
  /** The current top Pokémon card. */
  card: BattleCard;
  /** Lower evolution stages, bottom-first (the line under `card`). */
  under: BattleCard[];
  /** Attached Energy cards. */
  energy: BattleCard[];
  /** Attached Pokémon Tools. */
  tools: BattleCard[];
  /** Damage taken (HP lost). KO when damage ≥ hp. */
  damage: number;
  /** Turn this Pokémon came into play / last evolved (summoning-sickness rules). */
  playedTurn: number;
  /** Special Conditions on this Pokémon (only meaningful on the Active). Cleared
   *  when it leaves the Active spot or evolves. */
  status: SpecialCondition[];
}

export type SpecialCondition = "poison" | "burn" | "asleep" | "confused" | "paralyzed";
export const SPECIAL_CONDITIONS: SpecialCondition[] = ["poison", "burn", "asleep", "confused", "paralyzed"];

export interface PlayerBoard {
  deck: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  prizes: BattleCard[];
  lostzone: BattleCard[];
  /** The single Active Pokémon (戰鬥場), or null when empty. */
  active: InPlay | null;
  /** The Bench (備戰區), up to 5 Pokémon. */
  bench: InPlay[];
  /** The Stadium in play on this side (場地牌區). One only; playing a new one
   *  discards the old. The real game shares ONE stadium; the sandbox keeps a
   *  per-side slot so each player can place/replace independently. */
  stadium: BattleCard | null;
}

export interface CardSpec {
  name: string;
  count: number;
  isBasic: boolean;
  section: "pokemon" | "trainer" | "energy" | "unknown";
  /** Play behaviour (view sets it via toBattleSpec). Omitted → derived from
   *  the section so the store always has a sensible, type-correct default. */
  kind?: PlayKind;
  catalogId?: string;
  hp?: number;
  retreat?: number;
  evolveFrom?: string;
}

/** A spec's play kind, defaulting from its section when not set explicitly. */
function specKind(s: CardSpec): PlayKind {
  if (s.kind !== undefined) return s.kind;
  if (s.section === "pokemon") return s.isBasic ? "basic" : "evolution";
  if (s.section === "energy") return "energy-basic";
  if (s.section === "trainer") return "item";
  return "unknown";
}

export const MAX_BENCH = 5;

interface BattleState {
  started: boolean;
  seed: number;
  /** Monotone counter folded into the seed so each reshuffle is reproducible. */
  shuffleNonce: number;
  turn: number;
  current: PlayerId;
  /** Who took the first turn (turn 1) — drives the going-first restrictions. */
  firstPlayer: PlayerId;
  /** Once-per-turn / per-turn flags for the current player (reset on endTurn). */
  turnSupporterUsed: boolean;
  turnEnergyAttached: boolean;
  turnStadiumPlayed: boolean;
  turnRetreated: boolean;
  /** Has each player ever had a Pokémon in play? — so "no Pokémon left = loss"
   *  fires only after a wipe, never during the spread-out manual setup. */
  everInPlay: { p1: boolean; p2: boolean };
  p1: PlayerBoard;
  p2: PlayerBoard;
  names: { p1: string; p2: string };
  /** Human-readable action log (newest LAST), capped — the faithful "what
   *  happened" replay trail (owner 2026-06-18, AI-sim reference). */
  log: string[];

  newGame: (input: { p1: CardSpec[]; p2: CardSpec[]; seed: number; names?: { p1: string; p2: string }; first?: PlayerId }) => void;
  /** Append one localized line to the action log. */
  note: (msg: string) => void;
  /** Shuffle deck, draw the opening 7, set 6 prizes from the top. */
  setup: (player: PlayerId) => void;
  draw: (player: PlayerId, n: number) => void;

  // --- Type-correct play actions (the real game) -------------------------
  /** Play a Basic Pokémon from hand to the Active spot (only if empty). */
  playToActive: (player: PlayerId, iid: string) => boolean;
  /** Play a Basic Pokémon from hand to the Bench (≤5). */
  playToBench: (player: PlayerId, iid: string) => boolean;
  /** Evolve: put a hand evolution onto a matching in-play unit. */
  evolve: (player: PlayerId, handIid: string, unitId: string) => boolean;
  /** Attach an Energy from hand to an in-play unit (sets the 1/turn flag). */
  attachEnergy: (player: PlayerId, handIid: string, unitId: string) => boolean;
  /** Attach a Tool from hand to an in-play unit. */
  attachTool: (player: PlayerId, handIid: string, unitId: string) => boolean;
  /** Play a Stadium from hand (discards the old one on this side). */
  playStadium: (player: PlayerId, handIid: string) => boolean;
  /** Play a Supporter/Item: resolve happens elsewhere; the card goes to discard. */
  discardFromHand: (player: PlayerId, iid: string) => void;
  /** Retreat: swap the Active with a benched unit (energy cost paid manually). */
  retreat: (player: PlayerId, benchUnitId: string) => boolean;
  /** Promote a benched unit to Active (e.g. after a KO). */
  promote: (player: PlayerId, benchUnitId: string) => boolean;
  /** Knock out a unit: it and everything attached go to the discard. */
  knockOut: (player: PlayerId, unitId: string) => void;
  /** Take n Prize cards (into the hand) — after scoring a Knock-Out. */
  takePrize: (player: PlayerId, n: number) => void;
  /** Take ONE specific (face-down) Prize card into the hand — manual prize pick. */
  takePrizeAt: (player: PlayerId, iid: string) => void;
  /** Adjust a unit's damage (clamped ≥0). */
  setDamage: (player: PlayerId, unitId: string, damage: number) => void;
  /** Toggle a Special Condition on a unit (poison/burn/asleep/confused/paralyzed). */
  toggleStatus: (player: PlayerId, unitId: string, cond: SpecialCondition) => void;
  /** Scoop a whole unit back to hand (board correction / Scoop Up effects). */
  scoopToHand: (player: PlayerId, unitId: string) => void;

  // --- Loose-pile moves + deck ops (manual sandbox + effects) ------------
  /** Move a loose card between flat piles (hand/discard/deck/prizes/lostzone). */
  moveToPile: (player: PlayerId, iid: string, to: Pile) => void;
  shuffleDeck: (player: PlayerId) => void;
  discardHand: (player: PlayerId) => void;
  shuffleHandIntoDeck: (player: PlayerId) => void;
  shuffleHandUnderDeck: (player: PlayerId) => void;
  markSupporterUsed: () => void;
  mulligan: (player: PlayerId) => void;
  endTurn: () => void;
  reset: () => void;
}

function emptyBoard(): PlayerBoard {
  return { deck: [], hand: [], discard: [], prizes: [], lostzone: [], active: null, bench: [], stadium: null };
}

/** Flatten a deck spec into per-instance cards (carrying the play facts). */
function instantiate(specs: CardSpec[]): BattleCard[] {
  const out: BattleCard[] = [];
  for (const s of specs) {
    for (let i = 0; i < s.count; i++) {
      out.push({
        iid: uid(),
        name: s.name,
        isBasic: s.isBasic,
        section: s.section,
        kind: specKind(s),
        ...(s.catalogId !== undefined ? { catalogId: s.catalogId } : {}),
        ...(s.hp !== undefined ? { hp: s.hp } : {}),
        ...(s.retreat !== undefined ? { retreat: s.retreat } : {}),
        ...(s.evolveFrom !== undefined ? { evolveFrom: s.evolveFrom } : {}),
      });
    }
  }
  return out;
}

function rngFor(seed: number, player: PlayerId, nonce: number): Rng {
  // Distinct, reproducible stream per player + reshuffle.
  return mulberry32((seed ^ (player === "p1" ? 0x1111 : 0x2222) ^ (nonce * 0x9e3779b9)) >>> 0);
}

/** Wrap a freshly-played Pokémon card as a new in-play unit. */
function newUnit(card: BattleCard, turn: number): InPlay {
  return { uid: card.iid, card, under: [], energy: [], tools: [], damage: 0, playedTurn: turn, status: [] };
}

/** All in-play units on a board (active first), for lookups. */
function units(board: PlayerBoard): InPlay[] {
  return board.active !== null ? [board.active, ...board.bench] : board.bench;
}

/** Find a hand card by iid. */
function handCard(board: PlayerBoard, iid: string): BattleCard | undefined {
  return board.hand.find((c) => c.iid === iid);
}

/** Remove a card from the hand, returning the new hand. */
function withoutHand(board: PlayerBoard, iid: string): BattleCard[] {
  return board.hand.filter((c) => c.iid !== iid);
}

/** Replace one unit (matched by uid) via a mapper; null-map removes it. */
function mapUnit(board: PlayerBoard, unitId: string, fn: (u: InPlay) => InPlay | null): PlayerBoard {
  if (board.active !== null && board.active.uid === unitId) {
    const next = fn(board.active);
    return { ...board, active: next };
  }
  const i = board.bench.findIndex((u) => u.uid === unitId);
  if (i === -1) return board;
  const next = fn(board.bench[i]!);
  const bench = next === null ? board.bench.filter((u) => u.uid !== unitId) : board.bench.map((u) => (u.uid === unitId ? next : u));
  return { ...board, bench };
}

/** Every loose card from a unit (its whole stack + attachments), for discard. */
function unitCards(u: InPlay): BattleCard[] {
  return [u.card, ...u.under, ...u.energy, ...u.tools];
}

export const useBattleStore = create<BattleState>()((set, get) => ({
  started: false,
  seed: 1,
  shuffleNonce: 0,
  turn: 1,
  current: "p1",
  firstPlayer: "p1",
  turnSupporterUsed: false,
  turnEnergyAttached: false,
  turnStadiumPlayed: false,
  turnRetreated: false,
  everInPlay: { p1: false, p2: false },
  p1: emptyBoard(),
  p2: emptyBoard(),
  names: { p1: "P1", p2: "P2" },
  log: [],

  note: (msg) => set((s) => ({ log: [...s.log, msg].slice(-80) })),

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
      turnEnergyAttached: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: false, p2: false },
      p1: { ...emptyBoard(), deck: instantiate(p1) },
      p2: { ...emptyBoard(), deck: instantiate(p2) },
      names: names ?? { p1: "P1", p2: "P2" },
      log: [],
    });
    get().setup("p1");
    get().setup("p2");
  },

  setup: (player) => {
    set((s) => {
      const board = s[player];
      // Every card the board holds (deck only at this point, but be safe).
      const all = [...PILES.flatMap((z) => board[z]), ...units(board).flatMap(unitCards), ...(board.stadium ? [board.stadium] : [])];
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

  // --- Type-correct play actions ----------------------------------------

  playToActive: (player, iid) => {
    let ok = false;
    set((s) => {
      const board = s[player];
      const card = handCard(board, iid);
      if (card === undefined || card.kind !== "basic" || board.active !== null) return {} as Partial<BattleState>;
      ok = true;
      return {
        [player]: { ...board, hand: withoutHand(board, iid), active: newUnit(card, s.turn) },
        everInPlay: { ...s.everInPlay, [player]: true },
      } as Partial<BattleState>;
    });
    return ok;
  },

  playToBench: (player, iid) => {
    let ok = false;
    set((s) => {
      const board = s[player];
      const card = handCard(board, iid);
      if (card === undefined || card.kind !== "basic" || board.bench.length >= MAX_BENCH) return {} as Partial<BattleState>;
      ok = true;
      return {
        [player]: { ...board, hand: withoutHand(board, iid), bench: [...board.bench, newUnit(card, s.turn)] },
        everInPlay: { ...s.everInPlay, [player]: true },
      } as Partial<BattleState>;
    });
    return ok;
  },

  evolve: (player, handIid, unitId) => {
    let ok = false;
    set((s) => {
      const board = s[player];
      const card = handCard(board, handIid);
      if (card === undefined || card.kind !== "evolution") return {} as Partial<BattleState>;
      const target = units(board).find((u) => u.uid === unitId);
      if (target === undefined) return {} as Partial<BattleState>;
      // We gate that the card IS an evolution and lands on a Pokémon (never a
      // Trainer slot), but do NOT hard-block on the evolveFrom NAME: card names
      // cross languages unreliably (zh/ja/en), so enforcing the exact lower-stage
      // name would wrongly reject legal evolutions. The view surfaces the named
      // pre-evolution as a hint; the player confirms the target (honest — same
      // reasoning as not auto-enforcing ACE SPEC).
      ok = true;
      const evolved = (u: InPlay): InPlay => ({
        ...u,
        card,
        under: [...u.under, u.card],
        playedTurn: s.turn,
        status: [], // evolving removes Special Conditions
      });
      return { [player]: { ...mapUnit(board, unitId, evolved), hand: withoutHand(board, handIid) } } as Partial<BattleState>;
    });
    return ok;
  },

  attachEnergy: (player, handIid, unitId) => {
    let ok = false;
    set((s) => {
      if (s.turnEnergyAttached) return {} as Partial<BattleState>; // 1 Energy attachment per turn (real rule)
      const board = s[player];
      const card = handCard(board, handIid);
      if (card === undefined || (card.kind !== "energy-basic" && card.kind !== "energy-special")) return {} as Partial<BattleState>;
      if (!units(board).some((u) => u.uid === unitId)) return {} as Partial<BattleState>;
      ok = true;
      const attach = (u: InPlay): InPlay => ({ ...u, energy: [...u.energy, card] });
      return { [player]: { ...mapUnit(board, unitId, attach), hand: withoutHand(board, handIid) }, turnEnergyAttached: true } as Partial<BattleState>;
    });
    return ok;
  },

  attachTool: (player, handIid, unitId) => {
    let ok = false;
    set((s) => {
      const board = s[player];
      const card = handCard(board, handIid);
      if (card === undefined || card.kind !== "tool") return {} as Partial<BattleState>;
      if (!units(board).some((u) => u.uid === unitId)) return {} as Partial<BattleState>;
      ok = true;
      const attach = (u: InPlay): InPlay => ({ ...u, tools: [...u.tools, card] });
      return { [player]: { ...mapUnit(board, unitId, attach), hand: withoutHand(board, handIid) } } as Partial<BattleState>;
    });
    return ok;
  },

  playStadium: (player, handIid) => {
    let ok = false;
    set((s) => {
      if (s.turnStadiumPlayed) return {} as Partial<BattleState>; // 1 Stadium per turn (real rule)
      const board = s[player];
      const card = handCard(board, handIid);
      if (card === undefined || card.kind !== "stadium") return {} as Partial<BattleState>;
      ok = true;
      const discard = board.stadium !== null ? [...board.discard, board.stadium] : board.discard;
      return { [player]: { ...board, hand: withoutHand(board, handIid), discard, stadium: card }, turnStadiumPlayed: true } as Partial<BattleState>;
    });
    return ok;
  },

  discardFromHand: (player, iid) => {
    set((s) => {
      const board = s[player];
      const card = handCard(board, iid);
      if (card === undefined) return {} as Partial<BattleState>;
      return { [player]: { ...board, hand: withoutHand(board, iid), discard: [...board.discard, card] } } as Partial<BattleState>;
    });
  },

  retreat: (player, benchUnitId) => {
    let ok = false;
    set((s) => {
      if (s.turnRetreated) return {} as Partial<BattleState>; // 1 retreat per turn (real rule)
      const board = s[player];
      const i = board.bench.findIndex((u) => u.uid === benchUnitId);
      if (i === -1) return {} as Partial<BattleState>;
      ok = true;
      const incoming = board.bench[i]!;
      const bench = board.bench.filter((u) => u.uid !== benchUnitId);
      // The old Active drops to the bench (energy cost is paid manually) and its
      // Special Conditions are removed (they only exist on the Active spot).
      const newBench = board.active !== null ? [...bench, { ...board.active, status: [] }] : bench;
      return { [player]: { ...board, active: incoming, bench: newBench }, turnRetreated: true } as Partial<BattleState>;
    });
    return ok;
  },

  promote: (player, benchUnitId) => {
    let ok = false;
    set((s) => {
      const board = s[player];
      if (board.active !== null) return {} as Partial<BattleState>;
      const i = board.bench.findIndex((u) => u.uid === benchUnitId);
      if (i === -1) return {} as Partial<BattleState>;
      ok = true;
      const incoming = board.bench[i]!;
      return { [player]: { ...board, active: incoming, bench: board.bench.filter((u) => u.uid !== benchUnitId) } } as Partial<BattleState>;
    });
    return ok;
  },

  knockOut: (player, unitId) => {
    set((s) => {
      const board = s[player];
      const u = units(board).find((x) => x.uid === unitId);
      if (u === undefined) return {} as Partial<BattleState>;
      const discard = [...board.discard, ...unitCards(u)];
      const cleared = mapUnit(board, unitId, () => null);
      return { [player]: { ...cleared, discard } } as Partial<BattleState>;
    });
  },

  takePrize: (player, n) => {
    set((s) => {
      const board = s[player];
      const k = Math.max(0, Math.min(Math.trunc(n), board.prizes.length));
      if (k === 0) return {} as Partial<BattleState>;
      return {
        [player]: { ...board, prizes: board.prizes.slice(k), hand: [...board.hand, ...board.prizes.slice(0, k)] },
      } as Partial<BattleState>;
    });
  },

  takePrizeAt: (player, iid) => {
    set((s) => {
      const board = s[player];
      const card = board.prizes.find((c) => c.iid === iid);
      if (card === undefined) return {} as Partial<BattleState>;
      return {
        [player]: { ...board, prizes: board.prizes.filter((c) => c.iid !== iid), hand: [...board.hand, card] },
      } as Partial<BattleState>;
    });
  },

  setDamage: (player, unitId, damage) => {
    set((s) => {
      const board = s[player];
      return { [player]: mapUnit(board, unitId, (u) => ({ ...u, damage: Math.max(0, Math.trunc(damage)) })) } as Partial<BattleState>;
    });
  },

  toggleStatus: (player, unitId, cond) => {
    set((s) => {
      const board = s[player];
      return {
        [player]: mapUnit(board, unitId, (u) => ({
          ...u,
          status: u.status.includes(cond) ? u.status.filter((c) => c !== cond) : [...u.status, cond],
        })),
      } as Partial<BattleState>;
    });
  },

  scoopToHand: (player, unitId) => {
    set((s) => {
      const board = s[player];
      const u = units(board).find((x) => x.uid === unitId);
      if (u === undefined) return {} as Partial<BattleState>;
      const hand = [...board.hand, ...unitCards(u)];
      const cleared = mapUnit(board, unitId, () => null);
      return { [player]: { ...cleared, hand } } as Partial<BattleState>;
    });
  },

  // --- Loose-pile moves + deck ops --------------------------------------

  moveToPile: (player, iid, to) => {
    set((s) => {
      const board = s[player];
      let from: Pile | null = null;
      for (const z of PILES) {
        if (board[z].some((c) => c.iid === iid)) {
          from = z;
          break;
        }
      }
      if (from === null || from === to) return {} as Partial<BattleState>;
      const card = board[from].find((c) => c.iid === iid);
      if (card === undefined) return {} as Partial<BattleState>;
      return {
        [player]: { ...board, [from]: board[from].filter((c) => c.iid !== iid), [to]: [...board[to], card] },
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
      return { [player]: { ...board, hand: [], discard: [...board.discard, ...board.hand] } } as Partial<BattleState>;
    });
  },

  shuffleHandIntoDeck: (player) => {
    set((s) => {
      const board = s[player];
      if (board.hand.length === 0) return {} as Partial<BattleState>;
      const deck = shuffle([...board.deck, ...board.hand], rngFor(s.seed, player, s.shuffleNonce + 1));
      return { shuffleNonce: s.shuffleNonce + 1, [player]: { ...board, hand: [], deck } } as Partial<BattleState>;
    });
  },

  shuffleHandUnderDeck: (player) => {
    set((s) => {
      const board = s[player];
      if (board.hand.length === 0) return {} as Partial<BattleState>;
      // Shuffle ONLY the hand among itself, then place it under the existing deck
      // (top order preserved, drawn off the top) — faithful to 放回牌庫下方.
      const shuffledHand = shuffle(board.hand, rngFor(s.seed, player, s.shuffleNonce + 1));
      return { shuffleNonce: s.shuffleNonce + 1, [player]: { ...board, hand: [], deck: [...board.deck, ...shuffledHand] } } as Partial<BattleState>;
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
    set((s) => {
      // Pokémon Checkup between turns: each Active takes its deterministic
      // Special-Condition damage — Poisoned +10, Burned +20. (Sleep/Confused/
      // Paralyzed recovery needs a coin flip → left to the player, honest.)
      const checkup = (b: PlayerBoard): PlayerBoard => {
        if (b.active === null) return b;
        const extra = (b.active.status.includes("poison") ? 10 : 0) + (b.active.status.includes("burn") ? 20 : 0);
        return extra === 0 ? b : { ...b, active: { ...b.active, damage: b.active.damage + extra } };
      };
      const next: PlayerId = s.current === "p1" ? "p2" : "p1";
      // Start-of-turn draw for the incoming player (PTCG Live auto-draws; a real
      // turn begins with a draw). An empty deck draws nothing — the can't-draw
      // LOSS is surfaced as a warning, not auto-decided (the draw is manual too).
      const drawTop = (b: PlayerBoard): PlayerBoard =>
        b.deck.length > 0 ? { ...b, hand: [...b.hand, b.deck[0]!], deck: b.deck.slice(1) } : b;
      let p1n = checkup(s.p1);
      let p2n = checkup(s.p2);
      if (next === "p1") p1n = drawTop(p1n);
      else p2n = drawTop(p2n);
      return {
        p1: p1n,
        p2: p2n,
        current: next,
        turn: s.turn + 1,
        turnSupporterUsed: false,
        turnEnergyAttached: false,
        turnStadiumPlayed: false,
        turnRetreated: false,
      };
    });
  },

  reset: () => {
    set({
      started: false,
      p1: emptyBoard(),
      p2: emptyBoard(),
      turn: 1,
      current: "p1",
      firstPlayer: "p1",
      turnSupporterUsed: false,
      turnEnergyAttached: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: false, p2: false },
      log: [],
    });
  },
}));

export interface GameResult {
  winner: PlayerId;
  reason: "prizes" | "noPokemon";
}

/**
 * Who has won, if anyone. Two faithful, unambiguous conditions:
 *  1. A player has taken all their Prize cards (prizes → 0).
 *  2. A player who HAS had a Pokémon in play now has none (a wipe). The
 *     `everInPlay` guard means the spread-out manual setup never false-triggers
 *     this. (The "can't draw at start of turn" loss is surfaced as a warning in
 *     the view, not auto-decided, since the draw is a manual action here.)
 */
export function gameResult(s: {
  started: boolean;
  turn: number;
  p1: PlayerBoard;
  p2: PlayerBoard;
  everInPlay: { p1: boolean; p2: boolean };
}): GameResult | null {
  if (!s.started) return null;
  if (s.p1.prizes.length === 0) return { winner: "p1", reason: "prizes" };
  if (s.p2.prizes.length === 0) return { winner: "p2", reason: "prizes" };
  const empty = (b: PlayerBoard) => b.active === null && b.bench.length === 0;
  const p1Wiped = s.everInPlay.p1 && empty(s.p1);
  const p2Wiped = s.everInPlay.p2 && empty(s.p2);
  if (p2Wiped && !p1Wiped) return { winner: "p1", reason: "noPokemon" };
  if (p1Wiped && !p2Wiped) return { winner: "p2", reason: "noPokemon" };
  return null;
}
