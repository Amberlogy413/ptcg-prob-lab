import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { useQueryStore, MAX_TRACKED_CARDS } from "../state/queryStore.ts";
import { deckBasics, type Deck } from "../state/deckStore.ts";
import { ConstraintPicker } from "./ConstraintPicker.tsx";
import { MulliganToggle } from "./MulliganToggle.tsx";
import { Q2ResultCard } from "./Q2ResultCard.tsx";
import type { ComboResultState } from "../state/useComboResult.ts";

const STEP_KEYS = ["q2.wizard.s1", "q2.wizard.s2", "q2.wizard.s3", "q2.wizard.s4"];

/**
 * <768px wizard flow (docs/04 §8): 選卡 → 選約束 → 重抽修正 → 結果.
 * Shares the same query store as the desktop sentence builder.
 */
export function Q2Wizard({ deck, state }: { deck: Deck; state: ComboResultState }) {
  const t = useT();
  const [step, setStep] = useState(1);
  const tracked = useQueryStore((s) => s.tracked);
  const mulliganAware = useQueryStore((s) => s.mulliganAware);
  const addCard = useQueryStore((s) => s.addCard);
  const removeCard = useQueryStore((s) => s.removeCard);
  const updateConstraint = useQueryStore((s) => s.updateConstraint);
  const setMulliganAware = useQueryStore((s) => s.setMulliganAware);

  const awareDisabled = deckBasics(deck) < 1;
  const selectable = deck.cards.filter((c) => c.name.trim() !== "" && c.count > 0);

  return (
    <div>
      <p className="font-mono text-xs text-ink2">
        {t("q2.wizard.step", { i: step })} · {t(STEP_KEYS[step - 1] as string)}
      </p>

      {step === 1 && (
        <ul className="mt-2 max-h-72 overflow-y-auto rounded-ctl border hairline">
          {selectable.map((c) => {
            const checked = tracked.some((q) => q.cardId === c.id);
            const full = !checked && tracked.length >= MAX_TRACKED_CARDS;
            return (
              <li key={c.id} className="border-b hairline last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={full}
                    onChange={(e) => (e.target.checked ? addCard(c.id) : removeCard(c.id))}
                    className="h-4 w-4 accent-blue"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <span className="font-mono text-xs text-ink2">×{c.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {step === 2 && (
        <ul className="mt-2 space-y-2">
          {tracked.map((q) => {
            const card = deck.cards.find((c) => c.id === q.cardId);
            if (!card) return null;
            return (
              <li key={q.cardId} className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  {card.name} ×{card.count}
                </span>
                <ConstraintPicker
                  card={card}
                  q={q}
                  onChange={(patch) => updateConstraint(q.cardId, patch)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {step === 3 && (
        <div className="mt-2">
          <MulliganToggle on={mulliganAware} disabled={awareDisabled} onChange={setMulliganAware} />
          {awareDisabled && (
            <p className="mt-2 text-xs text-warn" role="status">
              {t("error.basicUnknown")}
            </p>
          )}
        </div>
      )}

      {step === 4 && <Q2ResultCard state={state} />}

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 disabled:opacity-40"
        >
          {t("import.back")}
        </button>
        {step < 4 && (
          <button
            type="button"
            disabled={step === 1 && tracked.length === 0}
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {t("import.next")}
          </button>
        )}
      </div>
    </div>
  );
}
