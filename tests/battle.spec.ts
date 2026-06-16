/**
 * Battle GAME core (owner 2026-06-17: a real turn-based board, not a free
 * "move anything anywhere" sandbox). Verifies the seeded shuffle, the faithful
 * opening, and the TYPE-CORRECT play actions: a Pokémon goes to Active/Bench, a
 * Trainer can NEVER sit on the field, Energy attaches to a Pokémon, a Stadium
 * goes to the Stadium zone — every move conserving cards. Plus the live exact
 * draw-odds bridge.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mulberry32, shuffle } from "../src/utils/rng.ts";
import { useBattleStore, type CardSpec, type PlayerBoard, type BattleCard } from "../src/state/battleStore.ts";
import { computeDrawOdds } from "../src/state/battle.ts";

const SPEC: CardSpec[] = [
  { name: "多龍巴魯托ex", count: 3, isBasic: false, section: "pokemon" },
  { name: "多龍梅西亞", count: 4, isBasic: true, section: "pokemon" },
  { name: "基本火能量", count: 8, isBasic: false, section: "energy" },
  { name: "超級球", count: 4, isBasic: false, section: "trainer" },
  { name: "博士的研究", count: 4, isBasic: false, section: "trainer" },
];
const TOTAL = SPEC.reduce((s, c) => s + c.count, 0); // 23

/** Every card on a board, including those attached to in-play units. */
function unitCount(u: { under: unknown[]; energy: unknown[]; tools: unknown[] }): number {
  return 1 + u.under.length + u.energy.length + u.tools.length;
}
function countAll(b: PlayerBoard): number {
  return (
    b.deck.length + b.hand.length + b.discard.length + b.prizes.length + b.lostzone.length +
    (b.active !== null ? unitCount(b.active) : 0) +
    b.bench.reduce((s, u) => s + unitCount(u), 0) +
    (b.stadium !== null ? 1 : 0)
  );
}

/** Build a loose card for a hand-seeded board test. */
function bc(iid: string, kind: BattleCard["kind"], over: Partial<BattleCard> = {}): BattleCard {
  const section: BattleCard["section"] =
    kind === "basic" || kind === "evolution" ? "pokemon" : kind.startsWith("energy") ? "energy" : kind === "unknown" ? "unknown" : "trainer";
  return { iid, name: iid, isBasic: kind === "basic", section, kind, ...over };
}

function emptyBoard(): PlayerBoard {
  return { deck: [], hand: [], discard: [], prizes: [], lostzone: [], active: null, bench: [], stadium: null };
}

/** Seed the store with a known p1 hand (deterministic, no shuffle). */
function seedHand(hand: BattleCard[]): void {
  useBattleStore.setState({
    started: true,
    turn: 1,
    current: "p1",
    firstPlayer: "p1",
    turnSupporterUsed: false,
    turnEnergyAttached: false,
    turnStadiumPlayed: false,
    turnRetreated: false,
    p1: { ...emptyBoard(), hand },
    p2: emptyBoard(),
  });
}

describe("seeded RNG", () => {
  it("is deterministic for a given seed", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(42));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(42));
    const c = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // a permutation
  });
});

describe("battle setup", () => {
  beforeEach(() => useBattleStore.getState().reset());

  it("deals a real opening: 7 hand, 6 prizes, rest in deck, nothing lost", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 7 });
    const { p1 } = useBattleStore.getState();
    expect(p1.hand.length).toBe(7);
    expect(p1.prizes.length).toBe(6);
    expect(p1.deck.length).toBe(TOTAL - 13);
    expect(countAll(p1)).toBe(TOTAL);
    const all = [...p1.hand, ...p1.prizes, ...p1.deck];
    expect(new Set(all.map((c) => c.iid)).size).toBe(TOTAL);
  });

  it("draws from the top of the deck into the hand", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 7 });
    const before = useBattleStore.getState().p1.deck.length;
    useBattleStore.getState().draw("p1", 2);
    const { p1 } = useBattleStore.getState();
    expect(p1.deck.length).toBe(before - 2);
    expect(p1.hand.length).toBe(9);
  });
});

describe("type-correct play (the core faithful rules)", () => {
  beforeEach(() => useBattleStore.getState().reset());

  it("plays a Basic Pokémon to the Active spot and another to the Bench", () => {
    seedHand([bc("pikachu", "basic", { hp: 60 }), bc("snom", "basic", { hp: 40 })]);
    expect(useBattleStore.getState().playToActive("p1", "pikachu")).toBe(true);
    expect(useBattleStore.getState().playToBench("p1", "snom")).toBe(true);
    const { p1 } = useBattleStore.getState();
    expect(p1.active?.card.iid).toBe("pikachu");
    expect(p1.bench.map((u) => u.card.iid)).toEqual(["snom"]);
    expect(p1.hand.length).toBe(0);
    expect(countAll(p1)).toBe(2);
  });

  it("REFUSES to put a Trainer or Energy on the field (owner's complaint)", () => {
    seedHand([bc("bossOrders", "supporter"), bc("fireEnergy", "energy-basic")]);
    expect(useBattleStore.getState().playToActive("p1", "bossOrders")).toBe(false);
    expect(useBattleStore.getState().playToBench("p1", "bossOrders")).toBe(false);
    expect(useBattleStore.getState().playToActive("p1", "fireEnergy")).toBe(false);
    const { p1 } = useBattleStore.getState();
    expect(p1.active).toBeNull();
    expect(p1.bench.length).toBe(0);
    expect(p1.hand.length).toBe(2); // both stay in hand — never on the board
  });

  it("attaches Energy to an in-play Pokémon (1/turn flag), conserving cards", () => {
    seedHand([bc("pikachu", "basic", { hp: 60 }), bc("fireEnergy", "energy-basic")]);
    useBattleStore.getState().playToActive("p1", "pikachu");
    const unitId = useBattleStore.getState().p1.active!.uid;
    expect(useBattleStore.getState().attachEnergy("p1", "fireEnergy", unitId)).toBe(true);
    const { p1, turnEnergyAttached } = useBattleStore.getState();
    expect(p1.active!.energy.map((c) => c.iid)).toEqual(["fireEnergy"]);
    expect(p1.hand.length).toBe(0);
    expect(turnEnergyAttached).toBe(true);
    expect(countAll(p1)).toBe(2); // the energy now lives on the unit, not lost
  });

  it("evolves onto an in-play Pokémon, stacking the lower stage under it", () => {
    seedHand([bc("dreepy", "basic", { hp: 70 }), bc("drakloak", "evolution", { hp: 90, evolveFrom: "dreepy" })]);
    useBattleStore.getState().playToActive("p1", "dreepy");
    const unitId = useBattleStore.getState().p1.active!.uid;
    expect(useBattleStore.getState().evolve("p1", "drakloak", unitId)).toBe(true);
    const u = useBattleStore.getState().p1.active!;
    expect(u.card.iid).toBe("drakloak");
    expect(u.under.map((c) => c.iid)).toEqual(["dreepy"]);
    expect(u.uid).toBe(unitId); // stable unit identity across the evolution
  });

  it("plays a Stadium to the Stadium zone, discarding the previous one", () => {
    seedHand([bc("stadiumA", "stadium"), bc("stadiumB", "stadium")]);
    expect(useBattleStore.getState().playStadium("p1", "stadiumA")).toBe(true);
    expect(useBattleStore.getState().p1.stadium?.iid).toBe("stadiumA");
    useBattleStore.getState().playStadium("p1", "stadiumB");
    const { p1 } = useBattleStore.getState();
    expect(p1.stadium?.iid).toBe("stadiumB");
    expect(p1.discard.map((c) => c.iid)).toContain("stadiumA"); // old one discarded
    expect(countAll(p1)).toBe(2);
  });

  it("knocks out a unit: it and everything attached go to the discard", () => {
    seedHand([bc("pikachu", "basic", { hp: 60 }), bc("e1", "energy-basic"), bc("e2", "energy-basic")]);
    useBattleStore.getState().playToActive("p1", "pikachu");
    const unitId = useBattleStore.getState().p1.active!.uid;
    useBattleStore.getState().attachEnergy("p1", "e1", unitId);
    useBattleStore.getState().attachEnergy("p1", "e2", unitId);
    useBattleStore.getState().knockOut("p1", unitId);
    const { p1 } = useBattleStore.getState();
    expect(p1.active).toBeNull();
    expect(p1.discard.map((c) => c.iid).sort()).toEqual(["e1", "e2", "pikachu"]);
    expect(countAll(p1)).toBe(3); // nothing lost on KO
  });
});

describe("computeDrawOdds", () => {
  it("matches the exact hypergeometric (4 of 10, draw 1 = 2/5)", () => {
    const o = computeDrawOdds(10, 4, 1);
    expect(o.fraction).toBe("2/5");
    expect(o.percent).toBe("40.0000%");
  });
  it("is 0 when no copies remain and 100% when a draw must hit", () => {
    expect(computeDrawOdds(10, 0, 3).percent).toBe("0.0000%");
    expect(computeDrawOdds(5, 5, 1).percent).toBe("100.0000%");
  });
});
