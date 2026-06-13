import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STORAGE_KEYS } from "../utils/storage.ts";

/** UI dictionary locales — i18n ships zh-Hant + en. */
export type Locale = "zh-Hant" | "en";

/**
 * The single user-facing language choice (owner request 2026-06-14): the UI
 * language and the card-name language are BOUND together — no more separate
 * selectors cluttering one screen with several languages. 三語對照 (`tri`) is
 * one deliberate option that shows all three card names, primary large.
 */
export type AppLanguage = "zh-Hant" | "en" | "tri";

/**
 * The UI-string locale a language resolves to. Mono languages map straight
 * through; 三語對照 shows the zh-Hant UI (the owner's primary written
 * language) and only the CARD names go multilingual.
 */
export function uiLocaleOf(language: AppLanguage): Locale {
  return language === "en" ? "en" : "zh-Hant";
}

interface SettingsState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: "zh-Hant",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createJSONStorage(() => localStorage),
      version: 3,
      // v1/v2 stored {locale, cardLang, triLingual}; fold them into one choice.
      migrate: (persisted, fromVersion) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (fromVersion < 3) {
          if (s.triLingual === true) return { language: "tri" as AppLanguage };
          return { language: (s.locale === "en" ? "en" : "zh-Hant") as AppLanguage };
        }
        return s as unknown as { language: AppLanguage };
      },
      partialize: (s) => ({ language: s.language }),
    },
  ),
);
