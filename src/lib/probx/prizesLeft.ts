/**
 * Tracker v2 posterior (docs/09 #52, math audit 2026-06-12): after k prizes
 * are taken, the remaining p = 6 − k facedown prizes are a uniform p-subset
 * of the unseen pool U (docs/02 §5.5 family). Everything below is the same
 * hypergeometric with P parameterized to p — no new formulas; the v2 golden
 * pipeline cross-verifies against the independent Python.
 *
 * BigInt rationals only.
 */

import { type Rat, rat, sub, R_ONE, R_ZERO, prizeDistUnconditional } from "../prob/index.ts";

export interface PrizePosterior {
  /** P(exactly j of the unseen copies are prized), j = 0..min(ux, p). */
  dist: Rat[];
  /** E[prized copies] = p·ux/u. */
  e: Rat;
  /** P(at least one copy still in the deck) = 1 − P(all ux prized). */
  still: Rat;
  /** P(the next library draw is this card) = ux/u (§5.5 exchangeability). */
  next: Rat;
  /** P(at least one copy prized) = 1 − dist[0]. */
  atLeastOne: Rat;
}

export function prizePosterior(u: number, ux: number, p: number): PrizePosterior {
  if (!Number.isInteger(u) || !Number.isInteger(ux) || !Number.isInteger(p)) {
    throw new RangeError("prizePosterior parameters must be integers");
  }
  if (u < 1) throw new RangeError(`unseen pool must be ≥ 1, got u=${u}`);
  if (ux < 0 || ux > u) throw new RangeError(`unseen copies out of range: ux=${ux}, u=${u}`);
  if (p < 0 || p > u) throw new RangeError(`prizes left out of range: p=${p}, u=${u}`);
  const dist = prizeDistUnconditional(ux, u, p);
  const e = rat(BigInt(p * ux), BigInt(u));
  const allPrized = ux <= p ? (dist[ux] as Rat) : R_ZERO;
  return {
    dist,
    e,
    still: sub(R_ONE, allPrized),
    next: rat(BigInt(ux), BigInt(u)),
    atLeastOne: sub(R_ONE, dist[0] as Rat),
  };
}
