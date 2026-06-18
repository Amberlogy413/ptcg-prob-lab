/**
 * Pure rules-engine behaviour (#36 → AI agent step ①, owner 2026-06-18). Drives
 * the headless engine directly — legalActions / applyAction / reward — with no
 * React / Zustand. Catalog facts (attacks) are injected through a tiny stub ctx
 * so the rules are tested in isolation from the real data file.
 */

import { describe, it, expect } from "vitest";
import {
  newGame,
  legalActions,
  applyAction,
  isTerminal,
  winner,
  reward,
  BattleEnv,
  observe,
  encodeObservation,
  type GameState,
  type EngineCtx,
  type BattleCard,
  type CardSpec,
  type PlayerBoard,
  type Action,
} from "../src/engine/index.ts";
import type { CatalogCard } from "../src/data/catalog.ts";

// --- helpers ----------------------------------------------------------------

function card(iid: string, kind: BattleCard["kind"], over: Partial<BattleCard> = {}): BattleCard {
  const section: BattleCard["section"] =
    kind === "basic" || kind === "evolution"
      ? "pokemon"
      : kind.startsWith("energy")
        ? "energy"
        : kind === "unknown"
          ? "unknown"
          : "trainer";
  return { iid, name: iid, isBasic: kind === "basic", section, kind, ...over };
}

function emptyBoard(): PlayerBoard {
  return { deck: [], hand: [], discard: [], prizes: [], lostzone: [], active: null, bench: [], stadium: null };
}

function prizes6(): BattleCard[] {
  return new Array(6).fill(0).map((_, i) => card(`pz${i}`, "basic"));
}

/** A board with the real opening 6 Prize cards (empty prizes would read as an
 *  instant prize-win and make legalActions return []). Tests override as needed. */
function pb(): PlayerBoard {
  return { ...emptyBoard(), prizes: prizes6() };
}

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    shuffleNonce: 0,
    turn: 2, // default: past the going-first turn-1 restrictions
    current: "p1",
    firstPlayer: "p1",
    turnSupporterUsed: false,
    turnEnergyAttached: false,
    turnStadiumPlayed: false,
    turnRetreated: false,
    everInPlay: { p1: false, p2: false }, // default: no wipe-loss until a test opts in
    p1: pb(),
    p2: pb(),
    ...over,
  };
}

const nullCtx: EngineCtx = { catalog: null, resolve: () => null, autoKey: (c) => c.name };

/** A ctx that resolves attacks/types by card name (for attack tests). */
function atkCtx(table: Record<string, Partial<CatalogCard>>): EngineCtx {
  return {
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Pokemon", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  };
}

function find<T extends Action["type"]>(acts: Action[], type: T): Extract<Action, { type: T }>[] {
  return acts.filter((a): a is Extract<Action, { type: T }> => a.type === type);
}

const deck60 = (name: string, isBasic = true): CardSpec[] => [
  { name, count: 60, isBasic, section: "pokemon", kind: isBasic ? "basic" : "evolution" },
];

// --- newGame / setup --------------------------------------------------------

describe("newGame", () => {
  it("deals 7-card hands + 6 prizes, then the going-first player draws turn 1 (→8), reproducibly", () => {
    const g1 = newGame({ p1: deck60("A"), p2: deck60("B"), seed: 42, first: "p1" });
    const g2 = newGame({ p1: deck60("A"), p2: deck60("B"), seed: 42, first: "p1" });
    expect(g1.p1.hand.length).toBe(8); // dealt 7 + the mandatory turn-1 draw (current rules)
    expect(g1.p2.hand.length).toBe(7); // going-second has not drawn yet
    expect(g1.p1.prizes.length).toBe(6);
    expect(g1.p1.deck.length).toBe(60 - 13 - 1); // one fewer for the turn-1 draw
    expect(g1.p1.hand.map((c) => c.iid)).toEqual(g2.p1.hand.map((c) => c.iid)); // deterministic
  });
});

// --- legal-action gating ----------------------------------------------------

describe("legalActions", () => {
  it("the going-first turn-1 player can bench a Basic but cannot attack or play a Supporter", () => {
    const myActive = { uid: "m", card: card("m", "basic", { hp: 70 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({
      turn: 1,
      p1: { ...pb(), active: myActive, hand: [card("pika", "basic"), card("sup", "supporter", { name: "博士的研究" })] },
      p2: { ...pb(), active: { uid: "x", card: card("y", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] } },
    });
    const acts = legalActions(s, nullCtx);
    expect(find(acts, "playToActive").length).toBe(0); // Active already filled
    expect(find(acts, "playToBench").length).toBe(1); // the extra Basic can bench
    expect(find(acts, "playSupporter").length).toBe(0); // turn-1 first → blocked
    expect(find(acts, "attack").length).toBe(0); // turn-1 first → blocked
    expect(find(acts, "endTurn").length).toBe(1);
  });

  it("offers only one Energy attachment per turn", () => {
    const unit = { uid: "u", card: card("a", "basic", { hp: 70 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), hand: [card("e", "energy-basic")], active: unit } });
    expect(find(legalActions(s, nullCtx), "attachEnergy").length).toBe(1);
    const after = applyAction(s, { type: "attachEnergy", handIid: "e", unitId: "u" }, nullCtx);
    expect(after.turnEnergyAttached).toBe(true);
    expect(find(legalActions(after, nullCtx), "attachEnergy").length).toBe(0);
  });

  it("forces a promotion (and nothing else) when the Active is empty but the Bench is not", () => {
    const benched = { uid: "b", card: card("b", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active: null, bench: [benched], hand: [card("pk", "basic")] } });
    const acts = legalActions(s, nullCtx);
    expect(acts.length).toBe(1);
    expect(acts[0]).toEqual({ type: "promote", benchUnitId: "b" });
  });

  it("does not offer benching a Basic while the Active spot is empty (place an Active first)", () => {
    const s = baseState({ p1: { ...pb(), active: null, bench: [], hand: [card("pk", "basic")] } });
    const acts = legalActions(s, nullCtx);
    expect(find(acts, "playToActive").length).toBe(1);
    expect(find(acts, "playToBench").length).toBe(0);
    expect(applyAction(s, { type: "playToBench", iid: "pk" }, nullCtx)).toBe(s); // no-op too
  });
});

// --- play actions -----------------------------------------------------------

describe("applyAction", () => {
  it("playToActive places a Basic and records everInPlay", () => {
    const s = baseState({ everInPlay: { p1: false, p2: false }, p1: { ...pb(), hand: [card("pk", "basic")] } });
    const ns = applyAction(s, { type: "playToActive", iid: "pk" }, nullCtx);
    expect(ns.p1.active?.card.iid).toBe("pk");
    expect(ns.p1.hand.length).toBe(0);
    expect(ns.everInPlay.p1).toBe(true);
  });

  it("evolve requires the named pre-evolution and a Pokémon that was not played this turn", () => {
    const unit = { uid: "u", card: card("base", "basic", { name: "Base" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const evoCard = card("evo", "evolution", { name: "Evo", evolveFrom: "Base" });
    const s = baseState({ turn: 3, p1: { ...pb(), hand: [evoCard], active: unit } });
    const ns = applyAction(s, { type: "evolve", handIid: "evo", unitId: "u" }, nullCtx);
    expect(ns.p1.active?.card.name).toBe("Evo");
    expect(ns.p1.active?.under.map((c) => c.name)).toEqual(["Base"]);
    // a wrong pre-evolution name is rejected
    const wrong = card("evo2", "evolution", { name: "Evo2", evolveFrom: "Nope" });
    const s2 = baseState({ turn: 3, p1: { ...pb(), hand: [wrong], active: unit } });
    expect(applyAction(s2, { type: "evolve", handIid: "evo2", unitId: "u" }, nullCtx)).toBe(s2);
  });

  it("retreat pays the cost by discarding Energy and swaps the Active", () => {
    const active = { uid: "act", card: card("act", "basic", { hp: 90, retreat: 2 }), under: [], energy: [card("e1", "energy-basic"), card("e2", "energy-basic"), card("e3", "energy-basic")], tools: [], damage: 0, playedTurn: 1, status: ["asleep" as const] };
    const bench = { uid: "bn", card: card("bn", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active, bench: [bench] } });
    const ns = applyAction(s, { type: "retreat", benchUnitId: "bn" }, nullCtx);
    expect(ns.p1.active?.uid).toBe("bn");
    expect(ns.turnRetreated).toBe(true);
    expect(ns.p1.discard.length).toBe(2); // 2 Energy paid
    const movedBack = ns.p1.bench.find((u) => u.uid === "act")!;
    expect(movedBack.energy.length).toBe(1); // 3 − 2 = 1 left
    expect(movedBack.status).toEqual([]); // conditions cleared leaving the Active
  });

  it("a too-poor Pokémon cannot retreat", () => {
    const active = { uid: "act", card: card("act", "basic", { hp: 90, retreat: 3 }), under: [], energy: [card("e1", "energy-basic")], tools: [], damage: 0, playedTurn: 1, status: [] };
    const bench = { uid: "bn", card: card("bn", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active, bench: [bench] } });
    expect(find(legalActions(s, nullCtx), "retreat").length).toBe(0);
    expect(applyAction(s, { type: "retreat", benchUnitId: "bn" }, nullCtx)).toBe(s);
  });
});

// --- attack / KO / prizes ---------------------------------------------------

describe("attack", () => {
  const ctx = atkCtx({
    Pikachu: { types: ["Lightning"], attacks: [{ name: "Bolt", cost: ["Lightning"], damage: 90 }] },
    Snorlax: { types: ["Colorless"] },
  });

  function attackState(defenderHp: number, defenderPrizes = 6): GameState {
    const attacker = { uid: "atk", card: card("Pikachu", "basic", { hp: 70, name: "Pikachu" }), under: [], energy: [card("le", "energy-basic", { name: "Lightning Energy" })], tools: [], damage: 0, playedTurn: 1, status: [] };
    const defender = { uid: "def", card: card("Snorlax", "basic", { hp: defenderHp, name: "Snorlax" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    return baseState({
      p1: { ...pb(), active: attacker, prizes: new Array(6).fill(0).map((_, i) => card(`pz${i}`, "basic")) },
      p2: { ...pb(), active: defender, prizes: new Array(defenderPrizes).fill(0).map((_, i) => card(`q${i}`, "basic")) },
    });
  }

  it("deals damage and ends the turn (attacking ends your turn)", () => {
    const s = attackState(200);
    const ns = applyAction(s, { type: "attack", index: 0 }, ctx);
    expect(ns.p2.active?.damage).toBe(90);
    expect(ns.current).toBe("p2"); // turn passed
  });

  it("a Knock-Out removes the defender and the attacker takes a Prize", () => {
    const s = attackState(80); // 90 ≥ 80 → KO
    const before = s.p1.prizes.length;
    const ns = applyAction(s, { type: "attack", index: 0 }, ctx);
    expect(ns.p2.active).toBeNull();
    expect(ns.p1.prizes.length).toBe(before - 1);
  });

  it("an Asleep or Paralyzed Active cannot attack", () => {
    const base = attackState(200);
    const asleep = { ...base, p1: { ...base.p1, active: { ...base.p1.active!, status: ["asleep" as const] } } };
    expect(find(legalActions(asleep, ctx), "attack").length).toBe(0);
    expect(applyAction(asleep, { type: "attack", index: 0 }, ctx)).toBe(asleep);
  });

  it("taking the last Prize wins the game (no turn pass)", () => {
    const s = baseState({
      p1: { ...pb(), active: { uid: "atk", card: card("Pikachu", "basic", { hp: 70, name: "Pikachu" }), under: [], energy: [card("le", "energy-basic", { name: "Lightning Energy" })], tools: [], damage: 0, playedTurn: 1, status: [] }, prizes: [card("last", "basic")] },
      p2: { ...pb(), active: { uid: "def", card: card("Snorlax", "basic", { hp: 80, name: "Snorlax" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] }, prizes: [card("z", "basic")] },
    });
    const ns = applyAction(s, { type: "attack", index: 0 }, ctx);
    expect(isTerminal(ns)).toBe(true);
    expect(winner(ns)).toBe("p1");
    expect(reward(ns, "p1")).toBe(1);
    expect(reward(ns, "p2")).toBe(-1);
  });
});

// --- supporter (modeled effect) --------------------------------------------

describe("playSupporter (modeled)", () => {
  it("博士的研究 discards the hand and draws 7, marking the Supporter used", () => {
    const hand = [card("博士的研究", "supporter", { name: "博士的研究" }), card("j1", "basic"), card("j2", "basic")];
    const deck = new Array(10).fill(0).map((_, i) => card(`d${i}`, "basic"));
    const s = baseState({ p1: { ...pb(), hand, deck } });
    const ns = applyAction(s, { type: "playSupporter", iid: "博士的研究" }, nullCtx);
    expect(ns.turnSupporterUsed).toBe(true);
    expect(ns.p1.hand.length).toBe(7); // drew a fresh 7
    expect(ns.p1.discard.length).toBe(3); // the played card + the 2 others
  });
});

// --- end of turn ------------------------------------------------------------

describe("endTurn", () => {
  it("applies poison/burn checkup damage, auto-draws the incoming player, and resets flags", () => {
    const active = { uid: "a", card: card("a", "basic", { hp: 100 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: ["poison" as const, "burn" as const] };
    const p2deck = [card("top", "basic")];
    const s = baseState({ current: "p1", turnEnergyAttached: true, p1: { ...pb(), active }, p2: { ...pb(), deck: p2deck } });
    const ns = applyAction(s, { type: "endTurn" }, nullCtx);
    expect(ns.p1.active?.damage).toBe(30); // poison 10 + burn 20
    expect(ns.current).toBe("p2");
    expect(ns.p2.hand.map((c) => c.iid)).toEqual(["top"]); // incoming auto-draw
    expect(ns.turnEnergyAttached).toBe(false); // flags reset
  });

  it("a player who cannot make the mandatory start-of-turn draw (empty deck) loses", () => {
    const mk = (hp: number, deck: BattleCard[]) => ({
      ...pb(),
      active: { uid: `u${hp}`, card: card("a", "basic", { hp }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] },
      deck,
    });
    const s = baseState({
      current: "p1",
      everInPlay: { p1: true, p2: true },
      p1: mk(100, [card("d", "basic")]),
      p2: mk(100, []), // p2's deck is empty → cannot draw when their turn begins
    });
    const ns = applyAction(s, { type: "endTurn" }, nullCtx);
    expect(ns.deckedOut).toBe("p2");
    expect(isTerminal(ns)).toBe(true);
    expect(winner(ns)).toBe("p1");
  });

  it("cannot end the turn with an empty Active while a Bench Pokémon waits", () => {
    const bench = { uid: "b", card: card("b", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active: null, bench: [bench] } });
    expect(applyAction(s, { type: "endTurn" }, nullCtx)).toBe(s); // no-op, must promote
  });
});

// --- env wrapper (the RL interface) -----------------------------------------

describe("BattleEnv (Gym-style wrapper)", () => {
  const mixDeck: CardSpec[] = [
    { name: "Pikachu", count: 12, isBasic: true, section: "pokemon", kind: "basic" },
    { name: "Lightning Energy", count: 24, isBasic: false, section: "energy", kind: "energy-basic" },
    { name: "Ball", count: 12, isBasic: false, section: "trainer", kind: "item" },
    { name: "Stadium", count: 12, isBasic: false, section: "trainer", kind: "stadium" },
  ];

  it("runs a full deterministic self-play loop where every step is a legal action", () => {
    const env = new BattleEnv(null); // null catalog → no attacks, but the rules still drive a game
    env.reset({ p1: mixDeck, p2: mixDeck, seed: 7 });
    // A reproducible pseudo-random policy (seeded LCG, not Math.random — determinism).
    let r = 123456789 >>> 0;
    const pick = (n: number): number => ((r = (1103515245 * r + 12345) >>> 0), r % n);
    let steps = 0;
    while (!env.done && steps < 1000) {
      const legal = env.legalActions();
      expect(legal.length).toBeGreaterThan(0); // never stuck while not terminal
      const res = env.step(legal[pick(legal.length)]!);
      expect(typeof res.reward).toBe("number");
      steps++;
    }
    expect(steps).toBeGreaterThan(0); // the loop actually advanced
  });

  it("observation hides the opponent's hand contents and encodes to a fixed-length vector", () => {
    const env = new BattleEnv(null);
    env.reset({ p1: mixDeck, p2: mixDeck, seed: 9 });
    const obs = env.observation("p1");
    expect(obs.opp).not.toHaveProperty("hand"); // only a COUNT is public
    expect(obs.opp.handCount).toBe(7);
    const vec = encodeObservation(observe(env.state, "p1"));
    expect(vec.length).toBe(encodeObservation(observe(env.state, "p2")).length); // stable layout
  });
});
