/**
 * Battle sandbox core (owner request 2026-06-14): deterministic seeded shuffle,
 * faithful zone moves, and the live exact draw-odds bridge.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mulberry32, shuffle } from "../src/utils/rng.ts";
import { useBattleStore, type CardSpec } from "../src/state/battleStore.ts";
import { computeDrawOdds } from "../src/state/battle.ts";

const SPEC: CardSpec[] = [
  { name: "多龍巴魯托ex", count: 3, isBasic: false, section: "pokemon" },
  { name: "多龍梅西亞", count: 4, isBasic: true, section: "pokemon" },
  { name: "基本火能量", count: 8, isBasic: false, section: "energy" },
  { name: "超級球", count: 4, isBasic: false, section: "trainer" },
  { name: "博士的研究", count: 4, isBasic: false, section: "trainer" },
];
const TOTAL = SPEC.reduce((s, c) => s + c.count, 0); // 23

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

describe("battle store", () => {
  beforeEach(() => useBattleStore.getState().reset());

  it("sets up a real opening: 7 hand, 6 prizes, rest in deck", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 7 });
    const { p1 } = useBattleStore.getState();
    expect(p1.hand.length).toBe(7);
    expect(p1.prizes.length).toBe(6);
    expect(p1.deck.length).toBe(TOTAL - 13);
    // No card is lost or duplicated across zones.
    const all = [...p1.hand, ...p1.prizes, ...p1.deck];
    expect(all.length).toBe(TOTAL);
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

  it("moves an instance between zones without losing it", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 7 });
    const card = useBattleStore.getState().p1.hand[0]!;
    useBattleStore.getState().moveCard("p1", card.iid, "active");
    const { p1 } = useBattleStore.getState();
    expect(p1.hand.some((c) => c.iid === card.iid)).toBe(false);
    expect(p1.active.some((c) => c.iid === card.iid)).toBe(true);
  });

  it("plays a card to the new 場地牌區 (stadium) zone, conserving the card", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 7 });
    const card = useBattleStore.getState().p1.hand[0]!;
    useBattleStore.getState().moveCard("p1", card.iid, "stadium");
    const { p1 } = useBattleStore.getState();
    expect(p1.stadium.some((c) => c.iid === card.iid)).toBe(true);
    const all = [...p1.deck, ...p1.hand, ...p1.active, ...p1.bench, ...p1.stadium, ...p1.discard, ...p1.prizes, ...p1.lostzone];
    expect(all.length).toBe(TOTAL); // nothing lost adding the new zone
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
