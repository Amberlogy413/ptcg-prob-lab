/**
 * restamp_meta.mjs — re-apply fresh tournament usage to the EXISTING catalog
 * without re-crawling the 8k-card pool. The weekly auto-update runs
 * fetch_meta.mjs (fast) then this, so card popularity stays current while the
 * heavy catalog/names crawl only needs to run when a new set drops.
 *
 * Reads:  public/catalog/cards-zh-Hant.json + scripts/meta_usage.json
 * Writes: public/catalog/cards-zh-Hant.json (pop/usage/meta refreshed)
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const META = path.join(ROOT, "scripts", "meta_usage.json");

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const meta = JSON.parse(await readFile(META, "utf8"));
  const usageByName = new Map();
  meta.cards.forEach((c, i) => usageByName.set(c.zh, { rank: i + 1, pct: c.pct }));

  let stamped = 0;
  for (const c of catalog.cards) {
    delete c.pop;
    delete c.usage;
    const u = usageByName.get(c.name);
    if (u !== undefined) {
      c.pop = u.rank;
      c.usage = u.pct;
      stamped += 1;
    }
  }
  catalog.meta = {
    source: meta.meta.source,
    sampleDecks: meta.meta.sampleDecks,
    tournaments: meta.meta.tournaments,
    dateFrom: meta.meta.dateFrom,
    dateTo: meta.meta.dateTo,
  };
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`restamp: ${stamped} prints re-stamped (sample ${meta.meta.sampleDecks} decks, ${meta.meta.dateFrom}…${meta.meta.dateTo})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
