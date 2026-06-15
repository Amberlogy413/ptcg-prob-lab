/**
 * 牌組診斷 (deck doctor, #29 載入即分析): the advice must be exact + rule-true,
 * never a guess. Verifies the mulligan reading and the "+1 Basic" lever are the
 * exact anchors (B10/60 → 25.862923%, B11/60 → 22.242114%), and that real-rule
 * legality violations (over-60, no-Basic, >4 copies) surface as hard advice.
 */

import { describe, it, expect } from "vitest";
import { computeDeckDoctor } from "../src/state/deckDoctor.ts";
import type { Deck } from "../src/state/deckStore.ts";

function deck(cards: Deck["cards"]): Deck {
  return { id: "d", name: "t", createdAt: 0, updatedAt: 0, cards };
}
const card = (name: string, count: number, isBasic = false, section: Deck["cards"][number]["section"] = "pokemon") =>
  ({ id: name, name, count, isBasic, section });

describe("computeDeckDoctor", () => {
  it("reads the exact mulligan and the exact +1-Basic lever (B10/60 → 25.86%, +1 → 22.24%)", () => {
    // A genuinely legal 60: basics ≤4 per name (10 total), bulk in Basic Energy
    // (exempt from the 4-copy rule) so no copy violation muddies the all-clear.
    const d = computeDeckDoctor(
      deck([
        card("皮卡丘", 4, true),
        card("小火龍", 3, true),
        card("傑尼龜", 3, true),
        card("基本火能量", 50, false, "energy"),
      ]),
    );
    expect(d.total).toBe(60);
    expect(d.basics).toBe(10);
    expect(d.mulligan?.percent).toBe("25.862923%");
    expect(d.addOneBasic?.percent).toBe("22.242114%");
    // A fully legal 60-card deck leads with a green all-clear.
    expect(d.advice[0]?.severity).toBe("good");
    expect(d.advice.some((a) => a.key === "doctor.mulligan")).toBe(true);
    expect(d.advice.some((a) => a.key === "doctor.addBasic")).toBe(true);
  });

  it("flags a deck with no Basic Pokémon as a hard (bad) violation", () => {
    const d = computeDeckDoctor(deck([card("Trainer", 60, false, "trainer")]));
    expect(d.mulligan).toBeNull();
    expect(d.advice.some((a) => a.severity === "bad" && a.key === "doctor.noBasic")).toBe(true);
    expect(d.advice.some((a) => a.key === "doctor.legalOk")).toBe(false);
  });

  it("flags over-60 and >4-copy violations from the real rules", () => {
    const d = computeDeckDoctor(deck([card("Basic", 10, true), card("Ace", 6, false, "trainer"), card("Filler", 50, false, "trainer")]));
    expect(d.advice.some((a) => a.severity === "bad" && a.key === "doctor.over")).toBe(true);
    expect(d.advice.some((a) => a.key === "doctor.copies" && a.params?.name === "Ace" && a.params?.n === 6)).toBe(true);
  });

  it("does not crash on an empty deck and gives no mulligan", () => {
    const d = computeDeckDoctor(deck([]));
    expect(d.total).toBe(0);
    expect(d.mulligan).toBeNull();
  });
});
