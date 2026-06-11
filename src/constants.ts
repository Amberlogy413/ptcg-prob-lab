/**
 * Displayed golden-test counts. tests/golden.spec.ts asserts these equal the
 * real totals computed from tests/golden/golden_vectors.json, so the footer
 * can never silently drift from the truth.
 */
export const GOLDEN_CASE_COUNT = 27;
export const GOLDEN_ASSERTION_COUNT = 507;

/** Standard game model (docs/02 §0). */
export const DECK_SIZE = 60;
export const HAND_SIZE = 7;
export const PRIZE_COUNT = 6;
