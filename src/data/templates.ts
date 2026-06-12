/**
 * Template deck bank (P8.2, docs/08 §5A): text-only archetype skeletons.
 * Row names are role placeholders, not real card names — the math only sees
 * counts + Basic flags, and users rename rows freely after loading
 * (docs/DECISIONS.md 2026-06-12). Every template sums to exactly 60 and has
 * at least one Basic; tests/templates.spec.tsx pins both invariants.
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
    // 14 Basics — aggro shell, low mulligan.
    id: "t1",
    cards: [
      { name: "主攻手(基礎)", count: 4, isBasic: true, section: P },
      { name: "副攻手(基礎)", count: 4, isBasic: true, section: P },
      { name: "開局輔助(基礎)", count: 4, isBasic: true, section: P },
      { name: "工具寵(基礎)", count: 2, isBasic: true, section: P },
      { name: "檢索球", count: 4, isBasic: false, section: T },
      { name: "抽牌支援者", count: 8, isBasic: false, section: T },
      { name: "干擾支援者", count: 4, isBasic: false, section: T },
      { name: "拉手物品", count: 4, isBasic: false, section: T },
      { name: "加速物品", count: 4, isBasic: false, section: T },
      { name: "競技場", count: 3, isBasic: false, section: T },
      { name: "回收物品", count: 3, isBasic: false, section: T },
      { name: "卡獎對策", count: 2, isBasic: false, section: T },
      { name: "基本能量", count: 10, isBasic: false, section: E },
      { name: "特殊能量", count: 4, isBasic: false, section: E },
    ],
  },
  {
    // 8 Basics — two-stage evolution shell, the high-mulligan classic.
    id: "t2",
    cards: [
      { name: "進化線基礎", count: 4, isBasic: true, section: P },
      { name: "一階中繼", count: 2, isBasic: false, section: P },
      { name: "二階主攻", count: 3, isBasic: false, section: P },
      { name: "工具寵(基礎)", count: 4, isBasic: true, section: P },
      { name: "系統寵(一階)", count: 2, isBasic: false, section: P },
      { name: "神奇糖果", count: 4, isBasic: false, section: T },
      { name: "檢索球", count: 4, isBasic: false, section: T },
      { name: "抽牌支援者", count: 8, isBasic: false, section: T },
      { name: "干擾支援者", count: 4, isBasic: false, section: T },
      { name: "拉手物品", count: 4, isBasic: false, section: T },
      { name: "競技場", count: 2, isBasic: false, section: T },
      { name: "回收物品", count: 3, isBasic: false, section: T },
      { name: "能量供給物品", count: 2, isBasic: false, section: T },
      { name: "卡獎對策", count: 2, isBasic: false, section: T },
      { name: "基本能量", count: 12, isBasic: false, section: E },
    ],
  },
  {
    // 10 Basics — the docs/02 teaching anchor: mulligan 25.862923%.
    id: "t3",
    cards: [
      { name: "主攻手A(基礎)", count: 4, isBasic: true, section: P },
      { name: "系統夥伴(基礎)", count: 6, isBasic: true, section: P },
      { name: "進化夥伴(非基礎)", count: 3, isBasic: false, section: P },
      { name: "檢索球", count: 4, isBasic: false, section: T },
      { name: "抽牌支援者", count: 8, isBasic: false, section: T },
      { name: "干擾支援者", count: 4, isBasic: false, section: T },
      { name: "拉手物品", count: 4, isBasic: false, section: T },
      { name: "競技場", count: 3, isBasic: false, section: T },
      { name: "回收物品", count: 3, isBasic: false, section: T },
      { name: "加速物品", count: 4, isBasic: false, section: T },
      { name: "卡獎對策", count: 3, isBasic: false, section: T },
      { name: "能量供給物品", count: 2, isBasic: false, section: T },
      { name: "基本能量", count: 12, isBasic: false, section: E },
    ],
  },
  {
    // 7 Basics — control/mill, the mulligan-risk cautionary tale.
    id: "t4",
    cards: [
      { name: "防禦核心(基礎)", count: 3, isBasic: true, section: P },
      { name: "干擾核心(基礎)", count: 4, isBasic: true, section: P },
      { name: "輔助進化(一階)", count: 2, isBasic: false, section: P },
      { name: "抽牌支援者", count: 8, isBasic: false, section: T },
      { name: "干擾支援者", count: 8, isBasic: false, section: T },
      { name: "回收循環物品", count: 6, isBasic: false, section: T },
      { name: "檢索球", count: 3, isBasic: false, section: T },
      { name: "拉手物品", count: 4, isBasic: false, section: T },
      { name: "競技場", count: 4, isBasic: false, section: T },
      { name: "特殊對策物品", count: 6, isBasic: false, section: T },
      { name: "基本能量", count: 12, isBasic: false, section: E },
    ],
  },
  {
    // 11 Basics, 16 energy — ramp shell for the energy-curve tool.
    id: "t5",
    cards: [
      { name: "重砲主攻(基礎)", count: 4, isBasic: true, section: P },
      { name: "能量加速手(基礎)", count: 4, isBasic: true, section: P },
      { name: "開局輔助(基礎)", count: 3, isBasic: true, section: P },
      { name: "一階支援", count: 2, isBasic: false, section: P },
      { name: "檢索球", count: 4, isBasic: false, section: T },
      { name: "抽牌支援者", count: 8, isBasic: false, section: T },
      { name: "干擾支援者", count: 3, isBasic: false, section: T },
      { name: "拉手物品", count: 4, isBasic: false, section: T },
      { name: "能量回收物品", count: 4, isBasic: false, section: T },
      { name: "競技場", count: 2, isBasic: false, section: T },
      { name: "能量供給物品", count: 4, isBasic: false, section: T },
      { name: "加速物品", count: 2, isBasic: false, section: T },
      { name: "基本能量", count: 16, isBasic: false, section: E },
    ],
  },
  {
    // 16 Basics — toolbox multi-attacker, near-minimal mulligan.
    id: "t6",
    cards: [
      { name: "攻擊手A(基礎)", count: 3, isBasic: true, section: P },
      { name: "攻擊手B(基礎)", count: 3, isBasic: true, section: P },
      { name: "攻擊手C(基礎)", count: 2, isBasic: true, section: P },
      { name: "系統寵(基礎)", count: 4, isBasic: true, section: P },
      { name: "工具寵(基礎)", count: 4, isBasic: true, section: P },
      { name: "檢索球", count: 4, isBasic: false, section: T },
      { name: "抽牌支援者", count: 8, isBasic: false, section: T },
      { name: "干擾支援者", count: 4, isBasic: false, section: T },
      { name: "拉手物品", count: 4, isBasic: false, section: T },
      { name: "競技場", count: 2, isBasic: false, section: T },
      { name: "回收物品", count: 3, isBasic: false, section: T },
      { name: "加速物品", count: 3, isBasic: false, section: T },
      { name: "卡獎對策", count: 2, isBasic: false, section: T },
      { name: "基本能量", count: 14, isBasic: false, section: E },
    ],
  },
];

export function templateTotal(tpl: DeckTemplate): number {
  return tpl.cards.reduce((s, c) => s + c.count, 0);
}

export function templateBasics(tpl: DeckTemplate): number {
  return tpl.cards.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
}
