/**
 * Phase 1 DoD flow (docs/06): paste a real PTCG Live list → mark Basics →
 * the left summary immediately shows the Basics count and the mulligan rate
 * from openingBasics. The fixture deck carries exactly 10 Basics, so the
 * gauge must show the B=10 anchor: 25.862923% (75670/292581).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import { STORAGE_KEYS } from "../src/utils/storage.ts";

// 14 Pokémon (10 Basics: Pikachu 4 + Voltorb 3 + Shinx 3), 36 Trainers, 10 Energy.
const LIVE_LIST = `Pokémon: 14
4 Pikachu MEW 25
3 Voltorb MEW 100
3 Shinx BRS 44
2 Raichu MEW 26
2 Luxray BRS 46

Trainer: 36
4 Professor's Research SVI 189
4 Ultra Ball SVI 196
4 Nest Ball SVI 181
4 Rare Candy SVI 191
4 Switch SVI 194
4 Iono PAL 185
4 Boss's Orders PAL 172
4 Arven OBF 186
4 Pokégear 3.0 SVI 186

Energy: 10
10 Lightning Energy SVE 4

Total Cards: 60
`;

describe("PTCG Live import flow", () => {
  beforeEach(() => {
    localStorage.clear();
    useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {} });
    useUiStore.setState({ activeView: "deck" });
  });

  it("imports, tags Basics, and the summary shows B=10 → 25.862923%", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Empty state → open the import wizard.
    await user.click(screen.getByRole("button", { name: "匯入牌表" }));
    const dialog = screen.getByRole("dialog");

    // Step 1: paste and continue.
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: LIVE_LIST } });
    await user.click(within(dialog).getByRole("button", { name: "下一步" }));

    // Step 2 is mandatory and lists only the Pokémon section (5 names).
    expect(within(dialog).getByText(/標記基礎寶可夢/)).toBeInTheDocument();
    const checkboxes = within(dialog).getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(5);

    await user.click(within(dialog).getByRole("checkbox", { name: /Pikachu/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Voltorb/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Shinx/ }));
    await user.click(within(dialog).getByRole("button", { name: "完成匯入" }));

    // The summary sidebar reflects the import instantly.
    expect(screen.getByText("25.862923%")).toBeInTheDocument();
    expect(screen.getByText("75670/292581 · 1 in 3.867")).toBeInTheDocument();
    expect(screen.getByText("0.348853")).toBeInTheDocument(); // E[mulligans]
    expect(screen.getByText("74.137077%")).toBeInTheDocument(); // valid hand

    // Tags are remembered globally and the deck persists under the spec keys.
    const s = useDeckStore.getState();
    expect(s.basicTags).toMatchObject({
      Pikachu: true,
      Voltorb: true,
      Shinx: true,
      Raichu: false,
      Luxray: false,
    });
    expect(localStorage.getItem(STORAGE_KEYS.decks)).toContain("Pikachu");
    expect(localStorage.getItem(STORAGE_KEYS.basicTags)).toContain("Voltorb");
  });

  it("re-importing the same names arrives pre-tagged from basicTags", async () => {
    useDeckStore.getState().rememberBasicTags({ Pikachu: true, Raichu: false });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "匯入牌表" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: LIVE_LIST } });
    await user.click(within(dialog).getByRole("button", { name: "下一步" }));

    expect(within(dialog).getByRole("checkbox", { name: /Pikachu/ })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: /Raichu/ })).not.toBeChecked();
    expect(within(dialog).getByText(/已套用先前記憶的標記/)).toBeInTheDocument();
  });

  it("warns on a non-60 list but still allows the import", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "匯入牌表" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Pokémon: 4\n4 Pikachu MEW 25\n" },
    });
    await user.click(within(dialog).getByRole("button", { name: "下一步" }));

    expect(within(dialog).getByText(/總數 4 ≠ 60/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: /Pikachu/ }));
    await user.click(within(dialog).getByRole("button", { name: "完成匯入" }));

    expect(useDeckStore.getState().decks).toHaveLength(1);
    // 4-card deck: opening-hand math needs ≥ 7 cards.
    expect(screen.getByText("牌組至少需 7 張才能計算起手概率。")).toBeInTheDocument();
  });
});
