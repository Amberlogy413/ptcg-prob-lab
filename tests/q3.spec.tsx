/**
 * Phase 4 DoD (docs/06): three-mode anchors — uncond x=4 → 35.145960%,
 * known-hand x=4 h=1 → 30.782037%, pre-game Basic ob6 → E = 0.381570 with
 * the direction intuition stated in the UI; the "1-of prized = exactly 10%"
 * preset reproduces one-click; joint anchor 8.335640%.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useQ3Store } from "../src/state/q3Store.ts";
import { computeQ3Single, computeQ3Joint, GOLDEN_PRIZE_REFS } from "../src/state/q3.ts";
import { buildCsv } from "../src/utils/csv.ts";

const BASE_QUERY = { x: 4, h: 0, isBasic: false, otherBasics: 10 };

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useUiStore.setState({ activeView: "prizes", askTab: "q1" });
  useQ3Store.setState({
    mode: "uncond",
    single: { source: "custom", x: 4, h: 0, isBasic: false, otherBasics: 10 },
    joint: [],
  });
});

describe("computeQ3Single (anchors from docs/02 §5)", () => {
  it("mode (a) uncond: x=4 → 35.145960%, E = 2/5; x=1 → exactly 10%", async () => {
    const r4 = computeQ3Single("uncond", BASE_QUERY);
    expect(r4.headline.percent).toBe("35.145960%");
    expect(r4.headline.fraction).toBe("57128/162545");
    expect(r4.headline.oneIn).toBe("1 in 2.845");
    expect(r4.expected.fraction).toBe("2/5");
    expect(r4.expected.decimal).toBe("0.400000");
    expect(r4.receipt.identityOk).toBe(true);
    expect(r4.receipt.goldenId).toBe("prize_uncond_x4");

    const r1 = computeQ3Single("uncond", { ...BASE_QUERY, x: 1 });
    expect(r1.headline.percent).toBe("10.000000%");
    expect(r1.headline.fraction).toBe("1/10");
    expect(r1.expected.fraction).toBe("1/10");
    expect(r1.receipt.goldenId).toBe("prize_uncond_x1");
  });

  it("mode (b) known hand: x=4 h=1 → 30.782037%; h=0 → 39.088193%", async () => {
    const h1 = computeQ3Single("givenHand", { ...BASE_QUERY, h: 1 });
    expect(h1.headline.percent).toBe("30.782037%");
    expect(h1.headline.fraction).toBe("7211/23426");
    expect(h1.receipt.goldenId).toBe("prize_given_hand_x4_h1");

    const h0 = computeQ3Single("givenHand", { ...BASE_QUERY, h: 0 });
    expect(h0.headline.percent).toBe("39.088193%");
    expect(h0.headline.fraction).toBe("22892/58565");
    expect(h0.receipt.goldenId).toBe("prize_given_hand_x4_h0");
  });

  it("mode (c) pre-game mulligan-aware: directions flip with Basic-ness", async () => {
    const basic = computeQ3Single("preGame", { x: 4, h: 0, isBasic: true, otherBasics: 6 });
    expect(basic.expected.fraction).toBe("21933186/57481415");
    expect(basic.expected.decimal).toBe("0.381570");
    expect(basic.headline.percent).toBe("33.770701%");
    expect(basic.baseline?.decimal).toBe("0.400000");
    expect(basic.baseline?.direction).toBe("below");
    expect(basic.pValid?.fraction).toBe("216911/292581");
    expect(basic.receipt.goldenId).toBe("prize_pregame_valid_x4basic_ob6");
    expect(basic.receipt.condPValid).toBe("216911/292581");

    const nonBasic = computeQ3Single("preGame", { x: 4, h: 0, isBasic: false, otherBasics: 10 });
    expect(nonBasic.expected.decimal).toBe("0.403686");
    expect(nonBasic.baseline?.direction).toBe("above");
    expect(nonBasic.receipt.goldenId).toBe("prize_pregame_valid_x4nonbasic_ob10");
  });
});

describe("computeQ3Joint (anchor from docs/02 §5.4)", () => {
  it("A4 h1 + B3 h0, each ≥1 prized → 8.335640%", async () => {
    const data = computeQ3Joint([
      { id: "a", label: "A", count: 4, inHand: 1, min: 1, max: 6 },
      { id: "b", label: "B", count: 3, inHand: 0, min: 1, max: 6 },
    ]);
    expect(data.headline.percent).toBe("8.335640%");
    expect(data.headline.fraction).toBe("273379/3279640");
    const cell00 = data.rows.find((r) => r.key === "0_0");
    expect(cell00?.fraction).toBe("1533939/3279640");
    expect(data.receipt.identityOk).toBe(true);
    expect(data.receipt.goldenId).toBe("prize_joint_given_hand_A4h1_B3h0_atleast1_each");
    expect(data.receipt.formula).toBe("P = Σ C(3,a)·C(3,b)·C(47,6−a−b) / C(53,6) (a≥1, b≥1)");
  });
});

describe("GOLDEN_PRIZE_REFS stays in lockstep with the golden JSON", () => {
  it("every prize case id+signature matches", async () => {
    const goldenPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "golden",
      "golden_vectors.json",
    );
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
      cases: Array<{ id: string; kind: string; params: Record<string, unknown> }>;
    };
    const actual = golden.cases
      .filter((c) => c.kind.startsWith("prize"))
      .map((c) => {
        const p = c.params as {
          N: number;
          H?: number;
          P: number;
          x?: number;
          in_hand?: number;
          x_is_basic?: boolean;
          other_basics?: number;
          cards?: Array<[number, number]>;
          constraints?: Array<[number, number]>;
        };
        let sig: string;
        if (c.kind === "prize_uncond") sig = `u|${p.N}|${p.P}|${p.x}`;
        else if (c.kind === "prize_given_hand") sig = `g|${p.N}|${p.H}|${p.P}|${p.x}|${p.in_hand}`;
        else if (c.kind === "prize_pregame_valid")
          sig = `p|${p.N}|${p.H}|${p.P}|${p.x}|${p.x_is_basic ? "t" : "f"}|${p.other_basics}`;
        else
          sig = `j|${p.N}|${p.H}|${p.P}|${p.cards!.map(([c2, h]) => `${c2}-${h}`).join(",")}|${p
            .constraints!.map(([lo, hi]) => `${lo}-${hi}`)
            .join(",")}`;
        return { id: c.id, sig };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const expected = [...GOLDEN_PRIZE_REFS].sort((a, b) => a.id.localeCompare(b.id));
    expect(actual).toEqual(expected);
  });
});

describe("buildCsv", () => {
  it("joins with CRLF and escapes quotes/commas", async () => {
    const csv = buildCsv(
      ["k", "value"],
      [
        ["0", "1,234"],
        ["1", 'say "hi"'],
      ],
    );
    expect(csv).toBe('k,value\r\n0,"1,234"\r\n1,"say ""hi"""');
  });
});

describe("Prizes view UI + 預設十問", () => {
  it('one-click preset: "1 投卡被獎賞 = 10% 整" (DoD)', async () => {
    // The strip sits above the Ask and Prizes builders (docs/04 §4); a click
    // from Ask must jump to Prizes with the result filled in.
    useUiStore.setState({ activeView: "ask" });
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getByRole("button", { name: "唯一 ACE SPEC 被獎賞?(10% 整)" }));
    expect(useUiStore.getState().activeView).toBe("prizes");
    await viewReady();
    // Headline + the k=1 row of the distribution table both read exactly 10%.
    expect(screen.getAllByText("10.000000%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1/10 · 1 in 10.000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展開數學收據 ▾" }));
    expect(screen.getByText(/prize_uncond_x1/)).toBeInTheDocument();
  });

  it("mode (c) UI states the direction intuition and pValid", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "4 投基礎(ob6)· 含重抽 E?" }));

    expect(screen.getByText("33.770701%")).toBeInTheDocument();
    expect(
      screen.getByText("期望被獎賞張數 E = 21933186/57481415 = 0.381570"),
    ).toBeInTheDocument();
    expect(screen.getByText("未條件化基準 x/10 = 0.400000")).toBeInTheDocument();
    expect(screen.getByText(/E 低於基準/)).toBeInTheDocument();
    expect(screen.getByText(/p_valid = 216911\/292581/)).toBeInTheDocument();
  });

  it("mode (b) preset fills the known-hand anchor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "4 投、手上 1 張 → 被獎賞?" }));
    expect(screen.getByText("30.782037%")).toBeInTheDocument();
    expect(screen.getByText("7211/23426 · 1 in 3.249")).toBeInTheDocument();
  });

  it("joint preset reproduces 8.335640% with the satisfied table", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "A4 手1 + B3 手0,各至少 1 被獎賞?" }));
    expect(screen.getByText("8.335640%")).toBeInTheDocument();
    expect(screen.getByText("a = A ×4 (h=1), b = B ×3 (h=0)")).toBeInTheDocument();
    expect(screen.getByText("(1, 1)")).toBeInTheDocument();
  });

  it("mulligan-rate preset jumps to Q1 in the Ask workspace", async () => {
    useDeckStore.getState().importDeck("Anchor", [
      { name: "Some Basic", count: 10, isBasic: true },
      { name: "Other Cards", count: 50 },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    await user.click(screen.getByRole("button", { name: "你牌組的重抽概率?" }));
    expect(useUiStore.getState().activeView).toBe("ask");
    expect(useUiStore.getState().askTab).toBe("q1");
    await viewReady();
    expect(screen.getAllByText("25.862923%").length).toBeGreaterThanOrEqual(1);
  });
});
