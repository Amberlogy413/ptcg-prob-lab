import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { computeTurnCurve, type TurnCurveRow } from "../state/q5.ts";
import { downloadCsv } from "../utils/csv.ts";
import { HAND_SIZE, DECK_SIZE } from "../constants.ts";

/** 回合曲線 (docs/02 §6): P(seen ≥ w copies by my turn T). UNCONDITIONED on
 *  mulligans — the honesty label is mandatory (§6.3). */
export function CurveSection() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const deckCards = (deck?.cards ?? []).filter((c) => c.name.trim() !== "" && c.count > 0);

  const [source, setSource] = useState("custom");
  const [customX, setCustomX] = useState(4);
  const [want, setWant] = useState(1);
  const [goingFirst, setGoingFirst] = useState(false);
  const [extraSeen, setExtraSeen] = useState(0);
  const [legacyRule, setLegacyRule] = useState(false);

  const card = source !== "custom" ? deckCards.find((c) => c.id === source) : undefined;
  const x = card ? card.count : customX;
  const cardLabel = card ? card.name : t("q3.custom");

  const rows: TurnCurveRow[] = useMemo(
    () =>
      computeTurnCurve({
        x,
        want: Math.max(1, Math.min(want, Math.min(x, HAND_SIZE) || 1)),
        goingFirst,
        extraSeen,
        firstPlayerSkipsFirstDraw: legacyRule,
        maxTurn: 12,
      }),
    [x, want, goingFirst, extraSeen, legacyRule],
  );

  const segBtn = (active: boolean) =>
    "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-medium">{t("curve.title")}</h2>
        <span className="rounded-ctl border hairline px-2 py-0.5 text-xs text-ink2">
          {t("toggle.mulligan.off")}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink2">{t("curve.honesty")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <select
          value={source}
          aria-label={t("q3.source.aria")}
          onChange={(e) => setSource(e.target.value)}
          className="h-8 rounded-ctl border hairline bg-surface px-1 text-sm"
        >
          <option value="custom">{t("q3.custom")}</option>
          {deckCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ×{c.count}
            </option>
          ))}
        </select>
        {!card && (
          <label className="flex items-center gap-1 text-xs text-ink2">
            ×
            <input
              type="number"
              min={0}
              max={DECK_SIZE}
              value={customX}
              aria-label={t("q3.x.aria")}
              onChange={(e) =>
                setCustomX(Math.max(0, Math.min(DECK_SIZE, Math.trunc(Number(e.target.value) || 0))))
              }
              className="h-8 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
            />
          </label>
        )}
        <label className="flex items-center gap-1 text-xs text-ink2">
          {t("curve.want")}
          <input
            type="number"
            min={1}
            max={HAND_SIZE}
            value={want}
            aria-label={t("curve.want")}
            onChange={(e) => setWant(Math.max(1, Math.min(HAND_SIZE, Math.trunc(Number(e.target.value) || 1))))}
            className="h-8 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
          />
        </label>
        <div role="group" aria-label={t("curve.turnOrder")} className="flex gap-1">
          <button type="button" aria-pressed={goingFirst} onClick={() => setGoingFirst(true)} className={segBtn(goingFirst)}>
            {t("curve.first")}
          </button>
          <button type="button" aria-pressed={!goingFirst} onClick={() => setGoingFirst(false)} className={segBtn(!goingFirst)}>
            {t("curve.second")}
          </button>
        </div>
        <label className="flex items-center gap-1 text-xs text-ink2">
          {t("curve.extraSeen")}
          <input
            type="number"
            min={0}
            max={40}
            value={extraSeen}
            aria-label={t("curve.extraSeen")}
            onChange={(e) => setExtraSeen(Math.max(0, Math.min(40, Math.trunc(Number(e.target.value) || 0))))}
            className="h-8 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink2">
          <input
            type="checkbox"
            checked={legacyRule}
            onChange={(e) => setLegacyRule(e.target.checked)}
            className="h-4 w-4 accent-blue"
          />
          {t("curve.legacyRule")}
        </label>
      </div>

      <CurveChart rows={rows} ariaLabel={t("curve.chart.aria", { name: cardLabel, x })} />

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "turn_curve.csv",
              ["turn", "n_seen", "probability", "exact_fraction", "one_in_n"],
              rows.map((r) => [String(r.turn), String(r.nSeen), r.percent, r.fraction, r.oneIn]),
            )
          }
          className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink"
        >
          {t("table.csv")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("curve.title")}</caption>
          <thead>
            <tr className="border-b hairline text-left text-xs text-ink2">
              <th scope="col" className="py-1.5 pr-3 font-medium">{t("curve.table.turn")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("curve.table.nSeen")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("table.probability")}</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("table.fraction")}</th>
              <th scope="col" className="py-1.5 text-right font-medium">{t("table.oneIn")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.turn} className="border-b hairline last:border-b-0">
                <td className="py-1.5 pr-3 font-mono">T{r.turn}</td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {r.nSeen}
                  {r.capped && <span className="text-ink2"> {t("curve.capped")}</span>}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.percent}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{r.fraction}</td>
                <td className="py-1.5 text-right font-mono">{r.oneIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Step curve, single chart blue (docs/04 §5). */
function CurveChart({ rows, ariaLabel }: { rows: TurnCurveRow[]; ariaLabel: string }) {
  const w = 360;
  const h = 150;
  const padL = 34;
  const padB = 20;
  const padT = 8;
  const innerW = w - padL - 8;
  const innerH = h - padB - padT;
  const xPos = (i: number) => padL + (i / Math.max(rows.length - 1, 1)) * innerW;
  const yPos = (p: number) => padT + (1 - p) * innerH;

  let path = "";
  rows.forEach((r, i) => {
    const xx = xPos(i);
    const yy = yPos(r.chart);
    if (i === 0) path += `M ${xx} ${yy}`;
    else path += ` H ${xx} V ${yy}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full max-w-lg" role="img" aria-label={ariaLabel}>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={padL} y1={yPos(g)} x2={w - 8} y2={yPos(g)} stroke="#E3DFD6" strokeWidth="1" />
          <text x={padL - 4} y={yPos(g) + 3} fontSize="8" fill="#5A6069" textAnchor="end" className="font-mono">
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#2B59C3" strokeWidth="2" />
      {rows.map((r, i) => (
        <g key={r.turn}>
          <circle cx={xPos(i)} cy={yPos(r.chart)} r="2.5" fill="#2B59C3">
            <title>{`T${r.turn} (n=${r.nSeen}): ${r.percent} = ${r.fraction}`}</title>
          </circle>
          <text x={xPos(i)} y={h - 6} fontSize="8" fill="#5A6069" textAnchor="middle" className="font-mono">
            T{r.turn}
          </text>
        </g>
      ))}
    </svg>
  );
}
