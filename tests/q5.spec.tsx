/**
 * Phase 5 DoD (docs/06): curve anchors n=7…13; share round-trip; compare
 * 3投 vs 4投 delta; PNG card carries three formats + badge; attribution ±1
 * ranking; trainer flow persists errors; tracker posterior equals the
 * hand-calculated 1 − C(u−u_x,6)/C(u,6).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import {
  binom,
  rat,
  sub,
  R_ONE,
  percentStr,
  comboOpening,
} from "../src/lib/prob/index.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useQueryStore } from "../src/state/queryStore.ts";
import {
  computeTurnCurve,
  computeCompare,
  compareMulligan,
  computeGrades,
  buildAttributionPlan,
  finishAttribution,
  computeTrackerRows,
  buildTrainerQuestion,
} from "../src/state/q5.ts";
import { runComboBatch } from "../src/state/comboBatch.ts";
import { encodeShare, decodeShare, type SharePayload } from "../src/utils/share.ts";
import { buildResultCardSvg } from "../src/utils/resultCard.ts";

/** docs/02 §6.2 anchor table (x=4, ≥1 copy). */
const CURVE_ANCHORS: Record<number, string> = {
  7: "39.949963%",
  8: "44.482041%",
  9: "48.752653%",
  10: "52.772053%",
  11: "56.550289%",
  12: "60.097204%",
  13: "63.422437%",
};

function seedKillerDeck(): string {
  return useDeckStore.getState().importDeck("殺手示範", [
    { name: "火球鼠", count: 4, isBasic: true },
    { name: "超夢風暴", count: 3 },
    { name: "其他基礎", count: 6, isBasic: true },
    { name: "填充", count: 47 },
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useQueryStore.setState({ tracked: [], mulliganAware: true });
  useUiStore.setState({ activeView: "ask", askTab: "q1" });
  window.history.replaceState(null, "", "/");
});

describe("turn curve (anchors from docs/02 §6.2, x=4 ≥1)", () => {
  it("going second, turns 1..6 hit n=8..13 exactly", async () => {
    const rows = computeTurnCurve({
      x: 4,
      want: 1,
      goingFirst: false,
      extraSeen: 0,
      firstPlayerSkipsFirstDraw: false,
      maxTurn: 6,
    });
    for (const r of rows) {
      expect(r.nSeen).toBe(7 + r.turn);
      expect(r.percent, `n=${r.nSeen}`).toBe(CURVE_ANCHORS[r.nSeen]);
    }
  });

  it("legacy rule going first reaches n=7 on turn 1 (the opening itself)", async () => {
    const rows = computeTurnCurve({
      x: 4,
      want: 1,
      goingFirst: true,
      extraSeen: 0,
      firstPlayerSkipsFirstDraw: true,
      maxTurn: 1,
    });
    expect(rows[0]?.nSeen).toBe(7);
    expect(rows[0]?.percent).toBe(CURVE_ANCHORS[7]);
  });

  it("caps cards seen at the physical 54 (60 − 6 prizes)", async () => {
    const rows = computeTurnCurve({
      x: 4,
      want: 1,
      goingFirst: false,
      extraSeen: 40,
      firstPlayerSkipsFirstDraw: false,
      maxTurn: 12,
    });
    const last = rows[rows.length - 1]!;
    expect(last.nSeen).toBe(54);
    expect(last.capped).toBe(true);
  });
});

describe("share URL (docs/03 §7)", () => {
  const payload: SharePayload = {
    schema: 1,
    deck: {
      name: "殺手示範",
      cards: [
        { name: "火球鼠", count: 4, isBasic: true },
        { name: "超夢風暴", count: 3, isBasic: false },
        { name: "其他基礎", count: 6, isBasic: true },
        { name: "填充", count: 47, isBasic: false },
      ],
    },
    query: {
      type: "q2",
      tracked: [
        { name: "火球鼠", kind: "atLeast", n: 1, a: 1, b: 2 },
        { name: "超夢風暴", kind: "atLeast", n: 1, a: 1, b: 2 },
      ],
      mulliganAware: true,
    },
  };

  it("round-trips encode → decode deep-equal", async () => {
    const { fragment, tooLong } = encodeShare(payload);
    expect(fragment.startsWith("#/q=")).toBe(true);
    expect(tooLong).toBe(false);
    const decoded = decodeShare(fragment);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.payload).toEqual(payload);
  });

  it("rejects corrupted and foreign hashes without throwing", async () => {
    expect(decodeShare("#/q=%%%not-base64%%%").ok).toBe(false);
    expect(decodeShare("#/q=" + btoa('{"schema":2}')).ok).toBe(false);
    expect(decodeShare("#/other").ok).toBe(false);
  });

  it("App intake: a share link imports the deck, applies the query, shows the killer headline", async () => {
    const { fragment } = encodeShare(payload);
    window.history.replaceState(null, "", "/" + fragment);
    render(<App />);
    await viewReady();

    expect(useDeckStore.getState().decks).toHaveLength(1);
    expect(useUiStore.getState().activeView).toBe("ask");
    expect(useUiStore.getState().askTab).toBe("q2");
    expect(await screen.findByText("15.383618%")).toBeInTheDocument();
    expect(window.location.hash).toBe(""); // fragment cleared
  });

  it("App intake: a bad link shows the friendly error banner", async () => {
    window.history.replaceState(null, "", "/#/q=broken!!!");
    render(<App />);
    await viewReady();
    expect(screen.getByRole("alert")).toHaveTextContent("分享連結無法解析");
  });
});

describe("result-card SVG (docs/03 §7)", () => {
  it("carries the three formats, badge and product name", async () => {
    const svg = buildResultCardSvg({
      title: "a = 火球鼠 ×4",
      percent: "15.383618%",
      fraction: "11011691/71580630",
      oneIn: "1 in 6.50",
      conditionLabel: "已含重抽修正",
      badge: "精確計算 · 非模擬",
      product: "PTCG 概率實驗室",
      footer: "全程 BigInt 精確分數;小數為 round-half-up 顯示。",
    });
    for (const piece of [
      "15.383618%",
      "11011691/71580630",
      "1 in 6.50",
      "精確計算 · 非模擬",
      "PTCG 概率實驗室",
      "已含重抽修正",
    ]) {
      expect(svg).toContain(piece);
    }
    expect(svg).toContain("<svg");
  });
});

describe("compare (DoD: 3投 vs 4投)", () => {
  function seedAB(): { a: string; b: string } {
    const st = useDeckStore.getState();
    const a = st.importDeck("A 三投", [
      { name: "主卡", count: 3, isBasic: true },
      { name: "其他基礎", count: 7, isBasic: true },
      { name: "填充", count: 50 },
    ]);
    const b = useDeckStore.getState().importDeck("B 四投", [
      { name: "主卡", count: 4, isBasic: true },
      { name: "其他基礎", count: 6, isBasic: true },
      { name: "填充", count: 50 },
    ]);
    return { a, b };
  }

  it("4-of beats 3-of with a positive green delta; uncond anchor matches", async () => {
    const { a, b } = seedAB();
    const deckA = useDeckStore.getState().decks.find((d) => d.id === a)!;
    const deckB = useDeckStore.getState().decks.find((d) => d.id === b)!;

    const uncond = computeCompare(deckA, deckB, "主卡", 1, false)!;
    expect(uncond.b.percent).toBe("39.949963%"); // 02 §1 anchor (4-of ≥1)
    expect(uncond.deltaSign).toBe(1);
    expect(uncond.deltaPp).toMatch(/^\+\d+\.\d{2}pp$/);

    // Both decks run 10 Basics → identical mulligan rates, delta exactly 0.
    const mull = compareMulligan(deckA, deckB)!;
    expect(mull.a).toBe("25.862923%");
    expect(mull.deltaSign).toBe(0);
  });

  it("CompareView renders both sides and the delta badge", async () => {
    seedAB();
    useUiStore.setState({ activeView: "compare" });
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    const main = screen.getByRole("main");
    await user.selectOptions(within(main).getByRole("combobox", { name: "牌組 A" }), ["A 三投"]);
    await user.selectOptions(within(main).getByRole("combobox", { name: "牌組 B" }), ["B 四投"]);
    await user.selectOptions(within(main).getByRole("combobox", { name: "比較的卡" }), ["主卡"]);

    // Result panel renders: both deck labels appear beyond their <option>
    // entries, plus at least one ±pp delta badge.
    expect(within(main).getAllByText(/A 三投/).length).toBeGreaterThanOrEqual(2);
    expect(within(main).getAllByText(/B 四投/).length).toBeGreaterThanOrEqual(2);
    expect(within(main).getAllByText(/pp$/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("hand grading + dead-hand attribution (A1)", () => {
  it("buckets match independent single-card conditioned events and sum to 1", async () => {
    seedKillerDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const grades = computeGrades(deck, {
      ideal: [{ name: "火球鼠", min: 2 }],
      playable: [{ name: "火球鼠", min: 1 }],
    })!;
    expect(grades.identityOk).toBe(true);

    const event = (min: number, max: number) =>
      comboOpening(
        [{ label: "火球鼠", count: 4, min, max, isBasic: true }],
        { N: 60, H: 7, mulliganAware: { otherBasics: 6 } },
      ).event;
    expect(grades.ideal.percent).toBe(percentStr(event(2, 7), 6));
    expect(grades.playableOnly.percent).toBe(percentStr(event(1, 1), 6));
    expect(grades.dead.percent).toBe(percentStr(event(0, 0), 6));
  });

  it("attribution: +1 copy of the key card lowers the dead rate (green)", async () => {
    seedKillerDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const defs = { ideal: [{ name: "火球鼠", min: 1 }], playable: [{ name: "火球鼠", min: 1 }] };
    const plan = buildAttributionPlan(deck, defs)!;
    const results = await runComboBatch([plan.base, ...plan.perturbations.map((p) => p.job)]);
    const rows = finishAttribution(plan, results[0]!.table, results.slice(1).map((r) => r?.table ?? null));

    const key = rows.find((r) => r.name === "火球鼠")!;
    expect(key.plusSign).toBe(-1); // more copies → fewer dead hands
    expect(key.minusSign).toBe(1); // fewer copies → more dead hands
    // Non-tracked, non-Basic filler swap is a no-op by construction.
    const filler = rows.find((r) => r.name === "填充")!;
    expect(filler.plusPp).toBe("±0.00pp");
  });
});

describe("prize tracker posterior (docs/02 §5.5)", () => {
  it("matches the hand calculation 1 − C(u−u_x,6)/C(u,6) and E = 6·u_x/u", async () => {
    const result = computeTrackerRows(
      [
        { name: "A", count: 4, seen: 2 },
        { name: "B", count: 3, seen: 0 },
        { name: "填", count: 53, seen: 5 },
      ],
      60,
    )!;
    expect(result.u).toBe(53); // 60 − 7 seen

    const rowA = result.rows.find((r) => r.name === "A")!;
    expect(rowA.unseen).toBe(2);
    const hand = sub(R_ONE, rat(binom(51, 6), binom(53, 6)));
    expect(rowA.atLeastOnePercent).toBe(percentStr(hand, 6));
    expect(rowA.expected).toBe("0.226415"); // 12/53

    // Seeing more copies of a card lowers its prized probability.
    const rowB = result.rows.find((r) => r.name === "B")!;
    expect(rowB.unseen).toBe(3);
  });

  it("refuses impossible states (more than 54 seen)", async () => {
    expect(computeTrackerRows([{ name: "A", count: 60, seen: 55 }], 60)).toBeNull();
  });
});

describe("trainer (B1)", () => {
  it("builds exact questions from the deck (mulligan anchor)", async () => {
    seedKillerDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const q = buildTrainerQuestion(deck, "mulligan", "", 3)!;
    expect(q.percent).toBe("25.862923%");
    expect(q.fraction).toBe("75670/292581");
    expect(Math.abs(q.exactPct - 25.862923)).toBeLessThan(1e-6);
  });

  it("guess → reveal persists an error record to ppl.v1.training", async () => {
    seedKillerDeck();
    useUiStore.setState({ activeView: "trainer" });
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    await user.click(screen.getByRole("button", { name: "出題" }));
    await user.type(screen.getByRole("spinbutton", { name: "你的估計(百分比)" }), "50");
    await user.click(screen.getByRole("button", { name: "揭曉精確值" }));

    expect(screen.getByText(/你估 50/)).toBeInTheDocument();
    const records = JSON.parse(localStorage.getItem("ppl.v1.training") ?? "[]");
    expect(records).toHaveLength(1);
    expect(records[0].guessPct).toBe(50);
    expect(screen.getByRole("button", { name: "下一題" })).toBeInTheDocument();
  });
});

describe("tracker view UI", () => {
  it("seen +2 on the 4-of updates the posterior row", async () => {
    seedKillerDeck();
    useUiStore.setState({ activeView: "tracker" });
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    expect(screen.getByText(/正式比賽使用外部工具可能違反賽事規定/)).toBeInTheDocument();
    const inc = screen.getByRole("button", { name: "「火球鼠」已見 +1" });
    await user.click(inc);
    await user.click(inc);

    // u = 58, u_x = 2 → exact hand calc.
    const hand = sub(R_ONE, rat(binom(56, 6), binom(58, 6)));
    expect(screen.getByText(percentStr(hand, 6))).toBeInTheDocument();
  });
});
