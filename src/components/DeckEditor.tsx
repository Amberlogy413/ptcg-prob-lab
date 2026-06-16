import { useEffect, useState } from "react";
import { useT } from "../i18n/index.ts";
import {
  useDeckStore,
  deckTotal,
  type Deck,
  type DeckCard,
  type DeckSection,
} from "../state/deckStore.ts";
import { useUiStore } from "../state/uiStore.ts";
import { CardRow } from "./CardRow.tsx";
import { CardPicker } from "./CardPicker.tsx";
import { CardVisual } from "./CardVisual.tsx";
import { CountRing } from "./CountRing.tsx";
import { Modal } from "./Modal.tsx";
import { DECK_SIZE } from "../constants.ts";
import {
  loadCatalog,
  cardById,
  matchRow,
  enrichPatch,
  cardName,
  resolveDeckRow,
  localizeDeckRow,
  kindOf,
  type Catalog,
} from "../data/catalog.ts";
import { useCardLang } from "../state/cardLang.ts";
import { cardAccent, cardType } from "../data/typeColors.ts";
import { IconWarn } from "./icons.tsx";
import { capRowCount, isBasicEnergyName, isRadiantName } from "../utils/deckRules.ts";

const SECTION_ORDER: DeckSection[] = ["pokemon", "trainer", "energy", "unknown"];
const SECTION_KEY: Record<DeckSection, string> = {
  pokemon: "deck.section.pokemon",
  trainer: "deck.section.trainer",
  energy: "deck.section.energy",
  unknown: "deck.section.unknown",
};

export function DeckEditor({ deck }: { deck: Deck }) {
  const t = useT();
  const { lang } = useCardLang();
  const renameDeck = useDeckStore((s) => s.renameDeck);
  const deleteDeck = useDeckStore((s) => s.deleteDeck);
  const addCard = useDeckStore((s) => s.addCard);
  const updateCard = useDeckStore((s) => s.updateCard);
  const removeCard = useDeckStore((s) => s.removeCard);
  const rotationMark = useUiStore((s) => s.rotationMark);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [visualId, setVisualId] = useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  // Load the catalog in the background for any non-empty deck so every row can
  // show its localized name + type color and the full card visual (SW-cached
  // after the first time; never blocks the editor).
  const hasRows = deck.cards.length > 0;
  useEffect(() => {
    if (!hasRows || catalog !== null) return;
    let alive = true;
    loadCatalog().then(
      (c) => {
        if (alive) setCatalog(c);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [hasRows, catalog]);

  /** 補完標籤: sweep unmapped rows and stamp every tag the catalog knows.
   *  A row resolving to a print that already has its own row merges into it
   *  (counts add up) so one print never ends up split across two rows. */
  async function enrich() {
    try {
      const cat = catalog ?? (await loadCatalog());
      setCatalog(cat);
      let n = 0;
      for (const row of deck.cards) {
        if (row.catalogId !== undefined) continue;
        const match = matchRow(cat, row);
        if (match === null) continue;
        const live = useDeckStore.getState().decks.find((d) => d.id === deck.id);
        const twin = live?.cards.find((c) => c.id !== row.id && c.catalogId === match.id);
        if (twin !== undefined) {
          // Remove the duplicate row FIRST so the legality cap in updateCard does
          // not count it against the merged total (else the sum gets clamped).
          const merged = twin.count + row.count;
          removeCard(deck.id, row.id);
          updateCard(deck.id, twin.id, { count: merged });
        } else {
          updateCard(deck.id, row.id, enrichPatch(match));
        }
        n += 1;
      }
      setEnrichMsg(n > 0 ? t("deck.enrich.done", { n }) : t("deck.enrich.none"));
    } catch {
      setEnrichMsg(t("catalog.error"));
    }
  }

  const showVisualFor = (card: DeckCard) => {
    if (catalog === null) return undefined;
    const resolved = resolveDeckRow(catalog, card);
    if (resolved === null) return undefined;
    return () => setVisualId(resolved.id);
  };

  const visualCard = visualId !== null && catalog !== null ? cardById(catalog, visualId) : null;

  const total = deckTotal(deck);
  const groups = SECTION_ORDER.map((section) => ({
    section,
    cards: deck.cards.filter((c) => c.section === section),
  })).filter((g) => g.cards.length > 0);
  const onlyUnknown = groups.length === 1 && groups[0]?.section === "unknown";

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <CountRing total={total} />
        <input
          type="text"
          value={deck.name}
          placeholder={t("deck.untitled")}
          aria-label={t("deck.name.aria")}
          onChange={(e) => renameDeck(deck.id, e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-lg"
        />
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t("deck.delete.confirm", { name: deck.name || t("deck.untitled") }))) {
              deleteDeck(deck.id);
            }
          }}
          className="h-9 rounded-ctl border hairline px-3 text-sm text-ink2 hover:text-bad"
        >
          {t("deck.delete")}
        </button>
      </div>

      {total !== DECK_SIZE && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-warn" role="status">
          <IconWarn size="sm" />
          {t("error.deckCount", { n: total })}
        </p>
      )}

      <CardPicker deckId={deck.id} />

      <div className="mt-4">
        {deck.cards.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink2">{t("empty.deck")}</p>
        ) : (
          groups.map(({ section, cards }) => (
            <div key={section} className="mb-3">
              {!onlyUnknown && (
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink2">
                  {t(SECTION_KEY[section])} ·{" "}
                  <span className="font-mono">{cards.reduce((s, c) => s + c.count, 0)}</span>
                </h3>
              )}
              <ul aria-label={t("deck.rows.aria")}>
                {cards.map((card) => {
                  const loc = catalog !== null ? localizeDeckRow(catalog, card, lang) : null;
                  const resolved = loc !== null ? loc.card : null;
                  const displayName = loc !== null ? loc.name : undefined;
                  const accent = resolved !== null ? cardAccent(resolved) : undefined;
                  const kind = resolved !== null ? kindOf(resolved) : null;
                  const kindLabel =
                    kind !== null ? (kind.key !== null ? t(kind.key) : kind.raw) : undefined;
                  const typeName =
                    resolved !== null ? (cardType(resolved) ?? undefined) : undefined;
                  // Legal ceiling for this row + the reason, so the + button
                  // caps to the real rule (per-name 4 / Basic Energy ∞ / 60 total).
                  const maxCount = capRowCount(deck.cards, card.id, card.name, DECK_SIZE);
                  const capHint = isBasicEnergyName(card.name)
                    ? t("deck.cap.deckFull")
                    : isRadiantName(card.name)
                      ? t("deck.cap.radiant")
                      : maxCount <= 4
                        ? t("deck.cap.name")
                        : t("deck.cap.deckFull");
                  return (
                    <CardRow
                      key={card.id}
                      card={card}
                      onUpdate={(patch) => updateCard(deck.id, card.id, patch)}
                      onRemove={() => removeCard(deck.id, card.id)}
                      rotatingOut={rotationMark !== null && card.mark === rotationMark}
                      onShowVisual={showVisualFor(card)}
                      displayName={displayName}
                      accent={accent}
                      kindLabel={kindLabel}
                      typeName={typeName}
                      maxCount={maxCount}
                      capHint={capHint}
                    />
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addCard(deck.id)}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          ＋ {t("deck.addCard")}
        </button>
        <button
          type="button"
          onClick={() => void enrich()}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          {t("deck.enrich")}
        </button>
        {enrichMsg !== null && (
          <span role="status" className="text-sm text-ink2">
            {enrichMsg}
          </span>
        )}
      </div>

      {visualCard !== null && catalog !== null && (
        <Modal title={cardName(visualCard, lang)} onClose={() => setVisualId(null)}>
          <CardVisual card={visualCard} setInfo={catalog.sets[visualCard.set ?? ""] ?? null} />
        </Modal>
      )}
    </section>
  );
}
