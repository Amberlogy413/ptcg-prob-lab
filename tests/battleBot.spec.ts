/**
 * Rule-based auto-player (#36 AI battle, owner 2026-06-18). The bot is a
 * DETERMINISTIC heuristic over the real rules engine — not a trained model — so
 * its turn is fully predictable: ensure an Active, bench Basics, attach one
 * Energy, then end the turn. (Attack selection is exercised by battleAttack.spec.)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBattleStore, type BattleCard, type PlayerBoard } from "../src/state/battleStore.ts";
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
