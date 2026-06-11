import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { PrecisionRuler } from "./PrecisionRuler.tsx";
import { MathReceipt, type ReceiptLine } from "./MathReceipt.tsx";
import type { ComboResultState } from "../state/useComboResult.ts";
import type { Q2Data, Q2TableRow } from "../state/selectors.ts";

const FOLD_LIMIT = 30;

/** Result card, three layers (docs/04 §5): headline / joint table / receipt. */
export function Q2ResultCard({ state }: { state: ComboResultState }) {
  const t = useT();

  if (state.status === "empty") {
    return <p className="mt-4 text-sm text-ink2">{t("q2.empty")}</p>;
  }
  if (state.status === "tooFewCards") {
    return <p className="mt-4 text-sm text-ink2">{t("summary.needCards")}</p>;
  }
  if (state.status === "noBasicsForAware") {
    return <p className="mt-4 text-sm text-warn">{t("error.basicUnknown")}</p>;
  }
  if (state.status === "computing") {
    return (
      <p className="mt-4 font-mono text-sm text-ink2" role="status">
        {t("q2.computing")}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="mt-4 text-sm text-bad" role="alert">
        {t("q2.error", { message: state.message })}
      </p>
    );
  }
  if (state.status === "ready") return <Q2Ready data={state.data} />;
  return null;
}

function Q2Ready({ data }: { data: Q2Data }) {
  const t = useT();

  const receiptLines: ReceiptLine[] = [
    { label: t("receipt.label.formula"), text: data.receipt.formula },
    { label: t("receipt.label.subst"), text: data.receipt.substitution },
    { label: t("receipt.label.total"), text: t("receipt.q2.total", data.receipt.total) },
    ...(data.receipt.cond
      ? [{ label: t("receipt.label.cond"), text: t("receipt.q2.cond", data.receipt.cond) }]
      : []),
    {
      label: t("receipt.label.check"),
      text:
        (data.receipt.identityOk ? t("receipt.check.identity") : "✗ Σ P ≠ 1") +
        (data.receipt.goldenId ? ";" + t("receipt.check.golden", { id: data.receipt.goldenId }) : ""),
    },
  ];

  return (
    <div className="mt-4 border-t hairline pt-4">
      {/* Layer 1 — headline */}
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
        {t("q2.headline.label")}
        <span className="ml-2 normal-case">
          {data.conditioned ? t("toggle.mulligan.on") : t("toggle.mulligan.off")}
        </span>
      </h3>
      <p className="font-mono text-headline leading-none">{data.headline.percent}</p>
      <p className="mt-1 font-mono text-sm text-ink2">
        {data.headline.fraction} · {data.headline.oneIn}
      </p>
      <PrecisionRuler
        value={data.headline.chart}
        labels
        ariaLabel={t("q2.ruler.aria", {
          percent: data.headline.percent,
          fraction: data.headline.fraction,
        })}
      />
      {data.headline.games && (
        <p className="mt-2 text-sm">
          {data.conditioned
            ? t("q2.headline.interpret", { games: data.headline.games })
            : t("q2.headline.interpretRaw", { games: data.headline.games })}
        </p>
      )}
      {data.naive && (
        <p className="mt-1 text-sm text-ink2">
          {t("hint.mulligan.naive", { value: data.naive.percent, delta: data.naive.deltaPp })}
        </p>
      )}
      {data.pValid && (
        <p className="mt-1 font-mono text-xs text-ink2">
          {t("q2.pValid", { fraction: data.pValid.fraction, percent: data.pValid.percent })}
        </p>
      )}

      {/* Layer 3 — receipt (signature element) */}
      <MathReceipt lines={receiptLines} />

      {/* Layer 2 — full joint table */}
      <JointTable data={data} />
    </div>
  );
}

function compareLex(a: Q2TableRow, b: Q2TableRow): number {
  const ka = a.key.split("_").map(Number);
  const kb = b.key.split("_").map(Number);
  for (let i = 0; i < ka.length; i++) {
    if ((ka[i] as number) !== (kb[i] as number)) return (ka[i] as number) - (kb[i] as number);
  }
  return 0;
}

function JointTable({ data }: { data: Q2Data }) {
  const t = useT();
  const [lex, setLex] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () => (lex ? [...data.rows].sort(compareLex) : data.rows),
    [data.rows, lex],
  );
  const visible = expanded ? rows : rows.slice(0, FOLD_LIMIT);
  const max = Math.max(...data.rows.map((r) => r.chart), 1e-9);
  const segBtn = (active: boolean) =>
    "rounded-ctl px-2 py-1 text-xs transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink2">{data.legend}</p>
        <div role="group" aria-label={t("q2.table.sort.aria")} className="flex gap-1">
          <button type="button" aria-pressed={!lex} onClick={() => setLex(false)} className={segBtn(!lex)}>
            {t("q2.table.sortProb")}
          </button>
          <button type="button" aria-pressed={lex} onClick={() => setLex(true)} className={segBtn(lex)}>
            {t("q2.table.sortLex")}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink2">{t("q2.table.satisfiedLegend")}</p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("q2.table.caption")}</caption>
          <thead>
            <tr className="border-b hairline text-left text-xs text-ink2">
              <th scope="col" className="py-1.5 pl-2 pr-3 font-medium">
                {t("q2.table.combo", { header: data.comboHeader })}
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                {t("table.probability")}
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                {t("table.fraction")}
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                {t("table.oneIn")}
              </th>
              <th scope="col" className="w-24 py-1.5 font-medium">
                <span className="sr-only">{t("table.bar")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.key} className="border-b hairline last:border-b-0">
                <td
                  className={
                    "py-1.5 pl-2 pr-3 font-mono " +
                    (r.satisfies ? "border-l-[3px] border-l-blue" : "border-l-[3px] border-l-transparent")
                  }
                >
                  {r.combo}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.percent}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.fraction}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.oneIn}</td>
                <td className="py-1.5">
                  <div className="h-1.5 w-full rounded-full bg-paper">
                    <div
                      className="h-1.5 rounded-full bg-blue"
                      style={{ width: `${(r.chart / max) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > FOLD_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm text-blue hover:underline"
        >
          {expanded ? t("q2.table.collapse") : t("q2.table.expand", { n: rows.length })}
        </button>
      )}
    </div>
  );
}
