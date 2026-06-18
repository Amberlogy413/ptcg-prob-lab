/**
 * Low-level PURE board operations for the rules engine. Every function takes a
 * value and returns a NEW value (never mutates), so the engine is referentially
 * transparent and trivially undoable/replayable. These mirror the private
 * helpers inside `battleStore` exactly — the store-parity test keeps them honest.
 *
 * No probability math here; this only performs faithful zone moves. The seeded
 * shuffle is the same `mulberry32` the store uses, so a game replays identically.
 */

import { mulberry32, shuffle, type Rng } from "../utils/rng.ts";
import type { BattleCard, InPlay, PlayerBoard, PlayerId, CardSpec, GameState } from "./types.ts";

export const MAX_BENCH = 5;
/** One Pokémon Tool per Pokémon (real rule the strict engine enforces). */
export const MAX_TOOLS = 1;

export function other(p: PlayerId): PlayerId {
  return p === "p1" ? "p2" : "p1";
}

export function emptyBoard(): PlayerBoard {
  return { deck: [], hand: [], discard: [], prizes: [], lostzone: [], active: null, bench: [], stadium: null };
}

/** A spec's play kind, defaulting from its section (mirrors store.specKind). */
function specKind(s: CardSpec): BattleCard["kind"] {
  if (s.kind !== undefined) return s.kind;
  if (s.section === "pokemon") return s.isBasic ? "basic" : "evolution";
  if (s.section === "energy") return "energy-basic";
  if (s.section === "trainer") return "item";
  return "unknown";
}

/** Flatten a deck spec into per-instance cards with DETERMINISTIC ids
 *  (`<player>-<n>`) so a game is fully reproducible — unlike the store's random
 *  `uid()`, which is fine for the UI but not for replay/training. */
export function instantiate(specs: CardSpec[], player: PlayerId): BattleCard[] {
  const out: BattleCard[] = [];
  let n = 0;
  for (const s of specs) {
    for (let i = 0; i < s.count; i++) {
      out.push({
        iid: `${player}-${n++}`,
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

/** Distinct, reproducible RNG stream per player + reshuffle (mirrors store). */
export function rngFor(seed: number, player: PlayerId, nonce: number): Rng {
  return mulberry32((seed ^ (player === "p1" ? 0x1111 : 0x2222) ^ (nonce * 0x9e3779b9)) >>> 0);
}

/** All in-play units on a board (active first). */
export function units(board: PlayerBoard): InPlay[] {
  return board.active !== null ? [board.active, ...board.bench] : board.bench;
}

export function handCard(board: PlayerBoard, iid: string): BattleCard | undefined {
  return board.hand.find((c) => c.iid === iid);
}

export function withoutHand(board: PlayerBoard, iid: string): BattleCard[] {
  return board.hand.filter((c) => c.iid !== iid);
}

/** Wrap a freshly-played Pokémon card as a new in-play unit. */
export function newUnit(card: BattleCard, turn: number): InPlay {
  return { uid: card.iid, card, under: [], energy: [], tools: [], damage: 0, playedTurn: turn, status: [] };
}

/** Every loose card from a unit (whole stack + attachments), for discard/scoop. */
export function unitCards(u: InPlay): BattleCard[] {
  return [u.card, ...u.under, ...u.energy, ...u.tools];
}

/** Replace one unit (matched by uid) via a mapper; a null result removes it. */
export function mapUnit(board: PlayerBoard, unitId: string, fn: (u: InPlay) => InPlay | null): PlayerBoard {
  if (board.active !== null && board.active.uid === unitId) {
    return { ...board, active: fn(board.active) };
  }
  const i = board.bench.findIndex((u) => u.uid === unitId);
  if (i === -1) return board;
  const next = fn(board.bench[i]!);
  const bench = next === null ? board.bench.filter((u) => u.uid !== unitId) : board.bench.map((u) => (u.uid === unitId ? next : u));
  return { ...board, bench };
}

// --- GameState-level pile helpers (used by effects + actions) ---------------

/** Replace one player's board on the state. */
export function withBoard(s: GameState, player: PlayerId, board: PlayerBoard): GameState {
  return { ...s, [player]: board } as GameState;
}

/** Draw n from the top of the deck into the hand (clamped to deck size). */
export function drawN(s: GameState, player: PlayerId, n: number): GameState {
  const b = s[player];
  const k = Math.max(0, Math.min(Math.trunc(n), b.deck.length));
  if (k === 0) return s;
  return withBoard(s, player, { ...b, hand: [...b.hand, ...b.deck.slice(0, k)], deck: b.deck.slice(k) });
}

/** Move a hand card to the discard (no effect resolution). */
export function discardFromHand(s: GameState, player: PlayerId, iid: string): GameState {
  const b = s[player];
  const card = handCard(b, iid);
  if (card === undefined) return s;
  return withBoard(s, player, { ...b, hand: withoutHand(b, iid), discard: [...b.discard, card] });
}

/** Discard the whole hand. */
export function discardHand(s: GameState, player: PlayerId): GameState {
  const b = s[player];
  if (b.hand.length === 0) return s;
  return withBoard(s, player, { ...b, hand: [], discard: [...b.discard, ...b.hand] });
}

/** Shuffle the hand into the deck and reshuffle the whole deck (advances nonce). */
export function shuffleHandIntoDeck(s: GameState, player: PlayerId): GameState {
  const b = s[player];
  if (b.hand.length === 0) return s;
  const nonce = s.shuffleNonce + 1;
  const deck = shuffle([...b.deck, ...b.hand], rngFor(s.seed, player, nonce));
  return { ...withBoard(s, player, { ...b, hand: [], deck }), shuffleNonce: nonce };
}

/** Reshuffle the deck in place (advances nonce). */
export function shuffleDeck(s: GameState, player: PlayerId): GameState {
  const b = s[player];
  const nonce = s.shuffleNonce + 1;
  return { ...withBoard(s, player, { ...b, deck: shuffle(b.deck, rngFor(s.seed, player, nonce)) }), shuffleNonce: nonce };
}

/** Add damage to a unit (clamped ≥0). */
export function addDamage(s: GameState, player: PlayerId, unitId: string, delta: number): GameState {
  const b = mapUnit(s[player], unitId, (u) => ({ ...u, damage: Math.max(0, u.damage + delta) }));
  return withBoard(s, player, b);
}

/** Knock a unit out: it and everything attached go to the discard. */
export function knockOut(s: GameState, player: PlayerId, unitId: string): GameState {
  const board = s[player];
  const u = units(board).find((x) => x.uid === unitId);
  if (u === undefined) return s;
  const discard = [...board.discard, ...unitCards(u)];
  return withBoard(s, player, { ...mapUnit(board, unitId, () => null), discard });
}

/** Take n Prize cards into the hand (mirrors store — prizes go to hand). */
export function takePrize(s: GameState, player: PlayerId, n: number): GameState {
  const b = s[player];
  const k = Math.max(0, Math.min(Math.trunc(n), b.prizes.length));
  if (k === 0) return s;
  return withBoard(s, player, { ...b, prizes: b.prizes.slice(k), hand: [...b.hand, ...b.prizes.slice(0, k)] });
}

/** Shuffle a deck and deal the opening 7 + 6 prizes (mirrors store.setup). Gathers
 *  the WHOLE board (every pile PLUS in-play units + their attachments + stadium)
 *  so the 60-card multiset is conserved even if called on a non-empty board. */
export function setup(s: GameState, player: PlayerId): GameState {
  const board = s[player];
  const all = [
    ...board.deck,
    ...board.hand,
    ...board.discard,
    ...board.prizes,
    ...board.lostzone,
    ...units(board).flatMap(unitCards),
    ...(board.stadium !== null ? [board.stadium] : []),
  ];
  const nonce = s.shuffleNonce + 1;
  const shuffled = shuffle(all, rngFor(s.seed, player, nonce));
  return {
    ...s,
    shuffleNonce: nonce,
    [player]: { ...emptyBoard(), deck: shuffled.slice(13), hand: shuffled.slice(0, 7), prizes: shuffled.slice(7, 13) },
  } as GameState;
}
