/**
 * Evolution-chain facts + Rare Candy legality (src/data/evolution.ts), backed by
 * REAL PokéAPI species data (src/data/evolutionData.ts). dexId-based cases pin the
 * chain logic deterministically; name-based cases prove resolution works for the
 * dexId-less std lines that motivated this data.
 */
import { describe, it, expect } from "vitest";
import { canRareCandyJump, speciesDexOf, preEvoDex } from "../src/data/evolution.ts";
import type { CatalogCard } from "../src/data/catalog.ts";

const card = (over: Partial<CatalogCard>): CatalogCard => ({ id: "x", localId: "1", name: "X", category: "Pokemon", set: null, ...over } as CatalogCard);
const basic = (over: Partial<CatalogCard>) => card({ stage: "Basic", ...over });
const stage2 = (over: Partial<CatalogCard>) => card({ stage: "Stage2", ...over });

describe("preEvoDex", () => {
  it("follows the real species line (Charizard 6 ← 5 ← 4)", () => {
    expect(preEvoDex(6)).toBe(5);
    expect(preEvoDex(5)).toBe(4);
    expect(preEvoDex(4)).toBeNull();
  });
});

describe("speciesDexOf", () => {
  it("uses the card's dexId when present", () => {
    expect(speciesDexOf(card({ dexId: [6] }))).toBe(6);
  });
  it("resolves by exact species name when dexId is absent (suffix / Mega / owner stripped)", () => {
    expect(speciesDexOf(card({ name: "噴火龍" }))).toBe(6);
    expect(speciesDexOf(card({ name: "噴火龍ex", nameZh: "噴火龍ex" }))).toBe(6);
    expect(speciesDexOf(card({ nameZh: "超級噴火龍ex" }))).toBe(6);
    expect(speciesDexOf(card({ name: "Charizard", nameEn: "Charizard" }))).toBe(6);
    const bare = speciesDexOf(card({ name: "烈咬陸鯊" }));
    expect(bare).not.toBeNull(); // Garchomp
    expect(speciesDexOf(card({ nameZh: "竹蘭的烈咬陸鯊ex" }))).toBe(bare); // owner + ex stripped → same species
  });
  it("returns null for an unknown name", () => {
    expect(speciesDexOf(card({ name: "不存在的卡名" }))).toBeNull();
  });
});

describe("canRareCandyJump", () => {
  it("allows a Basic → its real Stage 2 (Charmander 4 → Charizard 6)", () => {
    expect(canRareCandyJump(basic({ dexId: [4] }), stage2({ dexId: [6] }))).toBe(true);
  });
  it("rejects a Stage 2 from the WRONG line (Pikachu 25 → Charizard 6)", () => {
    expect(canRareCandyJump(basic({ dexId: [25] }), stage2({ dexId: [6] }))).toBe(false);
  });
  it("rejects when the 'Basic' is the Stage 1, or the target is not a Stage 2", () => {
    expect(canRareCandyJump(card({ stage: "Stage1", dexId: [5] }), stage2({ dexId: [6] }))).toBe(false);
    expect(canRareCandyJump(basic({ dexId: [4] }), card({ stage: "Stage1", dexId: [5] }))).toBe(false);
  });
  it("rejects a one-hop target (the Basic must be TWO evolutions below the Stage 2)", () => {
    // Venusaur(3) ← Ivysaur(2) ← Bulbasaur(1): from a Basic that is the Stage-1 species (2) it's only one hop.
    expect(canRareCandyJump(basic({ dexId: [2] }), stage2({ dexId: [3] }))).toBe(false);
    expect(canRareCandyJump(basic({ dexId: [1] }), stage2({ dexId: [3] }))).toBe(true); // the real root
  });
  it("works end-to-end on a dexId-less std line by NAME (小火龍 → 噴火龍)", () => {
    expect(canRareCandyJump(basic({ name: "小火龍" }), stage2({ name: "噴火龍" }))).toBe(true);
    expect(canRareCandyJump(basic({ name: "皮卡丘" }), stage2({ name: "噴火龍" }))).toBe(false);
  });
  it("returns false when a species can't be resolved", () => {
    expect(canRareCandyJump(basic({ name: "唔知乜嘢" }), stage2({ dexId: [6] }))).toBe(false);
  });
});
