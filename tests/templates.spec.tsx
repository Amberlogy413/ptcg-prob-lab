/**
 * P8.2 (docs/06 Phase 8, docs/08 §5A): template deck bank — every skeleton
 * is exactly 60 text-only cards with ≥1 Basic; one click loads it and the
 * sidebar immediately shows the exact mulligan rate. Plus the import-bridge
 * guide inside the wizard.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { DECK_TEMPLATES, templateTotal, templateBasics } from "../src/data/templates.ts";

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "deck", askTab: "q1" });
});

describe("template bank data integrity", () => {
  it("every template is exactly 60 cards with at least one Basic", () => {
    expect(DECK_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    for (const tpl of DECK_TEMPLATES) {
      expect(templateTotal(tpl), tpl.id).toBe(60);
      expect(templateBasics(tpl), tpl.id).toBeGreaterThan(0);
      for (const c of tpl.cards) expect(c.count, `${tpl.id}/${c.name}`).toBeGreaterThan(0);
    }
  });

  it("ids are unique and both locales carry name + blurb keys", () => {
    const ids = DECK_TEMPLATES.map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
    for (const file of ["zh-Hant.json", "en.json"]) {
      const dict = JSON.parse(readFileSync(join(root, file), "utf8")) as Record<string, string>;
      for (const id of ids) {
        expect(dict[`templates.${id}.name`], `${file} templates.${id}.name`).toBeTruthy();
        expect(dict[`templates.${id}.blurb`], `${file} templates.${id}.blurb`).toBeTruthy();
      }
    }
  });
});

describe("template bank UI", () => {
  it("loads the teaching anchor; the sidebar shows the exact mulligan rate", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getByRole("button", { name: "範本牌組庫" }));
    const dialog = screen.getByRole("dialog");
    // The badge itself already shows the exact value before loading.
    expect(within(dialog).getAllByText(/25\.862923%/).length).toBeGreaterThanOrEqual(1);

    await user.click(
      within(dialog).getByRole("button", { name: "載入:雙軸混合(教學錨點)" }),
    );

    const s = useDeckStore.getState();
    expect(s.decks).toHaveLength(1);
    expect(s.decks[0]?.cards.reduce((a, c) => a + c.count, 0)).toBe(60);
    expect(s.activeDeckId).toBe(s.decks[0]?.id);
    // DeckSummary gauge: B=10 anchor appears without any further clicks.
    expect(screen.getAllByText(/25\.862923%/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("import bridge guide (P8.2)", () => {
  it("renders the three steps and the accepted-formats note in step 1", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getByRole("button", { name: "匯入牌表" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("由外部組牌工具搬牌組過來?")).toBeInTheDocument();
    expect(within(dialog).getByText(/轉換成 Live 英文/)).toBeInTheDocument();
    expect(within(dialog).getByText(/「4 卡名」、「卡名 x4」/)).toBeInTheDocument();
  });
});
