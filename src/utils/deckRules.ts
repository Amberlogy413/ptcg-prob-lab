/**
 * Real PTCG deck-building legality (owner mandate 2026-06-15: "卡片同名最多放 4
 * 張係每幅牌(合共 60 張)…自動對齊計算"). Pure, data-driven name detectors +
 * count caps + a legality report. NOTHING here touches the exact math core
 * (src/lib/prob, src/lib/probx) — these are construction limits only; the math
 * keeps reading the deck's REAL total as N.
 *
 * Detection uses ONLY verified real signals (no guessing — see the audit
 * 2026-06-15): Basic Energy by the official name pattern (NOT energyType, which
 * the upstream tags inconsistently), Radiant by the 光輝/かがやく name prefix.
 * ACE SPEC is intentionally absent — it cannot be detected reliably, so we never
 * assert it rather than fabricate a rule.
 */

import { DECK_SIZE, MAX_COPIES, RADIANT_LIMIT } from "../constants.ts";
import type { DeckCard } from "../state/deckStore.ts";

/** A Basic Energy card — exempt from the 4-copy rule (but still bound by the 60
 *  total). Real basic energies are the only cards named 基本…能量 / Basic … Energy
 *  / 基本…エネルギー; Special Energy never matches. Name-based so it works for
 *  manual rows too (the row name is the real data). */
export function isBasicEnergyName(name: string): boolean {
  const n = name.trim();
  return /^基本.+能量$/.test(n) || /^Basic .+Energy$/i.test(n) || /^基本.+エネルギー$/.test(n);
}

/** A Radiant Pokémon (光輝 / かがやく prefix) — capped at 1 total per deck. */
export function isRadiantName(name: string): boolean {
  const n = name.trim();
  return n.startsWith("光輝") || n.startsWith("かがやく");
}

/** Sum the counts of every row sharing `name`, excluding one row id. */
function sameNameTotal(cards: DeckCard[], name: string, excludeId: string | null): number {
  return cards.reduce((s, c) => (c.id !== excludeId && c.name === name ? s + c.count : s), 0);
}

/** The largest legal count for a row (id `rowId`, given `name`) inside `cards`,
 *  honoring: per-name ≤ MAX_COPIES (Basic Energy exempt), Radiant ≤ RADIANT_LIMIT
 *  total, deck total ≤ DECK_SIZE (absolute). `rowId` is null for a not-yet-added
 *  row. Returns a non-negative integer ≤ `desired`. */
export function capRowCount(
  cards: DeckCard[],
  rowId: string | null,
  name: string,
  desired: number,
): number {
  let d = Math.max(0, Math.trunc(Number.isFinite(desired) ? desired : 0));
  if (!isBasicEnergyName(name)) {
    const others = sameNameTotal(cards, name, rowId);
    d = Math.min(d, Math.max(0, MAX_COPIES - others));
  }
  if (isRadiantName(name)) {
    const otherRadiant = cards.reduce(
      (s, c) => (c.id !== rowId && isRadiantName(c.name) ? s + c.count : s),
      0,
    );
    d = Math.min(d, Math.max(0, RADIANT_LIMIT - otherRadiant));
  }
  const otherTotal = cards.reduce((s, c) => (c.id !== rowId ? s + c.count : s), 0);
  d = Math.min(d, Math.max(0, DECK_SIZE - otherTotal));
  return d;
}

export interface DeckLegality {
  total: number;
  /** total === 60 */
  sizeOk: boolean;
  /** total > 60 (vs merely incomplete) */
  overSize: boolean;
  /** non-Basic-Energy names that appear more than 4 times. */
  copyViolations: { name: string; count: number }[];
  radiantCount: number;
  radiantOk: boolean;
  /** at least one Basic Pokémon (mulligan + construction need it). */
  hasBasicPokemon: boolean;
  /** every rule satisfied. */
  legal: boolean;
}

/** Audit a deck against the real construction rules — display metadata only,
 *  never gates the math (the probability stays exact for the deck's real N). */
export function deckLegality(cards: DeckCard[]): DeckLegality {
  const total = cards.reduce((s, c) => s + c.count, 0);
  const byName = new Map<string, number>();
  let radiantCount = 0;
  let hasBasicPokemon = false;
  for (const c of cards) {
    if (c.count <= 0) continue;
    byName.set(c.name, (byName.get(c.name) ?? 0) + c.count);
    if (isRadiantName(c.name)) radiantCount += c.count;
    if (c.isBasic) hasBasicPokemon = true;
  }
  const copyViolations: { name: string; count: number }[] = [];
  for (const [name, count] of byName) {
    if (count > MAX_COPIES && !isBasicEnergyName(name)) copyViolations.push({ name, count });
  }
  const sizeOk = total === DECK_SIZE;
  const overSize = total > DECK_SIZE;
  const radiantOk = radiantCount <= RADIANT_LIMIT;
  const legal = sizeOk && copyViolations.length === 0 && radiantOk && hasBasicPokemon;
  return { total, sizeOk, overSize, copyViolations, radiantCount, radiantOk, hasBasicPokemon, legal };
}
