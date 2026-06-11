import { useT } from "../i18n/index.ts";
import type { DistRowData } from "../state/selectors.ts";

/**
 * Distribution table (docs/04 §5 layer 2): k | probability | exact fraction |
 * 1 in N | inline micro-bar. All numerals mono, right-aligned.
 */
export function DistTable({ rows, caption }: { rows: DistRowData[]; caption: string }) {
  const t = useT();
  const max = Math.max(...rows.map((r) => r.chart), 1e-9);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b hairline text-left text-xs text-ink2">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              {t("q1.table.k")}
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
  );
}
