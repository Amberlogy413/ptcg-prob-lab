/**
 * 中局計算器 (docs/09 §4 #1): the mid-game outs engine view — exact numbers
 * in three formats, the 推導明細 receipt with real substituted numbers, and
 * the ±1-out sensitivity that turns the answer into a build action. Math is
 * pinned by golden v2 (kind "midgame", cross-verified vs Python).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { computeMidgame, computeShuffleBack } from "../src/state/midgame.ts";

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "midgame", askTab: "q1", rotationMark: null });
});

describe("computeMidgame (selector)", () => {
  it("anchor u=25 x=4 w=2: 3/10 with derivation and sensitivities", () => {
    const r = computeMidgame({ u: 25, x: 4, w: 2, k: 1 });
    expect(r.percent).toBe("30.000000%");
    expect(r.fraction).toBe("3/10");
    expect(r.derivation.some((l) => l.includes("C(21,2"))).toBe(true);
    expect(r.derivation.some((l) => l.includes("= 3/10"))).toBe(true);
    // One more out: 1 − C(20,2)/C(25,2) = 1 − 190/300 = 11/30.
    expect(r.up?.percent).toBe("36.666667%");
    expect(r.up?.deltaPp).toBe("+6.67pp");
    // One fewer: 1 − C(22,2)/C(25,2) = 1 − 231/300 = 23/100.
    expect(r.down?.percent).toBe("23.000000%");
    expect(r.down?.deltaPp).toBe("-7.00pp");
  });

  it("edges: x=0 → 0%, draw the whole deck → 100%", () => {
    expect(computeMidgame({ u: 20, x: 0, w: 5, k: 1 }).fraction).toBe("0/1");
    expect(computeMidgame({ u: 7, x: 3, w: 7, k: 3 }).fraction).toBe("1/1");
  });
});

describe("computeShuffleBack (奇樹/裁判 composite)", () => {
  it("matches the golden Iono anchor and lists every mixture term", () => {
    // Golden case shuffle_D16_p4_h5_d4: 907456/1705725.
    const r = computeShuffleBack({ D: 16, p: 4, xU: 3, xH: 1, h: 5, draw: 4, k: 1 });
    expect(r.fraction).toBe("907456/1705725");
    expect(r.percent).toBe("53.200604%");
    // One mixture line per possible deck count j = 0..3, plus header + total.
    expect(r.derivation.filter((l) => l.includes("j="))).toHaveLength(4);
    expect(r.derivation.some((l) => l.includes("907456/1705725"))).toBe(true);
    // Sensitivity rows exist on both sides.
    expect(r.up?.x).toBe(4);
    expect(r.down?.x).toBe(2);
  });
});

describe("中局 view", () => {
  it("computes from inputs and shows derivation + meaning", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    fireEvent.change(screen.getByLabelText("未見張數 u(牌庫+未翻獎賞)"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("接下來抽幾張 w"), { target: { value: "2" } });

    expect(await screen.findByText("30.000000%")).toBeInTheDocument();
    expect(screen.getByText(/3\/10 · 1 in 3\.333/)).toBeInTheDocument();

    await user.click(screen.getAllByText("展開推導明細 ▾")[0]!);
    expect(screen.getByText(/C\(25,2\) = 300/)).toBeInTheDocument();
    expect(screen.getByText(/P = 1 − 210\/300 = 3\/10/)).toBeInTheDocument();

    // 實際意義: judgement + build sensitivity in plain language.
    expect(screen.getByText(/大約 1 in 3\.333 次處境成功 1 次/)).toBeInTheDocument();
    expect(screen.getByText(/x=5.*36\.666667%.*\+6\.67pp/)).toBeInTheDocument();
    expect(screen.getByText(/練習與覆盤限定/)).toBeInTheDocument();
  });

  it("shuffle-back panel computes the Iono anchor with defaults", async () => {
    render(<App />);
    await viewReady();
    // Defaults are exactly the golden Iono case.
    expect(await screen.findByText("53.200604%")).toBeInTheDocument();
    expect(screen.getAllByText(/907456\/1705725/).length).toBeGreaterThanOrEqual(1);
    // Tightening the threshold to k=2 changes the exact number.
    fireEvent.change(screen.getByLabelText("至少要中 k"), { target: { value: "2" } });
    expect(await screen.findByText(/洗回後這 4 抽/)).toBeInTheDocument();
    expect(screen.queryByText("53.200604%")).toBeNull();
  });

  it("rejects impossible parameter combinations gracefully", async () => {
    render(<App />);
    await viewReady();
    // Default x=4; shrinking the pool below the outs count must guard.
    fireEvent.change(screen.getByLabelText("未見張數 u(牌庫+未翻獎賞)"), {
      target: { value: "3" },
    });
    expect(await screen.findByText(/參數不合法/)).toBeInTheDocument();
  });
});
