/**
 * Pokémon type DATA colors (docs/04 §2 revision two) — data-encoding colors
 * like chart colors, used only for type identity (TypeChip), never as UI
 * decoration. Not part of the UI token palette by decision (DECISIONS.md).
 */
export const TYPE_COLORS: Record<string, string> = {
  Grass: "#4C9F60",
  Fire: "#E25B45",
  Water: "#3D8FD1",
  Lightning: "#C29110",
  Psychic: "#9A66C4",
  Fighting: "#C07140",
  Darkness: "#5A5470",
  Metal: "#75828F",
  Dragon: "#B98A2E",
  Colorless: "#8A9298",
  Fairy: "#D173A8",
};

/** Neutral accent for cards without a Pokémon type (Trainer / Energy). */
export const NEUTRAL_ACCENT = "#8A9298";

/**
 * Whole-card accent color (owner request 2026-06-14 — "不同寶可夢的卡片應該按
 * 其屬性顏色顯示"): a Pokémon's PRIMARY type color drives a card-edge accent on
 * every surface (visual, picker, builder). Trainer/Energy stay neutral.
 */
export function cardAccent(card: { types?: string[] }): string {
  const ty = card.types?.[0];
  return (ty !== undefined && TYPE_COLORS[ty]) || NEUTRAL_ACCENT;
}
