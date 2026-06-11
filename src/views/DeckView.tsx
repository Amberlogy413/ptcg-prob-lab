import { useT } from "../i18n/index.ts";

/** Deck workspace. Phase 1 builds the editor, importer, and multi-deck list. */
export function DeckView() {
  const t = useT();
  return (
    <section className="rounded-card border hairline bg-surface p-6">
      <h2 className="text-xl font-medium">{t("nav.deck")}</h2>
      <p className="mt-2 text-sm text-ink2">{t("empty.deck")}</p>
    </section>
  );
}
