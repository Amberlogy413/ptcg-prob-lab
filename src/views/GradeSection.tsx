import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, type Deck } from "../state/deckStore.ts";
import {
  computeGrades,
  buildAttributionPlan,
  finishAttribution,
  type GradeDefs,
  type GradeCardDef,
  type AttributionRow,
} from "../state/q5.ts";
import { runComboBatch } from "../state/comboBatch.ts";
import { useGradeStore } from "../state/gradeStore.ts";
import { HAND_SIZE } from "../constants.ts";

/** 起手品質分級 (roadmap V1-12) + A1 死手歸因排行榜 — both mulligan-aware. */
export function GradeSection() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  // Definitions live in a shared store so the health report (P9.1) sees them.
  const ideal = useGradeStore((s) => s.ideal);
  const playable = useGradeStore((s) => s.playable);
  const setIdeal = useGradeStore((s) => s.setIdeal);
  const setPlayable = useGradeStore((s) => s.setPlayable);
  const [attribution, setAttribution] = useState<AttributionRow[] | null>(null);
  const [attributing, setAttributing] = useState(false);

  const defs: GradeDefs = useMemo(() => ({ ideal, playable }), [ideal, playable]);
  const grades = useMemo(() => (deck ? computeGrades(deck, defs) : null), [deck, defs]);

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("grade.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  async function runAttribution(d: Deck): Promise<void> {
    const plan = buildAttributionPlan(d, defs);
    if (!plan) return;
    setAttributing(true);
    try {
      const results = await runComboBatch([plan.base, ...plan.perturbations.map((p) => p.job)]);
      const base = results[0];
      if (!base) return;
      setAttribution(finishAttribution(plan, base.table, results.slice(1).map((r) => r?.table ?? null)));
    } finally {
      setAttributing(false);
    }
  }

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("grade.title")}</h2>
      <p className="mt-1 text-xs text-ink2">{t("grade.desc")}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <GradeDefEditor titleKey="grade.ideal" deck={deck} defs={ideal} onChange={setIdeal} accent="good" />
        <GradeDefEditor titleKey="grade.playable" deck={deck} defs={playable} onChange={setPlayable} accent="warn" />
      </div>

      {grades ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <GradeCard labelKey="grade.ideal" value={grades.ideal} color="text-good" />
          <GradeCard labelKey="grade.playableOnly" value={grades.playableOnly} color="text-warn" />
          <GradeCard labelKey="grade.dead" value={grades.dead} color="text-bad" />
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink2">{t("grade.needDefs")}</p>
      )}
      {grades && (
        <p className="mt-2 font-mono text-xs text-ink2">
          {grades.identityOk ? "✓ Σ = 1" : "✗ Σ ≠ 1"} ·{" "}
          {t("q2.pValid", { fraction: grades.pValid.fraction, percent: grades.pValid.percent })}
        </p>
      )}

      {grades && (
        <div className="mt-5 border-t hairline pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-medium">{t("grade.attribution.title")}</h3>
            <button
              type="button"
              disabled={attributing}
              onClick={() => void runAttribution(deck)}
              className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {attributing ? t("q2.computing") : t("grade.attribution.run")}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink2">{t("grade.attribution.assumption")}</p>
          {attribution && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("grade.attribution.title")}</caption>
                <thead>
                  <tr className="border-b hairline text-left text-xs text-ink2">
                    <th scope="col" className="py-1.5 pr-3 font-medium">{t("deck.card.name")}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("deck.card.count")}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("grade.attribution.minus")}</th>
                    <th scope="col" className="py-1.5 text-right font-medium">{t("grade.attribution.plus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.map((r) => (
                    <tr key={r.name} className="border-b hairline last:border-b-0">
                      <td className="py-1.5 pr-3">{r.name}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{r.count}</td>
                      <td className={"py-1.5 pr-3 text-right font-mono " + deltaColor(r.minusSign)}>
                        {r.minusPp ?? "—"}
                      </td>
                      <td className={"py-1.5 text-right font-mono " + deltaColor(r.plusSign)}>
                        {r.plusPp ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Dead-rate delta: negative (less dead) is favorable → good. */
function deltaColor(sign: -1 | 0 | 1 | undefined): string {
  if (sign === undefined || sign === 0) return "text-ink2";
  return sign < 0 ? "text-good" : "text-bad";
}

function GradeCard({ labelKey, value, color }: { labelKey: string; value: { percent: string; fraction: string }; color: string }) {
  const t = useT();
  return (
    <div className="rounded-card border hairline bg-surface p-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-ink2">{t(labelKey)}</h4>
      <p className={`mt-1 font-mono text-xl ${color}`}>{value.percent}</p>
      <p className="font-mono text-xs text-ink2">{value.fraction}</p>
    </div>
  );
}

function GradeDefEditor({
  titleKey,
  deck,
  defs,
  onChange,
  accent,
}: {
  titleKey: string;
  deck: Deck;
  defs: GradeCardDef[];
  onChange: (defs: GradeCardDef[]) => void;
  accent: "good" | "warn";
}) {
  const t = useT();
  const names = [...new Set(deck.cards.filter((c) => c.name.trim() !== "" && c.count > 0).map((c) => c.name))];
  const available = names.filter((n) => !defs.some((d) => d.name === n));

  return (
    <div className={`rounded-card border p-3 ${accent === "good" ? "border-good/40" : "border-warn/40"}`}>
      <h3 className="text-sm font-medium">{t(titleKey)}</h3>
      <ul className="mt-2 space-y-1.5">
        {defs.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <label className="flex items-center gap-1 text-xs text-ink2">
              ≥
              <input
                type="number"
                min={1}
                max={HAND_SIZE}
                value={d.min}
                aria-label={t("grade.min.aria", { name: d.name })}
                onChange={(e) =>
                  onChange(
                    defs.map((x) =>
                      x.name === d.name
                        ? { ...x, min: Math.max(1, Math.min(HAND_SIZE, Math.trunc(Number(e.target.value) || 1))) }
                        : x,
                    ),
                  )
                }
                className="h-7 w-12 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
              />
            </label>
            <button
              type="button"
              aria-label={t("q2.removeCard.aria", { name: d.name })}
              onClick={() => onChange(defs.filter((x) => x.name !== d.name))}
              className="h-7 w-7 rounded-ctl border hairline text-ink2 hover:text-bad"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <select
          value=""
          aria-label={t("grade.add.aria")}
          onChange={(e) => {
            if (e.target.value) onChange([...defs, { name: e.target.value, min: 1 }]);
          }}
          className="mt-2 h-8 w-full rounded-ctl border border-dashed hairline bg-surface px-1 text-sm text-ink2"
        >
          <option value="">{t("grade.add")}</option>
          {available.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
