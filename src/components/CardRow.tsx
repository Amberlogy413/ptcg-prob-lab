import { useT } from "../i18n/index.ts";
import type { DeckCard } from "../state/deckStore.ts";
import { IconRotate } from "./icons.tsx";
import { TypeIcon } from "./TypeChip.tsx";
import { TYPE_COLORS } from "../data/typeColors.ts";

/** Regulation letters offered by the mark select (current era ± buffer). */
export const REGULATION_MARKS = ["D", "E", "F", "G", "H", "I", "J"] as const;

interface CardRowProps {
  card: DeckCard;
  onUpdate: (patch: Partial<Omit<DeckCard, "id">>) => void;
  onRemove: () => void;
  /** P8.4: true while the rotation preview marks this row as leaving. */
  rotatingOut?: boolean;
  /** Set when the row resolves to a catalog print — shows the ⓘ visual. */
  onShowVisual?: () => void;
  /** Localized display name when the row resolves to a catalog card; shown
   *  read-only (the canonical name stays the editable identity for manual rows). */
  displayName?: string;
  /** Type-color accent for the row's left edge (resolved rows). */
  accent?: string;
  /** Precise kind of a resolved card (基礎/一階進化/支援者/特殊能量…); when set,
   *  replaces the binary 基礎 toggle with an accurate read-only badge. */
  kindLabel?: string;
  /** Pokémon/Energy type of a resolved card → shows an explicit type icon. */
  typeName?: string;
}

/** One editor row: count stepper + name + Basic toggle + mark + delete (docs/04 §6). */
export function CardRow({
  card,
  onUpdate,
  onRemove,
  rotatingOut,
  onShowVisual,
  displayName,
  accent,
  kindLabel,
  typeName,
}: CardRowProps) {
  const t = useT();
  const stepBtn =
    "h-9 w-9 rounded-ctl border hairline bg-surface font-mono text-base leading-none " +
    "text-ink2 hover:text-ink disabled:opacity-40";
  const localized = displayName !== undefined && displayName !== card.name;
  return (
    <li
      style={
        accent !== undefined
          ? { borderLeftColor: accent, borderLeftWidth: "3px", backgroundColor: `${accent}0D` }
          : undefined
      }
      className={
        "flex items-center gap-2 border-b hairline py-1.5 pl-1 last:border-b-0" +
        (rotatingOut ? " opacity-40 line-through" : "")
      }
    >
      {rotatingOut && <IconRotate size="sm" className="shrink-0 text-warn" />}
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
      {typeName !== undefined && (
        <span className="shrink-0" style={{ color: TYPE_COLORS[typeName] ?? "#8A9298" }}>
          <TypeIcon type={typeName} />
        </span>
      )}
      {localized ? (
        <span
          title={card.name}
          className="flex h-9 min-w-0 flex-1 items-center truncate px-2 text-base"
        >
          {displayName}
        </span>
      ) : (
        <input
          type="text"
          value={card.name}
          placeholder={t("deck.card.namePlaceholder")}
          aria-label={t("deck.card.name")}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-base"
        />
      )}
      {kindLabel !== undefined ? (
        // Resolved card: show its PRECISE kind (stage / trainer type / energy
        // type), read-only — far more accurate than a binary 基礎 toggle.
        <span
          title={card.isBasic ? t("deck.card.basicFull") : kindLabel}
          className="flex h-9 shrink-0 items-center rounded-ctl border hairline bg-surface px-2.5 text-sm text-ink2"
        >
          {kindLabel}
        </span>
      ) : (
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
      )}
      <select
        value={card.mark ?? ""}
        aria-label={t("deck.card.mark", { name: card.name || t("deck.card.name") })}
        title={t("deck.card.markFull")}
        onChange={(e) => onUpdate({ mark: e.target.value || undefined })}
        className="h-9 w-14 shrink-0 rounded-ctl border hairline bg-surface px-1 font-mono text-sm text-ink2"
      >
        <option value="">—</option>
        {REGULATION_MARKS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {onShowVisual !== undefined && (
        <button
          type="button"
          aria-label={t("deck.card.info", { name: card.name || t("deck.card.name") })}
          aria-haspopup="dialog"
          onClick={onShowVisual}
          className="h-9 w-9 shrink-0 rounded-ctl border hairline bg-surface text-sm text-ink2 hover:text-ink"
        >
          ⓘ
        </button>
      )}
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
