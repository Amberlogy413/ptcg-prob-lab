/**
 * Pokémon type DATA colors (docs/04 §2 revision three) — data-encoding colors
 * like chart colors, used only for type identity (TypeChip), never as UI
 * decoration. Not part of the UI token palette by decision (DECISIONS.md).
 *
 * Revision three (owner 2026-06-17: 「顏色要更精準,分別更明顯,而家雷同龍一樣色」)
 * re-spaces all eleven hues so no two read alike at chip size:
 *  - Lightning is now a BRIGHT clean yellow vs Dragon a DARK red-bronze — a
 *    decisive lightness + hue gap (the old golds were near-identical).
 *  - The three greys (Darkness / Metal / Colorless) are pulled apart into
 *    dark-indigo / steel-blue / light-neutral so they no longer collide.
 *  - Fire (red) and Fighting (orange) are split further apart on the warm arc.
 */
export const TYPE_COLORS: Record<string, string> = {
  Grass: "#3B9E55", // leaf green
  Fire: "#E0402F", // clear red
  Water: "#2A82C7", // clear blue
  Lightning: "#E0A800", // bright golden YELLOW — unmistakably electric, clearly apart from Dragon
  Psychic: "#9A4FC2", // violet
  Fighting: "#CB6A2C", // bright orange — sits between Fire-red and Lightning-yellow
  Darkness: "#46415E", // dark indigo-charcoal — the darkest swatch
  Metal: "#5E7488", // steel blue-grey (mid, clearly bluish)
  Dragon: "#7C5410", // deep dark BRONZE — decisively unlike bright Lightning (owner 2026-06-17)
  Colorless: "#9AA1A9", // light neutral grey — clearly lighter than Metal
  Fairy: "#D75FA0", // pink-magenta
};

/** Neutral accent for cards without a typed identity (most Trainers). */
export const NEUTRAL_ACCENT = "#8A9298";

/** Elemental character in an Energy card's zh name → type (owner 2026-06-14:
 *  "能量卡要跟返屬性顏色"). Deterministic; names with no element stay neutral. */
const ENERGY_CHAR_TYPE: Array<[string, string]> = [
  ["草", "Grass"],
  ["火", "Fire"],
  ["炎", "Fire"], // older/JP wording for the Fire type (基本【炎】能量)
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
 *  (special energies, trainers mis-filed under energy). Deterministic.
 *  zh basic/typed energies put the element char immediately before the trailing
 *  能量 (基本火能量 / 點火能量 / 心靈感應超能量 / 妖精能量). We match that *trailing*
 *  element only — NOT any occurrence — so a proper-noun energy like 火箭隊能量
 *  (Team Rocket's Energy, 火 ∈ 火箭隊) stays neutral instead of false-matching Fire. */
export function energyType(name: string): string | null {
  // Strip the 【】 brackets some prints wrap the element in (基本【火】能量) so the
  // trailing-element match still sees 火/水/… right before 能量.
  const clean = name.replace(/[【】]/g, "");
  const zh = clean.match(/^(.*)能量$/);
  if (zh !== null) {
    const head = zh[1] ?? "";
    for (const [ch, ty] of ENERGY_CHAR_TYPE) if (head.endsWith(ch)) return ty;
    return null; // zh energy with no trailing element → special
  }
  if (/energy/i.test(clean)) for (const [re, ty] of ENERGY_EN_TYPE) if (re.test(clean)) return ty;
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
