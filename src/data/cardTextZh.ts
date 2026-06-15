/**
 * 暫譯卡效 (owner mandate 2026-06-15: 繁中 must not show raw Japanese). The
 * newest MEGA-era sets (SV11B/W, M1L/S, M2, M3) have NO official zh release
 * anywhere, so the catalog carries their ability/attack/rule TEXT in Japanese.
 *
 * Hand-checked, faithful Traditional-Chinese translations of the MOST-PLAYED of
 * those cards — explicitly PROVISIONAL (〔暫譯〕, non-official): CardVisual shows
 * the zh here with a 暫譯 tag and keeps the Japanese original available, and any
 * card NOT covered is shown honestly as 「官方中文未發行」 rather than silently in
 * Japanese. NOT machine-translated, NOT guessed — uncertain → honest gap.
 *
 * Keyed by the zh DISPLAY name (nameZh ?? name) so one entry covers every print
 * of a card. Abilities/attacks are matched by their JAPANESE name (not by index)
 * so a translation can NEVER attach to the wrong move on a differently-structured
 * reprint. Auto-update never overwrites this file.
 */

export interface CardTextOverride {
  /** Japanese ability name → its zh translation. */
  abilities?: Record<string, { name?: string; effect?: string }>;
  /** Japanese attack name → its zh translation. */
  attacks?: Record<string, { name?: string; effect?: string }>;
  /** Trainer / Energy rule text (single per card name). */
  effect?: string;
}

export const CARD_TEXT_ZH: Record<string, CardTextOverride> = {
  "喵喵ex": {
    abilities: {
      "おくのてキャッチ": {
        name: "絕招捕捉",
        effect:
          "在自己的回合,當這張卡從手牌放到備戰區時,可使用 1 次。從自己的牌庫選 1 張支援者卡,給對手看後加入手牌,然後將牌庫洗牌。這個回合若已使用過名稱帶有「絕招」的特性,則無法使用此特性。",
      },
    },
    attacks: { "しっぽをまく": { name: "捲尾", effect: "將這隻寶可夢與附加在牠身上的所有卡,放回手牌。" } },
  },
  "神奇糖果": {
    effect:
      "從自己的手牌選 1 張 2 階進化寶可夢,放到自己場上能進化成該寶可夢的基礎寶可夢身上,跳過 1 階進化來進化。(剛開始的回合,以及剛放上場的寶可夢無法使用。)",
  },
  "謝米": {
    attacks: {
      "はなをとどける": { name: "送花", effect: "從自己的牌庫選 1 張能量,附加到備戰寶可夢身上,然後將牌庫洗牌。" },
      "リーフステップ": { name: "葉步" },
    },
  },
  "氣球": { effect: "裝備這張卡的寶可夢,撤退所需的能量減少 2 個。" },
  "寶可夢交替": { effect: "將自己的戰鬥寶可夢與備戰寶可夢互換。" },
  "能量回收": { effect: "從自己的棄牌區選最多 2 張基本能量,給對手看後加入手牌。" },
  "超級袋獸ex": {
    abilities: {
      "おつかいダッシュ": {
        name: "跑腿衝刺",
        effect:
          "若這隻寶可夢在戰鬥場上,在自己的回合可使用 1 次。抽 2 張自己的牌庫。這個回合若已使用過其他「跑腿衝刺」特性,則無法使用。",
      },
    },
    attacks: { "マシンガンコンボ": { name: "機關槍連擊", effect: "投擲硬幣直到出現反面為止,每出現 1 次正面追加 50 傷害。" } },
  },
  "火焰鳥": { attacks: { "とうしのつばさ": { name: "鬥志之翼", effect: "若對手的戰鬥寶可夢是「寶可夢ex」,追加 90 傷害。" } } },
  "伊裴爾塔爾": {
    attacks: {
      "わしづかみ": { name: "鷲爪抓取", effect: "下個對手的回合,受到此招式的寶可夢無法撤退。" },
      "ダークフェザー": { name: "暗黑之羽" },
    },
  },
  "月石": {
    abilities: {
      "ルナサイクル": {
        name: "月之循環",
        effect:
          "若自己場上有「太陽岩」,在自己的回合,從自己的手牌棄掉 1 張「基本能量」,可使用 1 次。抽 3 張自己的牌庫。這個回合若已使用過其他「月之循環」特性,則無法使用。",
      },
    },
    attacks: { "パワージェム": { name: "力量寶石" } },
  },
  "太陽岩": {
    attacks: { "コスモビーム": { name: "宇宙光束", effect: "若自己的備戰區沒有「月石」,則此招式失敗。此招式的傷害不計算弱點與抵抗力。" } },
  },
  "凱西": { attacks: { "テレポートアタック": { name: "瞬間移動攻擊", effect: "將這隻寶可夢與備戰寶可夢互換。" } } },
  "蓋諾賽克特": {
    attacks: {
      "バグズキャノン": { name: "蟲炮", effect: "對對手的 1 隻寶可夢,造成這隻寶可夢附加的能量數 ×20 傷害。(備戰寶可夢不計算弱點與抵抗力。)" },
      "スピードアタック": { name: "高速攻擊" },
    },
  },
  "海星星": { attacks: { "みずでっぽう": { name: "水槍" } } },

  // ── batch 2 (by usage) ───────────────────────────────────────────────────
  "菊草葉": { attacks: { "はっぱカッター": { name: "葉刃" } } },
  "月桂葉": {
    attacks: { "つきとばす": { name: "撞飛", effect: "將對手的戰鬥寶可夢與備戰寶可夢互換。(由對手選擇要放上戰鬥場的寶可夢。)" } },
  },
  "超級大竺葵ex": {
    abilities: {
      "おいしげる": {
        name: "茂盛生長",
        effect: "只要這隻寶可夢在場上,自己全部寶可夢附加的「基本草能量」,每張都視為 2 個草能量。此特性的效果不重複套用。",
      },
    },
    attacks: { "ソーラービーム": { name: "日光束" } },
  },
  "超級寶石海星ex": {
    attacks: {
      "ジェットブロー": { name: "噴射重擊", effect: "對對手的 1 隻備戰寶可夢也造成 50 傷害。(備戰寶可夢不計算弱點與抵抗力。)" },
      "ネビュラビーム": { name: "星雲光束", effect: "此招式的傷害,不計算弱點、抵抗力,以及對手戰鬥寶可夢身上的效果。" },
    },
  },
  "古劍豹": {
    attacks: {
      "ひるがえす": { name: "翻身", effect: "如果想要,將這隻寶可夢與備戰寶可夢互換。" },
      "ライジングブレード": { name: "升刃", effect: "若對手的戰鬥寶可夢是「寶可夢ex」,追加 80 傷害。" },
    },
  },
  "勇基拉": {
    abilities: { "サイコドロー": { name: "精神抽牌", effect: "在自己的回合,當這張卡從手牌打出進化時,可使用 1 次。抽 2 張自己的牌庫。" } },
    attacks: { "ちょうねんりき": { name: "超念力" } },
  },
  "胡地": {
    abilities: { "サイコドロー": { name: "精神抽牌", effect: "在自己的回合,當這張卡從手牌打出進化時,可使用 1 次。抽 3 張自己的牌庫。" } },
    attacks: { "ハンドパワー": { name: "手牌之力", effect: "在對手的戰鬥寶可夢身上,放上自己手牌張數 ×2 個傷害指示物。" } },
  },
  "時拉比": {
    attacks: {
      "ときをめぐる": { name: "時光巡迴", effect: "從自己的牌庫選最多合計 3 張寶可夢與競技場卡,給對手看後加入手牌,然後將牌庫洗牌。" },
      "ソーラーカッター": { name: "日光刃" },
    },
  },
  "利歐路": { attacks: { "かそくづき": { name: "加速突擊", effect: "下個自己的回合,這隻寶可夢無法使用「加速突擊」。" } } },
  "超級路卡利歐ex": {
    attacks: {
      "はどうづき": { name: "波導突擊", effect: "從自己的棄牌區選最多 3 張「基本能量」,自由附加到備戰寶可夢身上。" },
      "メガブレイブ": { name: "超級勇氣", effect: "下個自己的回合,這隻寶可夢無法使用「超級勇氣」。" },
    },
  },
  "咚咚鼠": {
    attacks: {
      "しっぽはつでん": { name: "尾巴發電", effect: "從自己的棄牌區選「基本能量」,數量最多為對手全部寶可夢附加的能量總數,自由附加到自己的寶可夢身上。" },
      "でんきショック": { name: "電擊", effect: "投擲 1 次硬幣,若為正面,使對手的戰鬥寶可夢陷入麻痺。" },
    },
  },
  "捲捲耳": {
    attacks: {
      "あまえる": { name: "撒嬌", effect: "下個對手的回合,受到此招式的寶可夢所使用招式的傷害減少 20。" },
      "スキップ": { name: "蹦跳" },
    },
  },
  "超級長耳兔ex": {
    attacks: {
      "しっぷうづき": { name: "疾風突擊", effect: "若這隻寶可夢在這個回合從備戰區登上戰鬥場,追加 170 傷害。" },
      "スパイクホッパー": { name: "尖刺跳擊", effect: "此招式的傷害,不計算對手戰鬥寶可夢身上的效果。" },
    },
  },
  "幕下力士": { attacks: { "どつく": { name: "重擊" }, "がちんこ": { name: "硬碰硬" } } },
  "鐵掌力士": {
    abilities: {
      "どすこいキャッチャー": {
        name: "相撲捕手",
        effect: "在自己的回合,當這張卡從手牌打出進化時,可使用 1 次。選 1 隻對手的備戰寶可夢,與其戰鬥寶可夢互換。",
      },
    },
    attacks: { "ワイルドプレス": { name: "狂野壓制", effect: "這隻寶可夢也受到 70 傷害。" } },
  },
  "蓋諾賽克特ex": {
    abilities: {
      "メタルシグナル": {
        name: "鋼之信號",
        effect: "在自己的回合可使用 1 次。從自己的牌庫選最多 2 張鋼屬性的進化寶可夢,給對手看後加入手牌,然後將牌庫洗牌。",
      },
    },
    attacks: { "プロテクトチャージ": { name: "防護充能", effect: "下個對手的回合,這隻寶可夢受到的招式傷害減少 30。" } },
  },
  "小灰怪": {
    attacks: {
      "ちょっとずらす": { name: "稍微挪移", effect: "選 1 個對手場上寶可夢附加的能量,改附加到對手的另一隻寶可夢身上。" },
      "ビーム": { name: "光束" },
    },
  },
  "石居蟹": {
    attacks: { "じたばた": { name: "掙扎", effect: "造成這隻寶可夢身上傷害指示物數量 ×10 傷害。" }, "ツメをたてる": { name: "立爪" } },
  },
  "岩殿居蟹": {
    abilities: {
      "がんじょう": {
        name: "結實",
        effect: "當這隻寶可夢在 HP 全滿的狀態下,因招式傷害將陷入昏厥時,不會昏厥,以剩餘 HP「10」的狀態留在場上。",
      },
    },
    attacks: { "ストーンエッジ": { name: "尖石攻擊", effect: "投擲 1 次硬幣,若為正面,追加 60 傷害。" } },
  },

  // ── batch 3 (remaining cards with real usage) ────────────────────────────
  "探探鼠": {
    attacks: {
      "ちょうたつ": { name: "籌措", effect: "從自己的牌庫選 1 張物品卡,給對手看後加入手牌,然後將牌庫洗牌。" },
      "かじる": { name: "啃咬" },
    },
  },
  "古玉魚": {
    attacks: {
      "やけつくだいち": { name: "灼熱大地", effect: "將對手場上的競技場卡棄掉。若棄掉了,下個對手的回合,對手無法從手牌打出競技場卡。" },
    },
  },
  "輕飄飄": {
    attacks: { "うみのかげ": { name: "海之影", effect: "下個對手的回合,對手無法從手牌打出並使用物品卡。" } },
  },
  "超級阿勃梭魯ex": {
    attacks: {
      "デスピリオド": { name: "死亡期限", effect: "若對手的戰鬥寶可夢身上有 6 個傷害指示物,使該寶可夢昏厥。" },
      "あくのかぎづめ": { name: "惡之鉤爪", effect: "看對手的手牌,從中選 1 張卡棄掉。" },
    },
  },
  "閃焰王牌": {
    abilities: {
      "しゅんぱつりょく": { name: "瞬發力", effect: "在對戰準備將寶可夢放上戰鬥場時,若這張卡在手牌,可以將牠蓋著(反面)放上戰鬥場。" },
    },
    attacks: {
      "フレアターボ": { name: "火焰渦輪", effect: "從自己的牌庫選最多 3 張基本能量,自由附加到備戰寶可夢身上,然後將牌庫洗牌。" },
    },
  },
  "超級大嘴娃ex": {
    attacks: {
      "がっつく": { name: "狼吞虎嚥", effect: "造成自己已取得的獎賞卡張數 ×80 傷害。" },
      "ビッグバイト": { name: "大口咬", effect: "若對手的戰鬥寶可夢身上有傷害指示物,則此招式的傷害變為 30。" },
    },
  },
  "雙斧戰龍": {
    attacks: {
      "ふりおろす": { name: "揮砍", effect: "若對手的戰鬥寶可夢是進化寶可夢,追加 80 傷害。" },
      "アックスボンバー": { name: "斧炸彈", effect: "若對手的戰鬥寶可夢是基礎寶可夢,使該寶可夢昏厥。" },
    },
  },
  "螺釘地鼠": {
    attacks: { "どろかけ": { name: "潑泥" }, "どつく": { name: "重擊" } },
  },
  "炭小侍": {
    attacks: {
      "ちからをあつめる": { name: "聚集力量", effect: "從自己的牌庫選最多 2 張基本能量,給對手看後加入手牌,然後將牌庫洗牌。" },
      "チョップ": { name: "手刀" },
    },
  },
  "電電蟲": {
    attacks: { "ふいをつく": { name: "出其不意", effect: "投擲 1 次硬幣,若為反面,則此招式失敗。" } },
  },
  "鋁鋼龍": {
    attacks: { "はかいこうせん": { name: "破壞光線", effect: "選 1 個對手的戰鬥寶可夢附加的能量,棄掉。" } },
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
