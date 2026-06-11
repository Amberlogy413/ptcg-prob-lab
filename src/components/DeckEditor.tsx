import { useT } from "../i18n/index.ts";
import { useDeckStore, deckTotal, type Deck, type DeckSection } from "../state/deckStore.ts";
import { CardRow } from "./CardRow.tsx";
import { CountRing } from "./CountRing.tsx";
import { DECK_SIZE } from "../constants.ts";

const SECTION_ORDER: DeckSection[] = ["pokemon", "trainer", "energy", "unknown"];
const SECTION_KEY: Record<DeckSection, string> = {
  pokemon: "deck.section.pokemon",
  trainer: "deck.section.trainer",
  energy: "deck.section.energy",
  unknown: "deck.section.unknown",
};

export function DeckEditor({ deck }: { deck: Deck }) {
  const t = useT();
  const renameDeck = useDeckStore((s) => s.renameDeck);
  const deleteDeck = useDeckStore((s) => s.deleteDeck);
  const addCard = useDeckStore((s) => s.addCard);
  const updateCard = useDeckStore((s) => s.updateCard);
  const removeCard = useDeckStore((s) => s.removeCard);

  const total = deckTotal(deck);
  const groups = SECTION_ORDER.map((section) => ({
    section,
    cards: deck.cards.filter((c) => c.section === section),
  })).filter((g) => g.cards.length > 0);
  const onlyUnknown = groups.length === 1 && groups[0]?.section === "unknown";

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
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
        <p className="mt-3 text-sm text-warn" role="status">
          {t("error.deckCount", { n: total })}
        </p>
      )}

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
                {cards.map((card) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    onUpdate={(patch) => updateCard(deck.id, card.id, patch)}
                    onRemove={() => removeCard(deck.id, card.id)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => addCard(deck.id)}
        className="mt-2 rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
      >
        ＋ {t("deck.addCard")}
      </button>
    </section>
  );
}
