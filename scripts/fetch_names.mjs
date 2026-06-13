/**
 * fetch_names.mjs — trilingual card-name enrichment (external tooling).
 *
 * Adds nameJa (always, from TCGdex ja — which SHARES card ids with zh-tw, so
 * it's an exact 1:1 join) and nameEn (best-effort via the same data-derived
 * bridge as fetch_meta: Pokémon dexId + verified staple table) to every card
 * in public/catalog/cards-zh-Hant.json. `name` (the canonical zh, or ja for
 * the ja-supplement sets) is left untouched so deck storage/matching is
 * stable; the UI display layer picks per locale.
 *
 * Owner-contributable: scripts/zh_overrides.json (id → zh name) fills the
 * zh gap for the newest sets TCGdex zh-tw has not published yet.
 *
 * Usage: node scripts/fetch_names.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TCGDEX_JA = "https://api.tcgdex.net/v2/ja";
const TCGDEX_EN = "https://api.tcgdex.net/v2/en";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = path.join(ROOT, "scripts", ".catalog-cache");
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");

async function getJson(url, attempt = 1) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    if (attempt >= 4) return null;
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    return getJson(url, attempt + 1);
  }
}
async function cached(prefix, base, id) {
  const file = path.join(CACHE_DIR, `${prefix}${id.replaceAll("/", "_")}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  const c = await getJson(`${base}/cards/${encodeURIComponent(id)}`);
  if (c !== null) await writeFile(file, JSON.stringify(c));
  return c;
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}
function suffixClass(name) {
  if (/VMAX$/i.test(name)) return "VMAX";
  if (/VSTAR$/i.test(name)) return "VSTAR";
  if (/^Mega |^メガ/i.test(name)) return "MEGA";
  if (/ex$/i.test(name)) return "ex";
  if (/\bV$/.test(name)) return "V";
  return "";
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const overridesPath = path.join(ROOT, "scripts", "zh_overrides.json");
  const zhOverrides = existsSync(overridesPath)
    ? JSON.parse(await readFile(overridesPath, "utf8")).map ?? {}
    : {};

  console.log(`[1/3] ja names (same-id join) for ${catalog.cards.length} cards…`);
  let jaHit = 0;
  let jaDone = 0;
  // Low concurrency + tiny delay: 8k fresh fetches otherwise rate-limit;
  // cached successes persist so re-running resumes and fills the gaps.
  await pool(catalog.cards, 4, async (c) => {
    const ja = await cached("ja_", TCGDEX_JA, c.id);
    if (ja && ja.name) {
      c.nameJa = ja.name;
      jaHit += 1;
    }
    if (++jaDone % 1000 === 0) console.log(`  ja ${jaDone}/${catalog.cards.length} (hit ${jaHit})`);
    await new Promise((r) => setTimeout(r, 12));
  });
  console.log(`  ja matched ${jaHit}/${catalog.cards.length}`);

  console.log("[2/3] en names (Pokémon dexId + staple table)…");
  const bridge = JSON.parse(await readFile(path.join(ROOT, "scripts", "name_bridge.json"), "utf8")).map;
  const enToZh = new Map(Object.entries(bridge).map(([en, zh]) => [zh, en]));
  // en card index by dexId for Pokémon reverse-lookup.
  const enBriefs = await getJson(`${TCGDEX_EN}/cards`);
  // Build dexId → en name set by sampling a few en cards per dexId (cached).
  // Cheaper: resolve per zh Pokémon name once using its dexId via en cards
  // whose name we fetch lazily. To bound cost, map dexId → most common en name.
  const enByDex = new Map();
  // Pre-pass: from the en brief list we only have names; fetch dexId for a
  // capped sample per distinct en name is too heavy. Instead reuse the
  // already-cached en_* full cards from fetch_meta/fetch_decks runs.
  const fs2 = await import("node:fs/promises");
  const files = await fs2.readdir(CACHE_DIR);
  for (const f of files) {
    if (!f.startsWith("en_")) continue;
    try {
      const c = JSON.parse(await readFile(path.join(CACHE_DIR, f), "utf8"));
      if (c.category === "Pokemon" && c.name) {
        for (const d of c.dexId ?? []) {
          if (!enByDex.has(d)) enByDex.set(d, new Map());
          const m = enByDex.get(d);
          m.set(`${suffixClass(c.name)}|${c.name}`, (m.get(`${suffixClass(c.name)}|${c.name}`) ?? 0) + 1);
        }
      }
    } catch {
      /* skip */
    }
  }
  let enHit = 0;
  for (const c of catalog.cards) {
    // staple table (zh → en) first
    if (enToZh.has(c.name)) {
      c.nameEn = enToZh.get(c.name);
      enHit += 1;
      continue;
    }
    if (c.category === "Pokemon" && c.dexId) {
      const wantSuf = suffixClass(c.name);
      let best = null;
      let bestN = 0;
      for (const d of c.dexId) {
        for (const [key, n] of enByDex.get(d) ?? []) {
          const [suf, name] = key.split("|");
          if (suf === wantSuf && n > bestN) {
            bestN = n;
            best = name;
          }
        }
      }
      if (best !== null) {
        c.nameEn = best;
        enHit += 1;
      }
    }
  }
  console.log(`  en matched ${enHit}/${catalog.cards.length} (partial; trainers limited to staples)`);

  console.log("[3/3] zh overrides + write…");
  // nameZh = the card's zh name (only when zh-native, i.e. its set is not a
  // (日) supplement); owner overrides fill the newest-set gap by id.
  let zhNative = 0;
  let overridden = 0;
  for (const c of catalog.cards) {
    const setName = catalog.sets[c.set ?? ""]?.name ?? "";
    const isJaSupplement = setName.endsWith("(日)");
    if (zhOverrides[c.id]) {
      c.nameZh = zhOverrides[c.id];
      overridden += 1;
    } else if (!isJaSupplement) {
      c.nameZh = c.name;
      zhNative += 1;
    }
    // else: no official zh yet → nameZh stays undefined (UI shows ja, marked)
  }
  catalog.trilingual = true;
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`  zh-native ${zhNative}, overrides ${overridden}; trilingual table written`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
