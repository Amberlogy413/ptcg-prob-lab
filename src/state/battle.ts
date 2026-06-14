/**
 * Battle sandbox math bridge — the live "draw N → hit it" odds for the board.
 * P(draw at least one of K target copies within the next n cards from a deck of
 * N) is exact hypergeometric, straight from the protected core. The UI never
 * calls the core directly; it goes through here (docs/03 §9).
 */

import { hypergeomAtLeast, percentStr, fractionStr, oneInStr, toChartNumber } from "../lib/prob/index.ts";

export interface DrawOdds {
  /** P(≥1 of the target in the next n draws), three formats + chart float. */
  percent: string;
  fraction: string;
  oneIn: string;
  chart: number;
  /** Echoed inputs for the math receipt. */
  deckSize: number;
  targetCount: number;
  draws: number;
}

/** Exact P(≥1 target in next `draws` from a `deckSize` deck holding `targetCount`). */
export function computeDrawOdds(deckSize: number, targetCount: number, draws: number): DrawOdds {
  const N = Math.max(0, Math.trunc(deckSize));
  const K = Math.max(0, Math.min(Math.trunc(targetCount), N));
  const n = Math.max(0, Math.min(Math.trunc(draws), N));
  // hypergeomAtLeast(N,K,n,1) handles K=0 / n=0 as 0; guard N=0 with a 1-card 0.
  const p = N === 0 ? hypergeomAtLeast(1, 0, 0, 1) : hypergeomAtLeast(N, K, n, 1);
  return {
    percent: percentStr(p, 4),
    fraction: fractionStr(p),
    oneIn: oneInStr(p, 2),
    chart: toChartNumber(p),
    deckSize: N,
    targetCount: K,
    draws: n,
  };
}
