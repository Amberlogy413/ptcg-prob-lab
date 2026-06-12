/**
 * Full row tags (docs/DECISIONS.md "真實卡牌目錄"): matchRow identity rules,
 * the 補完標籤 sweep that stamps every known tag onto manual/imported rows,
 * and the per-row ⓘ card visual for catalog-mapped rows.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { setCatalogForTests, matchRow, enrichPatch } from "../src/data/catalog.ts";
import { makeCatalogFixture } from "./catalogFixture.ts";

const FIXTURE = makeCatalogFixture();

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "deck", askTab: "q1", rotationMark: null });
  setCatalogForTests(FIXTURE);
});

afterEach(() => {
  setCatalogForTests(null);
});

describe("matchRow", () => {
  it("prefers exact print identity (set+number) over the name", () => {
    // The name says 綠毛蟲 but the print identity points at the OLD set.
    const m = matchRow(FIXTURE, { name: "綠毛蟲", set: "S11", number: "001" });
    expect(m?.id).toBe("S11-001");
  });

  it("falls back to the best print of the exact name (std first)", () => {
    expect(matchRow(FIXTURE, { name: "綠毛蟲" })?.id).toBe("SV9-001");
    expect(matchRow(FIXTURE, { name: " 調換票 " })?.id).toBe("SV9-090");
    expect(matchRow(FIXTURE, { name: "自創卡" })).toBeNull();
  });

  it("enrichPatch stamps every tag the catalog knows", () => {
    const patch = enrichPatch(FIXTURE.cards[0]!);
    expect(patch).toEqual({
      isBasic: true,
      section: "pokemon",
      set: "SV9",
      number: "001",
      mark: "I",
      catalogId: "SV9-001",
    });
  });
});

describe("補完標籤 sweep", () => {
  it("fills tags on matched rows, leaves unknown names alone, reports the count", async () => {
    const deckId = useDeckStore.getState().importDeck("補完測試", [
      { name: "綠毛蟲", count: 4 }, // manual row: no tags at all
      { name: "調換票", count: 3 }, // manual trainer
      { name: "自創卡", count: 2 }, // not in catalog
    ]);
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getByRole("button", { name: "補完標籤" }));

    await waitFor(() => {
      const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
      const worm = deck.cards.find((c) => c.name === "綠毛蟲")!;
      expect(worm).toMatchObject({
        isBasic: true,
        section: "pokemon",
        set: "SV9",
        number: "001",
        mark: "I",
        catalogId: "SV9-001",
        count: 4,
      });
    });
    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const ticket = deck.cards.find((c) => c.name === "調換票")!;
    expect(ticket.section).toBe("trainer");
    expect(ticket.catalogId).toBe("SV9-090");
    const custom = deck.cards.find((c) => c.name === "自創卡")!;
    expect(custom.catalogId).toBeUndefined();
    expect(custom.section).toBe("unknown");
    expect(screen.getByText("已補完 2 行的標籤(基礎/分類/系列/編號/標記)")).toBeInTheDocument();
    // The sweep teaches the global basicTags memory too.
    expect(useDeckStore.getState().basicTags["綠毛蟲"]).toBe(true);
  });

  it("reports none when there is nothing to complete", async () => {
    useDeckStore.getState().importDeck("無嘢做", [{ name: "自創卡", count: 60 }]);
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "補完標籤" }));
    expect(
      await screen.findByText("沒有需要補完的行(已全部對應,或卡名不在目錄)"),
    ).toBeInTheDocument();
  });
});

describe("row folding (review findings)", () => {
  it("addCardFrom folds a manual same-name row instead of duplicating", () => {
    const s = useDeckStore.getState();
    const deckId = s.importDeck("摺行", [{ name: "綠毛蟲", count: 3 }]);
    s.addCardFrom(deckId, {
      name: "綠毛蟲",
      count: 1,
      isBasic: true,
      section: "pokemon",
      set: "SV9",
      number: "001",
      mark: "I",
      catalogId: "SV9-001",
    });
    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const prints = deck.cards.filter((c) => c.name === "綠毛蟲");
    expect(prints).toHaveLength(1);
    expect(prints[0]).toMatchObject({
      count: 4,
      isBasic: true,
      section: "pokemon",
      catalogId: "SV9-001",
      mark: "I",
    });
  });

  it("補完標籤 merges a manual row into the existing print row", async () => {
    const deckId = useDeckStore.getState().importDeck("合併", [
      {
        name: "綠毛蟲",
        count: 2,
        isBasic: true,
        section: "pokemon",
        set: "SV9",
        number: "001",
        catalogId: "SV9-001",
      },
      { name: "綠毛蟲", count: 4 }, // manual duplicate of the same print
    ]);
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "補完標籤" }));

    await waitFor(() => {
      const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
      const prints = deck.cards.filter((c) => c.name === "綠毛蟲");
      expect(prints).toHaveLength(1);
      expect(prints[0]?.count).toBe(6);
      expect(prints[0]?.catalogId).toBe("SV9-001");
    });
  });
});

describe("deck-row card visual", () => {
  it("ⓘ opens the full-info CardVisual for catalog-mapped rows", async () => {
    useDeckStore.getState().importDeck("視覺", [
      { name: "綠毛蟲", count: 4, isBasic: true, section: "pokemon", catalogId: "SV9-001" },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    // The catalog loads in the background before the ⓘ appears.
    await user.click(await screen.findByRole("button", { name: "顯示 綠毛蟲 卡片詳情" }));

    const dialog = screen.getByRole("dialog", { name: "綠毛蟲" });
    expect(dialog).toHaveTextContent("蟲咬");
    expect(dialog).toHaveTextContent("弱點 火×2");
    expect(dialog).toHaveTextContent("對戰搭檔");
    expect(dialog).toHaveTextContent("繪師:Shimaris Yukichi");
    expect(dialog).toHaveTextContent("圖鑑 #10");
    expect(dialog).toHaveTextContent("別看牠的腳很短。");
  });
});
