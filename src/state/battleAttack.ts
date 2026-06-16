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
import type { BattleCard } from "./battleStore.ts";

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

/** Parse an attack's printed base damage ("120+", "20×", 90 → 120 / 20 / 90). */
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
  const v = value.trim();
  if (/^[×x*]/.test(v)) {
    const n = Number(v.slice(1));
    return Number.isFinite(n) ? Math.round(dmg * n) : weak ? dmg * 2 : dmg;
  }
  const n = Number(v.replace(/[^\d-]/g, ""));
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

/** Prize cards taken when this Pokémon is Knocked Out (rule-box → 2, VMAX → 3). */
export function prizeValue(card: CatalogCard | null): number {
  if (card === null) return 1;
  const tier = cardTier(card);
  if (tier === "VMAX") return 3;
  if (tier !== null) return 2; // ex / Mega / V / VSTAR
  return 1;
}
