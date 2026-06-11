import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { useDeckStore } from "../state/deckStore.ts";
import {
  parseDeckList,
  cardsNeedingBasicTag,
  toNewCardInputs,
  type ParseResult,
} from "../utils/deckImport.ts";
import { DECK_SIZE } from "../constants.ts";

/**
 * Two-step PTCG Live import (docs/03 §8): paste → mark Basic Pokémon.
 * Step 2 is mandatory — a text list cannot reveal which cards are Basic, and
 * that flag is the input to all mulligan math. Tags are remembered globally
 * by card name (basicTags), so known names arrive pre-filled.
 */
export function ImportWizard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const basicTags = useDeckStore((s) => s.basicTags);
  const rememberBasicTags = useDeckStore((s) => s.rememberBasicTags);
  const importDeck = useDeckStore((s) => s.importDeck);

  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [emptyError, setEmptyError] = useState(false);
  const [tags, setTags] = useState<Record<string, boolean>>({});
  const [rememberedCount, setRememberedCount] = useState(0);
  const [deckName, setDeckName] = useState("");

  /** Unique card names shown in step 2 (same name may appear on two lines). */
  const tagRows = useMemo(() => {
    if (!result) return [];
    const byName = new Map<string, number>();
    for (const c of cardsNeedingBasicTag(result)) {
      byName.set(c.name, (byName.get(c.name) ?? 0) + c.count);
    }
    return [...byName.entries()].map(([name, count]) => ({ name, count }));
  }, [result]);

  const nonTaggedCount = useMemo(() => {
    if (!result) return 0;
    const tagged = new Set(cardsNeedingBasicTag(result).map((c) => c.name));
    return result.cards.filter((c) => !tagged.has(c.name)).length;
  }, [result]);

  function goToStep2() {
    const parsed = parseDeckList(text);
    if (parsed.cards.length === 0) {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setResult(parsed);
    const names = new Set(cardsNeedingBasicTag(parsed).map((c) => c.name));
    const initial: Record<string, boolean> = {};
    let remembered = 0;
    for (const name of names) {
      const known = basicTags[name];
      if (known !== undefined) remembered += 1;
      initial[name] = known ?? false;
    }
    setTags(initial);
    setRememberedCount(remembered);
    setStep(2);
  }

  function confirmImport() {
    if (!result) return;
    rememberBasicTags(tags);
    importDeck(deckName.trim() || t("deck.untitled"), toNewCardInputs(result.cards, tags));
    onClose();
  }

  function setAll(value: boolean) {
    setTags(Object.fromEntries(tagRows.map((r) => [r.name, value])));
  }

  return (
    <Modal title={t("import.title")} onClose={onClose}>
      {step === 1 ? (
        <div>
          <h3 className="text-sm font-medium text-ink2">{t("import.step1.title")}</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("import.step1.placeholder")}
            aria-label={t("import.step1.aria")}
            rows={12}
            className="mt-2 w-full rounded-ctl border hairline bg-surface p-2 font-mono text-sm"
          />
          {emptyError && (
            <p className="mt-2 text-sm text-bad" role="alert">
              {t("import.step1.empty")}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2"
            >
              {t("import.cancel")}
            </button>
            <button
              type="button"
              onClick={goToStep2}
              className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white"
            >
              {t("import.next")}
            </button>
          </div>
        </div>
      ) : (
        result && (
          <div>
            <h3 className="text-sm font-medium text-ink2">{t("import.step2.title")}</h3>
            <p className="mt-1 text-sm text-ink2">{t("import.step2.desc")}</p>

            <div className="mt-3 space-y-1 text-sm">
              <p className="font-mono text-ink2">
                {t("import.parsed.summary", { types: result.cards.length, total: result.total })}
              </p>
              {result.total !== DECK_SIZE && (
                <p className="text-warn" role="status">
                  {t("import.warn.notSixty", { n: result.total })}
                </p>
              )}
              {result.unparsedLines.length > 0 && (
                <div className="text-warn" role="status">
                  <p>{t("import.warn.unparsed", { n: result.unparsedLines.length })}</p>
                  <ul className="ml-4 list-disc font-mono text-xs">
                    {result.unparsedLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {rememberedCount > 0 && (
                <p className="text-good" role="status">
                  {t("import.step2.remembered", { n: rememberedCount })}
                </p>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAll(true)}
                className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink"
              >
                {t("import.step2.markAll")}
              </button>
              <button
                type="button"
                onClick={() => setAll(false)}
                className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink"
              >
                {t("import.step2.unmarkAll")}
              </button>
            </div>

            <ul className="mt-2 max-h-64 overflow-y-auto rounded-ctl border hairline">
              {tagRows.map(({ name, count }) => (
                <li key={name} className="flex items-center gap-3 border-b hairline px-3 py-2 last:border-b-0">
                  <label className="flex w-full cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tags[name] ?? false}
                      onChange={(e) => setTags((prev) => ({ ...prev, [name]: e.target.checked }))}
                      className="h-4 w-4 accent-blue"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                    <span className="font-mono text-xs text-ink2">×{count}</span>
                    <span className="text-xs text-ink2">{t("deck.card.basicFull")}</span>
                  </label>
                </li>
              ))}
            </ul>
            {nonTaggedCount > 0 && (
              <p className="mt-2 text-xs text-ink2">
                {t("import.step2.nonPokemon", { n: nonTaggedCount })}
              </p>
            )}

            <label className="mt-4 block text-sm">
              <span className="text-ink2">{t("import.deckName")}</span>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder={t("deck.untitled")}
                className="mt-1 h-9 w-full rounded-ctl border hairline bg-surface px-2 text-base"
              />
            </label>

            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2"
              >
                {t("import.back")}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2"
                >
                  {t("import.cancel")}
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white"
                >
                  {t("import.confirm")}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
