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

/** Neutral accent for cards without a typed identity (most Trainers). */
export const NEUTRAL_ACCENT = "#8A9298";

/** Elemental character in an Energy card's zh name → type (owner 2026-06-14:
 *  "能量卡要跟返屬性顏色"). Deterministic; names with no element stay neutral. */
const ENERGY_CHAR_TYPE: Array<[string, string]> = [
  ["草", "Grass"],
  ["火", "Fire"],
  ["水", "Water"],
  ["雷", "Lightning"],
  ["超", "Psychic"],
  ["鬥", "Fighting"],
  ["惡", "Darkness"],
  ["鋼", "Metal"],
  ["龍", "Dragon"],
  ["妖精", "Fairy"],
];

function energyType(name: string): string | null {
  for (const [ch, ty] of ENERGY_CHAR_TYPE) if (name.includes(ch)) return ty;
  return null;
}

/**
 * Whole-card accent color (owner request 2026-06-14): a Pokémon's PRIMARY type
 * color drives a card-edge accent on every surface; Energy cards follow their
 * elemental type; Trainers stay neutral.
 */
export function cardAccent(card: {
  types?: string[];
  category?: string;
  name?: string;
  nameZh?: string;
}): string {
  const ty = card.types?.[0];
  if (ty !== undefined && TYPE_COLORS[ty] !== undefined) return TYPE_COLORS[ty];
  if (card.category === "Energy") {
    const et = energyType(card.nameZh ?? card.name ?? "");
    if (et !== null) return TYPE_COLORS[et] as string;
  }
  return NEUTRAL_ACCENT;
}
