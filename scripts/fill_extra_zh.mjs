/**
 * fill_extra_zh.mjs — fill nameZh for non-Pokémon cards (Trainer/Energy/Stadium)
 * that the ja-sourced M-era catalog lacks a zh name for, from the curated table
 * scripts/extra_zh.json (owner authorized translating via official zh refs).
 *
 * Two passes:
 *  1) Reprint bridge: ja name → an existing card's nameZh (free, exact).
 *  2) Curated table: ja name (or base before a parenthetical subtitle) → zh.
 *
 * Reads/Writes: public/catalog/cards-zh-Hant.json
 * Reads:        scripts/extra_zh.json
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const EXTRA = path.join(ROOT, "scripts", "extra_zh.json");

const base = (s) => (s ?? "").split("(")[0].split("（")[0].trim();

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const extra = JSON.parse(await readFile(EXTRA, "utf8")).map ?? {};

  // Pass 1: reprint bridge (ja name → existing nameZh on another print).
  const jaToZh = new Map();
  for (const c of catalog.cards) {
    if (c.nameZh && c.nameJa && !jaToZh.has(c.nameJa)) jaToZh.set(c.nameJa, c.nameZh);
  }

  let bridged = 0;
  let curated = 0;
  const stillMissing = new Set();
  for (const c of catalog.cards) {
    if (c.nameZh || c.category === "Pokemon") continue;
    const ja = c.nameJa ?? c.name;
    if (jaToZh.has(ja)) {
      c.nameZh = jaToZh.get(ja);
      bridged += 1;
      continue;
    }
    const zh = extra[ja] ?? extra[base(ja)];
    if (zh !== undefined) {
      c.nameZh = zh;
      curated += 1;
      continue;
    }
    stillMissing.add(base(ja));
  }

  await writeFile(CATALOG, JSON.stringify(catalog));
  const stdMissing = catalog.cards.filter((c) => c.std && !c.nameZh);
  console.log(`reprint-bridged: ${bridged} | curated: ${curated}`);
  console.log(`std cards still missing zh: ${stdMissing.length}`);
  if (stdMissing.length > 0) {
    console.log("  names:", [...new Set(stdMissing.map((c) => c.nameJa ?? c.name))].join(" | "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
