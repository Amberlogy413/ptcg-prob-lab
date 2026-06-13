import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { PrecisionRuler } from "../components/PrecisionRuler.tsx";
import { computeMidgame, computeShuffleBack, computeScenario } from "../state/midgame.ts";
import {
  loadCatalog,
  searchCatalog,
  groupByName,
  type Catalog,
} from "../data/catalog.ts";

/**
 * 中局計算器 (docs/09 §4 #1): the probability of hitting outs in the next
 * draws from the CURRENT deck state — the question every player asks from
 * turn 2 onward and no opening-hand tool answers. Exact hypergeometric over
 * (u, x, w, k); golden v2 pins the math against the independent Python.
 * The 情境分析 panel generalizes this to any multi-card joint scenario.
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
    <div className="flex flex-col gap-6">
      <ScenarioBuilder />
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
    </div>
  );
}

/**
 * 情境分析 (深度數學分析任何場景): build the current board state freely — add
 * specific cards (catalog or custom), set how many remain in the deck and how
 * many you draw, and read the EXACT joint probability that every requirement
 * is met. Multivariate hypergeometric (golden v2 scenario_joint).
 */
function ScenarioBuilder() {
  const t = useT();
  const [u, setU] = useState(40);
  const [w, setW] = useState(1);
  const [cards, setCards] = useState<Array<{ id: string; label: string; count: number; min: number; max: number }>>(
    [{ id: "c0", label: t("scenario.sampleCard"), count: 4, min: 1, max: 4 }],
  );
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [query, setQuery] = useState("");
  let nextId = cards.length;

  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (c) => alive && setCatalog(c),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.trunc(v))) : lo;

  const addCard = (label: string, count: number) => {
    setCards((cs) => [...cs, { id: `c${nextId++}-${Date.now() % 1e6}`, label, count, min: 1, max: count }]);
    setQuery("");
  };
  const update = (id: string, patch: Partial<{ count: number; min: number; max: number; label: string }>) =>
    setCards((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        next.count = clamp(next.count, 1, u);
        next.min = clamp(next.min, 0, next.count);
        next.max = clamp(next.max, next.min, next.count);
        return next;
      }),
    );
  const remove = (id: string) => setCards((cs) => cs.filter((c) => c.id !== id));

  const totalCopies = cards.reduce((s, c) => s + c.count, 0);
  const valid = u >= 1 && w >= 1 && w <= u && cards.length > 0 && totalCopies <= u;
  const result = useMemo(
    () =>
      valid
        ? computeScenario({ u, w, cards: cards.map((c) => ({ label: c.label, count: c.count, min: c.min, max: c.max })) })
        : null,
    [u, w, cards, valid],
  );

  const searchResults =
    catalog !== null && query.trim() !== ""
      ? groupByName(catalog, searchCatalog(catalog, query, 80)).slice(0, 8)
      : [];

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("scenario.title")}</h2>
      <p className="mt-1 text-sm text-ink2">{t("scenario.subtitle")}</p>

      {/* state: deck remaining + draw count */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink2">{t("scenario.u")}</span>
          <input
            type="number"
            min={1}
            max={60}
            value={u}
            onChange={(e) => setU(clamp(Number(e.target.value), 1, 60))}
            className="h-9 w-20 rounded-ctl border hairline bg-surface text-center font-mono text-base"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink2">{t("scenario.w")}</span>
          <input
            type="number"
            min={1}
            max={60}
            value={w}
            onChange={(e) => setW(clamp(Number(e.target.value), 1, 60))}
            className="h-9 w-20 rounded-ctl border hairline bg-surface text-center font-mono text-base"
          />
        </label>
      </div>

      {/* tracked cards */}
      <ul className="mt-3 flex flex-col gap-2">
        {cards.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-ctl border hairline bg-paper p-2">
            <input
              type="text"
              value={c.label}
              aria-label={t("scenario.cardLabel")}
              onChange={(e) => update(c.id, { label: e.target.value })}
              className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-ink2">
              {t("scenario.copies")}
              <input
                type="number"
                min={1}
                max={u}
                value={c.count}
                aria-label={t("scenario.copies")}
                onChange={(e) => update(c.id, { count: Number(e.target.value) })}
                className="h-9 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
              />
            </label>
            <select
              value={c.min === c.max ? `eq${c.min}` : c.min >= 1 && c.max >= c.count ? `ge${c.min}` : c.max < c.count && c.min === 0 ? `le${c.max}` : "custom"}
              aria-label={t("scenario.constraint")}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("ge")) update(c.id, { min: Number(v.slice(2)), max: c.count });
                else if (v.startsWith("eq")) update(c.id, { min: Number(v.slice(2)), max: Number(v.slice(2)) });
                else if (v.startsWith("le")) update(c.id, { min: 0, max: Number(v.slice(2)) });
              }}
              className="h-9 rounded-ctl border hairline bg-surface px-1 text-sm text-ink2"
            >
              <option value="ge1">{t("scenario.ge", { n: 1 })}</option>
              <option value="ge2">{t("scenario.ge", { n: 2 })}</option>
              <option value="ge3">{t("scenario.ge", { n: 3 })}</option>
              <option value="eq1">{t("scenario.eq", { n: 1 })}</option>
              <option value="eq0">{t("scenario.eq", { n: 0 })}</option>
              <option value="le1">{t("scenario.le", { n: 1 })}</option>
            </select>
            <button
              type="button"
              aria-label={t("deck.card.delete")}
              onClick={() => remove(c.id)}
              className="h-9 w-9 shrink-0 rounded-ctl border hairline bg-surface text-ink2 hover:text-bad"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* add card: catalog search + custom */}
      <div className="mt-2">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            aria-label={t("scenario.search")}
            placeholder={t("scenario.search")}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-sm"
          />
          <button
            type="button"
            onClick={() => addCard(t("scenario.customCard"), 4)}
            className="h-9 shrink-0 rounded-ctl border hairline px-3 text-sm text-ink2 hover:text-ink"
          >
            ＋ {t("scenario.addCustom")}
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="mt-1 max-h-40 overflow-y-auto rounded-ctl border hairline bg-paper">
            {searchResults.map(({ rep }) => (
              <li key={rep.id}>
                <button
                  type="button"
                  onClick={() => addCard(rep.name, 4)}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-surface"
                >
                  <span className="min-w-0 truncate">{rep.name}</span>
                  <span className="shrink-0 text-xs text-ink2">＋</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!valid || result === null ? (
        <p className="mt-4 text-sm text-warn" role="status">
          {t("scenario.invalid")}
        </p>
      ) : (
        <>
          <div className="mt-5">
            <p className="text-xs text-ink2">{t("scenario.jointLabel")}</p>
            <p className="font-mono text-2xl">{result.percent}</p>
            <p className="mt-1 font-mono text-sm text-ink2">
              {result.fraction} · {result.oneIn}
            </p>
            <div className="mt-2">
              <PrecisionRuler value={result.chart} ariaLabel={t("scenario.ruler")} labels />
            </div>
          </div>

          {result.perCard.length > 1 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b hairline text-left text-xs text-ink2">
                    <th scope="col" className="py-1 pr-3 font-medium">{t("scenario.cardLabel")}</th>
                    <th scope="col" className="py-1 pr-3 font-medium">{t("scenario.constraint")}</th>
                    <th scope="col" className="py-1 text-right font-medium">{t("scenario.marginal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perCard.map((pc, i) => (
                    <tr key={`${pc.label}-${i}`} className="border-b hairline last:border-b-0">
                      <td className="py-1 pr-3">{pc.label}</td>
                      <td className="py-1 pr-3 font-mono text-ink2">
                        ×{pc.count} {pc.constraint}
                      </td>
                      <td className="py-1 text-right font-mono">{pc.percent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-ink2">{t("scenario.marginalNote")}</p>
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-blue">{t("midgame.derivation")}</summary>
            <div className="mt-2 rounded-card bg-receipt p-4 font-mono text-sm shadow-receipt">
              {result.derivation.map((line) => (
                <p key={line} className="whitespace-pre-wrap">
                  {line}
                </p>
              ))}
            </div>
          </details>
        </>
      )}
      <p className="mt-3 text-xs text-ink2">{t("midgame.disclaimer")}</p>
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
