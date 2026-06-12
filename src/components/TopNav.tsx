import { useT } from "../i18n/index.ts";
import { useUiStore, type WorkspaceView } from "../state/uiStore.ts";
import { useSettingsStore, type Locale } from "../state/settingsStore.ts";

const WORKSPACES: Array<{ id: WorkspaceView; labelKey: string }> = [
  { id: "deck", labelKey: "nav.deck" },
  { id: "trial", labelKey: "nav.trial" },
  { id: "ask", labelKey: "nav.ask" },
  { id: "prizes", labelKey: "nav.prizes" },
  { id: "compare", labelKey: "nav.compare" },
  { id: "trainer", labelKey: "nav.trainer" },
  { id: "tracker", labelKey: "nav.tracker" },
];

export function TopNav() {
  const t = useT();
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  return (
    <header className="border-b hairline bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="mr-2">
          <h1 className="text-lg font-medium leading-tight">{t("app.title")}</h1>
          <p className="text-xs text-ink2">{t("app.tagline")}</p>
        </div>
        <nav aria-label={t("nav.aria")} className="flex items-end gap-1">
          {WORKSPACES.map(({ id, labelKey }) => {
            const active = id === activeView;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id)}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
                  (active
                    ? "bg-blue font-medium text-white"
                    : "text-ink2 hover:bg-surface hover:text-ink")
                }
              >
                {t(labelKey)}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto">
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
        </div>
      </div>
    </header>
  );
}
