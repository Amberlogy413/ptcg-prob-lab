/**
 * Phase 2 DoD (docs/06): B=10 deck shows 25.862923% / 75670/292581 /
 * 1 in 3.867; the math receipt expands and copies; anchors match docs/02;
 * the precision ruler carries an aria-label with the exact value.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { computeQ1, groupDigits } from "../src/state/selectors.ts";

function seedAnchorDeck(basics = 10, others = 50): void {
  useDeckStore.getState().importDeck("Anchor", [
    { name: "Some Basic", count: basics, isBasic: true },
    { name: "Other Cards", count: others },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "ask" });
});

describe("computeQ1 (anchors from docs/02 §3 / §8)", () => {
  it("B=10, N=60: headline, receipt and conditional k=0", () => {
    seedAnchorDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const r = computeQ1(deck);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;

    expect(r.data.headline.percent).toBe("25.862923%");
    expect(r.data.headline.fraction).toBe("75670/292581");
    expect(r.data.headline.oneIn).toBe("1 in 3.867");
    expect(r.data.headline.games).toBe("3.9");
    expect(r.data.validPercent).toBe("74.137077%");
    expect(r.data.expectedMulligans).toBe("0.348853");
    expect(r.data.expectedBasicsFraction).toBe("7/6"); // 7·10/60
    expect(r.data.expectedBasicsDecimal).toBe("1.166667");

    // Raw distribution: dist[0] IS the mulligan probability.
    expect(r.data.raw[0]?.percent).toBe("25.862923%");
    // Conditional distribution: k = 0 is exactly zero, three formats.
    expect(r.data.conditional[0]?.percent).toBe("0.000000%");
    expect(r.data.conditional[0]?.fraction).toBe("0/1");
    expect(r.data.conditional[0]?.oneIn).toBe("—");

    // Exactly-m geometric: m=0 is the valid-hand probability.
    expect(r.data.exactM[0]?.percent).toBe("74.1371%");
    expect(r.data.exactM).toHaveLength(5);

    // Receipt: real binomials, raw → reduced fraction, checks.
    expect(r.data.receipt.subst.num).toBe("99,884,400"); // C(50,7)
    expect(r.data.receipt.subst.den).toBe("386,206,920"); // C(60,7)
    expect(r.data.receipt.total.raw).toBe("99884400/386206920");
    expect(r.data.receipt.total.reduced).toBe("75670/292581");
    expect(r.data.receipt.identityOk).toBe(true);
    expect(r.data.receipt.goldenId).toBe("opening_basics_B10");
  });

  it("guards: no deck / under 7 cards / no Basics", () => {
    expect(computeQ1(null).status).toBe("noDeck");
    useDeckStore.getState().importDeck("Tiny", [{ name: "A", count: 3, isBasic: true }]);
    expect(computeQ1(useDeckStore.getState().decks[0]!).status).toBe("tooFewCards");
    useDeckStore.getState().importDeck("NoBasics", [{ name: "B", count: 60 }]);
    expect(computeQ1(useDeckStore.getState().decks[1]!).status).toBe("noBasics");
  });

  it("groupDigits formats BigInt integers", () => {
    expect(groupDigits(99884400n)).toBe("99,884,400");
    expect(groupDigits(7n)).toBe("7");
  });
});

describe("AskView (Q1)", () => {
  it("shows the three-format headline, ruler aria-label and conditional default", () => {
    seedAnchorDeck();
    render(<App />);

    // Headline (also appears in the dashboard card).
    expect(screen.getAllByText("25.862923%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("75670/292581 · 1 in 3.867").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/約每 3\.9 場就有 1 場開局重抽/)).toBeInTheDocument();

    // a11y: precision ruler exposes the exact value.
    const rulers = screen.getAllByRole("img", { name: /25\.862923%.*75670\/292581/ });
    expect(rulers.length).toBeGreaterThanOrEqual(1);

    // Mulligan-aware is the default view; k=0 row is exactly zero.
    const toggle = screen.getByRole("button", { name: "你實際拿到的手(已含重抽)" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("0/1")).toBeInTheDocument();
    expect(screen.getByText("0.000000%")).toBeInTheDocument();
  });

  it("switches to the raw distribution", async () => {
    seedAnchorDeck();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "原始分布(未含重抽)" }));
    expect(screen.getByRole("button", { name: "原始分布(未含重抽)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Raw table now contains the k=0 mulligan row value (headline + dashboard + row).
    expect(screen.getAllByText("25.862923%").length).toBeGreaterThanOrEqual(3);
  });

  it("expands and copies the math receipt", async () => {
    seedAnchorDeck();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "展開數學收據 ▾" }));
    expect(screen.getByText("P(重抽) = C(50, 7) / C(60, 7)")).toBeInTheDocument();
    expect(screen.getByText("C(50, 7) = 99,884,400;C(60, 7) = 386,206,920")).toBeInTheDocument();
    expect(screen.getByText("99884400/386206920 → 既約 75670/292581 = 25.862923%")).toBeInTheDocument();
    expect(screen.getByText(/opening_basics_B10/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "複製收據" }));
    expect(await screen.findByRole("button", { name: "已複製" })).toBeInTheDocument();
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain("75670/292581");
    expect(copied).toContain("全程 BigInt 精確分數;小數為 round-half-up 顯示。");
  });

  it("guards render guidance instead of crashing", () => {
    render(<App />);
    const main = screen.getByRole("main");
    expect(within(main).getAllByText("尚未選擇牌組。").length).toBeGreaterThanOrEqual(1);
  });
});
