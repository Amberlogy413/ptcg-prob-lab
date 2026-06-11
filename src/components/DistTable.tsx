import { useT } from "../i18n/index.ts";
import { downloadCsv } from "../utils/csv.ts";
import type { DistRowData } from "../state/selectors.ts";

interface DistTableProps {
  rows: DistRowData[];
  caption: string;
  /** i18n key for the k column header (defaults to the Q1 Basics label). */
  kLabelKey?: string;
  /** When set, shows a CSV export button with this filename (no extension). */
  csvName?: string;
}

/**
 * Distribution table (docs/04 §5 layer 2): k | probability | exact fraction |
 * 1 in N | inline micro-bar. All numerals mono, right-aligned.
 */
export function DistTable({ rows, caption, kLabelKey = "q1.table.k", csvName }: DistTableProps) {
  const t = useT();
  const max = Math.max(...rows.map((r) => r.chart), 1e-9);

  function exportCsv(): void {
    if (!csvName) return;
    downloadCsv(
      `${csvName}.csv`,
      ["k", "probability", "exact_fraction", "one_in_n"],
      rows.map((r) => [String(r.k), r.percent, r.fraction, r.oneIn]),
    );
  }

  return (
    <div>
      {csvName && (
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink"
          >
            {t("table.csv")}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b hairline text-left text-xs text-ink2">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                {t(kLabelKey)}
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
            {rows.map((r) => (
              <tr key={r.k} className="border-b hairline last:border-b-0">
                <td className="py-1.5 pr-3 font-mono">{r.k}</td>
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
    </div>
  );
}
