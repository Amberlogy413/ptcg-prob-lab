import type { ReactNode } from "react";

/**
 * Section / card header (docs/07_DESIGN_SYSTEM.md §2.5) — title + optional ｜
 * facet sub-label + helper line, the PriceRight "標題 + ｜分隔 facet 列" rhythm.
 * Neutral graphite only; the ｜ sub-label is rendered in the uppercase eyebrow
 * style. Borrowed pattern, not hue.
 */
export function SectionHeader({
  icon,
  title,
  facets,
  helper,
  as: Tag = "h2",
}: {
  icon?: ReactNode;
  title: string;
  /** Facet labels joined by the full-width ｜ separator (e.g. 明細 ｜ 備註 ｜ 訂金). */
  facets?: string[];
  helper?: string;
  as?: "h2" | "h3";
}) {
  return (
    <header className="mb-4">
      <div className="flex items-center gap-2">
        {icon !== undefined && <span className="shrink-0 text-ink2">{icon}</span>}
        <Tag className="text-xl font-medium">{title}</Tag>
      </div>
      {facets !== undefined && facets.length > 0 && (
        <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-ink2">
          {facets.join(" ｜ ")}
        </p>
      )}
      {helper !== undefined && <p className="mt-1.5 text-xs text-ink2">{helper}</p>}
    </header>
  );
}
