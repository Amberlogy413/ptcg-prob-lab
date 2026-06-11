import { useT } from "../i18n/index.ts";

/** Left-column deck summary (docs/04 §3). Phase 1 wires it to the deck store. */
export function DeckSummary() {
  const t = useT();
  return (
    <aside className="rounded-card border hairline bg-surface p-4">
      <h2 className="text-sm font-medium text-ink2">{t("summary.title")}</h2>
      <p className="mt-3 text-sm text-ink2">{t("summary.noDeck")}</p>
    </aside>
  );
}
