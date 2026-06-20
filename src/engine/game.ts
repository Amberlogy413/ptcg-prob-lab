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

import { canPayCost, baseDamage, finalDamage, prizeValue, inflictedStatus, energyProvides, selfHealAmount, attackDrawCount, selfDamageAmount, locksAttackerNextTurn, locksDefenderNextTurn, discardEnergyCount, energyDiscardCombos, benchDamageAmount } from "../state/battleAttack.ts";
import type { Catalog, CatalogCard } from "../data/catalog.ts";
import { resolveDeckRow, localizeDeckRow } from "../data/catalog.ts";
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
  discardFromHand,
  shuffleDeck,
  addDamage,
  knockOut,
  takePrize,
  setup,
} from "./ops.ts";
import { SUPPORTER_EFFECTS, isModeledSupporter, isGustEffect, isSwitchEffect, isEnergySwitchEffect, isEnergyRetrieveEffect, isRareCandyEffect, energyRetrieveCombos, searchSpecOf, handPayCombos } from "./cards.ts";
import { canRareCandyJump } from "../data/evolution.ts";
import type { Action, BattleCard, CardSpec, EngineCtx, GameState, InPlay, PlayerBoard, PlayerId } from "./types.ts";

/** Hiragana + katakana — a card's effect text containing kana means it's the
 *  Japanese print (zh effect text has none), used to pick the zh-effect sibling. */
const HAS_KANA = /[぀-ヿ]/;

/** Build the pure lookup context from a catalog (null → no catalog facts). */
export function makeCtx(catalog: Catalog | null): EngineCtx {
  const idOf = (card: BattleCard) => ({ name: card.name, ...(card.catalogId !== undefined ? { catalogId: card.catalogId } : {}) });
  // Resolve to a zh-Hant-EFFECT print. A newest-set card can resolve to a Japanese
  // print whose effect text won't match our zh effect keys (e.g. 夜のタンカ /
  // リーリエの決心) — and re-resolving by name doesn't help, because the name index
  // maps the zh name to the JP print too (via its nameZh). So: take the resolved
  // print, and if its effect contains kana (i.e. it's Japanese), swap to a sibling
  // print of the SAME card (same nameZh) whose effect is kana-free (zh). Pokémon
  // have no `effect`, so this only ever re-targets Trainer/Energy text.
  const resolve = (card: BattleCard): CatalogCard | null => {
    if (catalog === null) return null;
    const direct = resolveDeckRow(catalog, idOf(card));
    if (direct === null || direct.effect === undefined || !HAS_KANA.test(direct.effect)) return direct;
    const key = direct.nameZh ?? direct.name;
    const zh = catalog.cards.find((c) => (c.nameZh ?? c.name) === key && c.effect !== undefined && !HAS_KANA.test(c.effect));
    return zh ?? direct;
  };
  return {
    catalog,
    resolve,
    // The modeled-effect registry is keyed by the zh DISPLAY name.
    autoKey: (card) => (catalog === null ? card.name : localizeDeckRow(catalog, idOf(card), "zh").name),
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
  // Mulligan: an opening hand with no Basic Pokémon is reshuffled + re-dealt (real
  // rule). Capped so a deck that genuinely has no Basics can't loop forever (it
  // just keeps its no-Basic hand — an illegal deck the builder already forbids).
  // (The opponent's extra-card-per-mulligan is not modeled — a disclosed gap.)
  const hasBasic = (b: PlayerBoard): boolean => b.hand.some((c) => c.kind === "basic");
  const MULLIGAN_CAP = 20;
  for (const pl of ["p1", "p2"] as const) {
    for (let tries = 0; !hasBasic(s[pl]) && tries < MULLIGAN_CAP; tries++) s = setup(s, pl);
  }
  // The going-first player draws at the start of turn 1. Under current official
  // rules only no-attack / no-Supporter apply on turn 1; the turn-1 draw DOES
  // happen (the opening DEAL is 7 — this mandatory draw then makes it 8).
  s = drawN(s, first, 1);
  return s;
}

/** An Active that is Asleep or Paralyzed cannot attack OR retreat (real rule;
 *  Confusion still permits both). */
function canActiveAttack(unit: InPlay): boolean {
  return !unit.status.includes("asleep") && !unit.status.includes("paralyzed");
}
const canActiveRetreat = canActiveAttack;

/** Is it the going-first player's turn 1? (no Supporter, no attack, no evolve.) */
function firstTurnRestricted(s: GameState): boolean {
  return s.turn === 1 && s.current === s.firstPlayer;
}

/** Is it the CURRENT player's own first turn? (firstPlayer → turn 1; the other →
 *  turn 2.) Rare Candy is barred on your own first turn (its printed text). */
function isOwnFirstTurn(s: GameState): boolean {
  return s.current === s.firstPlayer ? s.turn === 1 : s.turn === 2;
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
      if (!s.turnSupporterUsed && !firstTurnRestricted(s)) {
        if (isModeledSupporter(ctx.autoKey(c))) {
          acts.push({ type: "playSupporter", iid: c.iid });
        } else if (isGustEffect(ctx.resolve(c)?.effect) && opp.active !== null && opp.bench.length > 0) {
          // Boss's Orders: the choice (which opp bench Pokémon) is the action.
          for (const b of opp.bench) acts.push({ type: "playGust", iid: c.iid, targetUid: b.uid });
        }
      }
    } else if (c.kind === "item") {
      const effect = ctx.resolve(c)?.effect;
      if (isSwitchEffect(effect)) {
        // Switch: the choice (which of your own bench) is the action (no Energy cost).
        if (me.active !== null && me.bench.length > 0)
          for (const b of me.bench) acts.push({ type: "playSwitch", iid: c.iid, benchUid: b.uid });
      } else if (isEnergySwitchEffect(effect)) {
        // Energy Switch: move one basic Energy between two of your own Pokémon. The
        // (source Energy → target) pair IS the action; identical-element Energy on
        // the same source is deduped (same resulting board) to keep the space minimal.
        for (const src of inPlay) {
          const seen = new Set<string>();
          for (const e of src.energy) {
            const elem = energyProvides(e); // basic Energy by name; special → null (not movable)
            if (elem === null) continue;
            if (seen.has(elem)) continue;
            seen.add(elem);
            for (const dst of inPlay) if (dst.uid !== src.uid) acts.push({ type: "energySwitch", iid: c.iid, fromUid: src.uid, energyIid: e.iid, toUid: dst.uid });
          }
        }
      } else if (isEnergyRetrieveEffect(effect)) {
        // Energy Retrieval: take up to 2 basic Energy from your discard. Each
        // distinct, meaningful 1–2 card pick is one legal action (deduped by element).
        for (const ids of energyRetrieveCombos(me.discard)) acts.push({ type: "energyRetrieve", iid: c.iid, foundIids: ids });
      } else if (isRareCandyEffect(effect)) {
        // Rare Candy: jump-evolve a Basic in play → a Stage 2 in hand. Barred on
        // your own first turn and on a Pokémon just played this turn; the specific
        // (Basic, Stage 2) pair must be a REAL evolution line (canRareCandyJump).
        if (!isOwnFirstTurn(s)) {
          const stage2s = me.hand.filter((h) => h.kind === "evolution");
          for (const u of inPlay) {
            if (u.playedTurn >= s.turn) continue; // "剛使出" — can't use the turn it came down
            const basicCat = ctx.resolve(u.card);
            if (basicCat?.stage !== "Basic") continue;
            for (const s2 of stage2s) if (canRareCandyJump(basicCat, ctx.resolve(s2))) acts.push({ type: "rareCandy", iid: c.iid, basicUid: u.uid, stage2HandIid: s2.iid });
          }
        }
      } else {
        const spec = searchSpecOf(effect);
        // Search: the choice is WHICH eligible card in the from-pile (deck/discard),
        // AND — for a discard-cost ball (先機球 1 / 高級球 2) — WHICH hand cards pay the
        // cost. The cross-product is enumerated; handPayCombos returns [[]] for a
        // cost-free search and [] when the hand can't cover the cost (then unplayable).
        if (spec !== null && !(spec.to === "bench" && me.bench.length >= MAX_BENCH)) {
          const cost = spec.discardCost ?? 0;
          // The payment is enumerated by NAME-representative (handPayCombos): one
          // representative per distinct hand-card name. applyAction accepts ANY
          // equivalent valid payment, so the mask is representative — not exhaustive —
          // over interchangeable same-named copies (a deliberate keep-the-mask-small
          // choice, mirrored by the dedup on the fetch side below).
          const payments = handPayCombos(me.hand, c.iid, cost);
          // Dedupe the fetch side by NAME too: same-named copies in the pile yield an
          // identical board, so one representative each keeps the mask minimal and
          // equal to the UI's offered set.
          const seenFound = new Set<string>();
          for (const found of me[spec.from]) {
            if (!spec.eligible(found) || seenFound.has(found.name)) continue;
            seenFound.add(found.name);
            for (const pay of payments) acts.push(cost > 0 ? { type: "search", iid: c.iid, foundIid: found.iid, discardIids: pay } : { type: "search", iid: c.iid, foundIid: found.iid });
          }
        }
      }
    }
  }

  // Retreat: once per turn, needs enough attached Energy, and not while Asleep/Paralyzed.
  if (!s.turnRetreated && me.active !== null && canActiveRetreat(me.active)) {
    const cost = retreatCost(me.active.card);
    if (me.active.energy.length >= cost) for (const b of me.bench) acts.push({ type: "retreat", benchUnitId: b.uid });
  }

  // Attack: needs an Active vs. an Active, not turn-1-first, not Asleep/Paralyzed,
  // and payable Energy.
  if (me.active !== null && opp.active !== null && !firstTurnRestricted(s) && canActiveAttack(me.active) && me.active.noAttackTurn !== s.turn) {
    const ac = ctx.resolve(me.active.card);
    const attacks = ac?.attacks ?? [];
    attacks.forEach((a, i) => {
      if (!canPayCost(me.active!.energy, a.cost)) return;
      // Choice-as-action: WHICH Energy to discard (選擇N個…丟棄) and WHICH opponent
      // Bench Pokémon to bench-damage (對手的1隻備戰…受到N) are each player choices,
      // so legalActions enumerates the cross-product (in practice only one applies).
      const dN = discardEnergyCount(a.effect);
      const dCombos = dN > 0 ? energyDiscardCombos(me.active!.energy, dN) : [];
      const benchTargets = benchDamageAmount(a.effect) > 0 ? opp.bench.map((u) => u.uid) : [];
      const bases: Extract<Action, { type: "attack" }>[] = dCombos.length > 0 ? dCombos.map((iids) => ({ type: "attack", index: i, discardEnergyIids: iids })) : [{ type: "attack", index: i }];
      if (benchTargets.length > 0) for (const b of bases) for (const uid of benchTargets) acts.push({ ...b, benchTargetUid: uid });
      else for (const b of bases) acts.push(b);
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
  // Paralysis recovers automatically (no coin flip): a Pokémon Paralyzed during
  // the opponent's turn stays Paralyzed through its OWNER's next turn, then clears
  // in the Checkup at the end of that turn. Recover only the player whose turn is
  // ending (s.current), and only paralysis applied on an EARLIER turn — a defender
  // paralyzed THIS turn must keep it through its own upcoming turn. (A stale
  // paralyzedTurn left after recovery is inert: the guard requires the status too.)
  const recoverParalysis = (b: PlayerBoard): PlayerBoard => {
    const a = b.active;
    if (a === null || !a.status.includes("paralyzed")) return b;
    if (a.paralyzedTurn === undefined || a.paralyzedTurn >= s.turn) return b;
    return { ...b, active: { ...a, status: a.status.filter((c) => c !== "paralyzed") } };
  };
  const next = other(s.current);
  const drawTop = (b: PlayerBoard): PlayerBoard =>
    b.deck.length > 0 ? { ...b, hand: [...b.hand, b.deck[0]!], deck: b.deck.slice(1) } : b;
  let p1n = checkup(s.p1);
  let p2n = checkup(s.p2);
  if (s.current === "p1") p1n = recoverParalysis(p1n);
  else p2n = recoverParalysis(p2n);
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
    case "playGust": {
      // Boss's Orders: choose an OPPONENT bench Pokémon → their new Active.
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "supporter" || s.turnSupporterUsed || firstTurnRestricted(s)) return s;
      if (!isGustEffect(ctx.resolve(card)?.effect)) return s;
      const oppId = other(me);
      const opp = s[oppId];
      if (opp.active === null) return s;
      const i = opp.bench.findIndex((u) => u.uid === a.targetUid);
      if (i === -1) return s;
      const newActive = opp.bench[i]!;
      const demoted: InPlay = { ...opp.active, status: [] }; // leaving Active clears conditions
      const bench = opp.bench.filter((u) => u.uid !== a.targetUid).concat(demoted);
      let ns = withBoard(s, oppId, { ...opp, active: newActive, bench });
      ns = discardFromHand(ns, me, a.iid); // the Supporter goes to MY discard
      return { ...ns, turnSupporterUsed: true };
    }
    case "playSwitch": {
      // Switch (item): swap YOUR Active with one of your own bench (no Energy cost).
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "item") return s;
      if (!isSwitchEffect(ctx.resolve(card)?.effect)) return s;
      if (board.active === null) return s;
      const i = board.bench.findIndex((u) => u.uid === a.benchUid);
      if (i === -1) return s;
      const newActive = board.bench[i]!;
      const demoted: InPlay = { ...board.active, status: [] }; // leaving Active clears conditions
      const bench = board.bench.filter((u) => u.uid !== a.benchUid).concat(demoted);
      let ns = withBoard(s, me, { ...board, active: newActive, bench });
      ns = discardFromHand(ns, me, a.iid);
      return ns;
    }
    case "energySwitch": {
      // Energy Switch (item): move one basic Energy from one of YOUR Pokémon onto
      // another of YOUR Pokémon. It relocates an already-attached Energy, so it
      // does NOT consume the turn's from-hand Energy attachment.
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "item") return s;
      if (!isEnergySwitchEffect(ctx.resolve(card)?.effect) || a.fromUid === a.toUid) return s;
      const src = units(board).find((u) => u.uid === a.fromUid);
      const dst = units(board).find((u) => u.uid === a.toUid);
      if (src === undefined || dst === undefined) return s;
      const e = src.energy.find((x) => x.iid === a.energyIid);
      if (e === undefined || energyProvides(e) === null) return s; // basic Energy only (by name)
      let nb: PlayerBoard = mapUnit(board, a.fromUid, (u) => ({ ...u, energy: u.energy.filter((x) => x.iid !== a.energyIid) }));
      nb = mapUnit(nb, a.toUid, (u) => ({ ...u, energy: [...u.energy, e] }));
      let ns = withBoard(s, me, nb);
      ns = discardFromHand(ns, me, a.iid);
      return ns;
    }
    case "energyRetrieve": {
      // Energy Retrieval (item): take 1–2 basic Energy from YOUR discard → hand.
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "item") return s;
      if (!isEnergyRetrieveEffect(ctx.resolve(card)?.effect)) return s;
      const ids = a.foundIids;
      if (ids.length < 1 || ids.length > 2 || new Set(ids).size !== ids.length) return s;
      const found = ids.map((id) => board.discard.find((c) => c.iid === id));
      if (found.some((c) => c === undefined || energyProvides(c) === null)) return s; // basic Energy only (by name)
      const foundCards = found as BattleCard[];
      let ns = discardFromHand(s, me, a.iid); // the played Item → discard
      const b = ns[me];
      const pile = b.discard.filter((c) => !ids.includes(c.iid));
      ns = withBoard(ns, me, { ...b, discard: pile, hand: [...b.hand, ...foundCards] });
      return ns;
    }
    case "rareCandy": {
      // Rare Candy: jump-evolve a Basic in play directly into a Stage 2 from hand.
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "item" || !isRareCandyEffect(ctx.resolve(card)?.effect) || isOwnFirstTurn(s)) return s;
      const stage2 = handCard(board, a.stage2HandIid);
      if (stage2 === undefined || stage2.kind !== "evolution") return s;
      const target = units(board).find((u) => u.uid === a.basicUid);
      if (target === undefined || target.playedTurn >= s.turn) return s; // not the turn it came down
      if (!canRareCandyJump(ctx.resolve(target.card), ctx.resolve(stage2))) return s; // a real evolution line only
      // The Basic becomes the Stage 2 (old card goes under, Stage 1 skipped),
      // conditions clear, playedTurn resets; the Stage 2 leaves hand, Item → discard.
      const evolved = (u: InPlay): InPlay => ({ ...u, card: stage2, under: [...u.under, u.card], playedTurn: s.turn, status: [] });
      let ns = withBoard(s, me, { ...mapUnit(board, a.basicUid, evolved), hand: withoutHand(board, a.stage2HandIid) });
      ns = discardFromHand(ns, me, a.iid);
      return ns;
    }
    case "search": {
      // Pull a chosen card from a pile (deck/discard) to its destination.
      const card = handCard(board, a.iid);
      if (card === undefined || card.kind !== "item") return s;
      const spec = searchSpecOf(ctx.resolve(card)?.effect);
      if (spec === null) return s;
      const found = board[spec.from].find((c) => c.iid === a.foundIid);
      if (found === undefined || !spec.eligible(found)) return s;
      if (spec.to === "bench" && board.bench.length >= MAX_BENCH) return s;
      // Pay the discard COST first (先機球 1 / 高級球 2): the chosen hand cards must be
      // exactly `cost` distinct cards in hand, none of them the Item being played.
      const cost = spec.discardCost ?? 0;
      // A cost-FREE search must carry NO payment — a forged discardIids on e.g. Nest
      // Ball would otherwise pitch those cards unvalidated. Reject it as a strict no-op.
      if (cost === 0 && a.discardIids !== undefined && a.discardIids.length > 0) return s;
      const payIds = cost > 0 ? (a.discardIids ?? []) : [];
      if (cost > 0) {
        if (payIds.length !== cost || new Set(payIds).size !== cost) return s;
        if (payIds.includes(a.iid) || !payIds.every((id) => board.hand.some((c) => c.iid === id))) return s;
      }
      let ns: GameState = s;
      for (const id of payIds) ns = discardFromHand(ns, me, id); // pay the cost (each card → discard)
      ns = discardFromHand(ns, me, a.iid); // the played Item → discard
      const b = ns[me];
      const pile = b[spec.from].filter((c) => c.iid !== a.foundIid);
      if (spec.to === "hand") {
        ns = withBoard(ns, me, { ...b, [spec.from]: pile, hand: [...b.hand, found] } as PlayerBoard);
      } else {
        ns = withBoard(ns, me, { ...b, [spec.from]: pile, bench: [...b.bench, newUnit(found, s.turn)] } as PlayerBoard);
        ns = { ...ns, everInPlay: { ...ns.everInPlay, [me]: true } };
      }
      // Deck searches reshuffle so the exact-odds HUD stays uniform.
      if (spec.shuffleAfter) ns = shuffleDeck(ns, me);
      return ns;
    }
    case "retreat": {
      if (s.turnRetreated || board.active === null || !canActiveRetreat(board.active)) return s;
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
      if (board.active === null || opp.active === null || firstTurnRestricted(s) || !canActiveAttack(board.active) || board.active.noAttackTurn === s.turn) return s;
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
      } else {
        // Surviving defender: apply an unconditional attack-inflicted Special
        // Condition (poison/burn/etc.); the upcoming checkup ticks poison/burn.
        // Paralysis also stamps `paralyzedTurn` so it auto-recovers after the
        // defender's next turn (endTurnTransition) rather than locking forever.
        const cond = inflictedStatus(atk.effect);
        if (cond !== null) {
          ns = withBoard(
            ns,
            oppId,
            mapUnit(ns[oppId], defenderUid, (u) =>
              u.status.includes(cond) ? u : { ...u, status: [...u.status, cond], ...(cond === "paralyzed" ? { paralyzedTurn: s.turn } : {}) },
            ),
          );
        }
        // Defender-lock: the (surviving) defender can't attack on the opponent's next
        // turn (s.turn + 1), if the effect's type qualifier matches this defender.
        if (locksDefenderNextTurn(atk.effect, oc)) {
          ns = withBoard(ns, oppId, mapUnit(ns[oppId], defenderUid, (u) => ({ ...u, noAttackTurn: s.turn + 1 })));
        }
      }
      // Bench damage (choice): flat N to a chosen opponent Bench Pokémon (no
      // weakness/resistance). A lethal hit KOs it and the ATTACKER takes the Prize.
      if (a.benchTargetUid !== undefined) {
        const bN = benchDamageAmount(atk.effect);
        const tgt = bN > 0 ? ns[oppId].bench.find((u) => u.uid === a.benchTargetUid) : undefined;
        if (tgt !== undefined) {
          const newD = tgt.damage + bN;
          ns = addDamage(ns, oppId, tgt.uid, bN);
          if (tgt.card.hp !== undefined && newD >= tgt.card.hp) {
            ns = knockOut(ns, oppId, tgt.uid);
            ns = takePrize(ns, me, prizeValue(ctx.resolve(tgt.card)));
          }
        }
      }
      // The attack may already have won (last Prize taken / opponent wiped) — stop
      // before any attacker-only effect resolves.
      if (isTerminal(ns)) return ns;
      // Unconditional attacker-only effects. self-heal (reduce own damage) and draw
      // never cause a KO; recoil CAN self-KO the attacker (the OPPONENT then takes
      // the Prize). All resolve after the defender, before the turn ends.
      const heal = selfHealAmount(atk.effect);
      if (heal > 0) ns = withBoard(ns, me, mapUnit(ns[me], board.active.uid, (u) => ({ ...u, damage: Math.max(0, u.damage - heal) })));
      const draw = attackDrawCount(atk.effect);
      if (draw > 0) ns = drawN(ns, me, draw);
      const recoil = selfDamageAmount(atk.effect);
      if (recoil > 0 && ns[me].active !== null) {
        const self = ns[me].active;
        const selfNew = self.damage + recoil;
        ns = addDamage(ns, me, self.uid, recoil);
        if (self.card.hp !== undefined && selfNew >= self.card.hp) {
          ns = knockOut(ns, me, self.uid);
          ns = takePrize(ns, oppId, prizeValue(ctx.resolve(self.card))); // opponent takes the Prize for MY KO'd Pokémon
        }
      }
      // Self-lock: an attack that bars the attacker next turn marks it for that turn
      // (the player's next turn = s.turn + 2). Auto-expires (only blocks that turn).
      if (locksAttackerNextTurn(atk.effect) && ns[me].active !== null) {
        ns = withBoard(ns, me, mapUnit(ns[me], board.active.uid, (u) => ({ ...u, noAttackTurn: s.turn + 2 })));
      }
      // Energy discard: the chosen attached Energy leaves the attacker → discard pile.
      if (a.discardEnergyIids !== undefined && a.discardEnergyIids.length > 0 && ns[me].active !== null) {
        const ids = new Set(a.discardEnergyIids);
        const discarded = ns[me].active.energy.filter((e) => ids.has(e.iid));
        if (discarded.length > 0) {
          ns = withBoard(ns, me, mapUnit(ns[me], board.active.uid, (u) => ({ ...u, energy: u.energy.filter((e) => !ids.has(e.iid)) })));
          ns = withBoard(ns, me, { ...ns[me], discard: [...ns[me].discard, ...discarded] });
        }
      }
      // Attacking ends the turn (unless a self-KO just won/lost the game).
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
