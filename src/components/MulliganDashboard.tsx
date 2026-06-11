import { useT } from "../i18n/index.ts";
import type { Q1Data } from "../state/selectors.ts";

/**
 * The mulligan dashboard 三聯卡 (docs/04 §6): mulligan rate / expected
 * mulligans / "exactly m" mini geometric distribution.
 */
export function MulliganDashboard({ data }: { data: Q1Data }) {
  const t = useT();
  const maxM = Math.max(...data.exactM.map((e) => e.chart), 1e-9);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-card border hairline bg-surface p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
          {t("q1.headline.label")}
        </h3>
        <p className="mt-1 font-mono text-lg">{data.headline.percent}</p>
        <p className="font-mono text-xs text-ink2">{data.headline.fraction}</p>
      </div>
      <div className="rounded-card border hairline bg-surface p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
          {t("summary.expectedMulligans")}
        </h3>
        <p className="mt-1 font-mono text-lg">{data.expectedMulligans}</p>
        <p className="font-mono text-xs text-ink2">
          {t("q1.dashboard.validHand", { percent: data.validPercent })}
        </p>
      </div>
      <div className="rounded-card border hairline bg-surface p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
          {t("q1.dashboard.exactM")}
        </h3>
        <ul className="mt-1 space-y-0.5">
          {data.exactM.map((e) => (
            <li key={e.m} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-mono text-xs text-ink2">m={e.m}</span>
              <span className="h-1.5 rounded-full bg-blue" style={{ width: `${(e.chart / maxM) * 56}%` }} />
              <span className="ml-auto font-mono text-xs">{e.percent}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
