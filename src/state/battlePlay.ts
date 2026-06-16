/**
 * Bridge from real catalog facts to a battle card's PLAY behaviour (owner
 * request 2026-06-17: a card's TYPE must decide what you can do with it). Pure
 * derivation from the verified catalog — never a guess. A card with no catalog
 * match falls back to its section so it still gates sensibly (a Trainer can
 * never end up on the field), and stays honest about the unknown.
 */

import type { PlayKind, CardSpec } from "./battleStore.ts";
import { resolveDeckRow, type Catalog, type CatalogCard } from "../data/catalog.ts";

/** A card's play behaviour, from its real category / stage / trainerType /
 *  energyType. Trainer subtypes map to their faithful play target; an
 *  unrecognised Trainer subtype defaults to Item (play then discard) so it can
 *  never be placed on the field. */
export function playKindOf(card: CatalogCard): PlayKind {
  if (card.category === "Pokemon") return card.stage === "Basic" || card.stage === undefined ? "basic" : "evolution";
  if (card.category === "Energy") return card.energyType === "Special" ? "energy-special" : "energy-basic";
  switch (card.trainerType) {
    case "Supporter":
      return "supporter";
    case "Stadium":
      return "stadium";
    case "Tool":
      return "tool";
    case "Item":
      return "item";
    default:
      return "item"; // unknown Trainer subtype → play + discard (never on the field)
  }
}

/** A deck row as the battle view knows it (before catalog enrichment). */
export interface RawSpec {
  name: string;
  count: number;
  isBasic: boolean;
  section: "pokemon" | "trainer" | "energy" | "unknown";
  catalogId?: string;
}

/** Enrich a raw deck row into a battle CardSpec: resolve to the real card for
 *  its play kind + battle facts (hp / retreat / evolveFrom). No match → derive a
 *  safe kind from the section so play stays type-correct. */
export function toBattleSpec(catalog: Catalog | null, raw: RawSpec): CardSpec {
  const card = catalog === null ? null : resolveDeckRow(catalog, { name: raw.name, ...(raw.catalogId !== undefined ? { catalogId: raw.catalogId } : {}) });
  let kind: PlayKind;
  if (card !== null) {
    kind = playKindOf(card);
  } else if (raw.section === "pokemon") {
    kind = raw.isBasic ? "basic" : "evolution";
  } else if (raw.section === "energy") {
    kind = "energy-basic";
  } else if (raw.section === "trainer") {
    kind = "item"; // safest Trainer fallback — play + discard, never on the field
  } else {
    kind = "unknown";
  }
  return {
    name: raw.name,
    count: raw.count,
    isBasic: raw.isBasic,
    section: raw.section,
    kind,
    ...(raw.catalogId !== undefined ? { catalogId: raw.catalogId } : {}),
    ...(card?.hp !== undefined ? { hp: card.hp } : {}),
    ...(card?.retreat !== undefined ? { retreat: card.retreat } : {}),
    ...(card?.evolveFrom !== undefined ? { evolveFrom: card.evolveFrom } : {}),
  };
}
