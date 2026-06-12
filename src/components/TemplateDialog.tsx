import { useMemo } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { useDeckStore } from "../state/deckStore.ts";
import { DECK_TEMPLATES, templateTotal, templateBasics } from "../data/templates.ts";
import { openingBasics, percentStr } from "../lib/prob/index.ts";
import { DECK_SIZE, HAND_SIZE } from "../constants.ts";

/**
 * P8.2 template deck bank (docs/08 §5A): one-click archetype skeletons.
 * Each row's badge carries the EXACT mulligan probability for its Basic
 * count — the bank doubles as a deck-shape lesson before a single click.
 */
export function TemplateDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const importDeck = useDeckStore((s) => s.importDeck);

  const rows = useMemo(
    () =>
      DECK_TEMPLATES.map((tpl) => {
        const basics = templateBasics(tpl);
        return {
          tpl,
          total: templateTotal(tpl),
          basics,
          mulligan: percentStr(openingBasics(basics, DECK_SIZE, HAND_SIZE).mulligan, 6),
        };
      }),
    [],
  );

  function load(tplId: string): void {
    const row = rows.find((r) => r.tpl.id === tplId);
    if (!row) return;
    importDeck(
      t(`templates.${tplId}.name`),
      row.tpl.cards.map((c) => ({
        name: c.name,
        count: c.count,
        isBasic: c.isBasic,
        section: c.section,
      })),
    );
    onClose();
  }

  return (
    <Modal title={t("templates.title")} onClose={onClose}>
      <p className="text-sm text-ink2">{t("templates.desc")}</p>
      <ul className="mt-3 space-y-2">
        {rows.map(({ tpl, basics, mulligan }) => {
          const name = t(`templates.${tpl.id}.name`);
          return (
            <li key={tpl.id} className="rounded-ctl border hairline p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{name}</h3>
                  <p className="mt-0.5 text-xs text-ink2">{t(`templates.${tpl.id}.blurb`)}</p>
                  <p className="mt-1 font-mono text-xs text-ink2">
                    {t("templates.badge", { b: basics, q: mulligan })}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`${t("templates.load")}:${name}`}
                  onClick={() => load(tpl.id)}
                  className="shrink-0 rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white"
                >
                  {t("templates.load")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
