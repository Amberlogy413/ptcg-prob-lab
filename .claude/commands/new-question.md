---
description: Add a new probability question type end-to-end (spec → Python golden → regenerate → TS impl → verifier → UI), preserving the dual-implementation guarantee
---

You are adding a new probability question type: $ARGUMENTS

Follow the cross-implementation protocol (docs/05 §C) strictly, in this order. Do not skip ahead — the whole point is that the Python and TypeScript implementations are written independently from the formula, so their agreement is evidence of correctness.

1. **Spec first.** Add a numbered subsection to docs/02_MATH_SPEC.md: model, exact formula(s), conditioning semantics, at least one worked anchor you can verify by hand or by a tiny exhaustive enumeration. Update docs/01_PRD.md if this is user-facing.
2. **Python reference.** Extend `scripts/generate_golden.py`:
   - Implement the formula independently with `fractions.Fraction` (no floats).
   - Add at least 2 cases of a new `kind`, including one edge case (count 0, constraint [0,0], boundary k, etc.).
   - Add identity `assert`s that must hold (pmf sums to exactly 1, complement laws, consistency with an existing kind where the new question degenerates into an old one).
3. **Regenerate** — `npm run golden` (i.e. `python3 scripts/generate_golden.py`). The generator must pass all its own asserts. This is the ONLY legitimate way `tests/golden/golden_vectors.json` ever changes; review the diff.
4. **TypeScript implementation.** Implement in `src/lib/prob/` from the spec formula — do not translate the Python line-by-line. Exact `Rat` arithmetic only; export through `index.ts`; document with a pointer to the spec section.
5. **Verifier.** Add a `kind` handler in `scripts/verify_seed.ts` (and the Vitest golden spec) checking every expect field: fractions character-exact, `*_dec` at 15 places character-exact.
6. **Run** `/verify-math`. All cases, old and new, must pass.
7. **Property tests.** Add at least one exact-equality property test for the new function (docs/05 §B style).
8. **UI (if user-facing).** Wire into the sentence builder or relevant view per docs/04, including the three display formats and a math receipt whose "公式" line matches the spec section you wrote in step 1.
9. Finish with `/ship-check`.

If at any point the Python and TypeScript values disagree, treat it as a real discrepancy to be diagnosed against the spec — never reconcile by copying numbers from one side to the other.
