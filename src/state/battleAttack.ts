/**
 * Attack resolution for the battle game (#36 P2, owner 2026-06-17). Pure,
 * testable functions over REAL catalog facts: does the attached Energy pay the
 * attack's cost (type-aware), what damage lands after the defender's
 * weakness/resistance, and how many Prize cards a Knock-Out is worth. Never a
 * guess — special/unknown energy pays as a wildcard (honest), and a missing
 * weakness value defaults to the standard ×2.
 */

import { energyType } from "../data/typeColors.ts";
import { cardTier, type CatalogCard } from "../data/catalog.ts";
import type { BattleCard, SpecialCondition } from "./battleStore.ts";

/** The element an attached Energy provides; null = special / no element → a
 *  wildcard that can pay any single cost symbol (we never fabricate its type). */
export function energyProvides(card: BattleCard): string | null {
  return energyType(card.name);
}

/**
 * Can the attached Energy pay this attack cost? Type-aware: each non-Colorless
 * symbol needs a matching-element Energy (or a wildcard); Colorless symbols are
 * then paid by whatever is left. An empty/absent cost is free.
 */
export function canPayCost(attached: BattleCard[], cost: string[] | undefined): boolean {
  if (cost === undefined || cost.length === 0) return true;
  const pool: (string | null)[] = attached.map(energyProvides);
  const used = new Array(pool.length).fill(false);
  const colorless: string[] = [];
  for (const c of cost) {
    if (c === "Colorless") {
      colorless.push(c);
      continue;
    }
    let i = pool.findIndex((p, k) => !used[k] && p === c);
    if (i === -1) i = pool.findIndex((p, k) => !used[k] && p === null); // wildcard
    if (i === -1) return false;
    used[i] = true;
  }
  for (let n = 0; n < colorless.length; n++) {
    const i = used.findIndex((u) => !u);
    if (i === -1) return false;
    used[i] = true;
  }
  return true;
}

/** Does the printed damage carry a variable / conditional modifier ("50+",
 *  "60×")? For these the REAL value depends on a count the catalog text does not
 *  expose in a machine-readable form (Energy attached, damage counters, heads…),
 *  so it is NOT exactly resolvable here. Callers must treat baseDamage() of a
 *  variable attack as the printed base only, and disclose the approximation —
 *  never present it as the exact result (real-data-only mandate). */
export function isVariableDamage(dmg: number | string | undefined): boolean {
  return typeof dmg === "string" && /[+\-×x*]/.test(dmg);
}

/** Parse an attack's printed base damage ("120+", "20×", 90 → 120 / 20 / 90).
 *  HONESTY: for a "+"/"×" attack this returns only the printed base — the
 *  modifier is dropped because its true multiplier/bonus is not in the data.
 *  Use isVariableDamage() to know when the result is an approximation, not exact. */
export function baseDamage(dmg: number | string | undefined): number {
  if (typeof dmg === "number") return dmg;
  if (typeof dmg === "string") {
    const m = dmg.match(/\d+/);
    return m ? Number(m[0]) : 0;
  }
  return 0;
}

function applyMod(dmg: number, value: string | undefined, weak: boolean): number {
  if (value === undefined || value.trim() === "") return weak ? dmg * 2 : dmg;
  // Normalize every Unicode minus glyph to ASCII first — the catalog records many
  // resistances with a FULL-WIDTH minus (－30) or subscript minus (₋30); without
  // this the minus is stripped and a −30 reduction becomes a +30 BONUS (wrong).
  const v = value.trim().replace(/[−－₋‐‑‒–—―]/g, "-");
  if (/^[×x*]/.test(v)) {
    const n = Number(v.slice(1));
    return Number.isFinite(n) ? Math.round(dmg * n) : weak ? dmg * 2 : dmg;
  }
  const m = v.match(/-?\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) ? dmg + n : weak ? dmg * 2 : dmg;
}

/** Final damage after the DEFENDER's weakness (×2 typical) / resistance (−N),
 *  keyed to the ATTACKER's primary type. Floored at 0. */
export function finalDamage(
  attacker: CatalogCard | null,
  defender: CatalogCard | null,
  base: number,
): { damage: number; weakness: boolean; resistance: boolean } {
  if (base <= 0) return { damage: Math.max(0, base), weakness: false, resistance: false };
  const atkType = attacker?.types?.[0];
  let dmg = base;
  let weakness = false;
  let resistance = false;
  if (atkType !== undefined && defender !== null) {
    const w = defender.weaknesses?.find((x) => x.type === atkType);
    if (w !== undefined) {
      dmg = applyMod(dmg, w.value, true);
      weakness = true;
    }
    const r = defender.resistances?.find((x) => x.type === atkType);
    if (r !== undefined) {
      dmg = applyMod(dmg, r.value, false);
      resistance = true;
    }
  }
  return { damage: Math.max(0, dmg), weakness, resistance };
}

/** The Special Condition an attack UNCONDITIONALLY inflicts on the defender, from
 *  the attack's zh effect text — or null. HIGH-PRECISION on purpose: only the bare
 *  "將對手的戰鬥寶可夢【X】" phrasing, and only when the effect has no 「若」
 *  (conditional) and no 「擲」 (coin flip), so we never apply a status that is
 *  actually gated on a flip/condition, nor mistake a "若…【中毒】則增加傷害" READ for
 *  an inflict. Coin-flip / conditional statuses stay unmodeled (disclosed). */
const STATUS_TEXT: ReadonlyArray<readonly [string, SpecialCondition]> = [
  ["中毒", "poison"],
  ["灼傷", "burn"],
  ["睡眠", "asleep"],
  ["混亂", "confused"],
  ["麻痺", "paralyzed"],
];
export function inflictedStatus(effect: string | undefined): SpecialCondition | null {
  if (effect === undefined || effect.includes("若") || effect.includes("擲")) return null;
  for (const [zh, cond] of STATUS_TEXT) if (effect.includes(`將對手的戰鬥寶可夢【${zh}】`)) return cond;
  return null;
}

/** HP the attack UNCONDITIONALLY heals on the ATTACKER itself
 *  ("將這隻寶可夢恢復「N」HP") — 0 if absent or gated on a 若 (condition) / 擲 (coin
 *  flip). High-precision like inflictedStatus: only the bare self-heal phrasing, so a
 *  conditional/variable heal is never applied (and never claimed as exact). Healing
 *  only ever REDUCES the attacker's own damage, so it can never cause a KO. */
export function selfHealAmount(effect: string | undefined): number {
  if (effect === undefined || effect.includes("若") || effect.includes("擲")) return 0;
  const m = effect.match(/將這隻寶可夢恢復「(\d+)」HP/);
  return m ? Number(m[1]) : 0;
}

/** Cards the attack UNCONDITIONALLY draws for the ATTACKER's player
 *  ("從自己的牌庫抽出N張卡") — 0 if absent or gated on a 若 / 擲. An empty deck simply
 *  draws fewer (handled by the draw op); drawing never causes a KO. */
export function attackDrawCount(effect: string | undefined): number {
  if (effect === undefined || effect.includes("若") || effect.includes("擲")) return 0;
  const m = effect.match(/從自己的牌庫抽出(\d+)張卡/);
  return m ? Number(m[1]) : 0;
}

/** Recoil: damage the attack UNCONDITIONALLY deals to the ATTACKER itself
 *  ("這隻寶可夢也受到N點傷害") — 0 if absent or gated on a 若 / 擲. Unlike heal/draw,
 *  recoil CAN Knock the attacker Out (the opponent then takes the Prize), so the
 *  caller must handle a possible self-KO. */
export function selfDamageAmount(effect: string | undefined): number {
  if (effect === undefined || effect.includes("若") || effect.includes("擲")) return 0;
  const m = effect.match(/這隻寶可夢也受到(\d+)點傷害/);
  return m ? Number(m[1]) : 0;
}

/** How many of the ATTACKER's OWN attached Energy the attack UNCONDITIONALLY
 *  discards ("選擇N個這隻寶可夢身上附加的能量，將其丟棄") — 0 if absent or gated on a
 *  若 / 擲. WHICH Energy to discard is a real player choice → modeled as part of the
 *  attack action (see energyDiscardCombos), never auto-picked. */
export function discardEnergyCount(effect: string | undefined): number {
  if (effect === undefined || effect.includes("若") || effect.includes("擲")) return 0;
  const m = effect.match(/選擇(\d+)個這隻寶可夢身上附加的能量，將其丟棄/);
  return m ? Number(m[1]) : 0;
}

/** The distinct ways to discard exactly `n` of `energy` (the attacker's attached
 *  Energy), as arrays of iids. Deduped by element (same-element / same-name Energy
 *  is interchangeable), so e.g. discarding 1 of [火,火,水] is just {火} or {水}. If
 *  fewer than `n` are attached, the only "choice" is to discard them all. */
export function energyDiscardCombos(energy: BattleCard[], n: number): string[][] {
  if (n <= 0) return [];
  if (energy.length <= n) return energy.length === 0 ? [] : [energy.map((e) => e.iid)];
  const groups = new Map<string, string[]>(); // element/name key → iids
  for (const e of energy) {
    const k = energyProvides(e) ?? e.name;
    const arr = groups.get(k);
    if (arr) arr.push(e.iid);
    else groups.set(k, [e.iid]);
  }
  const keys = [...groups.keys()];
  const combos: string[][] = [];
  const rec = (start: number, chosen: string[], remaining: number): void => {
    if (remaining === 0) {
      combos.push(chosen);
      return;
    }
    for (let i = start; i < keys.length; i++) {
      const avail = groups.get(keys[i]!)!;
      const max = Math.min(avail.length, remaining);
      for (let cnt = 1; cnt <= max; cnt++) rec(i + 1, [...chosen, ...avail.slice(0, cnt)], remaining - cnt);
    }
  };
  rec(0, [], n);
  return combos;
}

/** Does the attack UNCONDITIONALLY lock the ATTACKER out of attacking on its
 *  next turn ("在下個自己的回合，這隻寶可夢無法使用招式")? 0/false on 若 / 擲 (so a
 *  coin-flip / optional lock is never applied) — high-precision like inflictedStatus.
 *  The DEFENDER-lock wording ("受到這個招式的…無法使用招式") is intentionally NOT matched. */
export function locksAttackerNextTurn(effect: string | undefined): boolean {
  if (effect === undefined || effect.includes("若") || effect.includes("擲")) return false;
  return effect.includes("在下個自己的回合，這隻寶可夢無法使用招式");
}

/** Prize cards taken when this Pokémon is Knocked Out (rule-box → 2, VMAX → 3). */
export function prizeValue(card: CatalogCard | null): number {
  if (card === null) return 1;
  const tier = cardTier(card);
  if (tier === "VMAX") return 3;
  if (tier !== null) return 2; // ex / Mega / V / VSTAR
  return 1;
}
