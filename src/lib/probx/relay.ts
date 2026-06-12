/**
 * Multi-turn relay event (docs/02 §6.5) — v2 golden pipeline.
 * P(≥wA copies of A among the first n1 cards seen AND ≥wB copies of B among
 * the first n2), n1 ≤ n2, by nested-window exchangeability. Unconditioned on
 * mulligans (§6.3 honesty note applies). BigInt rationals only.
 */

import {
  type Rat,
  add,
  mul,
  R_ZERO,
  isZero,
  multiHypergeomPmf,
  hypergeomAtLeast,
} from "../prob/index.ts";

export function relayEvent(
  cA: number,
  cB: number,
  wA: number,
  wB: number,
  n1: number,
  n2: number,
  N = 60,
): Rat {
  if (!Number.isInteger(n1) || !Number.isInteger(n2) || n1 < 0 || n1 > n2 || n2 > N) {
    throw new RangeError(`invalid windows n1=${n1}, n2=${n2} for N=${N}`);
  }
  if (cA + cB > N) throw new RangeError("tracked counts exceed deck size");

  let acc = R_ZERO;
  for (let a1 = Math.max(wA, 0); a1 <= Math.min(cA, n1); a1++) {
    for (let b1 = 0; b1 <= Math.min(cB, n1 - a1); b1++) {
      const ph = multiHypergeomPmf(N, [cA, cB], n1, [a1, b1]);
      if (isZero(ph)) continue;
      const tail = hypergeomAtLeast(N - n1, cB - b1, n2 - n1, Math.max(wB - b1, 0));
      acc = add(acc, mul(ph, tail));
    }
  }
  return acc;
}
