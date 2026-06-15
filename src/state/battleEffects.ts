/**
 * Auto-resolvable card effects for the battle sandbox (#36). STRICTLY a curated,
 * VERIFIED set: only deterministic, choice-free Supporter actions whose mechanics
 * are unambiguous from the real card text (catalog `effect`). Anything that needs
 * a player choice — search/fetch, discard-selection, targeting, coin flips — stays
 * MANUAL. We never guess an effect (real-data-only mandate). No probability math
 * lives here; it only drives the board's faithful zone moves.
 *
 * Verified card text (catalog cards-zh-Hant.json, 2026-06-16):
 *  - 莉莉艾的決心 (Lillie's Determination): shuffle your hand into the deck, then
 *    draw 6 — or 8 if your remaining prize count is exactly 6. (Top-played draw
 *    Supporter in the current H/I/J meta.)
 *  - 博士的研究 (Professor's Research): discard your whole hand, then draw 7.
 *  - 奇樹 (Iono): both players shuffle their hand into the deck, then each draws
 *    a number equal to their own remaining prize cards.
 *  - 裁判 (Judge): both players shuffle their hand into the deck, then each draws 4.
 */

import { useBattleStore, type PlayerId } from "./battleStore.ts";

export interface AutoEffect {
  /** Supporter ⇒ subject to 1-per-turn + the going-first turn-1 restriction. */
  supporter: boolean;
  /** i18n key: a plain-language summary of the exact mechanical action. */
  summaryKey: string;
}

/** Cards with a known, exact auto-effect, keyed by their zh display name. */
export const AUTO_EFFECTS: Record<string, AutoEffect> = {
  莉莉艾的決心: { supporter: true, summaryKey: "battle.fx.lillie" },
  博士的研究: { supporter: true, summaryKey: "battle.fx.research" },
  奇樹: { supporter: true, summaryKey: "battle.fx.iono" },
  裁判: { supporter: true, summaryKey: "battle.fx.judge" },
};

const PLAYERS: PlayerId[] = ["p1", "p2"];

/**
 * Resolve a known auto-effect: move the played card to the discard, then perform
 * its exact, deterministic action. Returns false for an unrecognised card (the
 * caller keeps it manual). Reads live state between steps so counts are correct.
 */
export function applyAutoEffect(player: PlayerId, iid: string, name: string): boolean {
  const store = useBattleStore.getState();
  switch (name) {
    case "莉莉艾的決心": { // shuffle hand into deck, draw 6 (or 8 if own prizes === 6)
      store.moveCard(player, iid, "discard");
      store.shuffleHandIntoDeck(player);
      const prizes = useBattleStore.getState()[player].prizes.length;
      store.draw(player, prizes === 6 ? 8 : 6);
      return true;
    }
    case "博士的研究": // discard your hand, draw 7
      store.moveCard(player, iid, "discard");
      store.discardHand(player);
      store.draw(player, 7);
      return true;
    case "奇樹": // Iono: both shuffle hand UNDER the deck, each draws own prize count
      store.moveCard(player, iid, "discard");
      for (const pl of PLAYERS) {
        const prizes = useBattleStore.getState()[pl].prizes.length;
        useBattleStore.getState().shuffleHandUnderDeck(pl);
        useBattleStore.getState().draw(pl, prizes);
      }
      return true;
    case "裁判": // Judge: both shuffle hand into deck, each draws 4
      store.moveCard(player, iid, "discard");
      for (const pl of PLAYERS) {
        useBattleStore.getState().shuffleHandIntoDeck(pl);
        useBattleStore.getState().draw(pl, 4);
      }
      return true;
    default:
      return false;
  }
}
