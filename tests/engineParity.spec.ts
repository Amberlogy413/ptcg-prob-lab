/**
 * Store ⇆ engine PARITY (#36 → AI agent, owner 2026-06-18). The pure engine
 * (src/engine) and the live UI store (src/state/battleStore) carry SEPARATE
 * implementations of the SHARED primitives (seeded shuffle, deal, draw,
 * shuffle-hand-into-deck). This test pins THOSE primitives together so the shared
 * deck mechanics can never silently diverge. It does NOT (and cannot) assert
 * parity for the whole action reducer: the engine is intentionally STRICTER than
 * the manual sandbox in documented ways (docs/11_AI_AGENT.md §4) — e.g. it pays
 * the retreat cost, enforces the turn-1 first-player draw, and ends the turn on
 * attack. Both implementations use the same mulberry32 + index-based
 * Fisher–Yates, so for identical deck CONTENT the resulting card-name ORDER must
 * match position-by-position.
 *
 * NOTE on the one deliberate deal difference: the engine performs the going-first
 * player's mandatory turn-1 draw inside newGame (opening 7 → 8), while the store's
 * newGame deals a clean 7 and leaves the turn-1 draw to a manual UI action. So we
 * compare the GOING-SECOND player (p2) for a clean full-deal match, and verify the
 * going-first player (p1) equals "store deal + one card off the top".
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useBattleStore, type CardSpec } from "../src/state/battleStore.ts";
import { newGame } from "../src/engine/index.ts";
import { drawN, shuffleHandIntoDeck } from "../src/engine/ops.ts";

beforeEach(() => useBattleStore.getState().reset());

const SPECS: CardSpec[] = [
  { name: "Pikachu", count: 4, isBasic: true, section: "pokemon", kind: "basic" },
  { name: "Raichu", count: 3, isBasic: false, section: "pokemon", kind: "evolution" },
  { name: "Professor", count: 4, isBasic: false, section: "trainer", kind: "supporter" },
  { name: "Ball", count: 4, isBasic: false, section: "trainer", kind: "item" },
  { name: "Switch", count: 3, isBasic: false, section: "trainer", kind: "item" },
  { name: "Lightning Energy", count: 12, isBasic: false, section: "energy", kind: "energy-basic" },
  { name: "Filler", count: 30, isBasic: true, section: "pokemon", kind: "basic" },
];
const names = (cards: { name: string }[]) => cards.map((c) => c.name);

describe("store ⇆ engine parity", () => {
  it("the deal matches: going-second is identical, going-first = store deal + the turn-1 draw", () => {
    const seed = 0x51ed;
    useBattleStore.getState().newGame({ p1: SPECS, p2: SPECS, seed, first: "p1" });
    const store = useBattleStore.getState();
    const eng = newGame({ p1: SPECS, p2: SPECS, seed, first: "p1" });

    // p2 (going second): clean full-deal parity — hand / prizes / deck identical.
    expect(names(eng.p2.hand)).toEqual(names(store.p2.hand));
    expect(names(eng.p2.prizes)).toEqual(names(store.p2.prizes));
    expect(names(eng.p2.deck)).toEqual(names(store.p2.deck));

    // p1 (going first): prizes identical; the engine has drawn the top deck card.
    expect(names(eng.p1.prizes)).toEqual(names(store.p1.prizes));
    expect(names(eng.p1.hand)).toEqual([...names(store.p1.hand), store.p1.deck[0]!.name]);
    expect(names(eng.p1.deck)).toEqual(names(store.p1.deck.slice(1)));
  });

  it("draw takes the same cards off the top in both implementations (going-second, no turn-1 offset)", () => {
    const seed = 0xd00d;
    useBattleStore.getState().newGame({ p1: SPECS, p2: SPECS, seed, first: "p1" });
    useBattleStore.getState().draw("p2", 3);
    const store = useBattleStore.getState();

    let eng = newGame({ p1: SPECS, p2: SPECS, seed, first: "p1" });
    eng = drawN(eng, "p2", 3);

    expect(names(eng.p2.hand)).toEqual(names(store.p2.hand));
    expect(names(eng.p2.deck)).toEqual(names(store.p2.deck));
  });

  it("shuffleHandIntoDeck reshuffles to the same deck order (same nonce + content)", () => {
    const seed = 0xbeef;
    useBattleStore.getState().newGame({ p1: SPECS, p2: SPECS, seed, first: "p1" });
    useBattleStore.getState().shuffleHandIntoDeck("p2");
    const store = useBattleStore.getState();

    let eng = newGame({ p1: SPECS, p2: SPECS, seed, first: "p1" });
    eng = shuffleHandIntoDeck(eng, "p2");

    expect(eng.p2.hand.length).toBe(0);
    expect(names(eng.p2.deck)).toEqual(names(store.p2.deck));
  });
});
