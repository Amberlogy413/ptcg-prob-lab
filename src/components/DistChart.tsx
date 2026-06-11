import { useT } from "../i18n/index.ts";
import type { DistRowData } from "../state/selectors.ts";

/**
 * Hand-rolled SVG bar chart (docs/04 §5): single chart blue, hairline axis,
 * native <title> tooltips carrying the exact values.
 */
export function DistChart({ rows, ariaLabel }: { rows: DistRowData[]; ariaLabel: string }) {
  const t = useT();
  const w = 320;
  const h = 130;
  const padB = 18;
  const padT = 6;
  const max = Math.max(...rows.map((r) => r.chart), 1e-9);
  const band = w / rows.length;
  const barW = band * 0.55;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md" role="img" aria-label={ariaLabel}>
      <line x1="0" y1={h - padB + 0.5} x2={w} y2={h - padB + 0.5} stroke="#E3DFD6" strokeWidth="1" />
      {rows.map((r) => {
        const barH = (r.chart / max) * (h - padB - padT);
        const x = r.k * band + (band - barW) / 2;
        const y = h - padB - barH;
        return (
          <g key={r.k}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(barH, r.chart > 0 ? 1 : 0)}
              fill="#2B59C3"
            >
              <title>{t("q1.chart.barTitle", { k: r.k, percent: r.percent, fraction: r.fraction })}</title>
            </rect>
            <text
              x={r.k * band + band / 2}
              y={h - 5}
              textAnchor="middle"
              fontSize="9"
              fill="#5A6069"
              className="font-mono"
            >
              {r.k}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
