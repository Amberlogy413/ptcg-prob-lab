import type { ReactNode } from "react";

/**
 * Numbered icon-tile option card (docs/07_DESIGN_SYSTEM.md §2.1) — the flagship
 * pattern borrowed from PriceRight (owner request #39): an icon tile, a mono
 * `0X` badge, a bold title, and a 2-line ｜-separated sub-description. The whole
 * card is the click target.
 *
 * Single accent = neutral graphite. There is NO second hue for "advanced"
 * options: a subtype is shown as an outline text chip, never a colour. Saturated
 * colour only ever appears INSIDE `icon` when it carries data meaning (a
 * TypeIcon), never as chrome.
 */
export function OptionCard({
  selected,
  onSelect,
  icon,
  badge,
  title,
  subline,
  subtypeTag,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  /** e.g. "01" — omit to hide the number badge. */
  badge?: string;
  title: string;
  /** Already ｜-joined, or pass an array to auto-join. */
  subline?: string | string[];
  /** Outline text chip to distinguish a subtype WITHOUT a second colour. */
  subtypeTag?: string;
  disabled?: boolean;
}) {
  const sub = Array.isArray(subline) ? subline.join(" ｜ ") : subline;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={
        "group flex w-full items-start gap-3 rounded-card border-2 p-4 text-left transition-all duration-fast " +
        (disabled
          ? "cursor-not-allowed border-line bg-surface opacity-50"
          : selected
            ? "border-blue bg-accent-50 shadow-soft hover:shadow-glow"
            : "border-line bg-surface hover:border-blue/40 hover:bg-accent-50/60")
      }
    >
      <span
        aria-hidden
        className={
          "grid h-12 w-12 shrink-0 place-items-center rounded-ctl transition-colors duration-fast " +
          (selected ? "bg-blue text-white" : "bg-paper text-ink2 group-hover:text-ink")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {badge !== undefined && (
            <span
              className={
                "rounded-ctl px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums " +
                (selected ? "bg-blue text-white" : "bg-paper text-ink2")
              }
            >
              {badge}
            </span>
          )}
          <span className="text-base font-medium">{title}</span>
          {subtypeTag !== undefined && (
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink2">
              {subtypeTag}
            </span>
          )}
        </span>
        {sub !== undefined && sub !== "" && <span className="mt-1.5 block text-xs text-ink2">{sub}</span>}
      </span>
    </button>
  );
}

/** Responsive option grid (1 → 2 → 3 columns), the standard OptionCard container. */
export function OptionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
