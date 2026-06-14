/**
 * 牌組推薦 localization (owner request 2026-06-14: archetype titles must be zh)
 * + data-driven playstyle tags computed from the real card functions.
 */

import { describe, it, expect } from "vitest";
import { localizeArchetype, deckTags, type DeckCardLine } from "../src/data/decks.ts";
import type { Catalog, CatalogCard } from "../src/data/catalog.ts";

const cards: CatalogCard[] = [
  { id: "r", localId: "1", name: "博士的研究", category: "Trainer", fn: ["draw"], set: "X" },
  { id: "b", localId: "2", name: "超級球", category: "Trainer", fn: ["search"], set: "X" },
];

const catalog = {
  sets: {},
  cards,
  dexEnZh: {
    dragapult: "多龍巴魯托",
    dusknoir: "黑夜魔靈",
    greninja: "甲賀忍蛙",
    zoroark: "索羅亞克",
  },
} as unknown as Catalog;

describe("localizeArchetype", () => {
  it("localizes multi-Pokémon, Mega and possessive archetype names", () => {
    expect(localizeArchetype("Dragapult Dusknoir", catalog)).toBe("多龍巴魯托 黑夜魔靈");
    expect(localizeArchetype("Mega Greninja", catalog)).toBe("超級甲賀忍蛙");
    expect(localizeArchetype("N's Zoroark", catalog)).toBe("N之索羅亞克");
  });
  it("maps descriptor words and applies curated overrides", () => {
    // Word-mapping path: Pokémon via dex + descriptor via ARCH_WORD.
    expect(localizeArchetype("Zoroark Control", catalog)).toBe("索羅亞克 控場");
    // Curated override for ability/mechanic-named archetypes (owner 2026-06-15).
    expect(localizeArchetype("Basic Box", catalog)).toBe("太晶Box");
    expect(localizeArchetype("Festival Lead", catalog)).toBe("祭典樂舞");
    expect(localizeArchetype("Dragapult", null)).toBe("Dragapult"); // no catalog → unchanged
  });
});

describe("deckTags", () => {
  it("derives playstyle tags from the aggregate card functions", () => {
    const build: DeckCardLine[] = [
      { name: "博士的研究", count: 4, isBasic: false, section: "trainer" },
      { name: "超級球", count: 4, isBasic: false, section: "trainer" },
    ];
    // draw 4 + search 4 = 8 ≥ 6 → consistent engine.
    expect(deckTags(build, catalog)).toContain("decks.tag.engine");
  });
  it("returns nothing without a catalog", () => {
    expect(deckTags([{ name: "x", count: 1, isBasic: false, section: "trainer" }], null)).toEqual([]);
  });
});
