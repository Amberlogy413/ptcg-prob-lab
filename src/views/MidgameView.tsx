import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { PrecisionRuler } from "../components/PrecisionRuler.tsx";
import { computeMidgame, computeShuffleBack } from "../state/midgame.ts";

/**
 * 中局計算器 (docs/09 §4 #1): the probability of hitting outs in the next
 * draws from the CURRENT deck state — the question every player asks from
 * turn 2 onward and no opening-hand tool answers. Exact hypergeometric over
 * (u, x, w, k); golden v2 pins the math against the independent Python.
 */
export function MidgameView() {
  const t = useT();
  const [u, setU] = useState(30);
  const [x, setX] = useState(4);
  const [w, setW] = useState(1);
  const [k, setK] = useState(1);

  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.trunc(v))) : lo;

  const valid = u >= 1 && x >= 0 && x <= u && w >= 1 && w <= u && k >= 1;
  const result = useMemo(() => (valid ? computeMidgame({ u, x, w, k }) : null), [u, x, w, k, valid]);

  const field = (
    labelKey: string,
    value: number,
    set: (n: number) => void,
    lo: number,
    hi: number,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-40 text-ink2">{t(labelKey)}</span>
      <input
        type="number"
        inputMode="numeric"
        min={lo}
        max={hi}
        value={value}
        onChange={(e) => set(clamp(Number(e.target.value), lo, hi))}
        className="h-9 w-20 rounded-ctl border hairline bg-surface text-center font-mono text-base"
      />
    </label>
  );

  const preset = (labelKey: string, apply: () => void) => (
    <button
      key={labelKey}
      type="button"
      onClick={apply}
      className="rounded-ctl border hairline bg-surface px-3 py-1.5 text-sm text-ink2 hover:text-ink"
    >
      {t(labelKey)}
    </button>
  );

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("midgame.title")}</h2>
      <p className="mt-1 text-sm text-ink2">{t("midgame.subtitle")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {preset("midgame.preset.next", () => setW(1))}
        {preset("midgame.preset.two", () => setW(2))}
        {preset("midgame.preset.three", () => setW(3))}
      </div>
      <p className="mt-2 text-xs text-ink2">{t("midgame.ionoHint")}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {field("midgame.u", u, setU, 1, 60)}
        {field("midgame.x", x, setX, 0, 60)}
        {field("midgame.w", w, setW, 1, 60)}
        {field("midgame.k", k, setK, 1, 7)}
      </div>

      {!valid || result === null ? (
        <p className="mt-4 text-sm text-warn" role="status">
          {t("midgame.invalid")}
        </p>
      ) : (
        <>
          {/* Headline: three formats + ruler (docs/04 §5 layer 1). */}
          <div className="mt-6">
            <p className="font-mono text-2xl">{result.percent}</p>
            <p className="mt-1 font-mono text-sm text-ink2">
              {result.fraction} · {result.oneIn}
            </p>
            <div className="mt-2">
              <PrecisionRuler value={result.chart} ariaLabel={t("midgame.ruler")} labels />
            </div>
          </div>

          {/* 推導明細 (receipt layer). */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-blue">
              {t("midgame.derivation")}
            </summary>
            <div className="mt-2 rounded-card bg-receipt p-4 font-mono text-sm shadow-receipt">
              {result.derivation.map((line) => (
                <p key={line} className="whitespace-pre-wrap">
                  {line}
                </p>
              ))}
            </div>
          </details>

          {/* 實際意義 — judgement + build sensitivity. */}
          <div className="mt-4 rounded-ctl border hairline bg-paper p-3 text-sm">
            <p className="font-medium">{t("midgame.meaning.title")}</p>
            <p className="mt-1">
              {t("midgame.meaning.main", { w, k, p: result.percent, oneIn: result.oneIn })}
            </p>
            {result.up !== undefined && (
              <p className="mt-1">
                {t("midgame.meaning.up", {
                  x1: result.up.x,
                  p1: result.up.percent,
                  d: result.up.deltaPp,
                })}
              </p>
            )}
            {result.down !== undefined && (
              <p className="mt-1">
                {t("midgame.meaning.down", {
                  x0: result.down.x,
                  p0: result.down.percent,
                  d: result.down.deltaPp,
                })}
              </p>
            )}
            <p className="mt-2 text-xs text-ink2">{t("midgame.meaning.note")}</p>
          </div>

          <p className="mt-3 text-xs text-ink2">{t("midgame.disclaimer")}</p>
        </>
      )}

      <ShuffleBackSection />
    </section>
  );
}

/**
 * 奇樹/裁判 shuffle-back redraw (docs/09 #53): the hand is shuffled into the
 * deck, then you redraw — an exact three-population mixture (unknown deck,
 * facedown prizes, returned KNOWN hand), golden-pinned vs Python.
 */
function ShuffleBackSection() {
  const t = useT();
  const [D, setD] = useState(16);
  const [p, setP] = useState(4);
  const [xU, setXU] = useState(3);
  const [xH, setXH] = useState(1);
  const [h, setH] = useState(5);
  const [draw, setDraw] = useState(4);
  const [k, setK] = useState(1);

  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.trunc(v))) : lo;

  const valid =
    D >= 0 &&
    p >= 0 &&
    D + p >= 1 &&
    xU >= 0 &&
    xU <= D + p &&
    h >= 0 &&
    xH >= 0 &&
    xH <= h &&
    draw >= 1 &&
    draw <= D + h &&
    k >= 1;
  const result = useMemo(
    () => (valid ? computeShuffleBack({ D, p, xU, xH, h, draw, k }) : null),
    [D, p, xU, xH, h, draw, k, valid],
  );

  const field = (
    labelKey: string,
    value: number,
    set: (n: number) => void,
    lo: number,
    hi: number,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-44 text-ink2">{t(labelKey)}</span>
      <input
        type="number"
        inputMode="numeric"
        min={lo}
        max={hi}
        value={value}
        onChange={(e) => set(clamp(Number(e.target.value), lo, hi))}
        className="h-9 w-20 rounded-ctl border hairline bg-surface text-center font-mono text-base"
      />
    </label>
  );

  return (
    <div className="mt-8 border-t hairline pt-4">
      <h3 className="text-lg font-medium">{t("midgame.sb.title")}</h3>
      <p className="mt-1 text-sm text-ink2">{t("midgame.sb.desc")}</p>
      <p className="mt-1 text-xs text-ink2">{t("midgame.sb.hint")}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {field("midgame.sb.D", D, setD, 0, 60)}
        {field("midgame.sb.p", p, setP, 0, 6)}
        {field("midgame.sb.xU", xU, setXU, 0, 60)}
        {field("midgame.sb.h", h, setH, 0, 20)}
        {field("midgame.sb.xH", xH, setXH, 0, 20)}
        {field("midgame.sb.draw", draw, setDraw, 1, 20)}
        {field("midgame.sb.k", k, setK, 1, 7)}
      </div>

      {!valid || result === null ? (
        <p className="mt-3 text-sm text-warn" role="status">
          {t("midgame.sb.invalid")}
        </p>
      ) : (
        <>
          <div className="mt-4">
            <p className="font-mono text-2xl">{result.percent}</p>
            <p className="mt-1 font-mono text-sm text-ink2">
              {result.fraction} · {result.oneIn}
            </p>
            <div className="mt-2">
              <PrecisionRuler value={result.chart} ariaLabel={t("midgame.sb.ruler")} labels />
            </div>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-blue">
              {t("midgame.derivation")}
            </summary>
            <div className="mt-2 rounded-card bg-receipt p-4 font-mono text-sm shadow-receipt">
              {result.derivation.map((line) => (
                <p key={line} className="whitespace-pre-wrap">
                  {line}
                </p>
              ))}
            </div>
          </details>

          <div className="mt-3 rounded-ctl border hairline bg-paper p-3 text-sm">
            <p className="font-medium">{t("midgame.meaning.title")}</p>
            <p className="mt-1">
              {t("midgame.sb.meaning", { draw, k, p: result.percent, oneIn: result.oneIn })}
            </p>
            {result.up !== undefined && (
              <p className="mt-1">
                {t("midgame.meaning.up", {
                  x1: result.up.x,
                  p1: result.up.percent,
                  d: result.up.deltaPp,
                })}
              </p>
            )}
            {result.down !== undefined && (
              <p className="mt-1">
                {t("midgame.meaning.down", {
                  x0: result.down.x,
                  p0: result.down.percent,
                  d: result.down.deltaPp,
                })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
