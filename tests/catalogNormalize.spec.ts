/**
 * Catalog name normalization (owner request 2026-06-15: 繁中 must show clean
 * official names). TCGdex marks trainer-owner Pokémon with `<...>`; the runtime
 * strips it on load so search, grouping, display and deck resolution all see the
 * real name "火箭隊的黑暗鴉", never "<火箭隊的>黑暗鴉".
 */
import { describe, it, expect } from "vitest";
import { cleanName, normalizeCatalog, resolveDeckRow } from "../src/data/catalog.ts";
import type { Catalog, CatalogCard } from "../src/data/catalog.ts";

describe("cleanName", () => {
  it("strips half- and full-width angle-bracket markup", () => {
    expect(cleanName("<火箭隊的>黑暗鴉")).toBe("火箭隊的黑暗鴉");
    expect(cleanName("＜竹蘭的＞圓陸鯊")).toBe("竹蘭的圓陸鯊");
    expect(cleanName("多龍巴魯托ex")).toBe("多龍巴魯托ex"); // untouched
    expect(cleanName(undefined)).toBeUndefined();
  });
});

describe("normalizeCatalog", () => {
  it("cleans name + nameZh and lets a bracketed deck row resolve cleanly", () => {
    const cards: CatalogCard[] = [
      { id: "x", localId: "7", name: "<火箭隊的>黑暗鴉", nameZh: "<火箭隊的>黑暗鴉", category: "Pokemon", set: "S" },
    ];
    const catalog = { sets: {}, cards } as unknown as Catalog;
    normalizeCatalog(catalog);
    expect(cards[0]!.name).toBe("火箭隊的黑暗鴉");
    expect(cards[0]!.nameZh).toBe("火箭隊的黑暗鴉");
    // A deck row saved with the clean name resolves to the card.
    expect(resolveDeckRow(catalog, { name: "火箭隊的黑暗鴉" })?.id).toBe("x");
  });
});
