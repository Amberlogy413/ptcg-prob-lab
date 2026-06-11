/**
 * Q2 compute hook. Small tables (≤2,000 estimated cells) run synchronously on
 * the main thread (<10ms); larger ones go to prob.worker.ts with stale-id
 * cancellation (docs/03 §5). Falls back to sync where Worker is unavailable
 * (tests, old browsers).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { comboOpening } from "../lib/prob/index.ts";
import type { Deck } from "./deckStore.ts";
import type { TrackedQueryCard } from "./queryStore.ts";
import {
  buildComboParams,
  computeQ2Display,
  type Q2BuildOk,
  type Q2Data,
} from "./selectors.ts";
import type { ProbWorkerRequest, ProbWorkerResponse } from "../workers/prob.worker.ts";

const WORKER_CELL_THRESHOLD = 2000;

let worker: Worker | null = null;
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/prob.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export type ComboResultState =
  | { status: "empty" | "tooFewCards" | "noBasicsForAware" | "computing" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Q2Data };

export function useComboResult(
  deck: Deck | null,
  tracked: TrackedQueryCard[],
  mulliganAware: boolean,
): ComboResultState {
  const build = useMemo(() => {
    if (!deck) return null;
    return buildComboParams(deck, tracked, mulliganAware);
  }, [deck, tracked, mulliganAware]);

  const syncResult = useMemo<ComboResultState | null>(() => {
    if (!build) return { status: "empty" };
    if (build.status !== "ok") return { status: build.status };
    if (build.estimatedCells > WORKER_CELL_THRESHOLD && typeof Worker !== "undefined") {
      return null; // worker path
    }
    try {
      const result = comboOpening(build.cards, build.opts);
      return { status: "ready", data: computeQ2Display(result, build) };
    } catch (err) {
      return { status: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }, [build]);

  const [asyncResult, setAsyncResult] = useState<ComboResultState>({ status: "computing" });
  const requestId = useRef(0);

  useEffect(() => {
    if (syncResult !== null || !build || build.status !== "ok") return;
    const id = ++requestId.current;
    setAsyncResult({ status: "computing" });
    const w = getWorker();
    const onMessage = (e: MessageEvent<ProbWorkerResponse>) => {
      if (e.data.id !== id) return; // stale response — ignore
      if (e.data.ok) {
        setAsyncResult({ status: "ready", data: computeQ2Display(e.data.result, build as Q2BuildOk) });
      } else {
        setAsyncResult({ status: "error", message: e.data.error });
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, kind: "combo", cards: build.cards, opts: build.opts } satisfies ProbWorkerRequest);
    return () => w.removeEventListener("message", onMessage);
  }, [build, syncResult]);

  return syncResult ?? asyncResult;
}
