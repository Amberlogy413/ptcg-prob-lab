/**
 * 暫譯卡效 (owner mandate 2026-06-15: 繁中 must not show raw Japanese). The
 * newest MEGA-era sets (SV11B/W, M1L/S, M2, M3) have NO official zh release
 * anywhere, so the catalog carries their ability/attack/rule TEXT in Japanese.
 *
 * This is a hand-checked, faithful Traditional-Chinese translation of the
 * MOST-PLAYED of those cards — explicitly PROVISIONAL (〔暫譯〕, non-official):
 * CardVisual shows the zh here with a 暫譯 tag and keeps the Japanese original
 * available, and any card NOT in this table is shown honestly as
 * 「官方中文未發行」rather than silently in Japanese. NOT machine-translated, NOT
 * guessed — where uncertain we leave the honest gap instead (real-data-only
 * mandate). Keyed by catalog card id; ability/attack arrays align by index with
 * the card's own abilities/attacks. Auto-update never overwrites this file.
 */

export interface CardTextOverride {
  abilities?: { name?: string; effect?: string }[];
  attacks?: { name?: string; effect?: string }[];
  effect?: string;
}

export const CARD_TEXT_ZH: Record<string, CardTextOverride> = {
  // 喵喵ex (Meowth ex)
  "M3-061": {
    abilities: [
      {
        name: "絕招捕捉",
        effect:
          "在自己的回合,當這張卡從手牌放到備戰區時,可使用 1 次。從自己的牌庫選 1 張支援者卡,給對手看後加入手牌,然後將牌庫洗牌。這個回合若已使用過名稱帶有「絕招」的特性,則無法使用此特性。",
      },
    ],
    attacks: [
      { name: "捲尾", effect: "將這隻寶可夢與附加在牠身上的所有卡,放回手牌。" },
    ],
  },
  // 神奇糖果 (Rare Candy) — staple, official zh wording
  "M1S-082": {
    effect:
      "從自己的手牌選 1 張 2 階進化寶可夢,放到自己場上能進化成該寶可夢的基礎寶可夢身上,跳過 1 階進化來進化。(剛開始的回合,以及剛放上場的寶可夢無法使用。)",
  },
  // 謝米 (Shaymin)
  "M3-003": {
    attacks: [
      { name: "送花", effect: "從自己的牌庫選 1 張能量,附加到備戰寶可夢身上,然後將牌庫洗牌。" },
      { name: "葉步", effect: "" },
    ],
  },
  // 氣球 (Air Balloon) — staple, official zh wording
  "SV11B-082": {
    effect: "裝備這張卡的寶可夢,撤退所需的能量減少 2 個。",
  },
  // 寶可夢交替 (Switch) — staple
  "M2-102": {
    effect: "將自己的戰鬥寶可夢與備戰寶可夢互換。",
  },
  // 超級袋獸ex (Mega Kangaskhan ex)
  "M1S-051": {
    abilities: [
      {
        name: "跑腿衝刺",
        effect:
          "若這隻寶可夢在戰鬥場上,在自己的回合可使用 1 次。抽 2 張自己的牌庫。這個回合若已使用過其他「跑腿衝刺」特性,則無法使用。",
      },
    ],
    attacks: [
      {
        name: "機關槍連擊",
        effect: "投擲硬幣直到出現反面為止,每出現 1 次正面追加 50 傷害。",
      },
    ],
  },
  // 火焰鳥 (Moltres)
  "M2-014": {
    attacks: [
      { name: "鬥志之翼", effect: "若對手的戰鬥寶可夢是「寶可夢ex」,追加 90 傷害。" },
    ],
  },
  // 伊裴爾塔爾 (Yveltal)
  "M1L-040": {
    attacks: [
      { name: "鷲爪抓取", effect: "下個對手的回合,受到此招式的寶可夢無法撤退。" },
      { name: "暗黑之羽", effect: "" },
    ],
  },
  // 能量回收 (Energy Recycler) — staple
  "SV11W-079": {
    effect: "從自己的棄牌區選最多 2 張基本能量,給對手看後加入手牌。",
  },
  // 月石 (Lunatone)
  "M1L-026": {
    abilities: [
      {
        name: "月之循環",
        effect:
          "若自己場上有「太陽岩」,在自己的回合,從自己的手牌棄掉 1 張「基本能量」,可使用 1 次。抽 3 張自己的牌庫。這個回合若已使用過其他「月之循環」特性,則無法使用。",
      },
    ],
    attacks: [{ name: "力量寶石", effect: "" }],
  },
  // 太陽岩 (Solrock)
  "M1L-027": {
    attacks: [
      {
        name: "宇宙光束",
        effect: "若自己的備戰區沒有「月石」,則此招式失敗。此招式的傷害不計算弱點與抵抗力。",
      },
    ],
  },
  // 凱西 (Abra)
  "M1S-036": {
    attacks: [
      { name: "瞬間移動攻擊", effect: "將這隻寶可夢與備戰寶可夢互換。" },
    ],
  },
  // 蓋諾賽克特 (Genesect)
  "M2-008": {
    attacks: [
      {
        name: "蟲炮",
        effect:
          "對對手的 1 隻寶可夢,造成這隻寶可夢附加的能量數 ×20 傷害。(備戰寶可夢不計算弱點與抵抗力。)",
      },
      { name: "高速攻擊", effect: "" },
    ],
  },
  // 海星星 (Staryu)
  "M3-020": {
    attacks: [{ name: "水槍", effect: "" }],
  },
};

/** Any string carrying Japanese kana (so the display can flag untranslated ja). */
export function hasKana(s: string | undefined): boolean {
  return s !== undefined && /[ぁ-んァ-ヶ]/.test(s);
}

// Set + series names for the newest ja-only sets (no official zh release). The
// SERIES have established zh; individual SET names are brand names, so we give a
// zh暫譯 only where the English/JP name is unambiguous and verifiable (sources:
// Bulbapedia / PokéBeach 2025). The one we can't confirm (M3) falls back to its
// real set CODE — never an invented name (real-data-only mandate 2026-06-15).
const SERIE_ZH: Record<string, string> = {
  "ポケモンカードゲーム スカーレット&バイオレット": "朱&紫系列",
  "ポケモンカードゲーム MEGA": "MEGA 系列",
};
const SET_NAME_ZH: Record<string, string> = {
  SV11W: "白焰", // White Flare
  SV11B: "黑閃雷", // Black Bolt
  M1L: "超級勇氣", // Mega Brave
  M1S: "超級交響曲", // Mega Symphonia
  M2: "業火X", // Inferno X
};
/** zh series name (established) or the original if already zh. */
export function serieZh(serie: string | null | undefined): string | null {
  if (serie === null || serie === undefined) return null;
  return SERIE_ZH[serie] ?? serie;
}
/** A display set name with NO Japanese: a verifiable zh暫譯 if we have one, else
 *  the real set code (never an invented name). `provisional` flags the 暫譯 case. */
export function setNameZh(
  setId: string | null | undefined,
  name: string | null | undefined,
): { text: string; provisional: boolean } {
  if (setId !== null && setId !== undefined && SET_NAME_ZH[setId] !== undefined) {
    return { text: SET_NAME_ZH[setId]!, provisional: true };
  }
  if (hasKana(name ?? undefined)) return { text: setId ?? "?", provisional: false };
  return { text: name ?? setId ?? "?", provisional: false };
}
