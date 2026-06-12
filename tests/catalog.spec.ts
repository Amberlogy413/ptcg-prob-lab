/**
 * Real-card catalog logic (docs/DECISIONS.md "真實卡牌目錄"): search ranking,
 * the Basic-Pokémon rule (mulligan math counts 基礎寶可夢, never Basic
 * Energy), and the catalog→deck-row mapping.
 */

import { describe, it, expect } from "vitest";
import {
  searchCatalog,
  isBasicPokemon,
  sectionOf,
  toNewCardInput,
  stageKey,
  typeKey,
  type Catalog,
  type CatalogCard,
} from "../src/data/catalog.ts";

const card = (over: Partial<CatalogCard> & Pick<CatalogCard, "id" | "name">): CatalogCard => ({
  localId: over.id.split("-")[1] ?? "000",
  category: "Pokemon",
  set: over.id.split("-")[0] ?? null,
  ...over,
});

export const FIXTURE: Catalog = {
  v: 1,
  lang: "zh-tw",
  source: "TCGdex",
  fetchedAt: "2026-06-12",
  count: 5,
  sets: {
    SV9: { name: "對戰搭檔", serie: "朱&紫系列", date: "2025-02-07", official: 100 },
    SV1a: { name: "三連音爆", serie: "朱&紫系列", date: "2023-03-31", official: 73 },
    S11: { name: "舊系列", serie: "劍&盾系列", date: "2022-07-15", official: 100 },
  },
  cards: [
    card({
      id: "SV1a-001",
      name: "熱帶龍",
      stage: "Basic",
      hp: 110,
      regulationMark: "G",
    }),
    card({
      id: "SV9-001",
      name: "綠毛蟲",
      stage: "Basic",
      hp: 50,
      types: ["Grass"],
      regulationMark: "I",
      std: true,
      attacks: [{ cost: ["Grass"], name: "蟲咬", damage: 20 }],
      weaknesses: [{ type: "Fire", value: "×2" }],
      retreat: 1,
      description: "別看牠的腳很短。",
      illustrator: "Shimaris Yukichi",
    }),
    card({
      id: "S11-001",
      name: "綠毛蟲",
      stage: "Basic",
      hp: 50,
      regulationMark: "F",
    }),
    card({
      id: "SV9-002",
      name: "鐵甲蛹",
      stage: "Stage1",
      evolveFrom: "綠毛蟲",
      hp: 80,
      regulationMark: "I",
      std: true,
    }),
    card({
      id: "SV9-090",
      name: "調換票",
      category: "Trainer",
      trainerType: "Item",
      effect: "數過自己的獎賞卡張數後,全部翻回反面並重洗。",
      regulationMark: "I",
      std: true,
    }),
  ],
};

describe("searchCatalog", () => {
  it("ranks name prefix > name substring > id text, and never matches blanks", () => {
    expect(searchCatalog(FIXTURE, "")).toEqual([]);
    expect(searchCatalog(FIXTURE, "  ")).toEqual([]);
    const names = searchCatalog(FIXTURE, "綠").map((c) => c.id);
    // 綠毛蟲 prefix hits first; 鐵甲蛹 only matches via evolveFrom? — it must
    // NOT match: search reads name and identity only.
    expect(names).toEqual(["SV9-001", "S11-001"]);
    expect(searchCatalog(FIXTURE, "甲").map((c) => c.id)).toEqual(["SV9-002"]);
  });

  it("puts the standard-legal print of the same name first", () => {
    const prints = searchCatalog(FIXTURE, "綠毛蟲");
    expect(prints[0]?.id).toBe("SV9-001"); // std
    expect(prints[1]?.id).toBe("S11-001"); // rotated out
  });

  it("finds cards by set/number identity", () => {
    expect(searchCatalog(FIXTURE, "sv9 090").map((c) => c.id)).toEqual(["SV9-090"]);
  });
});

describe("Basic-Pokémon rule and deck mapping", () => {
  it("isBasicPokemon: Basic Pokémon yes; evolved no; Trainer no", () => {
    expect(isBasicPokemon(FIXTURE.cards[1]!)).toBe(true);
    expect(isBasicPokemon(FIXTURE.cards[3]!)).toBe(false);
    expect(isBasicPokemon(FIXTURE.cards[4]!)).toBe(false);
  });

  it("Basic ENERGY never counts as a Basic Pokémon (mulligan rule)", () => {
    const energy = card({
      id: "SVE-001",
      name: "基本草能量",
      category: "Energy",
      energyType: "Basic",
    });
    expect(isBasicPokemon(energy)).toBe(false);
    expect(sectionOf(energy)).toBe("energy");
  });

  it("toNewCardInput carries name/count/isBasic/section/set/number/mark", () => {
    expect(toNewCardInput(FIXTURE.cards[1]!)).toEqual({
      name: "綠毛蟲",
      count: 1,
      isBasic: true,
      section: "pokemon",
      set: "SV9",
      number: "001",
      mark: "I",
      catalogId: "SV9-001",
    });
    // Trainer: not Basic, trainer section.
    const trainer = toNewCardInput(FIXTURE.cards[4]!);
    expect(trainer.isBasic).toBe(false);
    expect(trainer.section).toBe("trainer");
  });

  it("drops malformed regulation marks instead of storing them", () => {
    const odd = card({ id: "X-1", name: "怪標記", stage: "Basic", regulationMark: "I+" });
    expect("mark" in toNewCardInput(odd)).toBe(false);
  });
});

describe("display key mappers", () => {
  it("maps known enums to i18n keys and unknown values to null", () => {
    expect(stageKey("Basic")).toBe("catalog.stage.basic");
    expect(stageKey("Stage2")).toBe("catalog.stage.stage2");
    expect(stageKey("NewFangled")).toBeNull();
    expect(typeKey("Grass")).toBe("catalog.type.grass");
    expect(typeKey("???")).toBeNull();
  });
});
