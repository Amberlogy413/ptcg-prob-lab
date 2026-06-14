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

/** Real PTCG deck-building legality (owner mandate 2026-06-15; never feeds the
 *  math core — purely deck-construction limits). DECK_SIZE above is the absolute
 *  total cap with NO exception. MAX_COPIES is the per-card-NAME cap that Basic
 *  Energy is exempt from; RADIANT_LIMIT caps total Radiant Pokémon. ACE SPEC
 *  (also 1/deck) is deliberately NOT enforced — it cannot be detected reliably
 *  from the catalog, and the mandate forbids guessing. */
export const MAX_COPIES = 4;
export const RADIANT_LIMIT = 1;
