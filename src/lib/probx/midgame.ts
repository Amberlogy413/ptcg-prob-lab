/**
 * Mid-game outs engine (docs/09 §4 candidate #1) — the probability that at
 * least k of the x outs appear in the next w draws, computed over the UNSEEN
 * pool (library + facedown prizes): the player cannot tell which copies are
 * prized, so u = unseen count is the only honest parameterization — using
 * the library count alone is the Y/X fallacy (docs/09 §3.1). The draws are a
 * uniform subset of the unseen pool by exchangeability (docs/02 §5.5 family).
 * Pure parameter mapping onto the seed core's exact hypergeometric tail; the
 * v2 golden pipeline cross-verifies against the independent Python reference.
 *
 * Also models hand-shuffle-back reconstruction (奇樹/judge effects): pool
 * u + h with x_unseen + x_hand outs — same function, different parameters.
 *
 * BigInt rationals only.
 */

import { type Rat, hypergeomAtLeast } from "../prob/index.ts";

export interface MidgameParams {
  /** UNSEEN cards: library + facedown prizes (u ≥ 1). */
  u: number;
  /** Outs among the unseen (0 ≤ x ≤ u). */
  x: number;
  /** Draws in the window (1 ≤ w ≤ u). */
  w: number;
  /** Success threshold: at least k outs drawn (k ≥ 1). */
  k: number;
}

export function midgameAtLeast({ u, x, w, k }: MidgameParams): Rat {
  if (!Number.isInteger(u) || !Number.isInteger(x) || !Number.isInteger(w) || !Number.isInteger(k)) {
    throw new RangeError("midgame parameters must be integers");
  }
  if (u < 1) throw new RangeError(`deck must have at least 1 card, got u=${u}`);
  if (x < 0 || x > u) throw new RangeError(`outs out of range: x=${x}, u=${u}`);
  if (w < 1 || w > u) throw new RangeError(`draws out of range: w=${w}, u=${u}`);
  if (k < 1) throw new RangeError(`threshold must be ≥ 1, got k=${k}`);
  return hypergeomAtLeast(u, x, w, k);
}
