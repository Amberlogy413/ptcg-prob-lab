/** Types for the shared 寶可夢功能 classifier (scripts/classify.mjs). */

export interface ClassifiableCard {
  category?: string;
  effect?: string;
  attacks?: { effect?: string; damage?: number | string }[];
  abilities?: { effect?: string }[];
  item?: { effect?: string };
  fn?: string[];
  fnSub?: string[];
}

export const FN_RULES: [string, RegExp][];
export const SUB_RULES: [string, string, RegExp][];

/** Mutates the card: sets `fn` (coarse) and `fnSub` (fine) from its text. */
export function classify(card: ClassifiableCard): void;
