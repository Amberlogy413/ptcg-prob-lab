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
const API_JA = "https://api.tcgdex.net/v2/ja";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = path.join(ROOT, "scripts", ".catalog-cache");
const OUT_FILE = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");

/**
 * CURRENT standard format by the OFFICIAL Asia rotation announcement
 * (asia.pokemon-card.com/tw/archives/11684): from 2026-02-06 the standard is
 * regulation marks H · I · J (G dropped; J entered 2026-01-09). We derive
 * `std` from the mark OURSELVES — the upstream `legal.standard` flag lags
 * the real rotation. Update this list (and `effective`) at each rotation.
 */
const STANDARD_MARKS = new Set(["H", "I", "J"]);
const FORMAT_META = {
  standard: ["H", "I", "J"],
  effective: "2026-02-06",
  source: "asia.pokemon-card.com 標準賽制異動公告",
};

/** Basic energies carry no useful mark and are always standard-legal. */
function isBasicEnergy(card) {
  if (card.category !== "Energy") return false;
  if (card.energyType === "Normal" || card.energyType === "Basic") return true;
  return typeof card.name === "string" && card.name.includes("基本") && card.name.includes("能量");
}

/** Recompute std/exp from the real rotation rule. */
function applyFormat(cards) {
  let std = 0;
  for (const c of cards) {
    delete c.std;
    if (isBasicEnergy(c) || (c.regulationMark !== undefined && STANDARD_MARKS.has(c.regulationMark))) {
      c.std = true;
      std += 1;
    }
  }
  console.log(`  format: standard = ${FORMAT_META.standard.join("/")} → ${std} std-legal cards`);
}

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

async function cachedCard(id, apiBase = API, prefix = "") {
  const file = path.join(CACHE_DIR, `${prefix}${id.replaceAll("/", "_")}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  const card = await fetchJson(`${apiBase}/cards/${encodeURIComponent(id)}`);
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
  // Upstream data ships empty {} attack/ability slots (stripped VSTAR powers
  // etc.) — drop entries with no name so the UI never renders blank blocks.
  for (const k of ["attacks", "abilities"]) {
    if (Array.isArray(out[k])) {
      out[k] = out[k].filter((e) => e && typeof e.name === "string" && e.name !== "");
      if (out[k].length === 0) delete out[k];
    }
  }
  return out;
}

/**
 * Cross-print sanity pass. The upstream zh-tw data contains corrupt prints
 * (an Item recorded as a Basic Pokémon, VSTARs recorded as stage VMAX,
 * Trainers filed under Energy) — and a wrong stage/category poisons the
 * EXACT mulligan math downstream (isBasic = Pokemon+Basic). Rules:
 *  1. Pokémon named …VMAX/…VSTAR get that stage (name is authoritative).
 *  2. A print whose category disagrees with the strict majority of its
 *     same-name siblings adopts the majority, taking the functional text
 *     (trainerType/effect) from the best sibling — same-name cards share
 *     rules text by the game's own rules.
 *  3. An "Energy" print whose name has no 能量 while a Trainer sibling
 *     exists is a miscategorized Trainer (covers Nest Ball/Vitality Band…).
 */
function sanityPass(cards) {
  let fixedStage = 0;
  let fixedCategory = 0;
  const byName = new Map();
  for (const c of cards) {
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push(c);
  }
  for (const [name, prints] of byName) {
    const tally = new Map();
    for (const p of prints) tally.set(p.category, (tally.get(p.category) ?? 0) + 1);
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const hasStrictMajority = ranked.length > 1 && ranked[0][1] > ranked[1][1];
    for (const p of prints) {
      if (p.category === "Pokemon") {
        if (/VMAX$/i.test(name) && p.stage !== "VMAX") {
          p.stage = "VMAX";
          fixedStage += 1;
        }
        if (/VSTAR$/i.test(name) && p.stage !== "VSTAR") {
          p.stage = "VSTAR";
          fixedStage += 1;
        }
      }
      let target = null;
      if (hasStrictMajority && p.category !== ranked[0][0] && ranked[0][1] >= 2) {
        target = ranked[0][0];
      }
      if (
        p.category === "Energy" &&
        !name.includes("能量") &&
        prints.some((q) => q.category === "Trainer")
      ) {
        target = "Trainer";
      }
      if (target === null || target === p.category) continue;
      const donor = prints
        .filter((q) => q.category === target)
        .sort((a, b) => (b.std === true ? 1 : 0) - (a.std === true ? 1 : 0))[0];
      if (donor === undefined) continue;
      p.category = target;
      for (const k of [
        "hp",
        "stage",
        "types",
        "attacks",
        "abilities",
        "weaknesses",
        "resistances",
        "retreat",
        "dexId",
        "evolveFrom",
        "energyType",
        "trainerType",
        "effect",
      ]) {
        delete p[k];
      }
      if (donor.trainerType !== undefined) p.trainerType = donor.trainerType;
      if (donor.energyType !== undefined) p.energyType = donor.energyType;
      if (donor.effect !== undefined) p.effect = donor.effect;
      fixedCategory += 1;
    }
  }
  console.log(`  sanity pass: ${fixedStage} stages, ${fixedCategory} categories corrected`);
}

/**
 * Function classifier (人性化功能分類): deterministic keyword rules over the
 * OFFICIAL zh card text — every tag is reproducible from the card's own
 * words, no judgment calls. Tags land in `fn: string[]` and drive the
 * builder's 功能 layer. Keys are stable identifiers; labels live in i18n.
 */
const FN_RULES = [
  ["search", /從(自己的)?牌庫(中|上方)?選擇|搜尋(自己的)?牌庫/],
  ["draw", /抽出|抽\d+張/],
  ["accel", /從(自己的)?(棄牌區|牌庫|手牌)[^。]{0,25}能量[^。]{0,15}附/],
  ["heal", /恢復[^。]{0,8}HP/],
  // Strict possessive — 「給對手看過後放回牌庫」 (showing your own cards) must
  // NOT count as disruption.
  ["disrupt", /對手的(手牌|牌庫)/],
  ["gust", /對手[^。]{0,15}備戰寶可夢[^。]{0,15}互換/],
  ["recover", /從(自己的)?棄牌區[^。]{0,30}(加入手牌|放回牌庫|加入牌庫)/],
  ["protect", /不會受到[^。]{0,15}(傷害|效果)|防止[^。]{0,10}傷害/],
  ["boost", /傷害[^。]{0,4}[+＋]\s*\d|[+＋]\s*\d+\s*點/],
];

function classify(card) {
  const texts = [
    card.effect ?? "",
    ...(card.attacks ?? []).map((a) => a.effect ?? ""),
    ...(card.abilities ?? []).map((a) => a.effect ?? ""),
    card.item?.effect ?? "",
  ].join("\n");
  const fn = [];
  for (const [key, re] of FN_RULES) {
    if (re.test(texts)) fn.push(key);
  }
  if (card.category === "Pokemon") {
    const maxDamage = Math.max(
      0,
      ...(card.attacks ?? []).map((a) => {
        const m = String(a.damage ?? "").match(/\d+/);
        return m ? Number(m[0]) : 0;
      }),
    );
    if (maxDamage >= 120) fn.push("attacker");
    if ((card.abilities ?? []).length > 0) fn.push("ability");
  }
  if (fn.length > 0) card.fn = fn;
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

  // 真正補完 including the newest era: the zh-tw upstream lags (max SV10,
  // 2025-05); the missing sets (M-era, regulation J) exist upstream in
  // JAPANESE. Supplement them with honest「(日)」labels — when zh-tw data
  // lands upstream, the set id collides and the zh version wins this loop.
  console.log("[3b] ja supplement for sets missing from zh-tw…");
  const zhSetIds = new Set(setBriefs.map((b) => b.id));
  const jaBriefsRaw = await fetchJson(`${API_JA}/sets`);
  const jaBriefs = [...new Map(jaBriefsRaw.map((b) => [b.id, b])).values()].filter(
    (b) => !zhSetIds.has(b.id),
  );
  const jaMissing = [];
  await pool(jaBriefs, CONCURRENCY, async (brief) => {
    const full = await fetchJson(`${API_JA}/sets/${encodeURIComponent(brief.id)}`);
    if (full === null || (full.releaseDate ?? "") < "2025-05-02") return;
    jaMissing.push(full);
  });
  jaMissing.sort((a, b) => ((a.releaseDate ?? "") < (b.releaseDate ?? "") ? -1 : 1));
  console.log(
    `  ${jaMissing.length} ja-only sets:`,
    jaMissing.map((s) => `${s.id}:${s.name}`).join(" | "),
  );
  for (const s of jaMissing) {
    sets[s.id] = {
      name: `${s.name}(日)`,
      serie: s.serie?.name ?? null,
      date: s.releaseDate ?? null,
      official: s.cardCount?.official ?? null,
    };
  }
  const jaIds = jaMissing.flatMap((s) => (s.cards ?? []).map((c) => c.id));
  let jaFetched = 0;
  await pool(jaIds, CONCURRENCY, async (id) => {
    const card = await cachedCard(id, API_JA, "ja_");
    if (card === null) return;
    cards.push(transform(card));
    jaFetched += 1;
    if (jaFetched % 200 === 0) console.log(`  ja cards ${jaFetched}/${jaIds.length}`);
  });
  console.log(`  ja supplement: ${jaFetched} cards`);

  console.log("[4/4] assemble…");
  sanityPass(cards);
  applyFormat(cards);
  for (const c of cards) classify(c);
  await applyPopularity(cards);
  const fnTally = new Map();
  for (const c of cards) for (const k of c.fn ?? []) fnTally.set(k, (fnTally.get(k) ?? 0) + 1);
  console.log(
    "  fn tags:",
    [...fnTally.entries()].map(([k, n]) => `${k}=${n}`).join(" "),
  );
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

  const newestEntry = Object.entries(sets).sort((a, b) =>
    (a[1].date ?? "") < (b[1].date ?? "") ? 1 : -1,
  )[0];
  const payload = {
    v: 1,
    lang: "zh-tw",
    source: "TCGdex (https://tcgdex.dev)",
    fetchedAt: new Date().toISOString().slice(0, 10),
    count: cards.length,
    format: FORMAT_META,
    newest: { id: newestEntry[0], name: newestEntry[1].name, date: newestEntry[1].date },
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

/**
 * Popularity ranks (揀卡熱門排前): a curated seed list of current staples,
 * then Trainer/Energy names ranked by REPRINT COUNT — an honest, fully
 * data-derived proxy (cards reprinted 10+ times are staples by definition)
 * until the Phase 11 tournament pipeline replaces it. The UI labels the
 * source. Rank is stamped as `pop` on every print of a ranked name.
 */
async function applyPopularity(cards) {
  const seedPath = path.join(ROOT, "scripts", "popularity_seed.json");
  const seed = JSON.parse(await readFile(seedPath, "utf8"));
  const baseName = (n) => n.split("(")[0].split("(")[0].trim();
  const rankByBase = new Map(seed.names.map((n, i) => [n, i + 1]));

  const reprints = new Map();
  for (const c of cards) {
    if (c.category === "Pokemon") continue;
    const b = baseName(c.name);
    if (rankByBase.has(b)) continue;
    reprints.set(b, (reprints.get(b) ?? 0) + 1);
  }
  const proxy = [...reprints.entries()]
    .filter(([, n]) => n >= 4)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  let next = seed.names.length + 1;
  for (const [b] of proxy) rankByBase.set(b, next++);

  let stamped = 0;
  for (const c of cards) {
    const r = rankByBase.get(baseName(c.name));
    if (r !== undefined) {
      c.pop = r;
      stamped += 1;
    }
  }
  console.log(`  popularity: ${rankByBase.size} ranked names → ${stamped} prints stamped`);
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
