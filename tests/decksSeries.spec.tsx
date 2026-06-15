/**
 * 系列 grouping (#40 2026-06-15): archetypes sharing a carry Pokémon fold into
 * one column with a 路線 picker. Verifies the pure grouping/localization logic
 * and the interactive variant switch, plus the invariant that mechanic-named
 * archetypes (太晶Box / 祭典樂舞) never get merged into a carry.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.tsx";
import { viewReady } from "./helpers.ts";
import { useDeckStore } from "../src/state/deckStore.ts";
import { useUiStore } from "../src/state/uiStore.ts";
import {
  groupSeries,
  localizeCarry,
  stripTier,
  tierizeName,
  setDecksForTests,
  type Archetype,
  type DeckData,
} from "../src/data/decks.ts";
import type { Catalog } from "../src/data/catalog.ts";

function arch(over: Partial<Archetype> & { id: string; name: string }): Archetype {
  return {
    icons: [over.id],
    deckCount: 10,
    score: 10,
    builds: [],
    ...over,
  };
}

describe("groupSeries", () => {
  it("folds same-carry archetypes (incl. Mega form) into one series", () => {
    const series = groupSeries([
      arch({ id: "dragapult", name: "Dragapult", icons: ["dragapult"], deckCount: 290 }),
      arch({ id: "dragapult-dusknoir", name: "Dragapult Dusknoir", icons: ["dragapult", "dusknoir"], deckCount: 173 }),
      arch({ id: "mega-greninja", name: "Mega Greninja", icons: ["greninja-mega"], deckCount: 173 }),
      arch({ id: "greninja", name: "Greninja", icons: ["greninja"], deckCount: 38 }),
    ]);
    const dra = series.find((s) => s.id === "dragapult");
    const gre = series.find((s) => s.id === "greninja");
    expect(dra?.members).toHaveLength(2);
    expect(dra?.deckCount).toBe(463);
    // greninja-mega normalizes to the same carry as plain greninja.
    expect(gre?.members).toHaveLength(2);
    expect(gre?.deckCount).toBe(211);
  });

  it("orders series and their variants by real popularity (deck count)", () => {
    const series = groupSeries([
      arch({ id: "greninja", name: "Greninja", icons: ["greninja"], deckCount: 38 }),
      arch({ id: "mega-greninja", name: "Mega Greninja", icons: ["greninja-mega"], deckCount: 173 }),
      arch({ id: "dragapult", name: "Dragapult", icons: ["dragapult"], deckCount: 290 }),
    ]);
    expect(series.map((s) => s.id)).toEqual(["dragapult", "greninja"]);
    // most-played variant leads within the series.
    expect(series[1]!.members[0]!.name).toBe("Mega Greninja");
  });

  it("keeps a distinct multi-word carry (raging-bolt) intact, not stripped to -bolt", () => {
    const series = groupSeries([
      arch({ id: "raging-bolt-ogerpon", name: "Raging Bolt Ogerpon", icons: ["raging-bolt", "ogerpon"] }),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0]!.id).toBe("raging-bolt");
    expect(series[0]!.carryIcon).toBe("raging-bolt");
  });

  it("never merges a mechanic-named archetype into a carry it shares an icon with", () => {
    const series = groupSeries([
      arch({ id: "ogerpon-meganium", name: "Ogerpon Meganium Hydrapple", icons: ["ogerpon", "hydrapple"], deckCount: 117 }),
      // Basic Box leads on the ogerpon icon but is its own identity (curated handle).
      arch({ id: "basic-box", name: "Basic Box", icons: ["ogerpon", "clefairy"], deckCount: 48 }),
    ]);
    const carry = series.find((s) => s.id === "ogerpon");
    const box = series.find((s) => s.id === "@basic-box");
    expect(carry?.members).toHaveLength(1);
    expect(box?.isCarry).toBe(false);
    expect(box?.members).toHaveLength(1);
  });
});

describe("stripTier / tierizeName (#ex-suffix from the real decklist)", () => {
  it("strips 超級 prefix and ex / V / VMAX / VSTAR suffix to the bare species", () => {
    expect(stripTier("多龍巴魯托ex")).toBe("多龍巴魯托");
    expect(stripTier("超級甲賀忍蛙ex")).toBe("甲賀忍蛙");
    expect(stripTier("彥羅龍VSTAR")).toBe("彥羅龍");
    expect(stripTier("夜巨人")).toBe("夜巨人");
  });

  it("re-applies the real tier (from the zh-localized decklist names) onto a title", () => {
    const names = ["多龍巴魯托ex", "夜巨人"];
    expect(tierizeName("多龍巴魯托", names)).toBe("多龍巴魯托ex");
    expect(tierizeName("多龍巴魯托 夜巨人", names)).toBe("多龍巴魯托ex 夜巨人");
    // Mega carry: the decklist holds the 超級…ex card.
    expect(tierizeName("甲賀忍蛙", ["超級甲賀忍蛙ex"])).toBe("超級甲賀忍蛙ex");
  });

  it("leaves descriptors and unmatched tokens untouched, and is a no-op without names", () => {
    expect(tierizeName("太晶Box", ["厄鬼椪ex"])).toBe("太晶Box");
    expect(tierizeName("多龍巴魯托", [])).toBe("多龍巴魯托");
  });
});

describe("localizeCarry", () => {
  const catalog = { dexEnZh: { dragapult: "多龍巴魯托", "raging bolt": "猛雷鼓" } } as unknown as Catalog;

  it("localizes a carry via the official dex, stripping the Mega form suffix", () => {
    const [s] = groupSeries([arch({ id: "x", name: "Mega Dragapult", icons: ["dragapult-mega"] })]);
    expect(localizeCarry(s!, catalog)).toBe("多龍巴魯托");
  });

  it("resolves hyphenated multi-word species", () => {
    const [s] = groupSeries([arch({ id: "x", name: "Raging Bolt", icons: ["raging-bolt"] })]);
    expect(localizeCarry(s!, catalog)).toBe("猛雷鼓");
  });

  it("falls back to a Title-Cased slug for an unknown carry — never a guess", () => {
    const [s] = groupSeries([arch({ id: "x", name: "Mystery Mon", icons: ["mystery-mon"] })]);
    expect(localizeCarry(s!, catalog)).toBe("Mystery Mon");
  });
});

// --- interactive variant picker --------------------------------------------

const FIXTURE: DeckData = {
  v: 1,
  source: "Limitless",
  note: "test",
  generatedFor: "2026-06-13",
  format: "H/I/J",
  sampleDecks: 100,
  tournaments: 5,
  dateFrom: "2026-06-05",
  dateTo: "2026-06-13",
  archetypes: [
    {
      id: "dragapult",
      name: "Dragapult",
      icons: ["dragapult"],
      deckCount: 30,
      score: 90,
      builds: [
        {
          event: "Dragapult Solo Cup",
          date: "2026-06-12",
          players: 80,
          online: true,
          placing: 1,
          total: 60,
          cards: [{ count: 12, name: "多龍梅西亞", isBasic: true, section: "pokemon" }, { count: 48, name: "填充", isBasic: false, section: "trainer" }],
        },
      ],
    },
    {
      id: "dragapult-dusknoir",
      name: "Dragapult Dusknoir",
      icons: ["dragapult", "dusknoir"],
      deckCount: 20,
      score: 70,
      builds: [
        {
          event: "Dusknoir Pairing Open",
          date: "2026-06-11",
          players: 64,
          online: false,
          placing: 2,
          total: 60,
          cards: [{ count: 10, name: "多龍梅西亞", isBasic: true, section: "pokemon" }, { count: 50, name: "填充", isBasic: false, section: "trainer" }],
        },
      ],
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useDeckStore.setState({ decks: [], activeDeckId: null, basicTags: {}, aliases: {} });
  useUiStore.setState({ activeView: "decks", askTab: "q1", rotationMark: null });
  setDecksForTests(FIXTURE);
});

afterEach(() => {
  setDecksForTests(null);
});

describe("DecksView series variant picker", () => {
  it("folds two same-carry archetypes into one series with a 路線 badge", async () => {
    render(<App />);
    await viewReady();
    expect(await screen.findByText(/系列 · 2 路線/)).toBeInTheDocument();
    // total across both variants on the series header.
    expect(screen.getByText(/50 套上榜/)).toBeInTheDocument();
  });

  it("switches the shown build when a different 路線 is selected", async () => {
    const user = userEvent.setup();
    render(<App />);
    await viewReady();
    // Default = most-played variant (Dragapult solo) → its build is visible.
    expect(await screen.findByText("Dragapult Solo Cup")).toBeInTheDocument();
    expect(screen.queryByText("Dusknoir Pairing Open")).not.toBeInTheDocument();
    // Pick the Dusknoir pairing 路線.
    await user.click(screen.getByRole("button", { name: /Dragapult Dusknoir/ }));
    expect(screen.getByText("Dusknoir Pairing Open")).toBeInTheDocument();
    expect(screen.queryByText("Dragapult Solo Cup")).not.toBeInTheDocument();
  });
});
