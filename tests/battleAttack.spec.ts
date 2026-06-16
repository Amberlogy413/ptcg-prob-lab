/**
 * Battle attack resolution (#36 P2): type-aware energy-cost payment, weakness
 * (×2) / resistance damage, KO prize value — all from REAL catalog facts, with
 * special/unknown energy paying as an honest wildcard.
 */

import { describe, it, expect } from "vitest";
import { canPayCost, baseDamage, finalDamage, prizeValue, energyProvides } from "../src/state/battleAttack.ts";
import type { BattleCard } from "../src/state/battleStore.ts";
import type { CatalogCard } from "../src/data/catalog.ts";

let n = 0;
function energy(name: string): BattleCard {
  return { iid: `e${n++}`, name, isBasic: false, section: "energy", kind: "energy-basic" };
}
const fire = () => energy("基本火能量");
const water = () => energy("基本水能量");
const grass = () => energy("基本草能量");
const special = () => energy("二重彩虹能量"); // no trailing element → wildcard

function card(over: Partial<CatalogCard>): CatalogCard {
  return { id: "x", localId: "1", name: "X", category: "Pokemon", set: null, ...over } as CatalogCard;
}

describe("energyProvides", () => {
  it("reads a basic energy's element, and treats special as a wildcard (null)", () => {
    expect(energyProvides(fire())).toBe("Fire");
    expect(energyProvides(grass())).toBe("Grass");
    expect(energyProvides(special())).toBeNull();
  });
});

describe("canPayCost — type-aware", () => {
  it("pays a matching-type cost, rejects a wrong-type one", () => {
    expect(canPayCost([fire()], ["Fire"])).toBe(true);
    expect(canPayCost([water()], ["Fire"])).toBe(false);
  });
  it("pays Colorless with any leftover energy", () => {
    expect(canPayCost([fire(), water()], ["Fire", "Colorless"])).toBe(true);
    expect(canPayCost([fire(), water()], ["Colorless", "Colorless"])).toBe(true);
  });
  it("needs enough of the SPECIFIC type", () => {
    expect(canPayCost([fire(), water()], ["Fire", "Fire"])).toBe(false);
  });
  it("special energy is a wildcard that pays any single symbol", () => {
    expect(canPayCost([special()], ["Fire"])).toBe(true);
    expect(canPayCost([special(), special()], ["Grass", "Colorless"])).toBe(true);
  });
  it("an empty cost is free", () => {
    expect(canPayCost([], [])).toBe(true);
    expect(canPayCost([], undefined)).toBe(true);
  });
});

describe("baseDamage", () => {
  it("parses number, '120+', '20×', and blank", () => {
    expect(baseDamage(90)).toBe(90);
    expect(baseDamage("120+")).toBe(120);
    expect(baseDamage("20×")).toBe(20);
    expect(baseDamage(undefined)).toBe(0);
    expect(baseDamage("")).toBe(0);
  });
});

describe("finalDamage — weakness / resistance", () => {
  const attacker = card({ types: ["Fire"] });
  it("doubles on weakness to the attacker's type", () => {
    const def = card({ weaknesses: [{ type: "Fire", value: "×2" }] });
    const r = finalDamage(attacker, def, 100);
    expect(r.damage).toBe(200);
    expect(r.weakness).toBe(true);
  });
  it("defaults weakness to ×2 when the value is absent", () => {
    const def = card({ weaknesses: [{ type: "Fire" }] });
    expect(finalDamage(attacker, def, 60).damage).toBe(120);
  });
  it("subtracts a resistance value", () => {
    const def = card({ resistances: [{ type: "Fire", value: "-30" }] });
    const r = finalDamage(attacker, def, 100);
    expect(r.damage).toBe(70);
    expect(r.resistance).toBe(true);
  });
  it("leaves damage unchanged with no weakness/resistance, and never goes negative", () => {
    expect(finalDamage(attacker, card({}), 50).damage).toBe(50);
    expect(finalDamage(attacker, card({ resistances: [{ type: "Fire", value: "-30" }] }), 20).damage).toBe(0);
  });
});

describe("prizeValue", () => {
  it("is 2 for a rule-box Pokémon (ex), 3 for VMAX, 1 otherwise", () => {
    expect(prizeValue(card({ name: "噴火龍ex", nameZh: "噴火龍ex" }))).toBe(2);
    expect(prizeValue(card({ name: "超級噴火龍ex", nameZh: "超級噴火龍ex" }))).toBe(2);
    expect(prizeValue(card({ name: "耿鬼VMAX", nameZh: "耿鬼VMAX" }))).toBe(3);
    expect(prizeValue(card({ name: "多龍梅西亞", nameZh: "多龍梅西亞" }))).toBe(1);
    expect(prizeValue(null)).toBe(1);
  });
});
