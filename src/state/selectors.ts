/**
 * The only bridge between UI and the exact math core (docs/03 §10):
 * components consume preformatted display strings; no math in the UI layer.
 * Probabilities stay BigInt rationals inside the core; the strings below are
 * produced exclusively by src/lib/prob/format.ts.
 */

import { openingBasics, percentStr, fractionStr, oneInStr, decimalStr, toChartNumber } from "../lib/prob/index.ts";
import { deckTotal, deckBasics, type Deck } from "./deckStore.ts";
import { HAND_SIZE } from "../constants.ts";

export interface MulliganSummaryData {
  /** P(mulligan), three formats (docs/02 §7). */
  percent: string;
  fraction: string;
  oneIn: string;
  /** P(mulligan) as float, chart/gauge use only. */
  chart: number;
  /** P(valid opening hand) = 1 − mulligan. */
  validPercent: string;
  /** E[number of mulligans], 6-place round-half-up decimal. */
  expectedMulligans: string;
}

export interface DeckSummaryData {
  total: number;
  basics: number;
  status: "ok" | "tooFewCards" | "noBasics";
  mulligan?: MulliganSummaryData;
}

export function computeDeckSummary(deck: Deck): DeckSummaryData {
  const total = deckTotal(deck);
  const basics = deckBasics(deck);
  if (total < HAND_SIZE) return { total, basics, status: "tooFewCards" };
  if (basics < 1) return { total, basics, status: "noBasics" };
  const r = openingBasics(basics, total, HAND_SIZE);
  return {
    total,
    basics,
    status: "ok",
    mulligan: {
      percent: percentStr(r.mulligan, 6),
      fraction: fractionStr(r.mulligan),
      oneIn: oneInStr(r.mulligan, 3),
      chart: toChartNumber(r.mulligan),
      validPercent: percentStr(r.valid, 6),
      expectedMulligans: decimalStr(r.expectedMulligans, 6),
    },
  };
}
