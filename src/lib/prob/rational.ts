/**
 * Exact rational arithmetic over BigInt.
 *
 * Invariants for every `Rat` produced by this module:
 *   - d > 0
 *   - gcd(|n|, d) === 1 (always reduced)
 *
 * This module is the foundation of the probability core. Floating point is
 * BANNED everywhere in `src/lib/prob` — floats may appear only at the final
 * display/chart layer, derived from these exact rationals.
 */

export interface Rat {
  readonly n: bigint;
  readonly d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

/** Construct a reduced rational n/d. Throws on d === 0. */
export function rat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new RangeError("rational with zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return { n: 0n, d: 1n };
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/** Convenience constructor from safe integers. */
export function ratInt(n: number, d: number = 1): Rat {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
    throw new RangeError("ratInt expects safe integers");
  }
  return rat(BigInt(n), BigInt(d));
}

export const R_ZERO: Rat = { n: 0n, d: 1n };
export const R_ONE: Rat = { n: 1n, d: 1n };

export function add(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a: Rat, b: Rat): Rat {
  return rat(a.n * b.n, a.d * b.d);
}

export function div(a: Rat, b: Rat): Rat {
  if (b.n === 0n) throw new RangeError("division by zero rational");
  return rat(a.n * b.d, a.d * b.n);
}

/** -1 if a < b, 0 if equal, 1 if a > b. Exact comparison. */
export function cmp(a: Rat, b: Rat): number {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

export function eq(a: Rat, b: Rat): boolean {
  return a.n === b.n && a.d === b.d;
}

export function isZero(a: Rat): boolean {
  return a.n === 0n;
}

/**
 * Lossy conversion for charts/sorting hints ONLY. Never feed the result back
 * into probability arithmetic.
 */
export function toNumber(a: Rat): number {
  // Scale to preserve ~15 significant digits before converting.
  const SCALE = 10n ** 18n;
  return Number((a.n * SCALE) / a.d) / 1e18;
}
