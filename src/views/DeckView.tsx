import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { DeckEditor } from "../components/DeckEditor.tsx";
import { ImportWizard } from "../components/ImportWizard.tsx";
import { ExportDialog } from "../components/ExportDialog.tsx";
import { BasicListDialog } from "../components/BasicListDialog.tsx";
import { AliasDialog } from "../components/AliasDialog.tsx";
import { TemplateDialog } from "../components/TemplateDialog.tsx";
import { DeckSheetDialog } from "../components/DeckSheetDialog.tsx";
import { DeckBuilderDialog } from "../components/DeckBuilderDialog.tsx";
import { RotationPanel } from "../components/RotationPanel.tsx";
import { SectionHeader } from "../components/ui/SectionHeader.tsx";
import { OptionCard, OptionGrid } from "../components/ui/OptionCard.tsx";
import {
  IconBuilder,
  IconImport,
  IconExport,
  IconSheet,
  IconTag,
  IconLink,
  IconTemplate,
  IconDeck,
} from "../components/icons.tsx";

const TOOLBTN =
  "inline-flex items-center gap-1.5 rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink";

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
  const [aliasOpen, setAliasOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  function startBlank() {
    const id = createDeck();
    addCard(id);
  }

  function startBuilder() {
    if (activeDeck === null) createDeck();
    setBuilderOpen(true);
  }

  if (decks.length === 0) {
    return (
      <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
        <SectionHeader title={t("nav.deck")} helper={t("empty.deck")} />
        <OptionGrid>
          <OptionCard
            badge="01"
            icon={<IconBuilder />}
            title={t("builder.button")}
            subline={t("empty.opt.builder.sub")}
            selected={false}
            onSelect={startBuilder}
          />
          <OptionCard
            badge="02"
            icon={<IconImport />}
            title={t("deck.import")}
            subline={t("empty.opt.import.sub")}
            selected={false}
            onSelect={() => setImportOpen(true)}
          />
          <OptionCard
            badge="03"
            icon={<IconTemplate />}
            title={t("templates.button")}
            subline={t("empty.opt.templates.sub")}
            selected={false}
            onSelect={() => setTemplatesOpen(true)}
          />
          <OptionCard
            badge="04"
            icon={<IconDeck />}
            title={t("deck.startBlank")}
            subline={t("empty.opt.blank.sub")}
            selected={false}
            onSelect={startBlank}
          />
        </OptionGrid>
        {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
        {templatesOpen && <TemplateDialog onClose={() => setTemplatesOpen(false)} />}
        {builderOpen && activeDeck !== null && (
          <DeckBuilderDialog deck={activeDeck} onClose={() => setBuilderOpen(false)} />
        )}
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
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={startBuilder} className={TOOLBTN}>
            <IconBuilder />
            {t("builder.button")}
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className={TOOLBTN}>
            <IconImport />
            {t("deck.import")}
          </button>
          {activeDeck && (
            <button type="button" onClick={() => setExportOpen(true)} className={TOOLBTN}>
              <IconExport />
              {t("deck.export")}
            </button>
          )}
          {activeDeck && (
            <button type="button" onClick={() => setSheetOpen(true)} className={TOOLBTN}>
              <IconSheet />
              {t("sheet.button")}
            </button>
          )}
          <button type="button" onClick={() => setBasicListOpen(true)} className={TOOLBTN}>
            <IconTag />
            {t("basiclist.button")}
          </button>
          <button type="button" onClick={() => setAliasOpen(true)} className={TOOLBTN}>
            <IconLink />
            {t("alias.button")}
          </button>
          <button type="button" onClick={() => setTemplatesOpen(true)} className={TOOLBTN}>
            <IconTemplate />
            {t("templates.button")}
          </button>
        </div>
      </div>

      {activeDeck && <RotationPanel deck={activeDeck} />}
      {activeDeck && <DeckEditor deck={activeDeck} />}

      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
      {exportOpen && activeDeck && (
        <ExportDialog deck={activeDeck} onClose={() => setExportOpen(false)} />
      )}
      {basicListOpen && <BasicListDialog onClose={() => setBasicListOpen(false)} />}
      {aliasOpen && <AliasDialog onClose={() => setAliasOpen(false)} />}
      {templatesOpen && <TemplateDialog onClose={() => setTemplatesOpen(false)} />}
      {sheetOpen && activeDeck && (
        <DeckSheetDialog deck={activeDeck} onClose={() => setSheetOpen(false)} />
      )}
      {builderOpen && activeDeck && (
        <DeckBuilderDialog deck={activeDeck} onClose={() => setBuilderOpen(false)} />
      )}
    </div>
  );
}
