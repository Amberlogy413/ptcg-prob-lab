import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, deckTotal } from "../state/deckStore.ts";
import { computeTrackerRows } from "../state/q5.ts";
import { DECK_SIZE, PRIZE_COUNT } from "../constants.ts";

/**
 * C2 對局獎賞卡追蹤器 v2 (docs/02 §5.5, math audit 2026-06-12): tick off the
 * cards you have SEEN and the prizes already TAKEN; the posterior over the
 * REMAINING facedown prizes updates exactly (p = 6 − taken — the legacy
 * hardcoded 6 was wrong from the first prize). N follows the actual deck.
 * The tournament-compliance reminder is permanently visible (PRD §4-16).
 */
export function TrackerView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  const [seen, setSeen] = useState<Record<string, number>>({});
  const [prizesTaken, setPrizesTaken] = useState(0);

  const cards = useMemo(
    () =>
      (deck?.cards ?? [])
        .filter((c) => c.name.trim() !== "" && c.count > 0)
        .map((c) => ({ id: c.id, name: c.name, count: c.count, seen: Math.min(seen[c.id] ?? 0, c.count) })),
    [deck, seen],
  );

  const total = deck ? deckTotal(deck) : 0;
  const result = useMemo(
    () => (cards.length > 0 && total > 0 ? computeTrackerRows(cards, total, prizesTaken) : null),
    [cards, total, prizesTaken],
  );

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
      <p className="mt-1 text-xs text-ink2">{t("tracker.seenHint")}</p>
      {total !== DECK_SIZE && (
        <p className="mt-1 text-xs text-warn" role="status">
          {t("tracker.notSixty", { n: total })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink2">{t("tracker.prizesTaken")}</span>
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              aria-label={t("tracker.prizesTakenDec")}
              disabled={prizesTaken <= 0}
              onClick={() => setPrizesTaken((n) => Math.max(0, n - 1))}
              className="h-7 w-7 rounded-ctl border hairline font-mono text-sm text-ink2 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-12 text-center font-mono">
              {prizesTaken}/{PRIZE_COUNT}
            </span>
            <button
              type="button"
              aria-label={t("tracker.prizesTakenInc")}
              disabled={prizesTaken >= PRIZE_COUNT}
              onClick={() => setPrizesTaken((n) => Math.min(PRIZE_COUNT, n + 1))}
              className="h-7 w-7 rounded-ctl border hairline font-mono text-sm text-ink2 disabled:opacity-40"
            >
              ＋
            </button>
          </span>
        </label>
        {result ? (
          <p className="font-mono text-sm">
            {t("tracker.unseen", { u: result.u, p: result.p, d: result.deckLeft })}
          </p>
        ) : (
          <p className="text-sm text-warn" role="status">
            {t("tracker.tooManySeen")}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setSeen({});
            setPrizesTaken(0);
          }}
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
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("tracker.still")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("tracker.next")}</th>
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
                  <td
                    className="py-1.5 pr-3 text-right font-mono"
                    title={row ? row.atLeastOneFraction : undefined}
                  >
                    {row ? row.atLeastOnePercent : "—"}
                  </td>
                  <td
                    className="py-1.5 pr-3 text-right font-mono"
                    title={row ? row.stillFraction : undefined}
                  >
                    {row ? row.stillPercent : "—"}
                  </td>
                  <td
                    className="py-1.5 pr-3 text-right font-mono"
                    title={row ? row.nextFraction : undefined}
                  >
                    {row ? row.nextPercent : "—"}
                  </td>
                  <td className="py-1.5 text-right font-mono">{row?.expected ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink2">{t("tracker.formula", { p: result?.p ?? PRIZE_COUNT })}</p>
    </section>
  );
}
