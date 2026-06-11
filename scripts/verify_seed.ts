/**
 * Golden-vector verifier — the seed core's proof of correctness.
 *
 * Replays every case in tests/golden/golden_vectors.json (produced by the
 * INDEPENDENT Python `fractions` generator, scripts/generate_golden.py)
 * through the TypeScript core and demands exact, reduced-fraction string
 * equality, plus character-exact 15-place round-half-up decimals.
 *
 * Run:  node --experimental-strip-types scripts/verify_seed.ts
 * Exit: 0 only if every assertion in every case passes.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// --------------------------------------------------------------------------
// Harness
// --------------------------------------------------------------------------

interface GoldenCase {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  expect: Record<string, unknown>;
}

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, "..", "tests", "golden", "golden_vectors.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
  meta: unknown;
  cases: GoldenCase[];
};

let assertions = 0;
let failures = 0;
const failedCases = new Set<string>();

function check(caseId: string, field: string, actual: string, expected: string): void {
  assertions += 1;
  if (actual !== expected) {
    failures += 1;
    failedCases.add(caseId);
    console.error(`FAIL ${caseId} :: ${field}\n  expected ${expected}\n  actual   ${actual}`);
  }
}

function checkRat(caseId: string, field: string, actual: Rat, expected: unknown): void {
  check(caseId, field, fractionStr(actual), String(expected));
}

function checkDec(caseId: string, field: string, actual: Rat, expected: unknown): void {
  check(caseId, field, decimalStr(actual, 15), String(expected));
}

function checkRatList(caseId: string, field: string, actual: Rat[], expected: unknown): void {
  const exp = expected as string[];
  check(caseId, `${field}.length`, String(actual.length), String(exp.length));
  const n = Math.min(actual.length, exp.length);
  for (let i = 0; i < n; i++) checkRat(caseId, `${field}[${i}]`, actual[i], exp[i]);
}

function checkDecList(caseId: string, field: string, actual: Rat[], expected: unknown): void {
  const exp = expected as string[];
  const n = Math.min(actual.length, exp.length);
  for (let i = 0; i < n; i++) checkDec(caseId, `${field}[${i}]`, actual[i], exp[i]);
}

/** cell_a_b_c → [a, b, c]; used to look up joint-table entries. */
function parseCellKey(key: string): number[] | null {
  const m = /^cell_(\d+(?:_\d+)*)$/.exec(key);
  if (!m) return null;
  return m[1].split("_").map(Number);
}

function lookupCell(
  table: Array<{ ks: number[]; p: Rat }>,
  ks: number[],
): Rat | undefined {
  return table.find(
    (c) => c.ks.length === ks.length && c.ks.every((v, i) => v === ks[i]),
  )?.p;
}

function checkCells(
  caseId: string,
  expect: Record<string, unknown>,
  table: Array<{ ks: number[]; p: Rat }>,
): void {
  for (const [key, value] of Object.entries(expect)) {
    const ks = parseCellKey(key);
    if (!ks) continue;
    const p = lookupCell(table, ks);
    if (p === undefined) {
      assertions += 1;
      failures += 1;
      failedCases.add(caseId);
      console.error(`FAIL ${caseId} :: ${key} — combination [${ks}] missing from table`);
      continue;
    }
    checkRat(caseId, key, p, value);
  }
}

// --------------------------------------------------------------------------
// Dispatch per kind
// --------------------------------------------------------------------------

function runOpeningBasics(c: GoldenCase): void {
  const p = c.params as { N: number; H: number; basics: number };
  const r = openingBasics(p.basics, p.N, p.H);
  checkRatList(c.id, "dist", r.dist, c.expect.dist);
  checkDecList(c.id, "dist_dec", r.dist, c.expect.dist_dec);
  checkRat(c.id, "mulligan", r.mulligan, c.expect.mulligan);
  checkDec(c.id, "mulligan_dec", r.mulligan, c.expect.mulligan_dec);
  checkRat(c.id, "valid", r.valid, c.expect.valid);
  checkRatList(c.id, "conditional_dist", r.conditionalDist, c.expect.conditional_dist);
  checkRat(c.id, "expected_mulligans", r.expectedMulligans, c.expect.expected_mulligans);
  checkDec(c.id, "expected_mulligans_dec", r.expectedMulligans, c.expect.expected_mulligans_dec);
  checkRat(
    c.id,
    "expected_basics_unconditional",
    r.expectedBasics,
    c.expect.expected_basics_unconditional,
  );
}

function trackedFromParams(
  counts: number[],
  constraints: Array<[number, number]>,
  basicFlags?: boolean[],
): TrackedCard[] {
  return counts.map((count, i) => ({
    count,
    min: constraints[i][0],
    max: constraints[i][1],
    ...(basicFlags ? { isBasic: basicFlags[i] } : {}),
  }));
}

function runComboEvent(c: GoldenCase): void {
  const p = c.params as {
    N: number;
    H: number;
    counts: number[];
    constraints: Array<[number, number]>;
  };
  const r = comboOpening(trackedFromParams(p.counts, p.constraints), { N: p.N, H: p.H });
  checkRat(c.id, "event", r.event, c.expect.event);
  if (c.expect.event_dec !== undefined) checkDec(c.id, "event_dec", r.event, c.expect.event_dec);
  checkCells(c.id, c.expect, r.table);
}

function runComboEventValid(c: GoldenCase): void {
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
  checkRat(c.id, "event_given_valid", r.event, c.expect.event_given_valid);
  if (c.expect.event_given_valid_dec !== undefined) {
    checkDec(c.id, "event_given_valid_dec", r.event, c.expect.event_given_valid_dec);
  }
  if (r.pValid === undefined) {
    assertions += 1;
    failures += 1;
    failedCases.add(c.id);
    console.error(`FAIL ${c.id} :: pValid missing from mulligan-aware result`);
  } else {
    checkRat(c.id, "p_valid", r.pValid, c.expect.p_valid);
  }
}

function runPrizeUncond(c: GoldenCase): void {
  const p = c.params as { N: number; P: number; x: number };
  const dist = prizeDistUnconditional(p.x, p.N, p.P);
  checkRatList(c.id, "dist", dist, c.expect.dist);
  if (c.expect.dist_dec !== undefined) checkDecList(c.id, "dist_dec", dist, c.expect.dist_dec);
  const al1 = atLeastOnePrized(dist);
  if (c.expect.at_least_1 !== undefined) checkRat(c.id, "at_least_1", al1, c.expect.at_least_1);
  if (c.expect.at_least_1_dec !== undefined) {
    checkDec(c.id, "at_least_1_dec", al1, c.expect.at_least_1_dec);
  }
}

function runPrizeGivenHand(c: GoldenCase): void {
  const p = c.params as { N: number; H: number; P: number; x: number; in_hand: number };
  const dist = prizeDistGivenHand(p.x, p.in_hand, p.N, p.H, p.P);
  checkRatList(c.id, "dist", dist, c.expect.dist);
  if (c.expect.dist_dec !== undefined) checkDecList(c.id, "dist_dec", dist, c.expect.dist_dec);
  checkRat(c.id, "at_least_1", atLeastOnePrized(dist), c.expect.at_least_1);
}

function runPrizePregameValid(c: GoldenCase): void {
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
  checkRatList(c.id, "dist", r.dist, c.expect.dist);
  if (c.expect.dist_dec !== undefined) checkDecList(c.id, "dist_dec", r.dist, c.expect.dist_dec);
  checkRat(c.id, "expected_prized", r.expected, c.expect.expected_prized);
  if (c.expect.expected_prized_dec !== undefined) {
    checkDec(c.id, "expected_prized_dec", r.expected, c.expect.expected_prized_dec);
  }
  if (c.expect.at_least_1 !== undefined) {
    checkRat(c.id, "at_least_1", r.atLeastOne, c.expect.at_least_1);
  }
  if (c.expect.at_least_1_dec !== undefined) {
    checkDec(c.id, "at_least_1_dec", r.atLeastOne, c.expect.at_least_1_dec);
  }
  if (c.expect.p_valid !== undefined) {
    if (r.pValid === undefined) {
      assertions += 1;
      failures += 1;
      failedCases.add(c.id);
      console.error(`FAIL ${c.id} :: pValid missing from conditioned pre-game result`);
    } else {
      checkRat(c.id, "p_valid", r.pValid, c.expect.p_valid);
    }
  }
}

function runPrizeJointGivenHand(c: GoldenCase): void {
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
    min: p.constraints[i][0],
    max: p.constraints[i][1],
  }));
  const r = prizeJointGivenHand(cards, { N: p.N, H: p.H, P: p.P });
  checkRat(c.id, "event", r.event, c.expect.event);
  if (c.expect.event_dec !== undefined) checkDec(c.id, "event_dec", r.event, c.expect.event_dec);
  checkCells(c.id, c.expect, r.table);
}

function runTurnCurve(c: GoldenCase): void {
  const p = c.params as { N: number; x: number; n_seen: number[] };
  const exp = c.expect.at_least_1_by_n as Record<string, string>;
  for (const n of p.n_seen) {
    checkRat(c.id, `at_least_1_by_n[${n}]`, pSeenAtLeast(p.x, n, 1, p.N), exp[String(n)]);
  }
}

const dispatch: Record<string, (c: GoldenCase) => void> = {
  opening_basics: runOpeningBasics,
  combo_event: runComboEvent,
  combo_event_valid: runComboEventValid,
  prize_uncond: runPrizeUncond,
  prize_given_hand: runPrizeGivenHand,
  prize_pregame_valid: runPrizePregameValid,
  prize_joint_given_hand: runPrizeJointGivenHand,
  turn_curve: runTurnCurve,
};

// --------------------------------------------------------------------------
// Run
// --------------------------------------------------------------------------

let unknownKinds = 0;
for (const c of golden.cases) {
  const fn = dispatch[c.kind];
  if (!fn) {
    unknownKinds += 1;
    console.error(`FAIL ${c.id} :: no verifier for kind '${c.kind}'`);
    continue;
  }
  try {
    fn(c);
  } catch (err) {
    failures += 1;
    failedCases.add(c.id);
    console.error(`FAIL ${c.id} :: threw ${(err as Error).message}`);
  }
}

const caseCount = golden.cases.length;
const failedCaseCount = failedCases.size + unknownKinds;
console.log(
  `\ngolden cases: ${caseCount}  |  assertions: ${assertions}  |  ` +
    `failed assertions: ${failures}  |  failed cases: ${failedCaseCount}`,
);
if (failures === 0 && unknownKinds === 0) {
  console.log("ALL GOLDEN VECTORS PASS — TypeScript core matches the independent Python reference exactly.");
  process.exit(0);
} else {
  console.error("GOLDEN VERIFICATION FAILED.");
  process.exit(1);
}
