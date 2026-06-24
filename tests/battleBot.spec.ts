/**
 * Rule-based auto-player (#36 AI battle, owner 2026-06-18). The bot is a
 * DETERMINISTIC heuristic over the real rules engine — not a trained model — so
 * its turn is fully predictable: ensure an Active, bench Basics, attach one
 * Energy, then end the turn. (Attack selection is exercised by battleAttack.spec.)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBattleStore, type BattleCard, type InPlay, type PlayerBoard } from "../src/state/battleStore.ts";
import { runBotTurn } from "../src/state/battleBot.ts";
import { normalizeCatalog, type Catalog } from "../src/data/catalog.ts";

function bc(iid: string, kind: BattleCard["kind"], over: Partial<BattleCard> = {}): BattleCard {
  const section: BattleCard["section"] =
    kind === "basic" || kind === "evolution" ? "pokemon" : kind.startsWith("energy") ? "energy" : kind === "unknown" ? "unknown" : "trainer";
  return { iid, name: iid, isBasic: kind === "basic", section, kind, ...over };
}
function emptyBoard(): PlayerBoard {
  // 6 Prize cards = a real, not-yet-decided game (empty prizes would read as an
  // instant prize-win, so gameResult would short-circuit the bot's end-of-turn).
  return { deck: [], hand: [], discard: [], prizes: new Array(6).fill(0).map((_, i) => bc(`pz${i}`, "basic")), lostzone: [], active: null, bench: [], stadium: null };
}
const ctx = { who: "Bot", nameOf: (c: BattleCard) => c.name, autoKey: (c: BattleCard) => c.name };

beforeEach(() => useBattleStore.getState().reset());

describe("runBotTurn — deterministic heuristic", () => {
  it("plays an Active, benches a Basic, attaches one Energy, then ends the turn", () => {
    useBattleStore.setState({
      started: true,
      turn: 2,
      current: "p1",
      firstPlayer: "p1",
      turnEnergyAttached: false,
      turnSupporterUsed: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: false, p2: false },
      p1: { ...emptyBoard(), hand: [bc("pika", "basic", { hp: 60 }), bc("snom", "basic", { hp: 40 }), bc("fire", "energy-basic")] },
      p2: emptyBoard(),
      log: [],
    });

    const events = runBotTurn("p1", null, ctx);
    const { p1, current } = useBattleStore.getState();

    expect(p1.active).not.toBeNull();
    expect(p1.active!.energy.length).toBe(1); // one Energy attached
    expect(p1.bench.length).toBe(1); // the second Basic benched
    expect(current).toBe("p2"); // the bot ended its turn
    expect(events.some((e) => e.key === "battle.log.endTurn")).toBe(true);
    expect(events.some((e) => e.key === "battle.log.active")).toBe(true);
  });

  it("plays a Nest Ball to bench a Basic from the deck when the bench is thin (engine-routed)", () => {
    // A minimal real-shaped catalog with just Nest Ball (deck → Basic → Bench).
    const NEST = "從自己的牌庫選擇1張【基礎】寶可夢卡，放置於備戰區。並且重洗牌庫。";
    const cat = { sets: {}, cards: [{ id: "nest", localId: "1", name: "巢穴球", nameZh: "巢穴球", category: "Trainer", trainerType: "Item", set: "X", effect: NEST }] } as unknown as Catalog;
    normalizeCatalog(cat);
    useBattleStore.setState({
      started: true,
      seed: 1,
      shuffleNonce: 0,
      turn: 2,
      current: "p1",
      firstPlayer: "p1",
      turnEnergyAttached: false,
      turnSupporterUsed: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: false, p2: false },
      p1: { ...emptyBoard(), hand: [bc("pika", "basic", { hp: 60 }), bc("nestball", "item", { name: "巢穴球", catalogId: "nest" })], deck: [bc("deckMon", "basic", { hp: 70, name: "Snorlax" }), bc("filler", "item")] },
      p2: emptyBoard(),
      log: [],
    });

    const events = runBotTurn("p1", cat, ctx);
    const { p1 } = useBattleStore.getState();
    expect(p1.active?.card.iid).toBe("pika"); // step 1 put the hand Basic to Active
    expect(p1.bench.some((u) => u.card.iid === "deckMon")).toBe(true); // Nest Ball benched the deck Basic
    expect(p1.deck.some((c) => c.iid === "deckMon")).toBe(false); // it left the deck
    expect(p1.discard.some((c) => c.iid === "nestball")).toBe(true); // the Item was used → discard
    expect(events.some((e) => e.key === "battle.log.botBall")).toBe(true); // and it's reported in the log
  });

  it("plays a to-hand Pokémon search (Master Ball) to fetch a BASIC (not an evolution) and bench it", () => {
    const MASTER = "從自己的牌庫選擇1張寶可夢卡，在給對手看過後加入手牌。並且重洗牌庫。";
    const cat = { sets: {}, cards: [{ id: "master", localId: "1", name: "大師球", nameZh: "大師球", category: "Trainer", trainerType: "Item", set: "X", effect: MASTER }] } as unknown as Catalog;
    normalizeCatalog(cat);
    useBattleStore.setState({
      started: true,
      seed: 1,
      shuffleNonce: 0,
      turn: 2,
      current: "p1",
      firstPlayer: "p1",
      turnEnergyAttached: false,
      turnSupporterUsed: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: false, p2: false },
      // deck has an evolution FIRST — the bot must skip it and fetch the Basic to bench.
      p1: { ...emptyBoard(), hand: [bc("pika", "basic", { hp: 60 }), bc("mb", "item", { name: "大師球", catalogId: "master" })], deck: [bc("evo", "evolution", { hp: 90, name: "Evo" }), bc("deckMon", "basic", { hp: 70, name: "Snorlax" })] },
      p2: emptyBoard(),
      log: [],
    });

    const events = runBotTurn("p1", cat, ctx);
    const { p1 } = useBattleStore.getState();
    expect(p1.bench.some((u) => u.card.iid === "deckMon")).toBe(true); // fetched the Basic and benched it
    expect(p1.bench.some((u) => u.card.iid === "evo")).toBe(false); // never benched the evolution
    expect(p1.discard.some((c) => c.iid === "mb")).toBe(true); // Master Ball used → discard
    expect(events.some((e) => e.key === "battle.log.botBall")).toBe(true);
  });

  it("gusts up a KO'able Benched Pokémon (Boss's Orders) when it nets more prizes, then KOs it", () => {
    const GUST = "選擇1隻對手的備戰寶可夢，與戰鬥寶可夢互換。";
    const cat = { sets: {}, cards: [
      { id: "boss", localId: "1", name: "老大的指令", nameZh: "老大的指令", category: "Trainer", trainerType: "Supporter", set: "X", effect: GUST },
      { id: "atk", localId: "2", name: "皮卡丘", nameZh: "皮卡丘", category: "Pokemon", stage: "Basic", set: "X", types: ["Lightning"], hp: 70, attacks: [{ name: "Bolt", cost: ["Colorless"], damage: 90 }] },
      { id: "wall", localId: "3", name: "高牆", nameZh: "高牆", category: "Pokemon", stage: "Basic", set: "X", hp: 200, attacks: [] },
      { id: "squishy", localId: "4", name: "軟軟", nameZh: "軟軟", category: "Pokemon", stage: "Basic", set: "X", hp: 60, attacks: [] },
    ] } as unknown as Catalog;
    normalizeCatalog(cat);
    const inplay = (iid: string, card: BattleCard, over: Partial<InPlay> = {}): InPlay => ({ uid: iid, card, under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [], ...over });
    useBattleStore.setState({
      started: true,
      seed: 1,
      shuffleNonce: 0,
      turn: 2,
      current: "p1",
      firstPlayer: "p1",
      turnEnergyAttached: false,
      turnSupporterUsed: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: true, p2: true },
      p1: { ...emptyBoard(), active: inplay("atk", bc("atk", "basic", { name: "皮卡丘", catalogId: "atk", hp: 70 }), { energy: [bc("le", "energy-basic", { name: "基本雷能量" })] }), hand: [bc("boss", "supporter", { name: "老大的指令", catalogId: "boss" })] },
      // opp Active (高牆 200HP) can't be KO'd by 90; the Benched 軟軟 (60HP) can.
      p2: { ...emptyBoard(), active: inplay("wall", bc("wall", "basic", { name: "高牆", catalogId: "wall", hp: 200 })), bench: [inplay("squishy", bc("squishy", "basic", { name: "軟軟", catalogId: "squishy", hp: 60 }))] },
      log: [],
    });

    const events = runBotTurn("p1", cat, ctx);
    const { p1, p2 } = useBattleStore.getState();
    expect(events.some((e) => e.key === "battle.log.botGust")).toBe(true); // gusted the Bench Pokémon up
    expect(p2.bench.some((u) => u.card.iid === "wall")).toBe(true); // the old Active was demoted to Bench
    expect(p2.active).toBeNull(); // the gusted-up 軟軟 was KO'd (opp promotes on its own turn)
    expect(p2.discard.some((c) => c.iid === "squishy")).toBe(true);
    expect(p1.prizes.length).toBe(5); // took 1 Prize for the KO
    expect(p1.discard.some((c) => c.iid === "boss")).toBe(true); // Boss's Orders used → discard
  });

  it("does NOT gust when KOing the current Active is worth at least as much (no pointless gust)", () => {
    const GUST = "選擇1隻對手的備戰寶可夢，與戰鬥寶可夢互換。";
    const cat = { sets: {}, cards: [
      { id: "boss", localId: "1", name: "老大的指令", nameZh: "老大的指令", category: "Trainer", trainerType: "Supporter", set: "X", effect: GUST },
      { id: "atk", localId: "2", name: "皮卡丘", nameZh: "皮卡丘", category: "Pokemon", stage: "Basic", set: "X", types: ["Lightning"], hp: 70, attacks: [{ name: "Bolt", cost: ["Colorless"], damage: 90 }] },
      { id: "front", localId: "3", name: "前鋒", nameZh: "前鋒", category: "Pokemon", stage: "Basic", set: "X", hp: 60, attacks: [] },
      { id: "back", localId: "4", name: "後排", nameZh: "後排", category: "Pokemon", stage: "Basic", set: "X", hp: 60, attacks: [] },
    ] } as unknown as Catalog;
    normalizeCatalog(cat);
    const inplay = (iid: string, card: BattleCard, over: Partial<InPlay> = {}): InPlay => ({ uid: iid, card, under: [], energy: [], tools: [], damage: 0, playedTurn: 1, status: [], ...over });
    useBattleStore.setState({
      started: true, seed: 1, shuffleNonce: 0, turn: 2, current: "p1", firstPlayer: "p1",
      turnEnergyAttached: false, turnSupporterUsed: false, turnStadiumPlayed: false, turnRetreated: false,
      everInPlay: { p1: true, p2: true },
      p1: { ...emptyBoard(), active: inplay("atk", bc("atk", "basic", { name: "皮卡丘", catalogId: "atk", hp: 70 }), { energy: [bc("le", "energy-basic", { name: "基本雷能量" })] }), hand: [bc("boss", "supporter", { name: "老大的指令", catalogId: "boss" })] },
      // both the Active and the Bench are 1-prize 60HP KOs — gusting gains nothing.
      p2: { ...emptyBoard(), active: inplay("front", bc("front", "basic", { name: "前鋒", catalogId: "front", hp: 60 })), bench: [inplay("back", bc("back", "basic", { name: "後排", catalogId: "back", hp: 60 }))] },
      log: [],
    });

    const events = runBotTurn("p1", cat, ctx);
    const { p1, p2 } = useBattleStore.getState();
    expect(events.some((e) => e.key === "battle.log.botGust")).toBe(false); // no gust — KOing the Active is just as good
    expect(p2.active).toBeNull(); // it KO'd the current Active (前鋒) directly
    expect(p2.bench.some((u) => u.card.iid === "back")).toBe(true); // the Bench Pokémon was never dragged up
    expect(p1.discard.some((c) => c.iid === "boss")).toBe(false); // Boss's Orders not spent pointlessly
  });

  it("with no playable Pokémon it simply ends the turn (no fabrication)", () => {
    useBattleStore.setState({
      started: true,
      turn: 2,
      current: "p1",
      firstPlayer: "p1",
      turnEnergyAttached: false,
      turnSupporterUsed: false,
      turnStadiumPlayed: false,
      turnRetreated: false,
      everInPlay: { p1: false, p2: false },
      p1: { ...emptyBoard(), hand: [bc("ball", "item")] }, // only an Item, no Pokémon
      p2: emptyBoard(),
      log: [],
    });

    const events = runBotTurn("p1", null, ctx);
    const { p1, current } = useBattleStore.getState();
    expect(p1.active).toBeNull();
    expect(current).toBe("p2");
    expect(events[events.length - 1]?.key).toBe("battle.log.endTurn");
  });
});
