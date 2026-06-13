/**
 * Trilingual card names (owner request 2026-06-13): cardName picks the
 * requested language with a graceful fallback, and otherNames lists the
 * remaining distinct languages for the tri-lingual secondary display.
 */

import { describe, it, expect } from "vitest";
import { cardName, otherNames, type CatalogCard } from "../src/data/catalog.ts";

const full: CatalogCard = {
  id: "SV9-001",
  localId: "001",
  name: "綠毛蟲",
  category: "Pokemon",
  stage: "Basic",
  nameZh: "綠毛蟲",
  nameJa: "キャタピー",
  nameEn: "Caterpie",
  set: "SV9",
};

// A newest-set card with no zh translation yet (ja-supplement).
const jaOnly: CatalogCard = {
  id: "M1L-001",
  localId: "001",
  name: "フシギダネ",
  category: "Pokemon",
  stage: "Basic",
  nameJa: "フシギダネ",
  nameEn: "Bulbasaur",
  set: "M1L",
};

describe("cardName", () => {
  it("returns the requested language", () => {
    expect(cardName(full, "zh")).toBe("綠毛蟲");
    expect(cardName(full, "en")).toBe("Caterpie");
    expect(cardName(full, "ja")).toBe("キャタピー");
  });

  it("falls back gracefully when a language is missing (never blank)", () => {
    // zh missing → zh request falls back to ja, then en.
    expect(cardName(jaOnly, "zh")).toBe("フシギダネ");
    expect(cardName(jaOnly, "en")).toBe("Bulbasaur");
    expect(cardName(jaOnly, "ja")).toBe("フシギダネ");
    // a name with only the canonical `name`.
    const bare: CatalogCard = { id: "x", localId: "1", name: "自創", category: "Trainer", set: null };
    expect(cardName(bare, "en")).toBe("自創");
  });
});

describe("otherNames", () => {
  it("lists the other two distinct languages, primary excluded", () => {
    expect(otherNames(full, "zh").sort()).toEqual(["Caterpie", "キャタピー"]);
    expect(otherNames(full, "en")).toContain("綠毛蟲");
    expect(otherNames(full, "en")).toContain("キャタピー");
  });

  it("de-duplicates when languages share a string", () => {
    // ja-only card: zh falls back to ja, so 'ja' primary should not list ja twice.
    const others = otherNames(jaOnly, "ja");
    expect(others).toContain("Bulbasaur");
    expect(others.filter((n) => n === "フシギダネ")).toHaveLength(0);
  });
});
