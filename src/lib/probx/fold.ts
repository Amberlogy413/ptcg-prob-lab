/**
 * Search-chain fold (docs/02 §4.3) — v2 golden pipeline.
 * Optimistic: a searcher counts as the target (k_x + k_s ≥ w).
 * Conservative: searchers count for nothing (k_x ≥ w).
 * Both conditioned on a valid opening hand; searchers are never Basics.
 * BigInt rationals only.
 */

import {
  type Rat,
  add,
  div,
  R_ZERO,
  isZero,
  multiHypergeomPmf,
} from "../prob/index.ts";

export interface SearchFoldResult {
  optimistic: Rat;
  conservative: Rat;
  pValid: Rat;
}

export function searchFoldValid(
  x: number,
  xBasic: boolean,
  s: number,
  otherBasics: number,
  want: number,
  N = 60,
  H = 7,
): SearchFoldResult {
  if (x < 0 || s < 0 || otherBasics < 0 || x + s + otherBasics > N) {
    throw new RangeError("category counts exceed deck size");
  }
  if (!xBasic && otherBasics < 1) {
    throw new RangeError("mulligan conditioning requires at least 1 Basic");
  }

  let pValid = R_ZERO;
  let pOpt = R_ZERO;
  let pCon = R_ZERO;

  for (let kx = 0; kx <= Math.min(x, H); kx++) {
    for (let ks = 0; ks <= Math.min(s, H - kx); ks++) {
      for (let j = 0; j <= Math.min(otherBasics, H - kx - ks); j++) {
        const ph = multiHypergeomPmf(N, [x, s, otherBasics], H, [kx, ks, j]);
        if (isZero(ph)) continue;
        const basics = (xBasic ? kx : 0) + j;
        if (basics < 1) continue;
        pValid = add(pValid, ph);
        if (kx + ks >= want) pOpt = add(pOpt, ph);
        if (kx >= want) pCon = add(pCon, ph);
      }
    }
  }
  if (isZero(pValid)) throw new RangeError("deck can never produce a valid hand");
  return {
    optimistic: div(pOpt, pValid),
    conservative: div(pCon, pValid),
    pValid,
  };
}
