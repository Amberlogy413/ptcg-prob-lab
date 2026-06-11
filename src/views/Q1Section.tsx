import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { computeQ1 } from "../state/selectors.ts";
import { PrecisionRuler } from "../components/PrecisionRuler.tsx";
import { MathReceipt, type ReceiptLine } from "../components/MathReceipt.tsx";
import { MulliganDashboard } from "../components/MulliganDashboard.tsx";
import { DistChart } from "../components/DistChart.tsx";
import { DistTable } from "../components/DistTable.tsx";

/**
 * Q1 section of the Ask workspace (Basics & mulligan). Defaults to the
 * mulligan-aware view, with the conditioning always visible
 * (non-negotiable #3).
 */
export function Q1Section() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const q1 = useMemo(() => computeQ1(deck), [deck]);
  const [distMode, setDistMode] = useState<"conditional" | "raw">("conditional");

  if (q1.status !== "ok") {
    const msgKey =
      q1.status === "noDeck"
        ? "summary.noDeck"
        : q1.status === "tooFewCards"
          ? "summary.needCards"
          : "summary.noBasics";
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("view.ask.q1.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t(msgKey)}</p>
      </section>
    );
  }

  const { data } = q1;

  const receiptLines: ReceiptLine[] = [
    {
      label: t("receipt.label.formula"),
      text: t("receipt.q1.formula", data.receipt.formula),
    },
    {
      label: t("receipt.label.subst"),
      text: t("receipt.q1.subst", data.receipt.subst),
    },
    {
      label: t("receipt.label.total"),
      text: t("receipt.q1.total", data.receipt.total),
    },
    {
      label: t("receipt.label.check"),
      text:
        (data.receipt.identityOk ? t("receipt.check.identity") : "✗ Σ P(k) ≠ 1") +
        (data.receipt.goldenId ? ";" + t("receipt.check.golden", { id: data.receipt.goldenId }) : ""),
    },
  ];

  const distRows = distMode === "conditional" ? data.conditional : data.raw;
  const segBtn = (active: boolean) =>
    "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  return (
    <div className="space-y-4">
      {/* Headline layer (docs/04 §5) */}
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("view.ask.q1.title")}</h2>
        <p className="mt-1 text-sm text-ink2">
          {t("q1.context", { b: data.basics, n: data.total })}
        </p>

        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
            {t("q1.headline.label")}
          </h3>
          <p className="font-mono text-headline leading-none">{data.headline.percent}</p>
          <p className="mt-1 font-mono text-sm text-ink2">
            {data.headline.fraction} · {data.headline.oneIn}
          </p>
          <PrecisionRuler
            value={data.headline.chart}
            labels
            ariaLabel={t("summary.gauge.aria", {
              percent: data.headline.percent,
              fraction: data.headline.fraction,
            })}
          />
          <p className="mt-2 text-sm">
            {data.headline.games
              ? t("q1.headline.interpret", { games: data.headline.games })
              : t("q1.headline.neverMulligan")}
          </p>
        </div>

        <MathReceipt lines={receiptLines} />
      </section>

      {/* Mulligan dashboard 三聯卡 */}
      <MulliganDashboard data={data} />

      {/* Distribution layer */}
      <section className="rounded-card border hairline bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium">{t("q1.dist.title")}</h3>
          <div role="group" aria-label={t("q1.dist.toggleAria")} className="flex gap-1">
            <button
              type="button"
              aria-pressed={distMode === "conditional"}
              onClick={() => setDistMode("conditional")}
              className={segBtn(distMode === "conditional")}
            >
              {t("q1.conditional.title")}
            </button>
            <button
              type="button"
              aria-pressed={distMode === "raw"}
              onClick={() => setDistMode("raw")}
              className={segBtn(distMode === "raw")}
            >
              {t("q1.dist.raw")}
            </button>
          </div>
        </div>

        {distMode === "conditional" && (
          <p className="mt-2 text-xs text-ink2">{t("q1.conditional.note")}</p>
        )}
        <div className="mt-3">
          <DistChart
            rows={distRows}
            ariaLabel={t("q1.chart.aria", {
              mode: distMode === "conditional" ? t("q1.conditional.title") : t("q1.dist.raw"),
            })}
          />
        </div>
        <div className="mt-3">
          <DistTable
            rows={distRows}
            caption={distMode === "conditional" ? t("q1.conditional.title") : t("q1.dist.raw")}
          />
        </div>
        <p className="mt-3 font-mono text-xs text-ink2">
          {t("q1.expectedBasics", {
            fraction: data.expectedBasicsFraction,
            decimal: data.expectedBasicsDecimal,
          })}
        </p>
      </section>
    </div>
  );
}
