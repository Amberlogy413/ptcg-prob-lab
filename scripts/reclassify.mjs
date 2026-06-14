/**
 * reclassify.mjs — re-run the 寶可夢功能 classifier over the EXISTING catalog
 * (no re-crawl) so refined fn/fnSub rules apply immediately. The card text the
 * classifier reads is already in the catalog JSON.
 *
 * Reads/Writes: public/catalog/cards-zh-Hant.json
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify, SUB_RULES } from "./classify.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const fnCounts = {};
  const subCounts = {};
  let withFn = 0;
  let withSub = 0;
  for (const c of catalog.cards) {
    classify(c);
    if (c.fn) {
      withFn += 1;
      for (const k of c.fn) fnCounts[k] = (fnCounts[k] ?? 0) + 1;
    }
    if (c.fnSub) {
      withSub += 1;
      for (const k of c.fnSub) subCounts[k] = (subCounts[k] ?? 0) + 1;
    }
  }
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`reclassified ${catalog.cards.length} cards | with fn: ${withFn} | with fnSub: ${withSub}`);
  console.log("fn:", JSON.stringify(fnCounts));
  console.log("fnSub (of", SUB_RULES.length, "rules):", JSON.stringify(subCounts));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
