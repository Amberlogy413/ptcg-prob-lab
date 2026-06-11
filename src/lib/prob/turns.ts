/**
 * Turn curves — "by my turn T, how many cards have I seen, and what is the
 * probability I have seen at least `want` copies of card X?"
 *
 * Key modeling facts (derivations and the exchangeability argument that makes
 * prizes irrelevant here: docs/02_MATH_SPEC.md §6):
 *
 *   - You see H = 7 cards as your opening hand, then 1 card at the start of
 *     each of your turns.
 *   - CURRENT official rule (Sword & Shield era onward, still in force):
 *     BOTH players draw on every turn, including the first player's first
 *     turn. The first player's restrictions are "no attack" and "no
 *     Supporter" — NOT "no draw".
 *   - A historical variant (2004 → Diamond & Pearl era) skipped the first
 *     player's first draw. We expose it as an opt-in flag so the UI can model
 *     legacy formats, but it defaults to OFF.
 *   - The 6 prize cards do NOT change these probabilities: by exchangeability
 *     the first n cards you personally see are a uniform n-subset of all 60,
 *     whether or not 6 unseen cards were set aside. (You can physically see at
 *     most 60 − 6 = 54 cards in a game; the UI should cap there.)
 *
 * The curve below is UNCONDITIONED on the mulligan rule (see spec §6.3 for
 * why this is the honest default and how a mulligan-aware variant would look).
 */

import { type Rat } from "./rational.ts";
import { hypergeomAtLeast } from "./hypergeom.ts";

export interface TurnRuleOptions {
  /** Opening hand size. */
  H?: number;
  /**
   * Legacy rule toggle: the player going first skips their very first draw.
   * Default false — under current official rules both players always draw.
   */
  firstPlayerSkipsFirstDraw?: boolean;
  /**
   * Extra cards seen beyond natural draws (e.g. draw Supporters), applied as a
   * flat offset chosen by the user. Default 0.
   */
  extraSeen?: number;
}

/**
 * Number of cards you have seen by the END of your draw step on your turn
 * `turn` (1-based): opening hand + one natural draw per turn taken, adjusted
 * for the optional legacy first-draw skip and any user-declared extra draws.
 */
export function cardsSeenByTurn(
  turn: number,
  goingFirst: boolean,
  opts: TurnRuleOptions = {},
): number {
  if (!Number.isInteger(turn) || turn < 1) {
    throw new RangeError(`turn must be an integer >= 1, got ${turn}`);
  }
  const H = opts.H ?? 7;
  const extra = opts.extraSeen ?? 0;
  if (!Number.isInteger(extra) || extra < 0) {
    throw new RangeError(`extraSeen must be a non-negative integer, got ${extra}`);
  }
  let draws = turn;
  if (goingFirst && (opts.firstPlayerSkipsFirstDraw ?? false)) draws -= 1;
  return H + draws + extra;
}

/**
 * P(at least `want` copies of a card with `x` copies in the deck appear among
 * the first `nSeen` cards you see), for a deck of `N` cards.
 *
 * Exact: 1 − Σ_{k<want} C(x,k)·C(N−x, nSeen−k) / C(N, nSeen).
 */
export function pSeenAtLeast(x: number, nSeen: number, want = 1, N = 60): Rat {
  if (!Number.isInteger(nSeen) || nSeen < 0 || nSeen > N) {
    throw new RangeError(`nSeen must be an integer in [0, ${N}], got ${nSeen}`);
  }
  return hypergeomAtLeast(N, x, nSeen, want);
}

/**
 * Convenience: the full curve P(seen >= want) for your turns 1..maxTurn.
 * Returns one entry per turn with the nSeen used, so the UI can label axes.
 */
export function seenCurve(
  x: number,
  maxTurn: number,
  goingFirst: boolean,
  want = 1,
  N = 60,
  opts: TurnRuleOptions = {},
): Array<{ turn: number; nSeen: number; p: Rat }> {
  if (!Number.isInteger(maxTurn) || maxTurn < 1) {
    throw new RangeError(`maxTurn must be an integer >= 1, got ${maxTurn}`);
  }
  const out: Array<{ turn: number; nSeen: number; p: Rat }> = [];
  for (let t = 1; t <= maxTurn; t++) {
    const nSeen = Math.min(cardsSeenByTurn(t, goingFirst, opts), N);
    out.push({ turn: t, nSeen, p: pSeenAtLeast(x, nSeen, want, N) });
  }
  return out;
}
