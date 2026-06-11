/**
 * Heavy-query worker (docs/03 §5): joint tables estimated >2,000 cells and
 * sweep/compare batches run here. postMessage uses structured clone — BigInt
 * rationals transfer as-is; never JSON.stringify these payloads.
 */

import { comboOpening, type TrackedCard, type ComboOptions } from "../lib/prob/index.ts";

interface ComboJobMsg {
  cards: TrackedCard[];
  opts: ComboOptions;
}

export type ProbWorkerRequest =
  | { id: number; kind: "combo"; cards: TrackedCard[]; opts: ComboOptions }
  | { id: number; kind: "comboBatch"; jobs: ComboJobMsg[] };

export type ProbWorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof comboOpening> }
  | { id: number; ok: true; results: Array<ReturnType<typeof comboOpening> | null> }
  | { id: number; ok: false; error: string };

const post = (msg: ProbWorkerResponse) => (self as unknown as Worker).postMessage(msg);

self.onmessage = (e: MessageEvent<ProbWorkerRequest>) => {
  const { id } = e.data;
  try {
    if (e.data.kind === "combo") {
      post({ id, ok: true, result: comboOpening(e.data.cards, e.data.opts) });
    } else if (e.data.kind === "comboBatch") {
      const results = e.data.jobs.map((j) => {
        try {
          return comboOpening(j.cards, j.opts);
        } catch {
          return null; // impossible job — reported as a gap, not a crash
        }
      });
      post({ id, ok: true, results });
    } else {
      throw new Error("unknown kind");
    }
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
