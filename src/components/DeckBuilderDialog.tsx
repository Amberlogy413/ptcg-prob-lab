import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { CardVisual } from "./CardVisual.tsx";
import { useDeckStore, type Deck } from "../state/deckStore.ts";
import { computeDeckSummary } from "../state/selectors.ts";
import {
  loadCatalog,
  toNewCardInput,
  sortPrints,
  groupByName,
  stageKey,
  trainerTypeKey,
  energyTypeKey,
  kindOf,
  fnKey,
  cardName,
  evolutionFamilies,
  FN_ORDER,
  type Catalog,
  type CatalogCard,
  type PrintGroup,
  type EvolutionFamily,
} from "../data/catalog.ts";
import { useCardLang } from "../state/cardLang.ts";
import { DECK_SIZE } from "../constants.ts";
import { TypeChip } from "./TypeChip.tsx";
import { TierBadge } from "./TierBadge.tsx";
import { FnIcon } from "./FnChip.tsx";
import { CardName } from "./CardName.tsx";
import { cardSurface, cardType } from "../data/typeColors.ts";
import { fnColor } from "../data/fnColors.ts";

// "OwnedPokemon" is a builder-only pseudo-category: the trainer-owned subset of
// Pokémon (card.owner), given its own 大類 per owner request 2026-06-15. The
// plain "Pokemon" entry is the all-inclusive 全部精靈.
type Category = "Pokemon" | "OwnedPokemon" | "Trainer" | "Energy";

const CATEGORY_ORDER: Category[] = ["Pokemon", "OwnedPokemon", "Trainer", "Energy"];
const CATEGORY_KEY: Record<Category, string> = {
  Pokemon: "catalog.cat.allPokemon",
  OwnedPokemon: "catalog.cat.ownedPokemon",
  Trainer: "catalog.cat.trainer",
  Energy: "catalog.cat.energy",
};
const STAGE_ORDER = ["Basic", "Stage1", "Stage2", "VMAX", "VSTAR", "MEGA", "BREAK", "LEVEL-UP"];
const TRAINER_ORDER = ["Item", "Supporter", "Stadium", "Tool"];
// Real zh-tw data uses "Normal" (not "Basic") for basic energies; both map to
// the 基本能量 label and both stay listed so no print is unreachable.
const ENERGY_ORDER = ["Basic", "Normal", "Special"];
const TYPE_ORDER = [
  "Grass",
  "Fire",
  "Water",
  "Lightning",
  "Psychic",
  "Fighting",
  "Darkness",
  "Metal",
  "Dragon",
  "Colorless",
  "Fairy",
];
const GRID_CAP = 48;

/** Sub-facet of a card inside the active category: owner for the trainer-owned
 *  bucket, otherwise stage / trainer type / energy type. */
function subOf(card: CatalogCard, category: Category | null): string | undefined {
  if (category === "OwnedPokemon") return card.owner;
  if (card.category === "Pokemon") return card.stage;
  if (card.category === "Trainer") return card.trainerType;
  return card.energyType;
}

function subLabelKey(category: Category, sub: string): string | null {
  if (category === "OwnedPokemon") return null; // owner names are raw real data
  if (category === "Pokemon") return stageKey(sub);
  if (category === "Trainer") return trainerTypeKey(sub);
  return energyTypeKey(sub);
}

/** Card pool for a 大類: the trainer-owned bucket is the Pokémon-with-owner
 *  subset; every other bucket maps straight to card.category. */
function inCategory(card: CatalogCard, category: Category): boolean {
  if (category === "OwnedPokemon") return card.category === "Pokemon" && card.owner !== undefined;
  return card.category === category;
}

/** 採用率 badge shown on EVERY card (owner request 2026-06-15). A real sampled
 *  rate is the pink 熱門 badge; a card not seen in the current Limitless sample
 *  shows a muted 0% (honest — its inclusion rate in that sample is zero). */
function UsageBadge({ usage }: { usage?: number }) {
  const t = useT();
  if (usage !== undefined) {
    return (
      <span className="rounded-full border border-pink px-1.5 py-0.5 font-mono text-pink">
        {t("catalog.usage", { p: usage })}
      </span>
    );
  }
  return (
    <span
      title={t("catalog.usageNoneTitle")}
      className="rounded-full border hairline px-1.5 py-0.5 font-mono text-ink2 opacity-60"
    >
      {t("catalog.usage", { p: 0 })}
    </span>
  );
}

/**
 * 逐層組牌 (docs/DECISIONS.md "真實卡牌目錄"): a layered, visual deck builder
 * over the full catalog — 大類 → 細分 → 屬性 → cards, each layer one row of
 * counted chips, with the deck's EXACT mulligan probability updating live as
 * cards land. Filters are pure list operations; all math stays in selectors.
 */
export function DeckBuilderDialog({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const t = useT();
  const { lang } = useCardLang();
  const addCardFrom = useDeckStore((s) => s.addCardFrom);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [fnTag, setFnTag] = useState<string | null>(null);
  const [stdOnly, setStdOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<CatalogCard | null>(null);
  // Which evolution lines are expanded to their member chooser (owner request
  // 2026-06-15: a line is one collapsed card; tap to enlarge and pick a card).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (c) => {
        if (alive) setCatalog(c);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [failed]); // retry resets `failed`, which re-arms this effect

  const label = (key: string | null, raw: string) => (key !== null ? t(key) : raw);

  // Layer pools — each layer filters the previous one.
  const pool0 = useMemo(
    () => (catalog === null ? [] : stdOnly ? catalog.cards.filter((c) => c.std === true) : catalog.cards),
    [catalog, stdOnly],
  );
  const pool1 = useMemo(
    () => (category === null ? pool0 : pool0.filter((c) => inCategory(c, category))),
    [pool0, category],
  );
  const pool2 = useMemo(
    () => (sub === null ? pool1 : pool1.filter((c) => subOf(c, category) === sub)),
    [pool1, sub, category],
  );
  const pool3 = useMemo(
    () => (type === null ? pool2 : pool2.filter((c) => (c.types ?? []).includes(type))),
    [pool2, type],
  );
  // Self-healing selection: when upper layers change and the chosen tag has
  // zero cards in the new pool, it simply stops filtering (no hidden state).
  const fnCountsEarly = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of pool3) for (const k of c.fn ?? []) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [pool3]);
  const activeFn = fnTag !== null && fnCountsEarly.has(fnTag) ? fnTag : null;
  const pool4 = useMemo(
    () => (activeFn === null ? pool3 : pool3.filter((c) => (c.fn ?? []).includes(activeFn))),
    [pool3, activeFn],
  );
  // One tile per card NAME (owner request); same-name prints via a per-tile
  // version select. Sorted by popularity/std/newest through groupByName.
  const results = useMemo(() => {
    if (catalog === null) return [];
    const q = search.trim().toLowerCase();
    const hits = q === "" ? pool4 : pool4.filter((c) => c.name.toLowerCase().includes(q));
    return groupByName(catalog, sortPrints(catalog, hits));
  }, [catalog, pool4, search]);
  const [printChoice, setPrintChoice] = useState<Record<string, string>>({});

  const countBy = (cards: CatalogCard[], pick: (c: CatalogCard) => string | undefined) => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const k = pick(c);
      if (k !== undefined) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of pool0) {
      m.set(c.category, (m.get(c.category) ?? 0) + 1);
      if (c.category === "Pokemon" && c.owner !== undefined) {
        m.set("OwnedPokemon", (m.get("OwnedPokemon") ?? 0) + 1);
      }
    }
    return m;
  }, [pool0]);
  const subCounts = useMemo(() => countBy(pool1, (c) => subOf(c, category)), [pool1, category]);
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (category === "Pokemon" || category === "OwnedPokemon") {
      for (const c of pool2) for (const ty of c.types ?? []) m.set(ty, (m.get(ty) ?? 0) + 1);
    }
    return m;
  }, [pool2, category]);
  const fnCounts = fnCountsEarly;

  const nameTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of deck.cards) m.set(c.name, (m.get(c.name) ?? 0) + c.count);
    return m;
  }, [deck.cards]);

  // Live readout via the selector bridge (UI never calls the math core
  // directly) — and the full three-format contract, not a naked percent.
  const summary = computeDeckSummary(deck);
  const total = summary.total;
  const basics = summary.basics;
  const mulligan = summary.mulligan ?? null;

  const subOrder =
    category === "Pokemon"
      ? STAGE_ORDER
      : category === "OwnedPokemon"
        ? [...subCounts.keys()].sort() // trainer owners, alphabetical by zh name
        : category === "Trainer"
          ? TRAINER_ORDER
          : ENERGY_ORDER;

  const chip = (selected: boolean) =>
    "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
    (selected ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  /** std toggle can hide the chip a selected filter lives on — clear filters
   *  that no longer exist in the new pool so the grid never silently empties. */
  function onStdToggle(on: boolean) {
    setStdOnly(on);
    if (catalog === null || category === null) return;
    const p0 = on ? catalog.cards.filter((c) => c.std === true) : catalog.cards;
    const p1 = p0.filter((c) => inCategory(c, category));
    if (sub !== null && !p1.some((c) => subOf(c, category) === sub)) {
      setSub(null);
      setType(null);
      return;
    }
    if (type !== null) {
      const p2 = sub === null ? p1 : p1.filter((c) => subOf(c, category) === sub);
      if (!p2.some((c) => (c.types ?? []).includes(type))) setType(null);
    }
  }

  // One card tile (shared by the flat grid and the evolution-family layout).
  const renderTile = (group: PrintGroup) => {
    const { rep, prints } = group;
    const card = prints.find((p) => p.id === printChoice[rep.name]) ?? rep;
    const kind = kindOf(card);
    const owned = nameTotals.get(rep.name) ?? 0;
    const addLabel =
      t("catalog.addAria", { name: card.name, id: card.id }) +
      (card.usage !== undefined ? `,${t("catalog.usageAria", { p: card.usage })}` : "") +
      (owned > 0 ? `,${t("builder.copies", { n: owned })}` : "") +
      (card.std !== true ? `,${t("catalog.legal.not")}` : "");
    return (
      <li
        key={rep.name}
        style={{ ...cardSurface(card), borderLeftWidth: "3px" }}
        className="rounded-ctl border p-2"
      >
        <button
          type="button"
          aria-label={addLabel}
          onClick={() => addCardFrom(deck.id, toNewCardInput(card))}
          className="block w-full rounded-ctl text-left transition-colors hover:bg-white/40"
        >
          <span className="flex items-baseline gap-1">
            <CardName card={card} className="min-w-0 flex-1 truncate text-sm font-medium" />
            {owned > 0 && (
              <span
                className="shrink-0 rounded-full bg-pink px-1.5 font-mono text-xs text-white"
                title={t("builder.copies", { n: owned })}
              >
                ×{owned}
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink2">
            <span className="rounded-ctl border hairline px-1 py-0.5">{label(kind.key, kind.raw)}</span>
            <TierBadge card={card} />
            {cardType(card) !== null && <TypeChip type={cardType(card) as string} />}
            <UsageBadge usage={card.usage} />
            {card.hp !== undefined && <span className="font-mono">HP{card.hp}</span>}
            <span className="font-mono">
              {card.set ?? "?"} {card.localId}
            </span>
            {card.std !== true && <span>{t("catalog.legal.not")}</span>}
          </span>
        </button>
        <div className="mt-2 flex gap-1">
          {prints.length > 1 && (
            <select
              aria-label={t("catalog.version", { name: rep.name })}
              value={card.id}
              onChange={(e) => setPrintChoice((m) => ({ ...m, [rep.name]: e.target.value }))}
              className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-1 font-mono text-xs text-ink2"
            >
              {prints.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.set ?? "?"} {p.localId}
                  {p.std === true ? " ✓" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            aria-label={t("catalog.detailAria", { name: rep.name })}
            aria-haspopup="dialog"
            onClick={() => setDetail(card)}
            className="h-9 shrink-0 rounded-ctl border hairline bg-surface px-3 text-sm text-ink2 hover:text-ink"
          >
            ⓘ
          </button>
        </div>
      </li>
    );
  };

  // A whole evolution line collapsed onto ONE tile (owner request 2026-06-15):
  // shows the 主軸 (most-played member) as the face; tapping it expands the line
  // so the user picks the specific card. Occupies a single grid slot like any
  // other tile, so the line reads as one combo, not a sprawling row.
  const renderFamilyCollapsed = (fam: EvolutionFamily) => {
    const face = fam.rep.rep;
    // Show the 主軸's OWN deck count (≤4, legal), never the line sum — a summed
    // ×8 on a single card-looking tile misreads as a rule violation (owner
    // request 2026-06-15). Per-member counts are visible once expanded.
    const owned = nameTotals.get(face.name) ?? 0;
    const stages = fam.members.map((m) => {
      const k = stageKey(m.rep.stage ?? "Basic");
      return k !== null ? t(k) : (m.rep.stage ?? "");
    });
    const faceType = cardType(face);
    return (
      <li
        key={`fam-${fam.key}`}
        style={{ ...cardSurface(face), borderLeftWidth: "3px" }}
        className="rounded-ctl border p-2"
      >
        <button
          type="button"
          aria-label={t("builder.seriesOpen", { name: cardName(face, lang), n: fam.members.length })}
          aria-expanded={false}
          onClick={() => setExpanded((s) => new Set(s).add(fam.key))}
          className="block w-full rounded-ctl text-left transition-colors hover:bg-white/40"
        >
          <span className="flex items-baseline gap-1">
            <CardName card={face} className="min-w-0 flex-1 truncate text-sm font-medium" />
            {owned > 0 && (
              <span
                className="shrink-0 rounded-full bg-pink px-1.5 font-mono text-xs text-white"
                title={t("builder.copies", { n: owned })}
              >
                ×{owned}
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink2">
            <span className="rounded-ctl border border-blue/40 bg-accent-50 px-1.5 py-0.5 font-medium text-blue">
              {t("builder.seriesTag", { n: fam.members.length })}
            </span>
            {faceType !== null && <TypeChip type={faceType} />}
            <UsageBadge usage={face.usage} />
            <span className="min-w-0 truncate">{stages.join(" › ")}</span>
          </span>
          <span className="mt-1 block text-xs text-blue">▾ {t("builder.seriesHint")}</span>
        </button>
      </li>
    );
  };

  // Evolution lines ALWAYS group into one series (owner request 2026-06-15: 多龍
  // 系列要以系列形式顯示),even in the mixed/default view — not only when the
  // 寶可夢 category is picked. Non-Pokémon become singletons (packed into a
  // shared grid at render). Capped to keep the grid light.
  const families =
    catalog !== null ? evolutionFamilies(catalog, results).slice(0, GRID_CAP) : null;

  return (
    <Modal wide title={t("builder.title")} onClose={onClose}>
      {/* Live deck bar: the builder's instrument readout. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-ctl border hairline bg-paper p-3 text-sm">
        <span role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono">
            {t("builder.deckbar", { total, max: DECK_SIZE, basics })}
          </span>
          {mulligan !== null && (
            <span>
              {t("builder.mulligan")} <span className="font-mono">{mulligan.percent}</span>{" "}
              <span className="font-mono text-xs text-ink2">
                {mulligan.fraction} · {mulligan.oneIn}
              </span>
            </span>
          )}
        </span>
        <label className="ml-auto flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={stdOnly}
            onChange={(e) => onStdToggle(e.target.checked)}
          />
          {t("builder.std")}
        </label>
        <button
          type="button"
          onClick={onClose}
          className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white"
        >
          {t("builder.done")}
        </button>
      </div>

      {catalog === null ? (
        <p className="mt-4 text-sm text-ink2" role="status">
          {failed ? (
            <>
              {t("catalog.error")}{" "}
              <button type="button" onClick={() => setFailed(false)} className="underline">
                {t("catalog.retry")}
              </button>
            </>
          ) : (
            t("catalog.loading")
          )}
        </p>
      ) : (
        <>
          {/* Layer 1: 大類 */}
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("builder.layer.category")}>
            <span className="text-xs text-ink2">{t("builder.layer.category")}</span>
            {CATEGORY_ORDER.filter(
              (cat) => (catCounts.get(cat) ?? 0) > 0 || category === cat,
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                onClick={() => {
                  setCategory(category === cat ? null : cat);
                  setSub(null);
                  setType(null);
                }}
                className={chip(category === cat)}
              >
                {t(CATEGORY_KEY[cat])}{" "}
                <span className="font-mono text-xs">{catCounts.get(cat) ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Layer 2: 細分 */}
          {category !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={t("builder.layer.sub")}>
              <span className="text-xs text-ink2">{t("builder.layer.sub")}</span>
              {subOrder
                .filter((s) => (subCounts.get(s) ?? 0) > 0)
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sub === s}
                    onClick={() => {
                      setSub(sub === s ? null : s);
                      setType(null);
                    }}
                    className={chip(sub === s)}
                  >
                    {label(subLabelKey(category, s), s)}{" "}
                    <span className="font-mono text-xs">{subCounts.get(s)}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Layer 3: 屬性 (Pokémon / trainer-owned Pokémon) */}
          {(category === "Pokemon" || category === "OwnedPokemon") && sub !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={t("builder.layer.type")}>
              <span className="text-xs text-ink2">{t("builder.layer.type")}</span>
              {TYPE_ORDER.filter((ty) => (typeCounts.get(ty) ?? 0) > 0).map((ty) => (
                <button
                  key={ty}
                  type="button"
                  aria-pressed={type === ty}
                  onClick={() => setType(type === ty ? null : ty)}
                  className="inline-flex items-center gap-1 rounded-full"
                >
                  <TypeChip type={ty} solid={type === ty} />
                  <span className="font-mono text-xs text-ink2">{typeCounts.get(ty)}</span>
                </button>
              ))}
            </div>
          )}

          {/* 功能層 (P10.2): deterministic function tags from the card text. */}
          {fnCounts.size > 0 && (
            <div
              className="mt-2 flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t("builder.layer.fn")}
            >
              <span className="text-xs text-ink2">{t("builder.layer.fn")}</span>
              {FN_ORDER.filter((k) => (fnCounts.get(k) ?? 0) > 0).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={activeFn === k}
                  onClick={() => setFnTag(activeFn === k ? null : k)}
                  className={chip(activeFn === k) + " inline-flex items-center gap-1"}
                >
                  <span style={{ color: activeFn === k ? "#FFFFFF" : fnColor(k) }}>
                    <FnIcon tag={k} />
                  </span>
                  {label(fnKey(k), k)}{" "}
                  <span className="font-mono text-xs">{fnCounts.get(k)}</span>
                </button>
              ))}
            </div>
          )}

          <input
            type="search"
            value={search}
            aria-label={t("builder.search")}
            placeholder={t("builder.search")}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-3 h-9 w-full rounded-ctl border hairline bg-surface px-3 text-sm"
          />

          <p className="mt-2 text-xs text-ink2">{t("builder.results", { n: results.length })}</p>
          {results.length === 0 || families === null ? (
            <p className="mt-2 text-sm text-ink2">{t("builder.empty")}</p>
          ) : (
            <div
              role="list"
              aria-label={t("catalog.results.aria")}
              className="mt-2 max-h-96 space-y-2 overflow-y-auto"
            >
              {(() => {
                // Walk families in order. Each tile (a singleton, or a whole
                // line COLLAPSED to one card) packs into a shared grid; only a
                // line the user has EXPANDED breaks out into a full series-box
                // chooser. So lines read as one combo until tapped open.
                const blocks: JSX.Element[] = [];
                let run: JSX.Element[] = [];
                const flush = (key: string) => {
                  if (run.length === 0) return;
                  const tiles = run;
                  run = [];
                  blocks.push(
                    <ul key={key} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {tiles}
                    </ul>,
                  );
                };
                families.forEach((fam, i) => {
                  const isLine = fam.members.length > 1;
                  if (isLine && expanded.has(fam.key)) {
                    flush(`run-${i}`);
                    blocks.push(
                      <div key={`fam-${fam.key}`} className="rounded-ctl border hairline bg-paper p-2">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink2">
                            {t("builder.family", { name: cardName(fam.rep.rep, lang) })}
                          </p>
                          <button
                            type="button"
                            aria-label={t("builder.seriesCollapse")}
                            onClick={() =>
                              setExpanded((s) => {
                                const next = new Set(s);
                                next.delete(fam.key);
                                return next;
                              })
                            }
                            className="shrink-0 rounded-ctl border hairline bg-surface px-2 py-0.5 text-xs text-ink2 hover:text-ink"
                          >
                            ▴ {t("builder.seriesCollapse")}
                          </button>
                        </div>
                        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {fam.members.map(renderTile)}
                        </ul>
                      </div>,
                    );
                  } else if (isLine) {
                    run.push(renderFamilyCollapsed(fam));
                  } else {
                    run.push(renderTile(fam.members[0]!));
                  }
                });
                flush("run-final");
                return blocks;
              })()}
            </div>
          )}
          {results.length > GRID_CAP && (
            <p className="mt-2 text-xs text-ink2">
              {t("builder.more", { n: results.length - GRID_CAP })}
            </p>
          )}
          <p className="mt-3 text-xs text-ink2">
            {catalog.format !== undefined &&
              t("catalog.formatLine", {
                marks: catalog.format.standard.join("/"),
                date: catalog.format.effective,
              }) + " · "}
            {catalog.meta !== undefined &&
              t("catalog.metaSource", {
                n: catalog.meta.sampleDecks,
                from: catalog.meta.dateFrom,
                to: catalog.meta.dateTo,
              }) + " · "}
            {t("catalog.source")}
          </p>
        </>
      )}

      {detail !== null && catalog !== null && (
        <Modal title={cardName(detail, lang)} onClose={() => setDetail(null)}>
          <CardVisual card={detail} setInfo={catalog.sets[detail.set ?? ""] ?? null} />
        </Modal>
      )}
    </Modal>
  );
}
