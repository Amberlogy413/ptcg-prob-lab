/**
 * Pure rules-engine types (#36 → AI agent step ①, owner 2026-06-18). This is the
 * framework-free HEADLESS game model: a `GameState` plus a discrete `Action`
 * space, with no React / Zustand / UI dependency. It mirrors the same faithful
 * PTCG rules the live `battleStore` enforces, but as a pure value so it can be
 * driven programmatically (a reinforcement-learning environment: state →
 * legalActions → applyAction → reward). A store-parity test (engineParity.spec)
 * cross-checks the SHARED primitives (shuffle / deal / draw / shuffle-into-deck)
 * plus a few representative shared actions; where the engine is intentionally
 * STRICTER than the manual sandbox, the differences are listed in
 * docs/11_AI_AGENT.md §4 — not silent.
 *
 * Card-instance / board types are re-used (by type only — erased at runtime) from
 * the store, so there is ONE definition of a board, not two.
 */

import type { BattleCard, InPlay, PlayerBoard, PlayerId, SpecialCondition, CardSpec } from "../state/battleStore.ts";
import type { Catalog, CatalogCard } from "../data/catalog.ts";

export type { BattleCard, InPlay, PlayerBoard, PlayerId, SpecialCondition, CardSpec };

/** The complete, serialisable game state — everything an agent observes plus the
 *  bookkeeping the rules need. Deterministic given (seed, shuffleNonce). */
export interface GameState {
  seed: number;
  /** Monotone counter folded into the seed so each reshuffle is reproducible. */
  shuffleNonce: number;
  turn: number;
  current: PlayerId;
  firstPlayer: PlayerId;
  turnSupporterUsed: boolean;
  turnEnergyAttached: boolean;
  turnStadiumPlayed: boolean;
  turnRetreated: boolean;
  everInPlay: { p1: boolean; p2: boolean };
  /** Set to the player who could not make their mandatory start-of-turn draw
   *  (empty deck) — that player loses (real rule). null/undefined while the game
   *  continues. The engine ENFORCES this; the manual sandbox only warns. */
  deckedOut?: PlayerId | null;
  p1: PlayerBoard;
  p2: PlayerBoard;
}

/** The discrete action space. Every entry returned by `legalActions` is a legal
 *  move for `state.current`; `applyAction` is a no-op for anything else. */
export type Action =
  | { type: "playToActive"; iid: string }
  | { type: "playToBench"; iid: string }
  | { type: "evolve"; handIid: string; unitId: string }
  | { type: "attachEnergy"; handIid: string; unitId: string }
  | { type: "attachTool"; handIid: string; unitId: string }
  | { type: "playStadium"; iid: string }
  | { type: "playSupporter"; iid: string }
  /** Boss's Orders (gust): drag an OPPONENT bench Pokémon up to their Active. */
  | { type: "playGust"; iid: string; targetUid: string }
  /** Switch (item): swap YOUR Active with one of your own bench Pokémon. */
  | { type: "playSwitch"; iid: string; benchUid: string }
  | { type: "retreat"; benchUnitId: string }
  | { type: "attack"; index: number }
  | { type: "promote"; benchUnitId: string }
  | { type: "endTurn" };

export type ActionType = Action["type"];

/** Pure, catalog-backed lookups the engine needs — no mutable state, so the
 *  whole engine stays a pure function of (state, action, ctx). */
export interface EngineCtx {
  /** Resolve a battle card to its verified catalog facts (attacks, types, …). */
  resolve: (card: BattleCard) => CatalogCard | null;
  /** The canonical key (zh storage name) for the modeled-effect registry. */
  autoKey: (card: BattleCard) => string;
  /** The catalog this context was built from (null when unavailable). */
  catalog: Catalog | null;
}
