import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import {
  loadCatalog,
  searchCatalog,
  toNewCardInput,
  stageKey,
  trainerTypeKey,
  energyTypeKey,
  typeKey,
  type Catalog,
  type CatalogCard,
} from "../data/catalog.ts";

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

  /** i18n label when the raw enum is known, the raw data value otherwise. */
  const label = (key: string | null, raw: string) => (key !== null ? t(key) : raw);

  const kindBadge = (card: CatalogCard): string => {
    if (card.category === "Pokemon") {
      return card.stage !== undefined
        ? label(stageKey(card.stage), card.stage)
        : t("catalog.cat.pokemon");
    }
    if (card.category === "Trainer") {
      return card.trainerType !== undefined
        ? label(trainerTypeKey(card.trainerType), card.trainerType)
        : t("catalog.cat.trainer");
    }
    return card.energyType !== undefined
      ? label(energyTypeKey(card.energyType), card.energyType)
      : t("catalog.cat.energy");
  };

  const costText = (cost: string[] | undefined): string =>
    (cost ?? []).map((c) => label(typeKey(c), c)).join("·");

  function add(card: CatalogCard) {
    addCardFrom(deckId, toNewCardInput(card));
    setAddedId(card.id);
  }

  return (
    <div className="mt-4 rounded-ctl border hairline bg-bg p-3">
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
                        aria-label={t("catalog.addAria", { name: card.name, id: card.id })}
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
                        className="h-8 w-8 shrink-0 rounded-ctl border hairline bg-surface text-sm text-ink2 hover:text-ink"
                      >
                        ⓘ
                      </button>
                    </div>

                    {open && (
                      <div className="mb-2 rounded-ctl border hairline bg-surface p-3 text-sm">
                        <p className="text-xs text-ink2">
                          {t("catalog.set")}:{setInfo?.name ?? "?"}({card.set ?? "?"}{" "}
                          {card.localId}
                          {setInfo?.official != null && ` / ${setInfo.official}`})
                          {setInfo?.date != null && ` · ${t("catalog.date")} ${setInfo.date}`}
                          {card.rarity !== undefined && card.rarity !== "None" && ` · ${card.rarity}`}
                          {card.regulationMark !== undefined &&
                            ` · ${t("catalog.mark")} ${card.regulationMark}`}
                        </p>
                        {card.category === "Pokemon" && (
                          <p className="mt-1 text-xs text-ink2">
                            {(card.types ?? []).map((ty) => label(typeKey(ty), ty)).join("·")}
                            {card.hp !== undefined && ` · HP ${card.hp}`}
                            {card.evolveFrom !== undefined &&
                              ` · ${t("catalog.evolveFrom")} ${card.evolveFrom}`}
                            {card.dexId !== undefined &&
                              ` · ${t("catalog.dex")} #${card.dexId.join("/#")}`}
                          </p>
                        )}
                        {(card.abilities ?? []).map((ab) => (
                          <p key={ab.name} className="mt-2">
                            <span className="font-medium">
                              {t("catalog.ability")}:{ab.name}
                            </span>
                            {ab.effect !== undefined && (
                              <span className="block text-ink2">{ab.effect}</span>
                            )}
                          </p>
                        ))}
                        {(card.attacks ?? []).map((atk) => (
                          <p key={atk.name} className="mt-2">
                            <span className="font-medium">
                              {costText(atk.cost) !== "" && (
                                <span className="mr-1 font-mono text-xs text-ink2">
                                  [{costText(atk.cost)}]
                                </span>
                              )}
                              {atk.name}
                              {atk.damage !== undefined && (
                                <span className="ml-1 font-mono">{atk.damage}</span>
                              )}
                            </span>
                            {atk.effect !== undefined && (
                              <span className="block text-ink2">{atk.effect}</span>
                            )}
                          </p>
                        ))}
                        {card.effect !== undefined && <p className="mt-2 text-ink2">{card.effect}</p>}
                        {(card.weaknesses !== undefined ||
                          card.resistances !== undefined ||
                          card.retreat !== undefined) && (
                          <p className="mt-2 text-xs text-ink2">
                            {card.weaknesses !== undefined &&
                              `${t("catalog.weakness")} ${card.weaknesses
                                .map((w) => `${label(typeKey(w.type), w.type)}${w.value ?? ""}`)
                                .join("、")}`}
                            {card.resistances !== undefined &&
                              ` · ${t("catalog.resistance")} ${card.resistances
                                .map((w) => `${label(typeKey(w.type), w.type)}${w.value ?? ""}`)
                                .join("、")}`}
                            {card.retreat !== undefined &&
                              ` · ${t("catalog.retreat")} ${card.retreat}`}
                          </p>
                        )}
                        {card.description !== undefined && (
                          <p className="mt-2 text-xs italic text-ink2">{card.description}</p>
                        )}
                        {card.illustrator !== undefined && (
                          <p className="mt-1 text-xs text-ink2">
                            {t("catalog.illustrator")}:{card.illustrator}
                          </p>
                        )}
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
