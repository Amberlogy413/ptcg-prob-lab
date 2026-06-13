/**
 * v2 golden replay (docs/02 §6.4 + §10): the TS implementations in
 * src/lib/probx must match the INDEPENDENT Python reference
 * (scripts/generate_golden_v2.py) character-for-character — exact reduced
 * fractions plus 15-place round-half-up decimals. Same law as the seed
 * pipeline: when this fails, the code is wrong, never the vectors.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

import { fractionStr, decimalStr, rat } from "../src/lib/prob/index.ts";
import { energyShortfallCurve } from "../src/lib/probx/energy.ts";
import { luckTail } from "../src/lib/probx/luck.ts";
import { relayEvent } from "../src/lib/probx/relay.ts";
import { searchFoldValid } from "../src/lib/probx/fold.ts";
import { optimizeAllocations, type OptimizerCandidate } from "../src/lib/probx/optimizer.ts";
import { midgameAtLeast } from "../src/lib/probx/midgame.ts";
import { prizePosterior } from "../src/lib/probx/prizesLeft.ts";
import { shuffleBackRedraw } from "../src/lib/probx/shuffleBack.ts";
import { seenCurveValid } from "../src/lib/probx/seenCurve.ts";

interface V2Case {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  expect: Record<string, unknown>;
}

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), "golden", "golden_vectors_v2.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as { meta: unknown; cases: V2Case[] };

function parseFrac(s: string): { n: bigint; d: bigint } {
  const [n, d] = s.split("/");
  return rat(BigInt(n as string), BigInt(d as string));
}

describe("golden v2 vectors (independent Python reference)", () => {
  for (const c of golden.cases) {
    it(`${c.kind} :: ${c.id}`, () => {
      if (c.kind === "energy_curve_valid") {
        const p = c.params as {
          N: number;
          H: number;
          E: number;
          B: number;
          want: number;
          n_seen: number[];
        };
        const exp = c.expect as {
          p_valid: string;
          by_n: Record<string, string>;
          by_n_dec: Record<string, string>;
        };
        const r = energyShortfallCurve(p.E, p.B, p.want, p.n_seen, p.N, p.H);
        expect.soft(fractionStr(r.pValid), `${c.id} :: p_valid`).toBe(exp.p_valid);
        r.points.forEach((point) => {
          expect
            .soft(fractionStr(point.p), `${c.id} :: by_n[${point.nSeen}]`)
            .toBe(exp.by_n[String(point.nSeen)]);
          expect
            .soft(decimalStr(point.p, 15), `${c.id} :: by_n_dec[${point.nSeen}]`)
            .toBe(exp.by_n_dec[String(point.nSeen)]);
        });
      } else if (c.kind === "luck_tail") {
        const p = c.params as { p: string; n: number };
        const exp = c.expect as { tail: string; tail_dec: string };
        const tail = luckTail(parseFrac(p.p), p.n);
        expect.soft(fractionStr(tail), `${c.id} :: tail`).toBe(exp.tail);
        expect.soft(decimalStr(tail, 15), `${c.id} :: tail_dec`).toBe(exp.tail_dec);
      } else if (c.kind === "relay_event") {
        const p = c.params as {
          N: number;
          cA: number;
          cB: number;
          wA: number;
          wB: number;
          n1: number;
          n2: number;
        };
        const exp = c.expect as { p: string; p_dec: string };
        const r = relayEvent(p.cA, p.cB, p.wA, p.wB, p.n1, p.n2, p.N);
        expect.soft(fractionStr(r), `${c.id} :: p`).toBe(exp.p);
        expect.soft(decimalStr(r, 15), `${c.id} :: p_dec`).toBe(exp.p_dec);
      } else if (c.kind === "search_fold_valid") {
        const p = c.params as {
          N: number;
          H: number;
          x: number;
          x_basic: boolean;
          s: number;
          ob: number;
          want: number;
        };
        const exp = c.expect as {
          optimistic: string;
          optimistic_dec: string;
          conservative: string;
          conservative_dec: string;
          p_valid: string;
        };
        const r = searchFoldValid(p.x, p.x_basic, p.s, p.ob, p.want, p.N, p.H);
        expect.soft(fractionStr(r.optimistic), `${c.id} :: optimistic`).toBe(exp.optimistic);
        expect.soft(decimalStr(r.optimistic, 15), `${c.id} :: optimistic_dec`).toBe(exp.optimistic_dec);
        expect.soft(fractionStr(r.conservative), `${c.id} :: conservative`).toBe(exp.conservative);
        expect
          .soft(decimalStr(r.conservative, 15), `${c.id} :: conservative_dec`)
          .toBe(exp.conservative_dec);
        expect.soft(fractionStr(r.pValid), `${c.id} :: p_valid`).toBe(exp.p_valid);
      } else if (c.kind === "optimizer_enum") {
        const p = c.params as {
          N: number;
          H: number;
          free: number;
          ob: number;
          cands: Array<{ base: number; basic: boolean; want: number }>;
        };
        const exp = c.expect as { allocs: Record<string, string>; best: string; best_dec: string };
        const cands: OptimizerCandidate[] = p.cands.map((cd) => ({
          base: cd.base,
          isBasic: cd.basic,
          want: cd.want,
        }));
        const r = optimizeAllocations(cands, p.free, p.ob, p.N, p.H);
        expect.soft(Object.keys(exp.allocs)).toHaveLength(r.cells.length);
        for (const cell of r.cells) {
          const key = cell.alloc.join("_");
          expect.soft(fractionStr(cell.p), `${c.id} :: alloc[${key}]`).toBe(exp.allocs[key]);
        }
        expect.soft(r.best.alloc.join("_"), `${c.id} :: best`).toBe(exp.best);
        expect.soft(decimalStr(r.best.p, 15), `${c.id} :: best_dec`).toBe(exp.best_dec);
      } else if (c.kind === "midgame") {
        const p = c.params as { u: number; x: number; w: number; k: number };
        const exp = c.expect as { p: string; p_dec: string };
        const r = midgameAtLeast(p);
        expect.soft(fractionStr(r), `${c.id} :: p`).toBe(exp.p);
        expect.soft(decimalStr(r, 15), `${c.id} :: p_dec`).toBe(exp.p_dec);
      } else if (c.kind === "prize_posterior_p") {
        const p = c.params as { u: number; ux: number; p: number };
        const exp = c.expect as {
          dist: Record<string, string>;
          e: string;
          e_dec: string;
          still: string;
          next: string;
          al1: string;
          al1_dec: string;
        };
        const r = prizePosterior(p.u, p.ux, p.p);
        expect.soft(r.dist.length, `${c.id} :: dist length`).toBe(Object.keys(exp.dist).length);
        r.dist.forEach((f, j) => {
          expect.soft(fractionStr(f), `${c.id} :: dist[${j}]`).toBe(exp.dist[String(j)]);
        });
        expect.soft(fractionStr(r.e), `${c.id} :: e`).toBe(exp.e);
        expect.soft(decimalStr(r.e, 15), `${c.id} :: e_dec`).toBe(exp.e_dec);
        expect.soft(fractionStr(r.still), `${c.id} :: still`).toBe(exp.still);
        expect.soft(fractionStr(r.next), `${c.id} :: next`).toBe(exp.next);
        expect.soft(fractionStr(r.atLeastOne), `${c.id} :: al1`).toBe(exp.al1);
        expect.soft(decimalStr(r.atLeastOne, 15), `${c.id} :: al1_dec`).toBe(exp.al1_dec);
      } else if (c.kind === "shuffle_back_redraw") {
        const p = c.params as {
          D: number;
          p: number;
          unseen: number[];
          returned: number[];
          h: number;
          draw: number;
          mins: number[];
          maxs: number[];
        };
        const exp = c.expect as { p: string; p_dec: string };
        const r = shuffleBackRedraw(p);
        expect.soft(fractionStr(r), `${c.id} :: p`).toBe(exp.p);
        expect.soft(decimalStr(r, 15), `${c.id} :: p_dec`).toBe(exp.p_dec);
      } else if (c.kind === "seen_curve_valid") {
        const p = c.params as {
          N: number;
          H: number;
          x: number;
          x_basic: boolean;
          ob: number;
          want: number;
          n_seen: number[];
        };
        const exp = c.expect as {
          p_valid: string;
          by_n: Record<string, string>;
          by_n_dec: Record<string, string>;
        };
        const r = seenCurveValid(p.x, p.x_basic, p.ob, p.want, p.n_seen, p.N, p.H);
        expect.soft(fractionStr(r.pValid), `${c.id} :: p_valid`).toBe(exp.p_valid);
        r.points.forEach((point) => {
          expect
            .soft(fractionStr(point.p), `${c.id} :: by_n[${point.nSeen}]`)
            .toBe(exp.by_n[String(point.nSeen)]);
          expect
            .soft(decimalStr(point.p, 15), `${c.id} :: by_n_dec[${point.nSeen}]`)
            .toBe(exp.by_n_dec[String(point.nSeen)]);
        });
      } else {
        throw new Error(`no verifier for v2 kind '${c.kind}'`);
      }
    });
  }

  it("v2 pipeline never touches the protected seed vectors", () => {
    // The original 27-case file must still exist alongside, unmodified in
    // structure (full byte-protection is asserted via git in CI/ship-check).
    const seedPath = join(dirname(fileURLToPath(import.meta.url)), "golden", "golden_vectors.json");
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as { cases: unknown[] };
    expect(seed.cases).toHaveLength(27);
  });
});
