/**
 * Prize-card mathematics (Q3).
 *
 * Setup model: a valid 7-card hand is kept, then the 6 prizes are the top 6 of
 * the remaining 53 — i.e. a uniform 6-subset of the 53 unseen cards.
 *
 * Three rigours of answer, from least to most informed:
 *
 *  (a) Unconditional — you know nothing about the hand. By exchangeability the
 *      prizes are a uniform 6-subset of all 60 (proof: docs/02_MATH_SPEC.md §5.2),
 *      so P(k of X prized) = C(x,k)·C(60−x,6−k)/C(60,6).
 *
 *  (b) Given your hand — you see h copies of X among your 7. Prizes are then
 *      hypergeometric from the remaining 53 with x−h copies left.
 *
 *  (c) Pre-game, mulligan-aware — the marginal over hands, conditioned on the
 *      hand being valid (>= 1 Basic). This is the true pre-game number the
 *      game's own rules produce, and it differs measurably from (a).
 *
 * Exact rationals throughout. Derivations: docs/02_MATH_SPEC.md §5.
 */

import {
  type Rat,
  rat,
  R_ZERO,
  R_ONE,
  add,
  sub,
  mul,
  div,
  isZero,
} from "./rational.ts";
import { hypergeomPmf, multiHypergeomPmf, compositions } from "./hypergeom.ts";
import { type ComboCell, expectation } from "./opening.ts";

// ---------------------------------------------------------------------------
// (a) Unconditional marginal
// ---------------------------------------------------------------------------

/** P(exactly k of card X among the 6 prizes), no information. k = 0..min(x, P). */
export function prizeDistUnconditional(x: number, N = 60, P = 6): Rat[] {
  const dist: Rat[] = [];
  for (let k = 0; k <= Math.min(x, P); k++) dist.push(hypergeomPmf(N, x, P, k));
  return dist;
}

// ---------------------------------------------------------------------------
// (b) Conditional on your actual hand
// ---------------------------------------------------------------------------

/**
 * P(exactly k of card X prized | exactly `inHand` copies of X in the kept hand).
 * k = 0..min(x − inHand, P).
 */
export function prizeDistGivenHand(
  x: number,
  inHand: number,
  N = 60,
  H = 7,
  P = 6,
): Rat[] {
  if (inHand < 0 || inHand > Math.min(x, H)) {
    throw new RangeError(`inHand must be in [0, min(${x}, ${H})], got ${inHand}`);
  }
  const remaining = x - inHand;
  const M = N - H;
  const dist: Rat[] = [];
  for (let k = 0; k <= Math.min(remaining, P); k++) {
    dist.push(hypergeomPmf(M, remaining, P, k));
  }
  return dist;
}

// ---------------------------------------------------------------------------
// (c) Pre-game, optionally mulligan-aware
// ---------------------------------------------------------------------------

export interface PrizePreGameOptions {
  /** Is card X itself a Basic Pokémon? */
  isBasic: boolean;
  /** Basics in the deck other than the copies of X. */
  otherBasics: number;
  /** Condition on the kept hand being valid (>= 1 Basic). */
  conditionOnValid: boolean;
  N?: number;
  H?: number;
  P?: number;
}

export interface PrizePreGameResult {
  /** P(exactly k of X prized), k = 0..min(x, P), under the chosen conditioning. */
  dist: Rat[];
  /** E[copies of X prized]. Unconditioned this equals P·x/N exactly. */
  expected: Rat;
  /** P(at least 1 copy prized) = 1 − dist[0]. */
  atLeastOne: Rat;
  /** Present when conditioning: P(valid hand). */
  pValid?: Rat;
}

export function prizeDistPreGame(x: number, opts: PrizePreGameOptions): PrizePreGameResult {
  const N = opts.N ?? 60;
  const H = opts.H ?? 7;
  const P = opts.P ?? 6;
  const { isBasic, otherBasics, conditionOnValid } = opts;
  if (x + otherBasics > N) throw new RangeError("x + otherBasics exceeds deck size");

  const M = N - H;
  let dist: Rat[] = Array.from({ length: Math.min(x, P) + 1 }, () => R_ZERO);
  let pValid = R_ZERO;

  for (let hX = 0; hX <= Math.min(x, H); hX++) {
    for (let hB = 0; hB <= Math.min(otherBasics, H - hX); hB++) {
      const ph = multiHypergeomPmf(N, [x, otherBasics], H, [hX, hB]);
      if (isZero(ph)) continue;
      const basics = (isBasic ? hX : 0) + hB;
      if (conditionOnValid && basics < 1) continue;
      pValid = add(pValid, ph);
      const remX = x - hX;
      for (let k = 0; k <= Math.min(remX, P); k++) {
        dist[k] = add(dist[k], mul(ph, hypergeomPmf(M, remX, P, k)));
      }
    }
  }

  if (conditionOnValid) {
    if (isZero(pValid)) {
      throw new RangeError("deck has too few Basics to ever produce a valid hand");
    }
    dist = dist.map((d) => div(d, pValid));
  }

  return {
    dist,
    expected: expectation(dist),
    atLeastOne: sub(R_ONE, dist[0]),
    ...(conditionOnValid ? { pValid } : {}),
  };
}

// ---------------------------------------------------------------------------
// Joint prize distribution over multiple tracked cards, given the hand
// ---------------------------------------------------------------------------

export interface PrizeTrackedCard {
  label?: string;
  /** Copies of this card in the 60-card deck. */
  count: number;
  /** Copies of this card in the kept 7-card hand. */
  inHand: number;
  /** Inclusive lower bound on copies wanted IN PRIZES (0 = no requirement). */
  min: number;
  /** Inclusive upper bound on copies in prizes (use P for "no cap"). */
  max: number;
}

export interface PrizeJointResult {
  /** P(every [min, max] prize constraint satisfied | the given hand). */
  event: Rat;
  /** Full joint table over prize combinations of the tracked cards, p desc. */
  table: ComboCell[];
}

export function prizeJointGivenHand(
  cards: PrizeTrackedCard[],
  opts: { N?: number; H?: number; P?: number } = {},
): PrizeJointResult {
  const N = opts.N ?? 60;
  const H = opts.H ?? 7;
  const P = opts.P ?? 6;
  if (cards.length === 0) throw new RangeError("at least one tracked card is required");

  const remaining = cards.map((c) => {
    if (!Number.isInteger(c.count) || c.count < 0 || c.count > N) {
      throw new RangeError(`invalid count ${c.count}`);
    }
    if (!Number.isInteger(c.inHand) || c.inHand < 0 || c.inHand > Math.min(c.count, H)) {
      throw new RangeError(`invalid inHand ${c.inHand} for count ${c.count}`);
    }
    return c.count - c.inHand;
  });
  const totalRemaining = remaining.reduce((a, b) => a + b, 0);
  const M = N - H;
  if (totalRemaining > M) throw new RangeError("tracked remaining copies exceed unseen pile");

  const satisfies = (ks: readonly number[]): boolean =>
    cards.every((c, i) => ks[i] >= c.min && ks[i] <= c.max);

  let event = R_ZERO;
  const table: ComboCell[] = [];
  for (const ks of compositions(remaining.map((r) => Math.min(r, P)), P)) {
    const p = multiHypergeomPmf(M, remaining, P, ks);
    if (isZero(p)) continue;
    const ok = satisfies(ks);
    if (ok) event = add(event, p);
    table.push({ ks, p, satisfies: ok });
  }
  table.sort((a, b) => {
    const c = b.p.n * a.p.d - a.p.n * b.p.d > 0n ? 1 : b.p.n * a.p.d === a.p.n * b.p.d ? 0 : -1;
    if (c !== 0) return c;
    for (let i = 0; i < a.ks.length; i++) if (a.ks[i] !== b.ks[i]) return a.ks[i] - b.ks[i];
    return 0;
  });
  return { event, table };
}

/** Convenience: P(at least one copy of X prized) from any prize distribution. */
export function atLeastOnePrized(dist: readonly Rat[]): Rat {
  return sub(R_ONE, dist[0] ?? R_ONE);
}

/** Exact sanity value: unconditional E[prized copies of X] = P·x/N. */
export function expectedPrizedUnconditional(x: number, N = 60, P = 6): Rat {
  return rat(BigInt(P * x), BigInt(N));
}
