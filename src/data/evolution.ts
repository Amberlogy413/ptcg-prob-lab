/**
 * Evolution-chain facts for faithful Rare Candy (神奇糖果) verification.
 *
 * `evolutionData.json` is generated from PokéAPI species data
 * (scripts/build_evolution.mjs ← scripts/dex_names.json):
 *   from:    dexId → immediate pre-evolution dexId (the species line)
 *   species: exact zh / ja / lowercased-en name → dexId
 *
 * Why this exists: the card catalog carries `dexId` on only ~40% of Pokémon
 * cards (and not on most std-legal lines), and it has NO reliable Basic→Stage1→
 * Stage2 link — so a Rare Candy jump cannot be validated from the catalog alone.
 * The PokéAPI species line is the real chain; matching a card to its species by
 * EXACT name (never fuzzy) lets us verify "this Stage 2 evolves from this Basic"
 * without ever guessing. A card we cannot resolve is simply not Rare-Candy-able.
 */

import type { CatalogCard } from "./catalog.ts";
import { FROM, SPECIES } from "./evolutionData.ts";

/** The immediate pre-evolution species dexId, or null at the base of the line. */
export function preEvoDex(dex: number): number | null {
  const f = FROM[String(dex)];
  return f === undefined ? null : f;
}

/** Strip the parts of a card name that sit around the species: an owner prefix
 *  「<人物>的<種名>」, a Mega prefix (超級 / メガ / Mega), and a card-type suffix
 *  (ex / V / VMAX / VSTAR / V-UNION / GX). Returns the bare species-name guess. */
function bareSpecies(raw: string): string {
  let s = raw.trim();
  const owner = s.lastIndexOf("的"); // 竹蘭的烈咬陸鯊 → 烈咬陸鯊
  if (owner >= 0 && owner < s.length - 1) s = s.slice(owner + 1);
  s = s.replace(/^超級/, "").replace(/^メガ/, "").replace(/^[Mm]ega\s+/, "");
  for (const suf of ["V-UNION", "VMAX", "VSTAR", "ex", "EX", "GX", "V"]) {
    if (s.endsWith(suf)) {
      s = s.slice(0, s.length - suf.length).trimEnd();
      break;
    }
  }
  return s.trim();
}

/** Resolve a Pokémon card to its National-Dex species id, or null. Prefers the
 *  card's own `dexId`; otherwise matches its name (zh / name / ja as-is, en
 *  lowercased) against the species index, EXACTLY. */
export function speciesDexOf(card: CatalogCard | null): number | null {
  if (card === null) return null;
  if (card.dexId !== undefined && card.dexId.length > 0 && card.dexId[0] !== undefined) return card.dexId[0];
  const tries: Array<string | undefined> = [
    card.nameZh && bareSpecies(card.nameZh),
    bareSpecies(card.name),
    card.nameJa && bareSpecies(card.nameJa),
    card.nameEn && bareSpecies(card.nameEn).toLowerCase(),
  ];
  for (const t of tries) {
    if (t === undefined || t === "") continue;
    const dex = SPECIES[t];
    if (dex !== undefined) return dex;
  }
  return null;
}

/**
 * Can a Rare Candy jump-evolve `basic` (in play) directly into `stage2` (from
 * hand)? TRUE only when, by the REAL species line, `stage2` is two evolutions
 * above `basic`: stage2's pre-evo's pre-evo IS basic's species. Gated by the
 * printed stages (Basic → Stage 2), which also keeps baby-Pokémon lines correct
 * (a baby line's top card is a TCG Stage 1, never a Stage 2, so it never reaches
 * here). Conservative: if either card's species can't be resolved, returns false
 * — we never offer a jump we can't prove legal.
 */
export function canRareCandyJump(basic: CatalogCard | null, stage2: CatalogCard | null): boolean {
  if (basic === null || stage2 === null) return false;
  if (basic.category !== "Pokemon" || stage2.category !== "Pokemon") return false;
  if (basic.stage !== "Basic" || stage2.stage !== "Stage2") return false;
  const bDex = speciesDexOf(basic);
  const s2Dex = speciesDexOf(stage2);
  if (bDex === null || s2Dex === null) return false;
  const mid = preEvoDex(s2Dex); // the Stage 1 species
  if (mid === null) return false;
  const root = preEvoDex(mid); // the Basic species
  return root !== null && root === bDex;
}
