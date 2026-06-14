/**
 * strip_brackets.mjs — remove TCGdex's `<...>` owner-markup from card names in
 * the catalog (e.g. "<火箭隊的>黑暗鴉" → "火箭隊的黑暗鴉"). The brackets are an
 * upstream rendering convention, not part of the official card name. The runtime
 * also strips them on load (catalog.ts normalizeCatalog); this keeps the served
 * JSON, search keys and deck pipeline clean on disk too. Idempotent.
 *
 * Reads/Writes: public/catalog/cards-zh-Hant.json
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const strip = (s) => (typeof s === "string" ? s.replace(/[<>＜＞]/g, "") : s);

const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
let n = 0;
for (const c of catalog.cards) {
  const before = `${c.name}|${c.nameZh ?? ""}`;
  c.name = strip(c.name);
  if (c.nameZh !== undefined) c.nameZh = strip(c.nameZh);
  if (`${c.name}|${c.nameZh ?? ""}` !== before) n += 1;
}
await writeFile(CATALOG, JSON.stringify(catalog));
console.log(`stripped <> markup from ${n} card names`);
