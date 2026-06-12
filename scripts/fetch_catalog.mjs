/**
 * fetch_catalog.mjs — one-shot data pipeline (external tooling, NOT a runtime
 * dependency): crawls the TCGdex community database (https://tcgdex.dev) for
 * the full Traditional Chinese (zh-tw, Asia numbering) card pool and emits
 * public/catalog/cards-zh-Hant.json for the in-app card picker.
 *
 * IP rule (CLAUDE.md #6): TEXT ONLY. Image URLs, pricing, and variant data
 * are stripped here, at the source, so they can never reach the bundle.
 *
 * Usage:  node scripts/fetch_catalog.mjs [--limit N] [--concurrency N]
 * Re-runs are incremental: card responses are cached in scripts/.catalog-cache/.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.tcgdex.net/v2/zh-tw";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = path.join(ROOT, "scripts", ".catalog-cache");
const OUT_FILE = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");

const args = process.argv.slice(2);
function argNum(flag, fallback) {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) return fallback;
  const n = Number(args[i + 1]);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}
const LIMIT = argNum("--limit", Infinity);
const CONCURRENCY = argNum("--concurrency", 8);

/** Fields we deliberately DROP (IP rule / out of scope). */
const DROP = new Set([
  "image",
  "pricing",
  "variants",
  "variants_detailed",
  "boosters",
  "updated",
]);
/** Fields we keep verbatim (factual card text/data). */
const KEEP = new Set([
  "id",
  "localId",
  "name",
  "category",
  "stage",
  "suffix",
  "evolveFrom",
  "hp",
  "types",
  "attacks",
  "abilities",
  "weaknesses",
  "resistances",
  "retreat",
  "effect",
  "trainerType",
  "energyType",
  "regulationMark",
  "legal",
  "rarity",
  "illustrator",
  "dexId",
  "description",
  "set",
  "item",
]);

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "ptcg-prob-lab catalog pipeline" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw new Error(`${url}: ${err.message}`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return fetchJson(url, attempt + 1);
  }
}

async function cachedCard(id) {
  const file = path.join(CACHE_DIR, `${id.replaceAll("/", "_")}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  const card = await fetchJson(`${API}/cards/${encodeURIComponent(id)}`);
  if (card !== null) await writeFile(file, JSON.stringify(card));
  return card;
}

/** Strip to text-only facts; warn once about fields we have never triaged. */
const unknownFields = new Set();
function transform(card) {
  const out = {};
  for (const [key, value] of Object.entries(card)) {
    if (DROP.has(key)) continue;
    if (!KEEP.has(key)) {
      unknownFields.add(key);
      continue;
    }
    if (key === "set") continue; // re-attached as the set id below
    if (key === "legal") {
      if (value?.standard) out.std = true;
      if (value?.expanded) out.exp = true;
      continue;
    }
    out[key] = value;
  }
  out.set = card.set?.id ?? null;
  return out;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_FILE), { recursive: true });

  console.log("[1/4] set index…");
  const setBriefsRaw = await fetchJson(`${API}/sets`);
  // The zh-tw index contains duplicate ids (e.g. "sv1a" ×8) and ids that
  // differ only by case ("SV1a" vs "sv1a") — dedupe, and key the map by the
  // INDEX id, because that's what card.set.id points at.
  const setBriefs = [...new Map(setBriefsRaw.map((b) => [b.id, b])).values()];
  const sets = {};
  let done = 0;
  await pool(setBriefs, CONCURRENCY, async (brief) => {
    const full = await fetchJson(`${API}/sets/${encodeURIComponent(brief.id)}`);
    if (full === null) return;
    sets[brief.id] = {
      name: full.name,
      serie: full.serie?.name ?? null,
      date: full.releaseDate ?? null,
      official: full.cardCount?.official ?? null,
    };
    done += 1;
    if (done % 25 === 0) console.log(`  sets ${done}/${setBriefs.length}`);
  });
  console.log(`  ${Object.keys(sets).length} sets`);

  console.log("[2/4] card brief index…");
  const briefs = await fetchJson(`${API}/cards`);
  const ids = briefs.map((b) => b.id).slice(0, LIMIT);
  console.log(`  ${ids.length} cards to fetch (cache: ${CACHE_DIR})`);

  console.log("[3/4] card details…");
  const cards = [];
  let fetched = 0;
  let missing = 0;
  await pool(ids, CONCURRENCY, async (id) => {
    const card = await cachedCard(id);
    if (card === null) {
      missing += 1;
      return;
    }
    cards.push(transform(card));
    fetched += 1;
    if (fetched % 500 === 0) console.log(`  cards ${fetched}/${ids.length}`);
  });

  console.log("[4/4] assemble…");
  // Deterministic order: set release date, then set id, then numeric localId.
  cards.sort((a, b) => {
    const da = sets[a.set]?.date ?? "";
    const db = sets[b.set]?.date ?? "";
    if (da !== db) return da < db ? -1 : 1;
    if (a.set !== b.set) return a.set < b.set ? -1 : 1;
    const na = parseInt(a.localId, 10);
    const nb = parseInt(b.localId, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.localId) < String(b.localId) ? -1 : 1;
  });

  const payload = {
    v: 1,
    lang: "zh-tw",
    source: "TCGdex (https://tcgdex.dev)",
    fetchedAt: new Date().toISOString().slice(0, 10),
    count: cards.length,
    sets,
    cards,
  };
  const json = JSON.stringify(payload);
  await writeFile(OUT_FILE, json);

  if (json.includes("assets.tcgdex.net") || json.includes('"pricing"')) {
    console.error("FAIL: image/pricing data leaked into the output");
    process.exit(1);
  }
  console.log(`OK: ${cards.length} cards (${missing} missing) → ${OUT_FILE}`);
  console.log(`    size ${(json.length / 1024 / 1024).toFixed(2)} MB raw`);
  if (unknownFields.size > 0) {
    console.log(`    untriaged fields skipped: ${[...unknownFields].join(", ")}`);
  }
}

/** Tiny promise pool: run fn over items with at most n in flight. */
async function pool(items, n, fn) {
  let next = 0;
  const failures = [];
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (err) {
        failures.push(`${err.message}`);
      }
    }
  });
  await Promise.all(workers);
  if (failures.length > 0) {
    console.error(`  ${failures.length} failures, first: ${failures[0]}`);
    if (failures.length > items.length * 0.01) {
      throw new Error("more than 1% of requests failed — aborting");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
