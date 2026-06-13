/**
 * Resolve the active card-name language. Card names are bound to the single UI
 * `language` choice (owner request 2026-06-14 — one control, no per-screen
 * language clutter): zh-Hant/tri → zh, en → en; `tri` also turns on the small
 * secondary names. Kept tiny so any surface localizes a catalog card the same.
 */

import { useSettingsStore } from "./settingsStore.ts";
import { cardName, otherNames, type CatalogCard, type NameLang } from "../data/catalog.ts";

export function useCardLang(): { lang: NameLang; tri: boolean } {
  const language = useSettingsStore((s) => s.language);
  // Card names are bound to the UI language; 三語對照 keeps the owner's primary
  // (zh) large and lists the other two small.
  const lang: NameLang = language === "en" ? "en" : "zh";
  return { lang, tri: language === "tri" };
}

/** Primary name (always) + secondary names (only when tri-lingual is on). */
export function useCardName(card: CatalogCard): { primary: string; others: string[] } {
  const { lang, tri } = useCardLang();
  return { primary: cardName(card, lang), others: tri ? otherNames(card, lang) : [] };
}
