/**
 * 白話詳解 (owner request 2026-06-15): every headline number gets a second "?"
 * button opening an exhaustive plain-language explanation (question → symbols →
 * step-by-step → reading → why-trust) plus the concrete receipt. Verifies the
 * builder produces real translated sections (with the three formats substituted)
 * and that the button + modal wire up on a real page.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { translate } from "../src/i18n/index.ts";
import { buildExplain, type ExplainKind } from "../src/data/explain.ts";
import { useDeckStore, type Deck } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";

const t = (k: string, p?: Record<string, string | number>) => translate("zh-Hant", k, p);

describe("buildExplain", () => {
  it("produces five plain-language sections for every kind, with real zh text", () => {
    const kinds: ExplainKind[] = ["mulligan", "combo", "prize", "jointPrize", "midgame", "draw"];
    for (const kind of kinds) {
      const secs = buildExplain(t, kind, { pct: "25.0%", frac: "1/4", oneIn: "1 in 4" });
      expect(secs, kind).toHaveLength(5);
      for (const s of secs) {
        expect(s.h.length, `${kind} heading`).toBeGreaterThan(0);
        expect(s.body.length, `${kind} body`).toBeGreaterThan(10);
        expect(s.h.startsWith("explain."), `${kind} heading not translated`).toBe(false);
      }
    }
  });

  it("substitutes the three formats into the reading section", () => {
    const secs = buildExplain(t, "mulligan", { pct: "25.862923%", frac: "75670/292581", oneIn: "1 in 3.867" });
    const read = secs.find((s) => s.body.includes("25.862923%"));
    expect(read).toBeTruthy();
    expect(read!.body).toContain("75670/292581");
    expect(read!.body).toContain("1 in 3.867");
    // The trust section names the exact-math guarantee.
    expect(secs.some((s) => s.body.includes("BigInt"))).toBe(true);
  });
});

const ANCHOR: Deck = {
  id: "d1",
  name: "Anchor",
  createdAt: 0,
  updatedAt: 0,
  cards: [
    { id: "c1", name: "基礎手", count: 10, isBasic: true, section: "pokemon" },
    { id: "c2", name: "填充", count: 50, isBasic: false, section: "trainer" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [ANCHOR], activeDeckId: "d1", basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "ask", askTab: "q1", rotationMark: null });
});

describe("plain-language explainer button (Q1)", () => {
  it("opens the explainer modal with the plain words and the concrete receipt", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();

    // Q1 headline's explainer (distinct from the aside mulligan's by title).
    await user.click(screen.getByRole("button", { name: "白話詳解「起手重抽概率」" }));
    const dialog = screen.getByRole("dialog", { name: /白話詳解/ });
    expect(within(dialog).getByText("呢個數答緊咩問題")).toBeInTheDocument();
    expect(within(dialog).getByText(/開局你會抽 7 張牌/)).toBeInTheDocument();
    // The concrete substituted formula sits under the plain words.
    expect(within(dialog).getByText("對應算式(代入真實數字)")).toBeInTheDocument();
    expect(within(dialog).getByText("P(重抽) = C(50, 7) / C(60, 7)")).toBeInTheDocument();
  });
});
