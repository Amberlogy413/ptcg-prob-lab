/**
 * Pure rules-engine behaviour (#36 → AI agent step ①, owner 2026-06-18). Drives
 * the headless engine directly — legalActions / applyAction / reward — with no
 * React / Zustand. Catalog facts (attacks) are injected through a tiny stub ctx
 * so the rules are tested in isolation from the real data file.
 */

import { describe, it, expect } from "vitest";
import {
  newGame,
  legalActions,
  applyAction,
  isTerminal,
  winner,
  reward,
  BattleEnv,
  observe,
  encodeObservation,
  makeCtx,
  searchSpecOf,
  energyRetrieveCombos,
  type GameState,
  type EngineCtx,
  type BattleCard,
  type CardSpec,
  type PlayerBoard,
  type Action,
} from "../src/engine/index.ts";
import type { Catalog, CatalogCard } from "../src/data/catalog.ts";

// --- helpers ----------------------------------------------------------------

function card(iid: string, kind: BattleCard["kind"], over: Partial<BattleCard> = {}): BattleCard {
  const section: BattleCard["section"] =
    kind === "basic" || kind === "evolution"
      ? "pokemon"
      : kind.startsWith("energy")
        ? "energy"
        : kind === "unknown"
          ? "unknown"
          : "trainer";
  return { iid, name: iid, isBasic: kind === "basic", section, kind, ...over };
}

function emptyBoard(): PlayerBoard {
  return { deck: [], hand: [], discard: [], prizes: [], lostzone: [], active: null, bench: [], stadium: null };
}

function prizes6(): BattleCard[] {
  return new Array(6).fill(0).map((_, i) => card(`pz${i}`, "basic"));
}

/** A board with the real opening 6 Prize cards (empty prizes would read as an
 *  instant prize-win and make legalActions return []). Tests override as needed. */
function pb(): PlayerBoard {
  return { ...emptyBoard(), prizes: prizes6() };
}

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    shuffleNonce: 0,
    turn: 2, // default: past the going-first turn-1 restrictions
    current: "p1",
    firstPlayer: "p1",
    turnSupporterUsed: false,
    turnEnergyAttached: false,
    turnStadiumPlayed: false,
    turnRetreated: false,
    everInPlay: { p1: false, p2: false }, // default: no wipe-loss until a test opts in
    p1: pb(),
    p2: pb(),
    ...over,
  };
}

const nullCtx: EngineCtx = { catalog: null, resolve: () => null, autoKey: (c) => c.name };

/** A ctx that resolves attacks/types by card name (for attack tests). */
function atkCtx(table: Record<string, Partial<CatalogCard>>): EngineCtx {
  return {
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Pokemon", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  };
}

function find<T extends Action["type"]>(acts: Action[], type: T): Extract<Action, { type: T }>[] {
  return acts.filter((a): a is Extract<Action, { type: T }> => a.type === type);
}

const deck60 = (name: string, isBasic = true): CardSpec[] => [
  { name, count: 60, isBasic, section: "pokemon", kind: isBasic ? "basic" : "evolution" },
];

// --- newGame / setup --------------------------------------------------------

describe("newGame", () => {
  it("deals 7-card hands + 6 prizes, then the going-first player draws turn 1 (→8), reproducibly", () => {
    const g1 = newGame({ p1: deck60("A"), p2: deck60("B"), seed: 42, first: "p1" });
    const g2 = newGame({ p1: deck60("A"), p2: deck60("B"), seed: 42, first: "p1" });
    expect(g1.p1.hand.length).toBe(8); // dealt 7 + the mandatory turn-1 draw (current rules)
    expect(g1.p2.hand.length).toBe(7); // going-second has not drawn yet
    expect(g1.p1.prizes.length).toBe(6);
    expect(g1.p1.deck.length).toBe(60 - 13 - 1); // one fewer for the turn-1 draw
    expect(g1.p1.hand.map((c) => c.iid)).toEqual(g2.p1.hand.map((c) => c.iid)); // deterministic
  });
});

// --- legal-action gating ----------------------------------------------------

describe("legalActions", () => {
  it("the going-first turn-1 player can bench a Basic but cannot attack or play a Supporter", () => {
    const myActive = { uid: "m", card: card("m", "basic", { hp: 70 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({
      turn: 1,
      p1: { ...pb(), active: myActive, hand: [card("pika", "basic"), card("sup", "supporter", { name: "博士的研究" })] },
      p2: { ...pb(), active: { uid: "x", card: card("y", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] } },
    });
    const acts = legalActions(s, nullCtx);
    expect(find(acts, "playToActive").length).toBe(0); // Active already filled
    expect(find(acts, "playToBench").length).toBe(1); // the extra Basic can bench
    expect(find(acts, "playSupporter").length).toBe(0); // turn-1 first → blocked
    expect(find(acts, "attack").length).toBe(0); // turn-1 first → blocked
    expect(find(acts, "endTurn").length).toBe(1);
  });

  it("offers only one Energy attachment per turn", () => {
    const unit = { uid: "u", card: card("a", "basic", { hp: 70 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), hand: [card("e", "energy-basic")], active: unit } });
    expect(find(legalActions(s, nullCtx), "attachEnergy").length).toBe(1);
    const after = applyAction(s, { type: "attachEnergy", handIid: "e", unitId: "u" }, nullCtx);
    expect(after.turnEnergyAttached).toBe(true);
    expect(find(legalActions(after, nullCtx), "attachEnergy").length).toBe(0);
  });

  it("forces a promotion (and nothing else) when the Active is empty but the Bench is not", () => {
    const benched = { uid: "b", card: card("b", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active: null, bench: [benched], hand: [card("pk", "basic")] } });
    const acts = legalActions(s, nullCtx);
    expect(acts.length).toBe(1);
    expect(acts[0]).toEqual({ type: "promote", benchUnitId: "b" });
  });

  it("does not offer benching a Basic while the Active spot is empty (place an Active first)", () => {
    const s = baseState({ p1: { ...pb(), active: null, bench: [], hand: [card("pk", "basic")] } });
    const acts = legalActions(s, nullCtx);
    expect(find(acts, "playToActive").length).toBe(1);
    expect(find(acts, "playToBench").length).toBe(0);
    expect(applyAction(s, { type: "playToBench", iid: "pk" }, nullCtx)).toBe(s); // no-op too
  });
});

// --- play actions -----------------------------------------------------------

describe("applyAction", () => {
  it("playToActive places a Basic and records everInPlay", () => {
    const s = baseState({ everInPlay: { p1: false, p2: false }, p1: { ...pb(), hand: [card("pk", "basic")] } });
    const ns = applyAction(s, { type: "playToActive", iid: "pk" }, nullCtx);
    expect(ns.p1.active?.card.iid).toBe("pk");
    expect(ns.p1.hand.length).toBe(0);
    expect(ns.everInPlay.p1).toBe(true);
  });

  it("evolve requires the named pre-evolution and a Pokémon that was not played this turn", () => {
    const unit = { uid: "u", card: card("base", "basic", { name: "Base" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const evoCard = card("evo", "evolution", { name: "Evo", evolveFrom: "Base" });
    const s = baseState({ turn: 3, p1: { ...pb(), hand: [evoCard], active: unit } });
    const ns = applyAction(s, { type: "evolve", handIid: "evo", unitId: "u" }, nullCtx);
    expect(ns.p1.active?.card.name).toBe("Evo");
    expect(ns.p1.active?.under.map((c) => c.name)).toEqual(["Base"]);
    // a wrong pre-evolution name is rejected
    const wrong = card("evo2", "evolution", { name: "Evo2", evolveFrom: "Nope" });
    const s2 = baseState({ turn: 3, p1: { ...pb(), hand: [wrong], active: unit } });
    expect(applyAction(s2, { type: "evolve", handIid: "evo2", unitId: "u" }, nullCtx)).toBe(s2);
  });

  it("retreat pays the cost by discarding Energy and swaps the Active", () => {
    // Poison does NOT block retreat (only Asleep/Paralyzed do); it clears on leaving Active.
    const active = { uid: "act", card: card("act", "basic", { hp: 90, retreat: 2 }), under: [], energy: [card("e1", "energy-basic"), card("e2", "energy-basic"), card("e3", "energy-basic")], tools: [], damage: 0, playedTurn: 1, status: ["poison" as const] };
    const bench = { uid: "bn", card: card("bn", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active, bench: [bench] } });
    const ns = applyAction(s, { type: "retreat", benchUnitId: "bn" }, nullCtx);
    expect(ns.p1.active?.uid).toBe("bn");
    expect(ns.turnRetreated).toBe(true);
    expect(ns.p1.discard.length).toBe(2); // 2 Energy paid
    const movedBack = ns.p1.bench.find((u) => u.uid === "act")!;
    expect(movedBack.energy.length).toBe(1); // 3 − 2 = 1 left
    expect(movedBack.status).toEqual([]); // conditions cleared leaving the Active
  });

  it("an Asleep or Paralyzed Active cannot retreat (only Confusion still allows it)", () => {
    const mk = (status: ("asleep" | "paralyzed")[]) => ({
      ...pb(),
      active: { uid: "act", card: card("act", "basic", { hp: 90, retreat: 0 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status },
      bench: [{ uid: "bn", card: card("bn", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] }],
    });
    for (const cond of [["asleep"], ["paralyzed"]] as ("asleep" | "paralyzed")[][]) {
      const s = baseState({ p1: mk(cond) });
      expect(find(legalActions(s, nullCtx), "retreat").length).toBe(0);
      expect(applyAction(s, { type: "retreat", benchUnitId: "bn" }, nullCtx)).toBe(s);
    }
  });

  it("a too-poor Pokémon cannot retreat", () => {
    const active = { uid: "act", card: card("act", "basic", { hp: 90, retreat: 3 }), under: [], energy: [card("e1", "energy-basic")], tools: [], damage: 0, playedTurn: 1, status: [] };
    const bench = { uid: "bn", card: card("bn", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active, bench: [bench] } });
    expect(find(legalActions(s, nullCtx), "retreat").length).toBe(0);
    expect(applyAction(s, { type: "retreat", benchUnitId: "bn" }, nullCtx)).toBe(s);
  });
});

// --- attack / KO / prizes ---------------------------------------------------

describe("attack", () => {
  const ctx = atkCtx({
    Pikachu: { types: ["Lightning"], attacks: [{ name: "Bolt", cost: ["Lightning"], damage: 90 }] },
    Snorlax: { types: ["Colorless"] },
  });

  function attackState(defenderHp: number, defenderPrizes = 6): GameState {
    const attacker = { uid: "atk", card: card("Pikachu", "basic", { hp: 70, name: "Pikachu" }), under: [], energy: [card("le", "energy-basic", { name: "Lightning Energy" })], tools: [], damage: 0, playedTurn: 1, status: [] };
    const defender = { uid: "def", card: card("Snorlax", "basic", { hp: defenderHp, name: "Snorlax" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    return baseState({
      p1: { ...pb(), active: attacker, prizes: new Array(6).fill(0).map((_, i) => card(`pz${i}`, "basic")) },
      p2: { ...pb(), active: defender, prizes: new Array(defenderPrizes).fill(0).map((_, i) => card(`q${i}`, "basic")) },
    });
  }

  it("deals damage and ends the turn (attacking ends your turn)", () => {
    const s = attackState(200);
    const ns = applyAction(s, { type: "attack", index: 0 }, ctx);
    expect(ns.p2.active?.damage).toBe(90);
    expect(ns.current).toBe("p2"); // turn passed
  });

  it("a Knock-Out removes the defender and the attacker takes a Prize", () => {
    const s = attackState(80); // 90 ≥ 80 → KO
    const before = s.p1.prizes.length;
    const ns = applyAction(s, { type: "attack", index: 0 }, ctx);
    expect(ns.p2.active).toBeNull();
    expect(ns.p1.prizes.length).toBe(before - 1);
  });

  it("an Asleep or Paralyzed Active cannot attack", () => {
    const base = attackState(200);
    const asleep = { ...base, p1: { ...base.p1, active: { ...base.p1.active!, status: ["asleep" as const] } } };
    expect(find(legalActions(asleep, ctx), "attack").length).toBe(0);
    expect(applyAction(asleep, { type: "attack", index: 0 }, ctx)).toBe(asleep);
  });

  it("applies an UNCONDITIONAL attack status to a surviving defender (not on KO, not when conditional)", () => {
    const mk = (effect: string): EngineCtx => ({
      catalog: null,
      resolve: (c) =>
        c.name === "Pikachu"
          ? ({ name: "Pikachu", category: "Pokemon", types: ["Lightning"], attacks: [{ name: "Venoshock", cost: ["Lightning"], damage: 30, effect }] } as CatalogCard)
          : ({ name: c.name, category: "Pokemon" } as CatalogCard),
      autoKey: (c) => c.name,
    });
    // survives (200 HP, 30 dmg) → poison applied
    let ns = applyAction(attackState(200), { type: "attack", index: 0 }, mk("將對手的戰鬥寶可夢【中毒】。"));
    expect(ns.p2.active?.status).toContain("poison");
    // KO (20 HP, 30 dmg) → no active, no status
    ns = applyAction(attackState(20), { type: "attack", index: 0 }, mk("將對手的戰鬥寶可夢【中毒】。"));
    expect(ns.p2.active).toBeNull();
    // conditional (若…) → NOT applied (it reads the status, doesn't inflict it)
    ns = applyAction(attackState(200), { type: "attack", index: 0 }, mk("若對手的戰鬥寶可夢【中毒】，則增加90點傷害。"));
    expect(ns.p2.active?.status ?? []).not.toContain("poison");
  });

  it("taking the last Prize wins the game (no turn pass)", () => {
    const s = baseState({
      p1: { ...pb(), active: { uid: "atk", card: card("Pikachu", "basic", { hp: 70, name: "Pikachu" }), under: [], energy: [card("le", "energy-basic", { name: "Lightning Energy" })], tools: [], damage: 0, playedTurn: 1, status: [] }, prizes: [card("last", "basic")] },
      p2: { ...pb(), active: { uid: "def", card: card("Snorlax", "basic", { hp: 80, name: "Snorlax" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] }, prizes: [card("z", "basic")] },
    });
    const ns = applyAction(s, { type: "attack", index: 0 }, ctx);
    expect(isTerminal(ns)).toBe(true);
    expect(winner(ns)).toBe("p1");
    expect(reward(ns, "p1")).toBe(1);
    expect(reward(ns, "p2")).toBe(-1);
  });

  // unconditional attacker-only effects: self-heal + draw (resolved before turn ends)
  const fxAtk = (effect: string): EngineCtx => ({
    catalog: null,
    resolve: (c) =>
      c.name === "Pikachu"
        ? ({ name: "Pikachu", category: "Pokemon", types: ["Lightning"], attacks: [{ name: "Fx", cost: ["Lightning"], damage: 30, effect }] } as CatalogCard)
        : ({ name: c.name, category: "Pokemon" } as CatalogCard),
    autoKey: (c) => c.name,
  });

  it("a self-heal attack reduces the attacker's OWN damage (floored at 0), still ending the turn", () => {
    const s = attackState(200); // defender survives
    const hurt = { ...s, p1: { ...s.p1, active: { ...s.p1.active!, damage: 50 } } };
    const ns = applyAction(hurt, { type: "attack", index: 0 }, fxAtk("將這隻寶可夢恢復「30」HP。"));
    expect(ns.p1.active?.damage).toBe(20); // 50 − 30
    expect(ns.current).toBe("p2");
  });

  it("a draw attack puts cards from the attacker's deck into their hand", () => {
    const s = attackState(200);
    const withDeck = { ...s, p1: { ...s.p1, deck: [card("d1", "basic"), card("d2", "basic"), card("d3", "basic")], hand: [] }, p2: { ...s.p2, deck: [card("od", "basic")] } };
    const ns = applyAction(withDeck, { type: "attack", index: 0 }, fxAtk("從自己的牌庫抽出2張卡。"));
    expect(ns.p1.hand.length).toBe(2);
    expect(ns.p1.deck.length).toBe(1);
  });

  const bench = () => ({ uid: "b", card: card("Bench", "basic", { hp: 60, name: "Bench" }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] });

  it("recoil self-damage hurts the attacker but it survives → the turn still passes", () => {
    const s = attackState(200); // attacker Pikachu hp 70, damage 0; defender survives
    const withDeck = { ...s, p2: { ...s.p2, deck: [card("od", "basic")] } };
    const ns = applyAction(withDeck, { type: "attack", index: 0 }, fxAtk("這隻寶可夢也受到30點傷害。"));
    expect(ns.p1.active?.damage).toBe(30);
    expect(ns.current).toBe("p2");
  });

  it("recoil that reaches the attacker's HP self-KOs it; the OPPONENT takes the Prize (game continues with a Bench)", () => {
    const s = attackState(200);
    const hurt = { ...s, p1: { ...s.p1, active: { ...s.p1.active!, damage: 50 }, bench: [bench()] }, p2: { ...s.p2, deck: [card("od", "basic")] } };
    const before = hurt.p2.prizes.length;
    const ns = applyAction(hurt, { type: "attack", index: 0 }, fxAtk("這隻寶可夢也受到30點傷害。")); // 50 + 30 ≥ 70
    expect(ns.p1.active).toBeNull(); // the attacker KO'd itself
    expect(ns.p2.prizes.length).toBe(before - 1); // opponent took the Prize for it
    expect(ns.current).toBe("p2");
  });

  it("a recoil self-KO with no Bench loses the game (no Pokémon left)", () => {
    const s = attackState(200);
    const hurt = { ...s, everInPlay: { p1: true, p2: true }, p1: { ...s.p1, active: { ...s.p1.active!, damage: 50 }, bench: [] } };
    const ns = applyAction(hurt, { type: "attack", index: 0 }, fxAtk("這隻寶可夢也受到30點傷害。"));
    expect(isTerminal(ns)).toBe(true);
    expect(winner(ns)).toBe("p2");
  });
});

// --- supporter (modeled effect) --------------------------------------------

describe("playSupporter (modeled)", () => {
  it("博士的研究 discards the hand and draws 7, marking the Supporter used", () => {
    const hand = [card("博士的研究", "supporter", { name: "博士的研究" }), card("j1", "basic"), card("j2", "basic")];
    const deck = new Array(10).fill(0).map((_, i) => card(`d${i}`, "basic"));
    const s = baseState({ p1: { ...pb(), hand, deck } });
    const ns = applyAction(s, { type: "playSupporter", iid: "博士的研究" }, nullCtx);
    expect(ns.turnSupporterUsed).toBe(true);
    expect(ns.p1.hand.length).toBe(7); // drew a fresh 7
    expect(ns.p1.discard.length).toBe(3); // the played card + the 2 others
  });
});

// --- targeted effects: the choice is part of the action space ---------------

describe("targeted effects (Boss's Orders / Switch)", () => {
  // The REAL catalog effect text ends with a full-width 。 — the detector must
  // normalise it (regression guard for the trailing-period bug, fixed 2026-06-18).
  const GUST = "選擇1隻對手的備戰寶可夢，與戰鬥寶可夢互換。";
  const SWITCH = "將自己的戰鬥寶可夢與備戰寶可夢互換。";
  const fxCtx = (table: Record<string, Partial<CatalogCard>>): EngineCtx => ({
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Trainer", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  });
  const u = (uid: string, hp: number, status: ("poison" | "asleep")[] = []) => ({
    uid,
    card: card(uid, "basic", { hp }),
    under: [] as BattleCard[],
    energy: [] as BattleCard[],
    tools: [] as BattleCard[],
    damage: 0,
    playedTurn: 1,
    status,
  });

  it("Boss's Orders drags up a chosen opponent bench Pokémon (old Active → bench, conditions cleared)", () => {
    const ctx = fxCtx({ Boss: { effect: GUST } });
    const s = baseState({
      p1: { ...pb(), active: u("m", 70), hand: [card("Boss", "supporter", { name: "Boss" })] },
      p2: { ...pb(), active: u("oa", 100, ["asleep"]), bench: [u("ob", 60)] },
    });
    expect(find(legalActions(s, ctx), "playGust").length).toBe(1); // one per opp bench
    const ns = applyAction(s, { type: "playGust", iid: "Boss", targetUid: "ob" }, ctx);
    expect(ns.p2.active?.uid).toBe("ob"); // chosen bench is now their Active
    expect(ns.p2.bench.map((x) => x.uid)).toContain("oa"); // old Active benched
    expect(ns.p2.bench.find((x) => x.uid === "oa")!.status).toEqual([]); // conditions cleared
    expect(ns.turnSupporterUsed).toBe(true);
    expect(ns.p1.discard.map((c) => c.iid)).toContain("Boss"); // the Supporter → MY discard
  });

  it("Boss's Orders is blocked on the going-first turn 1 (it is a Supporter)", () => {
    const ctx = fxCtx({ Boss: { effect: GUST } });
    const s = baseState({
      turn: 1,
      p1: { ...pb(), active: u("m", 70), hand: [card("Boss", "supporter", { name: "Boss" })] },
      p2: { ...pb(), active: u("oa", 100), bench: [u("ob", 60)] },
    });
    expect(find(legalActions(s, ctx), "playGust").length).toBe(0);
    expect(applyAction(s, { type: "playGust", iid: "Boss", targetUid: "ob" }, ctx)).toBe(s);
  });

  it("Switch swaps your own Active with a chosen bench (Item: no Energy cost, no turn limit)", () => {
    const ctx = fxCtx({ Sw: { effect: SWITCH } });
    const active = { ...u("a", 70), card: card("a", "basic", { hp: 70, retreat: 3 }), damage: 20, status: ["poison" as const] };
    const s = baseState({ p1: { ...pb(), active, bench: [u("b", 60)], hand: [card("Sw", "item", { name: "Sw" })] } });
    expect(find(legalActions(s, ctx), "playSwitch").length).toBe(1);
    const ns = applyAction(s, { type: "playSwitch", iid: "Sw", benchUid: "b" }, ctx);
    expect(ns.p1.active?.uid).toBe("b"); // swapped in despite a retreat cost of 3 + no Energy
    const back = ns.p1.bench.find((x) => x.uid === "a")!;
    expect(back.status).toEqual([]); // conditions cleared on leaving the Active
    expect(back.damage).toBe(20); // damage stays — it is the same Pokémon
    expect(ns.p1.discard.map((c) => c.iid)).toContain("Sw");
    expect(ns.turnSupporterUsed).toBe(false); // an Item, not a Supporter
  });
});

// --- makeCtx resolves to the zh-effect print (kana-swap) --------------------

describe("makeCtx — zh-effect resolution for Japanese-print cards", () => {
  // A card that exists as a Japanese print (the deck points at it) AND a zh print.
  const cat = {
    v: 1,
    lang: "zh-Hant",
    source: "test",
    fetchedAt: "",
    count: 2,
    cards: [
      { id: "M1L-083", localId: "083", name: "夜のタンカ", nameZh: "夜間擔架", category: "Trainer", trainerType: "Item", set: "M1L", effect: "自分のトラッシュからポケモンまたは基本エネルギーを1枚選び、相手に見せて、手札に加える。" },
      { id: "SV6a-056", localId: "056", name: "夜間擔架", category: "Trainer", trainerType: "Item", set: "SV6a", effect: "從自己的棄牌區選擇1張寶可夢卡或者基本能量卡，在給對手看過後加入手牌。" },
    ],
  } as unknown as Catalog;

  it("swaps a Japanese (kana) effect for its zh-Hant sibling so effect detection works", () => {
    const ctx = makeCtx(cat);
    const jaCard: BattleCard = { iid: "n1", name: "夜間擔架", catalogId: "M1L-083", isBasic: false, section: "trainer", kind: "item" };
    const eff = ctx.resolve(jaCard)?.effect;
    expect(eff).toContain("從自己的棄牌區"); // the zh print's effect, not the Japanese one
    expect(searchSpecOf(eff)).not.toBeNull(); // → Night Stretcher search is detected
  });
});

// --- search effects (pile pick = action) ------------------------------------

describe("search effects (Nest / Master Ball, Night Stretcher, Energy Search, Evolution Incense)", () => {
  const NEST = "從自己的牌庫選擇1張【基礎】寶可夢卡，放置於備戰區。並且重洗牌庫。";
  const MASTER = "從自己的牌庫選擇1張寶可夢卡，在給對手看過後加入手牌。並且重洗牌庫。";
  const NIGHT = "從自己的棄牌區選擇1張寶可夢卡或者基本能量卡，在給對手看過後加入手牌。";
  const ENERGY_SEARCH = "從自己的牌庫選擇1張基本能量卡，在給對手看過後加入手牌。並且重洗牌庫。";
  const EVO_INCENSE = "從自己的牌庫選擇1張進化寶可夢卡，在給對手看過後加入手牌。並且重洗牌庫。";
  const fxCtx = (table: Record<string, Partial<CatalogCard>>): EngineCtx => ({
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Trainer", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  });

  it("Nest Ball offers only Basics, benches the chosen one, discards the Item, and reshuffles the deck", () => {
    const ctx = fxCtx({ Nest: { effect: NEST } });
    const s = baseState({
      p1: {
        ...pb(),
        hand: [card("Nest", "item", { name: "Nest" })],
        deck: [card("basicA", "basic"), card("evoB", "evolution"), card("basicC", "basic"), card("energyD", "energy-basic")],
      },
    });
    const acts = find(legalActions(s, ctx), "search");
    expect(acts.length).toBe(2); // only the two Basics are eligible
    const ns = applyAction(s, { type: "search", iid: "Nest", foundIid: "basicA" }, ctx);
    expect(ns.p1.bench.map((u) => u.card.iid)).toContain("basicA"); // benched
    expect(ns.p1.deck.some((c) => c.iid === "basicA")).toBe(false); // removed from deck
    expect(ns.p1.discard.map((c) => c.iid)).toContain("Nest"); // Item discarded
    expect(ns.shuffleNonce).toBe(s.shuffleNonce + 1); // deck reshuffled (HUD stays uniform)
  });

  it("Master Ball pulls any Pokémon from the deck to the hand", () => {
    const ctx = fxCtx({ Master: { effect: MASTER } });
    const s = baseState({
      p1: { ...pb(), hand: [card("Master", "item", { name: "Master" })], deck: [card("evoX", "evolution"), card("energyY", "energy-basic")] },
    });
    const acts = find(legalActions(s, ctx), "search");
    expect(acts.length).toBe(1); // the evolution Pokémon (energy not eligible)
    const ns = applyAction(s, { type: "search", iid: "Master", foundIid: "evoX" }, ctx);
    expect(ns.p1.hand.map((c) => c.iid)).toContain("evoX");
    expect(ns.shuffleNonce).toBe(s.shuffleNonce + 1);
  });

  it("Night Stretcher pulls a Pokémon OR basic Energy from the discard (no reshuffle)", () => {
    const ctx = fxCtx({ Night: { effect: NIGHT } });
    const s = baseState({
      p1: {
        ...pb(),
        hand: [card("Night", "item", { name: "Night" })],
        discard: [card("pkA", "basic"), card("enB", "energy-basic", { name: "基本火能量" }), card("trN", "item")],
      },
    });
    const acts = find(legalActions(s, ctx), "search");
    expect(acts.length).toBe(2); // the Pokémon + the basic Energy (not the Item)
    const ns = applyAction(s, { type: "search", iid: "Night", foundIid: "enB" }, ctx);
    expect(ns.p1.hand.map((c) => c.iid)).toContain("enB");
    expect(ns.p1.discard.map((c) => c.iid)).toContain("Night"); // the Item itself
    expect(ns.shuffleNonce).toBe(s.shuffleNonce); // discard retrieval does NOT reshuffle
  });

  it("Energy Search offers only basic Energy from the deck → hand, and reshuffles", () => {
    const ctx = fxCtx({ ES: { effect: ENERGY_SEARCH } });
    const s = baseState({
      p1: {
        ...pb(),
        hand: [card("ES", "item", { name: "ES" })],
        // enA = a real basic Energy (by name); spC = a special Energy whose catalog
        // entry is missing so its kind WRONGLY defaulted to "energy-basic" — it must
        // still be EXCLUDED (basic-vs-special is decided by name, not kind).
        deck: [card("enA", "energy-basic", { name: "基本火能量" }), card("pkB", "basic"), card("spC", "energy-basic", { name: "新星增幅能量" })],
      },
    });
    const acts = find(legalActions(s, ctx), "search");
    expect(acts.length).toBe(1); // only the genuine basic Energy
    const ns = applyAction(s, { type: "search", iid: "ES", foundIid: "enA" }, ctx);
    expect(ns.p1.hand.map((c) => c.iid)).toContain("enA");
    expect(ns.p1.deck.some((c) => c.iid === "enA")).toBe(false);
    expect(ns.shuffleNonce).toBe(s.shuffleNonce + 1);
    // The mis-kinded special Energy is NOT pulled (would be a false positive).
    expect(applyAction(s, { type: "search", iid: "ES", foundIid: "spC" }, ctx)).toBe(s);
  });

  it("Evolution Incense offers only Evolution Pokémon from the deck → hand, and reshuffles", () => {
    const ctx = fxCtx({ EI: { effect: EVO_INCENSE } });
    const s = baseState({
      p1: { ...pb(), hand: [card("EI", "item", { name: "EI" })], deck: [card("evoA", "evolution"), card("basicB", "basic"), card("enC", "energy-basic")] },
    });
    const acts = find(legalActions(s, ctx), "search");
    expect(acts.length).toBe(1); // only the Evolution Pokémon (Basic / Energy not eligible)
    const ns = applyAction(s, { type: "search", iid: "EI", foundIid: "evoA" }, ctx);
    expect(ns.p1.hand.map((c) => c.iid)).toContain("evoA");
    expect(ns.p1.deck.some((c) => c.iid === "evoA")).toBe(false);
    expect(ns.shuffleNonce).toBe(s.shuffleNonce + 1);
  });
});

// --- Energy Switch (move a basic Energy between your own Pokémon) ------------

describe("Energy Switch (能量轉移)", () => {
  // Real catalog text ends with a full-width 。 — the detector normalises it.
  const ES = "選擇1個自己的場上寶可夢身上附加的基本能量，改附於自己的其他寶可夢身上。";
  const fxCtx = (table: Record<string, Partial<CatalogCard>>): EngineCtx => ({
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Trainer", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  });
  const energy = (iid: string, name: string): BattleCard => card(iid, "energy-basic", { name });
  const unit = (uid: string, energyCards: BattleCard[]) => ({
    uid,
    card: card(uid, "basic", { hp: 100 }),
    under: [] as BattleCard[],
    energy: energyCards,
    tools: [] as BattleCard[],
    damage: 0,
    playedTurn: 1,
    status: [],
  });

  it("moves a chosen basic Energy source→target, discards the Item, does NOT spend the turn's attachment, and dedupes identical Energy", () => {
    const ctx = fxCtx({ ES: { effect: ES } });
    const s = baseState({
      p1: {
        ...pb(),
        active: unit("a", [energy("f1", "基本火能量"), energy("f2", "基本火能量"), energy("w1", "基本水能量")]),
        bench: [unit("b", [])],
        hand: [card("ES", "item", { name: "ES" })],
      },
    });
    const acts = find(legalActions(s, ctx), "energySwitch");
    expect(acts.length).toBe(2); // {Fire→b, Water→b}; the duplicate Fire is deduped to one
    const ns = applyAction(s, { type: "energySwitch", iid: "ES", fromUid: "a", energyIid: "f1", toUid: "b" }, ctx);
    expect(ns.p1.active!.energy.map((e) => e.iid).sort()).toEqual(["f2", "w1"]); // source lost f1
    expect(ns.p1.bench.find((u) => u.uid === "b")!.energy.map((e) => e.iid)).toEqual(["f1"]); // target gained it
    expect(ns.p1.discard.map((c) => c.iid)).toContain("ES"); // Item → discard
    expect(ns.turnEnergyAttached).toBe(false); // relocating attached Energy is NOT a from-hand attach
  });

  it("offers nothing with only one Pokémon in play (needs a distinct target); a same-source/target action is a no-op", () => {
    const ctx = fxCtx({ ES: { effect: ES } });
    const s = baseState({
      p1: { ...pb(), active: unit("a", [energy("f1", "基本火能量")]), bench: [], hand: [card("ES", "item", { name: "ES" })] },
    });
    expect(find(legalActions(s, ctx), "energySwitch").length).toBe(0);
    expect(applyAction(s, { type: "energySwitch", iid: "ES", fromUid: "a", energyIid: "f1", toUid: "a" }, ctx)).toBe(s);
  });

  it("never offers special Energy (only basic Energy can be moved)", () => {
    const ctx = fxCtx({ ES: { effect: ES } });
    const s = baseState({
      p1: {
        ...pb(),
        active: unit("a", [card("sp", "energy-special", { name: "二重彩虹能量" })]),
        bench: [unit("b", [])],
        hand: [card("ES", "item", { name: "ES" })],
      },
    });
    expect(find(legalActions(s, ctx), "energySwitch").length).toBe(0);
  });
});

// --- Energy Retrieval (take up to 2 basic Energy from your discard) ----------

describe("Energy Retrieval (能量回收)", () => {
  const ER = "從自己的棄牌區選擇最多2張基本能量卡，在給對手看過後加入手牌。";
  const fxCtx = (table: Record<string, Partial<CatalogCard>>): EngineCtx => ({
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Trainer", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  });
  const energy = (iid: string, name: string): BattleCard => card(iid, "energy-basic", { name });

  it("enumerates the deduped 1–2 card picks (×2 of a type, one-of-each pair, single)", () => {
    const discard = [energy("f1", "基本火能量"), energy("f2", "基本火能量"), energy("w1", "基本水能量"), card("pk", "basic"), card("it", "item")];
    const combos = energyRetrieveCombos(discard);
    // {火,火}, {火,水}, {火}, {水} — the Pokémon / Item are not basic Energy
    expect(combos.map((c) => c.slice().sort().join("+")).sort()).toEqual(["f1+f2", "f1+w1", "f1", "w1"].sort());
  });

  it("legalActions offers one action per pick, and applyAction moves the chosen Energy to hand + discards the Item", () => {
    const ctx = fxCtx({ ER: { effect: ER } });
    const s = baseState({
      p1: {
        ...pb(),
        active: { uid: "a", card: card("a", "basic", { hp: 100 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] },
        hand: [card("ER", "item", { name: "ER" })],
        discard: [energy("f1", "基本火能量"), energy("f2", "基本火能量"), energy("w1", "基本水能量")],
      },
    });
    expect(find(legalActions(s, ctx), "energyRetrieve").length).toBe(4); // {火火},{火水},{火},{水}
    const ns = applyAction(s, { type: "energyRetrieve", iid: "ER", foundIids: ["f1", "f2"] }, ctx);
    expect(ns.p1.hand.map((c) => c.iid).sort()).toEqual(["f1", "f2"]); // both pulled into hand
    expect(ns.p1.discard.map((c) => c.iid).sort()).toEqual(["ER", "w1"]); // Item went to discard; w1 untouched
    expect(ns.turnEnergyAttached).toBe(false); // a discard retrieval, not a from-hand attach
  });

  it("rejects an illegal pick: >2 cards, a non-basic-Energy card, a card not in the discard, or a duplicate", () => {
    const ctx = fxCtx({ ER: { effect: ER } });
    const base = {
      ...pb(),
      hand: [card("ER", "item", { name: "ER" })],
      discard: [energy("f1", "基本火能量"), energy("f2", "基本火能量"), card("pk", "basic")],
    };
    const s = baseState({ p1: base });
    expect(applyAction(s, { type: "energyRetrieve", iid: "ER", foundIids: ["f1", "f2", "f1"] }, ctx)).toBe(s); // >2 (and dup)
    expect(applyAction(s, { type: "energyRetrieve", iid: "ER", foundIids: ["f1", "pk"] }, ctx)).toBe(s); // pk is a Pokémon
    expect(applyAction(s, { type: "energyRetrieve", iid: "ER", foundIids: ["nope"] }, ctx)).toBe(s); // not in discard
    expect(applyAction(s, { type: "energyRetrieve", iid: "ER", foundIids: ["f1", "f1"] }, ctx)).toBe(s); // duplicate iid
  });

  it("offers nothing when the discard holds no basic Energy", () => {
    const ctx = fxCtx({ ER: { effect: ER } });
    const s = baseState({ p1: { ...pb(), hand: [card("ER", "item", { name: "ER" })], discard: [card("pk", "basic"), card("it", "item")] } });
    expect(find(legalActions(s, ctx), "energyRetrieve").length).toBe(0);
    expect(energyRetrieveCombos(s.p1.discard).length).toBe(0);
  });

  it("excludes a special Energy whose kind WRONGLY defaulted to energy-basic (basic-vs-special is by name)", () => {
    // 新星增幅能量 is a special Energy absent from the catalog, so its kind defaulted
    // to "energy-basic" — it must NOT be retrievable; only the genuine basic Energy is.
    const discard = [energy("f1", "基本火能量"), energy("sp", "新星增幅能量")];
    expect(energyRetrieveCombos(discard)).toEqual([["f1"]]); // just the real basic Energy, single pick
  });
});

// --- Rare Candy (jump-evolve a Basic directly into a Stage 2) ----------------

describe("Rare Candy (神奇糖果)", () => {
  const RC = "從自己的手牌選擇1張【2階進化】寶可夢卡，放置於自己的場上的可進化成那隻寶可夢的【基礎】寶可夢身上，跳過【1階進化】完成進化。（無法對自己的最初回合或剛使出的寶可夢使用。）";
  // resolve by name to catalog facts (stage / dexId for the chain check, RC effect for the Item)
  const ctxOf = (table: Record<string, Partial<CatalogCard>>): EngineCtx => ({
    catalog: null,
    resolve: (c) => (table[c.name] ? ({ name: c.name, category: "Pokemon", ...table[c.name] } as CatalogCard) : null),
    autoKey: (c) => c.name,
  });
  const PKMN: Record<string, Partial<CatalogCard>> = { 小火龍: { stage: "Basic", dexId: [4] }, 噴火龍: { stage: "Stage2", dexId: [6] }, 皮卡丘: { stage: "Basic", dexId: [25] } };
  const RC_CARD: Record<string, Partial<CatalogCard>> = { RC: { category: "Trainer", trainerType: "Item", effect: RC } };
  const unit = (uid: string, name: string, playedTurn: number) => ({ uid, card: card(uid, "basic", { name }), under: [] as BattleCard[], energy: [] as BattleCard[], tools: [] as BattleCard[], damage: 0, playedTurn, status: [] });
  const hand = () => [card("RC", "item", { name: "RC" }), card("s2", "evolution", { name: "噴火龍" })];

  it("jump-evolves a Basic into a real-line Stage 2: Stage 1 skipped, old card under, Stage 2 leaves hand, Item discarded", () => {
    const ctx = ctxOf({ ...RC_CARD, ...PKMN });
    const s = baseState({ turn: 3, p1: { ...pb(), active: unit("base", "小火龍", 1), hand: hand() } }); // turn 3 = firstPlayer's 2nd turn
    expect(find(legalActions(s, ctx), "rareCandy").length).toBe(1);
    const ns = applyAction(s, { type: "rareCandy", iid: "RC", basicUid: "base", stage2HandIid: "s2" }, ctx);
    expect(ns.p1.active!.card.name).toBe("噴火龍"); // became the Stage 2
    expect(ns.p1.active!.under.map((c) => c.name)).toEqual(["小火龍"]); // Basic under it, Stage 1 skipped
    expect(ns.p1.active!.playedTurn).toBe(3);
    expect(ns.p1.hand.some((c) => c.iid === "s2")).toBe(false);
    expect(ns.p1.discard.some((c) => c.iid === "RC")).toBe(true);
  });

  it("does NOT offer a Stage 2 from a different evolution line", () => {
    const ctx = ctxOf({ ...RC_CARD, ...PKMN });
    const s = baseState({ turn: 3, p1: { ...pb(), active: unit("base", "皮卡丘", 1), hand: hand() } });
    expect(find(legalActions(s, ctx), "rareCandy").length).toBe(0);
    expect(applyAction(s, { type: "rareCandy", iid: "RC", basicUid: "base", stage2HandIid: "s2" }, ctx)).toBe(s);
  });

  it("is barred on your own first turn AND on a Basic just played this turn", () => {
    const ctx = ctxOf({ ...RC_CARD, ...PKMN });
    const ownFirst = baseState({ turn: 1, p1: { ...pb(), active: unit("base", "小火龍", 1), hand: hand() } }); // firstPlayer turn 1
    expect(find(legalActions(ownFirst, ctx), "rareCandy").length).toBe(0);
    const sick = baseState({ turn: 3, p1: { ...pb(), active: unit("base", "小火龍", 3), hand: hand() } }); // played THIS turn
    expect(find(legalActions(sick, ctx), "rareCandy").length).toBe(0);
  });
});

// --- end of turn ------------------------------------------------------------

describe("endTurn", () => {
  it("applies poison/burn checkup damage, auto-draws the incoming player, and resets flags", () => {
    const active = { uid: "a", card: card("a", "basic", { hp: 100 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: ["poison" as const, "burn" as const] };
    const p2deck = [card("top", "basic")];
    const s = baseState({ current: "p1", turnEnergyAttached: true, p1: { ...pb(), active }, p2: { ...pb(), deck: p2deck } });
    const ns = applyAction(s, { type: "endTurn" }, nullCtx);
    expect(ns.p1.active?.damage).toBe(30); // poison 10 + burn 20
    expect(ns.current).toBe("p2");
    expect(ns.p2.hand.map((c) => c.iid)).toEqual(["top"]); // incoming auto-draw
    expect(ns.turnEnergyAttached).toBe(false); // flags reset
  });

  it("a player who cannot make the mandatory start-of-turn draw (empty deck) loses", () => {
    const mk = (hp: number, deck: BattleCard[]) => ({
      ...pb(),
      active: { uid: `u${hp}`, card: card("a", "basic", { hp }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] },
      deck,
    });
    const s = baseState({
      current: "p1",
      everInPlay: { p1: true, p2: true },
      p1: mk(100, [card("d", "basic")]),
      p2: mk(100, []), // p2's deck is empty → cannot draw when their turn begins
    });
    const ns = applyAction(s, { type: "endTurn" }, nullCtx);
    expect(ns.deckedOut).toBe("p2");
    expect(isTerminal(ns)).toBe(true);
    expect(winner(ns)).toBe("p1");
  });

  it("cannot end the turn with an empty Active while a Bench Pokémon waits", () => {
    const bench = { uid: "b", card: card("b", "basic", { hp: 60 }), under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [] };
    const s = baseState({ p1: { ...pb(), active: null, bench: [bench] } });
    expect(applyAction(s, { type: "endTurn" }, nullCtx)).toBe(s); // no-op, must promote
  });
});

// --- env wrapper (the RL interface) -----------------------------------------

describe("BattleEnv (Gym-style wrapper)", () => {
  const mixDeck: CardSpec[] = [
    { name: "Pikachu", count: 12, isBasic: true, section: "pokemon", kind: "basic" },
    { name: "Lightning Energy", count: 24, isBasic: false, section: "energy", kind: "energy-basic" },
    { name: "Ball", count: 12, isBasic: false, section: "trainer", kind: "item" },
    { name: "Stadium", count: 12, isBasic: false, section: "trainer", kind: "stadium" },
  ];

  it("runs a full deterministic self-play loop where every step is a legal action", () => {
    const env = new BattleEnv(null); // null catalog → no attacks, but the rules still drive a game
    env.reset({ p1: mixDeck, p2: mixDeck, seed: 7 });
    // A reproducible pseudo-random policy (seeded LCG, not Math.random — determinism).
    let r = 123456789 >>> 0;
    const pick = (n: number): number => ((r = (1103515245 * r + 12345) >>> 0), r % n);
    let steps = 0;
    while (!env.done && steps < 1000) {
      const legal = env.legalActions();
      expect(legal.length).toBeGreaterThan(0); // never stuck while not terminal
      const res = env.step(legal[pick(legal.length)]!);
      expect(typeof res.reward).toBe("number");
      steps++;
    }
    expect(steps).toBeGreaterThan(0); // the loop actually advanced
  });

  it("observation hides the opponent's hand contents and encodes to a fixed-length vector", () => {
    const env = new BattleEnv(null);
    env.reset({ p1: mixDeck, p2: mixDeck, seed: 9 });
    const obs = env.observation("p1");
    expect(obs.opp).not.toHaveProperty("hand"); // only a COUNT is public
    expect(obs.opp.handCount).toBe(7);
    const vec = encodeObservation(observe(env.state, "p1"));
    expect(vec.length).toBe(encodeObservation(observe(env.state, "p2")).length); // stable layout
  });
});
