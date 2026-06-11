import { useT } from "../i18n/index.ts";

interface MulliganToggleProps {
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}

/**
 * The mulligan-correction toggle chip (docs/04 §4): blue solid when on,
 * outlined when off, greyed with guidance when the deck has no marked
 * Basics (the conditioning would be undefined).
 */
export function MulliganToggle({ on, disabled, onChange }: MulliganToggleProps) {
  const t = useT();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={disabled ? t("error.basicUnknown") : undefined}
      onClick={() => onChange(!on)}
      className={
        "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
        (disabled
          ? "cursor-not-allowed border hairline bg-paper text-ink2 opacity-60"
          : on
            ? "bg-blue font-medium text-white"
            : "border hairline bg-surface text-ink2 hover:text-ink")
      }
    >
      {on ? "✓ " + t("toggle.mulligan.on") : t("toggle.mulligan.off")}
    </button>
  );
}
