import { useCardName } from "../state/cardLang.ts";
import type { CatalogCard } from "../data/catalog.ts";

/**
 * A catalog card's name in the user's chosen card-name language, with the
 * other languages shown small when tri-lingual is on (owner request: primary
 * language large & prominent, others secondary).
 */
export function CardName({ card, className }: { card: CatalogCard; className?: string }) {
  const { primary, others } = useCardName(card);
  return (
    <span className={className}>
      {primary}
      {others.map((n) => (
        <span key={n} className="ml-1 text-xs font-normal text-ink2">
          {n}
        </span>
      ))}
    </span>
  );
}
