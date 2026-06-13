/**
 * Function-tag SEMANTIC colors (owner request 2026-06-14: 功能性、直觀、人性化
 * 配色 — color carries meaning so a player groks what a card DOES at a glance).
 * Distinct hues spread across the wheel, tuned to read on the light paper bg
 * (rendered as a tinted chip: bg color@1A, border color@55, text = color).
 * Pokémon TYPE identity stays in typeColors.ts; this is the FUNCTION layer.
 */
export const FN_COLORS: Record<string, string> = {
  attacker: "#D14334", // red — deals damage
  boost: "#E8743B", // orange — adds damage
  accel: "#D9A21F", // gold — energy acceleration
  gust: "#B5651D", // brown — pull the opponent's Pokémon up
  draw: "#2E9E8F", // teal — draw cards
  search: "#2B76AD", // blue — search the deck
  ability: "#8A5CD0", // purple — has an Ability
  disrupt: "#C0498E", // magenta — disrupts the opponent
  protect: "#5566B5", // indigo — protection / prevention
  heal: "#3FA86A", // green — heal damage
  recover: "#7E9B33", // olive — recover cards from discard
};

/** Function-tag color, or a neutral grey when the tag is unknown. */
export function fnColor(tag: string): string {
  return FN_COLORS[tag] ?? "#8A9298";
}
