/**
 * Q3 prize-card compute layer (docs/02 §5, docs/04 §4–5). Same contract as
 * selectors.ts: exact math stays in the core; this returns display strings
 * (plus language-neutral math notation for receipts — the prose around it
 * comes from i18n in the components).
 */

import {
  prizeDistUnconditional,
  prizeDistGivenHand,
  prizeDistPreGame,
  prizeJointGivenHand,
  atLeastOnePrized,
  expectation,
  binom,
  rat,
  add,
  eq,
  cmp,
  div,
  isZero,
  R_ZERO,
  R_ONE,
  percentStr,
  fractionStr,
  oneInStr,
  decimalStr,
  toChartNumber,
  type Rat,
  type PrizeTrackedCard,
} from "../lib/prob/index.ts";
import { groupDigits, COMBO_LETTERS, type DistRowData, type Q2TableRow } from "./selectors.ts";
import { HAND_SIZE, PRIZE_COUNT } from "../constants.ts";

export type Q3Mode = "uncond" | "givenHand" | "preGame";

export interface Q3SingleQuery {
  /** Copies of the card in the deck. */
  x: number;
  /** Copies already seen in hand (mode "givenHand" only). */
  h: number;
  /** Mode "preGame": is the card itself a Basic Pokémon? */
  isBasic: boolean;
  /** Mode "preGame": Basics in the deck other than this card's copies. */
  otherBasics: number;
}

/** Golden prize cases; tests assert lockstep with the golden JSON. */
export const GOLDEN_PRIZE_REFS: ReadonlyArray<{ id: string; sig: string }> = [
  { id: "prize_uncond_x1", sig: "u|60|6|1" },
  { id: "prize_uncond_x2", sig: "u|60|6|2" },
  { id: "prize_uncond_x3", sig: "u|60|6|3" },
  { id: "prize_uncond_x4", sig: "u|60|6|4" },
  { id: "prize_given_hand_x4_h0", sig: "g|60|7|6|4|0" },
  { id: "prize_given_hand_x4_h1", sig: "g|60|7|6|4|1" },
  { id: "prize_pregame_valid_x4basic_ob6", sig: "p|60|7|6|4|t|6" },
  { id: "prize_pregame_valid_x4nonbasic_ob10", sig: "p|60|7|6|4|f|10" },
  { id: "prize_joint_given_hand_A4h1_B3h0_atleast1_each", sig: "j|60|7|6|4-1,3-0|1-6,1-6" },
];

function goldenPrizeId(sig: string): string | undefined {
  return GOLDEN_PRIZE_REFS.find((r) => r.sig === sig)?.id;
}

export interface Q3ReceiptData {
  /** Language-neutral math notation lines. */
  formula: string;
  substitution: string;
  /** The 合計 line, structured for i18n templates. */
  totalKind: "atLeast" | "expected";
  total: { num?: string; frac: string; dec?: string };
  /** 條件化 line param (mode "preGame" only). */
  condPValid?: string;
  identityOk: boolean;
  goldenId?: string;
}

export interface Q3SingleData {
  mode: Q3Mode;
  x: number;
  h: number;
  headline: { percent: string; fraction: string; oneIn: string; chart: number; games?: string };
  expected: { fraction: string; decimal: string };
  /** Mode "preGame": E compared with the unconditioned baseline x·P/N. */
  baseline?: { decimal: string; direction: "below" | "above" | "equal" };
  pValid?: { fraction: string; percent: string };
  rows: DistRowData[];
  receipt: Q3ReceiptData;
}

function distRows(dist: readonly Rat[]): DistRowData[] {
  return dist.map((p, k) => ({
    k,
    percent: percentStr(p, 6),
    fraction: fractionStr(p),
    oneIn: oneInStr(p, 3),
    chart: toChartNumber(p),
  }));
}

function identityOfDist(dist: readonly Rat[]): boolean {
  return eq(dist.reduce((s, p) => add(s, p), R_ZERO), R_ONE);
}

/** Exact numerator of `p` over C(n, k) (always an integer). */
function numOver(p: Rat, n: number, k: number): string {
  return groupDigits((p.n * binom(n, k)) / p.d);
}

export function computeQ3Single(
  mode: Q3Mode,
  query: Q3SingleQuery,
  N = 60,
  H = HAND_SIZE,
  P = PRIZE_COUNT,
): Q3SingleData {
  const { x, h, isBasic, otherBasics } = query;
  let dist: Rat[];
  let expected: Rat;
  let pValid: Rat | undefined;
  let receipt: Q3ReceiptData;

  if (mode === "uncond") {
    dist = prizeDistUnconditional(x, N, P);
    expected = expectation(dist);
    const al1 = atLeastOnePrized(dist);
    const sig = `u|${N}|${P}|${x}`;
    receipt = {
      formula: `P(K=k) = C(${x},k)·C(${N - x},${P}−k) / C(${N},${P})`,
      substitution: `C(${N},${P}) = ${groupDigits(binom(N, P))}`,
      totalKind: "atLeast",
      total: { num: numOver(al1, N, P), frac: fractionStr(al1) },
      identityOk: identityOfDist(dist),
      ...(goldenPrizeId(sig) ? { goldenId: goldenPrizeId(sig) } : {}),
    };
  } else if (mode === "givenHand") {
    dist = prizeDistGivenHand(x, h, N, H, P);
    expected = expectation(dist);
    const al1 = atLeastOnePrized(dist);
    const M = N - H;
    const rem = x - h;
    const sig = `g|${N}|${H}|${P}|${x}|${h}`;
    receipt = {
      formula: `P(K=k | h=${h}) = C(${rem},k)·C(${M - rem},${P}−k) / C(${M},${P})`,
      substitution: `C(${M},${P}) = ${groupDigits(binom(M, P))}`,
      totalKind: "atLeast",
      total: { num: numOver(al1, M, P), frac: fractionStr(al1) },
      identityOk: identityOfDist(dist),
      ...(goldenPrizeId(sig) ? { goldenId: goldenPrizeId(sig) } : {}),
    };
  } else {
    const r = prizeDistPreGame(x, { isBasic, otherBasics, conditionOnValid: true, N, H, P });
    dist = r.dist;
    expected = r.expected;
    pValid = r.pValid;
    const M = N - H;
    const sig = `p|${N}|${H}|${P}|${x}|${isBasic ? "t" : "f"}|${otherBasics}`;
    receipt = {
      formula: `P(K=k | valid) = Σ_(hX,hB) P(hX,hB)·C(${x}−hX,k)·C(${M}−${x}+hX,${P}−k)/C(${M},${P}) ÷ p_valid`,
      substitution: `C(${M},${P}) = ${groupDigits(binom(M, P))};C(${N},${H}) = ${groupDigits(binom(N, H))}`,
      totalKind: "expected",
      total: { frac: fractionStr(expected), dec: decimalStr(expected, 6) },
      ...(pValid !== undefined ? { condPValid: fractionStr(pValid) } : {}),
      identityOk: identityOfDist(dist),
      ...(goldenPrizeId(sig) ? { goldenId: goldenPrizeId(sig) } : {}),
    };
  }

  const al1 = atLeastOnePrized(dist);
  const baselineRat = rat(BigInt(x * P), BigInt(N));
  const c = cmp(expected, baselineRat);

  return {
    mode,
    x,
    h,
    headline: {
      percent: percentStr(al1, 6),
      fraction: fractionStr(al1),
      oneIn: oneInStr(al1, 3),
      chart: toChartNumber(al1),
      ...(isZero(al1) ? {} : { games: decimalStr(div(R_ONE, al1), 1) }),
    },
    expected: { fraction: fractionStr(expected), decimal: decimalStr(expected, 6) },
    ...(mode === "preGame"
      ? {
          baseline: {
            decimal: decimalStr(baselineRat, 6),
            direction: c < 0 ? ("below" as const) : c > 0 ? ("above" as const) : ("equal" as const),
          },
        }
      : {}),
    ...(pValid !== undefined
      ? { pValid: { fraction: fractionStr(pValid), percent: percentStr(pValid, 6) } }
      : {}),
    rows: distRows(dist),
    receipt,
  };
}

// --- Q3 joint (known hand) ---------------------------------------------------

export interface Q3JointRowInput {
  id: string;
  label: string;
  count: number;
  inHand: number;
  min: number;
  max: number;
}

export interface Q3JointData {
  headline: { percent: string; fraction: string; oneIn: string; chart: number };
  legend: string;
  comboHeader: string;
  rows: Q2TableRow[];
  receipt: Q3ReceiptData;
}

export function computeQ3Joint(
  rowsIn: Q3JointRowInput[],
  N = 60,
  H = HAND_SIZE,
  P = PRIZE_COUNT,
): Q3JointData {
  const cards: PrizeTrackedCard[] = rowsIn.map((r) => ({
    label: r.label,
    count: r.count,
    inHand: r.inHand,
    min: r.min,
    max: r.max,
  }));
  const result = prizeJointGivenHand(cards, { N, H, P });
  const letters = rowsIn.map((_, i) => COMBO_LETTERS[i] as string);
  const M = N - H;
  const rems = rowsIn.map((r) => r.count - r.inHand);
  const rest = M - rems.reduce((s, v) => s + v, 0);
  const products = rems.map((rem, i) => `C(${rem},${letters[i]})`).join("·");
  const constraintText = rowsIn
    .map((r, i) => {
      const L = letters[i] as string;
      if (r.min === r.max) return `${L}=${r.min}`;
      if (r.max >= P) return `${L}≥${r.min}`;
      if (r.min === 0) return `${L}≤${r.max}`;
      return `${r.min}≤${L}≤${r.max}`;
    })
    .join(", ");
  const e = result.event;
  const sig = `j|${N}|${H}|${P}|${rowsIn.map((r) => `${r.count}-${r.inHand}`).join(",")}|${rowsIn
    .map((r) => `${r.min}-${r.max}`)
    .join(",")}`;
  const identityOk = eq(
    result.table.reduce((s, cell) => add(s, cell.p), R_ZERO),
    R_ONE,
  );

  return {
    headline: {
      percent: percentStr(e, 6),
      fraction: fractionStr(e),
      oneIn: oneInStr(e, 2),
      chart: toChartNumber(e),
    },
    legend: rowsIn
      .map((r, i) => `${letters[i]} = ${r.label || `#${i + 1}`} ×${r.count} (h=${r.inHand})`)
      .join(", "),
    comboHeader: `(${letters.join(", ")})`,
    rows: result.table.map((cell) => ({
      key: cell.ks.join("_"),
      combo: `(${cell.ks.join(", ")})`,
      percent: percentStr(cell.p, 6),
      fraction: fractionStr(cell.p),
      oneIn: oneInStr(cell.p, 3),
      chart: toChartNumber(cell.p),
      satisfies: cell.satisfies,
    })),
    receipt: {
      formula: `P = Σ ${products}·C(${rest},${P}−${letters.join("−")}) / C(${M},${P}) (${constraintText})`,
      substitution: `C(${M},${P}) = ${groupDigits(binom(M, P))}`,
      totalKind: "atLeast",
      total: { num: groupDigits((e.n * binom(M, P)) / e.d), frac: fractionStr(e) },
      identityOk,
      ...(goldenPrizeId(sig) ? { goldenId: goldenPrizeId(sig) } : {}),
    },
  };
}
