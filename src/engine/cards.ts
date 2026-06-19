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
import { energyProvides } from "../state/battleAttack.ts";
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

/** Energy Switch family (能量轉移): "選擇1個自己的場上寶可夢身上附加的基本能量，改附於
 *  自己的其他寶可夢身上" — move ONE basic Energy already attached to one of your
 *  Pokémon onto another of your Pokémon. An Item; it relocates an existing Energy,
 *  so it does NOT spend the turn's from-hand Energy attachment. The choice (which
 *  Energy, source → target) IS the action. (Verified 2026-06-19: 9 prints, all
 *  trainerType "Item", this exact unique effect text — no same-text collision.) */
const ENERGY_SWITCH_EFFECT = "選擇1個自己的場上寶可夢身上附加的基本能量，改附於自己的其他寶可夢身上";

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

/** Is this card a canonical Energy Switch? Exact (normalised) match only. */
export function isEnergySwitchEffect(effect: string | undefined): boolean {
  return normEffect(effect) === ENERGY_SWITCH_EFFECT;
}

/** Energy Retrieval family (能量回收): "從自己的棄牌區選擇最多2張基本能量卡，在給對手看過後
 *  加入手牌" — take UP TO 2 basic Energy from your discard into your hand. An Item;
 *  the choice (which 1–2 Energy) IS the action. (Verified 2026-06-19: 7 prints, all
 *  trainerType "Item", this exact unique effect text — no same-text collision.) */
const ENERGY_RETRIEVE_EFFECT = "從自己的棄牌區選擇最多2張基本能量卡，在給對手看過後加入手牌";

/** Is this card a canonical Energy Retrieval? Exact (normalised) match only. */
export function isEnergyRetrieveEffect(effect: string | undefined): boolean {
  return normEffect(effect) === ENERGY_RETRIEVE_EFFECT;
}

/** Rare Candy family (神奇糖果): jump-evolve a Basic directly into a Stage 2 from
 *  hand, skipping Stage 1. The catalog carries TWO equally-valid wordings of the
 *  same effect (「最初回合與這個回合剛使出」 vs 「最初回合或剛使出」) — both verified
 *  2026-06-19, 15 prints, all trainerType Item; we accept either exact text. The
 *  legality of a specific jump (this Stage 2 evolves from this Basic) is checked
 *  separately by canRareCandyJump using real PokéAPI evolution-chain data. */
const RARE_CANDY_EFFECTS: ReadonlySet<string> = new Set([
  "從自己的手牌選擇1張【2階進化】寶可夢卡，放置於自己的場上的可進化成那隻寶可夢的【基礎】寶可夢身上，跳過【1階進化】完成進化。（無法對自己的最初回合與這個回合剛使出的寶可夢使用。）",
  "從自己的手牌選擇1張【2階進化】寶可夢卡，放置於自己的場上的可進化成那隻寶可夢的【基礎】寶可夢身上，跳過【1階進化】完成進化。（無法對自己的最初回合或剛使出的寶可夢使用。）",
]);

/** Is this card a canonical Rare Candy? Exact (normalised) match against either wording. */
export function isRareCandyEffect(effect: string | undefined): boolean {
  return RARE_CANDY_EFFECTS.has(normEffect(effect));
}

/** The distinct, meaningful Energy Retrieval picks from a discard pile, as arrays
 *  of 1–2 card iids. Same-element basic Energy is interchangeable, so picks are
 *  deduped by element: one representative per element (×1), one per element with
 *  ≥2 copies (×2 of that type), and one per unordered pair of distinct elements.
 *  Order favours the useful two-card picks first. Empty when no basic Energy is in
 *  the discard (the card is then not offered — honest: we only model it when it
 *  retrieves something). Shared by the engine's action space AND the UI picker. */
export function energyRetrieveCombos(discard: BattleCard[]): string[][] {
  const byElem = new Map<string, string[]>(); // element key → iids, in discard order
  for (const e of discard) {
    const k = energyProvides(e); // basic Energy by name; special / non-Energy → null
    if (k === null) continue;
    const arr = byElem.get(k);
    if (arr) arr.push(e.iid);
    else byElem.set(k, [e.iid]);
  }
  const elems = [...byElem.keys()];
  const combos: string[][] = [];
  // ×2 of one element (the common case: get two of your type back)
  for (const k of elems) {
    const ids = byElem.get(k)!;
    if (ids.length >= 2) combos.push([ids[0]!, ids[1]!]);
  }
  // one of each of two distinct elements
  for (let i = 0; i < elems.length; i++)
    for (let j = i + 1; j < elems.length; j++) combos.push([byElem.get(elems[i]!)![0]!, byElem.get(elems[j]!)![0]!]);
  // a single Energy ("up to 2" allows taking just one)
  for (const k of elems) combos.push([byElem.get(k)![0]!]);
  return combos;
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
const isEvolution = (c: BattleCard): boolean => c.kind === "evolution"; // any non-Basic Pokémon (Stage 1/2)
/** A "basic Energy" — identified by its NAME (the standard type Energies), NOT by
 *  `kind` or catalog `energyType`, both of which are unreliable (verified
 *  2026-06-19): a catalog-absent special Energy from a newest set falls through to
 *  kind "energy-basic", and the catalog even tags the real basic Energies as
 *  energyType "Special". `energyProvides` (the type-colour name map) returns a
 *  non-null element only for the genuine basic Energies, so it is the one
 *  trustworthy basic-vs-special test. Used by every basic-Energy-only effect. */
const isBasicEnergy = (c: BattleCard): boolean => energyProvides(c) !== null;

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
  // 能量輸送 (Energy Search): deck → a basic Energy → hand, shuffle. (Verified 2026-06-19.)
  { effect: "從自己的牌庫選擇1張基本能量卡，在給對手看過後加入手牌。並且重洗牌庫", spec: { from: "deck", to: "hand", eligible: isBasicEnergy, shuffleAfter: true } },
  // 進化薰香 (Evolution Incense): deck → an Evolution Pokémon (Stage 1/2) → hand, shuffle. (Verified 2026-06-19.)
  { effect: "從自己的牌庫選擇1張進化寶可夢卡，在給對手看過後加入手牌。並且重洗牌庫", spec: { from: "deck", to: "hand", eligible: isEvolution, shuffleAfter: true } },
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
    "能量轉移 / Energy Switch (move one basic Energy from one of your Pokémon → another)",
    "能量回收 / Energy Retrieval (take up to 2 basic Energy from your discard → hand)",
    "能量輸送 / Energy Search (deck → choose a basic Energy → hand, shuffle)",
    "進化薰香 / Evolution Incense (deck → choose an Evolution Pokémon → hand, shuffle)",
    "神奇糖果 / Rare Candy (jump-evolve a Basic in play → a Stage 2 from hand; legality via real PokéAPI evolution-chain data, see src/data/evolution.ts)",
  ],
  /** Item active effects modeled (the choice is part of the action space). */
  items: ["寶可夢交替 / Switch", "巢穴球 / Nest Ball", "大師球 / Master Ball", "夜間擔架 / Night Stretcher", "能量轉移 / Energy Switch", "能量回收 / Energy Retrieval", "能量輸送 / Energy Search", "進化薰香 / Evolution Incense", "神奇糖果 / Rare Candy"],
  /** Known NOT modeled despite high usage, with the honest reason. */
  unmodeledKnown: [
    "超級球 / Ultra Ball (catalog effect text looks wrong — flagged for a data fix)",
  ],
  /** Pokémon Abilities: none modeled yet (most are triggered/optional choices). */
  abilities: [] as string[],
  /** Known simplifications carried for this phase (documented, never silent). */
  simplifications: [
    "attacks resolve damage + weakness/resistance, an UNCONDITIONAL Special Condition on the defender (將對手的戰鬥寶可夢【X】, no 若/擲), AND four unconditional attacker-only effects — self-heal (將這隻寶可夢恢復「N」HP), draw (從自己的牌庫抽出N張卡), recoil self-damage (這隻寶可夢也受到N點傷害, can self-KO → opponent takes the Prize), and a self-attack-lock (在下個自己的回合，這隻寶可夢無法使用招式 → the attacker can't attack on its next turn); coin-flip/conditional effects, the DEFENDER-side lock, attack energy-discard, and bench-damage are still not modeled",
    "after a recoil SELF-KO the attacker's player promotes a new Active only at the START of their next turn (the engine's forced-promote), so during the opponent's immediately-following turn that player's Active can be empty — the opponent can't attack into the empty slot for that one window (a disclosed sequencing gap; the bot promotes a Benched Pokémon at its own turn start, the manual sandbox promotes by hand)",
    "variable / conditional attack damage ('50+', '60×') is APPROXIMATED by the printed base — the real multiplier/bonus is not in the data, so this value is never claimed as exact (see battleAttack.isVariableDamage)",
    "Special Conditions: poison/burn checkup damage is applied, and an Asleep/Paralyzed Active is correctly barred from attacking AND retreating (Confusion still allows both); the asleep/paralyzed/confused RECOVERY coin flips are left to the caller",
    "mulligan IS performed (a no-Basic opening reshuffles + re-deals), but the opponent's extra-card-per-mulligan is NOT modeled",
    "targeted/search effects are detected by exact zh effect TEXT; the call sites additionally gate by card kind (item vs supporter), which disambiguates the one known same-text pair (大師球 Item vs 寶可夢小朋友 Supporter)",
    "a Confused Active's attack is allowed WITHOUT the real coin flip (no fail / no 30 self-damage) — the flip is not modeled",
    "a Pokémon at/over its HP from checkup (poison/burn) is not auto-KO'd — matches the store; status-KO + prize is a later phase",
    "when an attack KOs the opponent's Active, the next player's mandatory start-of-turn draw is sequenced BEFORE the forced promotion (no observable effect today; no modeled effect depends on it)",
    "Stadium uses a per-side slot (matches the sandbox); the real SINGLE shared-Stadium zone and the same-name-replacement ban are not modeled",
    "special / unknown Energy pays any single cost symbol as a wildcard (its element is never fabricated)",
    "basic-Energy-only effects (Energy Search/Switch/Retrieval, Night Stretcher) decide 'is this a basic Energy' by NAME (energyProvides), NOT by kind or catalog energyType — both are unreliable: catalog-absent special Energy defaults to kind 'energy-basic', and the catalog tags real basic Energies as energyType 'Special' (verified 2026-06-19)",
  ],
} as const;
