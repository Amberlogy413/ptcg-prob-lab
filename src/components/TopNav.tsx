import type { ReactNode } from "react";
import { useT } from "../i18n/index.ts";
import { useUiStore, type WorkspaceView } from "../state/uiStore.ts";
import { useSettingsStore, type Locale, type CardLang } from "../state/settingsStore.ts";
import {
  IconDeck,
  IconDecks,
  IconReport,
  IconTrial,
  IconMidgame,
  IconAsk,
  IconPrizes,
  IconCompare,
  IconTrainer,
  IconTracker,
} from "./icons.tsx";

const WORKSPACES: Array<{ id: WorkspaceView; labelKey: string; icon: ReactNode }> = [
  { id: "deck", labelKey: "nav.deck", icon: <IconDeck /> },
  { id: "decks", labelKey: "nav.decks", icon: <IconDecks /> },
  { id: "report", labelKey: "nav.report", icon: <IconReport /> },
  { id: "trial", labelKey: "nav.trial", icon: <IconTrial /> },
  { id: "midgame", labelKey: "nav.midgame", icon: <IconMidgame /> },
  { id: "ask", labelKey: "nav.ask", icon: <IconAsk /> },
  { id: "prizes", labelKey: "nav.prizes", icon: <IconPrizes /> },
  { id: "compare", labelKey: "nav.compare", icon: <IconCompare /> },
  { id: "trainer", labelKey: "nav.trainer", icon: <IconTrainer /> },
  { id: "tracker", labelKey: "nav.tracker", icon: <IconTracker /> },
];

export function TopNav() {
  const t = useT();
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const cardLang = useSettingsStore((s) => s.cardLang);
  const setCardLang = useSettingsStore((s) => s.setCardLang);
  const triLingual = useSettingsStore((s) => s.triLingual);
  const setTriLingual = useSettingsStore((s) => s.setTriLingual);

  return (
    <header className="border-b hairline bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="mr-2">
          <h1 className="text-lg font-medium leading-tight">{t("app.title")}</h1>
          <p className="text-xs text-ink2">{t("app.tagline")}</p>
        </div>
        <nav aria-label={t("nav.aria")} className="flex flex-wrap items-end gap-1">
          {WORKSPACES.map(({ id, labelKey, icon }) => {
            const active = id === activeView;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id)}
                aria-current={active ? "page" : undefined}
                className={
                  "inline-flex items-center gap-1.5 rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
                  (active
                    ? "bg-blue font-medium text-white"
                    : "text-ink2 hover:bg-surface hover:text-ink")
                }
              >
                {icon}
                {t(labelKey)}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink2">
            <span>{t("locale.label")}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="rounded-ctl border hairline bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="zh-Hant">{t("locale.zhHant")}</option>
              <option value="en">{t("locale.en")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink2">
            <span>{t("cardlang.label")}</span>
            <select
              value={cardLang}
              onChange={(e) => setCardLang(e.target.value as CardLang)}
              className="rounded-ctl border hairline bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="auto">{t("cardlang.auto")}</option>
              <option value="zh">{t("cardlang.zh")}</option>
              <option value="en">{t("cardlang.en")}</option>
              <option value="ja">{t("cardlang.ja")}</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink2">
            <input
              type="checkbox"
              checked={triLingual}
              onChange={(e) => setTriLingual(e.target.checked)}
              className="h-4 w-4 accent-blue"
            />
            {t("cardlang.tri")}
          </label>
        </div>
      </div>
    </header>
  );
}
