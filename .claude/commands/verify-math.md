---
description: Run the full mathematical verification (golden vectors + property tests) and report exact results
---

Run the complete mathematical verification suite and report the outcome.

Steps:
1. `node --experimental-strip-types scripts/verify_seed.ts` — the Node-direct golden replay. Capture the final summary line (cases / assertions / failures).
2. If the Vitest port exists (`tests/golden.spec.ts` or similar): `npx vitest run` and capture results, including property tests.
3. If Python 3 is available, regenerate nothing — instead run `python3 scripts/generate_golden.py --check` if a check mode exists; otherwise skip (the JSON in the repo is the source of truth for this run).

Report a short table: layer | command | result | counts.

Rules you must follow while doing this:
- If any golden assertion fails, the TypeScript code is wrong — never the vector. Diagnose the TS implementation against docs/02_MATH_SPEC.md. You are forbidden from editing `tests/golden/golden_vectors.json` by hand under any circumstances.
- Do not "fix" a failure by loosening a comparison (no epsilon comparisons, no trimming decimal places). Equality is exact, character-for-character.
- If the failure traces to a genuine spec ambiguity, stop and present the ambiguity with both readings, referencing the exact spec section, before changing anything.
