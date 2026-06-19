/**
 * RL engine bridge (AI agent step ②/③, owner 2026-06-19). A tiny JSON-lines
 * server that drives the SAME pure rules engine the app uses (src/engine), so a
 * Python training loop can use it as its environment WITHOUT re-implementing any
 * rule — one rules source, zero divergence.
 *
 * Run:  node --experimental-strip-types scripts/rl/engine_server.ts
 * Protocol: read one JSON command per line on stdin, write one JSON reply per
 * line on stdout. Commands:
 *   {"cmd":"reset","seed":7}                 -> {observation, vector, legal, done}
 *   {"cmd":"step","action":{...}}            -> {observation, vector, reward, done, legal}
 *   {"cmd":"legal"}                          -> {legal}
 *   {"cmd":"obs","pov":"p1"}                 -> {observation, vector}
 *   {"cmd":"ping"}                           -> {ok:true}
 *
 * HONEST SCOPE: the engine is a faithful SUBSET (docs/11 §5 — not every card
 * effect is modeled yet), so an agent trained here learns that subset. This is the
 * environment scaffold; completing the card effects is step ① (the ~90% of work).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { BattleEnv, encodeObservation, type Action, type CardSpec } from "../../src/engine/index.ts";
import { normalizeCatalog, type Catalog, type CatalogCard } from "../../src/data/catalog.ts";
import { toBattleSpec } from "../../src/state/battlePlay.ts";
import { energyType } from "../../src/data/typeColors.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Load + normalize the real catalog from disk (the app fetches it; we read it). */
function loadCatalogFromDisk(): Catalog | null {
  try {
    const raw = JSON.parse(readFileSync(join(HERE, "..", "..", "public", "catalog", "cards-zh-Hant.json"), "utf8")) as Catalog;
    return normalizeCatalog(raw);
  } catch {
    return null; // no catalog → engine still runs (no attacks); games end by deck-out
  }
}

/** A simple 60-card combat-capable demo deck: a Basic attacker payable by one
 *  basic Energy type, 16 + 44. (A training-env STUB, not a legal tournament deck;
 *  pass real decks via reset.decks once you wire deck import.) */
function buildDemoDeck(catalog: Catalog | null): CardSpec[] {
  if (catalog === null) {
    // Catalog-free fallback: a generic Basic + Energy so the loop still runs.
    return [
      { name: "Rookie", count: 16, isBasic: true, section: "pokemon", kind: "basic", hp: 70 },
      { name: "Energy", count: 44, isBasic: false, section: "energy", kind: "energy-basic" },
    ];
  }
  const energy = catalog.cards.find((c) => c.category === "Energy" && c.energyType !== "Special" && energyType(c.name) !== null);
  const T = energy ? energyType(energy.name) : null;
  const basics = catalog.cards.filter(
    (c): c is CatalogCard => c.category === "Pokemon" && (c.stage === "Basic" || c.stage === undefined) && (c.attacks?.length ?? 0) > 0 && c.hp !== undefined,
  );
  const payable = (cost: string[] | undefined) => (cost ?? []).every((s) => s === "Colorless" || s === T);
  const mon = basics.find((c) => (c.attacks ?? []).some((a) => payable(a.cost))) ?? basics[0];
  if (mon === undefined || energy === undefined) return buildDemoDeck(null);
  return [
    toBattleSpec(catalog, { name: mon.name, count: 16, isBasic: true, section: "pokemon", catalogId: mon.id }),
    toBattleSpec(catalog, { name: energy.name, count: 44, isBasic: false, section: "energy", catalogId: energy.id }),
  ];
}

const catalog = loadCatalogFromDisk();
const deck = buildDemoDeck(catalog);
const env = new BattleEnv(catalog);

function snapshot(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const observation = env.observation();
  const done = env.done;
  return { observation, vector: encodeObservation(observation), done, legal: done ? [] : env.legalActions(), ...extra };
}

function handle(line: string): Record<string, unknown> {
  let msg: { cmd?: string; seed?: number; action?: Action; pov?: "p1" | "p2" };
  try {
    msg = JSON.parse(line) as typeof msg;
  } catch {
    return { error: "bad json" };
  }
  switch (msg.cmd) {
    case "ping":
      return { ok: true, hasCatalog: catalog !== null, deckSize: deck.reduce((n, s) => n + s.count, 0) };
    case "reset":
      env.reset({ p1: deck, p2: deck, seed: (msg.seed ?? 1) >>> 0 });
      return snapshot();
    case "step": {
      if (msg.action === undefined) return { error: "step needs action" };
      const r = env.step(msg.action);
      return { observation: r.observation, vector: encodeObservation(r.observation), reward: r.reward, done: r.done, legal: r.legal };
    }
    case "legal":
      return { legal: env.done ? [] : env.legalActions() };
    case "obs": {
      const observation = env.observation(msg.pov ?? env.toMove);
      return { observation, vector: encodeObservation(observation) };
    }
    case "render":
      return { render: env.render() };
    default:
      return { error: `unknown cmd: ${String(msg.cmd)}` };
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (line.trim() === "") return;
  process.stdout.write(JSON.stringify(handle(line)) + "\n");
});
