import type { ReactNode } from "react";

/**
 * Contextual teaching bar (docs/07_DESIGN_SYSTEM.md §2.4) — explains "what this
 * choice changes" next to options/toggles, or lists blocking validation. The
 * PriceRight colour-graded hint vocabulary, RE-MAPPED to neutral graphite:
 * consequence/reward use the graphite accent wash (NOT green/yellow — those
 * collide with type colours); only blocking/caution use the existing transient
 * semantic colours (bad/warn), consistent with DeltaBadge usage. Emoji carry
 * the semantics, not hue.
 */
export type HintVariant = "neutral" | "consequence" | "reward" | "blocking" | "caution";

const VARIANT: Record<HintVariant, string> = {
  neutral: "border-line bg-paper text-ink",
  consequence: "border-line bg-accent-50 text-ink",
  reward: "border-line bg-accent-50 text-ink",
  blocking: "border-bad/40 bg-bad/5 text-bad",
  caution: "border-warn/40 bg-warn/5 text-warn",
};

export function HintBar({
  variant = "neutral",
  icon,
  children,
}: {
  variant?: HintVariant;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={variant === "blocking" ? "alert" : "note"}
      className={`flex items-start gap-2.5 rounded-card border-2 p-4 text-sm ${VARIANT[variant]}`}
    >
      {icon !== undefined && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
