/**
 * fetch_dex_names.mjs — pull the OFFICIAL Traditional-Chinese (zh-Hant) species
 * names for every National Dex number that appears in the card catalog, from
 * PokéAPI (pokeapi.co, the games' official localizations — the same names
 * 52poke uses). Real data, no guessing.
 *
 * Owner request 2026-06-14: "揀繁中但 ニャースex 仍是日文" — newest ja-supplemented
 * sets ship without a zh card name, so cards fell back to Japanese. This builds
 * the dexId → zh map so fill_zh_names.mjs can give every Pokémon its real
 * Chinese name.
 *
 * Reads:  public/catalog/cards-zh-Hant.json (for the set of dexIds in use)
 * Writes: scripts/dex_names.json  ({ "52": {zh,ja,en}, ... })  — also its cache
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const OUT = path.join(ROOT, "scripts", "dex_names.json");
const CONCURRENCY = 8;

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    return {};
  }
}

async function fetchSpecies(id) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const pick = (code) => (j.names.find((n) => n.language.name === code) || {}).name;
      return {
        zh: pick("zh-hant") ?? null,
        ja: pick("ja") ?? pick("ja-hrkt") ?? null,
        en: pick("en") ?? null,
      };
    } catch {
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  return undefined; // signal failure (keep for retry next run)
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const ids = new Set();
  // Full National Dex (1..1025) so any Pokémon a deck might name resolves, even
  // when a card print lacks a dexId field; plus any catalog dexId beyond that.
  for (let i = 1; i <= 1025; i++) ids.add(i);
  for (const c of catalog.cards) {
    if (c.category === "Pokemon" && Array.isArray(c.dexId)) {
      for (const d of c.dexId) if (Number.isInteger(d) && d > 0) ids.add(d);
    }
  }
  const sorted = [...ids].sort((a, b) => a - b);
  const out = await loadExisting();
  const todo = sorted.filter((id) => out[id] === undefined);
  console.log(`dexIds in catalog: ${sorted.length} | already cached: ${sorted.length - todo.length} | to fetch: ${todo.length}`);

  let done = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => fetchSpecies(id)));
    batch.forEach((id, k) => {
      if (results[k] !== undefined) out[id] = results[k]; // null = no such species (kept)
    });
    done += batch.length;
    if (done % 80 === 0 || done >= todo.length) {
      await writeFile(OUT, JSON.stringify(out));
      console.log(`  ${done}/${todo.length} fetched…`);
    }
    await new Promise((res) => setTimeout(res, 20));
  }
  await writeFile(OUT, JSON.stringify(out));

  const withZh = Object.values(out).filter((v) => v && v.zh).length;
  console.log(`done. entries: ${Object.keys(out).length} | with zh-Hant: ${withZh}`);
  console.log("spot check:", [52, 6, 497, 115, 998].map((id) => `${id}=${out[id]?.zh ?? "?"}`).join("  "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
