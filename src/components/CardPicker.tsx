import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import {
  loadCatalog,
  searchCatalog,
  groupByName,
  toNewCardInput,
  kindOf,
  typeKey,
  isFormatLegal,
  type Catalog,
  type CatalogCard,
} from "../data/catalog.ts";
import { CardVisual } from "./CardVisual.tsx";
import { CardName } from "./CardName.tsx";
import { FnChip } from "./FnChip.tsx";
import { TypeIcon } from "./TypeChip.tsx";
import { IconFlame, IconHP, IconLegal, IconIllegal } from "./icons.tsx";
import { cardAccent, cardType } from "../data/typeColors.ts";

type Status = "idle" | "loading" | "ready" | "error";

/**
 * Real-card search-to-add (docs/DECISIONS.md "真實卡牌目錄"): type a name,
 * tap a result, the row lands with isBasic/section/set/number/mark already
 * filled. Text-only facts; the manual rows below stay the fallback path.
 */
export function CardPicker({ deckId }: { deckId: string }) {
  const t = useT();
  const addCardFrom = useDeckStore((s) => s.addCardFrom);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  // 賽制法定 (owner 2026-06-14): default to standard-legal (H/I/J) only, so a
  // legal deck is the default path; the toggle reveals out-of-format prints.
  const [stdOnly, setStdOnly] = useState(true);

  function ensureCatalog() {
    if (status === "ready" || status === "loading") return;
    setStatus("loading");
    loadCatalog().then(
      (c) => {
        setCatalog(c);
        setStatus("ready");
      },
      () => setStatus("error"),
    );
  }

  // One row per card NAME (owner request): the representative is the best
  // print; same-name prints stay available via the per-row version selector.
  const groups = useMemo(() => {
    if (catalog === null || query.trim() === "") return [];
    let hits = searchCatalog(catalog, query, 200);
    if (stdOnly) hits = hits.filter(isFormatLegal);
    return groupByName(catalog, hits).slice(0, 50);
  }, [catalog, query, stdOnly]);

  const kindBadge = (card: CatalogCard): string => {
    const kind = kindOf(card);
    return kind.key !== null ? t(kind.key) : kind.raw;
  };

  // Which exact print is selected per name-group (defaults to the rep).
  const [printChoice, setPrintChoice] = useState<Record<string, string>>({});

  function add(card: CatalogCard) {
    addCardFrom(deckId, toNewCardInput(card));
    setAddedId(card.id);
  }

  return (
    <div className="mt-4 rounded-ctl border hairline bg-paper p-3">
      <input
        type="search"
        value={query}
        aria-label={t("catalog.search.aria")}
        placeholder={t("catalog.search.placeholder")}
        onFocus={ensureCatalog}
        onChange={(e) => {
          ensureCatalog();
          setQuery(e.target.value);
          setDetailId(null);
          setAddedId(null);
        }}
        className="h-10 w-full rounded-ctl border hairline bg-surface px-3 text-base"
      />

      <label className="mt-2 flex items-center gap-1.5 text-xs text-ink2">
        <input
          type="checkbox"
          checked={stdOnly}
          onChange={(e) => setStdOnly(e.target.checked)}
          className="h-4 w-4 accent-blue"
        />
        {t("catalog.stdOnly")}
      </label>

      {status === "loading" && (
        <p className="mt-2 text-sm text-ink2" role="status">
          {t("catalog.loading")}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-warn" role="alert">
          {t("catalog.error")}{" "}
          <button type="button" onClick={ensureCatalog} className="underline">
            {t("catalog.retry")}
          </button>
        </p>
      )}

      {status === "ready" && catalog !== null && query.trim() !== "" && (
        <>
          {groups.length === 0 ? (
            <p className="mt-2 text-sm text-ink2">{t("catalog.empty")}</p>
          ) : (
            <ul aria-label={t("catalog.results.aria")} className="mt-2 max-h-80 overflow-y-auto">
              {groups.map(({ rep, prints }) => {
                // Selected print (default = representative); same-name prints
                // (e.g. which set's basic energy) chosen via the version select.
                const card = prints.find((p) => p.id === printChoice[rep.name]) ?? rep;
                const setInfo = catalog.sets[card.set ?? ""];
                const open = detailId === rep.name;
                return (
                  <li key={rep.name} className="border-b hairline last:border-b-0">
                    <div
                      className="flex items-center gap-2 rounded-ctl py-1.5"
                      style={{ backgroundColor: `${cardAccent(card)}0D` }}
                    >
                      <button
                        type="button"
                        aria-label={
                          t("catalog.addAria", { name: card.name, id: card.id }) +
                          (card.usage !== undefined ? `,${t("catalog.usageAria", { p: card.usage })}` : "") +
                          (card.std !== true ? `,${t("catalog.legal.not")}` : "") +
                          (addedId === card.id ? `,${t("catalog.added")}` : "")
                        }
                        onClick={() => add(card)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-ctl px-1 py-1 text-left hover:bg-surface"
                      >
                        {cardType(card) !== null ? (
                          <span
                            className="shrink-0"
                            title={t(typeKey(cardType(card) as string) ?? "")}
                            style={{ color: cardAccent(card) }}
                          >
                            <TypeIcon type={cardType(card) as string} />
                          </span>
                        ) : (
                          <span
                            aria-hidden
                            className="h-4 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: cardAccent(card) }}
                          />
                        )}
                        <CardName card={card} className="min-w-0 flex-1 truncate text-base" />
                        {(card.fn ?? []).slice(0, 3).map((k) => (
                          <FnChip key={k} tag={k} compact />
                        ))}
                        {card.usage !== undefined && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-pink px-1.5 py-0.5 font-mono text-xs text-pink">
                            <IconFlame size="sm" />
                            {t("catalog.usage", { p: card.usage })}
                          </span>
                        )}
                        <span className="shrink-0 rounded-ctl border hairline px-1.5 py-0.5 text-xs text-ink2">
                          {kindBadge(card)}
                        </span>
                        {card.hp !== undefined && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-xs text-ink2">
                            <IconHP size="sm" />
                            {card.hp}
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-xs text-ink2">
                          {card.set ?? "?"} {card.localId}
                        </span>
                        {card.std === true ? (
                          <IconLegal size="sm" className="shrink-0 text-good" />
                        ) : (
                          <IconIllegal size="sm" className="shrink-0 text-ink2" />
                        )}
                        {addedId === card.id && (
                          <span className="shrink-0 text-xs text-good">{t("catalog.added")}</span>
                        )}
                      </button>
                      {prints.length > 1 && (
                        <select
                          aria-label={t("catalog.version", { name: rep.name })}
                          value={card.id}
                          onChange={(e) =>
                            setPrintChoice((m) => ({ ...m, [rep.name]: e.target.value }))
                          }
                          className="h-9 shrink-0 rounded-ctl border hairline bg-surface px-1 font-mono text-xs text-ink2"
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
                        aria-expanded={open}
                        onClick={() => setDetailId(open ? null : rep.name)}
                        className="h-9 w-9 shrink-0 rounded-ctl border hairline bg-surface text-sm text-ink2 hover:text-ink"
                      >
                        ⓘ
                      </button>
                    </div>

                    {open && (
                      <div className="mb-2">
                        <CardVisual card={card} setInfo={setInfo ?? null} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="mt-2 text-xs text-ink2">
        {status === "ready" && catalog !== null
          ? t("catalog.count", {
              n: catalog.count,
              sets: Object.keys(catalog.sets).length,
            }) + " · "
          : ""}
        {status === "ready" && catalog?.meta !== undefined
          ? t("catalog.metaSource", {
              n: catalog.meta.sampleDecks,
              from: catalog.meta.dateFrom,
              to: catalog.meta.dateTo,
            }) + " · "
          : ""}
        {t("catalog.source")} {t("catalog.hint")}
      </p>
    </div>
  );
}
