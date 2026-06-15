import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { useUiStore } from "../state/uiStore.ts";
import { computeDeckSummary } from "../state/selectors.ts";
import {
  loadDecks,
  buildToInputs,
  tierKey,
  localizeArchetype,
  localizeCarry,
  groupSeries,
  deckTags,
  type DeckData,
  type DeckSeries,
  type DeckBuild,
} from "../data/decks.ts";
import { loadCatalog, localizeDeckRow, type Catalog } from "../data/catalog.ts";
import { useCardLang } from "../state/cardLang.ts";
import { DECK_SIZE } from "../constants.ts";

type Status = "loading" | "ready" | "error";

/**
 * 牌組推薦 (docs/06 Phase 11): real tournament decklists grouped by Limitless's
 * own archetype labels, ranked by field size → recency → placing. Each build
 * loads straight into the deck workspace for exact-math analysis.
 */
export function DecksView() {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<DeckData | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [openSeries, setOpenSeries] = useState<string | null>(null);

  const series = useMemo(() => (data === null ? [] : groupSeries(data.archetypes)), [data]);

  useEffect(() => {
    let alive = true;
    loadDecks().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setStatus("ready");
        setOpenSeries(groupSeries(d.archetypes)[0]?.id ?? null);
      },
      () => alive && setStatus("error"),
    );
    // Catalog (for archetype/card localization + playstyle tags); non-blocking.
    loadCatalog().then(
      (c) => alive && setCatalog(c),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("decks.title")}</h2>
        <p className="mt-2 text-sm text-ink2" role="status">
          {t("decks.loading")}
        </p>
      </section>
    );
  }
  if (status === "error" || data === null) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("decks.title")}</h2>
        <p className="mt-2 text-sm text-warn" role="alert">
          {t("decks.error")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("decks.title")}</h2>
      <p className="mt-1 text-sm text-ink2">{t("decks.subtitle")}</p>
      <p className="mt-1 text-xs text-ink2">
        {t("decks.source", {
          n: data.sampleDecks,
          tt: data.tournaments,
          from: data.dateFrom ?? "?",
          to: data.dateTo ?? "?",
          fmt: data.format,
        })}
      </p>
      <p className="mt-1 text-xs text-warn" role="note">
        {t("decks.tierNote")}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {series.map((s) => (
          <SeriesCard
            key={s.id}
            series={s}
            catalog={catalog}
            open={openSeries === s.id}
            onToggle={() => setOpenSeries(openSeries === s.id ? null : s.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function SeriesCard({
  series,
  catalog,
  open,
  onToggle,
}: {
  series: DeckSeries;
  catalog: Catalog | null;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const multi = series.members.length > 1;
  const [variant, setVariant] = useState(0);
  const selected = series.members[Math.min(variant, series.members.length - 1)] ?? series.members[0]!;

  // A multi-variant series is titled by its carry Pokémon; a single-variant one
  // keeps the full archetype name so possessive / Mega / descriptor context is
  // never lost (behaviour identical to the pre-#40 archetype card).
  const title = useMemo(
    () => (multi ? localizeCarry(series, catalog) : localizeArchetype(selected.name, catalog)),
    [multi, series, selected.name, catalog],
  );
  const variantName = useMemo(
    () => localizeArchetype(selected.name, catalog),
    [selected.name, catalog],
  );
  const tags = useMemo(() => deckTags(selected.builds[0]?.cards ?? [], catalog), [selected, catalog]);

  return (
    <li className="rounded-ctl border hairline bg-paper">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1 truncate font-medium" title={series.members.map((m) => m.name).join(" / ")}>
          {title}
        </span>
        {multi && (
          <span className="shrink-0 rounded-full border hairline bg-surface px-2 py-0.5 text-xs text-ink2">
            {t("decks.seriesBadge", { n: series.members.length })}
          </span>
        )}
        <span className="shrink-0 rounded-full border border-pink px-2 py-0.5 font-mono text-xs text-pink">
          {t("decks.deckCount", { n: series.deckCount })}
        </span>
        <span className="shrink-0 text-ink2">{open ? "▾" : "▸"}</span>
        {tags.length > 0 && (
          <span className="flex w-full flex-wrap gap-1">
            {tags.map((k) => (
              <span key={k} className="rounded-full border hairline bg-surface px-1.5 py-0.5 text-[11px] text-ink2">
                {t(k)}
              </span>
            ))}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t hairline p-2">
          {multi && (
            <div className="mb-2">
              <p className="mb-1 px-1 text-xs text-ink2">{t("decks.variantHint")}</p>
              <div className="flex flex-wrap gap-1.5">
                {series.members.map((m, i) => {
                  const on = i === variant;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setVariant(i)}
                      className={
                        on
                          ? "rounded-full border border-pink bg-pink px-2.5 py-1 text-xs font-medium text-white"
                          : "rounded-full border hairline bg-surface px-2.5 py-1 text-xs text-ink2 hover:text-ink"
                      }
                    >
                      {localizeArchetype(m.name, catalog)}
                      <span className="ml-1 font-mono opacity-70">{m.deckCount}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p className="mb-2 px-1 text-xs text-ink2">{t("decks.buildsHint")}</p>
          <ul className="flex flex-col gap-2">
            {selected.builds.map((b, i) => (
              <BuildRow
                key={`${selected.id}-${b.event}-${b.date}-${i}`}
                build={b}
                archName={variantName}
                catalog={catalog}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

const SECTION_ORDER = ["pokemon", "trainer", "energy", "unknown"] as const;
const SECTION_KEY: Record<string, string> = {
  pokemon: "deck.section.pokemon",
  trainer: "deck.section.trainer",
  energy: "deck.section.energy",
  unknown: "deck.section.unknown",
};

function BuildRow({
  build,
  archName,
  catalog,
}: {
  build: DeckBuild;
  archName: string;
  catalog: Catalog | null;
}) {
  const t = useT();
  const { lang } = useCardLang();
  const importDeck = useDeckStore((s) => s.importDeck);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const [show, setShow] = useState(false);

  // Exact mulligan teaser through the selector bridge (synthetic deck shape).
  const mulligan = useMemo(() => {
    const now = 0;
    const deck = {
      id: "preview",
      name: archName,
      createdAt: now,
      updatedAt: now,
      cards: build.cards.map((c, i) => ({
        id: `p${i}`,
        name: c.name,
        count: c.count,
        isBasic: c.isBasic,
        section: c.section,
      })),
    };
    return computeDeckSummary(deck).mulligan ?? null;
  }, [build, archName]);

  function load() {
    importDeck(`${archName} · ${build.event}`.slice(0, 60), buildToInputs(build));
    setActiveView("deck");
  }

  const groups = SECTION_ORDER.map((section) => ({
    section,
    cards: build.cards.filter((c) => c.section === section),
  })).filter((g) => g.cards.length > 0);

  return (
    <li className="rounded-ctl border hairline bg-surface p-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-ctl border border-blue px-1.5 py-0.5 text-xs text-blue">
          {t(tierKey(build.players), { n: build.players })}
        </span>
        {build.placing != null && (
          <span className="rounded-ctl border hairline px-1.5 py-0.5 font-mono text-xs text-ink2">
            {t("decks.placing", { n: build.placing })}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-ink2">{build.event}</span>
        <span className="shrink-0 font-mono text-xs text-ink2">{build.date}</span>
        {build.online && <span className="shrink-0 text-xs text-ink2">{t("decks.online")}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-ink2">
          {t("decks.total", { n: build.total })}
        </span>
        {mulligan !== null && (
          <span className="text-xs">
            {t("builder.mulligan")} <span className="font-mono">{mulligan.percent}</span>
          </span>
        )}
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-expanded={show}
            className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink"
          >
            {show ? t("decks.hideList") : t("decks.showList")}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-ctl bg-blue px-2.5 py-1 text-xs font-medium text-white"
          >
            {t("decks.load")}
          </button>
        </span>
      </div>

      {show && (
        <div className="mt-2 grid gap-x-4 gap-y-2 border-t hairline pt-2 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.section}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink2">
                {t(SECTION_KEY[g.section] ?? "deck.section.unknown")} ·{" "}
                <span className="font-mono">{g.cards.reduce((s, c) => s + c.count, 0)}</span>
              </p>
              <ul className="mt-0.5">
                {g.cards.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex gap-2 font-mono text-xs">
                    <span className="w-5 shrink-0 text-right">{c.count}</span>
                    <span className="min-w-0 truncate">
                      {catalog !== null ? localizeDeckRow(catalog, { name: c.name }, lang).name : c.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {build.total !== DECK_SIZE && (
        <p className="mt-1 text-xs text-warn">{t("decks.notSixty", { n: build.total })}</p>
      )}
    </li>
  );
}
