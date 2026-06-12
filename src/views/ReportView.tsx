import { useMemo, type ReactNode } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, deckTotal, deckBasics } from "../state/deckStore.ts";
import { useUiStore } from "../state/uiStore.ts";
import { useQueryStore } from "../state/queryStore.ts";
import { useGradeStore } from "../state/gradeStore.ts";
import { computeQ1 } from "../state/selectors.ts";
import { computeGrades, computeEnergyCurve } from "../state/q5.ts";
import { computeQ3Single } from "../state/q3.ts";
import { useComboResult } from "../state/useComboResult.ts";
import { MathReceipt, type ReceiptLine } from "../components/MathReceipt.tsx";
import { buildReportCardSvg, type ReportCardLine } from "../utils/reportCard.ts";
import { downloadSvgPng } from "../utils/svgPng.ts";
import { DECK_SIZE } from "../constants.ts";

/**
 * P9.1 牌組數學體檢報告 (docs/08 §5C): one page, every vital sign of the
 * deck as an EXACT number, each expandable to the same math receipt its
 * source view shows — consistency by construction (same selectors, same
 * stores). Zero new math: Phases 2–7 composed.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h3 className="text-lg font-medium">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Cta({ text, action, onGo }: { text: string; action: string; onGo: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink2">{text}</p>
      <button
        type="button"
        onClick={onGo}
        className="rounded-ctl border hairline px-3 py-1.5 text-sm text-blue hover:underline"
      >
        {action}
      </button>
    </div>
  );
}

export function ReportView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setAskTab = useUiStore((s) => s.setAskTab);
  const tracked = useQueryStore((s) => s.tracked);
  const mulliganAware = useQueryStore((s) => s.mulliganAware);
  const ideal = useGradeStore((s) => s.ideal);
  const playable = useGradeStore((s) => s.playable);

  const q1 = useMemo(() => computeQ1(deck), [deck]);
  const grades = useMemo(
    () => (deck ? computeGrades(deck, { ideal, playable }) : null),
    [deck, ideal, playable],
  );
  const combo = useComboResult(deck, tracked, mulliganAware);

  const total = deck ? deckTotal(deck) : 0;
  const basics = deck ? deckBasics(deck) : 0;
  const energyCount = useMemo(
    () =>
      (deck?.cards ?? [])
        .filter((c) => c.section === "energy")
        .reduce((s, c) => s + c.count, 0),
    [deck],
  );
  const energy = useMemo(
    () =>
      energyCount > 0 && basics >= 1
        ? computeEnergyCurve(energyCount, basics, 1, false, false, 3, total)
        : null,
    [energyCount, basics, total],
  );

  const prizeRows = useMemo(() => {
    if (!deck || total !== DECK_SIZE) return [];
    return deck.cards
      .filter((c) => c.name.trim() !== "" && c.count >= 2 && c.count <= 4)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((c) => ({
        name: c.name,
        count: c.count,
        r: computeQ3Single("uncond", { x: c.count, h: 0, isBasic: false, otherBasics: 0 }),
      }));
  }, [deck, total]);

  if (!deck || q1.status !== "ok") {
    const msgKey =
      !deck || q1.status === "noDeck"
        ? "summary.noDeck"
        : q1.status === "tooFewCards"
          ? "summary.needCards"
          : "summary.noBasics";
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("report.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t(msgKey)}</p>
      </section>
    );
  }

  const q1d = q1.data;
  // Identical line construction to Q1Section — the receipts must match.
  const q1Receipt: ReceiptLine[] = [
    { label: t("receipt.label.formula"), text: t("receipt.q1.formula", q1d.receipt.formula) },
    { label: t("receipt.label.subst"), text: t("receipt.q1.subst", q1d.receipt.subst) },
    { label: t("receipt.label.total"), text: t("receipt.q1.total", q1d.receipt.total) },
    {
      label: t("receipt.label.check"),
      text:
        (q1d.receipt.identityOk ? t("receipt.check.identity") : "✗ Σ P(k) ≠ 1") +
        (q1d.receipt.goldenId ? ";" + t("receipt.check.golden", { id: q1d.receipt.goldenId }) : ""),
    },
  ];

  async function sharePng(): Promise<void> {
    const lines: ReportCardLine[] = [
      { label: t("report.mull"), value: `${q1d.headline.percent} = ${q1d.headline.fraction}` },
      { label: t("report.valid"), value: q1d.validPercent },
    ];
    if (grades) {
      lines.push(
        { label: t("grade.ideal"), value: grades.ideal.percent },
        { label: t("grade.playableOnly"), value: grades.playableOnly.percent },
        { label: t("grade.dead"), value: grades.dead.percent },
      );
    }
    if (combo.status === "ready") {
      lines.push({
        label: t("report.combo"),
        value: `${combo.data.headline.percent} = ${combo.data.headline.fraction}`,
      });
    }
    if (energy) {
      const t2 = energy.rows[1] ?? energy.rows[0];
      if (t2) {
        lines.push({
          label: `${t("report.energy")} (T${t2.turn})`,
          value: t2.percent,
        });
      }
    }
    for (const row of prizeRows) {
      lines.push({
        label: t("report.prizes.row", { name: row.name, x: row.count }),
        value: row.r.headline.percent,
      });
    }
    const { svg, width, height } = buildReportCardSvg(
      {
        title: `${t("report.title")} — ${deck!.name || t("deck.untitled")}`,
        badge: t("badge.exact"),
        product: t("app.title"),
        footer: t("receipt.footer"),
      },
      lines,
    );
    try {
      await downloadSvgPng(svg, width, height, `${deck!.name || "deck"}-report.png`);
    } catch (err) {
      console.warn("[report] png failed:", err);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">{t("report.title")}</h2>
            <p className="mt-1 text-xs text-ink2">{t("report.desc")}</p>
          </div>
          <button
            type="button"
            onClick={() => void sharePng()}
            className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white"
          >
            {t("report.share")}
          </button>
        </div>
      </section>

      <Section title={t("report.mull")}>
        <p className="font-mono text-2xl">{q1d.headline.percent}</p>
        <p className="mt-1 font-mono text-sm text-ink2">
          {q1d.headline.fraction} · {q1d.headline.oneIn}
        </p>
        <p className="mt-1 font-mono text-xs text-ink2">
          {t("report.valid")}: {q1d.validPercent}
        </p>
        <MathReceipt lines={q1Receipt} />
      </Section>

      <Section title={t("report.grades")}>
        {grades ? (
          <>
            <div className="grid gap-3 font-mono text-sm sm:grid-cols-3">
              <p>
                <span className="text-ink2">{t("grade.ideal")}</span>
                <br />
                <span className="text-good">{grades.ideal.percent}</span>
              </p>
              <p>
                <span className="text-ink2">{t("grade.playableOnly")}</span>
                <br />
                <span className="text-warn">{grades.playableOnly.percent}</span>
              </p>
              <p>
                <span className="text-ink2">{t("grade.dead")}</span>
                <br />
                <span className="text-bad">{grades.dead.percent}</span>
              </p>
            </div>
            <p className="mt-2 font-mono text-xs text-ink2">
              {grades.identityOk ? "✓ Σ = 1" : "✗ Σ ≠ 1"} ·{" "}
              {t("q2.pValid", { fraction: grades.pValid.fraction, percent: grades.pValid.percent })}
            </p>
          </>
        ) : (
          <Cta
            text={t("report.grades.cta")}
            action={t("report.grades.go")}
            onGo={() => {
              setAskTab("grade");
              setActiveView("ask");
            }}
          />
        )}
      </Section>

      <Section title={t("report.combo")}>
        {tracked.length === 0 ? (
          <Cta
            text={t("report.combo.cta")}
            action={t("report.combo.go")}
            onGo={() => {
              setAskTab("q2");
              setActiveView("ask");
            }}
          />
        ) : combo.status === "ready" ? (
          <>
            <p className="font-mono text-2xl">{combo.data.headline.percent}</p>
            <p className="mt-1 font-mono text-sm text-ink2">
              {combo.data.headline.fraction} · {combo.data.headline.oneIn}
            </p>
            <MathReceipt
              lines={[
                { label: t("receipt.label.formula"), text: combo.data.receipt.formula },
                { label: t("receipt.label.subst"), text: combo.data.receipt.substitution },
                { label: t("receipt.label.total"), text: t("receipt.q2.total", combo.data.receipt.total) },
                ...(combo.data.receipt.cond
                  ? [{ label: t("receipt.label.cond"), text: t("receipt.q2.cond", combo.data.receipt.cond) }]
                  : []),
              ]}
            />
          </>
        ) : combo.status === "computing" ? (
          <p className="text-sm text-ink2" role="status">
            {t("q2.computing")}
          </p>
        ) : combo.status === "error" ? (
          <p className="text-sm text-bad">{t("q2.error", { message: combo.message })}</p>
        ) : (
          <p className="text-sm text-ink2">{t("report.combo.cta")}</p>
        )}
      </Section>

      <Section title={t("report.energy")}>
        {energy ? (
          <>
            <table className="w-full border-collapse font-mono text-sm">
              <caption className="sr-only">{t("report.energy")}</caption>
              <tbody>
                {energy.rows.map((row) => (
                  <tr key={row.turn} className="border-b hairline last:border-b-0">
                    <td className="py-1 pr-3 text-ink2">
                      {t("report.energy.turn", { t: row.turn, n: row.nSeen })}
                    </td>
                    <td className="py-1 text-right">{row.percent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-mono text-xs text-ink2">
              {t("q2.pValid", { fraction: energy.pValid.fraction, percent: energy.pValid.percent })}{" "}
              · E = {energyCount}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink2">{t("report.energy.none")}</p>
        )}
      </Section>

      <Section title={t("report.prizes")}>
        {total !== DECK_SIZE ? (
          <p className="text-sm text-ink2">{t("report.prizes.need60")}</p>
        ) : prizeRows.length === 0 ? (
          <p className="text-sm text-ink2">{t("report.prizes.none")}</p>
        ) : (
          <>
            <table className="w-full border-collapse font-mono text-sm">
              <caption className="sr-only">{t("report.prizes")}</caption>
              <tbody>
                {prizeRows.map((row) => (
                  <tr key={row.name} className="border-b hairline last:border-b-0">
                    <td className="py-1 pr-3">
                      {t("report.prizes.row", { name: row.name, x: row.count })}
                    </td>
                    <td className="py-1 text-right">{row.r.headline.percent}</td>
                    <td className="py-1 pl-3 text-right text-ink2">
                      E = {row.r.expected.decimal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <MathReceipt
              lines={prizeRows.map((row) => ({
                label: `×${row.count}`,
                text: `${row.name}: ${row.r.headline.percent} = ${row.r.headline.fraction}${
                  row.r.receipt.goldenId ? " · " + t("receipt.check.golden", { id: row.r.receipt.goldenId }) : ""
                }`,
              }))}
            />
          </>
        )}
      </Section>
    </div>
  );
}
