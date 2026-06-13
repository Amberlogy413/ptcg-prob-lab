/**
 * fetch_meta.mjs — REAL tournament popularity (external tooling, not a
 * runtime dependency). NO GUESSING: every number here is a verifiable
 * statistic computed from public tournament decklists.
 *
 * Source: Limitless TCG public API (play.limitlesstcg.com/api) — finished
 * STANDARD tournaments with public decklists. We compute each card's
 * inclusion rate = (decks containing it) / (total decks sampled).
 *
 * The decklists are English; the catalog is Traditional Chinese. The bridge
 * is data-derived, not hand-typed: the SAME physical card shares its
 * illustrator across JP/international prints, so we pair an English card name
 * to a zh-tw card name by ILLUSTRATOR-SET OVERLAP (with category + Pokédex id
 * agreement), using TCGdex as the card database. Unmatched names get NO rank
 * (we never invent one).
 *
 * Out: scripts/meta_usage.json  { meta, cards: [{ zh, en, pct, decks }] }
 * Usage: node scripts/fetch_meta.mjs [--since YYYY-MM-DD] [--max-tournaments N]
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
const OUT = path.join(ROOT, "scripts", "meta_usage.json");

const args = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
// Post-rotation window by default: current standard = H/I/J from 2026-02-06.
const SINCE = argVal("--since", "2026-02-06");
const MAX_T = Number(argVal("--max-tournaments", "60"));
const TODAY = argVal("--today", "2026-06-13");

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
  const card = await getJson(`${TCGDEX_EN}/cards/${encodeURIComponent(id)}`);
  if (card !== null) await writeFile(file, JSON.stringify(card));
  return card;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  console.log(`[1/4] tournaments (STANDARD, ${SINCE}…${TODAY}, decklists)…`);
  const all = await getJson(`${LIMITLESS}/tournaments?game=PTCG&format=standard&limit=300`);
  const candidates = all
    .filter((t) => {
      const d = t.date.slice(0, 10);
      return d >= SINCE && d <= TODAY && (t.players ?? 0) >= 16;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_T);
  console.log(`  ${candidates.length} candidate tournaments`);

  console.log("[2/4] decklists → real inclusion counts…");
  let decks = 0;
  let usedT = 0;
  let dateFrom = "9999";
  let dateTo = "0000";
  // EN name → { decks, prints: Map(set|number → count) }
  const incl = new Map();
  for (const t of candidates) {
    const st = await getJson(`${LIMITLESS}/tournaments/${t.id}/standings`);
    if (st === null) continue;
    const lists = st.filter((s) => s.decklist && (s.decklist.pokemon || s.decklist.trainer));
    if (lists.length === 0) continue;
    usedT += 1;
    const d = t.date.slice(0, 10);
    if (d < dateFrom) dateFrom = d;
    if (d > dateTo) dateTo = d;
    for (const s of lists) {
      decks += 1;
      const seen = new Map(); // name → {set, number, category}
      for (const cat of ["pokemon", "trainer", "energy"]) {
        for (const c of s.decklist[cat] ?? []) {
          if (!seen.has(c.name)) seen.set(c.name, { set: c.set, number: c.number, category: cat });
        }
      }
      for (const [name, info] of seen) {
        const e = incl.get(name) ?? { decks: 0, category: info.category };
        e.decks += 1;
        incl.set(name, e);
      }
    }
  }
  console.log(`  ${usedT} tournaments, ${decks} decks, ${incl.size} distinct cards (${dateFrom}…${dateTo})`);

  // Keep cards seen in >=1% of decks — the meaningful meta (drops 1-off techs).
  const minDecks = Math.max(2, Math.ceil(decks * 0.01));
  const ranked = [...incl.entries()]
    .filter(([, e]) => e.decks >= minDecks)
    .sort((a, b) => b[1].decks - a[1].decks);
  console.log(`  ${ranked.length} cards above the ${minDecks}-deck floor (~1%)`);

  console.log("[3/4] data-derived EN→zh bridge (illustrator overlap)…");
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  // zh index: name → { illus:Set, dex:Set, categories:Set }
  const zhByName = new Map();
  for (const c of catalog.cards) {
    let e = zhByName.get(c.name);
    if (e === undefined) {
      e = { illus: new Set(), dex: new Set(), cats: new Set() };
      zhByName.set(c.name, e);
    }
    if (c.illustrator) e.illus.add(c.illustrator);
    for (const d of c.dexId ?? []) e.dex.add(d);
    e.cats.add(c.category);
  }
  const enBriefs = await getJson(`${TCGDEX_EN}/cards`);
  const enIdsByName = new Map();
  for (const c of enBriefs) {
    if (!enIdsByName.has(c.name)) enIdsByName.set(c.name, []);
    enIdsByName.get(c.name).push(c.id);
  }

  // Verified Trainer/Energy translation table (existence-checked below).
  const bridge = JSON.parse(await readFile(path.join(ROOT, "scripts", "name_bridge.json"), "utf8")).map;
  const zhNameSet = new Set(zhByName.keys());

  const CAT_EN = { Pokemon: "pokemon", Trainer: "trainer", Energy: "energy" };
  const out = [];
  let matchedDex = 0;
  let matchedTable = 0;
  let dropped = 0;
  await pool(ranked, 6, async ([enName, info]) => {
    const row = { zh: null, en: enName, decks: info.decks, pct: round1((info.decks / decks) * 100) };

    // 1) Verified explicit table wins (factual translation, existence-checked).
    const mapped = bridge[enName];
    if (mapped !== undefined) {
      if (zhNameSet.has(mapped)) {
        row.zh = mapped;
        matchedTable += 1;
        out.push(row);
      } else {
        console.log(`  ! table entry not in catalog, dropped: ${enName} → ${mapped}`);
        dropped += 1;
      }
      return;
    }

    // 2) Pokémon ONLY auto-bridge: dexId MUST overlap AND ≥1 shared
    // illustrator, winner strictly unambiguous. (Illustrator overlap is too
    // noisy for non-Pokémon, so those are left to the table above — no guess.)
    const ids = (enIdsByName.get(enName) ?? []).slice(0, 12);
    const enIllus = new Set();
    const enDex = new Set();
    let enCat = null;
    for (const id of ids) {
      const c = await cachedEnCard(id);
      if (c === null) continue;
      if (c.illustrator) enIllus.add(c.illustrator);
      for (const d of c.dexId ?? []) enDex.add(d);
      if (enCat === null && c.category) enCat = CAT_EN[c.category] ?? null;
    }
    if (enCat !== "pokemon" || enDex.size === 0) {
      dropped += 1;
      return;
    }
    const enSuf = suffixClass(enName);
    const scored = [];
    for (const [zhName, z] of zhByName) {
      if (!z.cats.has("Pokemon")) continue;
      let dexHit = false;
      for (const d of enDex) if (z.dex.has(d)) dexHit = true;
      if (!dexHit) continue;
      let overlap = 0;
      for (const a of enIllus) if (z.illus.has(a)) overlap += 1;
      if (overlap < 1) continue;
      const native = /[ぁ-んァ-ヶ]/.test(zhName) ? 0 : 1;
      // ex/V/VMAX/VSTAR/MEGA must agree so "Latias ex" lands on 拉帝亞斯ex,
      // not the base 拉帝亞斯.
      const sufMatch = suffixClass(zhName) === enSuf ? 1 : 0;
      scored.push({ zhName, native, sufMatch, overlap });
    }
    if (scored.length === 0) {
      dropped += 1;
      return;
    }
    scored.sort((a, b) => b.sufMatch - a.sufMatch || b.native - a.native || b.overlap - a.overlap);
    const top = scored[0];
    const runner = scored[1];
    if (
      runner !== undefined &&
      runner.sufMatch === top.sufMatch &&
      runner.native === top.native &&
      runner.overlap === top.overlap
    ) {
      dropped += 1; // ambiguous tie → no guess
      return;
    }
    row.zh = top.zhName;
    matchedDex += 1;
    out.push(row);
  });
  const matched = matchedDex + matchedTable;
  console.log(
    `  matched ${matched} (${matchedDex} Pokémon by dexId, ${matchedTable} staples by verified table); dropped ${dropped} — no guess made`,
  );

  // Dedupe: if two EN names map to the same zh name, keep the higher usage.
  const byZh = new Map();
  for (const r of out) {
    const prev = byZh.get(r.zh);
    if (prev === undefined || r.decks > prev.decks) byZh.set(r.zh, r);
  }
  const cards = [...byZh.values()].sort((a, b) => b.decks - a.decks);

  console.log(
    `  matched ${matched}/${ranked.length} EN names → ${cards.length} distinct zh cards`,
  );

  console.log("[4/4] write meta_usage.json…");
  const payload = {
    meta: {
      source: "Limitless TCG tournament decklists (play.limitlesstcg.com)",
      format: "STANDARD",
      sampleDecks: decks,
      tournaments: usedT,
      dateFrom,
      dateTo,
      matchedNames: matched,
      rankedNames: ranked.length,
      generatedFor: TODAY,
    },
    cards,
  };
  await writeFile(OUT, JSON.stringify(payload, null, 1) + "\n");
  console.log(`OK → ${OUT}`);
  console.log("  top 12:", cards.slice(0, 12).map((c) => `${c.zh} ${c.pct}%`).join(" · "));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** ex / V / VMAX / VSTAR / MEGA class shared by EN and zh/ja card names. */
function suffixClass(name) {
  if (/VMAX$/i.test(name)) return "VMAX";
  if (/VSTAR$/i.test(name)) return "VSTAR";
  if (/^Mega |^メガ/i.test(name)) return "MEGA";
  if (/ex$/i.test(name)) return "ex";
  if (/\bV$/.test(name)) return "V";
  return "";
}
function round1(x) {
  return Math.round(x * 10) / 10;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
