import { useMemo } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { computeDeckSummary } from "../state/selectors.ts";
import { PrecisionRuler } from "./PrecisionRuler.tsx";
import { ProofNumber, type Proof } from "./ProofNumber.tsx";
import { buildExplain } from "../data/explain.ts";
import { IconWarn, IconRotate, IconLegal } from "./icons.tsx";
import { DECK_SIZE } from "../constants.ts";
import { deckLegality } from "../utils/deckRules.ts";

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
  const legal = useMemo(() => (deck ? deckLegality(deck.cards) : null), [deck]);

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

          {/* Real PTCG legality (owner mandate 2026-06-15) — display only,
              never gates the math. */}
          {legal && (
            <div className="space-y-1 text-xs">
              {legal.legal ? (
                <p className="flex items-center gap-1 text-good">
                  <IconLegal size="sm" />
                  {t("deck.legal.ok")}
                </p>
              ) : (
                <>
                  {legal.overSize && (
                    <p className="flex items-center gap-1 text-warn">
                      <IconWarn size="sm" />
                      {t("deck.legal.over", { n: legal.total - DECK_SIZE })}
                    </p>
                  )}
                  {!legal.overSize && legal.total > 0 && legal.total < DECK_SIZE && (
                    <p className="flex items-center gap-1 text-warn">
                      <IconWarn size="sm" />
                      {t("deck.legal.under", { n: DECK_SIZE - legal.total })}
                    </p>
                  )}
                  {legal.copyViolations.map((v) => (
                    <p key={v.name} className="flex items-center gap-1 text-warn">
                      <IconWarn size="sm" />
                      {t("deck.legal.copies", { name: v.name, n: v.count })}
                    </p>
                  ))}
                  {!legal.radiantOk && (
                    <p className="flex items-center gap-1 text-warn">
                      <IconWarn size="sm" />
                      {t("deck.legal.radiant", { n: legal.radiantCount })}
                    </p>
                  )}
                  {legal.total > 0 && !legal.hasBasicPokemon && (
                    <p className="flex items-center gap-1 text-warn">
                      <IconWarn size="sm" />
                      {t("deck.legal.noBasic")}
                    </p>
                  )}
                </>
              )}
              <p className="text-ink2 opacity-70">{t("deck.legal.aceNote")}</p>
            </div>
          )}

          <div className="border-t hairline pt-3">
            <h3 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink2">
              <IconRotate size="sm" />
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
                <ProofNumber
                  className="font-mono text-xl"
                  title={t("summary.mulligan")}
                  value={summary.mulligan.percent}
                  explain={buildExplain(t, "mulligan", {
                    pct: summary.mulligan.percent,
                    frac: summary.mulligan.fraction,
                    oneIn: summary.mulligan.oneIn,
                  })}
                  proof={
                    ((): Proof => {
                      const N = summary.total;
                      const B = summary.basics;
                      const m = summary.mulligan!;
                      return {
                        receipt: [
                          { label: t("proof.formula"), text: "P = C(N−B, 7) / C(N, 7)" },
                          { label: t("proof.sub"), text: `C(${N}−${B}, 7) / C(${N}, 7) = C(${N - B}, 7) / C(${N}, 7)` },
                          { label: t("proof.frac"), text: m.fraction },
                          { label: t("proof.pct"), text: m.percent },
                          { label: t("proof.oneIn"), text: m.oneIn },
                        ],
                        interpret: t("proof.mulligan.interp", {
                          basics: B,
                          pct: m.percent,
                          oneIn: m.oneIn,
                        }),
                      };
                    })()
                  }
                />
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
                    <dt className="inline-flex items-center gap-1 text-ink2">
                      <IconLegal size="sm" className="text-good" />
                      {t("summary.validHand")}
                    </dt>
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

