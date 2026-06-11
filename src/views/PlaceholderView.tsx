import { useT } from "../i18n/index.ts";

export function PlaceholderView({ titleKey, descKey }: { titleKey: string; descKey: string }) {
  const t = useT();
  return (
    <section className="rounded-card border hairline bg-surface p-6">
      <h2 className="text-xl font-medium">{t(titleKey)}</h2>
      <p className="mt-2 text-sm text-ink2">{t(descKey)}</p>
      <p className="mt-4 inline-block rounded-ctl border hairline px-2 py-0.5 text-xs text-ink2">
        {t("view.comingSoon")}
      </p>
    </section>
  );
}
