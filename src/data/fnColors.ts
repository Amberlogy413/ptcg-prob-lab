/**
 * Function-tag SEMANTIC colors (owner request 2026-06-14: 功能性、直觀、人性化
 * 配色 — color carries meaning so a player groks what a card DOES at a glance).
 * Distinct hues spread across the wheel, tuned to read on the light paper bg
 * (rendered as a tinted chip: bg color@1A, border color@55, text = color).
 * Pokémon TYPE identity stays in typeColors.ts; this is the FUNCTION layer.
 */
// Hues spread across the wheel; the 5 marginal ones darkened to clear 4.5:1
// contrast on the #F4F9FC paper bg (audit 2026-06-14). Spectrum logic:
// red→orange→gold = offense (attacker/boost/accel); teal→blue = engine
// (draw/search); purple = ability; magenta = disrupt; indigo = defense;
// green/olive = sustain (heal/recover); brown = gust.
export const FN_COLORS: Record<string, string> = {
  attacker: "#D14334", // red — deals damage
  boost: "#C85C28", // orange — adds damage
  accel: "#A8780E", // gold — energy acceleration
  gust: "#B5651D", // brown — pull the opponent's Pokémon up
  draw: "#268376", // teal — draw cards
  search: "#2B76AD", // blue — search the deck
  ability: "#8A5CD0", // purple — has an Ability
  disrupt: "#C0498E", // magenta — disrupts the opponent
  protect: "#5566B5", // indigo — protection / prevention
  heal: "#318A57", // green — heal damage
  recover: "#647D22", // olive — recover cards from discard
};

/** Function-tag color, or a neutral grey when the tag is unknown. */
export function fnColor(tag: string): string {
  return FN_COLORS[tag] ?? "#8A9298";
}
