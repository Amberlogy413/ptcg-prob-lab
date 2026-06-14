/**
 * embed_en_zh.mjs — add an English-species → zh map to the catalog so deck rows
 * that were saved with an English Pokémon name (e.g. "Dragapult ex") can be
 * localized at runtime even when that card has no nameEn field. Source is the
 * official dex (scripts/dex_names.json, from PokéAPI). Real data, no guessing.
 *
 * Writes catalog.dexEnZh = { "dragapult": "多龍巴魯托", ... }  (lowercased en key)
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const DEX = path.join(ROOT, "scripts", "dex_names.json");
const BRIDGE = path.join(ROOT, "scripts", "name_bridge.json");

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const dex = JSON.parse(await readFile(DEX, "utf8"));
  const map = {};
  for (const v of Object.values(dex)) {
    if (v && v.en && v.zh) map[v.en.toLowerCase()] = v.zh;
  }
  catalog.dexEnZh = map;

  // Verified Trainer/Energy staple translations (unambiguous only). Decklists
  // call basic energies "Fire Energy" (no "Basic"), so alias that form too.
  const bridge = JSON.parse(await readFile(BRIDGE, "utf8")).map ?? {};
  const tr = {};
  for (const [en, zh] of Object.entries(bridge)) {
    tr[en.toLowerCase()] = zh;
    const m = /^basic (.+ energy)$/i.exec(en);
    if (m) tr[m[1].toLowerCase()] = zh; // "Basic Fire Energy" -> also "fire energy"
  }
  catalog.trainerEnZh = tr;

  // Evolution links (dexId → pre-evolution dexId) for evolution-family grouping
  // in the deck workshop. Official PokéAPI data.
  const evo = {};
  for (const [id, v] of Object.entries(dex)) {
    if (v && typeof v.from === "number") evo[id] = v.from;
  }
  catalog.dexEvolvesFrom = evo;

  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`embedded dexEnZh: ${Object.keys(map).length} species; trainerEnZh: ${Object.keys(tr).length} staples; dexEvolvesFrom: ${Object.keys(evo).length} links`);
  console.log(`  sample: dragapult=${map["dragapult"]}, charizard=${map["charizard"]}, fire energy=${tr["fire energy"]}, ultra ball=${tr["ultra ball"]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
