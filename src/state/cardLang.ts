/**
 * Resolve the active card-name language (owner request 2026-06-13): the
 * preference is `cardLang` (auto follows the UI locale), and `triLingual`
 * toggles the secondary names. Kept tiny and framework-light so any display
 * surface can localize a catalog card the same way.
 */

import { useSettingsStore } from "./settingsStore.ts";
import { cardName, otherNames, type CatalogCard, type NameLang } from "../data/catalog.ts";

export function useCardLang(): { lang: NameLang; tri: boolean } {
  const locale = useSettingsStore((s) => s.locale);
  const pref = useSettingsStore((s) => s.cardLang);
  const tri = useSettingsStore((s) => s.triLingual);
  const lang: NameLang = pref === "auto" ? (locale === "en" ? "en" : "zh") : pref;
  return { lang, tri };
}

/** Primary name (always) + secondary names (only when tri-lingual is on). */
export function useCardName(card: CatalogCard): { primary: string; others: string[] } {
  const { lang, tri } = useCardLang();
  return { primary: cardName(card, lang), others: tri ? otherNames(card, lang) : [] };
}
