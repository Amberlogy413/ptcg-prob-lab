import { useT } from "../i18n/index.ts";
import type { DeckCard } from "../state/deckStore.ts";

interface CardRowProps {
  card: DeckCard;
  onUpdate: (patch: Partial<Omit<DeckCard, "id">>) => void;
  onRemove: () => void;
}

/** One editor row: count stepper + name + Basic toggle + delete (docs/04 §6). */
export function CardRow({ card, onUpdate, onRemove }: CardRowProps) {
  const t = useT();
  const stepBtn =
    "h-9 w-9 rounded-ctl border hairline bg-surface font-mono text-base leading-none " +
    "text-ink2 hover:text-ink disabled:opacity-40";
  return (
    <li className="flex items-center gap-2 border-b hairline py-1.5 last:border-b-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={stepBtn}
          aria-label={t("deck.card.dec")}
          disabled={card.count <= 0}
          onClick={() => onUpdate({ count: card.count - 1 })}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          value={card.count}
          aria-label={t("deck.card.count")}
          onChange={(e) => onUpdate({ count: Number(e.target.value) })}
          className="h-9 w-12 rounded-ctl border hairline bg-surface text-center font-mono text-base"
        />
        <button
          type="button"
          className={stepBtn}
          aria-label={t("deck.card.inc")}
          disabled={card.count >= 60}
          onClick={() => onUpdate({ count: card.count + 1 })}
        >
          ＋
        </button>
      </div>
      <input
        type="text"
        value={card.name}
        placeholder={t("deck.card.namePlaceholder")}
        aria-label={t("deck.card.name")}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-base"
      />
      <button
        type="button"
        role="switch"
        aria-checked={card.isBasic}
        aria-label={t("deck.card.basicAria", { name: card.name || t("deck.card.name") })}
        title={t("deck.card.basicFull")}
        onClick={() => onUpdate({ isBasic: !card.isBasic })}
        className={
          "h-9 shrink-0 rounded-ctl border px-2.5 text-sm transition-colors duration-fast " +
          (card.isBasic
            ? "border-blue bg-blue text-white"
            : "hairline bg-surface text-ink2 hover:text-ink")
        }
      >
        {t("deck.card.basic")}
      </button>
      <button
        type="button"
        aria-label={t("deck.card.delete")}
        onClick={onRemove}
        className="h-9 w-9 shrink-0 rounded-ctl border hairline bg-surface text-ink2 hover:text-bad"
      >
        ✕
      </button>
    </li>
  );
}
