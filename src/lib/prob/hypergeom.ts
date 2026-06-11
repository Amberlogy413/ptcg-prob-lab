/**
 * Hypergeometric machinery — the mathematical heart of the app.
 *
 * Univariate:    drawing n from N where K are "successes".
 * Multivariate:  the deck is partitioned into tracked categories plus an
 *                implicit "everything else" category.
 *
 * All results are exact `Rat` values. See docs/02_MATH_SPEC.md.
 */

import { type Rat, rat, R_ZERO, R_ONE, add, sub } from "./rational.ts";
import { binom } from "./binomial.ts";

/** P(X = k), X ~ Hypergeometric(N, K, n). */
export function hypergeomPmf(N: number, K: number, n: number, k: number): Rat {
  if (k < 0 || k > n || k > K || n - k > N - K) return R_ZERO;
  return rat(binom(K, k) * binom(N - K, n - k), binom(N, n));
}

/** P(X <= k). */
export function hypergeomAtMost(N: number, K: number, n: number, k: number): Rat {
  let s = R_ZERO;
  const hi = Math.min(k, K, n);
  for (let i = 0; i <= hi; i++) s = add(s, hypergeomPmf(N, K, n, i));
  return s;
}

/** P(X >= k). Computed as 1 − P(X <= k−1) for exact complementarity. */
export function hypergeomAtLeast(N: number, K: number, n: number, k: number): Rat {
  if (k <= 0) return R_ONE;
  return sub(R_ONE, hypergeomAtMost(N, K, n, k - 1));
}

/**
 * Multivariate hypergeometric pmf with an implicit "other" category.
 *
 * @param N      population size (e.g. 60)
 * @param counts copies of each tracked category in the population
 * @param n      number of cards drawn (e.g. 7 or 6)
 * @param ks     copies of each tracked category among the drawn cards
 */
export function multiHypergeomPmf(
  N: number,
  counts: readonly number[],
  n: number,
  ks: readonly number[],
): Rat {
  if (counts.length !== ks.length) {
    throw new RangeError("counts and ks must have the same length");
  }
  let sumCounts = 0;
  let drawn = 0;
  for (let i = 0; i < counts.length; i++) {
    sumCounts += counts[i];
    drawn += ks[i];
  }
  const other = N - sumCounts;
  if (other < 0) throw new RangeError("category counts exceed population size");
  const rest = n - drawn;
  if (rest < 0 || rest > other) return R_ZERO;
  let num = 1n;
  for (let i = 0; i < counts.length; i++) {
    if (ks[i] < 0 || ks[i] > counts[i]) return R_ZERO;
    num *= binom(counts[i], ks[i]);
  }
  num *= binom(other, rest);
  return rat(num, binom(N, n));
}

/**
 * Enumerate every tuple `ks` with 0 <= ks[i] <= maxes[i] and sum(ks) <= total.
 * The implicit "other" category absorbs the remaining draws.
 *
 * Complexity is bounded by Π(maxes[i]+1) and pruned by the running total; for
 * this app's domain (<= ~5 tracked cards, totals of 6–13) it is trivially fast.
 */
export function* compositions(
  maxes: readonly number[],
  total: number,
): Generator<number[]> {
  const acc: number[] = [];
  function* rec(i: number, remaining: number): Generator<number[]> {
    if (i === maxes.length) {
      yield acc.slice();
      return;
    }
    const cap = Math.min(maxes[i], remaining);
    for (let k = 0; k <= cap; k++) {
      acc.push(k);
      yield* rec(i + 1, remaining - k);
      acc.pop();
    }
  }
  yield* rec(0, total);
}
