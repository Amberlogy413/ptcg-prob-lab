/**
 * fill_zh_names.mjs — give every Pokémon card a real Traditional-Chinese name.
 *
 * Owner request 2026-06-14: selecting 繁中 must show Chinese, not Japanese.
 * Newest ja-supplemented sets ship without a zh card name, so we synthesize it
 * from the OFFICIAL zh-Hant species name (scripts/dex_names.json, from PokéAPI)
 * plus the official naming conventions for affixes — NOT guessing:
 *   - Mega:      超級 prefix          (メガ / Mega)
 *   - Regional:  阿羅拉/伽勒爾/洗翠/帕底亞 (アローラ/ガラル/ヒスイ/パルデア)
 *   - Suffix:    ex / V / VMAX / VSTAR / V-UNION  (kept verbatim, EX→ex)
 *
 * Only FILLS cards missing nameZh (never overwrites verified zh data) and only
 * Pokémon with a dexId. Cards we can't resolve keep the honest ja/en fallback.
 *
 * Reads/Writes: public/catalog/cards-zh-Hant.json
 * Reads:        scripts/dex_names.json
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const DEX = path.join(ROOT, "scripts", "dex_names.json");

const REGION = [
  { ja: "アローラ", en: "Alolan", enAlt: "Alola", zh: "阿羅拉" },
  { ja: "ガラル", en: "Galarian", enAlt: "Galar", zh: "伽勒爾" },
  { ja: "ヒスイ", en: "Hisuian", enAlt: "Hisui", zh: "洗翠" },
  { ja: "パルデア", en: "Paldean", enAlt: "Paldea", zh: "帕底亞" },
];
// Longest-first so VMAX/VSTAR win over a bare V.
const SUFFIX = ["V-UNION", "VMAX", "VSTAR", "ex", "EX", "V"];

// Verified official base names for the few cards TCGdex ships without a dexId
// (keyed by a ja species token found in the card name). Real names, not guesses.
const MANUAL_BASE = [{ ja: "ユキノオー", zh: "暴雪王" }];

function affixes(card) {
  const ja = card.nameJa ?? card.name ?? "";
  const en = card.nameEn ?? "";
  let prefix = "";
  const isMega = ja.startsWith("メガ") || /^mega\b/i.test(en);
  for (const r of REGION) {
    if (ja.includes(r.ja) || en.includes(r.en) || en.includes(r.enAlt)) {
      prefix = r.zh;
      break;
    }
  }
  if (isMega) prefix = "超級" + prefix;

  let suffix = "";
  for (const s of SUFFIX) {
    const tail = s === "EX" ? "ex" : s;
    if (ja.endsWith(s) || en.endsWith(` ${s}`) || en.endsWith(s)) {
      suffix = tail;
      break;
    }
  }
  return { prefix, suffix };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const dex = JSON.parse(await readFile(DEX, "utf8"));

  let filled = 0;
  let skippedNoBase = 0;
  const samples = [];
  for (const c of catalog.cards) {
    if (c.category !== "Pokemon") continue;
    if (c.nameZh) continue;
    const id = Array.isArray(c.dexId) ? c.dexId[0] : undefined;
    let base = id !== undefined ? dex[id]?.zh : undefined;
    if (!base) {
      const ja = c.nameJa ?? c.name ?? "";
      base = MANUAL_BASE.find((m) => ja.includes(m.ja))?.zh;
    }
    if (!base) {
      skippedNoBase += 1;
      continue;
    }
    const { prefix, suffix } = affixes(c);
    c.nameZh = `${prefix}${base}${suffix}`;
    filled += 1;
    if (samples.length < 24 && (prefix || suffix)) {
      samples.push(`${c.nameJa ?? c.name} → ${c.nameZh}`);
    }
  }

  const totalPk = catalog.cards.filter((c) => c.category === "Pokemon").length;
  const stillNoZh = catalog.cards.filter((c) => c.category === "Pokemon" && !c.nameZh).length;
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`filled ${filled} Pokémon zh names | skipped (no dex base): ${skippedNoBase}`);
  console.log(`Pokémon total ${totalPk} | still missing zh: ${stillNoZh}`);
  console.log("affix samples:\n  " + samples.join("\n  "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
