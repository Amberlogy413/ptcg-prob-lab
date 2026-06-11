import { useT } from "../i18n/index.ts";
import { useUiStore, type AskTab } from "../state/uiStore.ts";
import { Q1Section } from "./Q1Section.tsx";
import { Q2Section } from "./Q2Section.tsx";
import { CurveSection } from "./CurveSection.tsx";
import { GradeSection } from "./GradeSection.tsx";
import { PresetStrip } from "../components/PresetStrip.tsx";

const TABS: Array<{ id: AskTab; labelKey: string }> = [
  { id: "q1", labelKey: "ask.tab.q1" },
  { id: "q2", labelKey: "ask.tab.q2" },
  { id: "curve", labelKey: "ask.tab.curve" },
  { id: "grade", labelKey: "ask.tab.grade" },
];

/** 提問 workspace: Q1 (Basics & mulligan) + Q2 (sentence combo query). */
export function AskView() {
  const t = useT();
  const tab = useUiStore((s) => s.askTab);
  const setTab = useUiStore((s) => s.setAskTab);
  const tabBtn = (active: boolean) =>
    "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  return (
    <div>
      <PresetStrip />
      <div role="tablist" aria-label={t("ask.tab.aria")} className="mb-4 flex flex-wrap gap-1">
        {TABS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={tabBtn(tab === id)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      {tab === "q1" && <Q1Section />}
      {tab === "q2" && <Q2Section />}
      {tab === "curve" && <CurveSection />}
      {tab === "grade" && <GradeSection />}
    </div>
  );
}
