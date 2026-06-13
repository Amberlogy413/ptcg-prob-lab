/**
 * Deck-row localization (owner request 2026-06-14): a row saved in any language
 * shows the player's chosen language. Pokémon bridge through the official dex
 * (even with no nameEn field); Trainer/Energy staples use the verified table;
 * unverified names stay as-is (no guessing).
 */

import { describe, it, expect } from "vitest";
import { localizeDeckRow, type Catalog, type CatalogCard } from "../src/data/catalog.ts";

const cards: CatalogCard[] = [
  {
    id: "SV6-130",
    localId: "130",
    name: "多龍巴魯托ex",
    nameZh: "多龍巴魯托ex",
    category: "Pokemon",
    stage: "Stage2",
    types: ["Dragon"],
    dexId: [887],
    std: true,
    set: "SV6",
  },
  {
    id: "SVE-002",
    localId: "002",
    name: "基本火能量",
    nameZh: "基本火能量",
    category: "Energy",
    energyType: "Basic",
    std: true,
    set: "SVE",
  },
];

const catalog: Catalog = {
  v: 1,
  lang: "zh-tw",
  source: "x",
  fetchedAt: "2026-06-14",
  count: cards.length,
  sets: { SV6: { name: "", serie: null, date: "2024-05-24", official: null }, SVE: { name: "", serie: null, date: null, official: null } },
  cards,
  dexEnZh: { dragapult: "多龍巴魯托", dreepy: "多龍梅西亞" },
  trainerEnZh: { "fire energy": "基本火能量", "ultra ball": "超級球" },
};

describe("localizeDeckRow", () => {
  it("bridges an English Pokémon name through the dex, with the ex suffix", () => {
    const r = localizeDeckRow(catalog, { name: "Dragapult ex" }, "zh");
    expect(r.name).toBe("多龍巴魯托ex");
    expect(r.card?.id).toBe("SV6-130"); // resolved for the type accent
  });

  it("localizes Trainer/Energy staples from the verified table", () => {
    expect(localizeDeckRow(catalog, { name: "Fire Energy" }, "zh").name).toBe("基本火能量");
    expect(localizeDeckRow(catalog, { name: "Ultra Ball" }, "zh").name).toBe("超級球");
  });

  it("leaves an unverified English name unchanged (no guessing)", () => {
    expect(localizeDeckRow(catalog, { name: "Risky Ruins" }, "zh").name).toBe("Risky Ruins");
  });

  it("keeps an already-zh name and still resolves its card for the accent", () => {
    const r = localizeDeckRow(catalog, { name: "多龍巴魯托ex" }, "zh");
    expect(r.name).toBe("多龍巴魯托ex");
    expect(r.card?.types).toEqual(["Dragon"]);
  });
});
