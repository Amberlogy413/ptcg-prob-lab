/**
 * Mulligan-aware "seen by turn" curve (docs/02 §6.3 debt; math audit
 * 2026-06-12) — P(seen ≥ want of the target by nSeen | hand has ≥ 1 Basic).
 *
 * Categories are disjoint: x (target), otherBasics (the OTHER Basics),
 * rest = N − x − otherBasics. Validity counts the target itself only when it
 * is a Basic. This recombines two proven probx patterns — the validity rule
 * of searchFoldValid and the hand-then-draws mixture of energyShortfallCurve
 * — with no new mathematical ideas. Cross-verified character-exact against
 * the independent Python (golden v2 kind `seen_curve_valid`), whose own
 * self-checks pin it to the unconditioned formula (exchangeability) and to
 * the energy-curve complement for non-Basic targets.
 *
 * BigInt rationals only.
 */

import { type Rat, rat, add, mul, div, isZero, R_ZERO, R_ONE, binom } from "../prob/index.ts";

export interface SeenCurvePoint {
  nSeen: number;
  /** P(seen ≥ want of the target by nSeen | valid opening hand). */
  p: Rat;
}

export interface SeenCurveResult {
  pValid: Rat;
  points: SeenCurvePoint[];
}

export function seenCurveValid(
  x: number,
  xBasic: boolean,
  otherBasics: number,
  want: number,
  nSeenList: number[],
  N = 60,
  H = 7,
): SeenCurveResult {
  if (!Number.isInteger(x) || !Number.isInteger(otherBasics) || x < 0 || otherBasics < 0) {
    throw new RangeError(`invalid categories x=${x}, otherBasics=${otherBasics}`);
  }
  if (x + otherBasics > N) throw new RangeError(`categories exceed deck size ${N}`);
  if (!xBasic && otherBasics < 1) {
    throw new RangeError("mulligan conditioning requires at least 1 Basic");
  }
  if (!Number.isInteger(want) || want < 1) throw new RangeError(`want must be >= 1, got ${want}`);

  const R = N - x - otherBasics;
  const totalHand = binom(N, H);
  const M = N - H;

  // Hand pmf over (kx, kb) restricted to VALID hands, plus p_valid.
  interface HandCell {
    kx: number;
    p: Rat;
  }
  const validCells: HandCell[] = [];
  let pValid = R_ZERO;
  for (let kx = 0; kx <= Math.min(x, H); kx++) {
    for (let kb = 0; kb <= Math.min(otherBasics, H - kx); kb++) {
      const kr = H - kx - kb;
      if (kr < 0 || kr > R) continue;
      const basics = (xBasic ? kx : 0) + kb;
      if (basics < 1) continue;
      const ph = rat(binom(x, kx) * binom(otherBasics, kb) * binom(R, kr), totalHand);
      if (isZero(ph)) continue;
      pValid = add(pValid, ph);
      validCells.push({ kx, p: ph });
    }
  }
  if (isZero(pValid)) throw new RangeError("deck can never produce a valid hand");

  const points: SeenCurvePoint[] = nSeenList.map((nSeen) => {
    if (!Number.isInteger(nSeen) || nSeen < H || nSeen > N) {
      throw new RangeError(`nSeen must be in [${H}, ${N}], got ${nSeen}`);
    }
    const d = nSeen - H;
    const totalDraw = binom(M, d);
    let seenAndValid = R_ZERO;
    for (const cell of validCells) {
      const remX = x - cell.kx;
      const need = want - cell.kx;
      let inner: Rat;
      if (need <= 0) {
        inner = R_ONE; // hand already holds enough copies
      } else {
        inner = R_ZERO;
        for (let jx = need; jx <= Math.min(remX, d); jx++) {
          inner = add(inner, rat(binom(remX, jx) * binom(M - remX, d - jx), totalDraw));
        }
      }
      seenAndValid = add(seenAndValid, mul(cell.p, inner));
    }
    return { nSeen, p: div(seenAndValid, pValid) };
  });

  return { pValid, points };
}
