/**
 * 暫譯卡效 integrity (owner mandate 2026-06-15: 繁中 must not silently show ja,
 * but translations must be real, not fabricated). These guard that every
 * provisional translation targets a REAL card, carries NO Japanese kana (it is
 * actually zh), and aligns index-wise with the card's own abilities/attacks so
 * it can never attach to the wrong ability/attack.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { CARD_TEXT_ZH, hasKana } from "../src/data/cardTextZh.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  readFileSync(join(root, "public", "catalog", "cards-zh-Hant.json"), "utf8"),
) as { cards: { id: string; abilities?: unknown[]; attacks?: unknown[] }[] };
const byId = new Map(catalog.cards.map((c) => [c.id, c]));

describe("hasKana", () => {
  it("detects Japanese kana, ignores pure zh / empty", () => {
    expect(hasKana("とうしのつばさ")).toBe(true);
    expect(hasKana("鬥志之翼")).toBe(false);
    expect(hasKana("")).toBe(false);
    expect(hasKana(undefined)).toBe(false);
  });
});

describe("CARD_TEXT_ZH provisional translations", () => {
  it("every override targets a real catalog card", () => {
    for (const id of Object.keys(CARD_TEXT_ZH)) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("no translated field leaks Japanese kana (it must be real zh)", () => {
    for (const [id, ov] of Object.entries(CARD_TEXT_ZH)) {
      for (const a of ov.abilities ?? []) {
        expect(hasKana(a.name), `${id} ability name`).toBe(false);
        expect(hasKana(a.effect), `${id} ability effect`).toBe(false);
      }
      for (const a of ov.attacks ?? []) {
        expect(hasKana(a.name), `${id} attack name`).toBe(false);
        expect(hasKana(a.effect), `${id} attack effect`).toBe(false);
      }
      expect(hasKana(ov.effect), `${id} effect`).toBe(false);
    }
  });

  it("override arrays stay within the card's own ability/attack counts", () => {
    for (const [id, ov] of Object.entries(CARD_TEXT_ZH)) {
      const c = byId.get(id)!;
      if (ov.abilities) expect(ov.abilities.length, id).toBeLessThanOrEqual((c.abilities ?? []).length);
      if (ov.attacks) expect(ov.attacks.length, id).toBeLessThanOrEqual((c.attacks ?? []).length);
    }
  });
});
