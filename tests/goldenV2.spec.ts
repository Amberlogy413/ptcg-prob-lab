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
