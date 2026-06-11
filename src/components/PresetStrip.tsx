import { useT } from "../i18n/index.ts";
import { PRESET_TEN } from "../state/presets.ts";
import { useQ3Store } from "../state/q3Store.ts";
import { useUiStore } from "../state/uiStore.ts";

/** 預設十問 quick-question chips above the builders (docs/04 §4, PRD §4-14). */
export function PresetStrip() {
  const t = useT();
  const applySinglePreset = useQ3Store((s) => s.applySinglePreset);
  const applyJointPreset = useQ3Store((s) => s.applyJointPreset);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setAskTab = useUiStore((s) => s.setAskTab);

  function run(presetId: string): void {
    const p = PRESET_TEN.find((d) => d.id === presetId);
    if (!p) return;
    if (p.kind === "q3single") {
      applySinglePreset(p.mode, p.single);
      setActiveView("prizes");
    } else if (p.kind === "q3joint") {
      applyJointPreset(p.rows);
      setActiveView("prizes");
    } else {
      setAskTab("q1");
      setActiveView("ask");
    }
  }

  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink2">
        {t("preset.title")}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("preset.title")}>
        {PRESET_TEN.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => run(p.id)}
            className="rounded-ctl border hairline bg-surface px-2.5 py-1 text-xs text-ink2 transition-colors duration-fast hover:border-blue hover:text-blue"
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
