/**
 * Modeled card effects for the rules engine — the PURE counterpart of
 * `battleEffects.ts`. STRICTLY the same curated, verified set: only
 * deterministic, choice-free Supporters whose mechanics are unambiguous from the
 * real catalog text. We NEVER guess an effect (real-data-only mandate); anything
 * needing a player choice (search, discard-selection, targeting, coin flips) is
 * simply NOT in the action space yet, and is listed honestly in COVERAGE.
 *
 * This honesty is the whole point: a learning agent trained against this engine
 * only ever sees moves the engine can resolve exactly. The gap between this set
 * and a full card pool IS step ① of the AI roadmap (docs/11_AI_AGENT.md) — the
 * ~90% of the work that the JP RL teams spend implementing every card.
 */

import { discardFromHand, discardHand, drawN, shuffleHandIntoDeck } from "./ops.ts";
import type { BattleCard, GameState, PlayerId } from "./types.ts";

/** A modeled effect: resolves the played Supporter purely, returning new state.
 *  `iid` is the played card (already in hand); it is moved to discard here. */
export type EffectFn = (s: GameState, player: PlayerId, iid: string) => GameState;

const PLAYERS: PlayerId[] = ["p1", "p2"];

/** Modeled Supporters, keyed by their canonical zh storage name (catalog `name`).
 *  Keep in lockstep with battleEffects.AUTO_EFFECTS. */
export const SUPPORTER_EFFECTS: Record<string, EffectFn> = {
  // Lillie's Determination: shuffle hand into deck, draw 6 (or 8 if own prizes === 6).
  莉莉艾的決心: (s, player, iid) => {
    let st = discardFromHand(s, player, iid);
    st = shuffleHandIntoDeck(st, player);
    const prizes = st[player].prizes.length;
    return drawN(st, player, prizes === 6 ? 8 : 6);
  },
  // Professor's Research: discard your hand, draw 7 (no shuffle — deck order kept).
  博士的研究: (s, player, iid) => {
    let st = discardFromHand(s, player, iid);
    st = discardHand(st, player);
    return drawN(st, player, 7);
  },
  // Judge: both players shuffle their hand into the deck, then each draws 4.
  裁判: (s, player, iid) => {
    let st = discardFromHand(s, player, iid);
    for (const pl of PLAYERS) {
      st = shuffleHandIntoDeck(st, pl);
      st = drawN(st, pl, 4);
    }
    return st;
  },
};

/** Is this Supporter resolvable by the engine (so it belongs in the action space)? */
export function isModeledSupporter(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(SUPPORTER_EFFECTS, key);
}

// --- Targeted effects: the choice IS part of the action space (AI step ① pattern).
// Detected by the card's EXACT verified catalog effect text (zh-Hant) — never by a
// fuzzy name match, so a card is modeled only when its mechanic is unambiguous.
// (Verified 2026-06-18 in public/catalog/cards-zh-Hant.json.)

/** Boss's Orders family (老大的指令 …): "選擇1隻對手的備戰寶可夢，與戰鬥寶可夢互換"
 *  — you pick one of the OPPONENT's Benched Pokémon to become their new Active.
 *  Top-played gust Supporter in the H/I/J meta (老大的指令(坂木) usage ≈ 90%). */
const GUST_EFFECT = "選擇1隻對手的備戰寶可夢，與戰鬥寶可夢互換";

/** Switch family (寶可夢交替): "將自己的戰鬥寶可夢與備戰寶可夢互換" — you pick one of
 *  YOUR OWN Benched Pokémon to swap with your Active (an Item, no Energy cost). */
const SWITCH_EFFECT = "將自己的戰鬥寶可夢與備戰寶可夢互換";

/** Normalise catalog effect text for an exact compare: trim + drop a single
 *  trailing full-width 。 (every catalog effect ends with one; the canonical
 *  strings above omit it). Conditional gust/switch cards carry EXTRA text, so
 *  this never produces a false positive — verified against the full catalog. */
function normEffect(effect: string | undefined): string {
  return effect === undefined ? "" : effect.trim().replace(/。$/, "");
}

/** Is this card a canonical gust (Boss's Orders)? Exact (normalised) match only. */
export function isGustEffect(effect: string | undefined): boolean {
  return normEffect(effect) === GUST_EFFECT;
}

/** Is this card a canonical own-side Switch? Exact (normalised) match only. */
export function isSwitchEffect(effect: string | undefined): boolean {
  return normEffect(effect) === SWITCH_EFFECT;
}

// --- Search effects: the choice is WHICH card from a pile (deck / discard). ----
// Detected by exact verified catalog effect text; eligibility uses the card's own
// kind/section so no extra catalog lookup is needed. Deck searches reshuffle, so
// the exact-odds draw HUD stays uniform afterwards (honest).

/** Where a search pulls from, where it puts the card, and what it may pull. */
export interface SearchSpec {
  from: "deck" | "discard";
  to: "hand" | "bench";
  /** Is this pile card a legal pick for the search? */
  eligible: (card: BattleCard) => boolean;
  /** Deck searches reshuffle (keeps the exact-odds HUD uniform). */
  shuffleAfter: boolean;
}

const isBasicPokemon = (c: BattleCard): boolean => c.kind === "basic";
const isPokemon = (c: BattleCard): boolean => c.section === "pokemon";
const isBasicEnergy = (c: BattleCard): boolean => c.kind === "energy-basic";

/** Modeled single-pick search Items, keyed by exact (normalised) catalog effect.
 *  Verified 2026-06-18 in public/catalog/cards-zh-Hant.json. NOTE: 超級球 / Ultra
 *  Ball is deliberately NOT modeled — its catalog effect text is anomalous
 *  (reads "look at the top 7", which is not Ultra Ball's rule), so we do not
 *  faithfully reproduce data we believe is wrong (flagged for a data fix). */
const SEARCH_BY_EFFECT: Array<{ effect: string; spec: SearchSpec }> = [
  // 巢穴球 (Nest Ball): deck → a Basic Pokémon → Bench, shuffle.
  { effect: "從自己的牌庫選擇1張【基礎】寶可夢卡，放置於備戰區。並且重洗牌庫", spec: { from: "deck", to: "bench", eligible: isBasicPokemon, shuffleAfter: true } },
  // 大師球 (Master Ball): deck → any Pokémon → hand, shuffle.
  { effect: "從自己的牌庫選擇1張寶可夢卡，在給對手看過後加入手牌。並且重洗牌庫", spec: { from: "deck", to: "hand", eligible: isPokemon, shuffleAfter: true } },
  // 夜間擔架 (Night Stretcher): discard → a Pokémon OR a basic Energy → hand (no shuffle).
  { effect: "從自己的棄牌區選擇1張寶可夢卡或者基本能量卡，在給對手看過後加入手牌", spec: { from: "discard", to: "hand", eligible: (c) => isPokemon(c) || isBasicEnergy(c), shuffleAfter: false } },
];

/** The search spec for this card's effect text, or null if it isn't a modeled search. */
export function searchSpecOf(effect: string | undefined): SearchSpec | null {
  const n = normEffect(effect);
  return SEARCH_BY_EFFECT.find((e) => e.effect === n)?.spec ?? null;
}

/**
 * Honest coverage ledger — what the engine models vs. what it does NOT yet. The
 * UI / docs surface this so no one mistakes the faithful SUBSET for the full game.
 */
export const COVERAGE = {
  /** Supporters with an exact, choice-free model. */
  supporters: Object.keys(SUPPORTER_EFFECTS),
  /** Targeted effects modeled with the CHOICE as part of the action space
   *  (the AI step ① pattern). Detected by exact verified catalog effect text. */
  targeted: [
    "老大的指令 / Boss's Orders (gust: choose an opponent's Benched Pokémon → their Active)",
    "寶可夢交替 / Switch (choose your own Benched Pokémon ↔ your Active)",
    "巢穴球 / Nest Ball (deck → choose a Basic → Bench, shuffle)",
    "大師球 / Master Ball (deck → choose any Pokémon → hand, shuffle)",
    "夜間擔架 / Night Stretcher (discard → choose a Pokémon or basic Energy → hand)",
  ],
  /** Item active effects modeled (the choice is part of the action space). */
  items: ["寶可夢交替 / Switch", "巢穴球 / Nest Ball", "大師球 / Master Ball", "夜間擔架 / Night Stretcher"],
  /** Known NOT modeled despite high usage: 超級球 / Ultra Ball — its catalog effect
   *  text is anomalous (not Ultra Ball's real rule), so we don't model wrong data. */
  unmodeledKnown: ["超級球 / Ultra Ball (catalog effect text looks wrong — flagged)"],
  /** Pokémon Abilities: none modeled yet (most are triggered/optional choices). */
  abilities: [] as string[],
  /** Known simplifications carried for this phase (documented, never silent). */
  simplifications: [
    "attacks resolve damage + weakness/resistance only; printed attack EFFECTS (status, draw, discard, heal, self-damage) are not applied",
    "variable / conditional attack damage ('50+', '60×') is APPROXIMATED by the printed base — the real multiplier/bonus is not in the data, so this value is never claimed as exact (see battleAttack.isVariableDamage)",
    "Special Conditions: poison/burn checkup damage is applied, and an Asleep/Paralyzed Active is correctly barred from attacking; the asleep/paralyzed/confused RECOVERY coin flips are left to the caller",
    "a Confused Active's attack is allowed WITHOUT the real coin flip (no fail / no 30 self-damage) — the flip is not modeled",
    "a Pokémon at/over its HP from checkup (poison/burn) is not auto-KO'd — matches the store; status-KO + prize is a later phase",
    "when an attack KOs the opponent's Active, the next player's mandatory start-of-turn draw is sequenced BEFORE the forced promotion (no observable effect today; no modeled effect depends on it)",
    "Stadium uses a per-side slot (matches the sandbox); the real SINGLE shared-Stadium zone and the same-name-replacement ban are not modeled",
    "special / unknown Energy pays any single cost symbol as a wildcard (its element is never fabricated)",
  ],
} as const;
