import { useMemo } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { computeDeckSummary } from "../state/selectors.ts";
import { PrecisionRuler } from "./PrecisionRuler.tsx";
import { DECK_SIZE } from "../constants.ts";

/**
 * Left-column deck summary (docs/04 §3): 60-count check, Basic Pokémon
 * count, and the live mulligan gauge (three formats — the math comes from
 * openingBasics via the selector layer; nothing is computed here).
 */
export function DeckSummary() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const summary = useMemo(() => (deck ? computeDeckSummary(deck) : null), [deck]);

  return (
    <aside className="rounded-card border hairline bg-surface p-4 lg:sticky lg:top-4">
      <h2 className="text-sm font-medium text-ink2">{t("summary.title")}</h2>

      {!deck || !summary ? (
        <p className="mt-3 text-sm text-ink2">{t("summary.noDeck")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-ink2">{t("summary.total")}</dt>
              <dd className="font-mono">
                {summary.total}
                <span className="text-ink2">/{DECK_SIZE}</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-ink2">{t("summary.basics")}</dt>
              <dd className="font-mono">{summary.basics}</dd>
            </div>
          </dl>

          {summary.total !== DECK_SIZE && summary.total > 0 && (
            <p className="text-xs text-warn">{t("error.deckCount", { n: summary.total })}</p>
          )}

          <div className="border-t hairline pt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
              {t("summary.mulligan")}
            </h3>
            {summary.status === "tooFewCards" && (
              <p className="mt-2 text-xs text-ink2">{t("summary.needCards")}</p>
            )}
            {summary.status === "noBasics" && (
              <p className="mt-2 text-xs text-ink2">{t("summary.noBasics")}</p>
            )}
            {summary.status === "ok" && summary.mulligan && (
              <div className="mt-1">
                <p className="font-mono text-xl">{summary.mulligan.percent}</p>
                <p className="font-mono text-xs text-ink2">
                  {summary.mulligan.fraction} · {summary.mulligan.oneIn}
                </p>
                <PrecisionRuler
                  value={summary.mulligan.chart}
                  ariaLabel={t("summary.gauge.aria", {
                    percent: summary.mulligan.percent,
                    fraction: summary.mulligan.fraction,
                  })}
                />
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-ink2">{t("summary.validHand")}</dt>
                    <dd className="font-mono">{summary.mulligan.validPercent}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-ink2">{t("summary.expectedMulligans")}</dt>
                    <dd className="font-mono">{summary.mulligan.expectedMulligans}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

