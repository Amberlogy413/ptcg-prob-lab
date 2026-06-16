/**
 * relocalize_decks.mjs — make every card name in the deck-recommendation data
 * clean zh-Hant, with NO guessing.
 *
 * The Limitless source is English; older zh card prints carry TCGdex's `<...>`
 * markup for trainer-owner Pokémon (e.g. "<火箭隊的>黑暗鴉"). This pass rewrites
 * public/catalog/decks-zh-Hant.json card lines to clean official zh:
 *   - Pokémon: parse name (zh / ja / en), resolve the SPECIES via the official
 *     dex (scripts/dex_names.json), reattach affixes (超級 / 阿羅拉… / ex / V…)
 *     and possessive owner (火箭隊的 / 竹蘭的 / N之…). Species-first lookup so
 *     メガニウム (Meganium) is never mistaken for a Mega form.
 *   - Trainer/Energy: ja→zh via the catalog (shared ja/zh ids), then the
 *     curated en→zh staple table (scripts/trainer_en_zh.json), then the verified
 *     trainerEnZh / extra_zh tables. Unresolved names are reported, never faked.
 *   - Strips `<>` markup everywhere.
 *
 * Reads:  public/catalog/cards-zh-Hant.json, scripts/dex_names.json,
 *         scripts/trainer_en_zh.json, scripts/extra_zh.json
 * Writes: public/catalog/decks-zh-Hant.json
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG = path.join(ROOT, "public", "catalog", "cards-zh-Hant.json");
const DECKS = path.join(ROOT, "public", "catalog", "decks-zh-Hant.json");
const DEX = path.join(ROOT, "scripts", "dex_names.json");
const TRAINER = path.join(ROOT, "scripts", "trainer_en_zh.json");
const TRAINER_JA = path.join(ROOT, "scripts", "trainer_en_ja.json");
const EXTRA = path.join(ROOT, "scripts", "extra_zh.json");
const CORRECTIONS = path.join(ROOT, "scripts", "name_corrections.json");

const stripBrackets = (s) => (s ?? "").replace(/[<>＜＞]/g, "");
const hasKana = (s) => /[ぁ-んァ-ヶー]/.test(s);
const isPureLatin = (s) => /^[A-Za-z0-9][A-Za-z0-9'’.\-:() ]*$/.test(s);

// English possessive owner → zh (mirrors decks.ts ARCH_POSSESSIVE).
const POSS_EN = {
  "team rocket": "火箭隊的",
  rocket: "火箭隊的",
  n: "N之",
  cynthia: "竹蘭的",
  hop: "赫普的",
  lillie: "莉莉艾的",
  misty: "小霞的",
  marnie: "瑪俐的",
  iono: "奇樹的",
  ethan: "阿正的",
};
// ja owner prefix → zh (deck data mostly arrives bracketed already, but cover it).
const POSS_JA = [
  ["ロケット団の", "火箭隊的"],
  ["シロナの", "竹蘭的"],
  ["ホップの", "赫普的"],
  ["リーリエの", "莉莉艾的"],
  ["カスミの", "小霞的"],
  ["マリィの", "瑪俐的"],
];
const REGION = [
  { ja: "アローラ", en: "alolan", zh: "阿羅拉" },
  { ja: "ガラル", en: "galarian", zh: "伽勒爾" },
  { ja: "ヒスイ", en: "hisuian", zh: "洗翠" },
  { ja: "パルデア", en: "paldean", zh: "帕底亞" },
];
// Longest-first so VMAX/VSTAR win over a bare V.
const SUFFIX = ["V-UNION", "VMAX", "VSTAR", "ex", "EX", "V"];

function buildDexIndex(dex) {
  const ja = new Map();
  const en = new Map();
  for (const id of Object.keys(dex)) {
    const e = dex[id];
    if (e?.ja) ja.set(e.ja, e.zh);
    if (e?.en) en.set(e.en.toLowerCase(), e.zh);
  }
  return { ja, en };
}

/** Resolve a Pokémon card name (zh/ja/en) to clean official zh, or null. */
function resolveMon(rawName, dexIdx) {
  let n = stripBrackets(rawName).trim();
  if (n === "") return null;
  // Already zh (has Han chars and no kana) — keep verbatim (bracket-stripped).
  if (!hasKana(n) && /[一-鿿]/.test(n)) return n;

  // Detect & strip a trailing suffix.
  let suffix = "";
  for (const s of SUFFIX) {
    const tail = s === "EX" ? "ex" : s;
    if (hasKana(n) || /[一-鿿]/.test(n)) {
      if (n.endsWith(s)) {
        suffix = tail;
        n = n.slice(0, -s.length).trim();
        break;
      }
    } else if (new RegExp(`\\s*${s.replace(/-/g, "\\-")}$`, "i").test(n)) {
      suffix = tail;
      n = n.replace(new RegExp(`\\s*${s.replace(/-/g, "\\-")}$`, "i"), "").trim();
      break;
    }
  }

  // Possessive owner.
  let owner = "";
  for (const [ja, zh] of POSS_JA) {
    if (n.startsWith(ja)) {
      owner = zh;
      n = n.slice(ja.length);
      break;
    }
  }
  if (owner === "") {
    const m = n.match(/^(.+?)['’]s\s+/);
    if (m) {
      const zh = POSS_EN[m[1].toLowerCase()];
      if (zh) {
        owner = zh;
        n = n.slice(m[0].length);
      }
    }
  }

  const lookup = (s) => dexIdx.ja.get(s) ?? dexIdx.en.get(s.toLowerCase());

  // Species-first: try the whole remainder before assuming a Mega/region prefix
  // (so メガニウム resolves to 大竺葵, not 超級+ニウム).
  let zh = lookup(n);
  let prefix = "";
  if (zh === undefined) {
    let mega = false;
    if (n.startsWith("メガ")) {
      mega = true;
      n = n.slice(2);
    } else if (/^mega\s+/i.test(n)) {
      mega = true;
      n = n.replace(/^mega\s+/i, "");
    }
    for (const r of REGION) {
      if (n.startsWith(r.ja)) {
        prefix += r.zh;
        n = n.slice(r.ja.length);
        break;
      }
      if (new RegExp(`^${r.en}\\s+`, "i").test(n)) {
        prefix += r.zh;
        n = n.replace(new RegExp(`^${r.en}\\s+`, "i"), "");
        break;
      }
    }
    if (mega) prefix = "超級" + prefix;
    zh = lookup(n.trim());
  }
  if (zh === undefined) return null;
  return owner + prefix + zh + suffix;
}

export async function relocalizeDecks() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const dex = JSON.parse(await readFile(DEX, "utf8"));
  const trainer = JSON.parse(await readFile(TRAINER, "utf8")).map ?? {};
  const trainerJa = JSON.parse(await readFile(TRAINER_JA, "utf8")).map ?? {};
  const extra = JSON.parse(await readFile(EXTRA, "utf8")).map ?? {};
  // Wrong zh-Hant -> OFFICIAL zh-Hant (web-verified vs asia.pokemon-card.com /
  // Bulbapedia). Applied as the FINAL pass so any path that produced a wrong name
  // is corrected (owner-flagged 2026-06-17). Keyed by the full card name.
  const corrections = JSON.parse(await readFile(CORRECTIONS, "utf8")).map ?? {};
  const decks = JSON.parse(await readFile(DECKS, "utf8"));
  const dexIdx = buildDexIndex(dex);

  // ja → zh from the catalog (shared ja/zh ids make this exact for reprints).
  const jaToZh = new Map();
  const zhNames = new Set();
  for (const c of catalog.cards) {
    const zh = stripBrackets(c.nameZh ?? c.name);
    if (zh) zhNames.add(zh);
    if (c.nameJa && !jaToZh.has(c.nameJa)) jaToZh.set(c.nameJa, zh);
  }

  const unresolved = new Map(); // name → count
  const note = (n) => unresolved.set(n, (unresolved.get(n) ?? 0) + 1);

  function resolveTrainer(rawName) {
    const n = stripBrackets(rawName).trim();
    if (!hasKana(n) && !isPureLatin(n) && /[一-鿿]/.test(n)) return n; // already zh
    if (jaToZh.has(n)) return jaToZh.get(n);
    // en → ja → catalog official zh (zh comes 100% from real catalog data).
    if (trainerJa[n] !== undefined && jaToZh.has(trainerJa[n])) return jaToZh.get(trainerJa[n]);
    if (extra[n] !== undefined) return extra[n];
    if (trainer[n] !== undefined) return trainer[n];
    // base before a parenthetical subtitle
    const base = n.split("(")[0].split("（")[0].trim();
    if (jaToZh.has(base)) return jaToZh.get(base);
    if (trainerJa[base] !== undefined && jaToZh.has(trainerJa[base])) return jaToZh.get(trainerJa[base]);
    if (extra[base] !== undefined) return extra[base];
    if (trainer[base] !== undefined) return trainer[base];
    return null;
  }

  let changed = 0;
  let kept = 0;
  for (const a of decks.archetypes) {
    for (const b of a.builds) {
      for (const c of b.cards) {
        const before = c.name;
        let after = null;
        if (c.section === "pokemon") {
          after = resolveMon(c.name, dexIdx);
        } else {
          after = resolveTrainer(c.name);
        }
        if (after === null) {
          // Could not resolve — strip brackets at least; report if still dirty.
          after = stripBrackets(c.name);
          // Dirty = any kana, or NO Han at all (catches accented Latin like "é").
          if (hasKana(after) || !/[一-鿿]/.test(after)) note(c.section + " :: " + after);
        }
        if (corrections[after] !== undefined) after = corrections[after]; // official-name fix
        c.name = after;
        if (after === before) kept += 1;
        else changed += 1;
      }
    }
  }

  await writeFile(DECKS, JSON.stringify(decks));

  // Corroboration: how many resolved names exist as a real catalog card?
  const allNames = new Set();
  for (const a of decks.archetypes) for (const b of a.builds) for (const c of b.cards) allNames.add(c.name);
  let corro = 0;
  for (const n of allNames) if (zhNames.has(n)) corro += 1;

  console.log(`rewritten: ${changed} | unchanged: ${kept}`);
  console.log(`distinct final names: ${allNames.size} | corroborated by catalog: ${corro}`);
  if (unresolved.size > 0) {
    console.log(`\nUNRESOLVED (${unresolved.size}) — still ja/en, need a verified zh name:`);
    for (const [n, ct] of [...unresolved.entries()].sort()) console.log(`  ${n}  (x${ct})`);
  } else {
    console.log("\nAll card names resolved to zh. ✅");
  }
}

// CLI entry — also callable as a library (fetch_decks.mjs runs it as its final
// pass so the weekly auto-update CI gets clean zh names without a workflow edit).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  relocalizeDecks().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
