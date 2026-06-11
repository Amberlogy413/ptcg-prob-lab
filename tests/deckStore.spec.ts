/**
 * Deck store: persistence under the spec keys (docs/03 §7), the global
 * basicTags memory (docs/03 §8), and the summary selector's anchor values
 * (docs/02 §3 table — B=10: mulligan 75670/292581 ≈ 25.862923%).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useDeckStore, deckTotal, deckBasics } from "../src/state/deckStore.ts";
import { computeDeckSummary } from "../src/state/selectors.ts";
import { STORAGE_KEYS } from "../src/utils/storage.ts";

function resetStore(): void {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
}

describe("deck store", () => {
  beforeEach(resetStore);

  it("persists to the three spec localStorage keys", () => {
    const id = useDeckStore.getState().createDeck("Test deck");
    useDeckStore.getState().addCard(id);

    expect(localStorage.getItem(STORAGE_KEYS.decks)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.activeDeckId)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.basicTags)).not.toBeNull();

    const decks = JSON.parse(localStorage.getItem(STORAGE_KEYS.decks) as string);
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe("Test deck");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.activeDeckId) as string)).toBe(id);
  });

  it("rehydrates state from the spec keys (reload survival)", async () => {
    const id = useDeckStore.getState().createDeck("Persisted");
    useDeckStore.getState().addCard(id);
    const deckId = useDeckStore.getState().activeDeckId;

    // Simulate a reload. Note setState itself triggers a persist write, so
    // snapshot the keys first and restore them before rehydrating.
    const snapshot = Object.values(STORAGE_KEYS).map(
      (k) => [k, localStorage.getItem(k)] as const,
    );
    useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
    for (const [k, v] of snapshot) {
      if (v !== null) localStorage.setItem(k, v);
    }
    await useDeckStore.persist.rehydrate();

    const s = useDeckStore.getState();
    expect(s.decks).toHaveLength(1);
    expect(s.decks[0]?.name).toBe("Persisted");
    expect(s.activeDeckId).toBe(deckId);
  });

  it("remembers isBasic by card name globally and auto-fills on rename", () => {
    const st = () => useDeckStore.getState();
    const id = st().createDeck("Tags");
    st().addCard(id);
    const card1 = st().decks[0]?.cards[0];
    st().updateCard(id, card1?.id as string, { name: "Charmander" });
    st().updateCard(id, card1?.id as string, { isBasic: true });
    expect(st().basicTags["Charmander"]).toBe(true);

    // A new row renamed to the remembered name auto-fills isBasic.
    st().addCard(id);
    const card2 = st().decks[0]?.cards[1];
    st().updateCard(id, card2?.id as string, { name: "Charmander" });
    expect(st().decks[0]?.cards[1]?.isBasic).toBe(true);
  });

  it("importDeck applies remembered tags and clamps counts", () => {
    const st = () => useDeckStore.getState();
    st().rememberBasicTags({ Pikachu: true });
    const id = st().importDeck("Imported", [
      { name: "Pikachu", count: 4 },
      { name: "Rare Candy", count: 4 },
    ]);
    const deck = st().decks.find((d) => d.id === id);
    expect(deck?.cards[0]?.isBasic).toBe(true);
    expect(deck?.cards[1]?.isBasic).toBe(false);
    expect(st().activeDeckId).toBe(id);
  });

  it("deleting the active deck activates the next remaining deck", () => {
    const st = () => useDeckStore.getState();
    const a = st().createDeck("A");
    const b = st().createDeck("B");
    expect(st().activeDeckId).toBe(b);
    st().deleteDeck(b);
    expect(st().activeDeckId).toBe(a);
  });
});

describe("computeDeckSummary (anchors from docs/02 §3)", () => {
  beforeEach(resetStore);

  function buildDeck(basics: number, others: number) {
    const st = () => useDeckStore.getState();
    const id = st().importDeck("Anchor", [
      { name: "Some Basic", count: basics, isBasic: true },
      { name: "Other Cards", count: others },
    ]);
    return st().decks.find((d) => d.id === id)!;
  }

  it("B=10, N=60: mulligan 75670/292581 = 25.862923%, E[mulligans] 0.348853", () => {
    const deck = buildDeck(10, 50);
    expect(deckTotal(deck)).toBe(60);
    expect(deckBasics(deck)).toBe(10);
    const s = computeDeckSummary(deck);
    expect(s.status).toBe("ok");
    expect(s.mulligan?.percent).toBe("25.862923%");
    expect(s.mulligan?.fraction).toBe("75670/292581");
    expect(s.mulligan?.oneIn).toBe("1 in 3.867");
    expect(s.mulligan?.expectedMulligans).toBe("0.348853");
    expect(s.mulligan?.validPercent).toBe("74.137077%");
  });

  it("B=8: 34.640643%; B=12: 19.064669%", () => {
    expect(computeDeckSummary(buildDeck(8, 52)).mulligan?.percent).toBe("34.640643%");
    expect(computeDeckSummary(buildDeck(12, 48)).mulligan?.percent).toBe("19.064669%");
  });

  it("flags decks under 7 cards and decks with no Basics", () => {
    expect(computeDeckSummary(buildDeck(1, 2)).status).toBe("tooFewCards");
    expect(computeDeckSummary(buildDeck(0, 60)).status).toBe("noBasics");
  });
});
