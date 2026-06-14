/**
 * Deck Workshop (owner request 2026-06-14, flagship): evolution-family grouping
 * (same line shows as one combo) + energy cards colored by their type.
 */

import { describe, it, expect } from "vitest";
import {
  evolutionFamilies,
  type Catalog,
  type CatalogCard,
  type PrintGroup,
} from "../src/data/catalog.ts";
import { cardAccent, TYPE_COLORS, NEUTRAL_ACCENT } from "../src/data/typeColors.ts";

function pk(name: string, dex: number, stage: string): CatalogCard {
  return { id: name, localId: "1", name, category: "Pokemon", stage, dexId: [dex], set: "X" };
}
function group(rep: CatalogCard): PrintGroup {
  return { rep, prints: [rep] };
}

const catalog = {
  dexEvolvesFrom: { 496: 495, 497: 496 }, // Snivy → Servine → Serperior
} as unknown as Catalog;

describe("evolutionFamilies", () => {
  it("groups a 3-stage line into one family, ordered Basic→Stage2", () => {
    // Input order deliberately scrambled.
    const groups = [
      group(pk("君主蛇", 497, "Stage2")),
      group(pk("藤藤蛇", 495, "Basic")),
      group(pk("青藤蛇", 496, "Stage1")),
    ];
    const fams = evolutionFamilies(catalog, groups);
    expect(fams).toHaveLength(1);
    expect(fams[0]!.rootDex).toBe(495);
    expect(fams[0]!.members.map((m) => m.rep.name)).toEqual(["藤藤蛇", "青藤蛇", "君主蛇"]);
  });

  it("keeps unrelated Pokémon and non-Pokémon as separate families", () => {
    const groups = [
      group(pk("藤藤蛇", 495, "Basic")),
      group(pk("噴火龍", 6, "Stage2")),
      group({ id: "ball", localId: "1", name: "超級球", category: "Trainer", set: "X" }),
    ];
    const fams = evolutionFamilies(catalog, groups);
    expect(fams).toHaveLength(3);
  });

  it("a Baby Basic (含羞苞/Budew) does NOT drag its dex-evolutions into a line", () => {
    // Dex chains Budew(406)→Roselia(315)→Roserade(407); but Budew AND Roselia are
    // printed Basic, so only Roselia→Roserade is a real TCG line (owner 2026-06-15).
    const cat = { dexEvolvesFrom: { 315: 406, 407: 315 } } as unknown as Catalog;
    const fams = evolutionFamilies(cat, [
      group(pk("含羞苞", 406, "Basic")),
      group(pk("毒薔薇", 315, "Basic")),
      group(pk("羅絲雷朵", 407, "Stage1")),
    ]);
    const budew = fams.find((f) => f.members.some((m) => m.rep.name === "含羞苞"));
    const roselia = fams.find((f) => f.members.some((m) => m.rep.name === "毒薔薇"));
    expect(budew!.members.map((m) => m.rep.name)).toEqual(["含羞苞"]); // standalone
    expect(roselia!.members.map((m) => m.rep.name)).toEqual(["毒薔薇", "羅絲雷朵"]);
  });

  it("alternate Basics of one species are singletons, not a fake series", () => {
    const cat = { dexEvolvesFrom: {} } as unknown as Catalog;
    const fams = evolutionFamilies(cat, [
      group(pk("謝米", 492, "Basic")),
      group(pk("天空謝米", 492, "Basic")),
    ]);
    expect(fams).toHaveLength(2);
    for (const f of fams) expect(f.members).toHaveLength(1);
  });

  it("rep (collapsed face) is the highest-採用率 member", () => {
    const cat = { dexEvolvesFrom: { 407: 315 }, sets: {} } as unknown as Catalog;
    const basic = pk("毒薔薇", 315, "Basic");
    const stage1 = pk("羅絲雷朵", 407, "Stage1");
    stage1.usage = 50; // the evolution is the hot card
    const fams = evolutionFamilies(cat, [group(basic), group(stage1)]);
    expect(fams).toHaveLength(1);
    expect(fams[0]!.rep.rep.name).toBe("羅絲雷朵"); // 主軸 = most-played
    expect(fams[0]!.members.map((m) => m.rep.name)).toEqual(["毒薔薇", "羅絲雷朵"]); // stage order
  });
});

describe("cardAccent — energy by type", () => {
  it("colors basic energy by its elemental type", () => {
    expect(cardAccent({ category: "Energy", nameZh: "基本火能量" })).toBe(TYPE_COLORS.Fire);
    expect(cardAccent({ category: "Energy", nameZh: "基本水能量" })).toBe(TYPE_COLORS.Water);
    expect(cardAccent({ category: "Energy", name: "基本鋼能量" })).toBe(TYPE_COLORS.Metal);
  });
  it("leaves elementless energy / trainers neutral", () => {
    expect(cardAccent({ category: "Energy", nameZh: "捕獲能量" })).toBe(NEUTRAL_ACCENT);
    expect(cardAccent({ category: "Trainer", nameZh: "超級球" })).toBe(NEUTRAL_ACCENT);
  });
});
