/**
 * P8.3 deck-list outputs (docs/08 §5A): text-only deck image card data and
 * SVG builder. No card artwork anywhere — every row is the user's own text.
 * The image carries exact badges (Basics count + mulligan probability) that
 * no shuffle-visualizer style export can offer.
 */

import type { Deck, DeckSection } from "../state/deckStore.ts";
import { deckTotal, deckBasics } from "../state/deckStore.ts";
import { openingBasics, percentStr, fractionStr } from "../lib/prob/index.ts";
import { HAND_SIZE } from "../constants.ts";

export interface SheetRow {
  name: string;
  count: number;
  isBasic: boolean;
}

export interface SheetGroup {
  section: DeckSection;
  rows: SheetRow[];
  count: number;
}

/** Group displayable rows (count > 0) by section, in print order. */
export function groupDeckRows(deck: Deck): SheetGroup[] {
  const order: DeckSection[] = ["pokemon", "trainer", "energy", "unknown"];
  const groups: SheetGroup[] = [];
  for (const section of order) {
    const rows = deck.cards
      .filter((c) => c.section === section && c.count > 0)
      .map((c) => ({ name: c.name.trim() === "" ? "—" : c.name, count: c.count, isBasic: c.isBasic }));
    if (rows.length === 0) continue;
    groups.push({ section, rows, count: rows.reduce((s, r) => s + r.count, 0) });
  }
  return groups;
}

export interface DeckBadges {
  total: number;
  basics: number;
  /** Present only when the mulligan probability is computable (≥7 cards, ≥1 Basic). */
  mulligan?: { percent: string; fraction: string };
}

export function deckBadges(deck: Deck): DeckBadges {
  const total = deckTotal(deck);
  const basics = deckBasics(deck);
  if (total < HAND_SIZE || basics < 1) return { total, basics };
  const q = openingBasics(basics, total, HAND_SIZE).mulligan;
  return { total, basics, mulligan: { percent: percentStr(q, 6), fraction: fractionStr(q) } };
}

export interface DeckCardLabels {
  sections: Record<DeckSection, string>;
  basicMark: string;
  totalLabel: string;
  basicsLabel: string;
  mulliganLabel: string;
  badge: string;
  product: string;
  footer: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const DECK_CARD_WIDTH = 800;

const MONO = "ui-monospace, 'IBM Plex Mono', Menlo, monospace";
const SANS = "'Noto Sans TC', 'IBM Plex Sans', system-ui, sans-serif";

export interface DeckCardSvg {
  svg: string;
  width: number;
  height: number;
}

/** Single-column, dynamic-height deck card in the product's design tokens. */
export function buildDeckCardSvg(deck: Deck, labels: DeckCardLabels): DeckCardSvg {
  const groups = groupDeckRows(deck);
  const badges = deckBadges(deck);

  const headerH = 84;
  const sectionHeadH = 30;
  const rowH = 22;
  const sectionGap = 8;
  const badgesH = 64;
  const footerH = 48;
  const bodyH = groups.reduce((s, g) => s + sectionHeadH + g.rows.length * rowH + sectionGap, 0);
  const height = headerH + bodyH + badgesH + footerH;

  const parts: string[] = [];
  const W = DECK_CARD_WIDTH;
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">`,
    `<rect width="${W}" height="${height}" fill="#FAF8F3"/>`,
    `<rect x="16" y="16" width="${W - 32}" height="${height - 32}" rx="10" fill="#FFFFFF" stroke="#E3DFD6"/>`,
    `<text x="40" y="62" font-family="${SANS}" font-size="22" fill="#15181C">${esc(deck.name || "—")}</text>`,
  );

  let y = headerH;
  for (const g of groups) {
    y += sectionHeadH;
    parts.push(
      `<text x="40" y="${y - 9}" font-family="${SANS}" font-size="14" fill="#5A6069">${esc(
        labels.sections[g.section],
      )} · ${g.count}</text>`,
      `<line x1="40" y1="${y - 4}" x2="${W - 40}" y2="${y - 4}" stroke="#E3DFD6"/>`,
    );
    for (const r of g.rows) {
      y += rowH;
      const mark = r.isBasic ? `  [${labels.basicMark}]` : "";
      parts.push(
        `<text x="40" y="${y - 6}" font-family="${MONO}" font-size="14" fill="#15181C">${r.count}×</text>`,
        `<text x="76" y="${y - 6}" font-family="${SANS}" font-size="14" fill="#15181C">${esc(r.name)}${esc(mark)}</text>`,
      );
    }
    y += sectionGap;
  }

  const badgeText = [
    `${labels.totalLabel} ${badges.total}`,
    `${labels.basicsLabel} ${badges.basics}`,
    ...(badges.mulligan
      ? [`${labels.mulliganLabel} ${badges.mulligan.percent} = ${badges.mulligan.fraction}`]
      : []),
  ].join("   ·   ");
  y += 30;
  parts.push(
    `<line x1="40" y1="${y - 22}" x2="${W - 40}" y2="${y - 22}" stroke="#E3DFD6"/>`,
    `<text x="40" y="${y}" font-family="${MONO}" font-size="15" fill="#15181C">${esc(badgeText)}</text>`,
  );

  const fy = height - 40;
  parts.push(
    `<rect x="40" y="${fy - 20}" width="170" height="28" rx="6" fill="none" stroke="#2B59C3"/>`,
    `<text x="125" y="${fy - 1}" font-family="${SANS}" font-size="12" fill="#2B59C3" text-anchor="middle">${esc(labels.badge)}</text>`,
    `<text x="226" y="${fy - 1}" font-family="${SANS}" font-size="14" fill="#15181C">${esc(labels.product)}</text>`,
    `<text x="${W - 40}" y="${fy - 1}" font-family="${SANS}" font-size="11" fill="#5A6069" text-anchor="end">${esc(labels.footer)}</text>`,
    `</svg>`,
  );

  return { svg: parts.join("\n"), width: W, height };
}
