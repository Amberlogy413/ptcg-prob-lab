/**
 * apply_name_corrections.mjs — patch the catalog's card names to the OFFICIAL
 * zh-Hant where a wrong/guessed translation slipped in (owner-flagged 2026-06-17,
 * web-verified vs asia.pokemon-card.com + Bulbapedia). Keyed by the FULL wrong
 * name so a substring (e.g. 米可利 = Wallace) is never mis-touched. Idempotent;
 * re-run after any fresh catalog crawl (add to the manual refresh chain).
 *
 * Reads/writes: public/catalog/cards-zh-Hant.json, scripts/name_corrections.json
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const CORRECTIONS = path.join(ROOT, "scripts", "name_corrections.json");

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const map = JSON.parse(await readFile(CORRECTIONS, "utf8")).map ?? {};
  let nameZhFixed = 0;
  let nameFixed = 0;
  const hit = {};
  for (const c of catalog.cards) {
    if (c.nameZh !== undefined && map[c.nameZh] !== undefined) {
      hit[c.nameZh] = (hit[c.nameZh] ?? 0) + 1;
      c.nameZh = map[c.nameZh];
      nameZhFixed += 1;
    }
    if (map[c.name] !== undefined) {
      c.name = map[c.name];
      nameFixed += 1;
    }
  }
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`name corrections applied: nameZh ${nameZhFixed}, name ${nameFixed} prints`);
  for (const [wrong, correct] of Object.entries(map)) {
    console.log(`  ${wrong} -> ${correct}  (${hit[wrong] ?? 0} catalog prints)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
