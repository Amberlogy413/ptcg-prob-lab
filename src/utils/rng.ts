/**
 * Deterministic seeded PRNG (mulberry32) — the battle sandbox shuffles and
 * draws with a SEED so a game is fully reproducible (and never touches
 * Math.random, keeping behavior testable). This is a UI/sim utility, NOT part
 * of the exact-probability core; it never feeds a probability number.
 */

export type Rng = () => number;

/** mulberry32 — tiny, fast, good-enough distribution for a card shuffle. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a NEW array, driven by the given rng. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** A fresh non-crypto seed for a new game (caller supplies the entropy). */
export function seedFrom(n: number): number {
  return (n ^ 0x9e3779b9) >>> 0;
}
