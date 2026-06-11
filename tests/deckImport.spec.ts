/**
 * PTCG Live import fixtures (docs/05 §E): normal list, missing sections,
 * blank/odd lines, non-60 totals — plus export round-trip.
 */

import { describe, it, expect } from "vitest";
import {
  parseDeckList,
  cardsNeedingBasicTag,
  exportDeckList,
} from "../src/utils/deckImport.ts";

const NORMAL_LIST = `Pokémon: 18
4 Charmander OBF 26
1 Charmander MEW 4
3 Charmeleon OBF 27
3 Charizard ex OBF 125
2 Pidgey OBF 162
2 Pidgeot ex OBF 164
1 Radiant Charizard CRZ 20
1 Rotom V CRZ 45
1 Manaphy BRS 41

Trainer: 32
4 Rare Candy SVI 191
4 Arven OBF 186
3 Iono PAL 185
2 Boss's Orders PAL 172
4 Ultra Ball SVI 196
4 Battle VIP Pass FST 225
2 Super Rod PAL 188
1 Lost Vacuum CRZ 135
2 Counter Catcher PAR 160
3 Pokégear 3.0 SVI 186
2 Technical Machine: Devolution PAR 177
1 Forest Seal Stone SIT 156

Energy: 10
10 Fire Energy SVE 2

Total Cards: 60
`;

describe("parseDeckList", () => {
  it("parses a normal PTCG Live list with sections, sets and numbers", () => {
    const r = parseDeckList(NORMAL_LIST);
    expect(r.unparsedLines).toEqual([]);
    expect(r.hasSections).toBe(true);
    expect(r.total).toBe(60);
    expect(r.declaredTotal).toBe(60);
    expect(r.cards).toHaveLength(22); // 9 Pokémon + 12 Trainer + 1 Energy lines

    const charmander = r.cards[0];
    expect(charmander).toEqual({
      count: 4,
      name: "Charmander",
      set: "OBF",
      number: "26",
      section: "pokemon",
    });

    // Multi-word names with embedded capitals / digits / colons survive.
    const vipPass = r.cards.find((c) => c.name === "Battle VIP Pass");
    expect(vipPass).toMatchObject({ count: 4, set: "FST", number: "225", section: "trainer" });
    const tm = r.cards.find((c) => c.name === "Technical Machine: Devolution");
    expect(tm).toMatchObject({ count: 2, set: "PAR", number: "177", section: "trainer" });
    const gear = r.cards.find((c) => c.name === "Pokégear 3.0");
    expect(gear).toMatchObject({ count: 3, set: "SVI", number: "186", section: "trainer" });

    const energy = r.cards.find((c) => c.name === "Fire Energy");
    expect(energy).toMatchObject({ count: 10, section: "energy" });

    const pokemonTotal = r.cards
      .filter((c) => c.section === "pokemon")
      .reduce((s, c) => s + c.count, 0);
    expect(pokemonTotal).toBe(18);
  });

  it("parses a list with no section headers (all cards unknown section)", () => {
    const r = parseDeckList(`4 Pikachu ex SVP 63
2 Squawkabilly ex PAL 169

4 Rare Candy
6 Lightning Energy
`);
    expect(r.hasSections).toBe(false);
    expect(r.total).toBe(16);
    expect(r.cards.every((c) => c.section === "unknown")).toBe(true);
    // Lines without set/number still parse — name keeps every word.
    expect(r.cards.find((c) => c.name === "Rare Candy")).toMatchObject({ count: 4 });
    expect(r.cards.find((c) => c.name === "Lightning Energy")).toMatchObject({ count: 6 });
  });

  it("tolerates blank lines, stray whitespace and unparseable lines", () => {
    const r = parseDeckList(`
Pokémon: 4

   4   Snorlax   PGO   55

??? not a card line
- bullet garbage
`);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({ count: 4, name: "Snorlax", section: "pokemon" });
    expect(r.unparsedLines).toEqual(["??? not a card line", "- bullet garbage"]);
  });

  it("accepts non-60 totals (deck under construction) and reports the sum", () => {
    const r = parseDeckList(`Pokémon: 6
4 Pikachu
2 Pichu
Trainer: 4
4 Nest Ball
`);
    expect(r.total).toBe(10);
    expect(r.unparsedLines).toEqual([]);
  });

  it("treats header variants case-insensitively and without counts", () => {
    const r = parseDeckList(`pokemon
2 Mew ex
TRAINERS: 3
3 Switch
energies
5 Psychic Energy
`);
    expect(r.cards.map((c) => c.section)).toEqual(["pokemon", "trainer", "energy"]);
    expect(r.hasSections).toBe(true);
  });
});

describe("cardsNeedingBasicTag", () => {
  it("returns only the Pokémon section when sections exist", () => {
    const r = parseDeckList(NORMAL_LIST);
    const need = cardsNeedingBasicTag(r);
    expect(need).toHaveLength(9);
    expect(need.every((c) => c.section === "pokemon")).toBe(true);
  });

  it("returns every card when no sections were recognized", () => {
    const r = parseDeckList(`4 Pikachu ex SVP 63
4 Rare Candy`);
    expect(cardsNeedingBasicTag(r)).toHaveLength(2);
  });
});

describe("exportDeckList", () => {
  it("round-trips through parseDeckList", () => {
    const original = parseDeckList(NORMAL_LIST);
    const text = exportDeckList(original.cards);
    const reparsed = parseDeckList(text);
    expect(reparsed.cards).toEqual(original.cards);
    expect(reparsed.total).toBe(60);
    expect(reparsed.declaredTotal).toBe(60);
  });

  it("emits unknown-section cards without a header and still re-parses", () => {
    const cards = [
      { name: "Pikachu", count: 4, section: "unknown" as const },
      { name: "Nest Ball", count: 4, section: "unknown" as const },
    ];
    const text = exportDeckList(cards);
    expect(text).not.toContain("Pokémon:");
    const reparsed = parseDeckList(text);
    expect(reparsed.total).toBe(8);
    expect(reparsed.cards.map((c) => c.name)).toEqual(["Pikachu", "Nest Ball"]);
  });
});
