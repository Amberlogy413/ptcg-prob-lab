import { useT } from "../i18n/index.ts";
import {
  kindOf,
  typeKey,
  fnKey,
  type CatalogCard,
  type CatalogSet,
} from "../data/catalog.ts";
import { TypeChip } from "./TypeChip.tsx";
import { useCardName } from "../state/cardLang.ts";

/**
 * Full-information card visual — an ORIGINAL text-only frame (no artwork, no
 * official layout, docs/DECISIONS.md "真實卡牌目錄"). Renders every fact the
 * catalog records for a card; the design tokens allow exactly one accent
 * color, so type identity is carried by text chips, not a color code.
 */
export function CardVisual({ card, setInfo }: { card: CatalogCard; setInfo?: CatalogSet | null }) {
  const t = useT();
  const label = (key: string | null, raw: string) => (key !== null ? t(key) : raw);
  const kind = kindOf(card);
  const { primary, others } = useCardName(card);

  return (
    <div
      role="group"
      aria-label={t("visual.aria", { name: primary })}
      className="rounded-card border hairline bg-receipt p-4 text-sm shadow-receipt"
    >
      {/* Header: kind · name (primary large + other languages small) · HP · types */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-ctl border hairline px-1.5 py-0.5 text-xs text-ink2">
          {label(kind.key, kind.raw)}
        </span>
        <span className="text-lg font-medium">
          {primary}
          {others.map((n) => (
            <span key={n} className="ml-1 text-sm font-normal text-ink2">
              {n}
            </span>
          ))}
          {card.suffix !== undefined &&
            !primary.toLowerCase().endsWith(card.suffix.toLowerCase()) && (
              <span className="ml-1 text-sm text-ink2">{card.suffix}</span>
            )}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {card.hp !== undefined && <span className="font-mono text-base">HP {card.hp}</span>}
          {(card.types ?? []).map((ty, i) => (
            <TypeChip key={`${ty}${i}`} type={ty} />
          ))}
        </span>
      </div>
      {card.evolveFrom !== undefined && (
        <p className="mt-1 text-xs text-ink2">
          {t("catalog.evolveFrom")}:{card.evolveFrom}
        </p>
      )}

      {/* 功能標籤 (P10.2) — what this card actually DOES. */}
      {card.fn !== undefined && card.fn.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {card.fn.map((k) => (
            <span
              key={k}
              className="rounded-full border hairline bg-surface px-2 py-0.5 text-xs text-ink2"
            >
              {label(fnKey(k), k)}
            </span>
          ))}
        </p>
      )}

      {/* Abilities — upstream data can ship unnamed slots; never render those. */}
      {(card.abilities ?? [])
        .filter((ab) => typeof ab.name === "string" && ab.name !== "")
        .map((ab, i) => (
        <div key={`${ab.name}-${i}`} className="mt-3 border-t hairline pt-2">
          <p className="font-medium">
            <span className="mr-1 rounded-ctl border hairline px-1.5 py-0.5 text-xs text-ink2">
              {t("catalog.ability")}
            </span>
            {ab.name}
          </p>
          {ab.effect !== undefined && <p className="mt-0.5 text-ink2">{ab.effect}</p>}
        </div>
      ))}

      {/* Attacks */}
      {(card.attacks ?? [])
        .filter((atk) => typeof atk.name === "string" && atk.name !== "")
        .map((atk, i) => (
        <div key={`${atk.name}-${i}`} className="mt-3 border-t hairline pt-2">
          <p className="flex flex-wrap items-center gap-1 font-medium">
            {(atk.cost ?? []).map((c, i) => (
              <TypeChip key={`${c}${i}`} type={c} />
            ))}
            <span className="ml-1">{atk.name}</span>
            {atk.damage !== undefined && <span className="ml-auto font-mono">{atk.damage}</span>}
          </p>
          {atk.effect !== undefined && <p className="mt-0.5 text-ink2">{atk.effect}</p>}
        </div>
      ))}

      {/* Trainer / Energy rule text */}
      {card.effect !== undefined && (
        <p className="mt-3 border-t hairline pt-2 text-ink2">{card.effect}</p>
      )}
      {card.item !== undefined && (
        <div className="mt-3 border-t hairline pt-2">
          <p className="font-medium">{card.item.name}</p>
          {card.item.effect !== undefined && <p className="mt-0.5 text-ink2">{card.item.effect}</p>}
        </div>
      )}

      {/* Combat footer: weakness / resistance / retreat */}
      {(card.weaknesses !== undefined ||
        card.resistances !== undefined ||
        card.retreat !== undefined) && (
        <p className="mt-3 border-t hairline pt-2 text-xs text-ink2">
          {card.weaknesses !== undefined &&
            `${t("catalog.weakness")} ${card.weaknesses
              .map((w) => `${label(typeKey(w.type), w.type)}${w.value ?? ""}`)
              .join("、")}`}
          {card.resistances !== undefined &&
            ` · ${t("catalog.resistance")} ${card.resistances
              .map((w) => `${label(typeKey(w.type), w.type)}${w.value ?? ""}`)
              .join("、")}`}
          {card.retreat !== undefined && ` · ${t("catalog.retreat")} ${card.retreat}`}
        </p>
      )}

      {/* Flavor */}
      {card.description !== undefined && (
        <p className="mt-2 text-xs italic text-ink2">{card.description}</p>
      )}

      {/* Identity footer: set · number · date · mark · legality · rarity · illustrator · dex */}
      <p className="mt-3 border-t hairline pt-2 text-xs text-ink2">
        {t("catalog.set")}:{setInfo?.name ?? card.set ?? "?"}(
        {card.set ?? "?"} {card.localId}
        {setInfo?.official != null && ` / ${setInfo.official}`})
        {setInfo?.serie != null && ` · ${setInfo.serie}`}
        {setInfo?.date != null && ` · ${t("catalog.date")} ${setInfo.date}`}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink2">
        {card.regulationMark !== undefined && (
          <span className="rounded-ctl border hairline px-1.5 py-0.5 font-mono">
            {card.regulationMark}
          </span>
        )}
        <span className={card.std === true ? "text-good" : ""}>
          {card.std === true
            ? t("catalog.legal.std")
            : card.exp === true
              ? t("catalog.legal.exp")
              : t("catalog.legal.not")}
        </span>
        {card.rarity !== undefined && card.rarity !== "None" && <span>{card.rarity}</span>}
        {card.dexId !== undefined && (
          <span>
            {t("catalog.dex")} #{card.dexId.join(" / #")}
          </span>
        )}
        {card.illustrator !== undefined && (
          <span>
            {t("catalog.illustrator")}:{card.illustrator}
          </span>
        )}
      </p>
    </div>
  );
}
