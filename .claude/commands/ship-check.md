---
description: Full pre-ship gate — typecheck, tests, golden replay, float-leak grep, lint, build, i18n parity, UI acceptance checklist
---

Run the full ship gate in this exact order and stop at the first red step. Produce a final pass/fail table for every step, with counts where applicable.

1. **Typecheck** — `npx tsc --noEmit` (or `npm run typecheck`).
2. **Unit + property + golden (Vitest)** — `npx vitest run`.
3. **Golden replay, Node-direct** — `node --experimental-strip-types scripts/verify_seed.ts`; must end with `ALL GOLDEN VECTORS PASS`.
4. **Float-leak guard** — run:
   `grep -rnE "Math\.(random|pow|sqrt|log|exp|cbrt|hypot)|parseFloat|toFixed|Number\.EPSILON" src/lib/prob --include="*.ts" | grep -v "format.ts"`
   Any hit is a failure (probability values must stay in BigInt rationals; integer `Math.min/max/floor` for counts/indices are allowed and won't match this pattern).
5. **Lint** — `npm run lint`.
6. **Build** — `npm run build`; note gzip size of the main chunk against the 180KB budget (docs/03 §6).
7. **i18n parity** — compare key sets of `src/i18n/zh-Hant.json` and `src/i18n/en.json`; list any missing keys on either side (zh-Hant is primary; missing en keys are warnings until Phase 6, missing zh-Hant keys are failures).
8. **Terminology sweep** — `grep -rn "機率" src/` must return nothing (the product word is 概率; see docs/01 §8). Also grep UI strings for 獎勵卡 and 基本寶可夢 (both forbidden).
9. **UI acceptance checklist** — walk docs/04_UI_UX_SPEC.md §9 item by item against the running app and answer each with yes/no plus a one-line note.
10. **Anchor spot-check** — pick 3 rows from docs/02_MATH_SPEC.md §8, reproduce them in the UI, and confirm all three display formats digit-for-digit.

Only declare the phase shippable if steps 1–6 and 8 are fully green, step 7 has no zh-Hant gaps, and steps 9–10 have no unexplained failures.
