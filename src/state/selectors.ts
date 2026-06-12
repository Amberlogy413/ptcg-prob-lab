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
  sub,
  mul,
  eq,
  isZero,
  div,
  rat,
  R_ZERO,
  R_ONE,
  percentStr,
  fractionStr,
  oneInStr,
  decimalStr,
  toChartNumber,
  type Rat,
  type TrackedCard,
  type ComboOptions,
  type ComboResult,
} from "../lib/prob/index.ts";
import { deckTotal, deckBasics, type Deck } from "./deckStore.ts";
import { constraintBounds, type TrackedQueryCard } from "./queryStore.ts";
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

// ---------------------------------------------------------------------------
// Q2 — sentence-builder combo query (docs/02 §4, docs/04 §4–5)
// ---------------------------------------------------------------------------

/** Variable letters used in the receipt formula and the table header. */
export const COMBO_LETTERS = ["a", "b", "c", "d", "e"] as const;

/** Golden combo cases (id + parameter signature); tests/q2.spec.tsx asserts
 *  this list matches tests/golden/golden_vectors.json exactly. */
export const GOLDEN_COMBO_REFS: ReadonlyArray<{ id: string; sig: string }> = [
  { id: "combo_A4_B4_atleast1_each", sig: "60|7|4,4|1-7,1-7|" },
  { id: "combo_A4_B3_C2_atleast1_each", sig: "60|7|4,3,2|1-7,1-7,1-7|" },
  { id: "combo_exactly2_of_4", sig: "60|7|4|2-2|" },
  { id: "combo_valid_A4basic_B3_ob6_atleast1_each", sig: "60|7|4,3|1-7,1-7|tf:6" },
];

export function comboSignature(
  N: number,
  H: number,
  counts: number[],
  constraints: Array<[number, number]>,
  basicFlags?: boolean[],
  otherBasics?: number,
): string {
  const aware = basicFlags
    ? `${basicFlags.map((f) => (f ? "t" : "f")).join("")}:${otherBasics ?? 0}`
    : "";
  return `${N}|${H}|${counts.join(",")}|${constraints.map(([lo, hi]) => `${lo}-${hi}`).join(",")}|${aware}`;
}

export interface Q2BuildOk {
  status: "ok";
  cards: TrackedCard[];
  labels: string[];
  opts: ComboOptions;
  /** Enumeration-size estimate (incl. the other-Basics category when aware)
   *  against the >2,000-cell Worker rule (docs/03 §5). */
  estimatedCells: number;
}

export type Q2BuildResult =
  | Q2BuildOk
  | { status: "empty" | "tooFewCards" | "noBasicsForAware" };

export function buildComboParams(
  deck: Deck,
  tracked: TrackedQueryCard[],
  mulliganAware: boolean,
): Q2BuildResult {
  const N = deckTotal(deck);
  if (N < HAND_SIZE) return { status: "tooFewCards" };

  const resolved = tracked
    .map((q) => ({ q, card: deck.cards.find((c) => c.id === q.cardId) }))
    .filter((r) => r.card !== undefined && r.card.count > 0);
  if (resolved.length === 0) return { status: "empty" };

  const totalBasics = deckBasics(deck);
  if (mulliganAware && totalBasics < 1) return { status: "noBasicsForAware" };

  const cards: TrackedCard[] = [];
  const labels: string[] = [];
  for (const { q, card } of resolved) {
    const c = card!;
    const [min, max] = constraintBounds(q, c.count, HAND_SIZE);
    cards.push({ label: c.name, count: c.count, min, max, isBasic: c.isBasic });
    labels.push(c.name);
  }

  const trackedBasics = cards.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
  const otherBasics = totalBasics - trackedBasics;

  const opts: ComboOptions = {
    N,
    H: HAND_SIZE,
    ...(mulliganAware ? { mulliganAware: { otherBasics } } : {}),
  };

  const cats = [...cards.map((c) => c.count), ...(mulliganAware ? [otherBasics] : [])];
  const estimatedCells = cats.reduce((p, c) => p * (Math.min(c, HAND_SIZE) + 1), 1);

  return { status: "ok", cards, labels, opts, estimatedCells };
}

export interface Q2TableRow {
  key: string;
  /** e.g. "(1, 0)" in the order of the tracked cards. */
  combo: string;
  percent: string;
  fraction: string;
  oneIn: string;
  chart: number;
  satisfies: boolean;
}

export interface Q2ReceiptLineData {
  formula: string;
  substitution: string;
  /** Params for receipt.q2.total: numerator (grouped) + reduced fraction. */
  total: { num: string; frac: string };
  /** Params for receipt.q2.cond — present only when conditioned. */
  cond?: { pValid: string; result: string };
  identityOk: boolean;
  goldenId?: string;
}

export interface Q2Data {
  conditioned: boolean;
  headline: { percent: string; fraction: string; oneIn: string; chart: number; games?: string };
  /** Grey comparison line (docs/04 §5) — present when conditioned. */
  naive?: { percent: string; deltaPp: string };
  pValid?: { fraction: string; percent: string };
  legend: string;
  comboHeader: string;
  rows: Q2TableRow[];
  receipt: Q2ReceiptLineData;
}

function signedPp(d: Rat): string {
  const s = decimalStr(rat(d.n * 100n, d.d), 2);
  return s.startsWith("-") ? `−${s.slice(1)}pp` : `+${s}pp`;
}

/** Exact numerator of `p` over C(N,H): p · C(N,H) (always an integer). */
function numeratorOver(p: Rat, N: number, H: number): bigint {
  return (p.n * binom(N, H)) / p.d;
}

export function computeQ2Display(result: ComboResult, build: Q2BuildOk): Q2Data {
  const N = build.opts.N ?? 60;
  const H = build.opts.H ?? HAND_SIZE;
  const conditioned = build.opts.mulliganAware !== undefined;
  const counts = build.cards.map((c) => c.count);
  const constraints = build.cards.map((c) => [c.min, c.max] as [number, number]);
  const letters = build.cards.map((_, i) => COMBO_LETTERS[i] as string);

  // Receipt line 1 — the formula with real numbers substituted.
  const rest = N - counts.reduce((s, c) => s + c, 0);
  const products = counts.map((c, i) => `C(${c},${letters[i]})`).join("·");
  const sumLetters = letters.join("−");
  const constraintText = build.cards
    .map((c, i) => {
      const L = letters[i] as string;
      if (c.min === c.max) return `${L}=${c.min}`;
      if (c.min === 0 && c.max >= Math.min(c.count, H)) return `${L}≤${c.max}`;
      if (c.max >= H) return `${L}≥${c.min}`;
      if (c.min === 0) return `${L}≤${c.max}`;
      return `${c.min}≤${L}≤${c.max}`;
    })
    .join(", ");
  const formula = `P = Σ ${products}·C(${rest},${H}−${sumLetters}) / C(${N},${H}) (${constraintText})`;

  const eventUncond = result.eventUnconditioned ?? result.event;
  // Conditioned receipts must chain EXACTLY: P(event∧valid) ÷ p_valid =
  // P(event | valid). The unconditioned event is NOT that numerator (they
  // differ whenever the constraints don't imply a valid hand) — it only
  // feeds the grey naive-comparison line. Math-engine audit 2026-06-12.
  const totalRat =
    conditioned && result.pValid !== undefined ? mul(result.event, result.pValid) : eventUncond;
  const numerator = numeratorOver(totalRat, N, H);
  const identityOk = eq(
    result.table.reduce((s, cell) => add(s, cell.p), R_ZERO),
    R_ONE,
  );
  const sig = comboSignature(
    N,
    H,
    counts,
    constraints,
    conditioned ? build.cards.map((c) => c.isBasic === true) : undefined,
    conditioned ? build.opts.mulliganAware?.otherBasics : undefined,
  );
  const goldenId = GOLDEN_COMBO_REFS.find((r) => r.sig === sig)?.id;

  const rows: Q2TableRow[] = result.table.map((cell) => ({
    key: cell.ks.join("_"),
    combo: `(${cell.ks.join(", ")})`,
    percent: percentStr(cell.p, 6),
    fraction: fractionStr(cell.p),
    oneIn: oneInStr(cell.p, 3),
    chart: toChartNumber(cell.p),
    satisfies: cell.satisfies,
  }));

  const e = result.event;
  return {
    conditioned,
    headline: {
      percent: percentStr(e, 6),
      fraction: fractionStr(e),
      oneIn: oneInStr(e, 2),
      chart: toChartNumber(e),
      ...(isZero(e) ? {} : { games: decimalStr(div(R_ONE, e), 1) }),
    },
    ...(conditioned && result.eventUnconditioned !== undefined
      ? {
          naive: {
            percent: percentStr(result.eventUnconditioned, 6),
            deltaPp: signedPp(sub(result.eventUnconditioned, e)),
          },
        }
      : {}),
    ...(conditioned && result.pValid !== undefined
      ? {
          pValid: {
            fraction: fractionStr(result.pValid),
            percent: percentStr(result.pValid, 6),
          },
        }
      : {}),
    legend: build.labels
      .map((name, i) => `${letters[i]} = ${name} ×${counts[i]}`)
      .join(", "),
    comboHeader: `(${letters.join(", ")})`,
    rows,
    receipt: {
      formula,
      substitution: `C(${N},${H}) = ${groupDigits(binom(N, H))}`,
      total: { num: groupDigits(numerator), frac: fractionStr(totalRat) },
      ...(conditioned && result.pValid !== undefined
        ? {
            cond: {
              pValid: fractionStr(result.pValid),
              result: fractionStr(e),
            },
          }
        : {}),
      identityOk,
      ...(goldenId !== undefined ? { goldenId } : {}),
    },
  };
}
