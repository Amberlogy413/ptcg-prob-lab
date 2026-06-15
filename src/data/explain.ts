/**
 * 白話詳解 (owner request 2026-06-15): every headline probability gets a second
 * affordance (beside the √ math receipt) that opens an EXHAUSTIVE plain-language
 * explanation — what the number answers, what every algebraic symbol means, how
 * it is computed step by step, how to read the answer, and why it can be trusted.
 *
 * The structural meaning is general (universally true for these hypergeometric
 * numbers); the concrete substituted numbers live in the math receipt shown
 * directly below the explanation in the same modal. Nothing here is a guess.
 */

export interface ExplainSection {
  /** Plain-language heading. */
  h: string;
  /** Body; may contain "\n" for separate lines (rendered pre-line). */
  body: string;
}

export type ExplainKind = "mulligan" | "combo" | "prize" | "jointPrize" | "midgame" | "draw";

type T = (key: string, params?: Record<string, string | number>) => string;

/** Three-format reading + the exactness/trust note — shared by every number. */
function shared(t: T, fmt: { pct: string; frac: string; oneIn: string }): ExplainSection[] {
  return [
    { h: t("explain.h.read"), body: t("explain.read.b", fmt) },
    { h: t("explain.h.exact"), body: t("explain.exact.b") },
  ];
}

/**
 * Build the full plain-language explanation for a headline number. `fmt` carries
 * the three display formats (percent / reduced fraction / 1-in-N) of THIS number.
 */
export function buildExplain(
  t: T,
  kind: ExplainKind,
  fmt: { pct: string; frac: string; oneIn: string },
): ExplainSection[] {
  return [
    { h: t("explain.h.q"), body: t(`explain.${kind}.q`) },
    { h: t("explain.h.sym"), body: t(`explain.${kind}.sym`) },
    { h: t("explain.h.how"), body: t(`explain.${kind}.how`) },
    ...shared(t, fmt),
  ];
}
