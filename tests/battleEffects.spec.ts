/**
 * 對戰沙盤 v3 auto-effects (#36): a curated set of deterministic, choice-free
 * card effects resolved faithfully on the board. Verifies the exact mechanics
 * (Professor's Research / Iono / Judge), the supporting store primitives, the
 * first-player wiring, and the 1-Supporter-per-turn flag — all card-conserving.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBattleStore, type CardSpec, type PlayerId, type PlayerBoard } from "../src/state/battleStore.ts";
import { applyAutoEffect } from "../src/state/battleEffects.ts";

// A 60-card-ish deck (size only matters for having enough to draw).
const SPEC: CardSpec[] = [
  { name: "多龍梅西亞", count: 20, isBasic: true, section: "pokemon" },
  { name: "博士的研究", count: 20, isBasic: false, section: "trainer" },
  { name: "基本火能量", count: 20, isBasic: false, section: "energy" },
];
const TOTAL = SPEC.reduce((s, c) => s + c.count, 0); // 60

const sum = (b: PlayerBoard) =>
  b.deck.length + b.hand.length + b.active.length + b.bench.length + b.stadium.length + b.discard.length + b.prizes.length + b.lostzone.length;
const ids = (b: PlayerBoard) =>
  [...b.deck, ...b.hand, ...b.active, ...b.bench, ...b.stadium, ...b.discard, ...b.prizes, ...b.lostzone].map((c) => c.iid);

beforeEach(() => useBattleStore.getState().reset());

describe("first player + supporter-per-turn flag", () => {
  it("honours the chosen first player and resets the Supporter flag each turn", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5, first: "p2" });
    expect(useBattleStore.getState().current).toBe("p2");
    expect(useBattleStore.getState().firstPlayer).toBe("p2");
    expect(useBattleStore.getState().turnSupporterUsed).toBe(false);
    useBattleStore.getState().markSupporterUsed();
    expect(useBattleStore.getState().turnSupporterUsed).toBe(true);
    useBattleStore.getState().endTurn();
    expect(useBattleStore.getState().turnSupporterUsed).toBe(false);
    expect(useBattleStore.getState().current).toBe("p1");
  });
});

describe("store primitives", () => {
  it("discardHand moves the whole hand to discard, conserving cards", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5 });
    const before = sum(useBattleStore.getState().p1);
    useBattleStore.getState().discardHand("p1");
    const p1 = useBattleStore.getState().p1;
    expect(p1.hand.length).toBe(0);
    expect(p1.discard.length).toBe(7);
    expect(sum(p1)).toBe(before);
  });

  it("shuffleHandIntoDeck empties the hand into the deck, conserving cards", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5 });
    const before = sum(useBattleStore.getState().p1);
    useBattleStore.getState().shuffleHandIntoDeck("p1");
    const p1 = useBattleStore.getState().p1;
    expect(p1.hand.length).toBe(0);
    expect(sum(p1)).toBe(before);
  });

  it("shuffleHandUnderDeck keeps the deck's top order and puts the hand at the bottom (Iono)", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5 });
    const p1 = useBattleStore.getState().p1;
    const deckBefore = p1.deck.map((c) => c.iid);
    const handIds = new Set(p1.hand.map((c) => c.iid));
    useBattleStore.getState().shuffleHandUnderDeck("p1");
    const after = useBattleStore.getState().p1;
    expect(after.hand.length).toBe(0);
    // The original deck stays on top, in the same order (drawn off the top).
    expect(after.deck.slice(0, deckBefore.length).map((c) => c.iid)).toEqual(deckBefore);
    // The shuffled hand now sits underneath.
    expect(after.deck.slice(deckBefore.length).every((c) => handIds.has(c.iid))).toBe(true);
    expect(sum(after)).toBe(TOTAL);
  });
});

describe("applyAutoEffect — exact, verified mechanics", () => {
  it("莉莉艾的決心: shuffles hand into deck, draws 8 at 6 prizes / 6 otherwise", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5 });
    // At the start both players hold 6 prizes → draw 8.
    const played = useBattleStore.getState().p1.hand[0]!;
    applyAutoEffect("p1", played.iid, "莉莉艾的決心");
    let p1 = useBattleStore.getState().p1;
    expect(p1.prizes.length).toBe(6);
    expect(p1.hand.length).toBe(8);
    expect(p1.discard.some((c) => c.iid === played.iid)).toBe(true);
    expect(sum(p1)).toBe(TOTAL);
    // Take a prize (now 5) → next time draws 6.
    const prize = useBattleStore.getState().p1.prizes[0]!;
    useBattleStore.getState().moveCard("p1", prize.iid, "hand");
    const played2 = useBattleStore.getState().p1.hand[0]!;
    applyAutoEffect("p1", played2.iid, "莉莉艾的決心");
    p1 = useBattleStore.getState().p1;
    expect(p1.prizes.length).toBe(5);
    expect(p1.hand.length).toBe(6);
    expect(sum(p1)).toBe(TOTAL);
  });

  it("博士的研究: discards the whole hand (incl. the played card) and draws 7", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5 });
    const played = useBattleStore.getState().p1.hand[0]!;
    const ok = applyAutoEffect("p1", played.iid, "博士的研究");
    const p1 = useBattleStore.getState().p1;
    expect(ok).toBe(true);
    expect(p1.hand.length).toBe(7); // a fresh 7
    expect(p1.discard.some((c) => c.iid === played.iid)).toBe(true); // played card discarded
    expect(p1.discard.length).toBe(7); // the played card + the other 6 of the old hand
    expect(sum(p1)).toBe(TOTAL);
    expect(new Set(ids(p1)).size).toBe(TOTAL); // nothing lost or duplicated
  });

  it("奇樹 (Iono) is NOT auto-resolved — rotated out of Standard + bottom-placement would break the draw HUD", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 9 });
    const played = useBattleStore.getState().p1.hand[0]!;
    expect(applyAutoEffect("p1", played.iid, "奇樹")).toBe(false); // stays manual
  });

  it("裁判 (Judge): both players shuffle hand into deck and draw 4", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 11 });
    const played = useBattleStore.getState().p1.hand[0]!;
    applyAutoEffect("p1", played.iid, "裁判");
    const { p1, p2 } = useBattleStore.getState();
    expect(p1.hand.length).toBe(4);
    expect(p2.hand.length).toBe(4);
    expect(sum(p1)).toBe(TOTAL);
    expect(sum(p2)).toBe(TOTAL);
  });

  it("returns false for an unknown card (stays manual)", () => {
    useBattleStore.getState().newGame({ p1: SPEC, p2: SPEC, seed: 5 });
    const played = useBattleStore.getState().p1.hand[0]!;
    expect(applyAutoEffect("p1" as PlayerId, played.iid, "超級球")).toBe(false);
  });
});
