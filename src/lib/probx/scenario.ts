/**
 * Mid-game scenario joint (深度數學分析任何場景; docs/09 mid-game family) —
 * P(drawing `w` cards from a deck of `U`, with EACH tracked card landing in
 * its [min, max] window). A thin framing over the seed core's proven
 * multivariate engine: comboOpening(N=U, H=w) with no mulligan conditioning.
 * No new math; the v2 golden pipeline pins the framing (kind scenario_joint).
 *
 * BigInt rationals only.
 */

import {
  type Rat,
  comboOpening,
  hypergeomAtLeast,
  type TrackedCard,
} from "../prob/index.ts";

export interface ScenarioCard {
  /** Copies of this card remaining in the U-card deck. */
  count: number;
  /** Inclusive window on copies drawn. */
  min: number;
  max: number;
  label?: string;
}

export interface ScenarioResult {
  /** Exact joint P(every card meets its window when drawing w from U). */
  joint: Rat;
  /** Per-card marginal P(this card alone meets ≥min), ignoring the others. */
  marginals: Rat[];
  /** Full joint distribution table (combinations and their probabilities). */
  table: { ks: number[]; p: Rat; satisfies: boolean }[];
}

export function computeScenarioJoint(cards: ScenarioCard[], U: number, w: number): ScenarioResult {
  if (!Number.isInteger(U) || U < 1) throw new RangeError(`U must be ≥ 1, got ${U}`);
  if (!Number.isInteger(w) || w < 1 || w > U) throw new RangeError(`w out of range: ${w}, U=${U}`);
  const totalCopies = cards.reduce((s, c) => s + c.count, 0);
  if (totalCopies > U) throw new RangeError(`tracked copies ${totalCopies} exceed U=${U}`);

  const tracked: TrackedCard[] = cards.map((c) => ({
    count: c.count,
    min: c.min,
    max: c.max,
    ...(c.label !== undefined ? { label: c.label } : {}),
  }));
  const res = comboOpening(tracked, { N: U, H: w });

  const marginals = cards.map((c) =>
    // marginal = P(≥min copies of this card in w draws), single-category tail.
    hypergeomAtLeast(U, c.count, w, Math.max(1, c.min)),
  );

  return {
    joint: res.event,
    marginals,
    table: res.table.map((cell) => ({ ks: [...cell.ks], p: cell.p, satisfies: cell.satisfies })),
  };
}
