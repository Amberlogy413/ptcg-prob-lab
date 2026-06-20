/**
 * Real-catalog resolution guard for the modeled search Items (added 2026-06-20 after
 * an adversarial review found a silent gap). The engine's unit tests inject synthetic
 * effect text, so they NEVER exercise the real name→print resolution. But a name-only
 * deck row (what every battle template uses) resolves via sortPrints to the NEWEST
 * print — which may carry a DIFFERENT zh wording than the one hardcoded in
 * SEARCH_BY_EFFECT. When that happened to 超級球 (its 2 newest prints use 「，從其中選擇」
 * while only 「。選擇其中」 was modeled), the ~84%-usage flagship card silently stopped
 * being detected on the shipped decks. This test drives the REAL path — load the real
 * catalog, resolve each modeled Item BY NAME (newest print), run makeCtx's resolve()
 * (incl. the kana-swap), and assert searchSpecOf still detects it — so any future
 * re-wording is caught in CI, not in production.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { normalizeCatalog, type Catalog } from "../src/data/catalog.ts";
import { makeCtx, searchSpecOf, type BattleCard } from "../src/engine/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "public", "catalog", "cards-zh-Hant.json"), "utf8")) as Catalog;
normalizeCatalog(catalog);
const ctx = makeCtx(catalog);

/** A name-only Item deck row (no catalogId) → the real newest-print resolution path. */
function nameRow(name: string): BattleCard {
  return { iid: name, name, isBasic: false, section: "trainer", kind: "item" };
}
const detectByName = (name: string) => searchSpecOf(ctx.resolve(nameRow(name))?.effect);

describe("real-catalog resolution — every modeled search Item is detected by NAME", () => {
  // Each of these resolves a name-only row to the catalog's newest matching print, so
  // a re-worded newest print (the 超級球 trap) would make this null and fail CI.
  const NAMES = ["巢穴球", "大師球", "夜間擔架", "能量輸送", "進化薰香", "等級球", "先機球", "高級球", "超級球", "寶可齒輪3.0", "寶可裝置3.0", "能量籤", "救援行李箱"];
  for (const name of NAMES) {
    it(`${name} is present and detected as a search Item via name-only resolution`, () => {
      expect(ctx.resolve(nameRow(name))).not.toBeNull(); // the card exists in the catalog
      expect(detectByName(name)).not.toBeNull(); // and searchSpecOf detects it (all wordings covered)
    });
  }

  it("超級球 (~84% usage) resolves to a top-7 reveal even via its newest comma-wording print", () => {
    const spec = detectByName("超級球");
    expect(spec).not.toBeNull();
    expect(spec!.topN).toBe(7);
  });

  it("先機球 / 高級球 keep their discard costs through name-only resolution", () => {
    expect(detectByName("先機球")?.discardCost).toBe(1);
    expect(detectByName("高級球")?.discardCost).toBe(2);
  });
});
