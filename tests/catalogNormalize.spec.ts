/**
 * Catalog name normalization (owner request 2026-06-15: 繁中 must show clean
 * official names). TCGdex marks trainer-owner Pokémon with `<...>`; the runtime
 * strips it on load so search, grouping, display and deck resolution all see the
 * real name "火箭隊的黑暗鴉", never "<火箭隊的>黑暗鴉".
 */
import { describe, it, expect } from "vitest";
import {
  cleanName,
  normalizeCatalog,
  resolveDeckRow,
  tagOwners,
  isOwnedPokemon,
  evolutionFamilies,
  groupByName,
} from "../src/data/catalog.ts";
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

describe("tagOwners — trainer-owned Pokémon (owner request 2026-06-15)", () => {
  function pk(name: string, dex: number, stage = "Basic"): CatalogCard {
    return { id: name, localId: "1", name, nameZh: name, category: "Pokemon", stage, dexId: [dex], set: "S" };
  }
  it("tags <trainer>的<species> only when the prefix owns ≥2 species; excludes promos", () => {
    const cards: CatalogCard[] = [
      pk("毒薔薇", 315),
      pk("羅絲雷朵", 407, "Stage1"),
      pk("烈咬陸鯊", 445, "Stage2"),
      pk("皮卡丘", 25),
      pk("竹蘭的毒薔薇", 315),
      pk("竹蘭的羅絲雷朵", 407, "Stage1"),
      pk("竹蘭的烈咬陸鯊ex", 445, "Stage2"), // suffix-stripped to a real species
      pk("臺北的皮卡丘", 25), // place/promo: 臺北 owns just one species → NOT tagged
    ];
    const catalog = { sets: {}, cards } as unknown as Catalog;
    tagOwners(catalog);
    const ownerOf = (n: string) => cards.find((c) => c.name === n)!.owner;
    expect(ownerOf("竹蘭的毒薔薇")).toBe("竹蘭");
    expect(ownerOf("竹蘭的羅絲雷朵")).toBe("竹蘭");
    expect(ownerOf("竹蘭的烈咬陸鯊ex")).toBe("竹蘭");
    expect(ownerOf("臺北的皮卡丘")).toBeUndefined();
    expect(ownerOf("毒薔薇")).toBeUndefined();
    expect(isOwnedPokemon(cards.find((c) => c.name === "竹蘭的毒薔薇")!)).toBe(true);
  });

  it("keeps a trainer's evolution line separate from the ordinary line of the same dex", () => {
    const cards: CatalogCard[] = [
      pk("毒薔薇", 315),
      pk("羅絲雷朵", 407, "Stage1"),
      pk("竹蘭的毒薔薇", 315),
      pk("竹蘭的羅絲雷朵", 407, "Stage1"),
    ];
    const catalog = { sets: {}, cards, dexEvolvesFrom: { 407: 315 } } as unknown as Catalog;
    tagOwners(catalog);
    const fams = evolutionFamilies(catalog, groupByName(catalog, cards));
    // Two distinct lines (ordinary 315 + 竹蘭's 315), each with 2 members.
    expect(fams).toHaveLength(2);
    for (const fam of fams) expect(fam.members).toHaveLength(2);
    const owned = fams.find((f) => f.key.startsWith("o竹蘭:"));
    expect(owned?.members.every((m) => m.rep.owner === "竹蘭")).toBe(true);
  });
});
