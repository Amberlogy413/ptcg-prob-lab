/**
 * Display formatting for exact rationals.
 *
 * This is the ONLY sanctioned bridge from exact `Rat` values to strings shown
 * in the UI. All rounding happens here, in BigInt, with round-half-up
 * semantics — never via JavaScript floats. The golden vectors' `*_dec` fields
 * were produced by an independent Python implementation of the same rule, so
 * `decimalStr(r, 15)` must reproduce them character-for-character.
 */

import { type Rat, rat, div, R_ONE, isZero } from "./rational.ts";

/** "n/d" with the sign on the numerator (Rat invariant guarantees d > 0). */
export function fractionStr(r: Rat): string {
  return `${r.n.toString()}/${r.d.toString()}`;
}

/**
 * Exact decimal string with `places` digits after the point, round-half-up
 * (ties away from zero). places = 0 yields an integer string with no point.
 */
export function decimalStr(r: Rat, places: number): string {
  if (!Number.isInteger(places) || places < 0) {
    throw new RangeError(`places must be a non-negative integer, got ${places}`);
  }
  const neg = r.n < 0n;
  const n = neg ? -r.n : r.n;
  const scale = 10n ** BigInt(places);
  let q = (n * scale) / r.d;
  const rem = (n * scale) % r.d;
  if (rem * 2n >= r.d) q += 1n; // round half up (away from zero)
  let s = q.toString();
  if (places > 0) {
    if (s.length <= places) s = s.padStart(places + 1, "0");
    s = `${s.slice(0, -places)}.${s.slice(-places)}`;
  }
  return neg && q !== 0n ? `-${s}` : s;
}

/** decimalStr of 100·r, suffixed with '%'. */
export function percentStr(r: Rat, places = 4): string {
  return `${decimalStr(rat(r.n * 100n, r.d), places)}%`;
}

/**
 * "1 in N" odds string (N = d/n rounded to `places`). Returns "—" for a
 * zero probability, where the phrase has no meaning.
 */
export function oneInStr(r: Rat, places = 1): string {
  if (isZero(r)) return "—";
  return `1 in ${decimalStr(div(R_ONE, r), places)}`;
}

/**
 * Approximate float for charts ONLY. Centralised so any future precision
 * audit has a single choke point to inspect.
 */
export function toChartNumber(r: Rat): number {
  return Number(decimalStr(r, 15));
}
