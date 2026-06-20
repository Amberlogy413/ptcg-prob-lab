/**
 * Rule-based auto-player (#36 AI battle, owner 2026-06-18). The bot is a
 * DETERMINISTIC heuristic over the real rules engine — not a trained model — so
 * its turn is fully predictable: ensure an Active, bench Basics, attach one
 * Energy, then end the turn. (Attack selection is exercised by battleAttack.spec.)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBattleStore, type BattleCard, type PlayerBoard } from "../src/state/battleStore.ts";
import { runBotTurn } from "../src/state/battleBot.ts";

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
