/**
 * Battle attack resolution (#36 P2): type-aware energy-cost payment, weakness
 * (×2) / resistance damage, KO prize value — all from REAL catalog facts, with
 * special/unknown energy paying as an honest wildcard.
 */

import { describe, it, expect } from "vitest";
import { canPayCost, baseDamage, finalDamage, prizeValue, energyProvides, inflictedStatus, selfHealAmount, attackDrawCount, selfDamageAmount, locksAttackerNextTurn } from "../src/state/battleAttack.ts";
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
  it("subtracts a resistance written with a full-width / subscript minus (catalog reality)", () => {
    // 175+ catalog resistances use the full-width minus 「－30」; it must SUBTRACT.
    expect(finalDamage(attacker, card({ resistances: [{ type: "Fire", value: "－30" }] }), 100).damage).toBe(70);
    expect(finalDamage(attacker, card({ resistances: [{ type: "Fire", value: "₋30" }] }), 100).damage).toBe(70);
    expect(finalDamage(attacker, card({ resistances: [{ type: "Fire", value: "−20" }] }), 100).damage).toBe(80);
  });
  it("leaves damage unchanged with no weakness/resistance, and never goes negative", () => {
    expect(finalDamage(attacker, card({}), 50).damage).toBe(50);
    expect(finalDamage(attacker, card({ resistances: [{ type: "Fire", value: "-30" }] }), 20).damage).toBe(0);
  });
});

describe("inflictedStatus — high-precision, unconditional only", () => {
  it("reads the bare 將對手的戰鬥寶可夢【X】 inflict for each condition", () => {
    expect(inflictedStatus("將對手的戰鬥寶可夢【中毒】。")).toBe("poison");
    expect(inflictedStatus("將對手的戰鬥寶可夢【灼傷】。")).toBe("burn");
    expect(inflictedStatus("將對手的戰鬥寶可夢【睡眠】。")).toBe("asleep");
    expect(inflictedStatus("將對手的戰鬥寶可夢【混亂】。")).toBe("confused");
    expect(inflictedStatus("將對手的戰鬥寶可夢【麻痺】。")).toBe("paralyzed");
  });
  it("applies the status even alongside other (unmodeled) clauses", () => {
    expect(inflictedStatus("對手的所有寶可夢各受到20點傷害。將對手的戰鬥寶可夢【中毒】。")).toBe("poison");
  });
  it("does NOT fire on a coin-flip (擲) or conditional (若) status", () => {
    expect(inflictedStatus("擲1次硬幣若為正面，則將對手的戰鬥寶可夢【麻痺】。")).toBeNull();
    expect(inflictedStatus("查看對手的手牌，若其中有能量卡，則將對手的戰鬥寶可夢【麻痺】。")).toBeNull();
  });
  it("does NOT mistake a READ-for-damage (若…【中毒】則增加傷害) for an inflict", () => {
    expect(inflictedStatus("若對手的戰鬥寶可夢【中毒】，則增加90點傷害。")).toBeNull();
  });
  it("returns null for a plain damage attack", () => {
    expect(inflictedStatus("造成30點傷害。")).toBeNull();
    expect(inflictedStatus(undefined)).toBeNull();
  });
});

describe("selfHealAmount — unconditional attacker self-heal only", () => {
  it("reads 將這隻寶可夢恢復「N」HP", () => {
    expect(selfHealAmount("造成30點傷害。將這隻寶可夢恢復「30」HP。")).toBe(30);
    expect(selfHealAmount("將這隻寶可夢恢復「90」HP。")).toBe(90);
  });
  it("does NOT fire on a coin-flip / conditional heal, or a plain attack", () => {
    expect(selfHealAmount("擲1次硬幣若為正面，將這隻寶可夢恢復「30」HP。")).toBe(0);
    expect(selfHealAmount("若這隻寶可夢【中毒】，將這隻寶可夢恢復「30」HP。")).toBe(0);
    expect(selfHealAmount("造成30點傷害。")).toBe(0);
    expect(selfHealAmount(undefined)).toBe(0);
  });
});

describe("attackDrawCount — unconditional attacker draw only", () => {
  it("reads 從自己的牌庫抽出N張卡", () => {
    expect(attackDrawCount("從自己的牌庫抽出1張卡。")).toBe(1);
    expect(attackDrawCount("造成20點傷害。從自己的牌庫抽出2張卡。")).toBe(2);
  });
  it("does NOT fire on a coin-flip / conditional draw, or a plain attack", () => {
    expect(attackDrawCount("擲1次硬幣若為正面，從自己的牌庫抽出2張卡。")).toBe(0);
    expect(attackDrawCount("造成30點傷害。")).toBe(0);
    expect(attackDrawCount(undefined)).toBe(0);
  });
});

describe("selfDamageAmount — unconditional attacker recoil only", () => {
  it("reads 這隻寶可夢也受到N點傷害", () => {
    expect(selfDamageAmount("造成120點傷害。這隻寶可夢也受到30點傷害。")).toBe(30);
    expect(selfDamageAmount("這隻寶可夢也受到10點傷害。")).toBe(10);
  });
  it("does NOT fire on a coin-flip / conditional recoil, or a plain attack", () => {
    expect(selfDamageAmount("擲1次硬幣若為反面，這隻寶可夢也受到30點傷害。")).toBe(0);
    expect(selfDamageAmount("造成30點傷害。")).toBe(0);
    expect(selfDamageAmount(undefined)).toBe(0);
  });
});

describe("locksAttackerNextTurn — unconditional attacker self-lock only", () => {
  it("matches 在下個自己的回合，這隻寶可夢無法使用招式", () => {
    expect(locksAttackerNextTurn("在下個自己的回合，這隻寶可夢無法使用招式。")).toBe(true);
    expect(locksAttackerNextTurn("造成90點傷害。在下個自己的回合，這隻寶可夢無法使用招式。")).toBe(true);
  });
  it("does NOT fire on a coin-flip / conditional lock, the DEFENDER-side lock, or a plain attack", () => {
    expect(locksAttackerNextTurn("擲1次硬幣若為反面，則在下個自己的回合，這隻寶可夢無法使用招式。")).toBe(false);
    expect(locksAttackerNextTurn("若希望，增加100點傷害。這個情況下，在下個自己的回合，這隻寶可夢無法使用招式。")).toBe(false);
    expect(locksAttackerNextTurn("在下個對手的回合，受到這個招式的進化寶可夢無法使用招式。")).toBe(false);
    expect(locksAttackerNextTurn("造成30點傷害。")).toBe(false);
    expect(locksAttackerNextTurn(undefined)).toBe(false);
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
