import { useT } from "../i18n/index.ts";
import {
  kindOf,
  typeKey,
  type CatalogCard,
  type CatalogSet,
} from "../data/catalog.ts";
import { TierBadge } from "./TierBadge.tsx";
import { TypeChip } from "./TypeChip.tsx";
import { FnChip, FnSubChip } from "./FnChip.tsx";
import {
  IconHP,
  IconWeakness,
  IconResistance,
  IconRetreat,
  IconLegal,
  IconIllegal,
} from "./icons.tsx";
import { cardSurface } from "../data/typeColors.ts";
import { useCardName } from "../state/cardLang.ts";
import { CARD_TEXT_ZH, hasKana, setNameZh, serieZh } from "../data/cardTextZh.ts";

/**
 * Full-information card visual — an ORIGINAL text-only frame (no artwork, no
 * official layout, docs/DECISIONS.md "真實卡牌目錄"). Renders every fact the
 * catalog records for a card; a Pokémon's primary type color drives a left
 * edge accent (owner request 2026-06-14), with detailed type identity still
 * carried by the labelled type chips.
 */
export function CardVisual({ card, setInfo }: { card: CatalogCard; setInfo?: CatalogSet | null }) {
  const t = useT();
  const label = (key: string | null, raw: string) => (key !== null ? t(key) : raw);
  const kind = kindOf(card);
  const { primary, others } = useCardName(card);

  // 暫譯卡效 (owner mandate 2026-06-15): newest ja-only sets have no official zh,
  // so prefer a hand-checked provisional translation and flag it; any still-ja
  // field is shown HONESTLY as 「官方中文未發行」 — never silently in Japanese.
  const ov = CARD_TEXT_ZH[card.id];
  const ProvTag = ({ ja }: { ja?: string }) => (
    <span
      title={t("catalog.provisionalTitle") + (ja !== undefined && ja !== "" ? `\n原文:${ja}` : "")}
      className="ml-1 rounded-ctl px-1 py-0.5 align-middle text-[10px] font-medium text-white"
      style={{ backgroundColor: "#B7791F" }}
    >
      {t("catalog.provisional")}
    </span>
  );
  const JaNote = () => (
    <span className="ml-1 align-middle text-xs text-warn">〔{t("catalog.noOfficialZh")}〕</span>
  );

  return (
    <div
      role="group"
      aria-label={t("visual.aria", { name: primary })}
      style={{ ...cardSurface(card), borderLeftWidth: "4px" }}
      className="rounded-card border p-4 text-sm shadow-receipt"
    >
      {/* Header: kind · name (primary large + other languages small) · HP · types */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-ctl border hairline px-1.5 py-0.5 text-xs text-ink2">
          {label(kind.key, kind.raw)}
        </span>
        <TierBadge card={card} />
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
          {card.hp !== undefined && (
            <span className="inline-flex items-center gap-0.5 font-mono text-base">
              <IconHP className="text-bad" size="sm" />
              {card.hp}
            </span>
          )}
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

      {/* 功能標籤 (P10.2) — what this card actually DOES, in semantic color+icon. */}
      {card.fn !== undefined && card.fn.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {card.fn.map((k) => (
            <FnChip key={k} tag={k} />
          ))}
        </p>
      )}
      {/* 功能子分類 (2026-06-14) — the precise breakdown of each function. */}
      {card.fnSub !== undefined && card.fnSub.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-1">
          {card.fnSub.map((s) => (
            <FnSubChip key={s} sub={s} />
          ))}
        </p>
      )}

      {/* Abilities — upstream data can ship unnamed slots; never render those.
          Map over the ORIGINAL array so the 暫譯 override aligns by index. */}
      {(card.abilities ?? []).map((ab, i) => {
        if (typeof ab.name !== "string" || ab.name === "") return null;
        const o = ov?.abilities?.[i];
        const name = o?.name ?? ab.name;
        const effect = o?.effect ?? ab.effect;
        const prov = o !== undefined;
        const ja = !prov && (hasKana(name) || hasKana(effect));
        return (
          <div key={`${ab.name}-${i}`} className="mt-3 border-t hairline pt-2">
            <p className="font-medium">
              <span className="mr-1 rounded-ctl border hairline px-1.5 py-0.5 text-xs text-ink2">
                {t("catalog.ability")}
              </span>
              {name}
              {prov && <ProvTag ja={ab.name} />}
              {ja && <JaNote />}
            </p>
            {effect !== undefined && effect !== "" && (
              <p className="mt-0.5 text-ink2" title={prov ? ab.effect : undefined}>
                {effect}
              </p>
            )}
          </div>
        );
      })}

      {/* Attacks */}
      {(card.attacks ?? []).map((atk, i) => {
        if (typeof atk.name !== "string" || atk.name === "") return null;
        const o = ov?.attacks?.[i];
        const name = o?.name ?? atk.name;
        const effect = o?.effect ?? atk.effect;
        const prov = o !== undefined;
        const ja = !prov && (hasKana(name) || hasKana(effect));
        return (
          <div key={`${atk.name}-${i}`} className="mt-3 border-t hairline pt-2">
            <p className="flex flex-wrap items-center gap-1 font-medium">
              {(atk.cost ?? []).map((c, j) => (
                <TypeChip key={`${c}${j}`} type={c} />
              ))}
              <span className="ml-1">{name}</span>
              {prov && <ProvTag ja={atk.name} />}
              {ja && <JaNote />}
              {atk.damage !== undefined && <span className="ml-auto font-mono">{atk.damage}</span>}
            </p>
            {effect !== undefined && effect !== "" && (
              <p className="mt-0.5 text-ink2" title={prov ? atk.effect : undefined}>
                {effect}
              </p>
            )}
          </div>
        );
      })}

      {/* Trainer / Energy rule text */}
      {card.effect !== undefined &&
        (() => {
          const effect = ov?.effect ?? card.effect;
          const prov = ov?.effect !== undefined;
          const ja = !prov && hasKana(effect);
          return (
            <p className="mt-3 border-t hairline pt-2 text-ink2" title={prov ? card.effect : undefined}>
              {effect}
              {prov && <ProvTag ja={card.effect} />}
              {ja && <JaNote />}
            </p>
          );
        })()}
      {card.item !== undefined && (
        <div className="mt-3 border-t hairline pt-2">
          <p className="font-medium">{card.item.name}</p>
          {card.item.effect !== undefined && <p className="mt-0.5 text-ink2">{card.item.effect}</p>}
        </div>
      )}

      {/* Combat footer: weakness (danger red) / resistance (defensive green) / retreat (neutral) */}
      {(card.weaknesses !== undefined ||
        card.resistances !== undefined ||
        card.retreat !== undefined) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t hairline pt-2 text-xs">
          {card.weaknesses !== undefined && (
            <span className="inline-flex items-center gap-1 text-bad">
              <IconWeakness size="sm" />
              {t("catalog.weakness")}{" "}
              {card.weaknesses
                .map((w) => `${label(typeKey(w.type), w.type)}${w.value ?? ""}`)
                .join("、")}
            </span>
          )}
          {card.resistances !== undefined && (
            <span className="inline-flex items-center gap-1 text-good">
              <IconResistance size="sm" />
              {t("catalog.resistance")}{" "}
              {card.resistances
                .map((w) => `${label(typeKey(w.type), w.type)}${w.value ?? ""}`)
                .join("、")}
            </span>
          )}
          {card.retreat !== undefined && (
            <span className="inline-flex items-center gap-1 text-ink2">
              <IconRetreat size="sm" />
              {t("catalog.retreat")} {card.retreat}
            </span>
          )}
        </p>
      )}

      {/* Flavor (ja-only sets keep flavor in Japanese — flag it honestly). */}
      {card.description !== undefined && (
        <p className="mt-2 text-xs italic text-ink2">
          {card.description}
          {hasKana(card.description) && <JaNote />}
        </p>
      )}

      {/* Identity footer: set · number · date · mark · legality · rarity · illustrator · dex.
          Set name is zh (暫譯) / set code, never the raw Japanese name. */}
      {(() => {
        const sn = setNameZh(card.set, setInfo?.name);
        const serie = serieZh(setInfo?.serie);
        return (
          <p className="mt-3 border-t hairline pt-2 text-xs text-ink2">
            {t("catalog.set")}:{sn.text}
            {sn.provisional && <ProvTag ja={setInfo?.name ?? undefined} />}(
            {card.set ?? "?"} {card.localId}
            {setInfo?.official != null && ` / ${setInfo.official}`})
            {serie != null && ` · ${serie}`}
            {setInfo?.date != null && ` · ${t("catalog.date")} ${setInfo.date}`}
          </p>
        );
      })()}
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink2">
        {card.regulationMark !== undefined && (
          <span className="rounded-ctl border hairline px-1.5 py-0.5 font-mono">
            {card.regulationMark}
          </span>
        )}
        {card.std === true ? (
          <span className="inline-flex items-center gap-1 text-good">
            <IconLegal size="sm" />
            {t("catalog.legal.std")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-ink2">
            <IconIllegal size="sm" />
            {card.exp === true ? t("catalog.legal.exp") : t("catalog.legal.not")}
          </span>
        )}
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

      {/* 賽事數據 — every card records its real 採用率 (owner request 2026-06-15);
          0% means it was not seen in the current Limitless sample. */}
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink2">
        <span
          className={
            card.usage !== undefined
              ? "rounded-full border border-pink px-1.5 py-0.5 font-mono text-pink"
              : "rounded-full border hairline px-1.5 py-0.5 font-mono opacity-60"
          }
          title={card.usage === undefined ? t("catalog.usageNoneTitle") : undefined}
        >
          {t("catalog.usageLine", { p: card.usage ?? 0 })}
        </span>
        {card.pop !== undefined && <span>{t("catalog.popRank", { n: card.pop })}</span>}
        {card.owner !== undefined && <span>{t("catalog.ownerOf", { name: card.owner })}</span>}
      </p>
    </div>
  );
}
