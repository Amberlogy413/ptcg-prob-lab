/**
 * CardPicker UI (docs/DECISIONS.md "真實卡牌目錄"): search-to-add with the
 * catalog injected as a fixture — no network. Adding fills
 * isBasic/section/set/number/mark, repeats bump the same print's count, and
 * the detail panel shows the recorded card facts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { setCatalogForTests, type Catalog } from "../src/data/catalog.ts";

const FIXTURE: Catalog = {
  v: 1,
  lang: "zh-tw",
  source: "TCGdex",
  fetchedAt: "2026-06-12",
  count: 3,
  sets: {
    SV9: { name: "對戰搭檔", serie: "朱&紫系列", date: "2025-02-07", official: 100 },
    S11: { name: "舊系列", serie: "劍&盾系列", date: "2022-07-15", official: 100 },
  },
  cards: [
    {
      id: "SV9-001",
      localId: "001",
      name: "綠毛蟲",
      category: "Pokemon",
      stage: "Basic",
      hp: 50,
      types: ["Grass"],
      attacks: [{ cost: ["Grass"], name: "蟲咬", damage: 20 }],
      weaknesses: [{ type: "Fire", value: "×2" }],
      retreat: 1,
      regulationMark: "I",
      std: true,
      rarity: "Common",
      set: "SV9",
    },
    {
      id: "S11-001",
      localId: "001",
      name: "綠毛蟲",
      category: "Pokemon",
      stage: "Basic",
      hp: 50,
      regulationMark: "F",
      set: "S11",
    },
    {
      id: "SV9-090",
      localId: "090",
      name: "調換票",
      category: "Trainer",
      trainerType: "Item",
      effect: "數過自己的獎賞卡張數後,全部翻回反面並重洗,放回牌庫下方。",
      regulationMark: "I",
      std: true,
      set: "SV9",
    },
  ],
};

function seedDeck(): string {
  return useDeckStore.getState().importDeck("目錄測試", [
    { name: "填充", count: 10, section: "trainer" },
  ]);
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

async function openPickerAndSearch(query: string) {
  const user = userEvent.setup();
  render(<App />);
  await viewReady();
  await user.type(screen.getByLabelText("卡牌目錄搜尋"), query);
  return user;
}

describe("CardPicker", () => {
  it("adds a catalog card with isBasic/section/set/number/mark pre-filled", async () => {
    const deckId = seedDeck();
    const user = await openPickerAndSearch("綠毛蟲");

    await user.click(await screen.findByRole("button", { name: "加入 綠毛蟲(SV9-001)" }));

    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const row = deck.cards.find((c) => c.name === "綠毛蟲")!;
    expect(row).toMatchObject({
      name: "綠毛蟲",
      count: 1,
      isBasic: true,
      section: "pokemon",
      set: "SV9",
      number: "001",
      mark: "I",
    });
    // The catalog add also teaches the global basicTags memory.
    expect(useDeckStore.getState().basicTags["綠毛蟲"]).toBe(true);
  });

  it("re-adding the same print bumps its count; another print gets its own row", async () => {
    const deckId = seedDeck();
    const user = await openPickerAndSearch("綠毛蟲");

    const sv9 = await screen.findByRole("button", { name: "加入 綠毛蟲(SV9-001)" });
    await user.click(sv9);
    await user.click(sv9);
    await user.click(screen.getByRole("button", { name: "加入 綠毛蟲(S11-001)" }));

    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const prints = deck.cards.filter((c) => c.name === "綠毛蟲");
    expect(prints).toHaveLength(2);
    expect(prints.find((c) => c.set === "SV9")?.count).toBe(2);
    expect(prints.find((c) => c.set === "S11")?.count).toBe(1);
  });

  it("standard-legal print lists before the rotated one", async () => {
    seedDeck();
    await openPickerAndSearch("綠毛蟲");
    const buttons = await screen.findAllByRole("button", { name: /^加入 綠毛蟲/ });
    expect(buttons[0]?.getAttribute("aria-label")).toContain("SV9-001");
    expect(buttons[1]?.getAttribute("aria-label")).toContain("S11-001");
  });

  it("trainer adds as non-Basic trainer-section row", async () => {
    const deckId = seedDeck();
    const user = await openPickerAndSearch("調換票");

    await user.click(await screen.findByRole("button", { name: "加入 調換票(SV9-090)" }));

    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId)!;
    const row = deck.cards.find((c) => c.name === "調換票")!;
    expect(row.isBasic).toBe(false);
    expect(row.section).toBe("trainer");
    expect(useDeckStore.getState().basicTags["調換票"]).toBe(false);
  });

  it("detail panel shows the recorded facts (attack, weakness, set, rule text)", async () => {
    seedDeck();
    const user = await openPickerAndSearch("調換票");

    await user.click(await screen.findByRole("button", { name: "顯示 調換票 詳情" }));
    expect(screen.getByText(/數過自己的獎賞卡張數後/)).toBeInTheDocument();
    expect(screen.getByText(/對戰搭檔/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("卡牌目錄搜尋"));
    await user.type(screen.getByLabelText("卡牌目錄搜尋"), "綠毛蟲");
    const details = await screen.findAllByRole("button", { name: "顯示 綠毛蟲 詳情" });
    await user.click(details[0]!);
    expect(screen.getByText("蟲咬")).toBeInTheDocument();
    expect(screen.getByText(/弱點 火×2/)).toBeInTheDocument();
  });

  it("shows the no-match fallback hint instead of dead ends", async () => {
    seedDeck();
    await openPickerAndSearch("不存在的卡");
    expect(await screen.findByText(/沒有符合的卡片/)).toBeInTheDocument();
  });
});
