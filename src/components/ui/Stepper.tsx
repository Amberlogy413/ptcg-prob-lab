import { useT } from "../../i18n/index.ts";
import { IconLegal, IconArrowDown } from "../icons.tsx";
import { buttonClass } from "./Button.tsx";

/**
 * In-page stepper (docs/07_DESIGN_SYSTEM.md §2.2) — for flows with a natural
 * order (Q2 builder, import wizard, 組牌工坊, tracker). It does NOT replace the
 * global TopNav. Borrowed from PriceRight: active / done(✓) / locked(🔒) states
 * + jump-back + maxStep gating. Neutral graphite only.
 */
export interface Step {
  id: number;
  label: string;
  subline: string;
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3.5 w-3.5">
      <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

export function Stepper({
  steps,
  current,
  maxStep,
  onJump,
}: {
  steps: Step[];
  current: number;
  maxStep: number;
  onJump: (id: number) => void;
}) {
  const t = useT();
  return (
    <ol className="flex gap-2 print:hidden">
      {steps.map((s) => {
        const done = s.id < current;
        const isCurrent = s.id === current;
        const locked = s.id > maxStep;
        const card = isCurrent
          ? "border-blue bg-accent-50 shadow-soft"
          : done
            ? "border-blue/30 bg-surface hover:border-blue"
            : locked
              ? "border-line bg-surface opacity-50 cursor-not-allowed"
              : "border-line bg-surface";
        const chip = isCurrent
          ? "bg-blue text-white"
          : done
            ? "bg-accent-50 text-blue"
            : locked
              ? "bg-paper text-line"
              : "bg-paper text-ink2";
        return (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              disabled={locked}
              aria-current={isCurrent ? "step" : undefined}
              aria-disabled={locked || undefined}
              title={locked ? t("ui.step.locked") : s.label}
              onClick={() => !locked && onJump(s.id)}
              className={`flex w-full items-center gap-2.5 rounded-card border-2 px-3 py-2 text-left transition-all duration-fast ${card}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ctl font-mono text-sm font-bold ${chip}`}>
                {done ? <IconLegal size="sm" /> : locked ? <LockGlyph /> : s.id}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-medium">{s.label}</span>
                <span className="block truncate text-[10px] text-ink2">{s.subline}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Prev / Next footer nav for a Stepper flow. */
export function StepNav({
  onPrev,
  onNext,
  canPrev,
  canNext,
  nextLabel,
  nextDisabledHint,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** Custom terminal CTA label (last step), else "下一步". */
  nextLabel?: string;
  /** Tooltip shown when Next is disabled (unmet validation). */
  nextDisabledHint?: string;
}) {
  const t = useT();
  return (
    <div className="mt-6 flex items-center justify-between print:hidden">
      <button type="button" onClick={onPrev} disabled={!canPrev} className={buttonClass("ghost")}>
        ← {t("ui.nav.prev")}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        title={!canNext ? nextDisabledHint : undefined}
        className={buttonClass("primary")}
      >
        {nextLabel ?? t("ui.nav.next")}
        {nextLabel === undefined && <IconArrowDown size="sm" className="-rotate-90" />}
      </button>
    </div>
  );
}
