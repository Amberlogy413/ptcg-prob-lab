/**
 * Vitest port of scripts/verify_seed.ts — same JSON, same assertion semantics.
 *
 * Every case from tests/golden/golden_vectors.json (independent Python
 * `fractions` generator) is replayed through the TypeScript core and must
 * match with exact reduced-fraction string equality plus character-exact
 * 15-place round-half-up decimals. The Node-direct verifier remains the
 * second line of defense (`npm run verify:seed`).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  type Rat,
  openingBasics,
  comboOpening,
  type TrackedCard,
  prizeDistUnconditional,
  prizeDistGivenHand,
  prizeDistPreGame,
  prizeJointGivenHand,
  type PrizeTrackedCard,
  atLeastOnePrized,
  pSeenAtLeast,
  fractionStr,
  decimalStr,
} from "../src/lib/prob/index.ts";
import { GOLDEN_CASE_COUNT, GOLDEN_ASSERTION_COUNT } from "../src/constants.ts";

// ---------------------------------------------------------------------------
// Harness — mirrors verify_seed.ts check-for-check so totals stay comparable.
// ---------------------------------------------------------------------------

interface GoldenCase {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  expect: Record<string, unknown>;
}

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), "golden", "golden_vectors.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
  meta: unknown;
  cases: GoldenCase[];
};

/** One exact string comparison; `actual !== expected` is a failure. */
interface Assertion {
  field: string;
  actual: string;
  expected: string;
}

class Checks {
  readonly list: Assertion[] = [];

  check(field: string, actual: string, expected: unknown): void {
    this.list.push({ field, actual, expected: String(expected) });
  }

  rat(field: string, actual: Rat, expected: unknown): void {
    this.check(field, fractionStr(actual), expected);
  }

  dec(field: string, actual: Rat, expected: unknown): void {
    this.check(field, decimalStr(actual, 15), expected);
  }

  ratList(field: string, actual: Rat[], expected: unknown): void {
    const exp = expected as string[];
    this.check(`${field}.length`, String(actual.length), String(exp.length));
    const n = Math.min(actual.length, exp.length);
    for (let i = 0; i < n; i++) this.rat(`${field}[${i}]`, actual[i] as Rat, exp[i]);
  }

  decList(field: string, actual: Rat[], expected: unknown): void {
    const exp = expected as string[];
    const n = Math.min(actual.length, exp.length);
    for (let i = 0; i < n; i++) this.dec(`${field}[${i}]`, actual[i] as Rat, exp[i]);
  }

  missing(field: string, expected: unknown, what: string): void {
    this.list.push({ field, actual: `<${what}>`, expected: String(expected) });
  }
}

/** cell_a_b_c → [a, b, c]; used to look up joint-table entries. */
function parseCellKey(key: string): number[] | null {
  const m = /^cell_(\d+(?:_\d+)*)$/.exec(key);
  if (!m) return null;
  return (m[1] as string).split("_").map(Number);
}

function lookupCell(table: Array<{ ks: number[]; p: Rat }>, ks: number[]): Rat | undefined {
  return table.find((c) => c.ks.length === ks.length && c.ks.every((v, i) => v === ks[i]))?.p;
}

function checkCells(
  ck: Checks,
  expectFields: Record<string, unknown>,
  table: Array<{ ks: number[]; p: Rat }>,
): void {
  for (const [key, value] of Object.entries(expectFields)) {
    const ks = parseCellKey(key);
    if (!ks) continue;
    const p = lookupCell(table, ks);
    if (p === undefined) {
      ck.missing(key, value, `combination [${ks.join(",")}] missing from table`);
      continue;
    }
    ck.rat(key, p, value);
  }
}

// ---------------------------------------------------------------------------
// Dispatch per kind
// ---------------------------------------------------------------------------

function runOpeningBasics(c: GoldenCase, ck: Checks): void {
  const p = c.params as { N: number; H: number; basics: number };
  const r = openingBasics(p.basics, p.N, p.H);
  ck.ratList("dist", r.dist, c.expect.dist);
  ck.decList("dist_dec", r.dist, c.expect.dist_dec);
  ck.rat("mulligan", r.mulligan, c.expect.mulligan);
  ck.dec("mulligan_dec", r.mulligan, c.expect.mulligan_dec);
  ck.rat("valid", r.valid, c.expect.valid);
  ck.ratList("conditional_dist", r.conditionalDist, c.expect.conditional_dist);
  ck.rat("expected_mulligans", r.expectedMulligans, c.expect.expected_mulligans);
  ck.dec("expected_mulligans_dec", r.expectedMulligans, c.expect.expected_mulligans_dec);
  ck.rat("expected_basics_unconditional", r.expectedBasics, c.expect.expected_basics_unconditional);
}

function trackedFromParams(
  counts: number[],
  constraints: Array<[number, number]>,
  basicFlags?: boolean[],
): TrackedCard[] {
  return counts.map((count, i) => ({
    count,
    min: (constraints[i] as [number, number])[0],
    max: (constraints[i] as [number, number])[1],
    ...(basicFlags ? { isBasic: basicFlags[i] } : {}),
  }));
}

function runComboEvent(c: GoldenCase, ck: Checks): void {
  const p = c.params as {
    N: number;
    H: number;
    counts: number[];
    constraints: Array<[number, number]>;
  };
  const r = comboOpening(trackedFromParams(p.counts, p.constraints), { N: p.N, H: p.H });
  ck.rat("event", r.event, c.expect.event);
  if (c.expect.event_dec !== undefined) ck.dec("event_dec", r.event, c.expect.event_dec);
  checkCells(ck, c.expect, r.table);
}

function runComboEventValid(c: GoldenCase, ck: Checks): void {
  const p = c.params as {
    N: number;
    H: number;
    counts: number[];
    constraints: Array<[number, number]>;
    basic_flags: boolean[];
    other_basics: number;
  };
  const r = comboOpening(trackedFromParams(p.counts, p.constraints, p.basic_flags), {
    N: p.N,
    H: p.H,
    mulliganAware: { otherBasics: p.other_basics },
  });
  ck.rat("event_given_valid", r.event, c.expect.event_given_valid);
  if (c.expect.event_given_valid_dec !== undefined) {
    ck.dec("event_given_valid_dec", r.event, c.expect.event_given_valid_dec);
  }
  if (r.pValid === undefined) {
    ck.missing("p_valid", c.expect.p_valid, "pValid missing from mulligan-aware result");
  } else {
    ck.rat("p_valid", r.pValid, c.expect.p_valid);
  }
}

function runPrizeUncond(c: GoldenCase, ck: Checks): void {
  const p = c.params as { N: number; P: number; x: number };
  const dist = prizeDistUnconditional(p.x, p.N, p.P);
  ck.ratList("dist", dist, c.expect.dist);
  if (c.expect.dist_dec !== undefined) ck.decList("dist_dec", dist, c.expect.dist_dec);
  const al1 = atLeastOnePrized(dist);
  if (c.expect.at_least_1 !== undefined) ck.rat("at_least_1", al1, c.expect.at_least_1);
  if (c.expect.at_least_1_dec !== undefined) ck.dec("at_least_1_dec", al1, c.expect.at_least_1_dec);
}

function runPrizeGivenHand(c: GoldenCase, ck: Checks): void {
  const p = c.params as { N: number; H: number; P: number; x: number; in_hand: number };
  const dist = prizeDistGivenHand(p.x, p.in_hand, p.N, p.H, p.P);
  ck.ratList("dist", dist, c.expect.dist);
  if (c.expect.dist_dec !== undefined) ck.decList("dist_dec", dist, c.expect.dist_dec);
  ck.rat("at_least_1", atLeastOnePrized(dist), c.expect.at_least_1);
}

function runPrizePregameValid(c: GoldenCase, ck: Checks): void {
  const p = c.params as {
    N: number;
    H: number;
    P: number;
    x: number;
    x_is_basic: boolean;
    other_basics: number;
  };
  const r = prizeDistPreGame(p.x, {
    isBasic: p.x_is_basic,
    otherBasics: p.other_basics,
    conditionOnValid: true,
    N: p.N,
    H: p.H,
    P: p.P,
  });
  ck.ratList("dist", r.dist, c.expect.dist);
  if (c.expect.dist_dec !== undefined) ck.decList("dist_dec", r.dist, c.expect.dist_dec);
  ck.rat("expected_prized", r.expected, c.expect.expected_prized);
  if (c.expect.expected_prized_dec !== undefined) {
    ck.dec("expected_prized_dec", r.expected, c.expect.expected_prized_dec);
  }
  if (c.expect.at_least_1 !== undefined) ck.rat("at_least_1", r.atLeastOne, c.expect.at_least_1);
  if (c.expect.at_least_1_dec !== undefined) {
    ck.dec("at_least_1_dec", r.atLeastOne, c.expect.at_least_1_dec);
  }
  if (c.expect.p_valid !== undefined) {
    if (r.pValid === undefined) {
      ck.missing("p_valid", c.expect.p_valid, "pValid missing from conditioned pre-game result");
    } else {
      ck.rat("p_valid", r.pValid, c.expect.p_valid);
    }
  }
}

function runPrizeJointGivenHand(c: GoldenCase, ck: Checks): void {
  const p = c.params as {
    N: number;
    H: number;
    P: number;
    cards: Array<[number, number]>;
    constraints: Array<[number, number]>;
  };
  const cards: PrizeTrackedCard[] = p.cards.map(([count, inHand], i) => ({
    count,
    inHand,
    min: (p.constraints[i] as [number, number])[0],
    max: (p.constraints[i] as [number, number])[1],
  }));
  const r = prizeJointGivenHand(cards, { N: p.N, H: p.H, P: p.P });
  ck.rat("event", r.event, c.expect.event);
  if (c.expect.event_dec !== undefined) ck.dec("event_dec", r.event, c.expect.event_dec);
  checkCells(ck, c.expect, r.table);
}

function runTurnCurve(c: GoldenCase, ck: Checks): void {
  const p = c.params as { N: number; x: number; n_seen: number[] };
  const exp = c.expect.at_least_1_by_n as Record<string, string>;
  for (const n of p.n_seen) {
    ck.rat(`at_least_1_by_n[${n}]`, pSeenAtLeast(p.x, n, 1, p.N), exp[String(n)]);
  }
}

const dispatch: Record<string, (c: GoldenCase, ck: Checks) => void> = {
  opening_basics: runOpeningBasics,
  combo_event: runComboEvent,
  combo_event_valid: runComboEventValid,
  prize_uncond: runPrizeUncond,
  prize_given_hand: runPrizeGivenHand,
  prize_pregame_valid: runPrizePregameValid,
  prize_joint_given_hand: runPrizeJointGivenHand,
  turn_curve: runTurnCurve,
};

function runCase(c: GoldenCase): Assertion[] {
  const fn = dispatch[c.kind];
  if (!fn) throw new Error(`no verifier for kind '${c.kind}'`);
  const ck = new Checks();
  fn(c, ck);
  return ck.list;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("golden vectors (independent Python reference)", () => {
  for (const c of golden.cases) {
    it(`${c.kind} :: ${c.id}`, () => {
      for (const a of runCase(c)) {
        expect.soft(a.actual, `${c.id} :: ${a.field}`).toBe(a.expected);
      }
    });
  }

  it(`totals match the published counts (${GOLDEN_CASE_COUNT} cases / ${GOLDEN_ASSERTION_COUNT} assertions)`, () => {
    expect(golden.cases.length).toBe(GOLDEN_CASE_COUNT);
    let total = 0;
    for (const c of golden.cases) total += runCase(c).length;
    expect(total).toBe(GOLDEN_ASSERTION_COUNT);
  });
});
