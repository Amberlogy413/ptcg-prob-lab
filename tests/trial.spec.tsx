/**
 * P8.1 試抽桌 (docs/06 Phase 8, docs/08 §5A): seeded honest dealer — the same
 * seed reproduces the same deals regardless of batching; the mulligan loop
 * never keeps a Basic-less hand; the batch tally converges on the exact
 * mulligan probability; the UI overlays the exact value beside the sample.
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
  emptyStats,
  runTrials,
  dealGame,
  gameRng,
  TRIAL_MIN_CARDS,
  type TrialCard,
} from "../src/state/trial.ts";

function copiesOf(basics: number, total = 60): TrialCard[] {
  return physicalCopies([
    { name: "某基礎", count: basics, isBasic: true },
    { name: "填充", count: total - basics, isBasic: false },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "trial", askTab: "q1" });
});

describe("trial dealing engine", () => {
  it("is deterministic and batching-invariant for a fixed seed", () => {
    const copies = copiesOf(10);
    const oneBatch = runTrials(copies, true, 42, 0, 25, emptyStats());
    let acc = emptyStats();
    let last = null as ReturnType<typeof runTrials>["lastDeal"] | null;
    for (let g = 0; g < 25; g++) {
      const r = runTrials(copies, true, 42, g, 1, acc);
      acc = r.stats;
      last = r.lastDeal;
    }
    expect(acc).toEqual(oneBatch.stats);
    expect(JSON.stringify(last)).toBe(JSON.stringify(oneBatch.lastDeal));
  });

  it("mulligan loop never keeps a Basic-less hand (B=1 stress)", () => {
    const copies = copiesOf(1);
    const { stats } = runTrials(copies, true, 7, 0, 100, emptyStats());
    expect(stats.games).toBe(100);
    expect(stats.keptBasics[0]).toBe(0);
    const keptTotal = stats.keptBasics.reduce((s, c) => s + c, 0);
    expect(keptTotal).toBe(100);
    // q = C(59,7)/C(60,7) = 53/60 ≈ 88.3%: redeals are a near-certainty.
    expect(stats.mulligans).toBeGreaterThan(0);
    expect(stats.attempts).toBe(stats.games + stats.mulligans);
  });

  it("deals 14 distinct physical copies (hand + prizes + first draw)", () => {
    const unique = physicalCopies(
      Array.from({ length: 60 }, (_, i) => ({ name: `卡${i}`, count: 1, isBasic: i < 10 })),
    );
    const deal = dealGame(unique, true, gameRng(3, 0));
    const names = [...deal.hand, ...deal.prizes, deal.firstDraw].map((c) => c.name);
    expect(names).toHaveLength(TRIAL_MIN_CARDS);
    expect(new Set(names).size).toBe(TRIAL_MIN_CARDS);
  });

  it("without any Basic the loop is disabled and never spins", () => {
    const copies = copiesOf(0);
    const { stats } = runTrials(copies, false, 1, 0, 20, emptyStats());
    expect(stats.mulligans).toBe(0);
    expect(stats.attempts).toBe(20);
  });

  it("rejects decks below the 14-card minimum", () => {
    expect(() => dealGame(copiesOf(1, 13), true, gameRng(1, 0))).toThrow(RangeError);
  });

  it("sample mulligan rate converges on the exact value within 5σ (B=10)", () => {
    const copies = copiesOf(10);
    const { stats } = runTrials(copies, true, 42, 0, 400, emptyStats());
    const q = 0.25862923; // exact 75670/292581 (docs/02 §8), float for tolerance only
    const pHat = stats.mulligans / stats.attempts;
    const sigma = Math.sqrt((q * (1 - q)) / stats.attempts);
    expect(Math.abs(pHat - q)).toBeLessThan(5 * sigma);
  });
});

describe("trial table UI", () => {
  function seedDeck(): void {
    useDeckStore.getState().importDeck("錨點", [
      { name: "某基礎", count: 10, isBasic: true },
      { name: "填充", count: 50 },
    ]);
  }

  it("deals on click and overlays the exact mulligan probability", async () => {
    seedDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    expect(screen.getByText(/按「試抽一手」開始/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "試抽一手" }));

    expect(screen.getByText("起手七張")).toBeInTheDocument();
    expect(screen.getByText(/已試 1 手/)).toBeInTheDocument();
    // Exact overlay (B=10 anchor) appears beside the sample stats.
    expect(screen.getAllByText(/25\.862923%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/伯努利試驗/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "試抽 ×100" }));
    expect(screen.getByText(/已試 101 手/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重設統計" }));
    expect(screen.getByText(/按「試抽一手」開始/)).toBeInTheDocument();
  });

  it("warns when no Basic is tagged and still deals unconditioned", async () => {
    useDeckStore.getState().importDeck("無基礎", [{ name: "填充", count: 60 }]);
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    expect(screen.getByText(/不啟用重抽循環/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "試抽一手" }));
    expect(screen.getByText("起手七張")).toBeInTheDocument();
    expect(screen.getByText(/首發即留用/)).toBeInTheDocument();
  });
});
