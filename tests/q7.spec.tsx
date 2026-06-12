/**
 * Phase 7 DoD (docs/06): three new golden kinds green; optimizer ≤200ms;
 * fold assumptions listed; relay spot-checked against the v2 reference.
 * Plus D1 aliases and D3 custom presets.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { useDeckStore, resolveBasicTag } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useQ3Store } from "../src/state/q3Store.ts";
import { computeRelay, computeSearchFold } from "../src/state/q7.ts";
import { runOptimizer } from "../src/state/comboBatch.ts";
import { fractionStr } from "../src/lib/prob/index.ts";
import { STORAGE_KEYS } from "../src/utils/storage.ts";

const goldenV2 = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "golden", "golden_vectors_v2.json"),
    "utf8",
  ),
) as { cases: Array<{ id: string; expect: Record<string, unknown> }> };

function v2expect(id: string): Record<string, unknown> {
  const c = goldenV2.cases.find((x) => x.id === id);
  if (!c) throw new Error(`missing v2 case ${id}`);
  return c.expect;
}

function seedKillerDeck(): void {
  useDeckStore.getState().importDeck("殺手示範", [
    { name: "火球鼠", count: 4, isBasic: true },
    { name: "超夢風暴", count: 3 },
    { name: "其他基礎", count: 6, isBasic: true },
    { name: "填充", count: 47 },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "ask", askTab: "q1" });
  useQ3Store.setState({
    mode: "uncond",
    single: { source: "custom", x: 4, h: 0, isBasic: false, otherBasics: 10 },
    joint: [],
    custom: [],
  });
});

describe("relay (A5, docs/02 §6.5)", () => {
  it("UI selector matches the v2 golden value (A4 by T1, B3 by T3, going second)", () => {
    const r = computeRelay({ cA: 4, wA: 1, turnA: 1, cB: 3, wB: 1, turnB: 3, goingFirst: false })!;
    expect(r.n1).toBe(8);
    expect(r.n2).toBe(10);
    expect(r.joint.fraction).toBe(v2expect("relay_A4w1n8_B3w1n10").p);
  });

  it("rejects reversed turns", () => {
    expect(computeRelay({ cA: 4, wA: 1, turnA: 5, cB: 3, wB: 1, turnB: 2, goingFirst: false })).toBeNull();
  });
});

describe("search-chain fold (A4, docs/02 §4.3)", () => {
  it("UI selector matches the v2 golden case (x4 basic, s4, ob6, w1)", () => {
    seedKillerDeck();
    const deck = useDeckStore.getState().decks[0]!;
    // 火球鼠 ×4 basic; ob = 10 − 4 = 6 → exactly the golden fold case.
    const data = computeSearchFold(deck, "火球鼠", 4, 1)!;
    const exp = v2expect("fold_x4b_s4_ob6_w1");
    expect(data.optimistic.fraction).toBe(exp.optimistic);
    expect(data.conservative.fraction).toBe(exp.conservative);
    expect(data.pValid.fraction).toBe(exp.p_valid);
    expect(data.gapPp).toMatch(/^\+\d+\.\d{2}pp$/);
  });

  it("fold UI lists all four model assumptions", async () => {
    seedKillerDeck();
    useUiStore.setState({ activeView: "ask", askTab: "tools" });
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByRole("combobox", { name: "目標卡" }), ["火球鼠"]);
    for (const frag of [/假設一/, /假設二/, /假設三/, /假設四/]) {
      expect(screen.getByText(frag)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/樂觀檔/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/保守檔/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("optimizer (A2, docs/02 §11)", () => {
  it("matches the v2 golden enumeration and finishes within the 200ms budget", async () => {
    const exp = v2expect("optimizer_A2b_B1n_free5_ob6") as {
      allocs: Record<string, string>;
      best: string;
    };
    const t0 = performance.now();
    const result = await runOptimizer(
      [
        { base: 2, isBasic: true, want: 1 },
        { base: 1, isBasic: false, want: 1 },
      ],
      5,
      6,
      60,
      7,
    );
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200); // DoD budget (sync fallback path)
    expect(result.cells).toHaveLength(Object.keys(exp.allocs).length);
    for (const cell of result.cells) {
      expect(fractionStr(cell.p)).toBe(exp.allocs[cell.alloc.join("_")]);
    }
    expect(result.best.alloc.join("_")).toBe(exp.best);
  });
});

describe("D1 aliases", () => {
  it("resolveBasicTag falls through the alias map and persists to ppl.v1.aliases", () => {
    const st = () => useDeckStore.getState();
    st().rememberBasicTags({ 火球鼠: true });
    st().setAlias("Cyndaquil", "火球鼠");
    expect(resolveBasicTag(st().basicTags, st().aliases, "Cyndaquil")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.aliases)).toContain("Cyndaquil");

    // importDeck applies the aliased tag.
    const id = st().importDeck("EN deck", [{ name: "Cyndaquil", count: 4 }]);
    const deck = st().decks.find((d) => d.id === id)!;
    expect(deck.cards[0]?.isBasic).toBe(true);

    st().removeAlias("Cyndaquil");
    expect(resolveBasicTag(st().basicTags, st().aliases, "Cyndaquil")).toBeUndefined();
  });
});

describe("D3 question bank + custom presets", () => {
  it("saves the current Q3 query as a chip and persists it", async () => {
    seedKillerDeck();
    useUiStore.setState({ activeView: "prizes" });
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole("textbox", { name: "快捷名稱(儲存目前 Q3 查詢)" }),
      "我的四投",
    );
    await user.click(screen.getByRole("button", { name: "儲存為快捷" }));

    expect(screen.getByRole("button", { name: "我的四投" })).toBeInTheDocument();
    expect(localStorage.getItem("ppl.v1.customPresets")).toContain("我的四投");

    // The bank expands with generated questions.
    await user.click(screen.getByRole("button", { name: "題庫 ▾" }));
    expect(screen.getByRole("button", { name: "2 投、手上 1 張 → 被獎賞?" })).toBeInTheDocument();

    // Deleting the chip removes persistence.
    await user.click(screen.getByRole("button", { name: "刪除快捷「我的四投」" }));
    expect(screen.queryByRole("button", { name: "我的四投" })).not.toBeInTheDocument();
  });
});

describe("tools section smoke", () => {
  it("optimizer UI enumerates through the batch runner", async () => {
    seedKillerDeck();
    useUiStore.setState({ activeView: "ask", askTab: "tools" });
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole("combobox", { name: "加入候選卡" }), ["火球鼠"]);
    await user.click(screen.getByRole("button", { name: "枚舉所有分配" }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText("最優")).toBeInTheDocument();
    expect(screen.getByText(/預算 200ms/)).toBeInTheDocument();
  });
});
