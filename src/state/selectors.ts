/**
 * The only bridge between UI and the exact math core (docs/03 §10):
 * components consume preformatted display strings; no math in the UI layer.
 * Probabilities stay BigInt rationals inside the core; the strings below are
 * produced exclusively by src/lib/prob/format.ts.
 */

import {
  openingBasics,
  mulliganCountPmf,
  binom,
  add,
  eq,
  isZero,
  div,
  R_ZERO,
  R_ONE,
  percentStr,
  fractionStr,
  oneInStr,
  decimalStr,
  toChartNumber,
  type Rat,
} from "../lib/prob/index.ts";
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

// ---------------------------------------------------------------------------
// Q1 — full opening-Basics view data (docs/02 §3, docs/04 §5–6)
// ---------------------------------------------------------------------------

/** Golden opening_basics cases exist for these B values at N=60, H=7. */
const GOLDEN_OPENING_BASICS = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20]);

/** 99884400n → "99,884,400" (integer display only — not a probability). */
export function groupDigits(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface DistRowData {
  k: number;
  percent: string;
  fraction: string;
  oneIn: string;
  chart: number;
}

export interface Q1ReceiptData {
  /** Params for the i18n line templates (receipt.q1.*). */
  formula: { nMinusB: number; n: number; h: number };
  subst: { nMinusB: number; n: number; h: number; num: string; den: string };
  total: { raw: string; reduced: string; percent: string };
  /** Exact runtime identity: Σ_k P(k) = 1. */
  identityOk: boolean;
  /** Golden vector id when this exact case is covered (N=60, H=7). */
  goldenId?: string;
}

export interface Q1Data {
  basics: number;
  total: number;
  headline: {
    percent: string;
    fraction: string;
    oneIn: string;
    chart: number;
    /** "every {games} games" for the interpretation line; absent when q = 0. */
    games?: string;
  };
  validPercent: string;
  expectedMulligans: string;
  expectedBasicsFraction: string;
  expectedBasicsDecimal: string;
  exactM: Array<{ m: number; percent: string; chart: number }>;
  raw: DistRowData[];
  conditional: DistRowData[];
  receipt: Q1ReceiptData;
}

export type Q1Result =
  | { status: "noDeck" | "tooFewCards" | "noBasics" }
  | { status: "ok"; data: Q1Data };

function distRows(dist: readonly Rat[]): DistRowData[] {
  return dist.map((p, k) => ({
    k,
    percent: percentStr(p, 6),
    fraction: fractionStr(p),
    oneIn: oneInStr(p, 3),
    chart: toChartNumber(p),
  }));
}

export function computeQ1(deck: Deck | null): Q1Result {
  if (!deck) return { status: "noDeck" };
  const total = deckTotal(deck);
  const basics = deckBasics(deck);
  if (total < HAND_SIZE) return { status: "tooFewCards" };
  if (basics < 1) return { status: "noBasics" };

  const r = openingBasics(basics, total, HAND_SIZE);
  const q = r.mulligan;

  const exactM = [0, 1, 2, 3, 4].map((m) => {
    const p = mulliganCountPmf(q, m);
    return { m, percent: percentStr(p, 4), chart: toChartNumber(p) };
  });

  const num = binom(total - basics, HAND_SIZE);
  const den = binom(total, HAND_SIZE);
  const identityOk = eq(r.dist.reduce((s, p) => add(s, p), R_ZERO), R_ONE);
  const goldenId =
    total === 60 && HAND_SIZE === 7 && GOLDEN_OPENING_BASICS.has(basics)
      ? `opening_basics_B${basics}`
      : undefined;

  return {
    status: "ok",
    data: {
      basics,
      total,
      headline: {
        percent: percentStr(q, 6),
        fraction: fractionStr(q),
        oneIn: oneInStr(q, 3),
        chart: toChartNumber(q),
        ...(isZero(q) ? {} : { games: decimalStr(div(R_ONE, q), 1) }),
      },
      validPercent: percentStr(r.valid, 6),
      expectedMulligans: decimalStr(r.expectedMulligans, 6),
      expectedBasicsFraction: fractionStr(r.expectedBasics),
      expectedBasicsDecimal: decimalStr(r.expectedBasics, 6),
      exactM,
      raw: distRows(r.dist),
      conditional: distRows(r.conditionalDist),
      receipt: {
        formula: { nMinusB: total - basics, n: total, h: HAND_SIZE },
        subst: {
          nMinusB: total - basics,
          n: total,
          h: HAND_SIZE,
          num: groupDigits(num),
          den: groupDigits(den),
        },
        total: {
          raw: `${num.toString()}/${den.toString()}`,
          reduced: fractionStr(q),
          percent: percentStr(q, 6),
        },
        identityOk,
        ...(goldenId !== undefined ? { goldenId } : {}),
      },
    },
  };
}
