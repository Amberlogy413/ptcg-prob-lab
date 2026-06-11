import { useT } from "../i18n/index.ts";
import { GOLDEN_CASE_COUNT, GOLDEN_ASSERTION_COUNT } from "../constants.ts";

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t hairline bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-ctl border border-blue px-2 py-0.5 text-xs font-medium text-blue">
            {t("badge.exact")}
          </span>
          <span className="font-mono text-xs text-ink2">
            {t("footer.golden", {
              cases: GOLDEN_CASE_COUNT,
              assertions: GOLDEN_ASSERTION_COUNT,
            })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-ink2">{t("footer.disclaimer")}</p>
      </div>
    </footer>
  );
}
