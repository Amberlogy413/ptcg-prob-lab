import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { useQueryStore } from "../state/queryStore.ts";
import { useComboResult } from "../state/useComboResult.ts";
import { useIsNarrow } from "../utils/useIsNarrow.ts";
import { QueryBuilder } from "../components/QueryBuilder.tsx";
import { Q2Wizard } from "../components/Q2Wizard.tsx";
import { Q2ResultCard } from "../components/Q2ResultCard.tsx";

/** Q2 section: sentence builder on desktop, step wizard under 768px. */
export function Q2Section() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const tracked = useQueryStore((s) => s.tracked);
  const mulliganAware = useQueryStore((s) => s.mulliganAware);
  const narrow = useIsNarrow();
  const state = useComboResult(deck, tracked, mulliganAware);

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("q2.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("q2.title")}</h2>
      <div className="mt-3">
        {narrow ? (
          <Q2Wizard deck={deck} state={state} />
        ) : (
          <>
            <QueryBuilder deck={deck} />
            <Q2ResultCard state={state} />
          </>
        )}
      </div>
    </section>
  );
}
