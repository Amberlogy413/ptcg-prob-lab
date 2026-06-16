/**
 * 組牌工坊 energy fixes (owner 2026-06-16): basic-energy name variants
 * (基本【火】能量 / 基本火能量 / 基本【炎】能量) must collapse to ONE tile, and the
 * type tint must read through the 【】 brackets. Plus the Mega tier detection that
 * drives the 超級進化 bucket.
 */

import { describe, it, expect } from "vitest";
import { groupName, cardTier, toNewCardInput, type CatalogCard } from "../src/data/catalog.ts";
import { energyType } from "../src/data/typeColors.ts";

const energy = (nameZh: string): CatalogCard =>
  ({ id: nameZh, name: nameZh, nameZh, category: "Energy" }) as unknown as CatalogCard;
const mon = (nameZh: string, stage: string): CatalogCard =>
  ({ id: nameZh, name: nameZh, nameZh, category: "Pokemon", stage }) as unknown as CatalogCard;

describe("groupName — basic energy variants collapse to one tile", () => {
  it("folds 【】 brackets and the 炎→火 wording onto a single key", () => {
    const fire = ["基本【火】能量", "基本火能量", "基本【炎】能量"].map((n) => groupName(energy(n)));
    expect(new Set(fire).size).toBe(1);
    expect(fire[0]).toBe("基本火能量");
    // Fighting basic likewise: bracketed and plain are the same card.
    expect(groupName(energy("基本【鬥】能量"))).toBe(groupName(energy("基本鬥能量")));
  });
  it("keeps distinct energies (and all non-energy names) separate", () => {
    expect(groupName(energy("基本水能量"))).not.toBe(groupName(energy("基本火能量")));
    expect(groupName(energy("岩石鬥能量"))).toBe("岩石鬥能量"); // special typed — untouched
    // Non-energy names pass through verbatim (no bracket stripping).
    const p = { id: "x", name: "多龍巴魯托ex", nameZh: "多龍巴魯托ex", category: "Pokemon" } as unknown as CatalogCard;
    expect(groupName(p)).toBe("多龍巴魯托ex");
  });
});

describe("energyType — reads the element through 【】 brackets", () => {
  it("tints 基本【火】能量 as Fire (was null before the bracket fix)", () => {
    expect(energyType("基本【火】能量")).toBe("Fire");
    expect(energyType("基本【鬥】能量")).toBe("Fighting");
    expect(energyType("基本【炎】能量")).toBe("Fire"); // old Fire wording
    expect(energyType("基本火能量")).toBe("Fire");
  });
  it("still leaves proper-noun / special energies neutral", () => {
    expect(energyType("火箭隊能量")).toBeNull();
  });
});

describe("toNewCardInput — canonical name folds variant prints onto one deck row", () => {
  // Adversarial review 2026-06-16: the ≤4 / ≤60 caps key on the deck-row name, so
  // a card's name variants MUST resolve to one canonical name or the per-name cap
  // is bypassable by switching the print version.
  const print = (name: string, nameZh: string, category = "Pokemon"): CatalogCard =>
    ({ id: name, name, nameZh, category, stage: "Basic" }) as unknown as CatalogCard;

  it("a zh print and a ja-only print of the same card share one canonical name", () => {
    // 謝米 (SV) and シェイミ (M3) are the same card — both carry nameZh 謝米.
    const zh = toNewCardInput(print("謝米", "謝米"));
    const ja = toNewCardInput(print("シェイミ", "謝米"));
    expect(zh.name).toBe("謝米");
    expect(ja.name).toBe("謝米"); // NOT シェイミ — folds onto the same capped row
  });

  it("basic-energy bracket/wording variants resolve to one canonical name", () => {
    const a = toNewCardInput(print("基本【火】能量", "基本【火】能量", "Energy"));
    const b = toNewCardInput(print("基本火能量", "基本火能量", "Energy"));
    expect(a.name).toBe("基本火能量");
    expect(b.name).toBe("基本火能量");
  });
});

describe("cardTier — Mega bucket detection", () => {
  it("flags 超級…ex as MEGA regardless of the TCGdex pre-mega stage", () => {
    // 超級路卡利歐ex's TCGdex stage is Stage1, but it is a Mega card.
    expect(cardTier(mon("超級路卡利歐ex", "Stage1"))).toBe("MEGA");
    expect(cardTier(mon("超級阿勃梭魯ex", "Basic"))).toBe("MEGA");
    expect(cardTier(mon("多龍巴魯托ex", "Stage2"))).toBe("ex");
    expect(cardTier(mon("多龍梅西亞", "Basic"))).toBeNull();
  });
});
