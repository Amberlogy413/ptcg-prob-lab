import { useEffect, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, type Deck } from "../state/deckStore.ts";
import { useQueryStore, constraintBounds, type TrackedQueryCard } from "../state/queryStore.ts";
import { useComboResult } from "../state/useComboResult.ts";
import { useIsNarrow } from "../utils/useIsNarrow.ts";
import { QueryBuilder } from "../components/QueryBuilder.tsx";
import { Q2Wizard } from "../components/Q2Wizard.tsx";
import { Q2ResultCard } from "../components/Q2ResultCard.tsx";
import { encodeShare } from "../utils/share.ts";
import { downloadResultCardPng } from "../utils/resultCard.ts";
import { buildSensitivityPlan, finishSensitivity, type SensitivityRow } from "../state/q5.ts";
import { runComboBatch } from "../state/comboBatch.ts";
import type { Q2Data } from "../state/selectors.ts";
import { HAND_SIZE } from "../constants.ts";

/** Q2 section: sentence builder on desktop, step wizard under 768px. */
export function Q2Section() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const tracked = useQueryStore((s) => s.tracked);
  const mulliganAware = useQueryStore((s) => s.mulliganAware);
  const narrow = useIsNarrow();
  const state = useComboResult(deck, tracked, mulliganAware);

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("q2.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  const ready = state.status === "ready";

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("q2.title")}</h2>
      <div className="mt-3">
        {narrow ? (
          <Q2Wizard deck={deck} state={state} />
        ) : (
          <>
            <QueryBuilder deck={deck} />
            <Q2ResultCard state={state} />
          </>
        )}
        {ready && state.status === "ready" && (
          <ResultActions deck={deck} tracked={tracked} aware={mulliganAware} data={state.data} />
        )}
        {ready && tracked.length > 0 && (
          <SensitivityBlock deck={deck} q={tracked[0] as TrackedQueryCard} aware={mulliganAware} />
        )}
      </div>
    </section>
  );
}

/** Share link + result-card PNG (docs/03 §7). */
function ResultActions({
  deck,
  tracked,
  aware,
  data,
}: {
  deck: Deck;
  tracked: TrackedQueryCard[];
  aware: boolean;
  data: Q2Data;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [tooLong, setTooLong] = useState(false);

  async function share(): Promise<void> {
    const { fragment, tooLong: long } = encodeShare({
      schema: 1,
      deck: {
        name: deck.name,
        cards: deck.cards
          .filter((c) => c.name.trim() !== "" && c.count > 0)
          .map((c) => ({ name: c.name, count: c.count, isBasic: c.isBasic })),
      },
      query: {
        type: "q2",
        tracked: tracked.flatMap((q) => {
          const card = deck.cards.find((c) => c.id === q.cardId);
          return card ? [{ name: card.name, kind: q.kind, n: q.n, a: q.a, b: q.b }] : [];
        }),
        mulliganAware: aware,
      },
    });
    setTooLong(long);
    const url = `${window.location.origin}${window.location.pathname}${fragment}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[share] clipboard write failed:", err);
    }
  }

  async function exportPng(): Promise<void> {
    try {
      await downloadResultCardPng(
        {
          title: data.legend,
          percent: data.headline.percent,
          fraction: data.headline.fraction,
          oneIn: data.headline.oneIn,
          conditionLabel: data.conditioned ? t("toggle.mulligan.on") : t("toggle.mulligan.off"),
          badge: t("badge.exact"),
          product: t("app.title"),
          footer: t("receipt.footer"),
        },
        "ptcg-prob-result.png",
      );
    } catch (err) {
      console.warn("[png] export failed:", err);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
      >
        {copied ? t("share.copied") : t("share.button")}
      </button>
      <button
        type="button"
        onClick={() => void exportPng()}
        className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
      >
        {t("png.button")}
      </button>
      {tooLong && <span className="text-xs text-warn">{t("share.tooLong")}</span>}
    </div>
  );
}

/** 敏感度滑桿 (docs/04 §6): sweep the first tracked card's count 0–4 through
 *  the Worker batch; deck size held constant via filler swap. */
function SensitivityBlock({
  deck,
  q,
  aware,
}: {
  deck: Deck;
  q: TrackedQueryCard;
  aware: boolean;
}) {
  const t = useT();
  const [rows, setRows] = useState<SensitivityRow[] | null>(null);
  const card = deck.cards.find((c) => c.id === q.cardId);
  const minWant = card ? constraintBounds(q, card.count, HAND_SIZE)[0] : 1;

  useEffect(() => {
    let stale = false;
    setRows(null);
    if (!card) return;
    const plan = buildSensitivityPlan(deck, card.name, Math.max(minWant, 1), aware);
    if (!plan) return;
    void runComboBatch(plan.jobs).then((results) => {
      if (stale) return;
      if (results.some((r) => r === null)) return;
      setRows(finishSensitivity(plan, results.map((r) => r!.event)));
    });
    return () => {
      stale = true;
    };
  }, [deck, card, minWant, aware]);

  if (!card || !rows) return null;

  return (
    <div className="mt-5 border-t hairline pt-4">
      <h3 className="text-sm font-medium">
        {t("sens.title", { name: card.name, count: card.count })}
      </h3>
      <p className="mt-1 text-xs text-ink2">{t("sens.assumption")}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-auto border-collapse text-sm">
          <caption className="sr-only">{t("sens.title", { name: card.name, count: card.count })}</caption>
          <thead>
            <tr className="border-b hairline text-left text-xs text-ink2">
              <th scope="col" className="py-1 pr-4 font-medium">{t("deck.card.count")}</th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">{t("table.probability")}</th>
              <th scope="col" className="py-1 text-right font-medium">{t("table.fraction")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.count} className={"border-b hairline last:border-b-0" + (r.current ? " bg-paper" : "")}>
                <td className="py-1 pr-4 font-mono">
                  {r.count}
                  {r.current && <span className="ml-1 text-xs text-blue">{t("sens.current")}</span>}
                </td>
                <td className="py-1 pr-4 text-right font-mono">{r.percent}</td>
                <td className="py-1 text-right font-mono">{r.fraction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
