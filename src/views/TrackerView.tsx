import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { computeTrackerRows } from "../state/q5.ts";
import { DECK_SIZE, PRIZE_COUNT } from "../constants.ts";

/**
 * C2 對局獎賞卡追蹤器 (docs/02 §5.5, pulled forward from V2): tick off the
 * cards you have SEEN; the posterior over the 6 prizes updates exactly. The
 * tournament-compliance reminder is permanently visible (PRD §4-16).
 */
export function TrackerView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  const [seen, setSeen] = useState<Record<string, number>>({});

  const cards = useMemo(
    () =>
      (deck?.cards ?? [])
        .filter((c) => c.name.trim() !== "" && c.count > 0)
        .map((c) => ({ id: c.id, name: c.name, count: c.count, seen: Math.min(seen[c.id] ?? 0, c.count) })),
    [deck, seen],
  );

  const result = useMemo(() => (cards.length > 0 ? computeTrackerRows(cards, DECK_SIZE) : null), [cards]);

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("tracker.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("tracker.title")}</h2>
      {/* Permanent compliance reminder (PRD §4-16) */}
      <p className="mt-2 rounded-ctl border border-warn px-3 py-2 text-xs text-warn" role="note">
        {t("tracker.legal")}
      </p>
      <p className="mt-2 text-xs text-ink2">{t("tracker.desc")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {result ? (
          <p className="font-mono text-sm">
            {t("tracker.unseen", { u: result.u, p: PRIZE_COUNT })}
          </p>
        ) : (
          <p className="text-sm text-warn" role="status">
            {t("tracker.tooManySeen")}
          </p>
        )}
        <button
          type="button"
          onClick={() => setSeen({})}
          className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink"
        >
          {t("tracker.reset")}
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("tracker.title")}</caption>
          <thead>
            <tr className="border-b hairline text-left text-xs text-ink2">
              <th scope="col" className="py-1.5 pr-3 font-medium">{t("deck.card.name")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("tracker.seen")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("tracker.unseenCol")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("tracker.atLeastOne")}</th>
              <th scope="col" className="py-1.5 text-right font-medium">{t("tracker.expected")}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const row = result?.rows.find((r) => r.name === c.name && r.count === c.count);
              return (
                <tr key={c.id} className="border-b hairline last:border-b-0">
                  <td className="py-1.5 pr-3">{c.name}</td>
                  <td className="py-1.5 pr-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={t("tracker.seenDec", { name: c.name })}
                        disabled={c.seen <= 0}
                        onClick={() => setSeen((s) => ({ ...s, [c.id]: c.seen - 1 }))}
                        className="h-7 w-7 rounded-ctl border hairline font-mono text-sm text-ink2 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-mono">
                        {c.seen}/{c.count}
                      </span>
                      <button
                        type="button"
                        aria-label={t("tracker.seenInc", { name: c.name })}
                        disabled={c.seen >= c.count}
                        onClick={() => setSeen((s) => ({ ...s, [c.id]: c.seen + 1 }))}
                        className="h-7 w-7 rounded-ctl border hairline font-mono text-sm text-ink2 disabled:opacity-40"
                      >
                        ＋
                      </button>
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">{row?.unseen ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">
                    {row ? `${row.atLeastOnePercent}` : "—"}
                  </td>
                  <td className="py-1.5 text-right font-mono">{row?.expected ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink2">{t("tracker.formula")}</p>
    </section>
  );
}
