/**
 * P8.4 (docs/06 Phase 8, docs/08 §5A): rotation preview — regulation marks
 * on deck rows, preview greying, the exact now-vs-after mulligan comparison,
 * and the one-click post-rotation fork that every other view recomputes on.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { openingBasics, percentStr } from "../src/lib/prob/index.ts";

function seedMarkedDeck(): string {
  const s = useDeckStore.getState();
  const deckId = s.importDeck("錨點", [
    { name: "火球鼠", count: 4, isBasic: true, section: "pokemon" },
    { name: "其他基礎", count: 6, isBasic: true, section: "pokemon" },
    { name: "超夢風暴", count: 3, section: "pokemon" },
    { name: "填充", count: 47, section: "trainer" },
  ]);
  const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
  const mark = (name: string) => {
    const card = deck.cards.find((c) => c.name === name)!;
    useDeckStore.getState().updateCard(deckId, card.id, { mark: "G" });
  };
  mark("火球鼠");
  mark("超夢風暴");
  return deckId;
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "deck", askTab: "q1", rotationMark: null });
});

describe("forkWithoutMark (store)", () => {
  it("copies the deck minus the marked rows; the source is untouched", () => {
    const deckId = seedMarkedDeck();
    const id = useDeckStore.getState().forkWithoutMark(deckId, "G", "錨點(輪替後)");
    expect(id).not.toBeNull();
    const s = useDeckStore.getState();
    const fork = s.decks.find((d) => d.id === id)!;
    expect(fork.name).toBe("錨點(輪替後)");
    expect(fork.cards.map((c) => c.name).sort()).toEqual(["其他基礎", "填充"]);
    expect(fork.cards.reduce((a, c) => a + c.count, 0)).toBe(53);
    const source = s.decks.find((d) => d.id === deckId)!;
    expect(source.cards).toHaveLength(4);
    expect(fork.cards.every((c) => !source.cards.some((sc) => sc.id === c.id))).toBe(true);
  });
});

describe("rotation preview UI", () => {
  it("greys rotating rows and shows the exact now/after comparison", async () => {
    seedMarkedDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.selectOptions(screen.getByLabelText("退場標記"), "G");

    expect(screen.getByText("將失去 7 張(其中基礎寶可夢 4 張)")).toBeInTheDocument();
    // Now: B=10/N=60 anchor; after: B=6/N=53 — both exact.
    const after = percentStr(openingBasics(6, 53, 7).mulligan, 6);
    expect(screen.getAllByText(/25\.862923%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(after)).toBeInTheDocument();
    // Fewer Basics ⇒ the mulligan rate worsens; the shift is flagged red.
    const delta = screen.getByText(/重抽概率變化/);
    expect(delta.textContent).toContain("+");
    expect(delta.className).toContain("text-bad");

    // Preview greying hits exactly the marked rows.
    const liOf = (name: string) => screen.getByDisplayValue(name).closest("li")!;
    expect(liOf("火球鼠").className).toContain("opacity-40");
    expect(liOf("超夢風暴").className).toContain("opacity-40");
    expect(liOf("其他基礎").className).not.toContain("opacity-40");
  });

  it("forks the post-rotation deck, activates it and clears the preview", async () => {
    seedMarkedDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.selectOptions(screen.getByLabelText("退場標記"), "G");
    await user.click(screen.getByRole("button", { name: "分叉出輪替後牌組" }));

    const s = useDeckStore.getState();
    expect(s.decks).toHaveLength(2);
    const active = s.decks.find((d) => d.id === s.activeDeckId)!;
    expect(active.name).toBe("錨點(輪替後)");
    expect(active.cards.reduce((a, c) => a + c.count, 0)).toBe(53);
    expect(useUiStore.getState().rotationMark).toBeNull();
    // The sidebar gauge now reads the post-rotation exact value.
    expect(
      screen.getAllByText(new RegExp(percentStr(openingBasics(6, 53, 7).mulligan, 6))).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows the setup hint when no row carries a mark", async () => {
    useDeckStore.getState().importDeck("無標記", [{ name: "填充", count: 60 }]);
    render(<App />);
    await viewReady();
    expect(screen.getByText(/先在牌組行右側設定賽制標記/)).toBeInTheDocument();
  });
});
