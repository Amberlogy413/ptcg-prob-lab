/**
 * 試抽桌 (trial table) dealing engine — Phase 8, docs/08 §5A.
 *
 * Honest single-game dealer: Fisher–Yates over the physical copies, the real
 * mulligan loop (redraw until the hand holds ≥1 Basic, when the deck has
 * any), then 6 prize cards and the first-turn draw from the remainder.
 *
 * Floats are fine HERE — this is sampling for teaching and lives outside
 * src/lib/prob; every probability rendered beside the samples comes from the
 * exact core. Each game's RNG derives from (seed, game index), so any single
 * game reproduces identically no matter how deals were batched.
 */

import { mulberry32 } from "./mcSim.ts";
import { HAND_SIZE, PRIZE_COUNT } from "../constants.ts";

export interface TrialCard {
  name: string;
  isBasic: boolean;
}

export interface TrialDeal {
  /** The kept (post-mulligan) 7-card hand. */
  hand: TrialCard[];
  /** The 6 prize cards set aside after the hand is kept. */
  prizes: TrialCard[];
  /** The turn-1 draw (current rules: the first player does draw). */
  firstDraw: TrialCard;
  /** Redeals before the kept hand (0 = the first deal stood). */
  mulligans: number;
}

export interface TrialStats {
  games: number;
  /** Every 7-card deal is one Bernoulli(q) trial: attempts = games + mulligans. */
  attempts: number;
  mulligans: number;
  /** keptBasics[k] = kept hands holding exactly k Basics, k = 0..7. */
  keptBasics: number[];
}

/** 7 hand + 6 prizes + 1 first draw. */
export const TRIAL_MIN_CARDS = HAND_SIZE + PRIZE_COUNT + 1;

export function emptyStats(): TrialStats {
  return {
    games: 0,
    attempts: 0,
    mulligans: 0,
    keptBasics: new Array<number>(HAND_SIZE + 1).fill(0),
  };
}

/**
 * Expand deck rows into physical copies. Counts every row with count > 0 —
 * including unnamed rows — to stay in lockstep with deckTotal/deckBasics,
 * which feed the exact overlay.
 */
export function physicalCopies(
  rows: ReadonlyArray<{ name: string; count: number; isBasic: boolean }>,
): TrialCard[] {
  const out: TrialCard[] = [];
  for (const r of rows) {
    for (let i = 0; i < r.count; i++) out.push({ name: r.name, isBasic: r.isBasic });
  }
  return out;
}

/** Deterministic per-game stream: game g under seed s is always the same. */
export function gameRng(seed: number, game: number): () => number {
  return mulberry32((seed + game * 0x9e3779b9) >>> 0);
}

export function dealGame(
  copies: readonly TrialCard[],
  mulliganAware: boolean,
  rng: () => number,
): TrialDeal {
  const n = copies.length;
  if (n < TRIAL_MIN_CARDS) {
    throw new RangeError(`trial deal needs at least ${TRIAL_MIN_CARDS} cards`);
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) idx.push(i);

  let mulligans = 0;
  for (;;) {
    // A fresh partial Fisher–Yates pass over the first H positions yields a
    // uniformly random 7-card hand regardless of the array's previous order.
    for (let i = 0; i < HAND_SIZE; i++) {
      const j = i + Math.floor(rng() * (n - i));
      const tmp = idx[i] as number;
      idx[i] = idx[j] as number;
      idx[j] = tmp;
    }
    let basics = 0;
    for (let i = 0; i < HAND_SIZE; i++) {
      if ((copies[idx[i] as number] as TrialCard).isBasic) basics++;
    }
    if (!mulliganAware || basics >= 1) break;
    mulligans++;
  }

  // The hand stands; prizes then the first draw come from the remainder.
  for (let i = HAND_SIZE; i < TRIAL_MIN_CARDS; i++) {
    const j = i + Math.floor(rng() * (n - i));
    const tmp = idx[i] as number;
    idx[i] = idx[j] as number;
    idx[j] = tmp;
  }

  const at = (i: number): TrialCard => copies[idx[i] as number] as TrialCard;
  return {
    hand: Array.from({ length: HAND_SIZE }, (_, i) => at(i)),
    prizes: Array.from({ length: PRIZE_COUNT }, (_, i) => at(HAND_SIZE + i)),
    firstDraw: at(HAND_SIZE + PRIZE_COUNT),
    mulligans,
  };
}

export function runTrials(
  copies: readonly TrialCard[],
  mulliganAware: boolean,
  seed: number,
  firstGame: number,
  games: number,
  stats: TrialStats,
): { stats: TrialStats; lastDeal: TrialDeal } {
  if (games < 1) throw new RangeError("games must be >= 1");
  const next: TrialStats = { ...stats, keptBasics: [...stats.keptBasics] };
  let last: TrialDeal | undefined;
  for (let g = 0; g < games; g++) {
    const deal = dealGame(copies, mulliganAware, gameRng(seed, firstGame + g));
    next.games += 1;
    next.attempts += deal.mulligans + 1;
    next.mulligans += deal.mulligans;
    const k = deal.hand.reduce((s, c) => s + (c.isBasic ? 1 : 0), 0);
    next.keptBasics[k] = (next.keptBasics[k] as number) + 1;
    last = deal;
  }
  return { stats: next, lastDeal: last as TrialDeal };
}
