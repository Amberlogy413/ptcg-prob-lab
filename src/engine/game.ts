/**
 * The pure rules engine: a referentially-transparent reducer over `GameState`.
 *
 *   newGame(decks)        → initial state (shuffled, 7-card hands, 6 prizes)
 *   legalActions(s, ctx)  → every legal Action for s.current
 *   applyAction(s, a, ctx)→ the next state (a no-op for an illegal action)
 *   isTerminal / winner / reward → game-over + RL signal
 *
 * It enforces the same faithful PTCG rules as `battleStore`, but is STRICTER
 * where soundness matters for a learning agent: evolution respects the named
 * pre-evolution + summoning sickness, retreat requires (and discards) enough
 * Energy, one Tool per Pokémon, and attacking ends the turn. These tightenings
 * (vs. the permissive manual sandbox) are documented in docs/11_AI_AGENT.md.
 */

import { canPayCost, baseDamage, finalDamage, prizeValue } from "../state/battleAttack.ts";
import type { Catalog, CatalogCard } from "../data/catalog.ts";
import { resolveDeckRow } from "../data/catalog.ts";
import {
  MAX_BENCH,
  MAX_TOOLS,
  other,
  emptyBoard,
  instantiate,
  units,
  handCard,
  withoutHand,
  newUnit,
  mapUnit,
  withBoard,
  drawN,
  addDamage,
  knockOut,
  takePrize,
  setup,
} from "./ops.ts";
import { SUPPORTER_EFFECTS, isModeledSupporter } from "./cards.ts";
import type { Action, BattleCard, CardSpec, EngineCtx, GameState, InPlay, PlayerBoard, PlayerId } from "./types.ts";

/** Build the pure lookup context from a catalog (null → no catalog facts). */
export function makeCtx(catalog: Catalog | null): EngineCtx {
  const resolve = (card: BattleCard): CatalogCard | null =>
    catalog === null
      ? null
      : resolveDeckRow(catalog, { name: card.name, ...(card.catalogId !== undefined ? { catalogId: card.catalogId } : {}) });
  return {
    catalog,
    resolve,
    // AUTO_EFFECTS is keyed by the catalog storage name (zh for the zh-Hant set).
    autoKey: (card) => resolve(card)?.name ?? card.name,
  };
}

/** A fresh game: instantiate both decks, then shuffle + deal each side. */
export function newGame(input: { p1: CardSpec[]; p2: CardSpec[]; seed: number; first?: PlayerId }): GameState {
  const first = input.first ?? "p1";
  let s: GameState = {
    seed: input.seed,
    shuffleNonce: 0,
    turn: 1,
    current: first,
    firstPlayer: first,
    turnSupporterUsed: false,
    turnEnergyAttached: false,
    turnStadiumPlayed: false,
    turnRetreated: false,
    everInPlay: { p1: false, p2: false },
    p1: { ...emptyBoard(), deck: instantiate(input.p1, "p1") },
    p2: { ...emptyBoard(), deck: instantiate(input.p2, "p2") },
  };
  s = setup(s, "p1");
  s = setup(s, "p2");
  // The going-first player draws at the start of turn 1. Under current official
  // rules only no-attack / no-Supporter apply on turn 1; the turn-1 draw DOES
  // happen (the opening DEAL is 7 — this mandatory draw then makes it 8).
  s = drawN(s, first, 1);
  return s;
}

/** An Active that is Asleep or Paralyzed cannot attack (real rule). */
function canActiveAttack(unit: InPlay): boolean {
  return !unit.status.includes("asleep") && !unit.status.includes("paralyzed");
}

/** Is it the going-first player's turn 1? (no Supporter, no attack, no evolve.) */
function firstTurnRestricted(s: GameState): boolean {
  return s.turn === 1 && s.current === s.firstPlayer;
}

/** Can this hand evolution legally land on this unit right now? */
function canEvolveOnto(s: GameState, card: BattleCard, unit: InPlay): boolean {
  if (card.kind !== "evolution") return false;
  if (firstTurnRestricted(s)) return false; // no evolving on the going-first turn 1
  if (unit.playedTurn >= s.turn) return false; // not the turn it came down / last evolved
  // Honest name gate: enforce the printed pre-evolution ONLY when we know it
  // (same-language deck build → reliable); unknown evolveFrom stays permissive.
  if (card.evolveFrom !== undefined && card.evolveFrom !== "" && card.evolveFrom !== unit.card.name) return false;
  return true;
}

/** Energy the unit can spend on retreat (any Energy pays the Colorless cost). */
function retreatCost(card: BattleCard): number {
  return card.retreat ?? 0;
}

/** Every legal move for the player to act (`s.current`). */
export function legalActions(s: GameState, ctx: EngineCtx): Action[] {
  if (isTerminal(s)) return [];
  const me: PlayerBoard = s[s.current];
  const opp: PlayerBoard = s[other(s.current)];
  const acts: Action[] = [];

  // Forced promotion: an empty Active with a Bench can do nothing else first.
  if (me.active === null && me.bench.length > 0) {
    for (const b of me.bench) acts.push({ type: "promote", benchUnitId: b.uid });
    return acts;
  }

  const inPlay = units(me);

  for (const c of me.hand) {
    if (c.kind === "basic") {
      if (me.active === null) acts.push({ type: "playToActive", iid: c.iid });
      // Benching requires an Active first — you can never hold a benched Pokémon
      // with an empty Active during your own actions (real setup/play order).
      if (me.active !== null && me.bench.length < MAX_BENCH) acts.push({ type: "playToBench", iid: c.iid });
    } else if (c.kind === "evolution") {
      for (const u of inPlay) if (canEvolveOnto(s, c, u)) acts.push({ type: "evolve", handIid: c.iid, unitId: u.uid });
    } else if (c.kind === "energy-basic" || c.kind === "energy-special") {
      if (!s.turnEnergyAttached) for (const u of inPlay) acts.push({ type: "attachEnergy", handIid: c.iid, unitId: u.uid });
    } else if (c.kind === "tool") {
      for (const u of inPlay) if (u.tools.length < MAX_TOOLS) acts.push({ type: "attachTool", handIid: c.iid, unitId: u.uid });
    } else if (c.kind === "stadium") {
      if (!s.turnStadiumPlayed) acts.push({ type: "playStadium", iid: c.iid });
    } else if (c.kind === "supporter") {
      if (!s.turnSupporterUsed && !firstTurnRestricted(s) && isModeledSupporter(ctx.autoKey(c)))
        acts.push({ type: "playSupporter", iid: c.iid });
    }
  }

  // Retreat: once per turn, needs enough attached Energy to pay the cost.
  if (!s.turnRetreated && me.active !== null) {
    const cost = retreatCost(me.active.card);
    if (me.active.energy.length >= cost) for (const b of me.bench) acts.push({ type: "retreat", benchUnitId: b.uid });
  }

  // Attack: needs an Active vs. an Active, not turn-1-first, not Asleep/Paralyzed,
  // and payable Energy.
  if (me.active !== null && opp.active !== null && !firstTurnRestricted(s) && canActiveAttack(me.active)) {
    const ac = ctx.resolve(me.active.card);
    const attacks = ac?.attacks ?? [];
    attacks.forEach((a, i) => {
      if (canPayCost(me.active!.energy, a.cost)) acts.push({ type: "attack", index: i });
    });
  }

  acts.push({ type: "endTurn" });
  return acts;
}

/** Pokémon Checkup between turns + the incoming player's start-of-turn draw,
 *  then flip to the next player and reset the per-turn flags. */
function endTurnTransition(s: GameState): GameState {
  const checkup = (b: PlayerBoard): PlayerBoard => {
    if (b.active === null) return b;
    const extra = (b.active.status.includes("poison") ? 10 : 0) + (b.active.status.includes("burn") ? 20 : 0);
    return extra === 0 ? b : { ...b, active: { ...b.active, damage: b.active.damage + extra } };
  };
  const next = other(s.current);
  const drawTop = (b: PlayerBoard): PlayerBoard =>
    b.deck.length > 0 ? { ...b, hand: [...b.hand, b.deck[0]!], deck: b.deck.slice(1) } : b;
  let p1n = checkup(s.p1);
  let p2n = checkup(s.p2);
  // The incoming player makes their mandatory start-of-turn draw; an empty deck
  // at that moment is a LOSS (real rule). The engine ENFORCES it via deckedOut.
  const incoming = next === "p1" ? p1n : p2n;
  const deckedOut = incoming.deck.length === 0 ? next : null;
  if (next === "p1") p1n = drawTop(p1n);
  else p2n = drawTop(p2n);
  return {
    ...s,
    p1: p1n,
    p2: p2n,
    current: next,
    turn: s.turn + 1,
    deckedOut,
    turnSupporterUsed: false,
    turnEnergyAttached: false,
    turnStadiumPlayed: false,
    turnRetreated: false,
  };
}

/** Apply a (legal) action, returning the next state. An illegal action is a
 *  no-op (returns the same state) — callers should pick from `legalActions`. */
export function applyAction(s: GameState, a: Action, ctx: EngineCtx): GameState {
  const me = s.current;
  const board = s[me];

  switch (a.type) {
    case "playToActive": {
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "basic" || board.active !== null) return s;
      const ns = withBoard(s, me, { ...board, hand: withoutHand(board, a.iid), active: newUnit(card, s.turn) });
      return { ...ns, everInPlay: { ...s.everInPlay, [me]: true } };
    }
    case "playToBench": {
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "basic" || board.active === null || board.bench.length >= MAX_BENCH) return s;
      const ns = withBoard(s, me, { ...board, hand: withoutHand(board, a.iid), bench: [...board.bench, newUnit(card, s.turn)] });
      return { ...ns, everInPlay: { ...s.everInPlay, [me]: true } };
    }
    case "evolve": {
      const card = handCard(board, a.handIid);
      if (card === undefined) return s;
      const target = units(board).find((u) => u.uid === a.unitId);
      if (target === undefined || !canEvolveOnto(s, card, target)) return s;
      const evolved = (u: InPlay): InPlay => ({ ...u, card, under: [...u.under, u.card], playedTurn: s.turn, status: [] });
      return withBoard(s, me, { ...mapUnit(board, a.unitId, evolved), hand: withoutHand(board, a.handIid) });
    }
    case "attachEnergy": {
      const card = handCard(board, a.handIid);
      if (card === undefined || (card.kind !== "energy-basic" && card.kind !== "energy-special")) return s;
      if (s.turnEnergyAttached || !units(board).some((u) => u.uid === a.unitId)) return s;
      const attach = (u: InPlay): InPlay => ({ ...u, energy: [...u.energy, card] });
      const ns = withBoard(s, me, { ...mapUnit(board, a.unitId, attach), hand: withoutHand(board, a.handIid) });
      return { ...ns, turnEnergyAttached: true };
    }
    case "attachTool": {
      const card = handCard(board, a.handIid);
      if (card === undefined || card.kind !== "tool") return s;
      const target = units(board).find((u) => u.uid === a.unitId);
      if (target === undefined || target.tools.length >= MAX_TOOLS) return s;
      const attach = (u: InPlay): InPlay => ({ ...u, tools: [...u.tools, card] });
      return withBoard(s, me, { ...mapUnit(board, a.unitId, attach), hand: withoutHand(board, a.handIid) });
    }
    case "playStadium": {
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "stadium" || s.turnStadiumPlayed) return s;
      const discard = board.stadium !== null ? [...board.discard, board.stadium] : board.discard;
      const ns = withBoard(s, me, { ...board, hand: withoutHand(board, a.iid), discard, stadium: card });
      return { ...ns, turnStadiumPlayed: true };
    }
    case "playSupporter": {
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "supporter" || s.turnSupporterUsed || firstTurnRestricted(s)) return s;
      const key = ctx.autoKey(card);
      const fx = SUPPORTER_EFFECTS[key];
      if (fx === undefined) return s; // unmodeled → not playable here (honest)
      return { ...fx(s, me, a.iid), turnSupporterUsed: true };
    }
    case "retreat": {
      if (s.turnRetreated || board.active === null) return s;
      const i = board.bench.findIndex((u) => u.uid === a.benchUnitId);
      if (i === -1) return s;
      const out = board.active;
      const cost = retreatCost(out.card);
      if (out.energy.length < cost) return s;
      // Pay the retreat cost: discard `cost` Energy from the retreating Pokémon.
      const paidEnergy = out.energy.slice(cost);
      const discarded = out.energy.slice(0, cost);
      const incoming = board.bench[i]!;
      const benched = board.bench.filter((u) => u.uid !== a.benchUnitId);
      const newBench = [...benched, { ...out, energy: paidEnergy, status: [] }];
      const ns = withBoard(s, me, { ...board, active: incoming, bench: newBench, discard: [...board.discard, ...discarded] });
      return { ...ns, turnRetreated: true };
    }
    case "promote": {
      if (board.active !== null) return s;
      const i = board.bench.findIndex((u) => u.uid === a.benchUnitId);
      if (i === -1) return s;
      const incoming = board.bench[i]!;
      return withBoard(s, me, { ...board, active: incoming, bench: board.bench.filter((u) => u.uid !== a.benchUnitId) });
    }
    case "attack": {
      const oppId = other(me);
      const opp = s[oppId];
      if (board.active === null || opp.active === null || firstTurnRestricted(s) || !canActiveAttack(board.active)) return s;
      const ac = ctx.resolve(board.active.card);
      const atk = ac?.attacks?.[a.index];
      if (atk === undefined || !canPayCost(board.active.energy, atk.cost)) return s;
      const oc = ctx.resolve(opp.active.card);
      const { damage } = finalDamage(ac, oc, baseDamage(atk.damage));
      const defenderUid = opp.active.uid;
      const newDamage = opp.active.damage + damage;
      let ns = addDamage(s, oppId, defenderUid, damage);
      const hp = opp.active.card.hp;
      if (hp !== undefined && newDamage >= hp) {
        const prizes = prizeValue(oc);
        ns = knockOut(ns, oppId, defenderUid);
        ns = takePrize(ns, me, prizes);
      }
      // Attacking ends the turn (unless it just won the game).
      if (isTerminal(ns)) return ns;
      return endTurnTransition(ns);
    }
    case "endTurn": {
      if (board.active === null && board.bench.length > 0) return s; // must promote first
      return endTurnTransition(s);
    }
    default:
      return s;
  }
}

export interface GameResult {
  winner: PlayerId;
  reason: "prizes" | "noPokemon" | "deckOut";
}

/** Who has won, if anyone. The store's two faithful conditions (all Prizes taken,
 *  or a wiped board) PLUS the deck-out loss the engine enforces for RL soundness. */
export function gameResult(s: GameState): GameResult | null {
  if (s.deckedOut === "p1") return { winner: "p2", reason: "deckOut" };
  if (s.deckedOut === "p2") return { winner: "p1", reason: "deckOut" };
  if (s.p1.prizes.length === 0) return { winner: "p1", reason: "prizes" };
  if (s.p2.prizes.length === 0) return { winner: "p2", reason: "prizes" };
  const empty = (b: PlayerBoard) => b.active === null && b.bench.length === 0;
  const p1Wiped = s.everInPlay.p1 && empty(s.p1);
  const p2Wiped = s.everInPlay.p2 && empty(s.p2);
  if (p2Wiped && !p1Wiped) return { winner: "p1", reason: "noPokemon" };
  if (p1Wiped && !p2Wiped) return { winner: "p2", reason: "noPokemon" };
  return null;
}

export function isTerminal(s: GameState): boolean {
  return gameResult(s) !== null;
}

export function winner(s: GameState): PlayerId | null {
  return gameResult(s)?.winner ?? null;
}

/** RL reward from `player`'s point of view: +1 win, −1 loss, 0 otherwise. */
export function reward(s: GameState, player: PlayerId): number {
  const w = winner(s);
  if (w === null) return 0;
  return w === player ? 1 : -1;
}
