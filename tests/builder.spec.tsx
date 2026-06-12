/**
 * 逐層組牌 (docs/DECISIONS.md "真實卡牌目錄"): layered drill-down with counted
 * chips, std-legal filtering, tap-to-add with full tags, and the live EXACT
 * mulligan readout (B=10/N=60 anchor: 25.862923%).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore, type NewCardInput } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { setCatalogForTests } from "../src/data/catalog.ts";
import { makeCatalogFixture } from "./catalogFixture.ts";

const FIXTURE = makeCatalogFixture();

function anchorDeckRows(): NewCardInput[] {
  return [
    { name: "基礎手", count: 10, isBasic: true, section: "pokemon" },
    { name: "填充", count: 50, section: "trainer" },
  ];
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "deck", askTab: "q1", rotationMark: null });
  setCatalogForTests(FIXTURE);
});

afterEach(() => {
  setCatalogForTests(null);
});

async function openBuilder() {
  const user = userEvent.setup();
  render(<App />);
  await viewReady();
  await user.click(screen.getByRole("button", { name: "視覺組牌" }));
  await screen.findByRole("dialog", { name: "逐層組牌:由大類到細項,點卡即加入" });
  return user;
}

describe("layered deck builder", () => {
  it("drills 大類 → 細分 → 屬性 with live counts, std-only by default", async () => {
    useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();

    // Layer 1 counts: std-only pool = 5 of the 6 fixture cards.
    const pokeChip = await screen.findByRole("button", { name: /^寶可夢 3$/ });
    expect(screen.getByRole("button", { name: /^訓練家 1$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^能量 1$/ })).toBeInTheDocument();

    await user.click(pokeChip);
    // Layer 2: stages present in the std pool.
    await user.click(await screen.findByRole("button", { name: /^基礎 2$/ }));
    // Layer 3: types of std Basic Pokémon.
    await user.click(await screen.findByRole("button", { name: /^草 1$/ }));

    expect(screen.getByText("1 張符合")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "加入 綠毛蟲(SV9-001)" })).toBeInTheDocument();
    // The rotated S11 print is hidden while std-only is on.
    expect(screen.queryByRole("button", { name: "加入 綠毛蟲(S11-001)" })).toBeNull();
  });

  it("std toggle reveals rotated prints (legality spoken in the label)", async () => {
    useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();
    await user.click(screen.getByRole("checkbox", { name: "只看標準賽制" }));
    await user.click(await screen.findByRole("button", { name: /^寶可夢 5$/ }));
    await user.click(await screen.findByRole("button", { name: /^基礎 3$/ }));
    await user.click(await screen.findByRole("button", { name: /^草 2$/ }));
    expect(
      screen.getByRole("button", { name: "加入 綠毛蟲(S11-001),非標準" }),
    ).toBeInTheDocument();
  });

  it("re-enabling std clears a sub filter whose chip vanished", async () => {
    useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();
    const stdToggle = screen.getByRole("checkbox", { name: "只看標準賽制" });
    await user.click(stdToggle); // off
    await user.click(await screen.findByRole("button", { name: /^寶可夢 5$/ }));
    await user.click(await screen.findByRole("button", { name: /^VMAX 1$/ }));
    expect(screen.getByText("1 張符合")).toBeInTheDocument();
    await user.click(stdToggle); // back on — VMAX has no std prints
    // The stale filter is cleared: all 3 std Pokémon show, no orphan VMAX chip.
    expect(await screen.findByText("3 張符合")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^VMAX/ })).toBeNull();
  });

  it("tap adds the card with every tag, and the name-total badge tracks it", async () => {
    const deckId = useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();

    const add = await screen.findByRole("button", { name: "加入 水水獺(SV9-050)" });
    await user.click(add);
    await user.click(add);

    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const otter = deck.cards.find((c) => c.name === "水水獺")!;
    expect(otter).toMatchObject({
      count: 2,
      isBasic: true,
      section: "pokemon",
      set: "SV9",
      number: "050",
      mark: "I",
      catalogId: "SV9-050",
    });
    expect(screen.getByTitle("牌組中同名合計 ×2")).toHaveTextContent("×2");
  });

  it("shows the live EXACT mulligan and updates as Basics land", async () => {
    useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();

    // B=10 / N=60 anchor.
    const dialog = screen.getByRole("dialog", { name: "逐層組牌:由大類到細項,點卡即加入" });
    expect(within(dialog).getByText("25.862923%")).toBeInTheDocument();

    // Adding one Basic (B=11/N=61) moves the exact number.
    await user.click(await screen.findByRole("button", { name: "加入 水水獺(SV9-050)" }));
    await waitFor(() => {
      expect(within(dialog).queryByText("25.862923%")).toBeNull();
    });
    expect(within(dialog).getByText(/^2[0-9]\.[0-9]{6}%$/)).toBeInTheDocument();
  });

  it("功能 layer filters by what the card actually does", async () => {
    useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();

    // Whole std pool: two cards carry the draw tag (水水獺 + 調換票).
    await user.click(await screen.findByRole("button", { name: /^抽卡 2$/ }));
    expect(screen.getByText("2 張符合")).toBeInTheDocument();

    // Narrowing to Pokémon recomputes the tag pool — only 水水獺 remains.
    await user.click(screen.getByRole("button", { name: /^寶可夢 3$/ }));
    expect(await screen.findByText("1 張符合")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^加入 水水獺\(SV9-050\)/ })).toBeInTheDocument();
  });

  it("ⓘ in the grid opens the full card visual", async () => {
    useDeckStore.getState().importDeck("錨點", anchorDeckRows());
    const user = await openBuilder();
    await user.click(await screen.findByRole("button", { name: /^訓練家 1$/ }));
    await user.click(await screen.findByRole("button", { name: "顯示 調換票 詳情" }));
    const dialog = screen.getByRole("dialog", { name: "調換票" });
    expect(dialog).toHaveTextContent("數過自己的獎賞卡張數後");
    expect(dialog).toHaveTextContent("物品");
  });
});
