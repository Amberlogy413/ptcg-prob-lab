/**
 * Exact binomial coefficients C(n, k) over BigInt, with memoization.
 *
 * Outside the support (k < 0, k > n, n < 0) the coefficient is 0n — this is
 * deliberate and lets hypergeometric formulas handle impossible draws
 * uniformly without special-casing.
 */

const cache = new Map<string, bigint>();

export function binom(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k)) {
    throw new RangeError(`binom expects integers, got C(${n}, ${k})`);
  }
  if (n < 0 || k < 0 || k > n) return 0n;
  const kk = Math.min(k, n - k);
  if (kk === 0) return 1n;
  const key = `${n},${kk}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // Multiplicative formula: numerator = n·(n−1)…(n−kk+1), denominator = kk!.
  // The final division is exact (binomials are integers).
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= kk; i++) {
    num *= BigInt(n - kk + i);
    den *= BigInt(i);
  }
  const v = num / den;
  cache.set(key, v);
  return v;
}
