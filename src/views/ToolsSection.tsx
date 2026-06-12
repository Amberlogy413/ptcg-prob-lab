import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, deckBasics, deckTotal, type Deck } from "../state/deckStore.ts";
import { computeSearchFold, formatOptimizerResult, type OptimizerRowData } from "../state/q7.ts";
import { runOptimizer } from "../state/comboBatch.ts";
import type { OptimizerCandidate } from "../lib/probx/optimizer.ts";
import { HAND_SIZE } from "../constants.ts";

/** 構築工具 sub-tab: A4 search-chain fold + A2 local optimizer (Phase 7). */
export function ToolsSection() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("tools.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }
  return (
    <div>
      <FoldBlock deck={deck} />
      <OptimizerBlock deck={deck} />
    </div>
  );
}

function numField(
  value: number,
  aria: string,
  max: number,
  onChange: (v: number) => void,
  min = 0,
) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      aria-label={aria}
      onChange={(e) =>
        onChange(Math.max(min, Math.min(max, Math.trunc(Number(e.target.value) || 0))))
      }
      className="h-8 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
    />
  );
}

/** A4 — search-chain fold (docs/02 §4.3): optimistic vs conservative, with
 *  the model assumptions spelled out line by line. */
function FoldBlock({ deck }: { deck: Deck }) {
  const t = useT();
  const named = deck.cards.filter((c) => c.name.trim() !== "" && c.count > 0);
  const [targetName, setTargetName] = useState("");
  const [searchers, setSearchers] = useState(4);
  const [want, setWant] = useState(1);

  const data = useMemo(
    () => (targetName === "" ? null : computeSearchFold(deck, targetName, searchers, want)),
    [deck, targetName, searchers, want],
  );

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-medium">{t("fold.title")}</h2>
      <p className="mt-1 text-xs text-ink2">{t("fold.desc")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <select
          value={targetName}
          aria-label={t("fold.target.aria")}
          onChange={(e) => setTargetName(e.target.value)}
          className="h-8 rounded-ctl border hairline bg-surface px-1 text-sm"
        >
          <option value="">{t("compare.pickCard")}</option>
          {[...new Set(named.map((c) => c.name))].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-ink2">
          {t("fold.searchers")}
          {numField(searchers, t("fold.searchers"), 20, setSearchers)}
        </label>
        <label className="flex items-center gap-1 text-xs text-ink2">
          ≥{numField(want, t("curve.want"), HAND_SIZE, setWant, 1)}
        </label>
      </div>

      {data ? (
        <div className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border hairline p-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
                {t("fold.optimistic")}
              </h3>
              <p className="mt-1 font-mono text-xl">{data.optimistic.percent}</p>
              <p className="font-mono text-xs text-ink2">
                {data.optimistic.fraction} · {data.optimistic.oneIn}
              </p>
            </div>
            <div className="rounded-card border hairline p-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
                {t("fold.conservative")}
              </h3>
              <p className="mt-1 font-mono text-xl">{data.conservative.percent}</p>
              <p className="font-mono text-xs text-ink2">
                {data.conservative.fraction} · {data.conservative.oneIn}
              </p>
            </div>
          </div>
          <p className="mt-2 font-mono text-sm">{t("fold.gap", { gap: data.gapPp })}</p>
          <p className="mt-1 font-mono text-xs text-ink2">
            {t("q2.pValid", { fraction: data.pValid.fraction, percent: data.pValid.percent })}
          </p>
          {/* Model assumptions, line by line (docs/02 §4.3 — mandatory). */}
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-ink2">
            <li>{t("fold.assume.1")}</li>
            <li>{t("fold.assume.2")}</li>
            <li>{t("fold.assume.3")}</li>
            <li>{t("fold.assume.4")}</li>
          </ul>
        </div>
      ) : (
        targetName !== "" && (
          <p className="mt-3 text-sm text-warn" role="status">
            {t("fold.guard")}
          </p>
        )
      )}
    </section>
  );
}

/** A2 — local optimizer (docs/02 §11): F free slots over candidates, Pareto
 *  ranking via Worker enumeration. */
function OptimizerBlock({ deck }: { deck: Deck }) {
  const t = useT();
  const named = [...new Set(deck.cards.filter((c) => c.name.trim() !== "" && c.count > 0).map((c) => c.name))];
  const [cands, setCands] = useState<Array<{ name: string; want: number }>>([]);
  const [free, setFree] = useState(5);
  const [rows, setRows] = useState<OptimizerRowData[] | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const available = named.filter((n) => !cands.some((c) => c.name === n));
  const basics = deckBasics(deck);

  async function run(): Promise<void> {
    const resolved: OptimizerCandidate[] = [];
    for (const c of cands) {
      const cards = deck.cards.filter((d) => d.name === c.name);
      const base = cards.reduce((s, d) => s + d.count, 0);
      resolved.push({ base, isBasic: cards[0]?.isBasic ?? false, want: c.want, label: c.name });
    }
    const trackedBasics = resolved.reduce((s, c) => s + (c.isBasic ? c.base : 0), 0);
    const ob = basics - trackedBasics;
    if (resolved.length === 0 || ob < 0) return;
    setRunning(true);
    setRows(null);
    const t0 = performance.now();
    try {
      const result = await runOptimizer(resolved, free, Math.max(ob, 0), deckTotal(deck), HAND_SIZE);
      setElapsed(Math.round(performance.now() - t0));
      setRows(formatOptimizerResult(result));
    } catch (err) {
      console.warn("[optimizer] failed:", err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-4 rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-medium">{t("opt.title")}</h2>
      <p className="mt-1 text-xs text-ink2">{t("opt.desc")}</p>

      <ul className="mt-3 space-y-1.5">
        {cands.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <label className="flex items-center gap-1 text-xs text-ink2">
              ≥
              {numField(c.want, t("grade.min.aria", { name: c.name }), HAND_SIZE, (want) =>
                setCands(cands.map((x) => (x.name === c.name ? { ...x, want } : x))),
                0,
              )}
            </label>
            <button
              type="button"
              aria-label={t("q2.removeCard.aria", { name: c.name })}
              onClick={() => setCands(cands.filter((x) => x.name !== c.name))}
              className="h-7 w-7 rounded-ctl border hairline text-ink2 hover:text-bad"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {cands.length < 3 && available.length > 0 && (
        <select
          value=""
          aria-label={t("opt.add.aria")}
          onChange={(e) => {
            if (e.target.value) setCands([...cands, { name: e.target.value, want: 1 }]);
          }}
          className="mt-2 h-8 rounded-ctl border border-dashed hairline bg-surface px-1 text-sm text-ink2"
        >
          <option value="">{t("opt.add")}</option>
          {available.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-ink2">
          {t("opt.free")}
          {numField(free, t("opt.free"), 8, setFree, 1)}
        </label>
        <button
          type="button"
          disabled={running || cands.length === 0}
          onClick={() => void run()}
          className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {running ? t("q2.computing") : t("opt.run")}
        </button>
        {elapsed !== null && (
          <span className="font-mono text-xs text-ink2">{t("opt.elapsed", { ms: elapsed })}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink2">{t("opt.assumption")}</p>

      {rows && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("opt.title")}</caption>
            <thead>
              <tr className="border-b hairline text-left text-xs text-ink2">
                <th scope="col" className="py-1.5 pl-2 pr-3 font-medium">
                  {t("opt.alloc", { names: cands.map((c) => c.name).join(" / ") })}
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("table.probability")}</th>
                <th scope="col" className="py-1.5 text-right font-medium">{t("table.fraction")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b hairline last:border-b-0">
                  <td
                    className={
                      "py-1.5 pl-2 pr-3 font-mono " +
                      (r.best ? "border-l-[3px] border-l-blue font-medium" : "border-l-[3px] border-l-transparent")
                    }
                  >
                    {r.label}
                    {r.best && <span className="ml-2 text-xs text-blue">{t("opt.best")}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">{r.percent}</td>
                  <td className="py-1.5 text-right font-mono">{r.fraction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
