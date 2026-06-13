/**
 * 牌組推薦 (docs/06 Phase 11): real archetype deck recommendations, injected
 * as a fixture (no network). Verifies archetype grouping, field-size tier
 * labels, the exact-mulligan teaser, the card list, and loading a build into
 * the deck workspace with correct counts + isBasic.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { setDecksForTests, type DeckData } from "../src/data/decks.ts";
import { openingBasics, percentStr } from "../src/lib/prob/index.ts";

const FIXTURE: DeckData = {
  v: 1,
  source: "Limitless",
  note: "test",
  generatedFor: "2026-06-13",
  format: "H/I/J",
  sampleDecks: 4212,
  tournaments: 53,
  dateFrom: "2026-06-05",
  dateTo: "2026-06-13",
  archetypes: [
    {
      id: "ogerpon-hydrapple",
      name: "Ogerpon Hydrapple",
      icons: ["ogerpon", "hydrapple"],
      deckCount: 42,
      score: 99,
      builds: [
        {
          event: "Championship of Doom IX",
          date: "2026-06-12",
          players: 450,
          online: true,
          placing: 1,
          total: 60,
          cards: [
            // 10 Basics / 60 → B=10 anchor (mulligan 25.862923%).
            { count: 4, name: "厄勒袞ex", isBasic: true, section: "pokemon" },
            { count: 6, name: "其他基礎", isBasic: true, section: "pokemon" },
            { count: 4, name: "Hydrapple ex", isBasic: false, section: "pokemon" },
            { count: 4, name: "超級球", isBasic: false, section: "trainer" },
            { count: 38, name: "填充", isBasic: false, section: "trainer" },
            { count: 4, name: "基本草能量", isBasic: false, section: "energy" },
          ],
        },
        {
          event: "Local Store Cup",
          date: "2026-06-10",
          players: 24,
          online: false,
          placing: null,
          total: 60,
          cards: [
            { count: 3, name: "厄勒袞ex", isBasic: true, section: "pokemon" },
            { count: 7, name: "其他基礎", isBasic: true, section: "pokemon" },
            { count: 50, name: "填充", isBasic: false, section: "trainer" },
          ],
        },
      ],
    },
    {
      id: "dragapult",
      name: "Dragapult ex",
      icons: ["dragapult"],
      deckCount: 30,
      score: 70,
      builds: [
        {
          event: "Mid Event",
          date: "2026-06-11",
          players: 80,
          online: true,
          placing: 3,
          total: 60,
          cards: [{ count: 12, name: "多龍梅西亞", isBasic: true, section: "pokemon" }, { count: 48, name: "填充", isBasic: false, section: "trainer" }],
        },
      ],
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "decks", askTab: "q1", rotationMark: null });
  setDecksForTests(FIXTURE);
});

afterEach(() => {
  setDecksForTests(null);
});

describe("DecksView", () => {
  it("lists archetypes with deck counts and the honest source/tier notes", async () => {
    render(<App />);
    await viewReady();
    expect(await screen.findByText("Ogerpon Hydrapple")).toBeInTheDocument();
    expect(screen.getByText("Dragapult ex")).toBeInTheDocument();
    expect(screen.getByText(/42 套上榜/)).toBeInTheDocument();
    expect(screen.getByText(/官方等級「世界賽\/地區\/道館\/店賽」未開放 API/)).toBeInTheDocument();
  });

  it("shows the field-size tier, placing, and exact mulligan teaser for a build", async () => {
    render(<App />);
    await viewReady();
    // First archetype is open by default → its top build is the 450p winner.
    expect(await screen.findByText("大型賽事 450 人")).toBeInTheDocument();
    expect(screen.getByText("第 1 名")).toBeInTheDocument();
    // B=10/N=60 anchor mulligan, computed through the selector.
    const anchor = percentStr(openingBasics(10, 60, 7).mulligan, 6);
    expect(anchor).toBe("25.862923%");
    expect(screen.getAllByText(anchor).length).toBeGreaterThanOrEqual(1);
  });

  it("loads a build into the deck workspace with correct counts and isBasic", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click((await screen.findAllByRole("button", { name: "載入此牌組" }))[0]!);

    const s = useDeckStore.getState();
    expect(s.decks).toHaveLength(1);
    const deck = s.decks[0]!;
    expect(deck.cards.reduce((a, c) => a + c.count, 0)).toBe(60);
    expect(deck.cards.filter((c) => c.isBasic).reduce((a, c) => a + c.count, 0)).toBe(10);
    expect(deck.name).toContain("Ogerpon Hydrapple");
    // Loading switches to the deck workspace.
    expect(useUiStore.getState().activeView).toBe("deck");
  });

  it("expands a build's card list grouped by section", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click((await screen.findAllByRole("button", { name: "展開牌表" }))[0]!);
    expect(screen.getByText("厄勒袞ex")).toBeInTheDocument();
    expect(screen.getByText("Hydrapple ex")).toBeInTheDocument();
  });
});
