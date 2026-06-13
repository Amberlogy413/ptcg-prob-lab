/**
 * Format legality + type accent (owner request 2026-06-14): the deck builder,
 * card picker and battle sandbox must never offer a card outside the current
 * Standard (H/I/J), and every Pokémon card surface carries its type color.
 */

import { describe, it, expect } from "vitest";
import { isFormatLegal } from "../src/data/catalog.ts";
import { cardAccent, TYPE_COLORS, NEUTRAL_ACCENT } from "../src/data/typeColors.ts";
import { makeCatalogFixture } from "./catalogFixture.ts";

describe("isFormatLegal", () => {
  it("accepts std-legal (H/I/J + basic energy) and rejects rotated marks", () => {
    const cat = makeCatalogFixture();
    const legal = cat.cards.filter(isFormatLegal).map((c) => c.id);
    // I-mark prints and the basic energy are legal…
    expect(legal).toContain("SV9-001");
    expect(legal).toContain("SVE-001");
    // …the F and E reprints are not.
    expect(legal).not.toContain("S11-001");
    expect(legal).not.toContain("S8b-075");
  });
});

describe("cardAccent", () => {
  it("uses the Pokémon's primary type color", () => {
    expect(cardAccent({ types: ["Grass"] })).toBe(TYPE_COLORS.Grass);
    expect(cardAccent({ types: ["Water"] })).toBe(TYPE_COLORS.Water);
  });
  it("falls back to neutral for Trainer/Energy (no type)", () => {
    expect(cardAccent({})).toBe(NEUTRAL_ACCENT);
    expect(cardAccent({ types: [] })).toBe(NEUTRAL_ACCENT);
  });
});
