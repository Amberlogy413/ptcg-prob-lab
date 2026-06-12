/**
 * Phase 5 compute layer: turn curve, deck compare, hand grading, dead-hand
 * attribution, trainer questions, prize tracker posterior. Same contract as
 * the other selector modules — exact math in the core, display strings out.
 */

import {
  cardsSeenByTurn,
  pSeenAtLeast,
  comboOpening,
  openingBasics,
  prizeDistUnconditional,
  atLeastOnePrized,
  sumWhere,
  add,
  sub,
  rat,
  cmp,
  isZero,
  R_ONE,
  eq,
  percentStr,
  fractionStr,
  oneInStr,
  decimalStr,
  toChartNumber,
  type Rat,
  type TrackedCard,
  type TurnRuleOptions,
} from "../lib/prob/index.ts";
import { energyShortfallCurve } from "../lib/probx/energy.ts";
import { luckTail } from "../lib/probx/luck.ts";
import { deckTotal, deckBasics, type Deck } from "./deckStore.ts";
import { HAND_SIZE, PRIZE_COUNT } from "../constants.ts";

// ---------------------------------------------------------------------------
// Turn curve (docs/02 §6)
// ---------------------------------------------------------------------------

export interface TurnCurveRow {
  turn: number;
  nSeen: number;
  /** True when nSeen hit the physical 54-card cap (60 − 6 prizes, §6.1). */
  capped: boolean;
  percent: string;
  fraction: string;
  oneIn: string;
  chart: number;
}

export interface TurnCurveQuery {
  x: number;
  want: number;
  goingFirst: boolean;
  extraSeen: number;
  firstPlayerSkipsFirstDraw: boolean;
  maxTurn: number;
}

export function computeTurnCurve(q: TurnCurveQuery, N = 60): TurnCurveRow[] {
  const physicalCap = N - PRIZE_COUNT; // you can never see your 6 prizes (§6.1)
  const opts: TurnRuleOptions = {
    H: HAND_SIZE,
    extraSeen: q.extraSeen,
    firstPlayerSkipsFirstDraw: q.firstPlayerSkipsFirstDraw,
  };
  const rows: TurnCurveRow[] = [];
  for (let turn = 1; turn <= q.maxTurn; turn++) {
    const natural = cardsSeenByTurn(turn, q.goingFirst, opts);
    const nSeen = Math.min(natural, physicalCap);
    const p = pSeenAtLeast(q.x, nSeen, q.want, N);
    rows.push({
      turn,
      nSeen,
      capped: nSeen !== natural,
      percent: percentStr(p, 6),
      fraction: fractionStr(p),
      oneIn: oneInStr(p, 3),
      chart: toChartNumber(p),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Compare (docs/06 Phase 5: A/B same query, delta in pp)
// ---------------------------------------------------------------------------

export interface CompareSideData {
  deckName: string;
  count: number;
  percent: string;
  fraction: string;
  chart: number;
}

export interface CompareData {
  a: CompareSideData;
  b: CompareSideData;
  /** b − a in percentage points, signed (e.g. "+3.98pp"). */
  deltaPp: string;
  deltaSign: -1 | 0 | 1;
  conditioned: boolean;
}

function signedPpFrom(d: Rat): { text: string; sign: -1 | 0 | 1 } {
  const s = decimalStr(rat(d.n * 100n, d.d), 2);
  if (isZero(d)) return { text: "±0.00pp", sign: 0 };
  return s.startsWith("-")
    ? { text: `−${s.slice(1)}pp`, sign: -1 }
    : { text: `+${s}pp`, sign: 1 };
}

/** P(at least `minWant` of card `name` in the opening) for one deck. */
function deckCardEvent(deck: Deck, name: string, minWant: number, aware: boolean): { p: Rat; count: number } | null {
  const N = deckTotal(deck);
  if (N < HAND_SIZE) return null;
  const count = deck.cards
    .filter((c) => c.name === name)
    .reduce((s, c) => s + c.count, 0);
  const isBasic = deck.cards.find((c) => c.name === name)?.isBasic ?? false;
  const basics = deckBasics(deck);
  if (aware && basics < 1) return null;
  const tracked: TrackedCard[] = [
    { label: name, count, min: Math.min(minWant, HAND_SIZE), max: HAND_SIZE, isBasic },
  ];
  const otherBasics = basics - (isBasic ? count : 0);
  const r = comboOpening(tracked, {
    N,
    H: HAND_SIZE,
    ...(aware ? { mulliganAware: { otherBasics } } : {}),
  });
  return { p: r.event, count };
}

export function computeCompare(
  deckA: Deck,
  deckB: Deck,
  name: string,
  minWant: number,
  aware: boolean,
): CompareData | null {
  const a = deckCardEvent(deckA, name, minWant, aware);
  const b = deckCardEvent(deckB, name, minWant, aware);
  if (!a || !b) return null;
  const delta = signedPpFrom(sub(b.p, a.p));
  return {
    a: {
      deckName: deckA.name,
      count: a.count,
      percent: percentStr(a.p, 6),
      fraction: fractionStr(a.p),
      chart: toChartNumber(a.p),
    },
    b: {
      deckName: deckB.name,
      count: b.count,
      percent: percentStr(b.p, 6),
      fraction: fractionStr(b.p),
      chart: toChartNumber(b.p),
    },
    deltaPp: delta.text,
    deltaSign: delta.sign,
    conditioned: aware,
  };
}

/** Mulligan-rate pair for the compare header strip. */
export function compareMulligan(deckA: Deck, deckB: Deck): { a: string; b: string; deltaPp: string; deltaSign: -1 | 0 | 1 } | null {
  const ta = deckTotal(deckA);
  const tb = deckTotal(deckB);
  const ba = deckBasics(deckA);
  const bb = deckBasics(deckB);
  if (ta < HAND_SIZE || tb < HAND_SIZE || ba < 1 || bb < 1) return null;
  const qa = openingBasics(ba, ta, HAND_SIZE).mulligan;
  const qb = openingBasics(bb, tb, HAND_SIZE).mulligan;
  const delta = signedPpFrom(sub(qb, qa));
  return { a: percentStr(qa, 6), b: percentStr(qb, 6), deltaPp: delta.text, deltaSign: delta.sign };
}

// ---------------------------------------------------------------------------
// Hand grading (理想/可用/死手, mulligan-aware) + dead-hand attribution (A1)
// ---------------------------------------------------------------------------

export interface GradeCardDef {
  /** Card name in the deck; counts resolve at compute time. */
  name: string;
  /** Required copies for this grade (≥ min). */
  min: number;
}

export interface GradeDefs {
  ideal: GradeCardDef[];
  playable: GradeCardDef[];
}

export interface GradeData {
  ideal: { percent: string; fraction: string; chart: number };
  playableOnly: { percent: string; fraction: string; chart: number };
  dead: { percent: string; fraction: string; chart: number };
  /** Exact check: the three buckets sum to 1. */
  identityOk: boolean;
  pValid: { fraction: string; percent: string };
}

interface GradeCtx {
  tracked: TrackedCard[];
  names: string[];
  idealMin: number[];
  playableMin: number[];
  otherBasics: number;
  N: number;
}

function buildGradeCtx(deck: Deck, defs: GradeDefs): GradeCtx | null {
  const N = deckTotal(deck);
  if (N < HAND_SIZE) return null;
  const basics = deckBasics(deck);
  if (basics < 1) return null;

  const names = [...new Set([...defs.ideal, ...defs.playable].map((d) => d.name))];
  if (names.length === 0) return null;
  const tracked: TrackedCard[] = [];
  for (const name of names) {
    const cards = deck.cards.filter((c) => c.name === name);
    const count = cards.reduce((s, c) => s + c.count, 0);
    if (count === 0) return null;
    tracked.push({
      label: name,
      count,
      min: 0,
      max: HAND_SIZE,
      isBasic: cards[0]?.isBasic ?? false,
    });
  }
  const trackedBasics = tracked.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
  return {
    tracked,
    names,
    idealMin: names.map((n) => defs.ideal.find((d) => d.name === n)?.min ?? 0),
    playableMin: names.map((n) => defs.playable.find((d) => d.name === n)?.min ?? 0),
    otherBasics: basics - trackedBasics,
    N,
  };
}

type GradeTable = Parameters<typeof sumWhere>[0];

/** Bucket an (already conditioned) joint table into 理想/可用/死手. */
function gradeBuckets(
  table: GradeTable,
  idealMin: number[],
  playableMin: number[],
): { ideal: Rat; playableOnly: Rat; dead: Rat } {
  const meets = (mins: number[]) => (ks: number[]) => ks.every((k, i) => k >= (mins[i] ?? 0));
  const isIdeal = meets(idealMin);
  const isPlayable = meets(playableMin);
  return {
    ideal: sumWhere(table, isIdeal),
    playableOnly: sumWhere(table, (ks) => !isIdeal(ks) && isPlayable(ks)),
    dead: sumWhere(table, (ks) => !isIdeal(ks) && !isPlayable(ks)),
  };
}

function gradeFromCtx(ctx: GradeCtx): { ideal: Rat; playableOnly: Rat; dead: Rat; pValid: Rat } {
  const r = comboOpening(ctx.tracked, {
    N: ctx.N,
    H: HAND_SIZE,
    mulliganAware: { otherBasics: ctx.otherBasics },
  });
  return { ...gradeBuckets(r.table, ctx.idealMin, ctx.playableMin), pValid: r.pValid ?? R_ONE };
}

export function computeGrades(deck: Deck, defs: GradeDefs): GradeData | null {
  const ctx = buildGradeCtx(deck, defs);
  if (!ctx) return null;
  const g = gradeFromCtx(ctx);
  const fmt = (p: Rat) => ({
    percent: percentStr(p, 6),
    fraction: fractionStr(p),
    chart: toChartNumber(p),
  });
  return {
    ideal: fmt(g.ideal),
    playableOnly: fmt(g.playableOnly),
    dead: fmt(g.dead),
    identityOk: eq(add(add(g.ideal, g.playableOnly), g.dead), R_ONE),
    pValid: { fraction: fractionStr(g.pValid), percent: percentStr(g.pValid, 6) },
  };
}

export interface AttributionRow {
  name: string;
  count: number;
  /** Δ dead-hand rate when removing one copy (count−1), in signed pp. */
  minusPp?: string;
  minusSign?: -1 | 0 | 1;
  /** Δ dead-hand rate when adding one copy (count+1), in signed pp. */
  plusPp?: string;
  plusSign?: -1 | 0 | 1;
  /** |best improvement| as float for ranking. */
  impact: number;
}

export interface ComboJob {
  cards: TrackedCard[];
  opts: { N: number; H: number; mulliganAware: { otherBasics: number } };
}

export interface AttributionPlan {
  base: ComboJob;
  idealMin: number[];
  playableMin: number[];
  perturbations: Array<{ name: string; count: number; delta: -1 | 1; job: ComboJob }>;
}

/**
 * A1 dead-hand attribution, planned as a Worker batch (docs/03 §5): for every
 * named deck card, perturb its count ±1 (deck size held at N by swapping with
 * generic non-Basic filler — stated in the UI) and report the dead-rate
 * change. Exact; ~2 jobs per card.
 */
export function buildAttributionPlan(deck: Deck, defs: GradeDefs): AttributionPlan | null {
  const ctx = buildGradeCtx(deck, defs);
  if (!ctx) return null;
  const mkJob = (tracked: TrackedCard[], otherBasics: number): ComboJob => ({
    cards: tracked,
    opts: { N: ctx.N, H: HAND_SIZE, mulliganAware: { otherBasics } },
  });

  const perturbations: AttributionPlan["perturbations"] = [];
  for (const card of deck.cards) {
    if (card.name.trim() === "" || card.count === 0) continue;
    for (const delta of [-1, +1] as const) {
      const newCount = card.count + delta;
      if (newCount < 0) continue;
      const idx = ctx.names.indexOf(card.name);
      const tracked = ctx.tracked.map((c, i) => (i === idx ? { ...c, count: newCount } : { ...c }));
      let otherBasics = ctx.otherBasics;
      if (idx === -1 && card.isBasic) otherBasics += delta;
      if (otherBasics < 0) continue;
      const totalBasicsAfter =
        otherBasics + tracked.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
      if (totalBasicsAfter < 1) continue;
      perturbations.push({
        name: card.name,
        count: card.count,
        delta,
        job: mkJob(tracked, otherBasics),
      });
    }
  }
  return {
    base: mkJob(ctx.tracked, ctx.otherBasics),
    idealMin: ctx.idealMin,
    playableMin: ctx.playableMin,
    perturbations,
  };
}

/** Combine the batch results back into the ranked ±1 table. */
export function finishAttribution(
  plan: AttributionPlan,
  baseTable: GradeTable,
  perturbTables: Array<GradeTable | null>,
): AttributionRow[] {
  const baseDead = gradeBuckets(baseTable, plan.idealMin, plan.playableMin).dead;
  const byName = new Map<string, AttributionRow>();

  plan.perturbations.forEach((pert, i) => {
    const table = perturbTables[i];
    if (!table) return; // job failed (impossible perturbation) — skip honestly
    const dead = gradeBuckets(table, plan.idealMin, plan.playableMin).dead;
    const d = signedPpFrom(sub(dead, baseDead));
    const chartDelta = Math.abs(toChartNumber(sub(dead, baseDead)));
    const row =
      byName.get(pert.name) ?? { name: pert.name, count: pert.count, impact: 0 };
    if (pert.delta === -1) {
      row.minusPp = d.text;
      row.minusSign = d.sign;
    } else {
      row.plusPp = d.text;
      row.plusSign = d.sign;
    }
    row.impact = Math.max(row.impact, chartDelta);
    byName.set(pert.name, row);
  });

  return [...byName.values()].sort((a, b) => b.impact - a.impact);
}

// ---------------------------------------------------------------------------
// Sensitivity sweep (docs/04 §6): count 0–4, filler swap keeps N constant
// ---------------------------------------------------------------------------

export interface SensitivityRow {
  count: number;
  current: boolean;
  percent: string;
  fraction: string;
  chart: number;
}

export interface SensitivityPlan {
  jobs: ComboJob[];
  counts: number[];
  currentCount: number;
}

export function buildSensitivityPlan(
  deck: Deck,
  cardName: string,
  minWant: number,
  aware: boolean,
  maxCount = 4,
): SensitivityPlan | null {
  const N = deckTotal(deck);
  if (N < HAND_SIZE) return null;
  const card = deck.cards.find((c) => c.name === cardName);
  if (!card) return null;
  const basics = deckBasics(deck);
  const obBase = basics - (card.isBasic ? card.count : 0);
  if (aware && obBase < 1 && !card.isBasic) return null;

  const counts: number[] = [];
  const jobs: ComboJob[] = [];
  for (let count = 0; count <= Math.max(maxCount, card.count); count++) {
    if (aware && obBase + (card.isBasic ? count : 0) < 1) continue;
    counts.push(count);
    jobs.push({
      cards: [
        {
          label: card.name,
          count,
          min: Math.min(minWant, HAND_SIZE),
          max: HAND_SIZE,
          isBasic: card.isBasic,
        },
      ],
      opts: { N, H: HAND_SIZE, mulliganAware: { otherBasics: obBase } },
    });
  }
  if (!aware) for (const j of jobs) delete (j.opts as Partial<ComboJob["opts"]>).mulliganAware;
  return { jobs, counts, currentCount: card.count };
}

export function finishSensitivity(
  plan: SensitivityPlan,
  events: Rat[],
): SensitivityRow[] {
  return plan.counts.map((count, i) => ({
    count,
    current: count === plan.currentCount,
    percent: percentStr(events[i] as Rat, 6),
    fraction: fractionStr(events[i] as Rat),
    chart: toChartNumber(events[i] as Rat),
  }));
}

// ---------------------------------------------------------------------------
// Prize tracker posterior (docs/02 §5.5) — C2, pulled forward from V2
// ---------------------------------------------------------------------------

export interface TrackerRow {
  name: string;
  count: number;
  seen: number;
  unseen: number;
  atLeastOnePercent: string;
  atLeastOneFraction: string;
  expected: string;
  chart: number;
}

export function computeTrackerRows(
  cards: Array<{ name: string; count: number; seen: number }>,
  N = 60,
): { u: number; rows: TrackerRow[] } | null {
  const totalSeen = cards.reduce((s, c) => s + Math.min(c.seen, c.count), 0);
  const u = N - totalSeen;
  if (u < PRIZE_COUNT) return null; // cannot see more than N − 6 cards
  const rows = cards
    .filter((c) => c.name.trim() !== "" && c.count > 0)
    .map((c) => {
      const ux = c.count - Math.min(c.seen, c.count);
      const dist = prizeDistUnconditional(ux, u, PRIZE_COUNT);
      const al1 = atLeastOnePrized(dist);
      const expected = rat(BigInt(ux * PRIZE_COUNT), BigInt(u));
      return {
        name: c.name,
        count: c.count,
        seen: Math.min(c.seen, c.count),
        unseen: ux,
        atLeastOnePercent: percentStr(al1, 6),
        atLeastOneFraction: fractionStr(al1),
        expected: decimalStr(expected, 6),
        chart: toChartNumber(al1),
      };
    });
  return { u, rows };
}

// ---------------------------------------------------------------------------
// Trainer (B1) — question generation + exact answers
// ---------------------------------------------------------------------------

export interface TrainerQuestion {
  /** i18n key of the question template. */
  promptKey: string;
  promptParams: Record<string, string | number>;
  /** Exact answer, three formats. */
  percent: string;
  fraction: string;
  oneIn: string;
  /** Float (display-bridge) for error scoring only. */
  exactPct: number;
}

export type TrainerKind =
  | "openingAtLeast1"
  | "prizedAtLeast1"
  | "mulligan"
  | "seenByTurn"
  /** P9.3 loop: a question injected from the trial table's dealt hand. */
  | "trialHand";

export function buildTrainerQuestion(
  deck: Deck,
  kind: TrainerKind,
  cardName: string,
  turn: number,
): TrainerQuestion | null {
  const N = deckTotal(deck);
  if (N < HAND_SIZE) return null;
  const basics = deckBasics(deck);
  const card = deck.cards.find((c) => c.name === cardName);

  let p: Rat;
  let promptKey: string;
  let promptParams: Record<string, string | number>;

  if (kind === "mulligan") {
    if (basics < 1) return null;
    p = openingBasics(basics, N, HAND_SIZE).mulligan;
    promptKey = "trainer.q.mulligan";
    promptParams = { b: basics, n: N };
  } else {
    if (!card || card.count === 0) return null;
    if (kind === "openingAtLeast1") {
      if (basics < 1) return null;
      const otherBasics = basics - (card.isBasic ? card.count : 0);
      p = comboOpening(
        [{ label: card.name, count: card.count, min: 1, max: HAND_SIZE, isBasic: card.isBasic }],
        { N, H: HAND_SIZE, mulliganAware: { otherBasics } },
      ).event;
      promptKey = "trainer.q.openingAtLeast1";
      promptParams = { name: card.name, x: card.count };
    } else if (kind === "prizedAtLeast1") {
      p = atLeastOnePrized(prizeDistUnconditional(card.count, N, PRIZE_COUNT));
      promptKey = "trainer.q.prizedAtLeast1";
      promptParams = { name: card.name, x: card.count };
    } else {
      const rows = computeTurnCurve(
        { x: card.count, want: 1, goingFirst: false, extraSeen: 0, firstPlayerSkipsFirstDraw: false, maxTurn: turn },
        N,
      );
      const last = rows[rows.length - 1];
      if (!last) return null;
      return {
        promptKey: "trainer.q.seenByTurn",
        promptParams: { name: card.name, x: card.count, t: turn, n: last.nSeen },
        percent: last.percent,
        fraction: last.fraction,
        oneIn: last.oneIn,
        exactPct: last.chart * 100,
      };
    }
  }

  return {
    promptKey,
    promptParams,
    percent: percentStr(p, 6),
    fraction: fractionStr(p),
    oneIn: oneInStr(p, 3),
    exactPct: toChartNumber(p) * 100,
  };
}


// ---------------------------------------------------------------------------
// Energy shortfall curve UI data (docs/02 §6.4, golden pipeline v2)
// ---------------------------------------------------------------------------

export interface EnergyCurveData {
  pValid: { fraction: string; percent: string };
  rows: TurnCurveRow[];
}

export function computeEnergyCurve(
  E: number,
  B: number,
  want: number,
  goingFirst: boolean,
  firstPlayerSkipsFirstDraw: boolean,
  maxTurn: number,
  N = 60,
): EnergyCurveData | null {
  if (B < 1 || E < 0 || E + B > N) return null;
  const physicalCap = N - PRIZE_COUNT;
  const turns: number[] = [];
  const nSeens: number[] = [];
  for (let turn = 1; turn <= maxTurn; turn++) {
    const natural = cardsSeenByTurn(turn, goingFirst, { H: HAND_SIZE, firstPlayerSkipsFirstDraw });
    turns.push(turn);
    nSeens.push(Math.min(natural, physicalCap));
  }
  try {
    const r = energyShortfallCurve(E, B, want, nSeens, N, HAND_SIZE);
    return {
      pValid: { fraction: fractionStr(r.pValid), percent: percentStr(r.pValid, 6) },
      rows: r.points.map((pt, i) => ({
        turn: turns[i] as number,
        nSeen: pt.nSeen,
        capped: pt.nSeen === physicalCap,
        percent: percentStr(pt.p, 6),
        fraction: fractionStr(pt.p),
        oneIn: oneInStr(pt.p, 3),
        chart: toChartNumber(pt.p),
      })),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Luck meter (docs/02 §10, golden pipeline v2)
// ---------------------------------------------------------------------------

export type LuckEventMode = "openingAware" | "seenT1";

export interface LuckMeterData {
  perGame: { percent: string; fraction: string };
  tail: { percent: string; fraction: string; oneIn: string; chart: number };
  expected: string;
  /** True when the streak is genuinely rare (tail < 5%). */
  rare: boolean;
}

export function computeLuckMeter(
  deck: Deck,
  cardName: string,
  mode: LuckEventMode,
  games: number,
): LuckMeterData | null {
  const N = deckTotal(deck);
  if (N < HAND_SIZE || games < 1) return null;
  const card = deck.cards.find((c) => c.name === cardName);
  if (!card || card.count === 0) return null;
  const basics = deckBasics(deck);

  let p: Rat;
  if (mode === "openingAware") {
    if (basics < 1) return null;
    const otherBasics = basics - (card.isBasic ? card.count : 0);
    p = comboOpening(
      [{ label: card.name, count: card.count, min: 1, max: HAND_SIZE, isBasic: card.isBasic }],
      { N, H: HAND_SIZE, mulliganAware: { otherBasics } },
    ).event;
  } else {
    p = pSeenAtLeast(card.count, Math.min(HAND_SIZE + 1, N), 1, N);
  }

  const tail = luckTail(p, games);
  const expected = rat(p.n * BigInt(games), p.d);
  const fivePct = rat(1n, 20n);
  return {
    perGame: { percent: percentStr(p, 6), fraction: fractionStr(p) },
    tail: {
      percent: percentStr(tail, 6),
      fraction: fractionStr(tail),
      oneIn: oneInStr(tail, 1),
      chart: toChartNumber(tail),
    },
    expected: decimalStr(expected, 2),
    rare: cmp(tail, fivePct) < 0,
  };
}
