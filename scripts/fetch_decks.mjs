/**
 * fetch_decks.mjs — REAL archetype deck recommendations (external tooling).
 * NO GUESSING: every deck is a real tournament decklist; the archetype label
 * is Limitless's own classification (standings deck.id / name / icons).
 *
 * Source: Limitless TCG public API — finished STANDARD tournaments with
 * public decklists. Decks are grouped by archetype; within each archetype we
 * keep DISTINCT builds ranked by an objective real proxy of significance:
 * field size → recency → placing. (Official event tiers — Worlds / Regional /
 * League / store — are NOT exposed by the open API, so we rank by the factual
 * signals we have and label them honestly rather than invent a tier.)
 *
 * Each card is resolved to its zh-tw name + isBasic + section via the catalog
 * (Pokémon by dexId, staples by the verified name_bridge) with a TCGdex-en
 * fallback; the math only needs count + isBasic, which we always supply.
 *
 * Out: public/catalog/decks-zh-Hant.json
 * Usage: node scripts/fetch_decks.mjs [--since YYYY-MM-DD] [--max-tournaments N]
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMITLESS = "https://play.limitlesstcg.com/api";
const TCGDEX_EN = "https://api.tcgdex.net/v2/en";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = path.join(ROOT, "scripts", ".catalog-cache");
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const OUT = path.join(ROOT, "public", "catalog", "decks-zh-Hant.json");

const args = process.argv.slice(2);
const argVal = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : d;
};
const SINCE = argVal("--since", "2026-02-06");
const TODAY = argVal("--today", "2026-06-13");
const MAX_T = Number(argVal("--max-tournaments", "80"));
const MIN_PLAYERS = Number(argVal("--min-players", "16"));
const MAX_ARCH = 28;
const MAX_BUILDS = 5;

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
async function cachedEnCard(id) {
  const file = path.join(CACHE_DIR, `en_${id.replaceAll("/", "_")}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  const c = await getJson(`${TCGDEX_EN}/cards/${encodeURIComponent(id)}`);
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

  console.log(`[1/5] tournaments (STANDARD, ${SINCE}…${TODAY})…`);
  const all = await getJson(`${LIMITLESS}/tournaments?game=PTCG&format=standard&limit=400`);
  const cands = all
    .filter((t) => {
      const d = t.date.slice(0, 10);
      return d >= SINCE && d <= TODAY && (t.players ?? 0) >= MIN_PLAYERS;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_T);
  console.log(`  ${cands.length} tournaments`);

  console.log("[2/5] standings → archetype-tagged decklists…");
  const onlineById = new Map();
  // archetype id → { name, icons, decks: [{cards, players, date, online, placing, event}] }
  const arch = new Map();
  let totalDecks = 0;
  for (const t of cands) {
    const det = await getJson(`${LIMITLESS}/tournaments/${t.id}/details`);
    const online = det?.isOnline ?? false;
    onlineById.set(t.id, online);
    const st = await getJson(`${LIMITLESS}/tournaments/${t.id}/standings`);
    if (st === null) continue;
    for (const s of st) {
      if (!s.decklist || !(s.decklist.pokemon || s.decklist.trainer)) continue;
      const a = s.deck && s.deck.id ? s.deck : { id: "other", name: "Other", icons: [] };
      let e = arch.get(a.id);
      if (e === undefined) {
        e = { name: a.name ?? a.id, icons: a.icons ?? [], decks: [] };
        arch.set(a.id, e);
      }
      e.decks.push({
        decklist: s.decklist,
        players: t.players ?? 0,
        date: t.date.slice(0, 10),
        online,
        placing: s.placing ?? null,
        event: t.name,
      });
      totalDecks += 1;
    }
  }
  arch.delete("other");
  console.log(`  ${totalDecks} decks across ${arch.size} archetypes`);

  console.log("[3/5] card resolver (catalog + verified table + en fallback)…");
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const bridge = JSON.parse(await readFile(path.join(ROOT, "scripts", "name_bridge.json"), "utf8")).map;
  // zh index for Pokémon dexId bridge + name set.
  const zhByDex = new Map(); // dexId → [{name, std, suf, native}]
  const zhNames = new Set();
  for (const c of catalog.cards) {
    zhNames.add(c.name);
    if (c.category === "Pokemon") {
      for (const d of c.dexId ?? []) {
        if (!zhByDex.has(d)) zhByDex.set(d, []);
        zhByDex.get(d).push({
          name: c.name,
          std: c.std === true,
          suf: suffixClass(c.name),
          native: /[ぁ-んァ-ヶ]/.test(c.name) ? 0 : 1,
        });
      }
    }
  }
  const enBriefs = await getJson(`${TCGDEX_EN}/cards`);
  const enIdsByName = new Map();
  for (const c of enBriefs) {
    if (!enIdsByName.has(c.name)) enIdsByName.set(c.name, []);
    enIdsByName.get(c.name).push(c.id);
  }

  // Every distinct EN card name across all kept decks → resolve once.
  const distinct = new Set();
  for (const e of arch.values())
    for (const d of e.decks)
      for (const sec of ["pokemon", "trainer", "energy"])
        for (const c of d.decklist[sec] ?? []) distinct.add(c.name);
  const resolved = new Map(); // enName → { name(zh|en), isBasic, section }
  await pool([...distinct], 6, async (enName) => {
    // verified staple table first
    if (bridge[enName] !== undefined && zhNames.has(bridge[enName])) {
      const isEnergy = bridge[enName].includes("能量");
      resolved.set(enName, {
        name: bridge[enName],
        isBasic: false,
        section: isEnergy ? "energy" : "trainer",
      });
      return;
    }
    const ids = (enIdsByName.get(enName) ?? []).slice(0, 10);
    const enIllus = new Set();
    const enDex = new Set();
    let cat = null;
    let basicStage = false;
    for (const id of ids) {
      const c = await cachedEnCard(id);
      if (c === null) continue;
      if (c.illustrator) enIllus.add(c.illustrator);
      for (const d of c.dexId ?? []) enDex.add(d);
      if (cat === null && c.category) cat = c.category;
      if (c.stage === "Basic") basicStage = true;
    }
    const section = cat === "Pokemon" ? "pokemon" : cat === "Energy" ? "energy" : cat === "Trainer" ? "trainer" : "unknown";
    const isBasic = cat === "Pokemon" && basicStage;
    // Pokémon zh by dexId + suffix + native preference.
    let zh = enName;
    if (cat === "Pokemon" && enDex.size > 0) {
      const enSuf = suffixClass(enName);
      const cands2 = [];
      for (const d of enDex) for (const z of zhByDex.get(d) ?? []) cands2.push(z);
      cands2.sort(
        (a, b) =>
          (b.suf === enSuf ? 1 : 0) - (a.suf === enSuf ? 1 : 0) ||
          b.native - a.native ||
          (b.std ? 1 : 0) - (a.std ? 1 : 0),
      );
      if (cands2[0] !== undefined) zh = cands2[0].name;
    }
    resolved.set(enName, { name: zh, isBasic, section });
  });
  console.log(`  resolved ${resolved.size} distinct card names`);

  console.log("[4/5] dedupe builds + rank…");
  // significance score: field size dominates, recency next, placing bonus.
  const tierWeight = (players) => (players >= 128 ? 3 : players >= 64 ? 2 : players >= 32 ? 1 : 0);
  const deckScore = (d) =>
    tierWeight(d.players) * 1e8 + new Date(d.date + "T00:00:00Z").getTime() / 1e5 + (d.placing != null ? 1000 - d.placing : 0);

  const buildCards = (decklist) => {
    const out = [];
    for (const sec of ["pokemon", "trainer", "energy"]) {
      for (const c of decklist[sec] ?? []) {
        const r = resolved.get(c.name) ?? { name: c.name, isBasic: false, section: sec };
        out.push({ count: c.count, name: r.name, isBasic: r.isBasic, section: r.section });
      }
    }
    return out;
  };
  const hashOf = (cards) =>
    cards
      .map((c) => `${c.count}|${c.name}`)
      .sort()
      .join(",");

  const archetypes = [];
  for (const [id, e] of arch) {
    const seen = new Set();
    const builds = [];
    for (const d of e.decks.sort((a, b) => deckScore(b) - deckScore(a))) {
      const cards = buildCards(d.decklist);
      const total = cards.reduce((s, c) => s + c.count, 0);
      if (total < 55 || total > 65) continue; // skip malformed/partial lists
      const h = hashOf(cards);
      if (seen.has(h)) continue;
      seen.add(h);
      builds.push({
        event: d.event,
        date: d.date,
        players: d.players,
        online: d.online,
        placing: d.placing,
        total,
        cards,
      });
      if (builds.length >= MAX_BUILDS) break;
    }
    if (builds.length === 0) continue;
    // carry Pokémon (icons) → zh via dexId-resolved deck names is hard from a
    // slug; instead use the archetype's most-common Pokémon names resolved.
    const carry = (e.icons ?? []).slice(0, 3);
    archetypes.push({
      id,
      name: e.name,
      icons: carry,
      deckCount: e.decks.length,
      score: e.decks.reduce((s, d) => s + tierWeight(d.players) + 1, 0),
      builds,
    });
  }
  archetypes.sort((a, b) => b.score - a.score);
  const top = archetypes.slice(0, MAX_ARCH);

  console.log("[5/5] write decks-zh-Hant.json…");
  const dates = [...arch.values()].flatMap((e) => e.decks.map((d) => d.date));
  const payload = {
    v: 1,
    source: "Limitless TCG tournament decklists (play.limitlesstcg.com)",
    note: "Archetype labels are Limitless's own classification. Ranked by field size → recency → placing (official event tiers are not exposed by the open API).",
    generatedFor: TODAY,
    format: "H/I/J",
    sampleDecks: totalDecks,
    tournaments: cands.length,
    dateFrom: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
    dateTo: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    archetypes: top,
  };
  await writeFile(OUT, JSON.stringify(payload));
  console.log(`OK → ${OUT}  (${top.length} archetypes)`);
  console.log("  top:", top.slice(0, 8).map((a) => `${a.name}(${a.deckCount})`).join(" · "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
