/**
 * Local deck-building optimizer enumeration (docs/02 §11) — v2 golden
 * pipeline. F free slots distributed over candidate cards (remainder goes to
 * generic non-Basic filler); every allocation's query value is exact.
 * BigInt rationals only.
 */

import {
  type Rat,
  add,
  div,
  cmp,
  R_ZERO,
  isZero,
  multiHypergeomPmf,
} from "../prob/index.ts";

export interface OptimizerCandidate {
  /** Locked copies already in the deck. */
  base: number;
  isBasic: boolean;
  /** Required copies in the opening hand (≥ want); 0 = no requirement. */
  want: number;
  label?: string;
}

export interface OptimizerCell {
  /** Free copies assigned to each candidate (Σ ≤ freeSlots). */
  alloc: number[];
  /** P(all wants met | valid hand). */
  p: Rat;
}

export interface OptimizerResult {
  cells: OptimizerCell[];
  best: OptimizerCell;
}

function cellValue(
  counts: number[],
  cands: OptimizerCandidate[],
  otherBasics: number,
  N: number,
  H: number,
): Rat {
  let pValid = R_ZERO;
  let pHit = R_ZERO;
  const m = counts.length;
  const ks = new Array<number>(m).fill(0);

  const rec = (i: number, used: number): void => {
    if (i === m) {
      for (let j = 0; j <= Math.min(otherBasics, H - used); j++) {
        const ph = multiHypergeomPmf(N, [...counts, otherBasics], H, [...ks, j]);
        if (isZero(ph)) continue;
        let basics = j;
        for (let c = 0; c < m; c++) if ((cands[c] as OptimizerCandidate).isBasic) basics += ks[c] as number;
        if (basics < 1) continue;
        pValid = add(pValid, ph);
        let hit = true;
        for (let c = 0; c < m; c++) {
          if ((ks[c] as number) < (cands[c] as OptimizerCandidate).want) {
            hit = false;
            break;
          }
        }
        if (hit) pHit = add(pHit, ph);
      }
      return;
    }
    for (let k = 0; k <= Math.min(counts[i] as number, H - used); k++) {
      ks[i] = k;
      rec(i + 1, used + k);
    }
    ks[i] = 0;
  };

  rec(0, 0);
  if (isZero(pValid)) throw new RangeError("deck can never produce a valid hand");
  return div(pHit, pValid);
}

export function optimizeAllocations(
  cands: OptimizerCandidate[],
  freeSlots: number,
  otherBasics: number,
  N = 60,
  H = 7,
): OptimizerResult {
  if (cands.length === 0) throw new RangeError("at least one candidate is required");
  const cells: OptimizerCell[] = [];

  const enumerate = (i: number, remaining: number, alloc: number[]): void => {
    if (i === cands.length) {
      const counts = cands.map((c, idx) => c.base + (alloc[idx] as number));
      const total = counts.reduce((s, v) => s + v, 0) + otherBasics;
      if (total > N) return; // impossible allocation — skipped, not crashed
      cells.push({ alloc: [...alloc], p: cellValue(counts, cands, otherBasics, N, H) });
      return;
    }
    for (let a = 0; a <= remaining; a++) {
      alloc[i] = a;
      enumerate(i + 1, remaining - a, alloc);
    }
    alloc[i] = 0;
  };

  enumerate(0, freeSlots, new Array<number>(cands.length).fill(0));
  if (cells.length === 0) throw new RangeError("no feasible allocation");

  let best = cells[0] as OptimizerCell;
  for (const cell of cells) if (cmp(cell.p, best.p) > 0) best = cell;
  return { cells, best };
}
