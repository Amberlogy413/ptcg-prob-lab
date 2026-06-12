/**
 * Energy shortfall curve, mulligan-aware (docs/02 §6.4) — v2 golden pipeline.
 *
 * Same discipline as src/lib/prob: probabilities exist ONLY as BigInt
 * rationals; no floats, no Math.* on probabilities. This module lives outside
 * the protected seed core and is verified character-exact against the
 * INDEPENDENT Python reference (scripts/generate_golden_v2.py →
 * tests/golden/golden_vectors_v2.json).
 */

import {
  type Rat,
  rat,
  add,
  mul,
  div,
  isZero,
  R_ZERO,
  binom,
} from "../prob/index.ts";

export interface EnergyCurvePoint {
  nSeen: number;
  /** P(total energy seen < want | valid opening hand). */
  p: Rat;
}

export interface EnergyCurveResult {
  pValid: Rat;
  points: EnergyCurvePoint[];
}

/**
 * P(energy seen < want | hand has ≥1 Basic) for each nSeen.
 * Categories are disjoint: E energy, B Basics, rest = N − E − B.
 */
export function energyShortfallCurve(
  E: number,
  B: number,
  want: number,
  nSeenList: number[],
  N = 60,
  H = 7,
): EnergyCurveResult {
  if (!Number.isInteger(E) || !Number.isInteger(B) || E < 0 || B < 0 || E + B > N) {
    throw new RangeError(`invalid categories E=${E}, B=${B} for N=${N}`);
  }
  if (B < 1) throw new RangeError("mulligan conditioning requires at least 1 Basic");
  if (!Number.isInteger(want) || want < 1) throw new RangeError(`want must be >= 1, got ${want}`);

  const R = N - E - B;
  const totalHand = binom(N, H);
  const M = N - H;

  // Hand pmf over (e, b), plus p_valid.
  interface HandCell {
    e: number;
    p: Rat;
  }
  const validCells: HandCell[] = [];
  let pValid = R_ZERO;
  for (let e = 0; e <= Math.min(E, H); e++) {
    for (let b = 1; b <= Math.min(B, H - e); b++) {
      const r = H - e - b;
      if (r < 0 || r > R) continue;
      const ph = rat(binom(E, e) * binom(B, b) * binom(R, r), totalHand);
      if (isZero(ph)) continue;
      pValid = add(pValid, ph);
      validCells.push({ e, p: ph });
    }
  }
  if (isZero(pValid)) throw new RangeError("deck can never produce a valid hand");

  const points: EnergyCurvePoint[] = nSeenList.map((nSeen) => {
    if (!Number.isInteger(nSeen) || nSeen < H || nSeen > N) {
      throw new RangeError(`nSeen must be in [${H}, ${N}], got ${nSeen}`);
    }
    const d = nSeen - H;
    const totalDraw = binom(M, d);
    let shortAndValid = R_ZERO;
    for (const cell of validCells) {
      const remE = E - cell.e;
      let inner = R_ZERO;
      for (let j = 0; j <= Math.min(remE, d); j++) {
        if (cell.e + j >= want) continue;
        inner = add(inner, rat(binom(remE, j) * binom(M - remE, d - j), totalDraw));
      }
      shortAndValid = add(shortAndValid, mul(cell.p, inner));
    }
    return { nSeen, p: div(shortAndValid, pValid) };
  });

  return { pValid, points };
}
