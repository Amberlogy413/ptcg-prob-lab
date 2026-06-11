import { Fragment } from "react";
import { useT } from "../i18n/index.ts";
import { useQueryStore, MAX_TRACKED_CARDS } from "../state/queryStore.ts";
import { deckBasics, type Deck } from "../state/deckStore.ts";
import { ConstraintPicker } from "./ConstraintPicker.tsx";
import { MulliganToggle } from "./MulliganToggle.tsx";

/**
 * The sentence query builder (docs/04 §4): the query reads as one sentence,
 * every 【】 is a control. Desktop form — the <768px wizard reuses the same
 * query store.
 */
export function QueryBuilder({ deck }: { deck: Deck }) {
  const t = useT();
  const tracked = useQueryStore((s) => s.tracked);
  const mulliganAware = useQueryStore((s) => s.mulliganAware);
  const addCard = useQueryStore((s) => s.addCard);
  const removeCard = useQueryStore((s) => s.removeCard);
  const updateConstraint = useQueryStore((s) => s.updateConstraint);
  const setMulliganAware = useQueryStore((s) => s.setMulliganAware);

  const available = deck.cards.filter(
    (c) => c.name.trim() !== "" && c.count > 0 && !tracked.some((q) => q.cardId === c.id),
  );
  const awareDisabled = deckBasics(deck) < 1;

  const staticChip = "rounded-ctl border hairline bg-paper px-2 py-1 text-sm";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 leading-relaxed">
        <span>{t("q2.s.prefix")}</span>
        <span className={staticChip}>{t("q2.s.hand")}</span>
        <span>{t("q2.s.want")}</span>

        {tracked.map((q, i) => {
          const card = deck.cards.find((c) => c.id === q.cardId);
          if (!card) return null;
          return (
            <Fragment key={q.cardId}>
              {i > 0 && <span className="font-medium">{t("q2.s.and")}</span>}
              <span className="inline-flex items-center gap-1 rounded-ctl border border-blue px-2 py-1 text-sm text-blue">
                {card.name} ×{card.count}
                <button
                  type="button"
                  aria-label={t("q2.removeCard.aria", { name: card.name })}
                  onClick={() => removeCard(q.cardId)}
                  className="ml-1 text-ink2 hover:text-bad"
                >
                  ✕
                </button>
              </span>
              <span>{t("q2.s.appear")}</span>
              <ConstraintPicker
                card={card}
                q={q}
                onChange={(patch) => updateConstraint(q.cardId, patch)}
              />
            </Fragment>
          );
        })}

        {tracked.length < MAX_TRACKED_CARDS && available.length > 0 && (
          <select
            value=""
            aria-label={t("q2.addCard.aria")}
            onChange={(e) => {
              if (e.target.value) addCard(e.target.value);
            }}
            className="h-8 rounded-ctl border border-dashed hairline bg-surface px-1 text-sm text-ink2"
          >
            <option value="">{t("q2.addCard")}</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ×{c.count}
              </option>
            ))}
          </select>
        )}

        <span>{t("q2.s.suffix")}</span>
        <MulliganToggle on={mulliganAware} disabled={awareDisabled} onChange={setMulliganAware} />
      </div>

      {tracked.length >= MAX_TRACKED_CARDS && (
        <p className="mt-2 text-xs text-ink2">{t("q2.maxCards")}</p>
      )}
      {awareDisabled && (
        <p className="mt-2 text-xs text-warn" role="status">
          {t("error.basicUnknown")}
        </p>
      )}
    </div>
  );
}
