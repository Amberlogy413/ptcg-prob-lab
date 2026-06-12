/**
 * Luck tail (docs/02 §10): P(event never happens in n independent games)
 * = (1 − p)^n, exact. v2 golden pipeline — BigInt rationals only.
 */

import { type Rat, sub, R_ONE } from "../prob/index.ts";

/** Exact rational power for non-negative integer exponents.
 *  Direct BigInt exponentiation: base is a reduced Rat (gcd(|n|,d)=1, d>0),
 *  and gcd(a,b)=1 ⇒ gcd(aᵏ,bᵏ)=1 with dᵏ>0, so the result keeps the Rat
 *  invariants with NO gcd work — the previous k schoolbook multiplications
 *  each ran a guaranteed-no-op Euclid on ever-growing operands (math-engine
 *  audit 2026-06-12: 16 s at k=1000; this form is microseconds). */
export function ratPow(base: Rat, n: number): Rat {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`n must be a non-negative integer, got ${n}`);
  if (n === 0) return R_ONE;
  const e = BigInt(n);
  return { n: base.n ** e, d: base.d ** e };
}

/** P(0 occurrences in n games) for a per-game probability p. */
export function luckTail(p: Rat, n: number): Rat {
  return ratPow(sub(R_ONE, p), n);
}
