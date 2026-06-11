import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STORAGE_KEYS } from "../utils/storage.ts";

export type Locale = "zh-Hant" | "en";

interface SettingsState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: "zh-Hant",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ locale: s.locale }),
    },
  ),
);
