/**
 * Opening-hand mathematics.
 *
 * Q1 — distribution of Basic Pokémon in the opening 7, mulligan rate,
 *      mulligan-count distribution, and the mulligan-conditioned hand.
 * Q2 — joint distribution of up to ~5 tracked cards in the opening 7, with
 *      per-card [min, max] constraints, optionally conditioned on a valid
 *      hand (>= 1 Basic), which is what the actual game deals you.
 *
 * Exact rationals throughout. Formal derivations: docs/02_MATH_SPEC.md §3–§4.
 */

import {
  type Rat,
  rat,
  ratInt,
  R_ZERO,
  R_ONE,
  add,
  sub,
  mul,
  div,
  cmp,
  isZero,
} from "./rational.ts";
import { hypergeomPmf, multiHypergeomPmf, compositions } from "./hypergeom.ts";

// ---------------------------------------------------------------------------
// Q1 — Basics in the opening hand
// ---------------------------------------------------------------------------

export interface OpeningBasicsResult {
  /** P(exactly k Basics in 7), k = 0..H — the raw (unconditioned) deal. */
  dist: Rat[];
  /** P(mulligan) = dist[0]. */
  mulligan: Rat;
  /** P(valid hand) = 1 − mulligan. */
  valid: Rat;
  /** P(exactly k Basics | valid hand), k = 0..H (index 0 is exactly 0). */
  conditionalDist: Rat[];
  /** E[number of mulligans] = q/(1−q), q = P(mulligan). Geometric law. */
  expectedMulligans: Rat;
  /** E[Basics in 7] = 7B/60 (unconditioned; by linearity). */
  expectedBasics: Rat;
}

export function openingBasics(basics: number, N = 60, H = 7): OpeningBasicsResult {
  validateCount("basics", basics, N);
  const dist: Rat[] = [];
  for (let k = 0; k <= H; k++) dist.push(hypergeomPmf(N, basics, H, k));
  const mulligan = dist[0];
  const valid = sub(R_ONE, mulligan);
  if (isZero(valid)) {
    throw new RangeError("deck has too few Basics to ever produce a valid hand");
  }
  const conditionalDist = dist.map((p, k) => (k === 0 ? R_ZERO : div(p, valid)));
  return {
    dist,
    mulligan,
    valid,
    conditionalDist,
    expectedMulligans: div(mulligan, valid),
    expectedBasics: ratInt(H * basics, N),
  };
}

/** P(exactly m mulligans) = q^m (1 − q): geometric on the mulligan prob q. */
export function mulliganCountPmf(mulligan: Rat, m: number): Rat {
  if (m < 0 || !Number.isInteger(m)) throw new RangeError("m must be a non-negative integer");
  let p = sub(R_ONE, mulligan);
  for (let i = 0; i < m; i++) p = mul(p, mulligan);
  return p;
}

// ---------------------------------------------------------------------------
// Q2 — Tracked-card combos in the opening hand
// ---------------------------------------------------------------------------

export interface TrackedCard {
  /** Display label (UI convenience; not used in math). */
  label?: string;
  /** Copies of this card in the deck. */
  count: number;
  /** Inclusive lower bound on copies wanted in hand (0 = no requirement). */
  min: number;
  /** Inclusive upper bound on copies in hand (use H for "no cap"). */
  max: number;
  /** Whether this card is a Basic Pokémon (required for mulligan-aware mode). */
  isBasic?: boolean;
}

export interface ComboCell {
  /** Copies of each tracked card in the hand, same order as the input. */
  ks: number[];
  /** Probability of exactly this combination (under the result's conditioning). */
  p: Rat;
  /** True if this combination satisfies every [min, max] constraint. */
  satisfies: boolean;
}

export interface ComboResult {
  /** P(all constraints satisfied). Conditioned on valid hand when mulligan-aware. */
  event: Rat;
  /** Full joint table over tracked-card combinations, sorted by p descending. */
  table: ComboCell[];
  /** Present in mulligan-aware mode: P(hand contains >= 1 Basic). */
  pValid?: Rat;
  /** Present in mulligan-aware mode: the same event WITHOUT conditioning, for comparison. */
  eventUnconditioned?: Rat;
}

export interface ComboOptions {
  N?: number;
  H?: number;
  /**
   * Enable mulligan conditioning. `otherBasics` = Basics in the deck that are
   * NOT among the tracked cards. Every tracked card must then declare `isBasic`.
   */
  mulliganAware?: { otherBasics: number };
}

export function comboOpening(cards: TrackedCard[], opts: ComboOptions = {}): ComboResult {
  const N = opts.N ?? 60;
  const H = opts.H ?? 7;
  validateTracked(cards, N, H, opts.mulliganAware?.otherBasics ?? 0);

  const m = cards.length;
  const counts = cards.map((c) => c.count);
  const satisfies = (ks: readonly number[]): boolean =>
    cards.every((c, i) => ks[i] >= c.min && ks[i] <= c.max);

  if (!opts.mulliganAware) {
    let event = R_ZERO;
    const table: ComboCell[] = [];
    for (const ks of compositions(counts.map((c) => Math.min(c, H)), H)) {
      const p = multiHypergeomPmf(N, counts, H, ks);
      if (isZero(p)) continue;
      const ok = satisfies(ks);
      if (ok) event = add(event, p);
      table.push({ ks, p, satisfies: ok });
    }
    sortTable(table);
    return { event, table };
  }

  // Mulligan-aware: add "other Basics" as an explicit category, condition on
  // (Basics in hand) >= 1, then marginalise it back out for the table.
  const { otherBasics } = opts.mulliganAware;
  const flags = cards.map((c) => {
    if (c.isBasic === undefined) {
      throw new RangeError("mulligan-aware mode requires isBasic on every tracked card");
    }
    return c.isBasic;
  });
  const cats = [...counts, otherBasics];
  const maxes = cats.map((c) => Math.min(c, H));

  let pValid = R_ZERO;
  let eventAndValid = R_ZERO;
  let eventUnconditioned = R_ZERO;
  const agg = new Map<string, Rat>(); // tracked tuple -> P(tuple ∧ valid)

  for (const ks of compositions(maxes, H)) {
    const p = multiHypergeomPmf(N, cats, H, ks);
    if (isZero(p)) continue;
    const tracked = ks.slice(0, m);
    const ok = satisfies(tracked);
    if (ok) eventUnconditioned = add(eventUnconditioned, p);

    let basicsInHand = ks[m];
    for (let i = 0; i < m; i++) if (flags[i]) basicsInHand += tracked[i];
    if (basicsInHand >= 1) {
      pValid = add(pValid, p);
      if (ok) eventAndValid = add(eventAndValid, p);
      const key = tracked.join(",");
      agg.set(key, add(agg.get(key) ?? R_ZERO, p));
    }
  }

  if (isZero(pValid)) {
    throw new RangeError("deck has too few Basics to ever produce a valid hand");
  }

  const table: ComboCell[] = [];
  for (const [key, p] of agg) {
    const ks = key === "" ? [] : key.split(",").map(Number);
    table.push({ ks, p: div(p, pValid), satisfies: satisfies(ks) });
  }
  sortTable(table);

  return {
    event: div(eventAndValid, pValid),
    table,
    pValid,
    eventUnconditioned,
  };
}

// ---------------------------------------------------------------------------
// shared validation / utilities
// ---------------------------------------------------------------------------

function sortTable(table: ComboCell[]): void {
  table.sort((a, b) => {
    const c = cmp(b.p, a.p);
    if (c !== 0) return c;
    for (let i = 0; i < a.ks.length; i++) {
      if (a.ks[i] !== b.ks[i]) return a.ks[i] - b.ks[i];
    }
    return 0;
  });
}

function validateCount(name: string, v: number, N: number): void {
  if (!Number.isInteger(v) || v < 0 || v > N) {
    throw new RangeError(`${name} must be an integer in [0, ${N}], got ${v}`);
  }
}

function validateTracked(cards: TrackedCard[], N: number, H: number, otherBasics: number): void {
  if (cards.length === 0) throw new RangeError("at least one tracked card is required");
  let total = otherBasics;
  for (const c of cards) {
    validateCount(`count of "${c.label ?? "card"}"`, c.count, N);
    if (!Number.isInteger(c.min) || !Number.isInteger(c.max) || c.min < 0 || c.max < c.min) {
      throw new RangeError(`invalid [min, max] = [${c.min}, ${c.max}]`);
    }
    if (c.min > Math.min(c.count, H)) {
      // Not an error — the event is simply impossible — but flag loudly in dev.
      // P will come out exactly 0 from the enumeration.
    }
    total += c.count;
  }
  if (total > N) {
    throw new RangeError(`tracked counts (+ other Basics) exceed deck size: ${total} > ${N}`);
  }
}

/** Exact sum of an event over a pmf table — handy for derived UI queries. */
export function sumWhere(table: ComboCell[], pred: (ks: number[]) => boolean): Rat {
  let s = R_ZERO;
  for (const cell of table) if (pred(cell.ks)) s = add(s, cell.p);
  return s;
}

/** Expected value Σ k·p over a univariate distribution array (index = k). */
export function expectation(dist: readonly Rat[]): Rat {
  let e = R_ZERO;
  for (let k = 1; k < dist.length; k++) e = add(e, mul(rat(BigInt(k)), dist[k]));
  return e;
}
