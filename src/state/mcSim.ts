/**
 * Monte-Carlo verification simulator (docs/05 §D). Full rule replay:
 * Fisher–Yates over 60 cards, mulligan loop (redraw until ≥1 Basic when
 * conditioning), tracked-card constraint check on the kept hand.
 *
 * Floats are fine HERE — this is verification/teaching only and lives outside
 * src/lib/prob; the product's answers remain the exact rationals.
 */

export interface McComboParams {
  counts: number[];
  constraints: Array<[number, number]>;
  isBasic: boolean[];
  /** Basics outside the tracked cards; −1 disables mulligan conditioning. */
  otherBasics: number;
  N: number;
  H: number;
  iterations: number;
  seed: number;
}

export interface McResult {
  hits: number;
  n: number;
}

/** mulberry32 — tiny seedable PRNG, good enough for teaching simulations. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateCombo(p: McComboParams): McResult {
  const m = p.counts.length;
  const aware = p.otherBasics >= 0;

  // Category per card: 0..m-1 tracked, m = other Basics, m+1 = rest.
  const deck = new Uint8Array(p.N);
  let idx = 0;
  for (let i = 0; i < m; i++) for (let c = 0; c < (p.counts[i] as number); c++) deck[idx++] = i;
  if (aware) for (let c = 0; c < p.otherBasics; c++) deck[idx++] = m;
  while (idx < p.N) deck[idx++] = m + 1;

  const rand = mulberry32(p.seed);
  const ks = new Array<number>(m);
  let hits = 0;

  for (let it = 0; it < p.iterations; it++) {
    // Redraw until the hand is valid (real-game mulligan rule).
    for (;;) {
      // Partial Fisher–Yates: only the first H positions matter.
      for (let i = 0; i < p.H; i++) {
        const j = i + Math.floor(rand() * (p.N - i));
        const tmp = deck[i] as number;
        deck[i] = deck[j] as number;
        deck[j] = tmp;
      }
      ks.fill(0);
      let basics = 0;
      for (let i = 0; i < p.H; i++) {
        const cat = deck[i] as number;
        if (cat < m) {
          ks[cat] = (ks[cat] as number) + 1;
          if (p.isBasic[cat]) basics++;
        } else if (cat === m) {
          basics++;
        }
      }
      if (!aware || basics >= 1) break;
    }
    let ok = true;
    for (let i = 0; i < m; i++) {
      const [lo, hi] = p.constraints[i] as [number, number];
      const k = ks[i] as number;
      if (k < lo || k > hi) {
        ok = false;
        break;
      }
    }
    if (ok) hits++;
  }
  return { hits, n: p.iterations };
}
