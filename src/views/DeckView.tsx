import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { DeckEditor } from "../components/DeckEditor.tsx";
import { ImportWizard } from "../components/ImportWizard.tsx";
import { ExportDialog } from "../components/ExportDialog.tsx";
import { BasicListDialog } from "../components/BasicListDialog.tsx";

/** Deck workspace: multi-deck management, row editor, import/export. */
export function DeckView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);
  const createDeck = useDeckStore((s) => s.createDeck);
  const addCard = useDeckStore((s) => s.addCard);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [basicListOpen, setBasicListOpen] = useState(false);

  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  function startBlank() {
    const id = createDeck();
    addCard(id);
  }

  if (decks.length === 0) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("nav.deck")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("empty.deck")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-ctl bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            {t("deck.import")}
          </button>
          <button
            type="button"
            onClick={startBlank}
            className="rounded-ctl border hairline px-4 py-2 text-sm text-ink2 hover:text-ink"
          >
            {t("deck.startBlank")}
          </button>
        </div>
        {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
      </section>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("deck.list.aria")}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {decks.map((deck) => {
          const active = deck.id === activeDeckId;
          return (
            <button
              key={deck.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDeck(deck.id)}
              className={
                "max-w-48 truncate rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
                (active
                  ? "bg-blue font-medium text-white"
                  : "border hairline bg-surface text-ink2 hover:text-ink")
              }
            >
              {deck.name || t("deck.untitled")}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => createDeck()}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          ＋ {t("deck.new")}
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
          >
            {t("deck.import")}
          </button>
          {activeDeck && (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
            >
              {t("deck.export")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBasicListOpen(true)}
            className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
          >
            {t("basiclist.button")}
          </button>
        </div>
      </div>

      {activeDeck && <DeckEditor deck={activeDeck} />}

      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
      {exportOpen && activeDeck && (
        <ExportDialog deck={activeDeck} onClose={() => setExportOpen(false)} />
      )}
      {basicListOpen && <BasicListDialog onClose={() => setBasicListOpen(false)} />}
    </div>
  );
}
