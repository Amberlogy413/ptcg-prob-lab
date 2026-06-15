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

// English basic-energy names ("Water Energy" / "Basic Fire Energy"). Special
// energies (Neo Upper / Reversal …) have no element word → stay null.
const ENERGY_EN_TYPE: Array<[RegExp, string]> = [
  [/grass/i, "Grass"],
  [/fire/i, "Fire"],
  [/water/i, "Water"],
  [/lightning/i, "Lightning"],
  [/psychic/i, "Psychic"],
  [/fighting/i, "Fighting"],
  [/dark(ness)?/i, "Darkness"],
  [/metal/i, "Metal"],
];

/** Elemental type of an Energy card from its zh OR English name; null if none
 *  (special energies, trainers mis-filed under energy). Deterministic. */
export function energyType(name: string): string | null {
  for (const [ch, ty] of ENERGY_CHAR_TYPE) if (name.includes(ch)) return ty;
  if (/energy/i.test(name)) for (const [re, ty] of ENERGY_EN_TYPE) if (re.test(name)) return ty;
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

/**
 * The Pokémon type that drives a card's color/icon: a Pokémon's primary type,
 * an Energy's elemental type (from its zh name), else null (Trainers / typeless).
 * Used to show an explicit type ICON on cards (owner request 2026-06-15:
 * 「快速加入卡片…應明顯地顯示出其相關屬性的 icon」).
 */
export function cardType(card: {
  types?: string[];
  category?: string;
  name?: string;
  nameZh?: string;
}): string | null {
  const ty = card.types?.[0];
  if (ty !== undefined && TYPE_COLORS[ty] !== undefined) return ty;
  if (card.category === "Energy") return energyType(card.nameZh ?? card.name ?? "");
  return null;
}

/**
 * Whole-card SURFACE styling (owner request 2026-06-15: 「寶可夢卡成張連底色都係
 *跟返屬性顏色」). The card's type color tints the entire surface — a soft fill +
 * a matching border + a stronger left edge — not just an edge accent. Tints are
 * low-alpha so card text stays readable on the light theme. `strength` lets
 * dense list rows use a fainter wash than standalone card tiles.
 */
export function cardSurface(
  card: { types?: string[]; category?: string; name?: string; nameZh?: string },
  strength: "tile" | "row" = "tile",
): { backgroundColor: string; borderColor: string; borderLeftColor: string } {
  const accent = cardAccent(card);
  const fill = strength === "tile" ? "16" : "0D"; // ~9% vs ~5%
  const edge = strength === "tile" ? "59" : "40"; // ~35% vs ~25%
  return { backgroundColor: `${accent}${fill}`, borderColor: `${accent}${edge}`, borderLeftColor: accent };
}
