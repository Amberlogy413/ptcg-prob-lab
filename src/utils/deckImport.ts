/**
 * PTCG Live deck-list parsing and export (docs/03 §8).
 *
 * Tolerant by design: section headers are optional, blank lines are skipped,
 * unparseable lines are reported (not fatal), totals ≠ 60 are a warning, and
 * set code / collector number are preserved but never used in math.
 */

import type { DeckSection, NewCardInput } from "../state/deckStore.ts";

export interface ParsedCard {
  count: number;
  name: string;
  set?: string;
  number?: string;
  section: DeckSection;
}

export interface ParseResult {
  cards: ParsedCard[];
  /** Sum of card counts (not the "Total Cards:" header value). */
  total: number;
  /** Lines that looked like content but could not be parsed. */
  unparsedLines: string[];
  /** True if at least one recognized section header was present. */
  hasSections: boolean;
  /** Value of a "Total Cards: N" line, when present. */
  declaredTotal?: number;
}

/** docs/03 §8 line format: count, name, optional set code + collector number. */
const CARD_LINE = /^(\d+)\s+(.+?)(?:\s+([A-Z0-9-]{2,6})\s+(\w+))?$/;

const SECTION_HEADER = /^(pok[ée]mon|trainer|trainers|energy|energies)\s*:?\s*(\d+)?\s*$/i;
const TOTAL_LINE = /^total\s+cards\s*:?\s*(\d+)?\s*$/i;

function sectionFromHeader(word: string): DeckSection {
  const w = word.toLowerCase();
  if (w.startsWith("pok")) return "pokemon";
  if (w.startsWith("trainer")) return "trainer";
  return "energy";
}

export function parseDeckList(text: string): ParseResult {
  const cards: ParsedCard[] = [];
  const unparsedLines: string[] = [];
  let section: DeckSection = "unknown";
  let hasSections = false;
  let declaredTotal: number | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;

    const header = SECTION_HEADER.exec(line);
    if (header) {
      section = sectionFromHeader(header[1] as string);
      hasSections = true;
      continue;
    }

    const totalLine = TOTAL_LINE.exec(line);
    if (totalLine) {
      if (totalLine[1] !== undefined) declaredTotal = Number(totalLine[1]);
      continue;
    }

    const m = CARD_LINE.exec(line);
    if (m) {
      const card: ParsedCard = {
        count: Number(m[1]),
        name: (m[2] as string).trim(),
        section,
      };
      if (m[3] !== undefined) card.set = m[3];
      if (m[4] !== undefined) card.number = m[4];
      cards.push(card);
      continue;
    }

    unparsedLines.push(line);
  }

  const total = cards.reduce((sum, c) => sum + c.count, 0);
  return {
    cards,
    total,
    unparsedLines,
    hasSections,
    ...(declaredTotal !== undefined ? { declaredTotal } : {}),
  };
}

/** Cards whose Basic-Pokémon status must be confirmed in the import wizard:
 *  the Pokémon section when sections exist, otherwise every card. */
export function cardsNeedingBasicTag(result: ParseResult): ParsedCard[] {
  const pokemon = result.cards.filter((c) => c.section === "pokemon");
  return pokemon.length > 0 ? pokemon : result.cards;
}

export function toNewCardInputs(
  cards: ParsedCard[],
  basicByName: Record<string, boolean>,
): NewCardInput[] {
  return cards.map((c) => ({
    name: c.name,
    count: c.count,
    section: c.section,
    ...(basicByName[c.name] !== undefined ? { isBasic: basicByName[c.name] } : {}),
    ...(c.set !== undefined ? { set: c.set } : {}),
    ...(c.number !== undefined ? { number: c.number } : {}),
  }));
}

interface ExportableCard {
  name: string;
  count: number;
  section: DeckSection;
  set?: string;
  number?: string;
}

const EXPORT_HEADERS: Record<Exclude<DeckSection, "unknown">, string> = {
  pokemon: "Pokémon",
  trainer: "Trainer",
  energy: "Energy",
};

/** PTCG Live-style text. Unknown-section cards are emitted in a trailing,
 *  headerless group — the parser above reads them back fine. */
export function exportDeckList(cards: ExportableCard[]): string {
  const lines: string[] = [];
  const order: DeckSection[] = ["pokemon", "trainer", "energy", "unknown"];
  for (const section of order) {
    const group = cards.filter((c) => c.section === section && c.count > 0);
    if (group.length === 0) continue;
    if (section !== "unknown") {
      const n = group.reduce((sum, c) => sum + c.count, 0);
      lines.push(`${EXPORT_HEADERS[section]}: ${n}`);
    }
    for (const c of group) {
      const suffix = c.set !== undefined && c.number !== undefined ? ` ${c.set} ${c.number}` : "";
      lines.push(`${c.count} ${c.name}${suffix}`);
    }
    lines.push("");
  }
  const total = cards.reduce((sum, c) => sum + c.count, 0);
  lines.push(`Total Cards: ${total}`);
  return lines.join("\n");
}
