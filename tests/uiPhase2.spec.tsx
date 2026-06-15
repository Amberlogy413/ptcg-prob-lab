/**
 * 介面大改革 Phase 2 (docs/07 §3, #39): the deck empty-state uses the flagship
 * numbered OptionCard grid; TopNav shows the version tag and a mobile live chip
 * that echoes the active deck's exact mulligan reading. Neutral graphite only.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore, type Deck } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { APP_VERSION } from "../src/constants.ts";

const ANCHOR_DECK: Deck = {
  id: "d1",
  name: "Anchor",
  createdAt: 0,
  updatedAt: 0,
  cards: [
    { id: "c1", name: "基礎手", count: 10, isBasic: true, section: "pokemon" },
    { id: "c2", name: "填充", count: 50, isBasic: false, section: "trainer" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "deck", askTab: "q1", rotationMark: null });
});

describe("deck empty-state OptionGrid (Phase 2)", () => {
  it("shows four numbered action cards (01–04) for the entry points", async () => {
    render(<App />);
    await viewReady();
    for (const badge of ["01", "02", "03", "04"]) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /組牌工坊/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /匯入牌表/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /範本牌組庫/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /從第一張卡開始/ })).toBeInTheDocument();
  });
});

describe("TopNav version tag + mobile live chip (Phase 2)", () => {
  it("shows the build version tag pinned to APP_VERSION", async () => {
    render(<App />);
    await viewReady();
    expect(screen.getByText(`· V${APP_VERSION}`)).toBeInTheDocument();
  });

  it("echoes the active deck's exact mulligan in the live chip", async () => {
    useDeckStore.setState({ decks: [ANCHOR_DECK], activeDeckId: "d1", basicTags: {}, aliases: {} });
    render(<App />);
    await viewReady();
    // B=10/N=60 anchor mulligan = 25.862923%.
    const chip = screen.getByTitle(/重抽概率/);
    expect(within(chip).getByText("重抽")).toBeInTheDocument();
    expect(within(chip).getByText("25.862923%")).toBeInTheDocument();
  });

  it("hides the live chip when there is no active deck", async () => {
    render(<App />);
    await viewReady();
    expect(screen.queryByTitle(/重抽概率/)).not.toBeInTheDocument();
  });
});
