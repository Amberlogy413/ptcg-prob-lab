/**
 * P8.3 (docs/06 Phase 8, docs/08 §5A): deck-list outputs — the text-only
 * deck image carries every row plus EXACT badges, and the registration
 * sheet prints an original layout with player fields. DoD: no card images
 * anywhere in either output.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { buildDeckCardSvg, groupDeckRows, deckBadges } from "../src/utils/deckSheet.ts";

const LABELS = {
  sections: { pokemon: "寶可夢", trainer: "訓練家", energy: "能量", unknown: "未分類" },
  basicMark: "基礎",
  totalLabel: "合計",
  basicsLabel: "基礎寶可夢",
  mulliganLabel: "重抽概率",
  badge: "精確計算 · 非模擬",
  product: "PTCG 概率實驗室",
  footer: "全程 BigInt 精確分數",
} as const;

function seedAnchorDeck(): void {
  useDeckStore.getState().importDeck("錨點B10", [
    { name: "火球鼠", count: 4, isBasic: true, section: "pokemon" },
    { name: "其他基礎", count: 6, isBasic: true, section: "pokemon" },
    { name: "超夢風暴", count: 3, section: "pokemon" },
    { name: "檢索球", count: 35, section: "trainer" },
    { name: "基本能量", count: 12, section: "energy" },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "deck", askTab: "q1" });
});

describe("deck card SVG (text-only image)", () => {
  it("carries every row, section counts and the exact mulligan badge", () => {
    seedAnchorDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const { svg, height } = buildDeckCardSvg(deck, LABELS);

    for (const name of ["火球鼠", "其他基礎", "超夢風暴", "檢索球", "基本能量"]) {
      expect(svg).toContain(name);
    }
    expect(svg).toContain("寶可夢 · 13");
    expect(svg).toContain("訓練家 · 35");
    expect(svg).toContain("能量 · 12");
    expect(svg).toContain("合計 60");
    expect(svg).toContain("基礎寶可夢 10");
    // Exact badge — the value no shuffle-visualizer export can offer.
    expect(svg).toContain("重抽概率 25.862923% = 75670/292581");
    expect(svg).toContain("精確計算 · 非模擬");
    // DoD: a text-only card embeds no images of any kind.
    expect(svg).not.toContain("<image");
    expect(height).toBeGreaterThan(200);
  });

  it("omits the mulligan badge when it is not computable", () => {
    useDeckStore.getState().importDeck("無基礎", [{ name: "填充", count: 60 }]);
    const deck = useDeckStore.getState().decks[0]!;
    const badges = deckBadges(deck);
    expect(badges.mulligan).toBeUndefined();
    const { svg } = buildDeckCardSvg(deck, LABELS);
    expect(svg).not.toContain("重抽概率");
    expect(svg).toContain("合計 60");
  });

  it("groups rows in print order and skips empty sections", () => {
    seedAnchorDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const groups = groupDeckRows(deck);
    expect(groups.map((g) => g.section)).toEqual(["pokemon", "trainer", "energy"]);
    expect(groups[0]?.rows.map((r) => r.isBasic)).toEqual([true, true, false]);
  });
});

describe("registration sheet dialog", () => {
  it("fills player fields into the preview and prints via window.print", async () => {
    seedAnchorDeck();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getByRole("button", { name: "登錄牌表" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("選手姓名"), "陳大文");
    await user.type(within(dialog).getByLabelText("比賽名稱"), "城市賽");

    // Preview (inside the dialog) and the print-only portal both carry the
    // fields, the deck rows and the disclaimer.
    expect(within(dialog).getByText(/陳大文/)).toBeInTheDocument();
    const portal = document.querySelector(".deck-sheet-print");
    expect(portal).not.toBeNull();
    expect(portal!.className).toContain("hidden");
    expect(portal!.className).toContain("print:block");
    expect(portal!.textContent).toContain("陳大文");
    expect(portal!.textContent).toContain("城市賽");
    expect(portal!.textContent).toContain("火球鼠");
    expect(portal!.textContent).toContain("非官方粉絲專案");
    expect(portal!.querySelector("img")).toBeNull();
    expect(document.body.classList.contains("print-deck-sheet")).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: "列印" }));
    expect(printSpy).toHaveBeenCalledOnce();

    await user.click(within(dialog).getByRole("button", { name: "關閉" }));
    expect(document.body.classList.contains("print-deck-sheet")).toBe(false);
    expect(document.querySelector(".deck-sheet-print")).toBeNull();
    printSpy.mockRestore();
  });
});

describe("export dialog PNG entry", () => {
  it("shows the deck-image download button", async () => {
    seedAnchorDeck();
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "匯出牌表" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "下載牌組圖卡 PNG" })).toBeInTheDocument();
  });
});
