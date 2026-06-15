/**
 * 對戰沙盤 v2 (owner request 2026-06-16: 直接俾人揀熱門牌組) — each side picks its
 * OWN deck straight from the real 牌組推薦 meta, then the seeded shuffle deals a
 * faithful opening for both players independently.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useBattleStore } from "../src/state/battleStore.ts";
import { setDecksForTests, type DeckBuild, type DeckData } from "../src/data/decks.ts";

/** A real-shaped 60-card build: 12 basics + 48 filler trainers. */
function build60(): DeckBuild {
  return {
    event: "Cup",
    date: "2026-06-12",
    players: 64,
    online: false,
    placing: 1,
    total: 60,
    cards: [
      { count: 12, name: "多龍梅西亞", isBasic: true, section: "pokemon" },
      { count: 48, name: "博士的研究", isBasic: false, section: "trainer" },
    ],
  };
}

const FIXTURE: DeckData = {
  v: 1,
  source: "Limitless",
  note: "test",
  generatedFor: "2026-06-13",
  format: "H/I/J",
  sampleDecks: 100,
  tournaments: 5,
  dateFrom: "2026-06-05",
  dateTo: "2026-06-13",
  archetypes: [
    { id: "dragapult", name: "Dragapult", icons: ["dragapult"], deckCount: 30, score: 90, builds: [build60()] },
    { id: "slowking", name: "Slowking", icons: ["slowking"], deckCount: 20, score: 70, builds: [build60()] },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "battle", askTab: "q1", rotationMark: null });
  useBattleStore.getState().reset();
  setDecksForTests(FIXTURE);
});

afterEach(() => {
  setDecksForTests(null);
});

describe("BattleView v2 — pick popular decks for each side", () => {
  it("lets each side pick a real meta deck and deals both a faithful opening", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    // Two deck pickers appear, populated from the real meta options.
    const yours = await screen.findByLabelText("你嘅牌組");
    const opp = screen.getByLabelText("對手嘅牌組");
    // Pick distinct decks for the two sides (by the localized archetype label).
    await user.selectOptions(yours, "Dragapult");
    await user.selectOptions(opp, "Slowking");

    await user.click(screen.getByRole("button", { name: "開始對戰" }));

    const st = useBattleStore.getState();
    expect(st.started).toBe(true);
    // Both sides got an independent, faithful 60-card opening.
    for (const side of [st.p1, st.p2]) {
      expect(side.hand.length).toBe(7);
      expect(side.prizes.length).toBe(6);
      expect(side.hand.length + side.prizes.length + side.deck.length).toBe(60);
    }
    // The two sides really run different decks (names reflect the pick).
    expect(st.names.p1).not.toBe(st.names.p2);
  });
});
