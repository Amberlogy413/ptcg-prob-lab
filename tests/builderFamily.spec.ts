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
