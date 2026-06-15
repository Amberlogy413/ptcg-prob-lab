/**
 * 牌組診斷 (deck doctor, #29 載入即分析): turns a loaded deck into prioritized,
 * ACTIONABLE advice — derived strictly from real PTCG rules (deckLegality) and
 * EXACT math (openingBasics, BigInt rationals). No heuristics dressed as facts:
 * legality items are hard rule violations; the mulligan reading and the "+1
 * Basic" lever are exact computed numbers, not guesses. The headline value is
 * the lever: it tells the player the precise mulligan they'd get by swapping one
 * filler for a Basic (deck size held at 60).
 */

import type { Deck } from "./deckStore.ts";
import { deckTotal, deckBasics } from "./deckStore.ts";
import { deckLegality } from "../utils/deckRules.ts";
import { openingBasics } from "../lib/prob/opening.ts";
import { percentStr, fractionStr, oneInStr } from "../lib/prob/format.ts";
import { DECK_SIZE, HAND_SIZE } from "../constants.ts";

export type AdviceSeverity = "good" | "warn" | "bad" | "info";

export interface AdviceItem {
  severity: AdviceSeverity;
  /** i18n key. */
  key: string;
  params?: Record<string, string | number>;
}

export interface DeckDoctorData {
  total: number;
  basics: number;
  mulligan: { percent: string; fraction: string; oneIn: string } | null;
  /** Exact mulligan if one filler were swapped for a Basic (N held constant). */
  addOneBasic: { percent: string } | null;
  advice: AdviceItem[];
}

/** Diagnose a deck: real-rule legality + exact mulligan reading + the +1-Basic lever. */
export function computeDeckDoctor(deck: Deck): DeckDoctorData {
  const total = deckTotal(deck);
  const basics = deckBasics(deck);
  const legal = deckLegality(deck.cards);
  const advice: AdviceItem[] = [];

  // 1) Real-rule legality (hard facts, never guessed) -----------------------
  if (legal.overSize) advice.push({ severity: "bad", key: "doctor.over", params: { n: total - DECK_SIZE } });
  else if (total > 0 && total < DECK_SIZE) advice.push({ severity: "warn", key: "doctor.under", params: { n: DECK_SIZE - total } });
  for (const v of legal.copyViolations) advice.push({ severity: "bad", key: "doctor.copies", params: { name: v.name, n: v.count } });
  if (!legal.radiantOk) advice.push({ severity: "bad", key: "doctor.radiant", params: { n: legal.radiantCount } });
  if (total > 0 && !legal.hasBasicPokemon) advice.push({ severity: "bad", key: "doctor.noBasic" });

  // 2) Exact mulligan reading + the +1-Basic lever (when a valid hand exists)
  let mulligan: DeckDoctorData["mulligan"] = null;
  let addOneBasic: DeckDoctorData["addOneBasic"] = null;
  if (basics > 0 && total >= HAND_SIZE) {
    const r = openingBasics(basics, total, HAND_SIZE);
    mulligan = {
      percent: percentStr(r.mulligan, 6),
      fraction: fractionStr(r.mulligan),
      oneIn: oneInStr(r.mulligan, 3),
    };
    advice.push({ severity: "info", key: "doctor.mulligan", params: { pct: mulligan.percent, oneIn: mulligan.oneIn, basics } });
    if (basics + 1 <= total) {
      const r2 = openingBasics(basics + 1, total, HAND_SIZE);
      addOneBasic = { percent: percentStr(r2.mulligan, 6) };
      advice.push({ severity: "info", key: "doctor.addBasic", params: { to: addOneBasic.percent } });
    }
  }

  // 3) A green all-clear when the deck is fully legal at 60.
  if (legal.legal && total === DECK_SIZE) advice.unshift({ severity: "good", key: "doctor.legalOk" });

  return { total, basics, mulligan, addOneBasic, advice };
}
