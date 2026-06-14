/**
 * Unified button geometry (docs/07_DESIGN_SYSTEM.md §2.6) — one shape across the
 * product, only the fill differs. ALL fills are neutral graphite (the single UI
 * accent); no green/yellow/blue chrome. Borrowed from the PriceRight button
 * system's geometry, NOT its hue.
 */
export type ButtonVariant = "primary" | "ghost" | "secondary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-ctl px-5 py-2.5 text-sm font-medium " +
  "transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-blue text-white hover:shadow-soft",
  ghost: "border hairline bg-surface text-ink2 hover:bg-paper hover:text-ink",
  secondary: "border-2 border-blue bg-surface text-blue hover:bg-accent-50",
};

/** Class string for a button variant (compose with extra classes as needed). */
export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${BASE} ${VARIANT[variant]}${extra ? " " + extra : ""}`;
}
