import { useMemo } from "react";
import { useT } from "../i18n/index.ts";
import { computeDeckDoctor, type AdviceSeverity } from "../state/deckDoctor.ts";
import type { Deck } from "../state/deckStore.ts";
import { IconLegal, IconWarn, IconIllegal, IconProof } from "./icons.tsx";

/**
 * 牌組診斷 (deck doctor, #29): a compact, prioritized advice list for the loaded
 * deck — real-rule legality + the exact mulligan reading + the actionable
 * "+1 Basic" lever. Every line is a fact (rule or exact number), never a guess.
 */
const TONE: Record<AdviceSeverity, string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-ink2",
};

function SeverityIcon({ severity }: { severity: AdviceSeverity }) {
  if (severity === "good") return <IconLegal size="sm" className="text-good" />;
  if (severity === "bad") return <IconIllegal size="sm" className="text-bad" />;
  if (severity === "warn") return <IconWarn size="sm" className="text-warn" />;
  return <IconProof size="sm" className="text-ink2" />;
}

export function DeckDoctor({ deck }: { deck: Deck }) {
  const t = useT();
  const data = useMemo(() => computeDeckDoctor(deck), [deck]);
  if (data.advice.length === 0) return null;

  return (
    <ul className="space-y-1.5 text-sm">
      {data.advice.map((a, i) => (
        <li key={`${a.key}-${i}`} className={`flex items-start gap-2 ${TONE[a.severity]}`}>
          <span className="mt-0.5 shrink-0">
            <SeverityIcon severity={a.severity} />
          </span>
          <span className="min-w-0">{t(a.key, a.params)}</span>
        </li>
      ))}
    </ul>
  );
}
