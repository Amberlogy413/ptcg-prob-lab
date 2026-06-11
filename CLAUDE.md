# CLAUDE.md — PTCG Probability Lab (seed repository)

You are building **PTCG 概率實驗室 / PTCG Probability Lab**: a client-side web
app that computes **exact** draw/prize probabilities for 60-card Pokémon TCG
decks, so players can audit deck lists, understand real in-game odds, and win
more. "Exact" is literal: every probability is a reduced BigInt fraction,
cross-verified against an independent Python implementation.

This repo is a **seed**: specs (docs/), a finished & proven math core
(src/lib/prob/), and golden test vectors (tests/golden/). Your job is to grow
it into the full app by following docs/06_ROADMAP.md.

## Read order (mandatory, before writing any code)

1. This file.
2. `docs/01_PRD.md` — product vision, the three core questions (Q1/Q2/Q3), feature tiers.
3. `docs/02_MATH_SPEC.md` — **the most important document.** Formal model, formulas, verified anchor numbers, fallacy list.
4. `docs/03_ARCHITECTURE.md` — stack, layout, API of the math core, worker boundary, perf budgets.
5. `docs/04_UI_UX_SPEC.md` — design direction, tokens, the sentence query builder, result cards, microcopy.
6. `docs/05_TEST_PLAN.md` — golden/property/Monte-Carlo layers, CI gate.
7. `docs/06_ROADMAP.md` — phases with definitions of done, and the exact next step.

The human-facing docs are written in Traditional Chinese (zh-Hant) because the
product owner and launch audience are zh-Hant users. Keep them in zh-Hant.
Code identifiers and comments stay in English.

## Non-negotiables

1. **Exact math only.** Inside `src/lib/prob/`, probabilities exist solely as
   BigInt rationals (`Rat`). Floating point, `Math.*` on probabilities,
   `parseFloat`, `toFixed` are banned there. The only float bridge is
   `format.ts` (`toChartNumber`, display strings). Plain JS `number` is fine
   for integer counts/indices.
2. **Golden tests are law.** `npm run verify:seed` (later: the Vitest port)
   must pass at every commit. If a golden test fails, the code is wrong —
   never the vector. Vectors may only change by extending
   `scripts/generate_golden.py` (the independent Python reference) and
   regenerating; never hand-edit `tests/golden/golden_vectors.json`.
3. **Mulligan conditioning is a core feature, not garnish.** The real game
   re-deals hands with zero 基礎寶可夢 (Basic Pokémon). Q1/Q2/Q3 each have a
   mulligan-aware mode (spec §3–§5). The UI defaults to mulligan-aware for
   opening-hand questions and always shows which conditioning is in effect.
4. **Every probability is shown three ways** — percent, exact fraction,
   "1 in N" — plus an expandable 數學收據 (math receipt) showing the formula
   with real numbers substituted. No naked rounded numbers.
5. **Terminology lock (zh-Hant UI):** 概率 (never 機率), 獎賞卡 (prize
   cards), 基礎寶可夢 (Basic Pokémon), Mulligan(重抽). Glossary:
   docs/01_PRD.md §8. UI strings live in i18n files; zh-Hant is the primary
   locale, en is secondary.
6. **IP safety.** No official Pokémon artwork, logos, card scans, or set
   symbols. Card identity is user-typed text. Include the fan-tool
   disclaimer (PRD §7). Visual identity must be original (UI spec).
7. **All client-side.** No backend, no accounts, no telemetry. Persistence =
   `localStorage`; sharing = URL-encoded state. The math must run fully
   offline.
8. **UI quality bar.** Follow docs/04_UI_UX_SPEC.md. The product should feel
   like a precision instrument, not a generic dashboard. The 數學收據 and the
   headline number treatment are the signature elements — polish them.

## Repo map

```
CLAUDE.md                  ← you are here
README.md                  ← human quickstart (bilingual)
package.json               ← zero-dependency seed; scripts: golden, verify:seed
docs/01..06                ← specs (zh-Hant)
scripts/generate_golden.py ← INDEPENDENT Python reference (fractions module)
scripts/verify_seed.ts     ← replays every golden case through the TS core
src/lib/prob/              ← finished exact math core (framework-free)
  rational.ts  binomial.ts  hypergeom.ts  opening.ts  prizes.ts  turns.ts
  format.ts    index.ts
tests/golden/golden_vectors.json  ← 27 cases / 507 assertions, all passing
.claude/commands/          ← /verify-math  /ship-check  /new-question
```

## Workflow

- **Before anything:** run `node --experimental-strip-types scripts/verify_seed.ts`
  (Node 22+). It must print `ALL GOLDEN VECTORS PASS`.
- **Phase 0** (roadmap) scaffolds Vite + React 18 + TypeScript strict +
  Tailwind + Zustand + Vitest, moves `src/lib/prob/` in **unchanged**, and
  ports the verifier into a Vitest spec. Source files import with explicit
  `.ts` extensions (required by Node strip-types); keep that style and set
  `allowImportingTsExtensions: true`, `moduleResolution: "bundler"`,
  `noEmit: true`, `target: "ES2022"` in tsconfig so Vite/Vitest accept it.
- Heavy joint-table computations run in a Web Worker (`structuredClone`
  transfers BigInt fine; JSON does not — serialize fractions as `"n/d"`
  strings for URL/localStorage only).
- After every phase: run `/ship-check`.

## Math gotchas (full detail in docs/02_MATH_SPEC.md)

- Conditioning on a valid hand can move answers a lot: A(4, Basic)+B(3)
  "≥1 each" is 11.404965% naive but **15.383618%** in the real game (§4).
  Calculators that ignore mulligans are systematically wrong; ours is the
  corrective.
- Prizes: unconditionally, each copy has exactly P/N = 1/10 chance of being
  prized (E[prized] = x/10) — by exchangeability, *before* hand knowledge.
  After conditioning on a valid hand it shifts (Basic 4-of: E = 0.381570…;
  non-Basic 4-of in a 10-Basic deck: E = 0.403686…). Direction differs by
  card type; don't "simplify" this away (§5).
- Counts of different cards in a hand are negatively correlated; multiplying
  per-card probabilities is a fallacy (16.0% vs true 14.5% for the 4+4 case, §9).
- Current official rules: the player going first **does** draw on turn 1
  (restrictions are no attack / no Supporter). The skip-first-draw rule is a
  historical variant — keep it behind the `firstPlayerSkipsFirstDraw` toggle,
  default off (§6).
- Round-half-up decimals are produced in BigInt by `format.decimalStr`; golden
  `*_dec` fields are character-exact at 15 places.

## When you're unsure

Prefer the spec over your instincts; prefer exactness over convenience; if a
spec gap forces a decision, decide, note it in `docs/DECISIONS.md` (create it
on first use), and keep golden tests green.
