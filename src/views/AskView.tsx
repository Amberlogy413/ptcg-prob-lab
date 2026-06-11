import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { Q1Section } from "./Q1Section.tsx";
import { Q2Section } from "./Q2Section.tsx";

/** 提問 workspace: Q1 (Basics & mulligan) + Q2 (sentence combo query). */
export function AskView() {
  const t = useT();
  const [tab, setTab] = useState<"q1" | "q2">("q1");
  const tabBtn = (active: boolean) =>
    "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  return (
    <div>
      <div role="tablist" aria-label={t("ask.tab.aria")} className="mb-4 flex gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "q1"}
          onClick={() => setTab("q1")}
          className={tabBtn(tab === "q1")}
        >
          {t("ask.tab.q1")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "q2"}
          onClick={() => setTab("q2")}
          className={tabBtn(tab === "q2")}
        >
          {t("ask.tab.q2")}
        </button>
      </div>
      {tab === "q1" ? <Q1Section /> : <Q2Section />}
    </div>
  );
}
