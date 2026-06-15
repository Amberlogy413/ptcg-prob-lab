/**
 * 暫譯卡效 integrity (owner mandate 2026-06-15: 繁中 must not silently show ja,
 * but translations must be REAL, not fabricated). Guards that every provisional
 * translation targets a real card name, that each ability/attack key is a real
 * Japanese move name on that card (so a translation can never attach to the wrong
 * move), and that no translated value leaks Japanese kana.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { CARD_TEXT_ZH, hasKana } from "../src/data/cardTextZh.ts";

interface RawCard {
  name: string;
  nameZh?: string;
  abilities?: { name?: string }[];
  attacks?: { name?: string }[];
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  readFileSync(join(root, "public", "catalog", "cards-zh-Hant.json"), "utf8"),
) as { cards: RawCard[] };

// display name → the union of every ability/attack ja-name across all its prints.
const abilityNames = new Map<string, Set<string>>();
const attackNames = new Map<string, Set<string>>();
for (const c of catalog.cards) {
  const k = c.nameZh ?? c.name;
  const ab = abilityNames.get(k) ?? new Set();
  const at = attackNames.get(k) ?? new Set();
  for (const a of c.abilities ?? []) if (a.name) ab.add(a.name);
  for (const a of c.attacks ?? []) if (a.name) at.add(a.name);
  abilityNames.set(k, ab);
  attackNames.set(k, at);
}

describe("hasKana", () => {
  it("detects Japanese kana, ignores pure zh / empty", () => {
    expect(hasKana("とうしのつばさ")).toBe(true);
    expect(hasKana("鬥志之翼")).toBe(false);
    expect(hasKana("")).toBe(false);
    expect(hasKana(undefined)).toBe(false);
  });
});

describe("CARD_TEXT_ZH provisional translations", () => {
  it("every override targets a real catalog card name", () => {
    for (const name of Object.keys(CARD_TEXT_ZH)) {
      expect(abilityNames.has(name), name).toBe(true);
    }
  });

  it("each ability/attack key is a REAL Japanese move name on that card", () => {
    for (const [name, ov] of Object.entries(CARD_TEXT_ZH)) {
      for (const jaName of Object.keys(ov.abilities ?? {})) {
        expect(abilityNames.get(name)?.has(jaName), `${name} / ability ${jaName}`).toBe(true);
      }
      for (const jaName of Object.keys(ov.attacks ?? {})) {
        expect(attackNames.get(name)?.has(jaName), `${name} / attack ${jaName}`).toBe(true);
      }
    }
  });

  it("no translated value leaks Japanese kana (it must be real zh)", () => {
    for (const [id, ov] of Object.entries(CARD_TEXT_ZH)) {
      for (const a of Object.values(ov.abilities ?? {})) {
        expect(hasKana(a.name), `${id} ability name`).toBe(false);
        expect(hasKana(a.effect), `${id} ability effect`).toBe(false);
      }
      for (const a of Object.values(ov.attacks ?? {})) {
        expect(hasKana(a.name), `${id} attack name`).toBe(false);
        expect(hasKana(a.effect), `${id} attack effect`).toBe(false);
      }
      expect(hasKana(ov.effect), `${id} effect`).toBe(false);
    }
  });
});
