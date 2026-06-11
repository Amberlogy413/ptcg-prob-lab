/**
 * Heavy-query worker (docs/03 §5): joint tables estimated >2,000 cells run
 * here. postMessage uses structured clone — BigInt rationals transfer as-is;
 * never JSON.stringify these payloads.
 */

import { comboOpening, type TrackedCard, type ComboOptions } from "../lib/prob/index.ts";

export interface ProbWorkerRequest {
  id: number;
  kind: "combo";
  cards: TrackedCard[];
  opts: ComboOptions;
}

export type ProbWorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof comboOpening> }
  | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<ProbWorkerRequest>) => {
  const { id, kind, cards, opts } = e.data;
  try {
    if (kind !== "combo") throw new Error(`unknown kind: ${kind}`);
    const result = comboOpening(cards, opts);
    (self as unknown as Worker).postMessage({ id, ok: true, result } satisfies ProbWorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies ProbWorkerResponse);
  }
};
