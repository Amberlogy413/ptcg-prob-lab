/**
 * Luck tail (docs/02 §10): P(event never happens in n independent games)
 * = (1 − p)^n, exact. v2 golden pipeline — BigInt rationals only.
 */

import { type Rat, sub, mul, R_ONE } from "../prob/index.ts";

/** Exact rational power for small non-negative integer exponents. */
export function ratPow(base: Rat, n: number): Rat {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`n must be a non-negative integer, got ${n}`);
  let out = R_ONE;
  for (let i = 0; i < n; i++) out = mul(out, base);
  return out;
}

/** P(0 occurrences in n games) for a per-game probability p. */
export function luckTail(p: Rat, n: number): Rat {
  return ratPow(sub(R_ONE, p), n);
}
