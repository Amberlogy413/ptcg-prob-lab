import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { downloadCsv } from "../utils/csv.ts";
import type { Q2TableRow } from "../state/selectors.ts";

const FOLD_LIMIT = 30;

interface JointTableProps {
  legend: string;
  comboHeader: string;
  rows: Q2TableRow[];
  /** CSV download filename (without extension). */
  csvName: string;
}

function compareLex(a: Q2TableRow, b: Q2TableRow): number {
  const ka = a.key.split("_").map(Number);
  const kb = b.key.split("_").map(Number);
  for (let i = 0; i < ka.length; i++) {
    if ((ka[i] as number) !== (kb[i] as number)) return (ka[i] as number) - (kb[i] as number);
  }
  return 0;
}

/** Full joint table (docs/04 §5 layer 2): blue left edge marks satisfying
 *  rows; prob-desc / lexicographic sort; >30 rows fold; CSV export. */
export function JointTable({ legend, comboHeader, rows: rowsProp, csvName }: JointTableProps) {
  const t = useT();
  const [lex, setLex] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => (lex ? [...rowsProp].sort(compareLex) : rowsProp), [rowsProp, lex]);
  const visible = expanded ? rows : rows.slice(0, FOLD_LIMIT);
  const max = Math.max(...rowsProp.map((r) => r.chart), 1e-9);
  const segBtn = (active: boolean) =>
    "rounded-ctl px-2 py-1 text-xs transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  function exportCsv(): void {
    downloadCsv(
      `${csvName}.csv`,
      ["combo", "probability", "exact_fraction", "one_in_n", "satisfies"],
      rows.map((r) => [r.combo, r.percent, r.fraction, r.oneIn, r.satisfies ? "yes" : "no"]),
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink2">{legend}</p>
        <div className="flex items-center gap-1">
          <div role="group" aria-label={t("q2.table.sort.aria")} className="flex gap-1">
            <button type="button" aria-pressed={!lex} onClick={() => setLex(false)} className={segBtn(!lex)}>
              {t("q2.table.sortProb")}
            </button>
            <button type="button" aria-pressed={lex} onClick={() => setLex(true)} className={segBtn(lex)}>
              {t("q2.table.sortLex")}
            </button>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink"
          >
            {t("table.csv")}
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
                {t("q2.table.combo", { header: comboHeader })}
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
