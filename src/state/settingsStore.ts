import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STORAGE_KEYS } from "../utils/storage.ts";

export type Locale = "zh-Hant" | "en";
/** Card-name language: auto follows the UI locale; or force zh/en/ja. */
export type CardLang = "auto" | "zh" | "en" | "ja";

interface SettingsState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Preferred language for CARD NAMES (catalog), independent of UI strings. */
  cardLang: CardLang;
  setCardLang: (lang: CardLang) => void;
  /** Show all three card names (primary large, others small). */
  triLingual: boolean;
  setTriLingual: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: "zh-Hant",
      setLocale: (locale) => set({ locale }),
      cardLang: "auto",
      setCardLang: (cardLang) => set({ cardLang }),
      triLingual: false,
      setTriLingual: (triLingual) => set({ triLingual }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (s) => ({ locale: s.locale, cardLang: s.cardLang, triLingual: s.triLingual }),
    },
  ),
);
