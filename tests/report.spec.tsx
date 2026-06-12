/**
 * P9.1 (docs/06 Phase 9, docs/08 §5C): the math health report — one click,
 * every vital exact, receipts identical to the source views (same selectors,
 * same stores), CTAs for the configurable sections, share PNG entry.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useQueryStore } from "../src/state/queryStore.ts";
import { useGradeStore } from "../src/state/gradeStore.ts";
import { computeGrades } from "../src/state/q5.ts";

/** The killer-demo deck (docs/02 §4): B=10, A=4 Basic, B-card=3, energy 12. */
function seedKillerDeck(): string {
  return useDeckStore.getState().importDeck("殺手示範", [
    { name: "火球鼠", count: 4, isBasic: true, section: "pokemon" },
    { name: "其他基礎", count: 6, isBasic: true, section: "pokemon" },
    { name: "超夢風暴", count: 3, section: "pokemon" },
    { name: "填充", count: 35, section: "trainer" },
    { name: "基本能量", count: 12, section: "energy" },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useQueryStore.setState({ tracked: [], mulliganAware: true });
  useGradeStore.setState({ ideal: [], playable: [] });
  useUiStore.setState({ activeView: "report", askTab: "q1", rotationMark: null });
});

describe("health report — zero-config sections", () => {
  it("shows the exact mulligan vitals, energy curve and prize risk anchors", async () => {
    seedKillerDeck();
    render(<App />);
    await viewReady();

    // Mulligan (B=10 anchor) with three formats.
    expect(screen.getAllByText("25.862923%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/75670\/292581/).length).toBeGreaterThanOrEqual(1);
    // Prize risk: the ×4 row reproduces the docs/02 §5 anchor.
    expect(screen.getByText("火球鼠 ×4:至少 1 張被獎賞")).toBeInTheDocument();
    expect(screen.getByText("35.145960%")).toBeInTheDocument();
    // Energy section renders three turn rows with the conditioning note.
    expect(screen.getByText(/第 1 回合/)).toBeInTheDocument();
    expect(screen.getByText(/第 3 回合/)).toBeInTheDocument();
    // CTAs for the two configurable sections.
    expect(screen.getByText(/先到「提問 → 品質分級」/)).toBeInTheDocument();
    expect(screen.getByText(/先到「提問 → 組合查詢」/)).toBeInTheDocument();
    // Share entry.
    expect(screen.getByRole("button", { name: "下載體檢圖卡 PNG" })).toBeInTheDocument();
  });

  it("the Q1 receipt matches the Ask view's receipt (golden id included)", async () => {
    seedKillerDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getAllByRole("button", { name: "展開數學收據 ▾" })[0]!);
    expect(screen.getByText(/opening_basics_B10/)).toBeInTheDocument();
    expect(screen.getByText("P(重抽) = C(50, 7) / C(60, 7)")).toBeInTheDocument();
  });
});

describe("health report — configured sections", () => {
  it("key combo reproduces the killer anchor once the query exists", async () => {
    const deckId = seedKillerDeck();
    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const idOf = (name: string) => deck.cards.find((c) => c.name === name)!.id;
    useQueryStore.setState({
      tracked: [
        { cardId: idOf("火球鼠"), kind: "atLeast", n: 1, a: 1, b: 2 },
        { cardId: idOf("超夢風暴"), kind: "atLeast", n: 1, a: 1, b: 2 },
      ],
      mulliganAware: true,
    });
    render(<App />);
    await viewReady();
    expect(await screen.findByText("15.383618%")).toBeInTheDocument();
  });

  it("grades fill in from the SAME store the grading view edits", async () => {
    const deckId = seedKillerDeck();
    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const defs = {
      ideal: [{ name: "火球鼠", min: 1 }],
      playable: [{ name: "其他基礎", min: 1 }],
    };
    useGradeStore.setState(defs);
    const expected = computeGrades(deck, defs)!;
    render(<App />);
    await viewReady();

    expect(screen.getAllByText(expected.ideal.percent).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(expected.dead.percent).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/先到「提問 → 品質分級」/)).not.toBeInTheDocument();
  });
});

describe("health report — guards", () => {
  it("under-60 deck: prize section explains the 60-card premise", async () => {
    useDeckStore.getState().importDeck("半成品", [
      { name: "某基礎", count: 10, isBasic: true },
      { name: "填充", count: 30 },
    ]);
    render(<App />);
    await viewReady();
    expect(screen.getByText(/獎賞卡數學以 60 張牌組為前提/)).toBeInTheDocument();
  });

  it("no deck: a single friendly empty state", async () => {
    render(<App />);
    await viewReady();
    expect(screen.getByText("牌組數學體檢報告")).toBeInTheDocument();
  });
});
