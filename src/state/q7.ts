/**
 * Phase 7 UI compute layer: relay events, search-chain fold, optimizer.
 * Same contract as the other selector modules — exact math in probx/core,
 * display strings out.
 */

import {
  cardsSeenByTurn,
  hypergeomAtLeast,
  sub,
  rat,
  isZero,
  percentStr,
  fractionStr,
  oneInStr,
  decimalStr,
  toChartNumber,
  type Rat,
} from "../lib/prob/index.ts";
import { relayEvent } from "../lib/probx/relay.ts";
import { searchFoldValid } from "../lib/probx/fold.ts";
import type { OptimizerCandidate, OptimizerResult } from "../lib/probx/optimizer.ts";
import { deckTotal, deckBasics, type Deck } from "./deckStore.ts";
import { HAND_SIZE, PRIZE_COUNT } from "../constants.ts";

function fmt3(p: Rat) {
  return {
    percent: percentStr(p, 6),
    fraction: fractionStr(p),
    oneIn: oneInStr(p, 3),
    chart: toChartNumber(p),
  };
}

// ---------------------------------------------------------------------------
// Relay (docs/02 §6.5)
// ---------------------------------------------------------------------------

export interface RelayQuery {
  cA: number;
  wA: number;
  turnA: number;
  cB: number;
  wB: number;
  turnB: number;
  goingFirst: boolean;
}

export interface RelayData {
  n1: number;
  n2: number;
  joint: ReturnType<typeof fmt3>;
  singleA: string;
  singleB: string;
}

export function computeRelay(q: RelayQuery, N = 60): RelayData | null {
  if (q.turnA > q.turnB) return null;
  const cap = N - PRIZE_COUNT;
  const n1 = Math.min(cardsSeenByTurn(q.turnA, q.goingFirst, { H: HAND_SIZE }), cap);
  const n2 = Math.min(cardsSeenByTurn(q.turnB, q.goingFirst, { H: HAND_SIZE }), cap);
  if (q.cA + q.cB > N) return null;
  try {
    const p = relayEvent(q.cA, q.cB, q.wA, q.wB, n1, n2, N);
    return {
      n1,
      n2,
      joint: fmt3(p),
      singleA: percentStr(hypergeomAtLeast(N, q.cA, n1, q.wA), 6),
      singleB: percentStr(hypergeomAtLeast(N, q.cB, n2, q.wB), 6),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Search-chain fold (docs/02 §4.3)
// ---------------------------------------------------------------------------

export interface FoldData {
  optimistic: ReturnType<typeof fmt3>;
  conservative: ReturnType<typeof fmt3>;
  gapPp: string;
  pValid: { fraction: string; percent: string };
}

export function computeSearchFold(
  deck: Deck,
  targetName: string,
  searchers: number,
  want: number,
): FoldData | null {
  const N = deckTotal(deck);
  if (N < HAND_SIZE) return null;
  const card = deck.cards.find((c) => c.name === targetName);
  if (!card || card.count === 0) return null;
  const basics = deckBasics(deck);
  const ob = basics - (card.isBasic ? card.count : 0);
  if (!card.isBasic && ob < 1) return null;
  if (card.count + searchers + ob > N) return null;
  try {
    const r = searchFoldValid(card.count, card.isBasic, searchers, ob, Math.max(1, want), N, HAND_SIZE);
    const gap = sub(r.optimistic, r.conservative);
    const gapStr = decimalStr(rat(gap.n * 100n, gap.d), 2);
    return {
      optimistic: fmt3(r.optimistic),
      conservative: fmt3(r.conservative),
      gapPp: (isZero(gap) ? "±" : "+") + gapStr + "pp",
      pValid: { fraction: fractionStr(r.pValid), percent: percentStr(r.pValid, 6) },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Optimizer display (docs/02 §11) — heavy enumeration runs in the Worker
// ---------------------------------------------------------------------------

export interface OptimizerRowData {
  key: string;
  /** e.g. "+3 / +2" in candidate order. */
  label: string;
  percent: string;
  fraction: string;
  chart: number;
  best: boolean;
}

export function formatOptimizerResult(result: OptimizerResult): OptimizerRowData[] {
  const bestKey = result.best.alloc.join("_");
  return result.cells
    .map((cell) => ({
      key: cell.alloc.join("_"),
      label: cell.alloc.map((a) => `+${a}`).join(" / "),
      percent: percentStr(cell.p, 6),
      fraction: fractionStr(cell.p),
      chart: toChartNumber(cell.p),
      best: cell.alloc.join("_") === bestKey,
    }))
    .sort((a, b) => b.chart - a.chart);
}

export type { OptimizerCandidate, OptimizerResult };
