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
  type Rat,
} from "../lib/prob/index.ts";
import { midgameAtLeast, type MidgameParams } from "../lib/probx/midgame.ts";

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
