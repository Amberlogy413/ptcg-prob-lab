import { cardTier, type CatalogCard } from "../data/catalog.ts";

/**
 * Special-tier badge (owner request 2026-06-15: "分清楚咩係ex先啦"): an
 * unmistakable amber pill marking Mega / ex / V / VMAX / VSTAR Pokémon so a card
 * is never confused with its plain same-species namesake. Amber is a DATA badge
 * (like the type chips and the usage %), not UI chrome, so it is exempt from the
 * neutral-graphite accent rule. Renders nothing for an ordinary Pokémon.
 */
export function TierBadge({ card }: { card: CatalogCard }) {
  const tier = cardTier(card);
  if (tier === null) return null;
  return (
    <span
      className="rounded-ctl px-1.5 py-0.5 text-xs font-bold leading-none text-white"
      style={{ backgroundColor: "#B7791F" }}
      title={tier === "MEGA" ? "Mega（巨大化,昏厥讓對手多取獎賞卡)" : `${tier}（規則卡)`}
    >
      {tier}
    </span>
  );
}
