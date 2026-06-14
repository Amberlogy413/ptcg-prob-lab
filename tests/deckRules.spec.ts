/**
 * Real PTCG deck-building legality (owner mandate 2026-06-15): same card name
 * ≤ 4 per deck EXCEPT Basic Energy (unlimited, still ≤ 60 total), Radiant ≤ 1,
 * deck total ≤ 60 absolute. ACE SPEC is intentionally NOT enforced (undetectable
 * from data — no guessing). These guard the "self-deception-free exact" promise.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isBasicEnergyName,
  isRadiantName,
  capRowCount,
  deckLegality,
} from "../src/utils/deckRules.ts";
import { useDeckStore, type DeckCard } from "../src/state/deckStore.ts";

const row = (over: Partial<DeckCard> & Pick<DeckCard, "id" | "name" | "count">): DeckCard => ({
  isBasic: false,
  section: "pokemon",
  ...over,
});

describe("name detectors (real-data signals only)", () => {
  it("isBasicEnergyName matches only basic energy, never Special Energy", () => {
    expect(isBasicEnergyName("基本火能量")).toBe(true);
    expect(isBasicEnergyName("Basic Water Energy")).toBe(true);
    expect(isBasicEnergyName("基本鋼エネルギー")).toBe(true);
    expect(isBasicEnergyName("高速雷能量")).toBe(false); // Special Energy
    expect(isBasicEnergyName("極光能量")).toBe(false);
    expect(isBasicEnergyName("超級球")).toBe(false);
  });
  it("isRadiantName matches the 光輝 / かがやく prefix", () => {
    expect(isRadiantName("光輝甲賀忍蛙")).toBe(true);
    expect(isRadiantName("かがやくリザードン")).toBe(true);
    expect(isRadiantName("甲賀忍蛙")).toBe(false);
    expect(isRadiantName("超級甲賀忍蛙")).toBe(false);
  });
});

describe("capRowCount", () => {
  it("caps a non-energy name at 4 across all rows of that name", () => {
    const cards = [row({ id: "a", name: "皮卡丘", count: 3 })];
    // new row of the same name: only 1 more is legal (3 + 1 = 4)
    expect(capRowCount(cards, null, "皮卡丘", 4)).toBe(1);
    // editing row 'a' itself: excludes its own count → up to 4
    expect(capRowCount(cards, "a", "皮卡丘", 9)).toBe(4);
  });
  it("exempts Basic Energy from the 4-copy rule (still bound by 60)", () => {
    const cards = [row({ id: "e", name: "基本水能量", count: 6, section: "energy" })];
    expect(capRowCount(cards, "e", "基本水能量", 20)).toBe(20); // unlimited by name
    // but the 60 total still binds
    const big = [row({ id: "x", name: "皮卡丘", count: 55 })];
    expect(capRowCount(big, null, "基本水能量", 20)).toBe(5);
  });
  it("caps Radiant Pokémon at 1 total across all Radiants", () => {
    const cards = [row({ id: "r", name: "光輝噴火龍", count: 1 })];
    expect(capRowCount(cards, null, "光輝甲賀忍蛙", 4)).toBe(0); // a 2nd Radiant is illegal
    expect(capRowCount([], null, "光輝甲賀忍蛙", 4)).toBe(1); // first Radiant: max 1
  });
  it("never lets the deck exceed 60 total", () => {
    const cards = [row({ id: "x", name: "填充", count: 58 })];
    expect(capRowCount(cards, null, "新卡", 5)).toBe(2);
  });
});

describe("deckLegality", () => {
  it("flags a legal 60-card deck as legal", () => {
    const cards = [
      row({ id: "a", name: "皮卡丘", count: 4, isBasic: true }),
      row({ id: "b", name: "基本電能量", count: 56, section: "energy" }),
    ];
    const l = deckLegality(cards);
    expect(l).toMatchObject({ total: 60, sizeOk: true, legal: true, radiantOk: true });
  });
  it("catches over-60, over-4, over-radiant, and no-Basic", () => {
    const over = deckLegality([row({ id: "a", name: "皮卡丘", count: 61, isBasic: true })]);
    expect(over.overSize).toBe(true);
    expect(over.copyViolations[0]).toMatchObject({ name: "皮卡丘", count: 61 });

    const noBasic = deckLegality([row({ id: "a", name: "超級球", count: 4, section: "trainer" })]);
    expect(noBasic.hasBasicPokemon).toBe(false);
    expect(noBasic.legal).toBe(false);

    const twoRadiant = deckLegality([
      row({ id: "a", name: "光輝噴火龍", count: 1, isBasic: true }),
      row({ id: "b", name: "光輝甲賀忍蛙", count: 1, isBasic: true }),
    ]);
    expect(twoRadiant.radiantCount).toBe(2);
    expect(twoRadiant.radiantOk).toBe(false);
  });
});

describe("deckStore enforces the rules on every mutation", () => {
  beforeEach(() => {
    localStorage.clear();
    useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  });

  it("addCardFrom can never stack a single name past 4", () => {
    const id = useDeckStore.getState().createDeck("t");
    const add = () => useDeckStore.getState().addCardFrom(id, { name: "喵喵ex", count: 1, section: "pokemon" });
    for (let i = 0; i < 8; i++) add();
    const deck = useDeckStore.getState().decks.find((d) => d.id === id)!;
    const total = deck.cards.filter((c) => c.name === "喵喵ex").reduce((s, c) => s + c.count, 0);
    expect(total).toBe(4);
  });

  it("updateCard caps a typed count to 4 for a non-energy card", () => {
    const id = useDeckStore.getState().createDeck("t");
    useDeckStore.getState().addCardFrom(id, { name: "皮卡丘", count: 1, section: "pokemon" });
    const cardId = useDeckStore.getState().decks.find((d) => d.id === id)!.cards[0]!.id;
    useDeckStore.getState().updateCard(id, cardId, { count: 9 });
    expect(useDeckStore.getState().decks.find((d) => d.id === id)!.cards[0]!.count).toBe(4);
  });

  it("Basic Energy may exceed 4", () => {
    const id = useDeckStore.getState().createDeck("t");
    useDeckStore.getState().addCardFrom(id, { name: "基本火能量", count: 10, section: "energy" });
    expect(useDeckStore.getState().decks.find((d) => d.id === id)!.cards[0]!.count).toBe(10);
  });

  it("importDeck loads faithfully; an illegal bulk list is FLAGGED, not silently truncated", () => {
    const id = useDeckStore.getState().importDeck("t", [
      { name: "皮卡丘", count: 9, isBasic: true, section: "pokemon" },
      { name: "基本電能量", count: 80, section: "energy" },
    ]);
    const deck = useDeckStore.getState().decks.find((d) => d.id === id)!;
    // Faithful: no data dropped (real lists are legal; honesty > silent repair).
    expect(deck.cards.find((c) => c.name === "皮卡丘")!.count).toBe(9);
    const l = deckLegality(deck.cards);
    expect(l.legal).toBe(false);
    expect(l.overSize).toBe(true);
    expect(l.copyViolations[0]).toMatchObject({ name: "皮卡丘", count: 9 });
  });

  it("interactive building can NEVER exceed 60 total", () => {
    const id = useDeckStore.getState().importDeck("t", [
      { name: "填充", count: 59, section: "trainer" },
    ]);
    // adding a fresh 4-of only fits 1 more card before hitting 60
    useDeckStore.getState().addCardFrom(id, { name: "皮卡丘", count: 4, section: "pokemon" });
    const total = useDeckStore.getState().decks.find((d) => d.id === id)!.cards.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(60);
  });
});
