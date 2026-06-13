/**
 * Shuffle-back redraw (奇樹/裁判; docs/09 #53, math audit 2026-06-12).
 *
 * Three populations: the D unknown deck cards — a uniform D-subset of the
 * unseen pool U (|U| = D + p, p facedown prizes; docs/02 §5.5 family) — the
 * h KNOWN hand cards shuffled back into the deck, and then `draw` cards
 * drawn from the new D + h deck. For tracked categories with `unseen` copies
 * in U and `returned` copies in the shuffled-back hand:
 *
 *   P(event) = Σ_js multiHG(u, unseen, D, js)
 *              · Σ_{ks: mins ≤ ks ≤ maxs} multiHG(D+h, js+returned, draw, ks)
 *
 * Built only from the seed core's multivariate hypergeometric; the v2 golden
 * pipeline cross-verifies against the independent Python (h=0 and p=0
 * degenerations are asserted there). BigInt rationals only.
 */

import { type Rat, add, mul, eq, R_ZERO, R_ONE, multiHypergeomPmf } from "../prob/index.ts";

export interface ShuffleBackParams {
  /** Unknown cards left in the deck before the shuffle. */
  D: number;
  /** Facedown prizes (the rest of the unseen pool). */
  p: number;
  /** Per-category copies among the unseen pool U = deck + prizes. */
  unseen: readonly number[];
  /** Per-category copies among the returned (shuffled-back) hand. */
  returned: readonly number[];
  /** Total returned hand size (≥ Σ returned). */
  h: number;
  /** Cards drawn from the new D + h deck. */
  draw: number;
  /** Per-category inclusive bounds on the drawn counts. */
  mins: readonly number[];
  maxs: readonly number[];
}

function enumVectors(maxes: number[], cap: number): number[][] {
  const out: number[][] = [];
  const acc: number[] = [];
  const rec = (i: number, sum: number): void => {
    if (i === maxes.length) {
      out.push([...acc]);
      return;
    }
    const top = Math.min(maxes[i] ?? 0, cap - sum);
    for (let v = 0; v <= top; v++) {
      acc.push(v);
      rec(i + 1, sum + v);
      acc.pop();
    }
  };
  rec(0, 0);
  return out;
}

export function shuffleBackRedraw(params: ShuffleBackParams): Rat {
  const { D, p, unseen, returned, h, draw, mins, maxs } = params;
  const m = unseen.length;
  if (returned.length !== m || mins.length !== m || maxs.length !== m) {
    throw new RangeError("category arrays must share one length");
  }
  for (const v of [D, p, h, draw, ...unseen, ...returned, ...mins, ...maxs]) {
    if (!Number.isInteger(v) || v < 0) throw new RangeError("parameters must be non-negative integers");
  }
  const u = D + p;
  const sumUnseen = unseen.reduce((s, x) => s + x, 0);
  const sumReturned = returned.reduce((s, x) => s + x, 0);
  if (u < 1) throw new RangeError("unseen pool must be ≥ 1");
  if (sumUnseen > u) throw new RangeError(`unseen copies exceed the pool: ${sumUnseen} > ${u}`);
  if (sumReturned > h) throw new RangeError(`returned copies exceed the hand: ${sumReturned} > ${h}`);
  if (draw < 1 || draw > D + h) throw new RangeError(`draw out of range: ${draw}, deck = ${D + h}`);

  let total = R_ZERO;
  let norm = R_ZERO;
  for (const js of enumVectors(unseen.map((x) => Math.min(x, D)), D)) {
    const pj = multiHypergeomPmf(u, unseen, D, js);
    if (eq(pj, R_ZERO)) continue;
    norm = add(norm, pj);
    const merged = js.map((j, i) => j + (returned[i] ?? 0));
    let inner = R_ZERO;
    for (const ks of enumVectors(merged.map((x) => Math.min(x, draw)), draw)) {
      const ok = ks.every((k, i) => k >= (mins[i] ?? 0) && k <= (maxs[i] ?? draw));
      if (!ok) continue;
      const q = multiHypergeomPmf(D + h, merged, draw, ks);
      if (!eq(q, R_ZERO)) inner = add(inner, q);
    }
    total = add(total, mul(pj, inner));
  }
  if (!eq(norm, R_ONE)) throw new Error("deck-split mixture must sum to 1");
  return total;
}
