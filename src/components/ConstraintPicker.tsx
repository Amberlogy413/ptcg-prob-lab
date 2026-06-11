import { useT } from "../i18n/index.ts";
import type { DeckCard } from "../state/deckStore.ts";
import type { TrackedQueryCard, ConstraintKind } from "../state/queryStore.ts";
import { HAND_SIZE } from "../constants.ts";

const KINDS: ConstraintKind[] = ["atLeast", "exactly", "atMost", "between", "avoid"];
const KIND_KEY: Record<ConstraintKind, string> = {
  atLeast: "q2.kind.atLeast",
  exactly: "q2.kind.exactly",
  atMost: "q2.kind.atMost",
  between: "q2.kind.between",
  avoid: "q2.kind.avoid",
};

interface ConstraintPickerProps {
  card: DeckCard;
  q: TrackedQueryCard;
  onChange: (patch: Partial<Omit<TrackedQueryCard, "cardId">>) => void;
}

/** 至少 n / 恰好 n / 至多 n / 介於 a–b / 避開 — steppers clamped to
 *  [0, min(count, 7)] (docs/04 §4). */
export function ConstraintPicker({ card, q, onChange }: ConstraintPickerProps) {
  const t = useT();
  const cap = Math.min(card.count, HAND_SIZE);
  const clamp = (v: number) => Math.max(0, Math.min(cap, Math.trunc(Number.isFinite(v) ? v : 0)));

  const numInput = (value: number, aria: string, set: (v: number) => void) => (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={cap}
      value={value}
      aria-label={aria}
      onChange={(e) => set(clamp(Number(e.target.value)))}
      className="h-8 w-12 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
    />
  );

  return (
    <span
      className="inline-flex items-center gap-1 rounded-ctl border hairline bg-surface px-1.5 py-1"
      role="group"
      aria-label={t("q2.constraint.aria", { name: card.name })}
    >
      <select
        value={q.kind}
        aria-label={t("q2.constraint.kind.aria")}
        onChange={(e) => onChange({ kind: e.target.value as ConstraintKind })}
        className="h-8 rounded-ctl border hairline bg-surface px-1 text-sm"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {t(KIND_KEY[k])}
          </option>
        ))}
      </select>
      {(q.kind === "atLeast" || q.kind === "exactly" || q.kind === "atMost") &&
        numInput(clamp(q.n), t("q2.constraint.n.aria"), (n) => onChange({ n }))}
      {q.kind === "between" && (
        <>
          {numInput(clamp(q.a), t("q2.constraint.a.aria"), (a) => onChange({ a }))}
          <span className="text-sm text-ink2">–</span>
          {numInput(clamp(q.b), t("q2.constraint.b.aria"), (b) => onChange({ b }))}
        </>
      )}
    </span>
  );
}
