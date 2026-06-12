import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import {
  loadCatalog,
  searchCatalog,
  toNewCardInput,
  kindOf,
  type Catalog,
  type CatalogCard,
} from "../data/catalog.ts";
import { CardVisual } from "./CardVisual.tsx";

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

  const results = useMemo(
    () => (catalog !== null && query.trim() !== "" ? searchCatalog(catalog, query, 50) : []),
    [catalog, query],
  );

  const kindBadge = (card: CatalogCard): string => {
    const kind = kindOf(card);
    return kind.key !== null ? t(kind.key) : kind.raw;
  };

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
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-ink2">{t("catalog.empty")}</p>
          ) : (
            <ul aria-label={t("catalog.results.aria")} className="mt-2 max-h-80 overflow-y-auto">
              {results.map((card) => {
                const setInfo = catalog.sets[card.set ?? ""];
                const open = detailId === card.id;
                return (
                  <li key={card.id} className="border-b hairline last:border-b-0">
                    <div className="flex items-center gap-2 py-1.5">
                      <button
                        type="button"
                        aria-label={
                          t("catalog.addAria", { name: card.name, id: card.id }) +
                          (card.std !== true ? `,${t("catalog.legal.not")}` : "") +
                          (addedId === card.id ? `,${t("catalog.added")}` : "")
                        }
                        onClick={() => add(card)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-ctl px-1 py-1 text-left hover:bg-surface"
                      >
                        <span className="min-w-0 flex-1 truncate text-base">
                          {card.name}
                          {card.suffix !== undefined &&
                            !card.name.toLowerCase().endsWith(card.suffix.toLowerCase()) && (
                              <span className="ml-1 text-sm text-ink2">{card.suffix}</span>
                            )}
                        </span>
                        <span className="shrink-0 rounded-ctl border hairline px-1.5 py-0.5 text-xs text-ink2">
                          {kindBadge(card)}
                        </span>
                        {card.hp !== undefined && (
                          <span className="shrink-0 font-mono text-xs text-ink2">
                            HP{card.hp}
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-xs text-ink2">
                          {card.set ?? "?"} {card.localId}
                        </span>
                        {card.regulationMark !== undefined && (
                          <span className="shrink-0 rounded-ctl border hairline px-1.5 py-0.5 font-mono text-xs text-ink2">
                            {card.regulationMark}
                          </span>
                        )}
                        <span
                          className={
                            "shrink-0 text-xs " + (card.std === true ? "text-good" : "text-ink2")
                          }
                        >
                          {card.std === true ? t("catalog.legal.std") : t("catalog.legal.not")}
                        </span>
                        {addedId === card.id && (
                          <span className="shrink-0 text-xs text-good">{t("catalog.added")}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={t("catalog.detailAria", { name: card.name })}
                        aria-expanded={open}
                        onClick={() => setDetailId(open ? null : card.id)}
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
        {t("catalog.source")} {t("catalog.hint")}
      </p>
    </div>
  );
}
