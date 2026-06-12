import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { PRESET_TEN, GENERATED_BANK, type PresetDef } from "../state/presets.ts";
import { useQ3Store } from "../state/q3Store.ts";
import { useUiStore } from "../state/uiStore.ts";

/** 預設十問 + D3 question bank + user-saved chips (PRD §4-14, 07 §D3). */
export function PresetStrip() {
  const t = useT();
  const applySinglePreset = useQ3Store((s) => s.applySinglePreset);
  const applyJointPreset = useQ3Store((s) => s.applyJointPreset);
  const custom = useQ3Store((s) => s.custom);
  const removeCustomPreset = useQ3Store((s) => s.removeCustomPreset);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setAskTab = useUiStore((s) => s.setAskTab);
  const [bankOpen, setBankOpen] = useState(false);

  function run(p: PresetDef): void {
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

  const chipClass =
    "rounded-ctl border hairline bg-surface px-2.5 py-1 text-xs text-ink2 transition-colors duration-fast hover:border-blue hover:text-blue";

  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink2">
        {t("preset.title")}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("preset.title")}>
        {PRESET_TEN.map((p) => (
          <button key={p.id} type="button" onClick={() => run(p)} className={chipClass}>
            {t(p.labelKey, "labelParams" in p ? p.labelParams : undefined)}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={bankOpen}
          onClick={() => setBankOpen((v) => !v)}
          className={chipClass}
        >
          {bankOpen ? t("bank.collapse") : t("bank.expand")}
        </button>
      </div>

      {bankOpen && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t("bank.aria")}>
          {GENERATED_BANK.map((p) => (
            <button key={p.id} type="button" onClick={() => run(p)} className={chipClass}>
              {t(p.labelKey, "labelParams" in p ? p.labelParams : undefined)}
            </button>
          ))}
        </div>
      )}

      {custom.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t("bank.custom.aria")}>
          {custom.map((c) => (
            <span key={c.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => {
                  useQ3Store.getState().applySinglePreset(c.mode, c.single);
                  setActiveView("prizes");
                }}
                className={chipClass + " rounded-r-none border-r-0"}
              >
                {c.label}
              </button>
              <button
                type="button"
                aria-label={t("bank.custom.remove", { name: c.label })}
                onClick={() => removeCustomPreset(c.id)}
                className="rounded-ctl rounded-l-none border hairline bg-surface px-1.5 py-1 text-xs text-ink2 hover:text-bad"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
