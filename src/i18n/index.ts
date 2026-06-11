/**
 * Minimal homemade i18n (docs/03 §9): t(key) reads the current locale's flat
 * JSON dictionary; a missing key falls back to en with a console.warn.
 * zh-Hant is the primary locale. Every UI string must pass through here.
 */

import { useCallback } from "react";
import zhHantRaw from "./zh-Hant.json";
import enRaw from "./en.json";
import { useSettingsStore, type Locale } from "../state/settingsStore.ts";

const dictionaries: Record<Locale, Record<string, string>> = {
  "zh-Hant": zhHantRaw as Record<string, string>,
  en: enRaw as Record<string, string>,
};

export type TranslateParams = Record<string, string | number>;

export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  let text = dictionaries[locale][key];
  if (text === undefined) {
    const fallback = dictionaries.en[key];
    if (fallback !== undefined) {
      console.warn(`[i18n] missing ${locale} key "${key}" — falling back to en`);
      text = fallback;
    } else {
      console.warn(`[i18n] missing key "${key}"`);
      return key;
    }
  }
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Reactive translator for components — re-renders on locale change. */
export function useT(): (key: string, params?: TranslateParams) => string {
  const locale = useSettingsStore((s) => s.locale);
  return useCallback((key: string, params?: TranslateParams) => translate(locale, key, params), [locale]);
}

/** Non-reactive translator for code outside the React tree. */
export function t(key: string, params?: TranslateParams): string {
  return translate(useSettingsStore.getState().locale, key, params);
}

/** Exposed for the i18n parity test (zh-Hant and en key sets must match). */
export const i18nDictionaries = dictionaries;
