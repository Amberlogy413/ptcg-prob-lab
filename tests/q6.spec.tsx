/**
 * Phase 6 DoD (docs/06): MC verification converges on the exact value;
 * energy-curve golden v2 backs the UI; luck meter outputs the exact tail for
 * "n straight games without the 4-of"; the fallacy museum ships ≥4 exact
 * demos; the D2 basics list retags decks.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { simulateCombo, mulberry32 } from "../src/state/mcSim.ts";
import { computeLuckMeter, computeEnergyCurve } from "../src/state/q5.ts";
import { luckTail, ratPow } from "../src/lib/probx/luck.ts";
import { rat, percentStr, fractionStr } from "../src/lib/prob/index.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { useQueryStore } from "../src/state/queryStore.ts";

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
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
  useQueryStore.setState({ tracked: [], mulliganAware: true });
  useUiStore.setState({ activeView: "deck", askTab: "q1" });
  window.history.replaceState(null, "", "/");
});

describe("Monte-Carlo simulator (docs/05 §D)", () => {
  const KILLER = {
    counts: [4, 3],
    constraints: [
      [1, 7],
      [1, 7],
    ] as Array<[number, number]>,
    isBasic: [true, false],
    otherBasics: 6,
    N: 60,
    H: 7,
    iterations: 20000,
    seed: 42,
  };

  it("is deterministic for a fixed seed", () => {
    const a = simulateCombo(KILLER);
    const b = simulateCombo(KILLER);
    expect(a.hits).toBe(b.hits);
    expect(a.n).toBe(20000);
  });

  it("converges on the exact killer value within 5σ", () => {
    const { hits, n } = simulateCombo(KILLER);
    const p = 0.15383618; // exact 11011691/71580630, float for the tolerance only
    const sigma = Math.sqrt((p * (1 - p)) / n);
    expect(Math.abs(hits / n - p)).toBeLessThan(5 * sigma);
  });

  it("without conditioning it matches the naive value within 5σ", () => {
    const { hits, n } = simulateCombo({ ...KILLER, otherBasics: -1, seed: 7 });
    const p = 0.11404965;
    const sigma = Math.sqrt((p * (1 - p)) / n);
    expect(Math.abs(hits / n - p)).toBeLessThan(5 * sigma);
  });

  it("mulberry32 streams are reproducible", () => {
    const r1 = mulberry32(123);
    const r2 = mulberry32(123);
    for (let i = 0; i < 5; i++) expect(r1()).toBe(r2());
  });
});

describe("energy shortfall curve UI data (docs/02 §6.4)", () => {
  it("matches the v2-golden-backed module and is monotone in n", () => {
    const data = computeEnergyCurve(10, 10, 1, false, false, 6, 60)!;
    expect(data.pValid.fraction).toBe("216911/292581");
    const charts = data.rows.map((r) => r.chart);
    for (let i = 1; i < charts.length; i++) {
      expect(charts[i]).toBeLessThanOrEqual(charts[i - 1] as number);
    }
    expect(data.rows[0]?.nSeen).toBe(8);
  });

  it("guards impossible setups", () => {
    expect(computeEnergyCurve(10, 0, 1, false, false, 6, 60)).toBeNull();
  });
});

describe("luck meter (docs/02 §10)", () => {
  it("n straight T1 misses of the 4-of equals (1−p)^n exactly", () => {
    seedKillerDeck();
    const deck = useDeckStore.getState().decks[0]!;
    const data = computeLuckMeter(deck, "火球鼠", "seenT1", 5)!;
    expect(data.perGame.fraction).toBe("43382/97527"); // docs/02 §6.2 n=8 anchor
    const tail = luckTail(rat(43382n, 97527n), 5);
    expect(data.tail.percent).toBe(percentStr(tail, 6));
    expect(data.tail.fraction).toBe(fractionStr(tail));
    // (1−0.444821)^5 ≈ 5.27% — just above the 5% bar, so NOT rare. 6 misses is.
    expect(data.rare).toBe(false);
    const six = computeLuckMeter(useDeckStore.getState().decks[0]!, "火球鼠", "seenT1", 6)!;
    expect(six.rare).toBe(true);
  });

  it("ratPow exact power identities", () => {
    expect(fractionStr(ratPow(rat(1n, 2n), 3))).toBe("1/8");
    expect(fractionStr(ratPow(rat(3n, 4n), 0))).toBe("1/1");
    expect(fractionStr(luckTail(rat(1n, 10n), 2))).toBe("81/100");
  });
});

describe("fallacy museum (docs/02 §9, ≥4 exact demos)", () => {
  it("renders four demos with the spec's wrong-vs-right anchors", () => {
    seedKillerDeck();
    useUiStore.setState({ activeView: "trainer" });
    render(<App />);

    expect(screen.getByText("謬誤互動博物館(02 §9)")).toBeInTheDocument();
    // §9-1 independence: 15.959995% vs 14.540568%
    expect(screen.getByText(/15\.959995%/)).toBeInTheDocument();
    expect(screen.getByText(/14\.540568%/)).toBeInTheDocument();
    // §9-2 binomial: 38.303939% vs 39.949963%
    expect(screen.getByText(/38\.303939%/)).toBeInTheDocument();
    expect(screen.getByText(/39\.949963%/)).toBeInTheDocument();
    // §9-3 mulligan: 11.404965% vs 15.383618%
    expect(screen.getByText(/11\.404965%/)).toBeInTheDocument();
    expect(screen.getByText(/15\.383618%/)).toBeInTheDocument();
    // §9-5 expectation vs probability: 40% vs 35.145960%
    expect(screen.getByText(/40\.000000%/)).toBeInTheDocument();
    expect(screen.getByText(/35\.145960%/)).toBeInTheDocument();
  });
});

describe("D2 basics list import", () => {
  it("merges tags and retags matching deck rows", async () => {
    seedKillerDeck();
    // 超夢風暴 starts non-Basic; the list flips it and adds an EN alias name.
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "匯入基礎名單" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("textbox"));
    await user.paste('{"超夢風暴": true, "Cyndaquil": true}');
    await user.click(within(dialog).getByRole("button", { name: "套用" }));

    expect(within(dialog).getByText(/已套用 2 個卡名;更新了 1 行牌組卡/)).toBeInTheDocument();
    const s = useDeckStore.getState();
    expect(s.basicTags["超夢風暴"]).toBe(true);
    expect(s.basicTags["Cyndaquil"]).toBe(true);
    expect(s.decks[0]?.cards.find((c) => c.name === "超夢風暴")?.isBasic).toBe(true);
  });

  it("rejects malformed JSON with a friendly error", async () => {
    seedKillerDeck();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "匯入基礎名單" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("textbox"));
    await user.paste('{"卡": "yes"}');
    await user.click(within(dialog).getByRole("button", { name: "套用" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("JSON 無法解析");
  });
});

describe("PWA assets", () => {
  it("ships a manifest and a service worker with the offline contract", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const manifest = JSON.parse(readFileSync(join(root, "public", "manifest.webmanifest"), "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
    const sw = readFileSync(join(root, "public", "sw.js"), "utf8");
    expect(sw).toContain("addEventListener(\"fetch\"");
    expect(sw).toContain("caches");
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toContain("manifest.webmanifest");
  });
});
