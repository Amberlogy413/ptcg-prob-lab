/**
 * 中局計算器 selector (docs/09 §4 #1): preformatted display strings for the
 * mid-game outs engine, including the 推導明細 (derivation receipt with real
 * numbers substituted) and the ±1-out sensitivity that turns the number into
 * a deck-building action. UI never touches the math core directly.
 */

import {
  binom,
  sub,
  mul,
  ratInt,
  percentStr,
  fractionStr,
  oneInStr,
  decimalStr,
  toChartNumber,
  hypergeomPmf,
  hypergeomAtLeast,
  type Rat,
} from "../lib/prob/index.ts";
import { midgameAtLeast, type MidgameParams } from "../lib/probx/midgame.ts";
import { shuffleBackRedraw } from "../lib/probx/shuffleBack.ts";

export interface MidgameSensitivity {
  /** Outs count this row describes (x−1 or x+1). */
  x: number;
  percent: string;
  /** Signed percentage-point delta vs the base case, 2-place decimal. */
  deltaPp: string;
}

export interface MidgameDisplay {
  percent: string;
  fraction: string;
  oneIn: string;
  chart: number;
  /** 推導明細 — receipt lines with the real numbers substituted. */
  derivation: string[];
  up?: MidgameSensitivity;
  down?: MidgameSensitivity;
}

function ppDelta(diff: Rat): string {
  const pp = mul(diff, ratInt(100));
  const s = decimalStr(pp, 2);
  return s.startsWith("-") ? `${s}pp` : `+${s}pp`;
}

export function computeMidgame(params: MidgameParams): MidgameDisplay {
  const { u, x, w, k } = params;
  const p = midgameAtLeast(params);

  // Derivation: P(X≥k) = 1 − Σ_{j<k} C(x,j)·C(u−x,w−j) / C(u,w).
  const total = binom(u, w);
  const terms: string[] = [];
  let missSum = 0n;
  for (let j = 0; j < k; j++) {
    const t = binom(x, j) * binom(u - x, w - j);
    missSum += t;
    terms.push(`C(${x},${j})·C(${u - x},${w - j}) = ${t}`);
  }
  const derivation = [
    `P(X≥${k}) = 1 − Σ_{j<${k}} C(${x},j)·C(${u - x},${w}−j) ⁄ C(${u},${w})`,
    ...terms.map((t) => `  ${t}`),
    `  Σ 失敗組合 = ${missSum} ;C(${u},${w}) = ${total}`,
    `P = 1 − ${missSum}/${total} = ${fractionStr(p)}`,
    `  = ${percentStr(p, 6)} = ${oneInStr(p, 3)}`,
  ];

  const out: MidgameDisplay = {
    percent: percentStr(p, 6),
    fraction: fractionStr(p),
    oneIn: oneInStr(p, 3),
    chart: toChartNumber(p),
    derivation,
  };
  if (x + 1 <= u) {
    const pUp = midgameAtLeast({ ...params, x: x + 1 });
    out.up = { x: x + 1, percent: percentStr(pUp, 6), deltaPp: ppDelta(sub(pUp, p)) };
  }
  if (x - 1 >= 0) {
    const pDown = midgameAtLeast({ ...params, x: x - 1 });
    out.down = { x: x - 1, percent: percentStr(pDown, 6), deltaPp: ppDelta(sub(pDown, p)) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 奇樹/裁判 shuffle-back redraw (docs/09 #53) — single tracked card display.

export interface ShuffleBackInput {
  /** Unknown deck cards before the shuffle. */
  D: number;
  /** Facedown prizes. */
  p: number;
  /** Copies among the unseen pool (deck + prizes). */
  xU: number;
  /** Copies among the shuffled-back hand. */
  xH: number;
  /** Returned hand size. */
  h: number;
  /** Cards redrawn from the new deck. */
  draw: number;
  /** Want at least k among the redraw. */
  k: number;
}

export function computeShuffleBack(input: ShuffleBackInput): MidgameDisplay {
  const { D, p, xU, xH, h, draw, k } = input;
  const run = (xu: number): Rat =>
    shuffleBackRedraw({
      D,
      p,
      unseen: [xu],
      returned: [xH],
      h,
      draw,
      mins: [k],
      maxs: [draw],
    });
  const total = run(xU);
  const u = D + p;

  // 推導明細: mixture over how many of the unseen copies hide in the deck.
  // Single category ⇒ each term is a plain hypergeometric product.
  const derivation = [
    `P = Σ_j P(牌庫藏 j 張) · P(重抽≥${k} | 新牌庫 ${D + h} 張、解 j+${xH})`,
    `  j ~ HG(u=${u}, x=${xU}, D=${D})`,
  ];
  for (let j = 0; j <= Math.min(xU, D); j++) {
    const pj = hypergeomPmf(u, xU, D, j);
    const inner = hypergeomAtLeast(D + h, j + xH, draw, k);
    derivation.push(`  j=${j}: ${fractionStr(pj)} × ${fractionStr(inner)}`);
  }
  derivation.push(`合計 = ${fractionStr(total)} = ${percentStr(total, 6)} = ${oneInStr(total, 3)}`);

  const out: MidgameDisplay = {
    percent: percentStr(total, 6),
    fraction: fractionStr(total),
    oneIn: oneInStr(total, 3),
    chart: toChartNumber(total),
    derivation,
  };
  if (xU + 1 <= u) {
    const up = run(xU + 1);
    out.up = { x: xU + 1, percent: percentStr(up, 6), deltaPp: ppDelta(sub(up, total)) };
  }
  if (xU - 1 >= 0) {
    const down = run(xU - 1);
    out.down = { x: xU - 1, percent: percentStr(down, 6), deltaPp: ppDelta(sub(down, total)) };
  }
  return out;
}
