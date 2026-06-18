/**
 * Bridge between the live UI store (battleStore) and the PURE rules engine
 * (src/engine) — the move toward a SINGLE rules source (owner 2026-06-18, "B").
 *
 * The `PlayerBoard` type is shared between the two, so a `GameState` is just a
 * projection of the store's game fields. `engineStep` runs ONE engine `Action`
 * and writes the result back to the store, so an effect routed through here has
 * exactly one definition — the engine's verified, tested one — instead of a
 * second hand-written copy in the store. Returns false on a no-op (illegal move).
 *
 * Scope today: the targeted effects the engine models (Boss's Orders / Switch).
 * The permissive manual sandbox ops (set damage, move any card, manual KO) stay
 * store-only by design — they are corrections, not real game moves. More moves
 * can be routed through here in later steps without changing this bridge.
 */

import { useBattleStore } from "./battleStore.ts";
import { applyAction, makeCtx, type Action, type GameState } from "../engine/index.ts";
import type { Catalog } from "../data/catalog.ts";

type StoreState = ReturnType<typeof useBattleStore.getState>;

/** Project the store's game fields into the engine's pure GameState. */
function toEngineState(s: StoreState): GameState {
  return {
    seed: s.seed,
    shuffleNonce: s.shuffleNonce,
    turn: s.turn,
    current: s.current,
    firstPlayer: s.firstPlayer,
    turnSupporterUsed: s.turnSupporterUsed,
    turnEnergyAttached: s.turnEnergyAttached,
    turnStadiumPlayed: s.turnStadiumPlayed,
    turnRetreated: s.turnRetreated,
    everInPlay: s.everInPlay,
    p1: s.p1,
    p2: s.p2,
  };
}

/**
 * Apply one engine Action to the live store. Returns true if it changed the
 * board (false = illegal / no-op). Callers should wrap this in the view's `act()`
 * for atomic undo and emit their own log line.
 */
export function engineStep(action: Action, catalog: Catalog | null): boolean {
  const before = toEngineState(useBattleStore.getState());
  const after = applyAction(before, action, makeCtx(catalog));
  if (after === before) return false; // engine no-op → illegal move
  useBattleStore.setState({
    seed: after.seed,
    shuffleNonce: after.shuffleNonce,
    turn: after.turn,
    current: after.current,
    firstPlayer: after.firstPlayer,
    turnSupporterUsed: after.turnSupporterUsed,
    turnEnergyAttached: after.turnEnergyAttached,
    turnStadiumPlayed: after.turnStadiumPlayed,
    turnRetreated: after.turnRetreated,
    everInPlay: after.everInPlay,
    p1: after.p1,
    p2: after.p2,
  });
  return true;
}
