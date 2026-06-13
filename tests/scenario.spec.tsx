/**
 * 情境分析器 (deep scenario): free multi-card exact joint over a custom state.
 * Math pinned by golden v2 scenario_joint; selector + UI verified here.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { setCatalogForTests } from "../src/data/catalog.ts";
import { computeScenario } from "../src/state/midgame.ts";

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "midgame", askTab: "q1", rotationMark: null });
  setCatalogForTests(null);
});
afterEach(() => setCatalogForTests(null));

describe("computeScenario (selector)", () => {
  it("single card ≥1 of a 4-of in 1 draw from 30 = 2/15 (matches golden)", () => {
    const r = computeScenario({ u: 30, w: 1, cards: [{ label: "A", count: 4, min: 1, max: 4 }] });
    expect(r.fraction).toBe("2/15");
    expect(r.perCard[0]!.fraction).toBe("2/15");
  });

  it("two-card joint ≥1 of 3 AND ≥1 of 2, draw 6 from 40 = 10745/109668", () => {
    const r = computeScenario({
      u: 40,
      w: 6,
      cards: [
        { label: "A", count: 3, min: 1, max: 3 },
        { label: "B", count: 2, min: 1, max: 2 },
      ],
    });
    expect(r.fraction).toBe("10745/109668");
    // joint is below the product of the two single-card marginals (neg corr).
    expect(r.perCard).toHaveLength(2);
    expect(r.derivation.some((l) => l.includes("10745/109668"))).toBe(true);
  });

  it("three-card combo ≥1 each of 2/2/1, draw 5 from 20 = 481/15504", () => {
    const r = computeScenario({
      u: 20,
      w: 5,
      cards: [
        { label: "A", count: 2, min: 1, max: 2 },
        { label: "B", count: 2, min: 1, max: 2 },
        { label: "C", count: 1, min: 1, max: 1 },
      ],
    });
    expect(r.fraction).toBe("481/15504");
  });
});

describe("情境分析器 view", () => {
  it("computes the joint live and lets you add/remove cards", async () => {
    render(<App />);
    await viewReady();

    // default one card; set U=40, draw=6, count=3, then add a second card.
    fireEvent.change(screen.getByLabelText("牌庫剩餘 U"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("抽牌數 N"), { target: { value: "6" } });
    const copies = screen.getAllByLabelText("牌庫內張數")[0]!;
    fireEvent.change(copies, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /自訂卡片/ }));
    const copies2 = screen.getAllByLabelText("牌庫內張數")[1]!;
    fireEvent.change(copies2, { target: { value: "2" } });

    // joint = 10745/109668 once both are ≥1 (defaults to ≥1).
    expect((await screen.findAllByText(/10745\/109668/)).length).toBeGreaterThanOrEqual(1);
    // marginal table appears for multi-card scenarios.
    expect(screen.getByText("單卡概率")).toBeInTheDocument();
  });

  it("guards impossible parameters", async () => {
    render(<App />);
    await viewReady();
    fireEvent.change(screen.getByLabelText("抽牌數 N"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("牌庫剩餘 U"), { target: { value: "3" } });
    expect(await screen.findByText(/參數不合法/)).toBeInTheDocument();
  });
});
