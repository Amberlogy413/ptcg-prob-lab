/**
 * Batch runner for sweeps / compare / attribution (docs/03 §5: batches go to
 * the Worker). Falls back to synchronous main-thread compute where Worker is
 * unavailable (tests, very old browsers). Jobs that throw resolve to null.
 */

import { comboOpening, type ComboResult, type TrackedCard, type ComboOptions } from "../lib/prob/index.ts";
import { simulateCombo, type McComboParams, type McResult } from "./mcSim.ts";
import {
  optimizeAllocations,
  type OptimizerCandidate,
  type OptimizerResult,
} from "../lib/probx/optimizer.ts";
import type { ProbWorkerRequest, ProbWorkerResponse } from "../workers/prob.worker.ts";

export interface BatchJob {
  cards: TrackedCard[];
  opts: ComboOptions;
}

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/prob.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export function runComboBatch(jobs: BatchJob[]): Promise<Array<ComboResult | null>> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(
      jobs.map((j) => {
        try {
          return comboOpening(j.cards, j.opts);
        } catch {
          return null;
        }
      }),
    );
  }
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const w = getWorker();
    const onMessage = (e: MessageEvent<ProbWorkerResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (e.data.ok && "results" in e.data) resolve(e.data.results);
      else if (!e.data.ok) reject(new Error(e.data.error));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, kind: "comboBatch", jobs } satisfies ProbWorkerRequest);
  });
}

/** Optimizer enumeration (docs/02 §11) — Worker when available (≤200ms). */
export function runOptimizer(
  cands: OptimizerCandidate[],
  free: number,
  ob: number,
  N = 60,
  H = 7,
): Promise<OptimizerResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(optimizeAllocations(cands, free, ob, N, H));
  }
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const w = getWorker();
    const onMessage = (e: MessageEvent<ProbWorkerResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (e.data.ok && "opt" in e.data) resolve(e.data.opt);
      else if (!e.data.ok) reject(new Error(e.data.error));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, kind: "optimizer", cands, free, ob, N, H } satisfies ProbWorkerRequest);
  });
}

/** Monte-Carlo verification run (docs/05 §D) — Worker when available. */
export function runMcCombo(params: McComboParams): Promise<McResult> {
  if (typeof Worker === "undefined") return Promise.resolve(simulateCombo(params));
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const w = getWorker();
    const onMessage = (e: MessageEvent<ProbWorkerResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (e.data.ok && "mc" in e.data) resolve(e.data.mc);
      else if (!e.data.ok) reject(new Error(e.data.error));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, kind: "mcCombo", params } satisfies ProbWorkerRequest);
  });
}
