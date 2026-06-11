import { useT } from "../i18n/index.ts";
import { PrecisionRuler } from "./PrecisionRuler.tsx";
import { MathReceipt, type ReceiptLine } from "./MathReceipt.tsx";
import { JointTable } from "./JointTable.tsx";
import type { ComboResultState } from "../state/useComboResult.ts";
import type { Q2Data } from "../state/selectors.ts";

/** Result card, three layers (docs/04 §5): headline / joint table / receipt. */
export function Q2ResultCard({ state }: { state: ComboResultState }) {
  const t = useT();

  if (state.status === "empty") {
    return <p className="mt-4 text-sm text-ink2">{t("q2.empty")}</p>;
  }
  if (state.status === "tooFewCards") {
    return <p className="mt-4 text-sm text-ink2">{t("summary.needCards")}</p>;
  }
  if (state.status === "noBasicsForAware") {
    return <p className="mt-4 text-sm text-warn">{t("error.basicUnknown")}</p>;
  }
  if (state.status === "computing") {
    return (
      <p className="mt-4 font-mono text-sm text-ink2" role="status">
        {t("q2.computing")}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="mt-4 text-sm text-bad" role="alert">
        {t("q2.error", { message: state.message })}
      </p>
    );
  }
  if (state.status === "ready") return <Q2Ready data={state.data} />;
  return null;
}

function Q2Ready({ data }: { data: Q2Data }) {
  const t = useT();

  const receiptLines: ReceiptLine[] = [
    { label: t("receipt.label.formula"), text: data.receipt.formula },
    { label: t("receipt.label.subst"), text: data.receipt.substitution },
    { label: t("receipt.label.total"), text: t("receipt.q2.total", data.receipt.total) },
    ...(data.receipt.cond
      ? [{ label: t("receipt.label.cond"), text: t("receipt.q2.cond", data.receipt.cond) }]
      : []),
    {
      label: t("receipt.label.check"),
      text:
        (data.receipt.identityOk ? t("receipt.check.identity") : "✗ Σ P ≠ 1") +
        (data.receipt.goldenId ? ";" + t("receipt.check.golden", { id: data.receipt.goldenId }) : ""),
    },
  ];

  return (
    <div className="mt-4 border-t hairline pt-4">
      {/* Layer 1 — headline */}
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
        {t("q2.headline.label")}
        <span className="ml-2 normal-case">
          {data.conditioned ? t("toggle.mulligan.on") : t("toggle.mulligan.off")}
        </span>
      </h3>
      <p className="font-mono text-headline leading-none">{data.headline.percent}</p>
      <p className="mt-1 font-mono text-sm text-ink2">
        {data.headline.fraction} · {data.headline.oneIn}
      </p>
      <PrecisionRuler
        value={data.headline.chart}
        labels
        ariaLabel={t("q2.ruler.aria", {
          percent: data.headline.percent,
          fraction: data.headline.fraction,
        })}
      />
      {data.headline.games && (
        <p className="mt-2 text-sm">
          {data.conditioned
            ? t("q2.headline.interpret", { games: data.headline.games })
            : t("q2.headline.interpretRaw", { games: data.headline.games })}
        </p>
      )}
      {data.naive && (
        <p className="mt-1 text-sm text-ink2">
          {t("hint.mulligan.naive", { value: data.naive.percent, delta: data.naive.deltaPp })}
        </p>
      )}
      {data.pValid && (
        <p className="mt-1 font-mono text-xs text-ink2">
          {t("q2.pValid", { fraction: data.pValid.fraction, percent: data.pValid.percent })}
        </p>
      )}

      {/* Layer 3 — receipt (signature element) */}
      <MathReceipt lines={receiptLines} />

      {/* Layer 2 — full joint table */}
      <JointTable
        legend={data.legend}
        comboHeader={data.comboHeader}
        rows={data.rows}
        csvName="q2_joint_distribution"
      />
    </div>
  );
}
