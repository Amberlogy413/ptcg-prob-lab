/**
 * Phase 3 DoD (docs/06): the killer demo — A(4, Basic)+B(3), other Basics 6:
 * toggle on 15.383618%, off 11.404965%, comparison line −3.98pp; five-line
 * receipt per docs/04 §5; builder→params snapshots per docs/05 §E.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { comboOpening } from "../src/lib/prob/index.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useQueryStore, constraintBounds, type TrackedQueryCard } from "../src/state/queryStore.ts";
import {
  buildComboParams,
  computeQ2Display,
  comboSignature,
  GOLDEN_COMBO_REFS,
} from "../src/state/selectors.ts";

function seedKillerDeck(): void {
  useDeckStore.getState().importDeck("殺手示範", [
    { name: "火球鼠", count: 4, isBasic: true },
    { name: "超夢風暴", count: 3 },
    { name: "其他基礎", count: 6, isBasic: true },
    { name: "填充", count: 47 },
  ]);
}

function killerDeck() {
  return useDeckStore.getState().decks[0]!;
}

function trackedFor(names: string[]): TrackedQueryCard[] {
  const deck = killerDeck();
  return names.map((name) => ({
    cardId: deck.cards.find((c) => c.name === name)!.id,
    kind: "atLeast" as const,
    n: 1,
    a: 1,
    b: 2,
  }));
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useQueryStore.setState({ tracked: [], mulliganAware: true });
  useUiStore.setState({ activeView: "ask" });
});

describe("constraintBounds (builder→params mapping, docs/05 §E)", () => {
  const base = { cardId: "x", n: 1, a: 1, b: 2 };
  it("maps every constraint kind to [min, max] per docs/02 §4.1", () => {
    expect(constraintBounds({ ...base, kind: "atLeast", n: 1 }, 4)).toEqual([1, 7]);
    expect(constraintBounds({ ...base, kind: "exactly", n: 2 }, 4)).toEqual([2, 2]);
    expect(constraintBounds({ ...base, kind: "atMost", n: 1 }, 4)).toEqual([0, 1]);
    expect(constraintBounds({ ...base, kind: "between", a: 1, b: 2 }, 4)).toEqual([1, 2]);
    expect(constraintBounds({ ...base, kind: "avoid" }, 4)).toEqual([0, 0]);
  });
  it("clamps to [0, min(count, 7)] and normalizes reversed ranges", () => {
    expect(constraintBounds({ ...base, kind: "atLeast", n: 9 }, 4)).toEqual([4, 7]);
    expect(constraintBounds({ ...base, kind: "exactly", n: 5 }, 3)).toEqual([3, 3]);
    expect(constraintBounds({ ...base, kind: "between", a: 3, b: 1 }, 4)).toEqual([1, 3]);
    expect(constraintBounds({ ...base, kind: "atMost", n: -2 }, 4)).toEqual([0, 0]);
  });
});

describe("buildComboParams", () => {
  it("killer demo, mulligan-aware: counts/flags/otherBasics/cells", () => {
    seedKillerDeck();
    const r = buildComboParams(killerDeck(), trackedFor(["火球鼠", "超夢風暴"]), true);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.cards.map((c) => c.count)).toEqual([4, 3]);
    expect(r.cards.map((c) => [c.min, c.max])).toEqual([
      [1, 7],
      [1, 7],
    ]);
    expect(r.cards.map((c) => c.isBasic)).toEqual([true, false]);
    expect(r.opts.mulliganAware?.otherBasics).toBe(6);
    expect(r.opts.N).toBe(60);
    expect(r.estimatedCells).toBe(5 * 4 * 7); // incl. other-Basics category
  });
  it("toggle off: no conditioning, smaller estimate", () => {
    seedKillerDeck();
    const r = buildComboParams(killerDeck(), trackedFor(["火球鼠", "超夢風暴"]), false);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.opts.mulliganAware).toBeUndefined();
    expect(r.estimatedCells).toBe(5 * 4);
  });
  it("guards: empty / tooFewCards / noBasicsForAware", () => {
    seedKillerDeck();
    expect(buildComboParams(killerDeck(), [], true).status).toBe("empty");
    useDeckStore.getState().importDeck("小", [{ name: "A", count: 3, isBasic: true }]);
    const tiny = useDeckStore.getState().decks[1]!;
    expect(
      buildComboParams(tiny, [{ cardId: tiny.cards[0]!.id, kind: "atLeast", n: 1, a: 1, b: 2 }], true)
        .status,
    ).toBe("tooFewCards");
    useDeckStore.getState().importDeck("無基礎", [{ name: "B", count: 60 }]);
    const nb = useDeckStore.getState().decks[2]!;
    expect(
      buildComboParams(nb, [{ cardId: nb.cards[0]!.id, kind: "atLeast", n: 1, a: 1, b: 2 }], true)
        .status,
    ).toBe("noBasicsForAware");
  });
});

describe("computeQ2Display (killer anchors, docs/02 §4.2)", () => {
  it("mulligan-aware: 15.383618%, naive line −3.98pp, five-line receipt", () => {
    seedKillerDeck();
    const build = buildComboParams(killerDeck(), trackedFor(["火球鼠", "超夢風暴"]), true);
    if (build.status !== "ok") throw new Error("build failed");
    const data = computeQ2Display(comboOpening(build.cards, build.opts), build);

    expect(data.headline.percent).toBe("15.383618%");
    expect(data.headline.fraction).toBe("11011691/71580630");
    expect(data.headline.oneIn).toBe("1 in 6.50");
    expect(data.naive?.percent).toBe("11.404965%");
    expect(data.naive?.deltaPp).toBe("−3.98pp");
    expect(data.pValid?.fraction).toBe("216911/292581");
    expect(data.pValid?.percent).toBe("74.137077%");

    expect(data.receipt.formula).toBe(
      "P = Σ C(4,a)·C(3,b)·C(53,7−a−b) / C(60,7) (a≥1, b≥1)",
    );
    expect(data.receipt.substitution).toBe("C(60,7) = 386,206,920");
    expect(data.receipt.total).toEqual({ num: "44,046,764", frac: "11011691/96551730" });
    expect(data.receipt.cond).toEqual({
      pValid: "216911/292581",
      result: "11011691/71580630",
    });
    expect(data.receipt.identityOk).toBe(true);
    expect(data.receipt.goldenId).toBe("combo_valid_A4basic_B3_ob6_atleast1_each");
    expect(data.legend).toContain("a = 火球鼠 ×4");
  });

  it("toggle off: 11.404965%, no naive line, no golden ref for this combo", () => {
    seedKillerDeck();
    const build = buildComboParams(killerDeck(), trackedFor(["火球鼠", "超夢風暴"]), false);
    if (build.status !== "ok") throw new Error("build failed");
    const data = computeQ2Display(comboOpening(build.cards, build.opts), build);
    expect(data.headline.percent).toBe("11.404965%");
    expect(data.headline.fraction).toBe("11011691/96551730");
    expect(data.naive).toBeUndefined();
    expect(data.receipt.cond).toBeUndefined();
    expect(data.receipt.goldenId).toBeUndefined();
  });

  it("A4+B4 each ≥1 (uncond) hits its golden anchor and ref", () => {
    useDeckStore.getState().importDeck("AB", [
      { name: "A", count: 4, isBasic: true },
      { name: "B", count: 4 },
      { name: "填", count: 52 },
    ]);
    const deck = useDeckStore.getState().decks[0]!;
    const tracked = ["A", "B"].map((name) => ({
      cardId: deck.cards.find((c) => c.name === name)!.id,
      kind: "atLeast" as const,
      n: 1,
      a: 1,
      b: 2,
    }));
    const build = buildComboParams(deck, tracked, false);
    if (build.status !== "ok") throw new Error("build failed");
    const data = computeQ2Display(comboOpening(build.cards, build.opts), build);
    expect(data.headline.percent).toBe("14.540568%");
    expect(data.receipt.goldenId).toBe("combo_A4_B4_atleast1_each");
  });
});

describe("GOLDEN_COMBO_REFS stays in lockstep with the golden JSON", () => {
  it("every combo case id+signature matches", () => {
    const goldenPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "golden",
      "golden_vectors.json",
    );
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
      cases: Array<{ id: string; kind: string; params: Record<string, unknown> }>;
    };
    const comboCases = golden.cases.filter((c) => c.kind.startsWith("combo"));
    const actual = comboCases
      .map((c) => {
        const p = c.params as {
          N: number;
          H: number;
          counts: number[];
          constraints: Array<[number, number]>;
          basic_flags?: boolean[];
          other_basics?: number;
        };
        return {
          id: c.id,
          sig: comboSignature(p.N, p.H, p.counts, p.constraints, p.basic_flags, p.other_basics),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const expected = [...GOLDEN_COMBO_REFS].sort((a, b) => a.id.localeCompare(b.id));
    expect(actual).toEqual(expected);
  });
});

describe("Q2 section UI", () => {
  it("builds the killer query in the sentence builder and toggles the correction", async () => {
    seedKillerDeck();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Q2 組合查詢" }));
    const addSelect = screen.getByRole("combobox", { name: "加入追蹤卡" });
    await user.selectOptions(addSelect, screen.getByRole("option", { name: "火球鼠 ×4" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "加入追蹤卡" }),
      screen.getByRole("option", { name: "超夢風暴 ×3" }),
    );

    // Mulligan-aware by default → conditioned headline + grey naive line.
    expect(screen.getByText("15.383618%")).toBeInTheDocument();
    expect(screen.getByText("11011691/71580630 · 1 in 6.50")).toBeInTheDocument();
    expect(screen.getByText("未含重抽:11.404965%(−3.98pp)")).toBeInTheDocument();
    expect(screen.getByText(/p_valid = 216911\/292581/)).toBeInTheDocument();

    // Receipt: five lines, 條件化 row included (docs/04 §5).
    await user.click(screen.getByRole("button", { name: "展開數學收據 ▾" }));
    expect(
      screen.getByText("P = Σ C(4,a)·C(3,b)·C(53,7−a−b) / C(60,7) (a≥1, b≥1)"),
    ).toBeInTheDocument();
    expect(screen.getByText("C(60,7) = 386,206,920")).toBeInTheDocument();
    expect(screen.getByText("分子 44,046,764 → 既約 11011691/96551730")).toBeInTheDocument();
    expect(screen.getByText("÷ p_valid 216911/292581 = 11011691/71580630")).toBeInTheDocument();
    expect(screen.getByText(/combo_valid_A4basic_B3_ob6_atleast1_each/)).toBeInTheDocument();

    // Toggle off → naive headline, comparison line disappears.
    await user.click(screen.getByRole("switch", { name: /已含重抽修正/ }));
    expect(screen.getByText("11.404965%")).toBeInTheDocument();
    expect(screen.queryByText(/未含重抽:/)).not.toBeInTheDocument();
  });

  it("table marks satisfying rows and sorts lexicographically", async () => {
    seedKillerDeck();
    useQueryStore.setState({
      tracked: trackedFor(["火球鼠", "超夢風暴"]),
      mulliganAware: true,
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Q2 組合查詢" }));

    expect(screen.getByText("a = 火球鼠 ×4, b = 超夢風暴 ×3")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "聯合分布表" });
    expect(within(table).getByText("(1, 1)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "按字典序" }));
    const combos = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
    expect(combos[0]).toBe("(0, 0)");
    expect(combos[1]).toBe("(0, 1)");
  });

  it("completes the same query through the <768px wizard", async () => {
    seedKillerDeck();
    const mql = {
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => mql,
    });
    try {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole("tab", { name: "Q2 組合查詢" }));

      expect(screen.getByText(/步驟 1 \/ 4/)).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: /火球鼠/ }));
      await user.click(screen.getByRole("checkbox", { name: /超夢風暴/ }));
      await user.click(screen.getByRole("button", { name: "下一步" }));
      expect(screen.getByText(/步驟 2 \/ 4/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "下一步" }));
      expect(screen.getByRole("switch", { name: /已含重抽修正/ })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "下一步" }));
      expect(screen.getByText(/步驟 4 \/ 4/)).toBeInTheDocument();
      expect(screen.getByText("15.383618%")).toBeInTheDocument();
      expect(screen.getByText("未含重抽:11.404965%(−3.98pp)")).toBeInTheDocument();
    } finally {
      // @ts-expect-error cleanup of the test-only stub
      delete window.matchMedia;
    }
  });
});
