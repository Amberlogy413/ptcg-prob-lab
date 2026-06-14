/**
 * Template deck bank — REAL archetype decklists (owner request 2026-06-15:
 * "實實在在解決" — no more abstract role placeholders). Each template is a real
 * tournament build pulled from public/catalog/decks-zh-Hant.json (Limitless),
 * so every row resolves to its catalog card → precise kind, type icon and real
 * mulligan, not a binary 基礎 guess. The 6 chosen archetypes span the mulligan
 * range (7 → 16 Basics) for teaching. Names are clean zh; a handful of brand-new
 * (SV11/M-era) trainer/energy rows have no zh-tw catalog entry yet and degrade
 * gracefully (CardRow shows their section kind). Text-only, IP-safe.
 *
 * Every template sums to exactly 60 and has at least one Basic;
 * tests/templates.spec.tsx pins both invariants.
 */

import type { DeckSection } from "../state/deckStore.ts";

export interface TemplateCard {
  name: string;
  count: number;
  isBasic: boolean;
  section: DeckSection;
}

export interface DeckTemplate {
  /** i18n: templates.<id>.name / templates.<id>.blurb */
  id: string;
  cards: TemplateCard[];
}

const P = "pokemon" as const;
const T = "trainer" as const;
const E = "energy" as const;

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: "t1",
    cards: [
      { name: "多龍梅西亞", count: 4, isBasic: true, section: P },
      { name: "多龍奇", count: 4, isBasic: false, section: P },
      { name: "多龍巴魯托ex", count: 3, isBasic: false, section: P },
      { name: "願增猿", count: 2, isBasic: true, section: P },
      { name: "含羞苞", count: 2, isBasic: true, section: P },
      { name: "喵喵ex", count: 1, isBasic: true, section: P },
      { name: "謝米", count: 1, isBasic: true, section: P },
      { name: "吉雉雞", count: 1, isBasic: true, section: P },
      { name: "帕底亞 肯泰羅", count: 1, isBasic: true, section: P },
      { name: "莉莉艾的決心", count: 4, isBasic: false, section: T },
      { name: "杜若", count: 3, isBasic: false, section: T },
      { name: "老大的指令（坂木）", count: 3, isBasic: false, section: T },
      { name: "好友幫手百花露", count: 4, isBasic: false, section: T },
      { name: "寶可夢平板", count: 4, isBasic: false, section: T },
      { name: "改造之錘", count: 4, isBasic: false, section: T },
      { name: "超級球", count: 4, isBasic: false, section: T },
      { name: "夜間擔架", count: 2, isBasic: false, section: T },
      { name: "特殊紅牌", count: 1, isBasic: false, section: T },
      { name: "不公印章", count: 1, isBasic: false, section: T },
      { name: "危險廢墟", count: 1, isBasic: false, section: T },
      { name: "火箭隊的監視塔", count: 1, isBasic: false, section: T },
      { name: "基本火能量", count: 4, isBasic: false, section: E },
      { name: "基本超能量", count: 3, isBasic: false, section: E },
      { name: "基本惡能量", count: 2, isBasic: false, section: E },
    ],
  },
  {
    id: "t2",
    cards: [
      { name: "呱呱泡蛙", count: 4, isBasic: true, section: P },
      { name: "呱頭蛙", count: 3, isBasic: false, section: P },
      { name: "甲賀忍蛙", count: 3, isBasic: false, section: P },
      // 光輝寶可夢每副牌組最多 1 張;光輝甲賀忍蛙係基礎寶可夢(計入重抽)。
      { name: "光輝甲賀忍蛙", count: 1, isBasic: true, section: P },
      { name: "敲音猴", count: 3, isBasic: true, section: P },
      { name: "啪咚猴", count: 3, isBasic: false, section: P },
      { name: "角金魚", count: 2, isBasic: true, section: P },
      { name: "金魚王", count: 1, isBasic: false, section: P },
      { name: "謝米", count: 1, isBasic: true, section: P },
      { name: "莉莉艾的決心", count: 4, isBasic: false, section: T },
      { name: "白露", count: 2, isBasic: false, section: T },
      { name: "老大的指令（坂木）", count: 1, isBasic: false, section: T },
      { name: "米可利的體貼", count: 1, isBasic: false, section: T },
      { name: "小光", count: 1, isBasic: false, section: T },
      { name: "好友幫手百花露", count: 4, isBasic: false, section: T },
      { name: "寶可夢平板", count: 4, isBasic: false, section: T },
      { name: "神奇糖果", count: 2, isBasic: false, section: T },
      { name: "夜間擔架", count: 2, isBasic: false, section: T },
      { name: "超級球", count: 2, isBasic: false, section: T },
      { name: "能量回收", count: 1, isBasic: false, section: T },
      { name: "特殊紅牌", count: 1, isBasic: false, section: T },
      { name: "寶可夢交替", count: 1, isBasic: false, section: T },
      { name: "氣球", count: 3, isBasic: false, section: T },
      { name: "衝浪海灘", count: 3, isBasic: false, section: T },
      { name: "基本水能量", count: 6, isBasic: false, section: E },
      { name: "新星增幅能量", count: 1, isBasic: false, section: E },
    ],
  },
  {
    id: "t3",
    cards: [
      { name: "呆呆獸", count: 4, isBasic: true, section: P },
      { name: "呆呆王", count: 3, isBasic: false, section: P },
      { name: "酋雷姆ex", count: 2, isBasic: true, section: P },
      { name: "超級袋獸ex", count: 2, isBasic: true, section: P },
      { name: "巨金怪", count: 2, isBasic: false, section: P },
      { name: "拉帝亞斯", count: 2, isBasic: true, section: P },
      { name: "皮皮", count: 1, isBasic: true, section: P },
      { name: "吉雉雞", count: 1, isBasic: true, section: P },
      { name: "喵喵ex", count: 1, isBasic: true, section: P },
      { name: "迷唇娃", count: 1, isBasic: true, section: P },
      { name: "含羞苞", count: 1, isBasic: true, section: P },
      { name: "謝米", count: 1, isBasic: true, section: P },
      { name: "棄世猴", count: 1, isBasic: false, section: P },
      { name: "莉莉艾的決心", count: 4, isBasic: false, section: T },
      { name: "暗碼迷的解讀", count: 3, isBasic: false, section: T },
      { name: "白露", count: 1, isBasic: false, section: T },
      { name: "小光", count: 1, isBasic: false, section: T },
      { name: "衝浪手", count: 1, isBasic: false, section: T },
      { name: "超級球", count: 4, isBasic: false, section: T },
      { name: "寶可夢平板", count: 4, isBasic: false, section: T },
      { name: "奇蹟貼片", count: 3, isBasic: false, section: T },
      { name: "夜間擔架", count: 2, isBasic: false, section: T },
      { name: "頂尖捕捉器", count: 1, isBasic: false, section: T },
      { name: "勇者手環", count: 1, isBasic: false, section: T },
      { name: "夜間學院", count: 4, isBasic: false, section: T },
      { name: "心靈感應超能量", count: 4, isBasic: false, section: E },
      { name: "基本超能量", count: 3, isBasic: false, section: E },
      { name: "回力鏢能量", count: 2, isBasic: false, section: E },
    ],
  },
  {
    id: "t4",
    cards: [
      { name: "石居蟹", count: 4, isBasic: true, section: P },
      { name: "岩殿居蟹", count: 3, isBasic: false, section: P },
      { name: "超級袋獸ex", count: 2, isBasic: true, section: P },
      { name: "厄鬼椪 碧草面具", count: 1, isBasic: true, section: P },
      { name: "莉莉艾的決心", count: 4, isBasic: false, section: T },
      { name: "老大的指令（坂木）", count: 4, isBasic: false, section: T },
      { name: "杜若", count: 3, isBasic: false, section: T },
      { name: "火箭隊的拉姆達", count: 3, isBasic: false, section: T },
      { name: "白露", count: 2, isBasic: false, section: T },
      { name: "阿克羅瑪的執著", count: 1, isBasic: false, section: T },
      { name: "寶可夢中心的姐姐", count: 1, isBasic: false, section: T },
      { name: "巨型冰品", count: 4, isBasic: false, section: T },
      { name: "寶可夢手錶3.0", count: 3, isBasic: false, section: T },
      { name: "好友幫手百花露", count: 2, isBasic: false, section: T },
      { name: "超級球", count: 2, isBasic: false, section: T },
      { name: "特殊紅牌", count: 1, isBasic: false, section: T },
      { name: "寶可夢交替", count: 1, isBasic: false, section: T },
      { name: "好傷藥", count: 1, isBasic: false, section: T },
      { name: "氣球", count: 1, isBasic: false, section: T },
      { name: "英雄披風", count: 1, isBasic: false, section: T },
      { name: "活力之森", count: 1, isBasic: false, section: T },
      { name: "火箭隊的工廠", count: 1, isBasic: false, section: T },
      { name: "基本鬥能量", count: 3, isBasic: false, section: E },
      { name: "基本草能量", count: 3, isBasic: false, section: E },
      { name: "增幅草能量", count: 3, isBasic: false, section: E },
      { name: "尖刺能量", count: 3, isBasic: false, section: E },
      { name: "薄霧能量", count: 2, isBasic: false, section: E },
    ],
  },
  {
    id: "t5",
    cards: [
      { name: "獨角蟲", count: 4, isBasic: true, section: P },
      { name: "鐵殼蛹", count: 4, isBasic: false, section: P },
      { name: "大針蜂", count: 4, isBasic: false, section: P },
      { name: "土龍弟弟", count: 3, isBasic: true, section: P },
      { name: "土龍節節", count: 3, isBasic: false, section: P },
      { name: "蟲滾泥", count: 1, isBasic: true, section: P },
      { name: "蟲甲聖", count: 1, isBasic: false, section: P },
      { name: "吉雉雞", count: 1, isBasic: true, section: P },
      { name: "切割洛托姆", count: 1, isBasic: true, section: P },
      { name: "喵喵ex", count: 1, isBasic: true, section: P },
      { name: "莉莉艾的決心", count: 4, isBasic: false, section: T },
      { name: "老大的指令（坂木）", count: 3, isBasic: false, section: T },
      { name: "小光", count: 2, isBasic: false, section: T },
      { name: "好友幫手百花露", count: 4, isBasic: false, section: T },
      { name: "捕蟲組合", count: 4, isBasic: false, section: T },
      { name: "寶可夢平板", count: 4, isBasic: false, section: T },
      { name: "超級球", count: 3, isBasic: false, section: T },
      { name: "釣竿MAX", count: 1, isBasic: false, section: T },
      { name: "兌換券", count: 1, isBasic: false, section: T },
      { name: "特殊紅牌", count: 1, isBasic: false, section: T },
      { name: "神聖之灰", count: 1, isBasic: false, section: T },
      { name: "活力之森", count: 4, isBasic: false, section: T },
      { name: "基本草能量", count: 5, isBasic: false, section: E },
    ],
  },
  {
    id: "t6",
    cards: [
      { name: "凱西", count: 4, isBasic: true, section: P },
      { name: "勇基拉", count: 4, isBasic: false, section: P },
      { name: "胡地", count: 3, isBasic: false, section: P },
      { name: "土龍弟弟", count: 3, isBasic: true, section: P },
      { name: "土龍節節", count: 3, isBasic: false, section: P },
      { name: "蓋諾賽克特", count: 1, isBasic: true, section: P },
      { name: "小灰怪", count: 1, isBasic: true, section: P },
      { name: "吉雉雞", count: 1, isBasic: true, section: P },
      { name: "皮皮", count: 1, isBasic: true, section: P },
      { name: "小霞的可達鴨", count: 1, isBasic: true, section: P },
      { name: "咚咚鼠", count: 1, isBasic: true, section: P },
      { name: "小光", count: 4, isBasic: false, section: T },
      { name: "白露", count: 3, isBasic: false, section: T },
      { name: "老大的指令（坂木）", count: 2, isBasic: false, section: T },
      { name: "水蓮的照顧", count: 1, isBasic: false, section: T },
      { name: "寶可夢平板", count: 4, isBasic: false, section: T },
      { name: "好友幫手百花露", count: 3, isBasic: false, section: T },
      { name: "神奇糖果", count: 3, isBasic: false, section: T },
      { name: "強化之鎚", count: 2, isBasic: false, section: T },
      { name: "夜間擔架", count: 1, isBasic: false, section: T },
      { name: "特殊紅牌", count: 1, isBasic: false, section: T },
      { name: "神聖之灰", count: 1, isBasic: false, section: T },
      { name: "手持團扇", count: 2, isBasic: false, section: T },
      { name: "幸運頭盔", count: 1, isBasic: false, section: T },
      { name: "夜間礦場", count: 3, isBasic: false, section: T },
      { name: "心靈感應超能量", count: 4, isBasic: false, section: E },
      { name: "滋養能量", count: 1, isBasic: false, section: E },
      { name: "基本超能量", count: 1, isBasic: false, section: E },
    ],
  },
];

export function templateTotal(tpl: DeckTemplate): number {
  return tpl.cards.reduce((s, c) => s + c.count, 0);
}

export function templateBasics(tpl: DeckTemplate): number {
  return tpl.cards.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
}
