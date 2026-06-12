/**
 * P9.2 (docs/06 Phase 9, docs/08 §5C): goldfish mode — turn-by-turn draws
 * follow the exact curve's nSeen schedule, samples converge on the
 * unconditioned curve (docs/02 §6.2 anchors), and the relay check pairs the
 * exact §6.5 value with the running sample.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import {
  physicalCopies,
  goldfishGame,
  goldfishSeenBy,
  gameRng,
  type TrialCard,
} from "../src/state/trial.ts";

function killerCopies(): TrialCard[] {
  return physicalCopies([
    { name: "火球鼠", count: 4, isBasic: true },
    { name: "其他基礎", count: 6, isBasic: true },
    { name: "超夢風暴", count: 3, isBasic: false },
    { name: "填充", count: 47, isBasic: false },
  ]);
}

function seedKillerDeck(): void {
  useDeckStore.getState().importDeck("殺手示範", [
    { name: "火球鼠", count: 4, isBasic: true, section: "pokemon" },
    { name: "其他基礎", count: 6, isBasic: true, section: "pokemon" },
    { name: "超夢風暴", count: 3, section: "pokemon" },
    { name: "填充", count: 47, section: "trainer" },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "trial", askTab: "q1", rotationMark: null });
});

describe("goldfishGame engine", () => {
  const SCHEDULE = [8, 9, 10, 11, 12]; // going second, turns 1..5, current rules

  it("turn draws follow the nSeen schedule exactly and stay distinct", () => {
    const unique = physicalCopies(
      Array.from({ length: 60 }, (_, i) => ({ name: `卡${i}`, count: 1, isBasic: i < 10 })),
    );
    const deal = goldfishGame(unique, false, gameRng(5, 0), SCHEDULE);
    expect(deal.turnDraws.map((d) => d.length)).toEqual([1, 1, 1, 1, 1]);
    const all = [...deal.hand, ...deal.prizes, ...deal.turnDraws.flat()].map((c) => c.name);
    expect(all).toHaveLength(7 + 6 + 5);
    expect(new Set(all).size).toBe(all.length);
  });

  it("is deterministic for (seed, game) regardless of batching", () => {
    const copies = killerCopies();
    const a = goldfishGame(copies, false, gameRng(42, 3), SCHEDULE);
    const b = goldfishGame(copies, false, gameRng(42, 3), SCHEDULE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("sample 'seen X by turn 1' converges on the §6.2 anchor within 5σ", () => {
    const copies = killerCopies();
    let hits = 0;
    const games = 400;
    for (let g = 0; g < games; g++) {
      const deal = goldfishGame(copies, false, gameRng(42, g), SCHEDULE);
      if (goldfishSeenBy(deal, "火球鼠", 1)) hits++;
    }
    const p = 0.444821; // exact 43382/97527 (docs/02 §6.2, n=8), float for tolerance only
    const sigma = Math.sqrt((p * (1 - p)) / games);
    expect(Math.abs(hits / games - p)).toBeLessThan(5 * sigma);
  });

  it("mulligan loop never keeps a Basic-less hand in goldfish either", () => {
    const copies = killerCopies();
    for (let g = 0; g < 50; g++) {
      const deal = goldfishGame(copies, true, gameRng(9, g), SCHEDULE);
      expect(deal.hand.some((c) => c.isBasic)).toBe(true);
    }
  });
});

describe("goldfish UI", () => {
  it("shows the exact curve anchor, plays games and tallies samples", async () => {
    seedKillerDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.selectOptions(screen.getByLabelText("追蹤卡 X"), "火球鼠");
    // Exact column carries the §6.2 anchor at turn 1 (going second, nSeen=8).
    expect(screen.getByText(/= 43382\/97527/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "開 ×20 局" }));
    expect(screen.getByText("已開 20 局")).toBeInTheDocument();
    expect(screen.getByText(/今局抽牌序/)).toBeInTheDocument();

    // Relay check: exact §6.5 value appears beside the sample.
    await user.selectOptions(screen.getByLabelText("接力卡 B"), "超夢風暴");
    expect(screen.getByText(/P\(T1 前見 火球鼠 且 T3 前見 超夢風暴\)/)).toBeInTheDocument();
  });

  it("flags the §6.3 caveat when the mulligan loop is enabled", async () => {
    seedKillerDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("checkbox", { name: "重抽循環(真實規則)" }));
    expect(screen.getByText(/02 §6\.3 待辦/)).toBeInTheDocument();
  });
});
